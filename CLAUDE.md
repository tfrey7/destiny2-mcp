# CLAUDE.md

Guidance for **maintaining** destiny2-mcp — an MCP server exposing the Destiny 2 (Bungie.net) API. The
README covers setup and auth; this file covers how the code is laid out and the conventions to follow when
changing it. How to _use_ the server — game mechanics and player-facing behavior — is server-owned, not
documented here; see "Where domain rules and usage guidance live" below.

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
  `apply_ornament` equips a result on a character's worn armor (slot → equipped piece → ornament socket →
  unlock check → insert), and `apply_ornament_set` applies several at once, skipping any not owned/equippable
  with a reason; the shared socket-resolution lives in `src/bungie/sockets.ts`.
- `src/tools/shaders/` — `find_shaders`: color-scheme search ("rusted copper", "dark red and gold").
  Shaders have no screenshot — only a swatch icon — and no applied-to-armor preview exists anywhere, so
  `data/shaders.json` is a vision-captioned palette index (colors/warmth/brightness/finish) keyed by
  hash; regenerate with `scripts/shaders/build_index.ts`. Account-wide, so no per-class resolution.
- `src/tools/godrolls/` — `god_roll`: the community god roll(s) for a weapon (recommended perks per
  column + trash perks), compiled from the DIM community wishlist (voltron.txt). `data/god-rolls.json`
  is keyed by weapon item hash and stores perks as bare hashes (names resolve from the manifest at read
  time, so a renamed perk never goes stale); regenerate with `scripts/godrolls/build_index.ts`
  (`npm run build:godrolls`). The wishlist enumerates the full cartesian product of acceptable perks, so
  the build script transposes each block back into per-column option sets and filters to current
  weapons. `logic.ts` also powers two enrichments: `inspect_item` on an owned weapon instance attaches a
  `godRoll` verdict (matched rolls / closest miss), and `inspect_sockets` flags each candidate plug that
  appears in a recommended roll. The qualitative "what makes a roll good" reasoning lives in the
  `god-rolls` knowledge topic, not here.
- `src/bungie/` — the API client, OAuth, the SQLite manifest reader (`manifest.ts`), and profile/account
  fetches. `manifest.ts` is the source of truth for an item's `slot`, `element`, `tier`, `ammoType`.
  It also holds the **reverse-lookup indexes** behind `search_items`' `perk` and `setBonus` filters —
  the inverses of the manifest's forward data (item→its-perks, set→its-bonuses). `perk:<name|hash>`
  lists the gear that can roll/insert a perk; `setBonus:<name>` lists the armor whose set grants a
  bonus. These are built **live in-memory** (`buildPerkIndex` / `buildSetBonusIndex`), lazily on first
  use and cached for the process lifetime, then dropped on a manifest swap via `onManifestSwap` —
  exactly like the `catalog` / `nameIndex` caches in the same file. They are **not** committed JSON
  artifacts (unlike `data/ornaments.json` / `data/shaders.json`): the perk/set data is 100% derivable
  from the local manifest, so a baked-in file would only go stale against newer manifest versions,
  whereas the in-memory index always matches the manifest actually loaded. The ornament/shader indexes
  are committed only because they carry vision-caption data that does **not** exist in the manifest.
  The perk index is scoped to the perk-bearing socket categories (`WEAPON PERKS`, `INTRINSIC TRAITS`,
  `ARMOR PERKS` — origin traits ride in `WEAPON PERKS`); armor-mod, masterwork/energy, shader, and
  ornament sockets are excluded because every armor piece accepts the same huge mod plug sets, which
  would balloon the inversion ~60× into mostly noise. No regeneration command exists or is needed —
  the index rebuilds itself whenever the manifest changes.
- `src/knowledge/` — `get_build_knowledge`. Curated, qualitative build knowledge as code
  (`data.ts` = the sections; `index.ts` = the tool). This is where Destiny _facts and mechanics_ live.
