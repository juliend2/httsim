const { escapeHtml } = require('../reqres');

const PAGE_CSS = `body{font-family:system-ui,-apple-system,sans-serif;background:#e9edf3;margin:0;display:grid;place-items:center;min-height:100vh}
.card{background:#fff;padding:24px 28px;border-radius:10px;box-shadow:0 2px 12px rgba(0,0,0,.15);width:340px}
h2{margin:0 0 14px;font-size:17px}
label{font-size:13px;display:block;margin:6px 0 2px;color:#334}
input{width:100%;padding:8px;margin:2px 0 8px;box-sizing:border-box;border:1px solid #ccd;border-radius:6px}
button{padding:8px 14px;border:0;border-radius:6px;background:#2a5bd7;color:#fff;cursor:pointer;margin-right:8px}
button.deny{background:#667}
.muted{color:#667;font-size:12px}
.err{color:#c33;font-size:13px}`;

function page(title, body) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>${PAGE_CSS}</style></head><body><div class="card">${body}</div></body></html>`;
}

function escapeAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

function loginForm(currentUrl, error) {
  return `${error ? `<p class="err">${escapeHtml(error)}</p>` : ''}
<form method="POST" action="/login">
  <input type="hidden" name="continue" value="${escapeAttr(currentUrl)}">
  <label>username</label><input name="username" autofocus>
  <label>password</label><input name="password" type="password">
  <button>Sign in</button>
</form>
<p class="muted">test account: alice / welcome123</p>`;
}

function consentPage(user, q, authorizeUrl) {
  const scopes = String(q.scope || '').split(' ').filter(Boolean);
  return page('ExampleId — consent', `
<h2>Authorize request</h2>
<p><b>${escapeHtml(user)}</b>, the app <b>${escapeHtml(q.client_id || '')}</b> asks to access:</p>
<ul>${scopes.map((s) => `<li><code>${escapeHtml(s)}</code></li>`).join('') || '<li><i>(nothing)</i></li>'}</ul>
<form method="POST" action="/consent">
  <input type="hidden" name="authorize" value="${escapeAttr(authorizeUrl)}">
  <button name="decision" value="approve">Allow</button>
  <button name="decision" value="deny" class="deny">Deny</button>
</form>`);
}

function errorRedirect(redirectUri, error, state) {
  const out = new URL(redirectUri);
  out.searchParams.set('error', error);
  if (state) out.searchParams.set('state', state);
  return out.toString();
}

module.exports = function makeIdp(cfg) {
  return async function handle(req, res, httsim) {
    const sessions = httsim.store('sessions');
    const codes = httsim.store('codes');
    const tokens = httsim.store('tokens');

    if (req.path === '/authorize') {
      const q = req.query;
      if (q.client_id !== cfg.client.id || q.redirect_uri !== cfg.client.redirectUri) {
        return res.status(400).html(page('ExampleId — error',
          `<h2>invalid_client</h2><p class="err">Unknown client_id or redirect_uri mismatch.</p>` +
          `<p class="muted">this IdP only knows client "${escapeHtml(cfg.client.id)}" with redirect_uri "${escapeHtml(cfg.client.redirectUri)}"</p>`));
      }
      if (q.response_type !== 'code') {
        return res.redirect(errorRedirect(q.redirect_uri, 'unsupported_response_type', q.state));
      }
      const scopes = String(q.scope || '').split(' ').filter(Boolean);
      if (scopes.some((s) => !cfg.scopes.includes(s))) {
        return res.redirect(errorRedirect(q.redirect_uri, 'invalid_scope', q.state));
      }
      const sess = req.cookies['idp_sid'] && sessions.get(req.cookies['idp_sid']);
      if (!sess) {
        return res.html(page('ExampleId — sign in', `<h2>Sign in to ExampleId</h2>${loginForm(req.url)}`));
      }
      return res.html(consentPage(sess.user, q, req.url));
    }

    if (req.path === '/login' && req.method === 'POST') {
      const f = req.form || {};
      let cont = null;
      try {
        const u = new URL(String(f.continue || ''));
        if (u.host === req.host) cont = u.toString();
      } catch (e) {}
      if (f.username === cfg.user.username && f.password === cfg.user.password) {
        const sid = httsim.random();
        sessions.set(sid, { user: f.username });
        res.setCookie('idp_sid', sid, { httpOnly: true, sameSite: 'Lax' });
        return res.redirect(cont || '/authorize');
      }
      return res.html(page('ExampleId — sign in', `<h2>Sign in to ExampleId</h2>${loginForm(cont || '/authorize', 'Wrong username or password')}`));
    }

    if (req.path === '/consent' && req.method === 'POST') {
      const f = req.form || {};
      const sess = req.cookies['idp_sid'] && sessions.get(req.cookies['idp_sid']);
      if (!sess) return res.status(400).html(page('ExampleId', '<h2>Session expired — start again at the client</h2>'));
      const authorizeUrl = String(f.authorize || '');
      try {
        const u = new URL(authorizeUrl);
        if (u.host !== req.host) throw new Error('host');
      } catch (e) {
        return res.status(400).html(page('ExampleId', '<h2>Bad consent request</h2>'));
      }
      const inner = new URL(authorizeUrl);
      const target = inner.searchParams.get('redirect_uri') || cfg.client.redirectUri;
      const state = inner.searchParams.get('state') || '';
      const scope = inner.searchParams.get('scope') || '';
      const out = new URL(target);
      if (f.decision === 'approve') {
        const code = httsim.random();
        codes.set(code, { user: sess.user, scope, redirectUri: target, expires: Date.now() + 10 * 60 * 1000 });
        out.searchParams.set('code', code);
        if (state) out.searchParams.set('state', state);
      } else {
        out.searchParams.set('error', 'access_denied');
        if (state) out.searchParams.set('state', state);
      }
      return res.redirect(out.toString());
    }

    if (req.path === '/token' && req.method === 'POST') {
      const f = req.form || {};
      let clientId = f.client_id;
      let clientSecret = f.client_secret;
      const auth = req.headers.authorization || '';
      if ((clientId === undefined || clientSecret === undefined) && /^Basic /i.test(auth)) {
        const dec = Buffer.from(auth.slice(6).trim(), 'base64').toString('utf8');
        const i = dec.indexOf(':');
        if (clientId === undefined) clientId = dec.slice(0, i);
        if (clientSecret === undefined) clientSecret = dec.slice(i + 1);
      }
      if (clientId !== cfg.client.id || clientSecret !== cfg.client.secret) {
        return res.status(401).json({ error: 'invalid_client' });
      }
      if (f.grant_type !== 'authorization_code') {
        return res.status(400).json({ error: 'unsupported_grant_type', error_description: 'this IdP only implements the authorization_code grant' });
      }
      const rec = f.code && codes.get(f.code);
      if (!rec || rec.expires < Date.now() || rec.redirectUri !== f.redirect_uri) {
        return res.status(400).json({ error: 'invalid_grant' });
      }
      codes.delete(f.code);
      const accessToken = httsim.random();
      tokens.set(accessToken, { user: rec.user, scope: rec.scope, clientId });
      return res.json({ access_token: accessToken, token_type: 'Bearer', expires_in: 3600, scope: rec.scope });
    }

    return res.status(404).html(page('ExampleId', '<h2>Not found</h2>'));
  };
};