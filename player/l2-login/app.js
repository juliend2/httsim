// ─── Level 2 · Sessions with cookies ─────────────────────────────────────
// Implement login/logout with a session cookie.
// Test account: alice / welcome123
//
//   req / res / httsim reference → mission panel in the game.

const PAGE = (title, body) => `<!doctype html>
<html><head><meta charset="utf-8"><title>${title}</title>
<style>
body{font-family:system-ui,sans-serif;margin:40px auto;max-width:520px;line-height:1.5}
input{padding:8px;width:100%;box-sizing:border-box;margin:2px 0 10px}
form{border:1px solid #ddd;padding:16px;border-radius:8px}
button{padding:8px 14px}
.err{color:#c33}
</style></head><body>${body}</body></html>`;

module.exports = async function handle(req, res, httsim) {
  const sessions = httsim.store('sessions');

  if (req.path === '/') {
    return res.html(PAGE('site.test', `
<h1>site.test</h1>
<ul>
  <li><a href="/login">login</a></li>
  <li><a href="/profile">profile (protected)</a></li>
  <li><a href="/logout">logout</a></li>
</ul>`));
  }

  if (req.path === '/login' && req.method === 'GET') {
    return res.html(PAGE('login', `
<h1>Log in</h1>
<form method="POST" action="/login">
  <input name="username" placeholder="username" autofocus>
  <input name="password" type="password" placeholder="password">
  <button>Log in</button>
</form>`));
  }

  if (req.path === '/login' && req.method === 'POST') {
    // TASK 2 — validate req.form.username / req.form.password against
    //          alice / welcome123.
    // Success: mint a session id (httsim.random()), keep it in `sessions`,
    //          send it as a cookie (res.setCookie) and redirect to /profile.
    // Failure: re-render the form with an error message.
    return res.html(PAGE('login', '<h1>TODO: validate the credentials</h1>'));
  }

  if (req.path === '/profile') {
    // TASK 3 — if there is no valid session (req.cookies.sid → sessions),
    //          redirect to /login. Otherwise greet the logged-in user.
    return res.html(PAGE('profile', '<h1>TODO: who is logged in?</h1>'));
  }

  if (req.path === '/logout') {
    // TASK 4 — drop the session, expire the cookie (Max-Age=0), redirect to /.
    return res.html(PAGE('logout', '<h1>TODO: log me out</h1>'));
  }

  return res.status(404).html(PAGE('404', '<h1>404 — nothing here</h1>'));
};