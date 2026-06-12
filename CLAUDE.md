# CLAUDE.md

Guidance for working on **destiny2-mcp** — an MCP server exposing the Destiny 2 (Bungie.net) API. The
README covers setup and auth; this file covers how the code is laid out, the domain rules the tools must
respect, and how to reason when helping a player.

## Architecture

- `src/index.ts` — server entry; registers all tools.
- `src/tools/read.ts` / `write.ts` — the MCP tools. Read tools project manifest + profile data; write
  tools equip/transfer gear.
- `src/tools/builds/` — `find_builds` / `import_build` logic and synergy recipes.
- `src/tools/ornaments/` — `find_ornaments`: aesthetic search ("cowboy", "robot") over universal armor
  ornaments. The manifest has no visual signal (every ornament's text is identical boilerplate), so
  `data/ornaments.json` is a vision-captioned index keyed by item hash — regenerate it with
  `scripts/ornaments/build_index.ts`. Every ornament is captioned natively for its own class; a `set`
  stem present in more than one class is flagged `crossClass`, and class-exclusive otherwise.
- `src/tools/shaders/` — `find_shaders`: color-scheme search ("rusted copper", "dark red and gold").
  Shaders have no screenshot — only a swatch icon — and no applied-to-armor preview exists anywhere, so
  `data/shaders.json` is a vision-captioned palette index (colors/warmth/brightness/finish) keyed by
  hash; regenerate with `scripts/shaders/build_index.ts`. Account-wide, so no per-class resolution.
- `src/bungie/` — the API client, OAuth, the SQLite manifest reader (`manifest.ts`), and profile/account
  fetches. `manifest.ts` is the source of truth for an item's `slot`, `element`, `tier`, `ammoType`.
- `src/knowledge/` — `get_build_knowledge`. Curated, qualitative build knowledge as code
  (`data.ts` = the sections; `index.ts` = the tool). This is where Destiny _facts and mechanics_ live.
- `src/format/loadout/` — renders loadout cards to PNG (`logic`/`model`/`data`/`png` split by role).

## Domain rules (the source of truth is `get_build_knowledge`)

Destiny game mechanics belong in `src/knowledge/data.ts`, served by `get_build_knowledge`, so every
client gets them — not buried in a doc. The load-bearing ones, which recommendations must respect:

- **Slot is set by damage type, and the top slot's name is not an element.** The "Kinetic" slot holds
  Kinetic, Stasis, and Strand weapons; a Strand weapon there still deals Strand damage. Energy slot holds
  Solar/Arc/Void. Always take element from the `element` field, never from the slot name.
- **One exotic weapon + one exotic armor, max** — independent limits. Before recommending a weapon, check
  whether an exotic weapon is already equipped in any slot; if so, the pick must be Legendary.

See the `loadout` topic for the full statement. When changing these rules, edit the knowledge section —
that is canonical — not just this file.

**Invariant:** the attribute fields the tools emit (`slot`, `element`, `tier`, `ammoType`, `classType`)
must stay consistent with the `loadout` knowledge section. `get_equipped`, `list_inventory`,
`search_items`, and `inspect_item` all surface `element` and `tier` precisely so element-matching and the
exotic limit can be checked without guesswork. `search_items` also surfaces `classType` on results (and
filters by `class`) so armor — exotic armor especially — can be narrowed to a single-class account the way
element narrows weapons; class is to armor what element is to weapons. Don't add a tool that returns gear
without them.

## Helping a player

- Ground every claim in the live tools. Read mechanics from `get_build_knowledge`, then verify the
  player's actual gear and rolls with `inspect_item` / `list_inventory` — do not answer gear questions
  from memory.
- Lead a build or loadout answer with the visual card (`show_equipped` / `show_loadout`); don't restate
  it in prose.
- Recommending an energy weapon for a Strand/Stasis build means an off-element utility pick — those
  subclasses can't element-match the energy slot.

## Working on the code

- Read tools project a deliberately narrow shape over the manifest (name + a few attributes), not the raw
  Bungie payload. Keep that projection tight; the full vault is large.
- **Exported members come first.** Within a file, put everything `export`ed (functions, types, consts,
  classes) at the top, above all private/internal declarations — the public surface should read first.
  This is a convention, not lint-enforced: function declarations hoist and types are erased, so the order
  is free; the one exception is an exported `const` whose initializer reads a private `const` at module-load
  time (e.g. `BUILDS_FILE` depends on `packageRoot` in `setup/config.ts`) — that private dependency stays
  inline above its consumer to avoid a temporal-dead-zone crash at startup.
- The server runs via `tsx` with no build step for day-to-day use. After editing `src/`, reconnect with
  `/mcp`.
- Before committing: `npm run typecheck`, `npm run lint`, `npm run format`. Never skip hooks.
