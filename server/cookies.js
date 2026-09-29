const { state } = require('./state');

function jarFor(host) {
  if (!state.browserCookies.has(host)) state.browserCookies.set(host, new Map());
  return state.browserCookies.get(host);
}

function headerFor(host) {
  const jar = jarFor(host);
  return [...jar.entries()].map(([name, c]) => `${name}=${c.value}`).join('; ');
}

function parseHeader(header) {
  const out = {};
  if (!header) return out;
  for (const part of String(header).split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  return out;
}

function isExpired(attrs) {
  if (attrs['max-age'] !== undefined && Number(attrs['max-age']) <= 0) return true;
  if (attrs.expires) {
    const t = Date.parse(attrs.expires);
    if (!Number.isNaN(t) && t <= Date.now()) return true;
  }
  return false;
}

function capture(host, setCookies) {
  if (!setCookies || !setCookies.length) return;
  const jar = jarFor(host);
  for (const raw of setCookies) {
    const semi = raw.indexOf(';');
    const nv = semi < 0 ? raw : raw.slice(0, semi);
    const i = nv.indexOf('=');
    if (i < 0) continue;
    const name = nv.slice(0, i).trim();
    const value = nv.slice(i + 1).trim();
    const attrs = {};
    for (const part of (semi < 0 ? '' : raw.slice(semi + 1)).split(';')) {
      const j = part.indexOf('=');
      if (j < 0) attrs[part.trim().toLowerCase()] = '';
      else attrs[part.slice(0, j).trim().toLowerCase()] = part.slice(j + 1).trim();
    }
    if (isExpired(attrs)) jar.delete(name);
    else jar.set(name, { value, attrs });
  }
}

module.exports = { jarFor, headerFor, parseHeader, capture };