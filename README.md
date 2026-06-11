# destiny2-mcp

An MCP server for the Destiny 2 (Bungie.net) API. Lets you ask Claude to view
and change your loadouts, gear, and inventory in natural language.

## Tools

**Read:** `list_characters`, `list_loadouts`, `get_equipped`, `list_inventory`,
`inspect_item`, `how_to_acquire`
**Write:** `equip_loadout`, `snapshot_loadout`, `update_loadout_identifiers`,
`equip_item`, `equip_items`, `transfer_item`
**Build-crafting:** `get_build_knowledge`

`inspect_item` reads one item's actual rolled perks, mods, stats, and element
with current in-game descriptions (works on a subclass too, surfacing its
aspects and fragments). `get_build_knowledge` returns curated synergy reasoning
for designing builds. Together they let Claude craft builds grounded in the live
game and your real gear.

`how_to_acquire` takes item names and returns each one's in-game source
(activity/vendor), rarity, type, and whether your account already owns it. The
underlying lookup lives in `src/bungie/acquisition.ts` (`acquisitionFor` /
`acquisitionForMany`) so other features — e.g. a loadout generator — can annotate
each gear piece with where to find it without going through the tool.

## Prerequisites

Register an app at <https://www.bungie.net/en/Application>:

- **OAuth Client Type:** Confidential
- **Redirect URL:** `https://127.0.0.1:7777/callback` (must match exactly)
- **Scopes:** Read your Destiny inventory/vault + Move or equip Destiny gear
- Copy the **API Key**, **OAuth client_id**, and **OAuth client_secret** into a
  `.env` file (see `.env.example`).

## Setup

```bash
npm install
npm run auth      # one-time browser login; saves tokens to ~/.destiny2-mcp/
```

The server runs TypeScript directly via `tsx`, so there is no build step for
day-to-day use. (`npm run build` and `npm run typecheck` still exist for
compiling/sanity-checking types.)

During `npm run auth`, your browser warns about a self-signed certificate on the
`127.0.0.1` callback page — that is expected; proceed past it. You only need to
re-run `auth` about every 90 days.

To remove that warning, install [mkcert](https://github.com/FiloSottile/mkcert)
and trust its local CA once:

```bash
brew install mkcert
mkcert -install      # one-time; adds a local CA to your system/browser trust store
```

With `mkcert` on your `PATH`, `npm run auth` issues a browser-trusted certificate
for `127.0.0.1` (cached in `~/.destiny2-mcp/certs/`) and the warning goes away.
Without it, the flow still works using the self-signed fallback.

## Register with Claude Code

```bash
claude mcp add destiny2 -- npx tsx /Users/timothyfrey/Development/destiny2-mcp/src/index.ts
```

Credentials are read from this project's `.env` automatically (by absolute path,
regardless of where Claude Code launches the server), so no `-e` flags are
needed.

To pick up code changes: edit `src/`, then reconnect the server with `/mcp` in
Claude Code (or relaunch the tab). No rebuild needed.

## Smoke test

```bash
npx @modelcontextprotocol/inspector npx tsx src/index.ts
```

Then call `list_characters` and `list_loadouts`.

## Notes

- `.env` and `oauth.txt` hold secrets and are gitignored. Never commit them.
- Tokens and the cached Bungie manifest live in `~/.destiny2-mcp/`.
