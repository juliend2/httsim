const fs = require('fs');
const path = require('path');

const bridgeSource = fs.readFileSync(path.resolve(__dirname, '..', 'web', 'bridge.js'), 'utf8');

function escapeAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

function document(url, html) {
  const parts = `<base href="${escapeAttr(url)}"><script>${bridgeSource}</script>`;
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head[^>]*>/i, (m) => m + parts);
  }
  if (/<html[^>]*>/i.test(html)) {
    return html.replace(/<html[^>]*>/i, (m) => `${m}<head>${parts}</head>`);
  }
  return `<head>${parts}</head>` + html;
}

module.exports = { document };