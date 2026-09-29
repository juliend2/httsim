const { onPath, form, check, API_DOCS } = require('./util');

const HOST = 'site.test';

const DOCS = `
<h2>Level 1 — HTTP basics: links, forms, redirects</h2>
<p>You control the server behind <code>http://${HOST}</code>. Edit
<code>player/l1-basics/app.js</code> in vim, save, and just interact again here —
player code is reloaded on every request, no server restart needed.</p>
<ol>
  <li>The <b>home page</b> is already served — look at it, click around.</li>
  <li><b>Redirect:</b> <code>GET /redirect-me</code> must answer with a real HTTP
  redirect — status <code>302</code> and header <code>Location: /target</code>.
  Watch the console: the redirect hop appears as its own step and the fake
  browser waits for you before following it.</li>
  <li><b>Target page:</b> <code>/target</code> returns a small HTML page.</li>
  <li><b>Query parameters:</b> <code>/search</code> echoes the <code>q</code>
  query parameter into the page (use the search form on the home page).</li>
  <li><b>State across requests:</b> <code>/guestbook</code> — GET renders a form
  plus the stored entries; POST stores a new entry. Post <i>two</i> entries to
  prove the state survives across requests.</li>
</ol>
<p>Tip: in the console below, click an entry to expand full headers
(cookies included) and bodies.</p>
`;

module.exports = {
  id: 'l1-basics',
  title: 'L1 · HTTP basics',
  entry: `http://${HOST}/`,
  hosts: {
    [HOST]: { type: 'player', module: 'l1-basics/app.js' }
  },
  docs: DOCS + API_DOCS,
  grade(history) {
    const home = history.find(onPath(HOST, '/'));
    const navigated = history.filter((e) => e.via === 'frontend' && e.request.path !== '/');
    const redir = history.find(onPath(HOST, '/redirect-me'));
    const target = history.find(onPath(HOST, '/target'));
    const search = history.find((e) => onPath(HOST, '/search')(e) && e.request.query.q);
    const posts = history.filter((e) => onPath(HOST, '/guestbook')(e) && e.request.method === 'POST');
    const msgs = posts.map((e) => String(form(e).message || '').trim()).filter(Boolean);
    const persisted = msgs.length >= 2 && history.some(
      (e) => e.ts >= posts[1].ts && msgs.every((m) => e.response.body.includes(m))
    );
    return [
      check('home', 'GET / serves the home page', !!home, !!home && home.response.status === 200),
      check('nav', 'a link away from / was followed', navigated.length > 0, navigated.some((e) => e.response.status === 200)),
      check('redirect', 'GET /redirect-me answers 302 + Location: /target',
        !!redir,
        !!redir && String(redir.response.status)[0] === '3' && String(redir.response.headers.location || '').includes('/target'),
        'use res.redirect("/target") — a real 302 with a Location header'),
      check('target', 'GET /target renders a page', !!target, !!target && target.response.status === 200),
      check('search', 'GET /search?q=… echoes q back into the page', !!search,
        !!search && search.response.status === 200 && search.response.body.includes(String(search.request.query.q)),
        'req.query.q holds the value — escape it before putting it into HTML'),
      check('guestbook', 'guestbook keeps entries across requests', posts.length >= 1, persisted,
        'keep entries in httsim.store() (a Map) and render all of them on every request')
    ];
  }
};