const $ = (id) => document.getElementById(id);
const view = $('view');
const address = $('address');
const chip = $('chip');
const consoleEl = $('console');
const pendingEl = $('pending');
const missionEl = $('mission');

const ui = {
  runId: null,
  levelId: null,
  pending: null,
  docHtml: '',
  docs: '',
  checks: [],
  entries: []
};

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function api(method, path, body) {
  return fetch(path, {
    method,
    headers: body !== undefined ? { 'content-type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined
  }).then(async (r) => {
    if (!r.ok) throw new Error(path + ' → HTTP ' + r.status);
    return r.json();
  });
}

function save() {
  sessionStorage.setItem('httsim.ui', JSON.stringify({
    runId: ui.runId,
    levelId: ui.levelId,
    pending: ui.pending,
    docHtml: ui.docHtml,
    docs: ui.docs,
    checks: ui.checks,
    entries: ui.entries.slice(-200)
  }));
}

function statusClass(status) {
  return 'st-' + String(status)[0];
}

function viaTag(via) {
  return `<span class="via-${esc(via)}">[${esc(via)}]</span>`;
}

function reqText(step) {
  const label = step.label ? ` <span class="via-log">· ${esc(step.label)}</span>` : '';
  return `${viaTag(step.request.via)} → ${esc(step.request.method)} ${esc(step.request.url)}${label}`;
}

function reqDetail(step) {
  const q = step.request;
  const lines = Object.entries(q.headers).map(([k, v]) => `${k}: ${v}`);
  lines.push('', q.body || '(no body)');
  return lines.join('\n');
}

function respText(step) {
  const r = step.response;
  const loc = r.headers.location ? ` → ${esc(r.headers.location)}` : '';
  return `${viaTag(step.via)} <span class="${statusClass(r.status)}">← ${esc(r.status)}</span>${loc}`;
}

function respDetail(step) {
  const r = step.response;
  const lines = Object.entries(r.headers).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join('\n    ') : v}`);
  let body = r.body || '(empty body)';
  if (body.length > 4000) body = body.slice(0, 4000) + `\n… truncated (${body.length} bytes total)`;
  return lines.join('\n') + '\n\n' + body;
}

function entryEl(kind, html, detail) {
  const el = document.createElement('div');
  el.className = 'entry';
  if (kind === 'log') {
    el.innerHTML = `<span class="via-log">· ${esc(html)}</span>`;
    return el;
  }
  const d = document.createElement('details');
  const s = document.createElement('summary');
  s.innerHTML = html;
  const pre = document.createElement('pre');
  pre.textContent = detail || '';
  d.append(s, pre);
  el.append(d);
  return el;
}

function addEntry(entry) {
  consoleEl.prepend(entryEl(entry.kind, entry.html, entry.detail));
  ui.entries.push(entry);
  if (ui.entries.length > 400) ui.entries.shift();
}

function replayEntries() {
  consoleEl.innerHTML = '';
  for (const e of ui.entries) consoleEl.prepend(entryEl(e.kind, e.html, e.detail));
}

function consoleMirror(step, logs) {
  const out = [];
  out.push(`[frontend] → ${step.request.method} ${step.request.url}`);
  for (const l of logs || []) {
    if (l.kind === 'log') out.push(`[backend] · ${l.text}`);
    if (l.kind === 'req') out.push(`[backend] → ${l.step.request.method} ${l.step.request.url}`);
    if (l.kind === 'resp') out.push(`[backend] ← ${l.step.response.status} ${l.step.request.url}`);
  }
  out.push(`[frontend] ← ${step.response.status} ${step.request.url}`);
  console.log(out.join('\n'));
}

function setDoc(html) {
  ui.docHtml = html || '';
  view.srcdoc = ui.docHtml;
}

function renderStep(step, docHtml) {
  const ct = step.response.headers['content-type'] || '';
  if (step.redirect) return;
  if (/text\/html/i.test(ct)) {
    setDoc(docHtml || `<pre>${esc(step.response.body)}</pre>`);
  } else {
    setDoc(`<html><head><meta charset="utf-8"><style>body{margin:0;background:#0b0d11;color:#d7dce3}pre{margin:0;padding:16px;font:13px/1.5 ui-monospace,Menlo,monospace;white-space:pre-wrap;word-break:break-word}</style></head><body><pre>${esc(step.response.body || '(empty body)')}</pre></body></html>`);
  }
}

function renderChecks(checks) {
  ui.checks = checks || [];
  const box = $('checks');
  box.innerHTML = '';
  for (const c of ui.checks) {
    const el = document.createElement('div');
    const cls = !c.attempted ? 'wait' : c.pass ? 'ok' : 'fail';
    const dot = !c.attempted ? '·' : c.pass ? '✓' : '✗';
    el.className = 'chk ' + cls;
    el.innerHTML = `<span class="dot">${dot}</span><span>${esc(c.label)}</span>` +
      (cls === 'fail' && c.hint ? `<span class="hint">hint: ${esc(c.hint)}</span>` : '');
    box.appendChild(el);
  }
}

function renderDocs(html) {
  ui.docs = html || '';
  $('docs').innerHTML = ui.docs;
}