- `src/format/loadout/` — renders the loadout card. `model.ts` reduces a loadout to sections/rows
  (the shared shape); `text.ts` is the model-visible box card; `html.ts` is the MCP-UI template that
  renders the DIM-style two-column card client-side from `structuredContent` (subclass + aspects/
  fragments on top, weapons left, armor right, perk/mod icons with tooltips, element pips, light.gg
  links); `images.ts` fetches item icons as model-visible image blocks. The socketed plugs the card
  shows come from `src/bungie/plugs.ts` (`displayPlugs`), which reads each instance's inserted plugs
  from the ItemSockets component.
- `src/tools/show_build.ts` — `show_build`: renders an arbitrary _target_ build as a loadout card from a
  list of item hashes (+ optional target plug hashes), with each piece marked owned (✓) vs. needed (⚒).
  The renderer is ownership-agnostic, so the items need not be owned or equipped — this is the tool the
  model uses to _show_ a recommendation. Un-owned target perks resolve via `plugViewsFromHashes` in
  `plugs.ts` (the no-instance counterpart to `displayPlugs`); ownership comes from `ownedItemsByHash`.

## Where domain rules and usage guidance live (NOT this file)

This file is for **maintaining the codebase**. How to _use_ the server — Destiny game mechanics, and how a
client should help a player (lead with a card, deliver a recommendation as a complete target card, ground
answers in the tools, never web-search the manifest) — does **not** belong here. It must reach every
client, including ones that never read a repo `CLAUDE.md` or a client's memory (Claude Desktop). So it
lives in two server-owned places:

- **Game mechanics** → `src/knowledge/data.ts`, served by `get_build_knowledge` (topics: `loadout`,
  `recommending`, `equipping`, one per subclass, …). This is canonical for facts and procedure. When a
  rule changes, edit the knowledge section, not a doc.
- **Always-on behavior** → the `instructions` string in `src/index.ts`, surfaced to every client at
  connect (the MCP `instructions` field). This is the nudge that makes a client actually reach for the
  right tool — lead with `show_build`, fill every slot, read `get_build_knowledge` first. Keep it a short
  pointer into the knowledge topics, not a second copy of them.

Reinforcing tool descriptions (e.g. `show_build`'s) carry the same "lead with a complete card" rule so it
shows up at the call site too. If you find yourself writing player-facing usage guidance here, put it in
one of those instead.

**Code invariant (this is a maintenance concern, so it stays here):** the attribute fields the tools emit
(`slot`, `element`, `tier`, `ammoType`, `classType`) must stay consistent with the `loadout` knowledge
section. `get_equipped`, `list_inventory`, `search_items`, and `inspect_item` all surface `element` and
`tier` precisely so element-matching and the exotic limit can be checked without guesswork; `search_items`
also surfaces `classType` (and filters by `class`) so armor can be narrowed to a single-class account the
way element narrows weapons. Don't add a tool that returns gear without them.

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
- **Debug artifacts per strand.** `npm run pack:mcpb` builds a release bundle versioned from
  `package.json`. `npm run pack:mcpb:debug` (only on a `strand/<name>` branch) builds a throwaway bundle
  versioned `<next-patch>-<strand>.<build>` (e.g. `1.1.4-images.20260613150753` — valid semver that sorts
  above the installed release so Desktop never treats it as a downgrade) with display name
  "Destiny 2 (<strand> · b<HHMMSS>)", output `release/destiny2-mcp-<strand>.mcpb`. The trailing `<build>`
  is a UTC timestamp that **must increase every rebuild**: Desktop keys "is this an upgrade?" on the
  version, so a constant version makes it silently skip the reinstall and keep running the old code — the
  `b<HHMMSS>` display tag lets the user confirm which build actually loaded. The bundle `name` is
  unchanged, so installing over the release build replaces it (Desktop keys replacement on name).
  **You (Claude) run this, not the user.** When a strand's changes are working and the user wants to try
  them in Claude Desktop, run `npm run pack:mcpb:debug` yourself and hand them the artifact path to
  double-click — don't wait to be asked for the command. Rebuild it after each round of changes the user
  wants to re-test.
- Before committing: `npm run typecheck`, `npm run lint`, `npm run format`. Never skip hooks.
