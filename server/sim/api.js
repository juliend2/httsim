module.exports = function makeApi() {
  return async function handle(req, res, httsim) {
    if (req.path === '/profile' && req.method === 'GET') {
      const m = /^Bearer\s+(.+)$/i.exec(req.headers.authorization || '');
      const rec = m && httsim.store('tokens').get(m[1].trim());
      if (!rec) {
        res.setHeader('www-authenticate', 'Bearer error="invalid_token"');
        return res.status(401).json({ error: 'invalid_token', error_description: 'missing or invalid bearer token' });
      }
      if (!String(rec.scope).split(' ').includes('profile')) {
        return res.status(403).json({ error: 'insufficient_scope' });
      }
      return res.json({ sub: rec.user, name: 'Alice Doe', email: 'alice@example.com' });
    }
    return res.status(404).json({ error: 'not_found' });
  };
};