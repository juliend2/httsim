const API_DOCS = `
<details open>
<summary><b>req / res / httsim — API reference</b></summary>
<pre>
req                        the incoming request (real HTTP semantics)
  .method                  "GET" | "POST" | ...
  .url                     full URL, e.g. "http://site.test/search?q=hi"
  .path                    "/search"
  .query                   parsed query params -> { q: "hi" }
  .headers                 lowercase headers -> { cookie: "sid=..." }
  .body                    raw body string (POST)
  .form                    body parsed as urlencoded -> { message: "hi" }
  .cookies                 the cookies the fake browser sent

res                        build the HTTP response
  .html(body)              200 + text/html
  .text(body)              200 + text/plain
  .json(obj)               200 + application/json
  .status(code)            chainable -> res.status(404).html("nope")
  .redirect(loc, code=302) a REAL redirect: 302 + Location header
  .setHeader(name, value)
  .setCookie(name, value, { maxAge, httpOnly, sameSite })

httsim                     engine helpers
  .fetch(url, opts)        server-to-server request ("backchannel").
                           sends NO browser cookies.
                           opts: { method, headers, body }
                           -> { status, headers, text(), json() }
  .store(ns = "player")    a Map that survives between requests
  .log(text)               write a line into the game console
  .random()                32 hex chars of randomness
</pre>
</details>`;

function onPath(host, path) {
  return (e) => e.request.host === host && e.request.path === path;
}

function form(e) {
  return e.request.form || {};
}

function check(id, label, attempted, pass, hint) {
  return { id, label, attempted: !!attempted, pass: !!pass, hint: hint || '' };
}

module.exports = { API_DOCS, onPath, form, check };