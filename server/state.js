const state = {
  runId: null,
  levelId: null,
  browserCookies: new Map(),
  stores: new Map(),
  history: []
};

function freshRun(levelId) {
  state.runId = Math.random().toString(36).slice(2) + Date.now().toString(36);
  state.levelId = levelId;
  state.browserCookies = new Map();
  state.stores = new Map();
  state.history = [];
  return state.runId;
}

function store(ns) {
  if (!state.stores.has(ns)) state.stores.set(ns, new Map());
  return state.stores.get(ns);
}

module.exports = { state, freshRun, store };