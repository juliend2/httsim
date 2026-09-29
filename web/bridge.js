(function () {
  function send(msg) {
    parent.postMessage(Object.assign({ httsim: 'nav' }, msg), '*');
  }

  document.addEventListener('click', function (e) {
    const t = e.target;
    const a = t && t.closest ? t.closest('a[href]') : null;
    if (!a) return;
    e.preventDefault();
    const href = a.getAttribute('href') || '';
    if (href[0] === '#' || href.slice(0, 11).toLowerCase() === 'javascript:') return;
    send({ method: 'GET', url: a.href });
  }, true);

  document.addEventListener('submit', function (e) {
    e.preventDefault();
    const form = e.target;
    if ((form.enctype || '').indexOf('multipart') === 0) {
      send({ error: 'multipart/form-data forms are not supported in HTTSim yet' });
      return;
    }
    let action;
    try {
      action = new URL(form.getAttribute('action') || '', document.baseURI).toString();
    } catch (err) {
      send({ error: 'bad form action: ' + err.message });
      return;
    }
    const method = (form.getAttribute('method') || 'GET').toUpperCase();
    const parts = [];
    for (const el of form.elements) {
      if (!el.name || el.disabled) continue;
      if (el.type === 'file') { send({ error: 'file inputs are not supported yet' }); return; }
      if ((el.type === 'checkbox' || el.type === 'radio') && !el.checked) continue;
      if (el.type === 'submit' || el.type === 'button' || el.type === 'reset') continue;
      parts.push([el.name, el.value == null ? '' : String(el.value)]);
    }
    if (e.submitter && e.submitter.name) parts.push([e.submitter.name, e.submitter.value]);
    if (method === 'GET') {
      const u = new URL(action);
      u.search = '';
      u.search = new URLSearchParams(parts).toString();
      send({ method: 'GET', url: u.toString() });
    } else {
      send({
        method: 'POST',
        url: action,
        body: new URLSearchParams(parts).toString(),
        contentType: 'application/x-www-form-urlencoded'
      });
    }
  }, true);
})();