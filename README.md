# HTTSim

Learn HTTP-based protocols (OAuth 2.0, OIDC, …) by **implementing them** — inside a fake browser that lets you step through every request, hop by hop.

## Quick start

```
npm start              # or: node server/index.js
open http://localhost:8787
```

No dependencies. Node ≥ 16. Everything runs in one local process.

## How it plays

- **Top bar** — level switcher, fake address bar (you can type URLs into it), mission brief button.
- **Middle** — the fake browser's page. Links and forms are intercepted: every request first appears as a **paused step** below; press `⏎` (or *send*) to let it through. Read-only for now — inspect, then send.
- **Redirects never auto-follow.** The engine converts real `3xx`/`Location` into `200` + `X-httsim-status` / `X-httsim-location` for the stepper, and the redirect hop becomes the next paused step.
- **Console (bottom)** — every hop, prefixed `[frontend]` (fake browser) or `[backend]` (server-to-server traffic, e.g. the OAuth token exchange). Click entries to expand full headers (cookies included) and bodies. Also mirrored to devtools console.
- **Mission panel** — the level brief, tasks, references, and auto-graded checks that update as you play.

**Editing code:** the files under `player/` are yours — edit them in vim. Player code is reloaded on **every request** (require-cache busting): save, click, see the change. No server restart, no page refresh needed. UI edits (`web/`) just need a refresh.

## Layout

```
server/          engine: stepper, fake-host router, cookie jar, virtual network
  sim/           simulated parties (ExampleId IdP, protected API)
  levels/        level definitions: brief, hosts, grading
player/          ← the code YOU write while playing
web/             the fake browser UI (vanilla JS, no framework, no build step)
```

Fake hosts (`site.test`, `client.app`, `auth.example`, `api.example`) are labels the engine resolves on one port; the browser cookie jar is scoped per fake host. Server-to-server calls made via `httsim.fetch()` bypass the browser jar, like real backchannel traffic.

## Levels

1. **L1 · HTTP basics** — links, forms, redirects, query params, state across requests
2. **L2 · Sessions & cookies** — login/logout, session cookies, redirects
3. **L3 · OAuth 2.0 auth-code flow** — implement the client (authorize redirect, `state`, code exchange via backchannel, Bearer call, profile render) against the simulated IdP + API

Roadmap: L4 implement the IdP yourself · L5 `state`/CSRF attack scenarios · L6 PKCE · L7 OIDC (`id_token`, `nonce`, userinfo) · L8 resource-server token validation.

## Notes

- State is in memory: restarting the server resets the run (the UI detects it and resets too). Refreshing the page keeps your place.
- Player handlers run with a 5s timeout; crashes show up as an error page in the fake browser and in the console.
- The engine never lets real network traffic out: "hosts" are just handler modules, called in-process.

