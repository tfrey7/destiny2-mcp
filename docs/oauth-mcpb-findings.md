# OAuth packaging for an MCPB bundle — findings

Goal: decide how Bungie OAuth credentials should be distributed when destiny2-mcp ships as a
drag-and-drop `.mcpb` bundle (a plain zip, no sandbox, so **no confidential secret can ship inside
it**). Started as research; the decision is made and the Option 3 **application-code** changes are now
implemented (see checklist at the bottom — packaging items 7–10 remain).

## DECISION (2026-06-12)

**Chosen: Option 3 — bake the confidential client (`API_KEY` + `CLIENT_ID` + `CLIENT_SECRET`) into
the bundle, no BYO override.** Keeps refresh tokens (90-day re-login) and zero install friction.
Accepted tradeoffs: the app secret is publicly readable, one shared app identity for all installs
(fleet-wide revocation risk + shared rate-limit bucket). These are the known DIM-model costs; per-user
account access is NOT exposed (consent + per-user token still gate that). Implementation checklist at
the bottom of this doc.

## TL;DR / recommendation

The hypothesis behind **Option 1 — "switch to a Public OAuth client, the DIM model"** rests on a
factual error: **DIM is _not_ a public client.** DIM registers as a _confidential_ client and
deliberately ships its `client_secret` in its public web bundle. The reason it does that instead of
going public is the blocker below:

> **Bungie public clients receive NO refresh token.** Access tokens live 1 hour. With no refresh
> token, the server would force a full browser re-login every hour — a serious UX regression for a
> long-running MCP server, and Bungie has **declined to add PKCE** (the standard fix) — issue #961
> "Closed as not planned."

So the real choice is three-way, not two-way:

