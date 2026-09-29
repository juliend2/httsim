// ─── Level 3 · OAuth 2.0 Authorization Code flow ─────────────────────────
// You are the OAuth client. The game simulates the IdP (auth.example) and the
// protected API (api.example). Mission panel: tasks + RFC links.
//
// Test user on the IdP: alice / welcome123

const AUTH = 'http://auth.example';
const API = 'http://api.example';
const CLIENT = { id: 'webapp-1', secret: 'hunter2', redirectUri: 'http://client.app/cb' };

const PAGE = (title, body) => `<!doctype html>
<html><head><meta charset="utf-8"><title>${title}</title>
<style>
body{font-family:system-ui,sans-serif;margin:40px auto;max-width:520px;line-height:1.6}
a{color:#2a5bd7}
.card{border:1px solid #ddd;border-radius:8px;padding:16px}
.err{color:#c33}
</style></head><body>${body}</body></html>`;

module.exports = async function handle(req, res, httsim) {
  const oauth = httsim.store('oauth');

  if (req.path === '/') {
    return res.html(PAGE('webapp-1', `
<h1>webapp-1</h1>
<p>An app that wants to know who you are.</p>
<p><a href="/login">Sign in</a></p>`));
  }

  if (req.path === '/login') {
    // TASK 1 — send the user to the IdP's authorization endpoint with a real 302:
    //
    //   ${AUTH}/authorize?response_type=code&client_id=…&redirect_uri=…&scope=profile&state=…
    //
    // state must be random and unguessable (httsim.random()) — store it in
    // `oauth` so /cb can compare it when the IdP calls back.
    return res.html(PAGE('login', '<h1>TODO: redirect to the authorization endpoint</h1>'));
  }

  if (req.path === '/cb') {
    // The IdP sent the user back here with req.query.code and req.query.state.
    //
    // TASK 2 — verify req.query.state equals the state you stored in /login.
    //          (If not: render an error page. This defends against CSRF.)
    //
    // TASK 3 — exchange the code for tokens, SERVER-TO-SERVER (no browser!):
    //
    //   const resp = await httsim.fetch(`${AUTH}/token`, {
    //     method: 'POST',
    //     body: new URLSearchParams({
    //       grant_type: 'authorization_code',
    //       code: req.query.code,
    //       redirect_uri: CLIENT.redirectUri,
    //       client_id: CLIENT.id,
    //       client_secret: CLIENT.secret
    //     }).toString()
    //   });
    //   const tokens = await resp.json();   // → { access_token, token_type, … }
    //
    // TASK 4 — call the API with the access token:
    //
    //   await httsim.fetch(`${API}/profile`, {
    //     headers: { Authorization: `Bearer ${tokens.access_token}` }
    //   })
    //
    // TASK 5 — render the profile (name + email) as a page.
    const code = String(req.query.code || '');
    const state = String(req.query.state || '');
    return res.html(PAGE('callback', `<h1>TODO: handle the OAuth callback</h1>
<p class="card">code = ${code}<br>state = ${state}</p>`));
  }

  return res.status(404).html(PAGE('404', '<h1>404 — nothing here</h1>'));
};