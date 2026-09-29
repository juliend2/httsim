const http = require('http');
const fs = require('fs');
const path = require('path');
const { state, freshRun } = require('./state');
const engine = require('./engine');
const levels = require('./levels');

const WEB = path.resolve(__dirname, '..', 'web');
const PORT = Number(process.env.PORT) || 8787;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png'
};

function json(res, obj, status = 200) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(obj, null, 2));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => {
      data += c;
      if (data.length > 1e6) req.destroy();
    });
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); }
      catch (e) { reject(new Error('invalid JSON body')); }
    });
    req.on('error', reject);
  });
}

function serveStatic(res, pathname) {
  const rel = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const file = path.resolve(WEB, rel);
  if (!file.startsWith(WEB + path.sep)) return false;
  let content;
  try { content = fs.readFileSync(file); }
  catch (e) { return false; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
  res.end(content);
  return true;
}

freshRun(levels.list()[0].id);

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://localhost');
  const p = u.pathname;
  try {
    if (p === '/__levels') return json(res, { levels: levels.list(), current: state.levelId });
    if (p === '/__run') return json(res, { runId: state.runId, levelId: state.levelId });
    if (p === '/__docs') {
      const l = levels.get(u.searchParams.get('level') || state.levelId);
      return json(res, { html: l ? l.docs : '' });
    }
    if (p === '/__reset') {
      const body = await readJson(req);
      const id = levels.get(body.levelId) ? body.levelId : state.levelId;
      freshRun(id);
      const l = levels.get(id);
      return json(res, { runId: state.runId, levelId: id, entry: l.entry, docs: l.docs, checks: l.grade([]) });
    }
    if (p === '/__step') {
      const body = await readJson(req);
      const out = await engine.runStep(body);
      if (out.step) {
        res.setHeader('x-httsim-status', String(out.step.response.status));
        if (out.redirect) res.setHeader('x-httsim-location', out.redirect);
      }
      return json(res, out);
    }
    if (serveStatic(res, p)) return;
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('not found');
  } catch (err) {
    json(res, { error: String((err && err.stack) || err) }, 500);
  }
});

server.listen(PORT, () => {
  console.log(`HTTSim running → http://localhost:${PORT}`);
});