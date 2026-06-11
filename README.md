# destiny2-mcp

An MCP server for the Destiny 2 (Bungie.net) API. Lets you ask Claude to view
and change your loadouts, gear, and inventory in natural language.

## Tools

**Read:** `list_characters`, `list_loadouts`, `get_equipped`, `list_inventory`
**Write:** `equip_loadout`, `snapshot_loadout`, `update_loadout_identifiers`,
`equip_item`, `equip_items`, `transfer_item`

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
