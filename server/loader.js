const path = require('path');

const PLAYER_DIR = path.resolve(__dirname, '..', 'player');

function loadPlayer(rel) {
  const file = path.resolve(PLAYER_DIR, rel);
  delete require.cache[file];
  return require(file);
}

module.exports = { loadPlayer };