const { onPath, check, API_DOCS } = require('./util');

const HOST = 'site.test';

function setCookies(e) {
  return [].concat((e && e.response.headers['set-cookie']) || []);
}

const DOCS = `
<h2>Level 2 — Sessions with cookies</h2>
<p>Same host as level 1, new app: <code>player/l2-login/app.js</code>. Implement
login/logout with a session cookie. When your code sends <code>Set-Cookie</code>,
the fake browser's cookie jar stores it and replays it automatically — watch the
<code>Cookie:</code> header appear in expanded request details in the console.</p>
<ol>
  <li><code>GET /login</code> shows the login form.</li>
  <li><code>POST /login</code> with <b>alice / welcome123</b> responds with
  <code>Set-Cookie: sid=…</code> and redirects to <code>/profile</code>. Wrong
  credentials re-render the form with an error.</li>
  <li><code>GET /profile</code> <i>without</i> a valid session cookie redirects
  to <code>/login</code>; <i>with</i> one it greets Alice. (Try it logged-out
  first!)</li>
  <li><code>/logout</code> clears the cookie (<code>Max-Age=0</code>) and drops
  the stored session, so <code>/profile</code> locks again.</li>
</ol>
<p>Hint: mint the session id with <code>httsim.random()</code> and keep sessions
in <code>httsim.store('sessions')</code>.</p>
`;

module.exports = {
  id: 'l2-login',
  title: 'L2 · Sessions & cookies',
  entry: `http://${HOST}/`,
  hosts: {
    [HOST]: { type: 'player', module: 'l2-login/app.js' }
  },
  docs: DOCS + API_DOCS,
  grade(history) {
    const loginGet = history.find((e) => onPath(HOST, '/login')(e) && e.request.method === 'GET');
    const loginPost = history.find((e) => onPath(HOST, '/login')(e) && e.request.method === 'POST');
    const profileNoCookie = history.find((e) => onPath(HOST, '/profile')(e) && Object.keys(e.request.cookies).length === 0);
    const profileWithCookie = history.find((e) => onPath(HOST, '/profile')(e) && Object.keys(e.request.cookies).length > 0);
    const logout = history.find(onPath(HOST, '/logout'));
    return [
      check('form', 'GET /login shows the login form', !!loginGet, !!loginGet && loginGet.response.status === 200),
      check('login', 'POST /login (alice/welcome123) sets a session cookie', !!loginPost,
        !!loginPost && setCookies(loginPost).some((c) => /^sid=/.test(c.trim()) && !/max-age=0/i.test(c)),
        'res.setCookie("sid", httsim.random(), { httpOnly: true }) then res.redirect("/profile")'),
      check('guard', 'GET /profile without a session redirects to /login', !!profileNoCookie,
        !!profileNoCookie && String(profileNoCookie.response.status)[0] === '3' && String(profileNoCookie.response.headers.location || '').includes('/login'),
        'if req.cookies.sid is missing or unknown → res.redirect("/login")'),
      check('session', 'GET /profile with a valid session greets alice', !!profileWithCookie,
        !!profileWithCookie && profileWithCookie.response.status === 200 && /alice/i.test(profileWithCookie.response.body),
        'look up httsim.store("sessions").get(req.cookies.sid)'),
      check('logout', '/logout expires the session cookie', !!logout,
        !!logout && setCookies(logout).some((c) => /^sid=/.test(c.trim()) && /max-age=0/i.test(c)),
        'res.setCookie("sid", "", { maxAge: 0 }) — the jar deletes the cookie')
    ];
  }
};