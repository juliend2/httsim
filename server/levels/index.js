const l1 = require('./l1');
const l2 = require('./l2');
const l3 = require('./l3');

const levels = {
  'l1-basics': l1,
  'l2-login': l2,
  'l3-oauth': l3
};

function list() {
  return Object.values(levels).map(({ id, title }) => ({ id, title }));
}

function get(id) {
  return id && levels[id] ? levels[id] : null;
}

module.exports = { list, get };