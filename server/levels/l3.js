const { check, API_DOCS } = require('./util');

const CLIENT = 'client.app';
const AUTH = 'auth.example';
const API = 'api.example';

const CLIENT_CFG = { id: 'webapp-1', secret: 'hunter2', redirectUri: `http://${CLIENT}/cb` };
const USER = { username: 'alice', password: 'welcome123' };

const DOCS = `
<h2>Level 3 — OAuth 2.0 Authorization Code flow</h2>
<p>Three parties. You implement the client; the game simulates the rest:</p>
<pre>
  you implement                 simulated                 simulated
  http://client.app     ⇄     http://auth.example      http://api.example
  player/l3-oauth/            (ExampleId IdP)          (protected API)
  client.js                   alice / welcome123
</pre>
<p>Implement the Authorization Code flow (RFC 6749 §4.1) in the client:</p>
<ol>
  <li><code>GET /login</code> → <code>302</code> to <code>${AUTH}/authorize</code>
  with <code>response_type=code</code>, <code>client_id=webapp-1</code>,
  <code>redirect_uri=http://client.app/cb</code>, <code>scope=profile</code> and
  a random <code>state</code>.</li>
  <li>Log in on the IdP page (alice / welcome123) and approve the consent screen —
  the IdP redirects to your <code>/cb</code> with <code>code</code> and
  <code>state</code>.</li>
  <li>In <code>/cb</code>: first verify <code>state</code> matches what you sent
  (CSRF protection). Then make a <b>backchannel</b>
  <code>POST ${AUTH}/token</code> with <code>grant_type=authorization_code</code>,
  the <code>code</code>, <code>redirect_uri</code>, <code>client_id</code> and
  <code>client_secret</code> — via <code>httsim.fetch()</code>. Backchannel hops
  show up as <span style="color:#bb9af7">backend</span> steps in the console.</li>
  <li>Call <code>GET ${API}/profile</code> with
  <code>Authorization: Bearer &lt;access_token&gt;</code>.</li>
  <li>Render the profile page with name and email.</li>
</ol>
<p>References:
<a href="https://datatracker.ietf.org/doc/html/rfc6749#section-4.1">RFC 6749 §4.1</a> ·
<a href="https://datatracker.ietf.org/doc/html/rfc6750">RFC 6750 (Bearer tokens)</a></p>
`;

module.exports = {
  id: 'l3-oauth',
  title: 'L3 · OAuth 2.0 auth-code flow',
  entry: `http://${CLIENT}/`,
  hosts: {
    [CLIENT]: { type: 'player', module: 'l3-oauth/client.js' },
    [AUTH]: {
      type: 'sim',
      make: () => require('../sim/idp')({
        user: USER,
        client: CLIENT_CFG,
        scopes: ['profile']
      })
    },
    [API]: {
      type: 'sim',
      make: () => require('../sim/api')()
    }
  },
  docs: DOCS + API_DOCS,
  grade(history) {
    const authReq = history.find((e) => e.via === 'frontend' && e.request.host === AUTH && e.request.path === '/authorize');
    const cb = history.find((e) => e.request.host === CLIENT && e.request.path === '/cb');
    const tokenReq = history.find((e) => e.via === 'backend' && e.request.host === AUTH && e.request.path === '/token');
    const apiCall = history.find((e) => e.via === 'backend' && e.request.host === API && e.request.path === '/profile');
    const lastClientPage = [...history].reverse().find((e) =>
      e.via === 'frontend' && e.request.host === CLIENT &&
      /text\/html/i.test(e.response.headers['content-type'] || '') && e.response.status === 200);
    const q = authReq ? authReq.request.query : null;
    const f = tokenReq ? (tokenReq.request.form || {}) : null;
    return [
      check('authorize', 'authorize request has response_type=code, client_id, redirect_uri, scope', !!authReq,
        !!q && q.response_type === 'code' && q.client_id === CLIENT_CFG.id && q.redirect_uri === CLIENT_CFG.redirectUri && !!q.scope,
        `redirect to ${AUTH}/authorize?response_type=code&client_id=…&redirect_uri=…&scope=profile`),
      check('state', 'authorize request carries a random state value', !!authReq,
        !!q && !!q.state && q.state.length >= 8,
        'state defends the callback against CSRF — mint it with httsim.random() and remember it'),
      check('callback', 'the IdP called back /cb with code + state', !!cb,
        !!cb && !!cb.request.query.code && !!cb.request.query.state),
      check('exchange', 'backchannel POST /token with grant_type, code, redirect_uri, client_id, client_secret', !!tokenReq,
        !!f && f.grant_type === 'authorization_code' && !!f.code && f.redirect_uri === CLIENT_CFG.redirectUri && f.client_id === CLIENT_CFG.id && f.client_secret === CLIENT_CFG.secret,
        `const resp = await httsim.fetch("${AUTH}/token", { method: "POST", body: params })`),
      check('bearer', 'backchannel GET /profile uses Authorization: Bearer', !!apiCall,
        !!apiCall && /^Bearer\s+\S+/i.test(apiCall.request.headers.authorization || ''),
        'headers: { Authorization: "Bearer " + accessToken }'),
      check('profile', 'the client renders Alice’s profile from the API', !!cb && !!lastClientPage,
        !!cb && !!lastClientPage && lastClientPage.response.body.includes('alice@example.com'))
    ];
  }
};