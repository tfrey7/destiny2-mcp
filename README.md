# destiny2-mcp

Talk to Claude about your Destiny 2 characters in plain English — inspect gear,
craft builds from your real inventory, and equip loadouts. It's an MCP server
that wraps the Bungie.net API.

## Quick start

```bash
# 1. Clone and install
git clone <repo-url> destiny2-mcp && cd destiny2-mcp
npm install

# 2. Add your Bungie API credentials
cp .env.example .env        # then fill in the three values (see "Bungie app" below)

# 3. Log in once (opens your browser; tokens saved to ~/.destiny2-mcp/)
npm run auth

# 4. Register the server with Claude Code (use the absolute path to src/index.ts)
claude mcp add destiny2 -- npx tsx "$(pwd)/src/index.ts"
```

That's it. Open Claude Code and ask it something (see below). Requires Node 22+.

## Try it

Once it's connected, talk to Claude naturally. A few things it can actually do:

- **"Give me the latest Strand Hunter build."** Claude pulls curated Strand
  synergies, finds matching gear you already own, checks the one-exotic limit
  against what's equipped, and shows the loadout as a card — picking an
  off-element energy weapon since Strand can't match that slot.
- **"What's the god roll on my Fatebringer, and do I have it?"** Reads the
  item's _actual_ rolled perks, stats, and element from your inventory — not a
  wiki guess.
- **"Build me a max-resilience Void Titan loadout and equip it."** Designs from
  your real gear, then equips it (transferring pieces across characters if
  needed).
- **"Where do I farm a Chill Inhibitor?"** Returns the in-game source (activity
  or vendor), rarity, and whether your account already owns it.
- **"Snapshot what I'm wearing as 'GM Sweat'."** Saves your current equip as a
  named in-game loadout.

Claude grounds every answer in live data — your characters, your rolls, your
vault — so it won't recommend gear you don't have.

## Bungie app

Register an app at <https://www.bungie.net/en/Application>:

- **OAuth Client Type:** Confidential
- **Redirect URL:** `https://127.0.0.1:7777/callback` (must match exactly)
- **Scopes:** Read your Destiny inventory/vault + Move or equip Destiny gear

Copy the **API Key**, **OAuth client_id**, and **OAuth client_secret** into your
`.env` (see `.env.example`).

## Good to know

- **Re-auth ~every 90 days.** Just run `npm run auth` again.
- **Self-signed cert warning during auth is expected** — proceed past it. To
  silence it, install [mkcert](https://github.com/FiloSottile/mkcert) and run
  `mkcert -install` once; `auth` will then issue a browser-trusted cert.
- **Picking up code changes:** edit `src/`, then reconnect with `/mcp` in Claude
  Code. The server runs TypeScript directly via `tsx` — no build step.
- **Secrets:** `.env` and `oauth.txt` are gitignored. Never commit them. Tokens
  and the cached Bungie manifest live in `~/.destiny2-mcp/`.

## Smoke test (optional)

```bash
npx @modelcontextprotocol/inspector npx tsx src/index.ts
```

Then call `list_characters` and `list_loadouts`.

## Tools

**Read:** `list_characters`, `list_loadouts`, `get_equipped`, `list_inventory`,
`search_items`, `inspect_item`, `how_to_acquire`
**Build-crafting:** `get_build_knowledge`, `find_builds`, `import_build`
**Visual cards:** `show_equipped`, `show_loadout`
**Write:** `equip_loadout`, `equip_item`, `equip_items`, `transfer_item`,
`snapshot_loadout`, `update_loadout_identifiers`

`inspect_item` reads one item's real rolled perks, mods, stats, and element with
current in-game descriptions (works on a subclass too). `get_build_knowledge`
returns curated synergy reasoning. Together they let Claude craft builds
grounded in the live game and your actual gear.
