// ─── Level 1 · HTTP basics ────────────────────────────────────────────────
// Edit this file in vim, save, and interact in the game again — your code is
// reloaded on every request, no server restart needed.
//
// You always receive:
//   req    { method, url, path, query, headers, body, form, cookies }
//   res    .html() .text() .json() .status(code) .redirect(loc) .setHeader() .setCookie()
//   httsim { fetch(), store(ns), log(text), random() }
// (full reference: mission panel in the game)

module.exports = async function handle(req, res, httsim) {
  const entries = httsim.store();

  if (req.path === '/') {
    return res.html(`<!doctype html>
<html>
<head><meta charset="utf-8"><title>site.test</title>
<style>
body{font-family:system-ui,sans-serif;margin:40px auto;max-width:560px;line-height:1.5}
a{color:#2a5bd7}
input,button{padding:6px}
</style></head>
<body>
<h1>site.test</h1>
<p>A tiny site you will bring to life over the next tasks.</p>
<ul>
  <li><a href="/redirect-me">a page that redirects</a></li>
  <li><a href="/search?q=hello+world">a prepared search link</a></li>
  <li><a href="/guestbook">the guestbook</a></li>
</ul>
<h2>Search</h2>
<form method="GET" action="/search">
  <input name="q" placeholder="search for something">
  <button>Search</button>
</form>
</body></html>`);
  }

  if (req.path === '/redirect-me') {
    // TASK 2 — answer with a real redirect: status 302 + `Location: /target`.
    // (res.redirect does exactly that — check the mission panel.)
    return res.html('<h1>TODO: this should be a 302 redirect to /target</h1>');
  }

  if (req.path === '/target') {
    // TASK 3 — a plain HTML page. Anything you like.
    return res.status(404).html('<h1>TODO: build me</h1>');
  }

  if (req.path === '/search') {
    // TASK 4 — echo req.query.q back into the page.
    return res.status(404).html('<h1>TODO: echo the q parameter</h1>');
  }

  if (req.path === '/guestbook') {
    // TASK 5 — GET: render a form + every entry stored so far.
    //          POST: store req.form.message and show the list again.
    //          `entries` (above) is a Map that survives between requests.
    return res.status(404).html('<h1>TODO: guestbook</h1>');
  }

  return res.status(404).html('<h1>404 — nothing here</h1>');
};