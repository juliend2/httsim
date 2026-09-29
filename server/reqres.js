const cookies = require('./cookies');

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function buildRequest({ method, url, headers = {}, body = '', via }) {
  const u = new URL(url);
  const lower = {};
  for (const [k, v] of Object.entries(headers)) lower[String(k).toLowerCase()] = String(v);
  if (via === 'frontend') {
    const jar = cookies.headerFor(u.host);
    if (jar) lower.cookie = lower.cookie ? `${lower.cookie}; ${jar}` : jar;
  }
  const contentType = (lower['content-type'] || '').split(';')[0].trim();
  const form = contentType === 'application/x-www-form-urlencoded' && body
    ? Object.fromEntries(new URLSearchParams(body))
    : null;
  return {
    method: method.toUpperCase(),
    url: u.toString(),
    host: u.host,
    path: u.pathname,
    query: Object.fromEntries(u.searchParams),
    headers: lower,
    body,
    form,
    cookies: cookies.parseHeader(lower.cookie),
    via
  };
}

class Response {
  constructor() {
    this._status = 200;
    this.headers = {};
    this.cookies = [];
    this.body = '';
  }
  setHeader(name, value) {
    this.headers[String(name).toLowerCase()] = value;
    return this;
  }
  getHeader(name) {
    return this.headers[String(name).toLowerCase()];
  }
  setCookie(name, value, opts = {}) {
    let c = `${name}=${value}; Path=/`;
    if (opts.maxAge !== undefined) c += `; Max-Age=${opts.maxAge}`;
    if (opts.httpOnly) c += '; HttpOnly';
    if (opts.secure) c += '; Secure';
    if (opts.sameSite) c += `; SameSite=${opts.sameSite}`;
    this.cookies.push(c);
    return this;
  }
  status(code) {
    this._status = code;
    return this;
  }
  send(body, type) {
    this.body = body;
    if (type && !this.getHeader('content-type')) this.setHeader('content-type', type);
    return this;
  }
  html(body) {
    return this.send(body, 'text/html; charset=utf-8');
  }
  text(body) {
    return this.send(body, 'text/plain; charset=utf-8');
  }
  json(obj) {
    return this.send(JSON.stringify(obj, null, 2), 'application/json');
  }
  redirect(location, code = 302) {
    this.status(code);
    this.setHeader('location', location);
    const safe = escapeHtml(location);
    this.html(`<!doctype html><html><body>Redirecting to <a href="${safe}">${safe}</a>…</body></html>`);
    return this;
  }
}

module.exports = { buildRequest, Response, escapeHtml };