function setPending(nav) {
  ui.pending = nav || null;
  pendingEl.classList.toggle('hidden', !ui.pending);
  chip.classList.toggle('paused', !!ui.pending);
  chip.textContent = ui.pending ? '● paused' : '○ idle';
  address.classList.toggle('paused', !!ui.pending);
  if (ui.pending) {
    $('p-method').textContent = ui.pending.method;
    $('p-url').textContent = ui.pending.url;
    $('p-url').title = ui.pending.url;
    const hasBody = !!((ui.pending.body || '').length);
    $('p-detail').classList.toggle('hidden', !hasBody);
    $('p-body').textContent = ui.pending.body || '';
    address.value = ui.pending.url;
  }
  save();
}

async function sendPending() {
  const nav = ui.pending;
  if (!nav || nav.sending) return;
  nav.sending = true;
  try {
    const out = await api('POST', '/__step', {
      method: nav.method,
      url: nav.url,
      body: nav.body || '',
      headers: nav.contentType ? { 'content-type': nav.contentType } : {},
      via: nav.via || 'frontend',
      label: nav.label || ''
    });
    if (out.runId !== ui.runId) {
      addEntry({ kind: 'log', html: 'the server run changed (restart?) — resetting the UI' });
      await resetRun(ui.levelId || 'l1-basics', true);
      return;
    }
    const step = out.step;
    if (!step) {
      for (const l of out.logs || []) addEntry({ kind: 'log', html: l.text });
      setPending(null);
      save();
      return;
    }
    addEntry({ kind: 'req', html: reqText(step), detail: reqDetail(step) });
    for (const l of out.logs || []) {
      if (l.kind === 'log') addEntry({ kind: 'log', html: l.text });
      else if (l.kind === 'req') addEntry({ kind: 'req', html: reqText(l.step), detail: reqDetail(l.step) });
      else if (l.kind === 'resp') addEntry({ kind: 'resp', html: respText(l.step), detail: respDetail(l.step) });
    }
    addEntry({ kind: 'resp', html: respText(step), detail: respDetail(step) });
    consoleMirror(step, out.logs);
    renderStep(step, out.document);
    renderChecks(out.checks);
    if (out.redirect) {
      const code = step.response.status;
      const follow = (code === 307 || code === 308)
        ? { method: nav.method, url: out.redirect, body: nav.body || '', contentType: nav.contentType || '', via: 'frontend', label: 'follow redirect' }
        : { method: 'GET', url: out.redirect, body: '', contentType: '', via: 'frontend', label: 'follow redirect' };
      setPending(follow);
    } else {
      setPending(null);
      address.value = step.request.url;
    }
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  } catch (err) {
    nav.sending = false;
    addEntry({ kind: 'log', html: 'UI error: ' + err.message });
  }
  save();
}

async function resetRun(levelId, silent) {
  if (!silent && !confirm('Reset this run and restart the level?')) {
    $('level').value = ui.levelId;
    return;
  }
  const out = await api('POST', '/__reset', { levelId });
  ui.runId = out.runId;
  ui.levelId = out.levelId;
  ui.pending = null;
  ui.entries = [];
  localStorage.setItem('httsim.level', out.levelId);
  $('level').value = out.levelId;
  consoleEl.innerHTML = '';
  renderDocs(out.docs);
  renderChecks(out.checks);
  setDoc('');
  setPending({ method: 'GET', url: out.entry, via: 'frontend', label: 'level start' });
  missionEl.classList.remove('hidden');
  save();
}

function bind() {
  $('send').onclick = sendPending;
  $('reset').onclick = () => resetRun(ui.levelId);
  $('level').onchange = (e) => resetRun(e.target.value);
  $('mission-btn').onclick = () => missionEl.classList.toggle('hidden');
  $('mission-close').onclick = () => missionEl.classList.add('hidden');
  address.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    let u = address.value.trim();
    if (!u) return;
    if (!/^https?:\/\//i.test(u)) u = 'http://' + u;
    setPending({ method: 'GET', url: u, via: 'frontend', label: 'typed URL' });
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target === document.body && ui.pending) {
      e.preventDefault();
      sendPending();
    }
  });
  window.addEventListener('message', (ev) => {
    if (!ev.data || ev.data.httsim !== 'nav') return;
    if (ev.data.error) {
      addEntry({ kind: 'log', html: 'page: ' + ev.data.error });
      save();
      return;
    }
    setPending({
      method: ev.data.method || 'GET',
      url: ev.data.url,
      body: ev.data.body || '',
      contentType: ev.data.contentType || '',
      via: 'frontend',
      label: 'link / form'
    });
  });
}

async function init() {
  const { levels } = await api('GET', '/__levels');
  const sel = $('level');
  for (const l of levels) {
    const o = document.createElement('option');
    o.value = l.id;
    o.textContent = l.title;
    sel.appendChild(o);
  }
  let saved = null;
  try { saved = JSON.parse(sessionStorage.getItem('httsim.ui')); } catch (e) {}
  const run = await api('GET', '/__run');
  if (saved && saved.runId === run.runId) {
    ui.runId = run.runId;
    ui.levelId = run.levelId;
    sel.value = run.levelId;
    ui.entries = saved.entries || [];
    renderDocs(saved.docs || '');
    renderChecks(saved.checks || []);
    replayEntries();
    ui.docHtml = saved.docHtml || '';
    view.srcdoc = ui.docHtml;
    setPending(saved.pending);
  } else {
    const stored = localStorage.getItem('httsim.level');
    const id = levels.some((l) => l.id === stored) ? stored : levels[0].id;
    await resetRun(id, true);
  }
  bind();
}

init();