const crypto = require('crypto');
const { state, store } = require('./state');
const cookies = require('./cookies');
const { buildRequest, Response, escapeHtml } = require('./reqres');
const { loadPlayer } = require('./loader');
const levels = require('./levels');
const inject = require('./inject');

const HANDLER_TIMEOUT_MS = 5000;

function normalizeUrl(url) {
  return /^https?:\/\//i.test(url) ? url : 'http://' + url;
}

function isHtml(response) {
  return /text\/html/i.test(response.headers['content-type'] || '');
}

function handlerFor(host) {
  const level = levels.get(state.levelId);
  if (!level) return null;
  const spec = level.hosts[host];
  if (!spec) return null;
  if (spec.type === 'player') {
    const mod = loadPlayer(spec.module);
    return typeof mod === 'function' ? mod : mod.handle;
  }
  return spec.make();
}

function withTimeout(promise, ms) {
  let timer;
  const limit = new Promise((resolve, reject) => {
    timer = setTimeout(() => reject(new Error(`handler timed out after ${ms}ms`)), ms);
  });
  if (timer.unref) timer.unref();
  return Promise.race([Promise.resolve(promise), limit]).finally(() => clearTimeout(timer));
}

function makeHttsim(logs) {
  const levelId = state.levelId;
  return {
    store(ns = 'player') {
      return store(`${levelId}:${ns}`);
    },
    log(text) {
      logs.push({ kind: 'log', via: 'backend', text: String(text) });
    },
    random() {
      return crypto.randomBytes(16).toString('hex');
    },
    async fetch(url, opts = {}) {
      let body = opts.body || '';
      const headers = { ...(opts.headers || {}) };
      if (typeof URLSearchParams !== 'undefined' && body instanceof URLSearchParams) {
        if (!headers['content-type']) headers['content-type'] = 'application/x-www-form-urlencoded';
        body = body.toString();
      }
      const req = buildRequest({
        method: String(opts.method || 'GET').toUpperCase(),
        url: normalizeUrl(url),
        headers,
        body,
        via: 'backend'
      });
      const res = new Response();
      await runHandler(req, res, logs);
      const respHeaders = { ...res.headers };
      if (res.cookies.length) respHeaders['set-cookie'] = res.cookies.slice();
      const entry = {
        id: state.history.length + 1,
        via: 'backend',
        label: 'backchannel',
        request: req,
        response: { status: res._status, headers: respHeaders, body: res.body },
        redirect: null,
        ts: Date.now()
      };
      state.history.push(entry);
      logs.push({ kind: 'req', via: 'backend', step: entry });
      logs.push({ kind: 'resp', via: 'backend', step: entry });
      return {
        status: res._status,
        headers: respHeaders,
        text: async () => res.body,
        json: async () => JSON.parse(res.body || 'null')
      };
    }
  };
}

async function runHandler(req, res, logs) {
  const handler = handlerFor(req.host);
  if (!handler) {
    res.status(502);
    res.html(errorPage(`no app is listening on "${req.host}" in this level`));
    return;
  }
  try {
    await withTimeout(handler(req, res, makeHttsim(logs)), HANDLER_TIMEOUT_MS);
  } catch (err) {
    logs.push({ kind: 'log', via: 'backend', text: `handler error on ${req.method} ${req.url}: ${err.message}` });
    res.status(500);
    res.html(errorPage(err.stack || String(err)));
  }
}

function errorPage(text) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>HTTSim error</title></head>` +
    `<body style="font:13px/1.5 ui-monospace,monospace;background:#14151f;color:#f7768e;padding:20px;white-space:pre-wrap">${escapeHtml(text)}</body></html>`;
}

async function runStep(input) {
  const level = levels.get(state.levelId);
  const via = input.via === 'backend' ? 'backend' : 'frontend';
  const logs = [];
  let request;
  try {
    request = buildRequest({
      method: input.method || 'GET',
      url: normalizeUrl(input.url),
      headers: input.headers || {},
      body: input.body || '',
      via
    });
  } catch (err) {
    logs.push({ kind: 'log', via, text: `bad request URL: ${err.message}` });
    return {
      step: null,
      redirect: null,
      logs,
      document: null,
      checks: level ? level.grade(state.history) : [],
      runId: state.runId
    };
  }

  const res = new Response();
  await runHandler(request, res, logs);

  if (via === 'frontend' && res.cookies.length) cookies.capture(request.host, res.cookies);

  const headers = { ...res.headers };
  if (res.cookies.length) headers['set-cookie'] = res.cookies.slice();
  let redirect = null;
  if (res._status >= 300 && res._status < 400 && headers.location) {
    try { redirect = new URL(headers.location, request.url).toString(); }
    catch (e) { redirect = headers.location; }
  }

  const step = {
    id: state.history.length + 1,
    via,
    label: input.label || '',
    request,
    response: { status: res._status, headers, body: res.body },
    redirect,
    ts: Date.now()
  };
  state.history.push(step);

  const document = via === 'frontend' && !redirect && isHtml(step.response)
    ? inject.document(request.url, step.response.body)
    : null;

  return {
    step,
    redirect,
    logs,
    document,
    checks: level ? level.grade(state.history) : [],
    runId: state.runId
  };
}

module.exports = { runStep };