| Option                                                            | Ships a secret?                                                | Refresh token? | Re-login cadence | Install friction |
| ----------------------------------------------------------------- | -------------------------------------------------------------- | -------------- | ---------------- | ---------------- |
| **1. Public client**                                              | No                                                             | **No**         | **Every ~1 hr**  | None             |
| **2. User registers own app**                                     | No (each user's own, in OS keychain)                           | Yes            | Every ~90 days   | **High**         |
| **3. "DIM model": confidential client, secret baked into bundle** | Yes (but it's _our_ app secret, non-user, deliberately public) | Yes            | Every ~90 days   | None             |

**Recommendation: Option 3 (the actual DIM model), with Option 2 available as an optional
"use your own app" override.** Option 1's hourly re-auth makes it the worst experience despite being
the "cleanest" on paper. Option 3 is what every secretless Destiny client in the wild actually does,
keeps refresh tokens, and requires zero install friction. See the full reasoning at the end.

---

## (a) Confirmed answers, with citations

### Q1 — Does Bungie support a Public client type? Yes.

App registration at <https://www.bungie.net/en/Application> requires choosing **Public or
Confidential** (OAuth 2.0 §2.1). Practical difference in the token request:

- **Public:** "must provide [`client_id`]" and "**must not provide the `client_secret` parameter**."
- **Confidential:** issued a `client_secret`, which doubles as the client password (HTTP Basic).
- **Critical:** "A public client differs from a confidential client in that it is not issued a
  client_secret (or password) and **it will not receive a refresh token in response to a token
  request**."

Source: [Bungie-net/api OAuth Documentation wiki](https://github.com/Bungie-net/api/wiki/OAuth-Documentation).

### Q2 — PKCE? Not supported.

The official OAuth docs contain **no mention of PKCE / `code_challenge` / `code_verifier`.** The
feature request to add it ([issue #961](https://github.com/Bungie-net/api/issues/961), opened
2019-07-08, explicitly so native/public clients could get refresh tokens) is **"Closed as not
planned."** So Bungie's public flow is "Authorization Code, secret simply omitted, no PKCE" — there
is no secretless way to obtain a refresh token.

### Q3 — Redirect URI: is HTTPS required? Yes (in practice), and this is independent of client type.

- The registration portal **rejects `http://`** redirect URLs and **rejects the `localhost`
  hostname** — you must register an `https://127.0.0.1:<port>` loopback URL. This is exactly why the
  current code uses `https://127.0.0.1:7777/callback` + locally-generated TLS certs.
- Requests to relax this for loopback —
  [#311](https://github.com/Bungie-net/api/issues/311),
  [#1478](https://github.com/Bungie-net/api/issues/1478) — were **closed (stale, not implemented).**
- In the token request `redirect_uri` is **optional**; if present it must be a case-sensitive exact
  match of the registered URL. (Our `postToken` doesn't send it today, which is fine.)

**Conclusion on `certs.ts`: it CANNOT be deleted.** http loopback is refused at registration, so the
HTTPS callback server and cert generation are required **regardless of which option we pick.** This
refutes the "if http loopback is allowed we could delete certs.ts" hypothesis.

Sources: OAuth wiki above; redirect-URL issues
[#311](https://github.com/Bungie-net/api/issues/311),
[#1478](https://github.com/Bungie-net/api/issues/1478); token lifetimes
(`expires_in: 3600`, `refresh_expires_in: 7776000` ≈ 90 days) per the wiki and community samples.

### The DIM reality check (the load-bearing finding)

DIM's `src/app/bungie-api/oauth.ts` builds its token body with **`client_secret: oauthClientSecret()`**
and has a **`getAccessTokenFromRefreshToken` (`grant_type: 'refresh_token'`)** path — i.e. DIM is a
**confidential client embedding its secret** in a public SPA, specifically to keep refresh tokens.
"Ship a public client like DIM" is a contradiction; DIM ships a confidential client with a public
secret. Source:
[DIM oauth.ts](https://github.com/DestinyItemManager/DIM/blob/master/src/app/bungie-api/oauth.ts).

---

## (b) Per-option code-change map

Touched files today: `src/setup/config.ts` (`credentials()`, `REDIRECT_URI`), `src/bungie/auth.ts`
(`postToken` Basic-auth header, `getAccessToken` refresh path), `src/setup/certs.ts`,
`src/setup/auth-cli.ts`, `src/index.ts` (no first-run trigger exists today — auth is a separate
`npm run auth` CLI). `node .../auth-cli.ts` is the only entry that performs OAuth; the server itself
just reads `tokens.json` and throws "Run `npm run auth`" if absent.

### Common to ALL options (the MCPB "no terminal" problem)

`npm run auth` cannot exist inside an MCPB bundle — there's no terminal. First-run login must be
triggered **from inside the running server**. Recommended shape (same for every option):

- Add a **`login` MCP tool** that runs the `auth-cli.ts` flow in-process: spin up the HTTPS callback
  server, open the browser, exchange the code, write `tokens.json`, return "Authenticated ✨".
- In `client.ts`, when `getAccessToken()` throws "Not authenticated" (or, for Option 1, whenever the
  access token is expired), return an MCP error whose message tells the user to **run the `login`
  tool** rather than referencing `npm run auth`.
- Refactor `auth-cli.ts`'s `main()` into an exported `runLogin()` so both the `login` tool and the
  existing CLI can call it. `certs.ts`, `REDIRECT_URI`, `CALLBACK_PORT` stay as-is.

### Option 1 — Public client

- `config.ts`: delete `clientSecret` from `credentials()`; drop the `BUNGIE_CLIENT_SECRET` env var.
  Bake `BUNGIE_API_KEY` + `BUNGIE_CLIENT_ID` into the bundle (both non-secret).
- `auth.ts` `postToken`: **remove the HTTP Basic header**; send `client_id` in the form body
  instead (`grant_type`, `code`, `client_id`). Per spec, public clients must not send the secret.
- `auth.ts` `getAccessToken`: **delete the refresh path entirely** — there is no `refresh_token` in a
  public-client response. `StoredTokens` loses `refreshToken`/`refreshExpiresAt`. When the access
  token is within the expiry margin, the only recovery is **re-running `login`** (full browser
  round-trip). Every authenticated tool must be prepared to surface "session expired, run `login`."
- `certs.ts` / redirect URI: **unchanged** (HTTPS still required).
- Bungie portal: flip the app's Client Type to Public (one-time, manual).
- **Cost: hourly browser re-login.** This is the dealbreaker.

### Option 2 — User registers their own Bungie app

- No code change to `postToken` (still confidential Basic auth) or the refresh path — keeps refresh
  tokens.
- `config.ts`: source the three values from MCPB `user_config` (injected as env vars by Claude
  Desktop) instead of `.env`/dotenv. Mark all three `sensitive: true` in `manifest.json` →
  OS keychain. `credentials()` reads them the same way via `process.env`.
- Add MCPB `manifest.json` with three `user_config` string fields + the `login` tool wiring above.
- `certs.ts` unchanged.
- **Cost: every user must create a Bungie app, set the redirect URL to `https://127.0.0.1:7777/callback`,
  copy three values at install.** High friction; also each user hits their own rate-limit bucket
  (a minor upside).

### Option 3 — Confidential client, secret baked in (the actual DIM model) — _recommended_

- `config.ts` / `auth.ts`: **essentially unchanged.** Keep `clientSecret`, keep the Basic header,
  keep the refresh path. The only change is _where_ the three values come from: bake all three into
  the bundle (e.g. a committed `config` module) instead of reading `.env` at runtime.
- `certs.ts` unchanged.
- Add the `login` MCP tool + `manifest.json` (no `user_config` needed).
- **Cost: the app `client_secret` is readable by anyone who unzips the bundle.** This is an _app_
  credential, not a per-user one; the blast radius is "someone can impersonate our app id / spend
  our rate-limit bucket," not "someone can touch a user's account." Per-user tokens remain in
  `~/.destiny2-mcp/tokens.json` (0600) and never ship. This is precisely the tradeoff DIM, and most
  open-source Destiny tools, already accept.

---

## (c) Recommendation

**Ship Option 3 as the default; offer Option 2 as an optional override.**

- Option 1 is rejected: no refresh token + no PKCE ⇒ hourly full re-auth. The "zero secrets" purity
  isn't worth a login prompt every hour for a background MCP server.
- Option 3 matches what every secretless Destiny client actually does, preserves the 90-day refresh
  UX, and needs no install ceremony. The leaked value is a low-sensitivity _app_ secret, and Bungie's
  own design (no public-client refresh, PKCE declined) effectively pushes everyone here.
- Keep Option 2 wiring as an **optional** path for users who'd rather use their own registered app
  (privacy/rate-limit reasons): if the three `user_config` fields are filled, prefer them; otherwise
  fall back to the baked-in app credentials. Low extra cost since `credentials()` just reads env.

## (d) Blockers & caveats discovered

1. **No refresh token for public clients** + **PKCE declined (#961)** — together these kill Option 1
   for a long-lived server. Single most important finding.
2. **DIM is confidential-with-public-secret, not public** — the brief's "Option 1 = the DIM model"
   premise is incorrect; the DIM model _is_ Option 3.
3. **`certs.ts` cannot be deleted under any option** — Bungie rejects http and `localhost` redirect
   URLs at registration; HTTPS loopback + local certs stay mandatory. Note the bundled experience
   still shows a browser cert warning unless `mkcert` is installed, which won't be present in a
   no-terminal MCPB install — worth a follow-up (a friendlier callback page, or accept the warning).
4. **No first-run auth entry exists in-server today** — every option needs a new `login` MCP tool
   (refactor `auth-cli.ts:main` → exported `runLogin()`); `npm run auth` is unavailable in a bundle.
5. **Token-exchange request still works without sending `redirect_uri`** (it's optional and our
   single registered URL matches), so that part needs no change.

## Implementation checklist (Option 3, bake-in only)

### Application code (this repo)

1. **`config.ts` — credential source.** Keep `clientSecret` in `credentials()`. Replace the
   `.env`/dotenv-only load with **baked-in default constants for all three values, with env vars as an
   override** (env wins, so local dev / a BYO user can still point at their own app via env without us
   shipping a `user_config` UI). Net: `credentials()` returns `process.env.X ?? BAKED_IN_X`. Be
   deliberate that this commits the secret into git/history — that's the accepted decision.
2. **`auth.ts` — no change.** `postToken` keeps the HTTP Basic header; the `refresh_token` path stays.
   This is the whole point of staying confidential.
3. **`auth-cli.ts` → `runLogin()`.** Refactor `main()` into an exported `runLogin()` so the flow can be
   invoked in-process (not just from the `npm run auth` CLI). CLI keeps calling it.
4. **New `login` MCP tool.** Register a tool (e.g. `src/tools/auth.ts`) that calls `runLogin()`:
   spins up the HTTPS loopback callback, opens the browser, exchanges the code, writes `tokens.json`,
   returns "Authenticated ✨". This is the no-terminal first-run entry for the bundle.
5. **`client.ts` / `auth.ts` error copy.** Change the "Not authenticated / Session expired. Run
   `npm run auth`" messages to point at the **`login` tool** instead of the CLI command.
6. **`certs.ts` — no change.** HTTPS loopback + self-signed/mkcert stays (Bungie rejects http loopback).

### Packaging (later, via the `build-mcpb` skill — separate from the above)

7. **Compile TS→JS.** Ship `dist/` (run `tsc`), point `manifest.json` `entry_point` at `dist/index.js`;
   stop relying on `tsx` at runtime.
8. **`manifest.json`.** `server.type: "node"`, bundle `node_modules`. No `user_config` needed (bake-in).
9. **`better-sqlite3` native module — DONE on main.** The manifest reader was ported to the built-in
   **`node:sqlite`** (commit `f8cf5e2`), which deletes the native-module problem entirely. `.nvmrc` now
   pins the Node version that ships `node:sqlite`; ensure the bundled Node matches.
10. **Cert-warning UX.** Default self-signed path will warn in-browser on the redirect. Mitigate with a
    friendly callback page that pre-explains it (or take on the Plex-style real-cert-on-a-domain infra
    only if the warning proves unacceptable).

### Sources

- Bungie OAuth Documentation wiki — <https://github.com/Bungie-net/api/wiki/OAuth-Documentation>
- PKCE request, closed not planned — <https://github.com/Bungie-net/api/issues/961>
- HTTP/loopback redirect requests, closed — <https://github.com/Bungie-net/api/issues/311>, <https://github.com/Bungie-net/api/issues/1478>
- DIM OAuth implementation (confidential + refresh) — <https://github.com/DestinyItemManager/DIM/blob/master/src/app/bungie-api/oauth.ts>
- DIM ↔ Bungie auth notes — <https://github.com/DestinyItemManager/DIM/wiki/Authorizing-Destiny-Item-Manager-with-Bungie.net>
