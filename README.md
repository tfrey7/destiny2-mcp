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
npm run build
npm run auth      # one-time browser login; saves tokens to ~/.destiny2-mcp/
```

During `npm run auth`, your browser warns about a self-signed certificate on the
`127.0.0.1` callback page — that is expected; proceed past it. You only need to
re-run `auth` about every 90 days.

## Register with Claude Code

```bash
claude mcp add destiny2 \
  -e BUNGIE_API_KEY=... \
  -e BUNGIE_CLIENT_ID=... \
  -e BUNGIE_CLIENT_SECRET=... \
  -- node /Users/timothyfrey/Development/destiny2-mcp/dist/index.js
```

## Smoke test

```bash
npx @modelcontextprotocol/inspector node dist/index.js
```

Then call `list_characters` and `list_loadouts`.

## Notes

- `.env` and `oauth.txt` hold secrets and are gitignored. Never commit them.
- Tokens and the cached Bungie manifest live in `~/.destiny2-mcp/`.
