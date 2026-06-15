interface KnowledgeSection {
  id: string;
  title: string;
  body: string;
}

// Qualitative build-crafting knowledge, frozen at Destiny 2's end-of-life. This captures
// synergy reasoning that no Bungie manifest table encodes — which engines loop and why.
// Exact numbers, current perk text, and the player's actual gear are deferred to the live
// tools (inspect_item, list_inventory), which read the manifest and account directly.
export const buildKnowledge: KnowledgeSection[] = [
  {
    id: "method",
    title: "How to craft a build",
    body: `A build is a closed feedback loop: an ability or weapon applies a verb, the verb's
payoff returns ability energy or survivability, and that fuels the next application. Strong builds
make this loop nearly self-sustaining.

Procedure:
1. Pick the engine — one verb or damage pattern the build revolves around (e.g. Solar Ignition,
   Void Devour, Arc Jolt, Stasis Shatter, Strand Suspend).
2. Choose the subclass, and the aspects + fragments that generate and amplify that verb.
3. Pick the exotic armor that multiplies the engine (refunds ability energy, extends a buff,
   adds an extra cast). The exotic is usually what turns a fair loop into an oppressive one.
4. Pick weapons whose perks either feed the verb (apply it on hit) or exploit it (bonus damage
   into debuffed/affected targets). Match the weapon's element to the subclass for surge mods.
5. Close the loop with mods — and retune BOTH the weapon and the armor mods to the loadout; never
   inherit whatever was slotted before. Armor mods drive the Armor Charge economy, ability regen, and
   orb generation; weapon mods and the masterwork tune handling, reload, and ammo. When a loadout's
   elements or weapons change, the old mods usually no longer fit — an ammo-generation, scavenger, or
   surge mod for an element you no longer carry is dead weight (e.g. Void ammo mods with no Void weapon
   equipped). Audit every mod slot and match it to the engine, elements, and abilities actually running.

Always ground the build in reality: list_inventory to see what the player owns, and inspect_item
on candidate weapons/armor and on the equipped subclass to read the actual rolled perks, aspects,
and fragments with their current in-game descriptions. Do not assume a roll — verify it.`,
  },
  {
    id: "recommending",
    title: "How to deliver a recommendation",
    body: `When a player asks what to run, what to farm, or how to improve or equip a build, the answer is a
concrete end-state — not a questionnaire and not a wall of prose. There are two modes; tell them apart
by the request, because they constrain the build differently:

- RECOMMEND (aspirational) — "what should I run", "what should I farm", "how do I improve X". The card
  may include pieces the player does not own yet, marked ⚒ still-to-farm; ownership spans held gear and
  Collections. The deliverable ends at the card. This is a plan to work toward.
- EQUIP (actionable) — "build me X and equip it", "set me up", "give me a build to run now". Every piece
  must be OWNED and equippable right now — no ⚒ on the card, because the next step is applying it. If the
  ideal piece isn't owned, substitute the best owned alternative and say so; never put an unowned piece
  in an equip-mode build. The card is the spec the equip phase then applies.

PLAN and EQUIP are two separate operations that compose. PLAN (this topic) decides the spec; EQUIP (the
equipping topic — transfers, equip_items, insert_plug for subclass plugs and mods) applies a spec. They
chain either way:
- Back-to-back, one request ("whip up a build and run it"): PLAN then immediately EQUIP. The spec lives
  in the conversation; nothing else is needed.
- Split across time ("plan me something" now, "equip it" later — possibly a new session in orbit): PLAN
  produces the spec; a later EQUIP applies it. EQUIP must be runnable from an existing spec WITHOUT
  re-planning, so a planned build has to be recoverable (re-stated, saved, or still in context).
Never interleave guessing the build with equipping it — finish the full spec, then apply.

Deliver the spec in this shape:

1. A target loadout card via show_build. This is the centerpiece: the finished build as the player
   will run it once it's done — subclass with its aspects/fragments, all three weapons, all five armor
   pieces, each with the target perks/mods you're recommending. show_build marks every piece owned
   (✓) vs. still-to-farm (⚒). The card is the answer — do not re-describe its contents in prose underneath it.
2. A short "why" — a few bullets on what the changes buy (the loop they complete, the verb uptime or
   survivability or DPS they add). Tie each change to the engine, not to vibes.
3. (Recommend mode only) Where to get the needed pieces — for each ⚒ piece, the source, via how_to_acquire.

A build is complete or it is not delivered. Every weapon names its perks per column; every armor piece
names its mods; the subclass names super, grenade, melee, class ability, movement, BOTH aspects, and ALL
fragments; plus a stat priority. A card with empty sockets — or "the exotic + the subclass element" alone
— is not a build. Fill every socket before showing it. "Farm a set whose bonus supports your engine" is
not a recommendation either — name the set and the bonus.

Pin the engine first; do not reverse-engineer it from current gear. A build collapses out of ONE seed —
the subclass + exotic + engine (e.g. "Voidwalker, Contraverse Hold, Vortex/Devour"). Get that seed from
the player's request, or pick one from their stated goal and say which in one line. Do NOT read
get_equipped to guess the goal for a from-scratch build: the new loadout overwrites the old, so current
gear is irrelevant to the design and the exotic limit is satisfied by the build you design, not by what's
on now. Read current gear only when the request is "improve what I'm already running" (you need the
starting point) or to reuse already-equipped pieces and save equip operations. With the seed pinned, one
get_build_knowledge(<subclass>) call supplies the aspects, fragments, weapon traits, and mod priorities;
fill exact weapon perks with god_roll; confirm the named pieces are owned with targeted search_items
queries — not broad inventory dumps. Ask a clarifying question only when you genuinely cannot pin a seed
(the request fits several incompatible engines and nothing breaks the tie) — at most one, and never as a
substitute for doing the work.

Sourcing the parts: search_items to find candidate gear by element/type/class and to read ownership;
god_roll for a weapon's recommended perks per column; inspect_sockets to get the plug hashes for the
perks/mods you're naming; get_build_knowledge / import_build for the subclass aspect/fragment hashes;
how_to_acquire for where a ⚒ piece drops. Respect the loadout rules (element/slot, the one-exotic-weapon
+ one-exotic-armor limits — both a ceiling AND a floor: a finished build fills both exotic slots).`,
  },
  {
    id: "loadout",
    title: "Loadout mechanics: slots, elements, and exotic limits",
    body: `The rules that govern what can go where. A weapon recommendation that violates these is invalid,
so check them before suggesting a swap.

Equip slots — a character runs three weapons, five armor pieces, and a subclass:
- Weapons: Kinetic slot (top), Energy slot (middle), Power slot (bottom, the heavy slot).
- Armor: helmet, gauntlets, chest, legs, class item.

Slot is set by the weapon's DAMAGE TYPE, not its archetype — and the top slot's NAME is not an element:
- Kinetic slot holds Kinetic, Stasis, and Strand weapons. "Kinetic" here is the slot label, a
  historical name. A Strand or Stasis weapon sitting in it still deals Strand/Stasis damage — never
  read the slot "Kinetic" as the element Kinetic. Take element from the item's element field, not its slot.
- Energy slot holds Solar, Arc, and Void weapons.
- Power slot holds any element.
Consequence: a Strand or Stasis build cannot element-match its energy weapon — the energy slot is
always off-element (Solar/Arc/Void). Pick it as a utility tool, not for surge. Top and power slots can match.

Exotic limit — at most ONE exotic weapon AND ONE exotic armor piece equipped at once. The two limits
are independent: an exotic armor piece does not block an exotic weapon. Before recommending a weapon for
a slot, check whether an exotic weapon is already equipped in ANY weapon slot; if one is, the pick must
be Legendary unless the player is willing to drop the existing exotic.
The limit is also a FLOOR, not just a ceiling: a finished loadout should always fill both — one exotic
weapon AND one exotic armor piece. Those two slots are free power with no opportunity cost against each
other, so leaving either empty is a strict waste. Never present a completed loadout with an exotic slot
empty; if a build has exotic armor but a Legendary in every weapon slot, recommend an exotic weapon to
fill it (matching the subclass element where possible), and likewise add exotic armor if only the weapon
slot is used.

Ammo types — Primary (infinite), Special (scarce), Heavy. Power-slot weapons are Heavy; Kinetic and
Energy weapons are Primary or Special. Running Special in both Kinetic and Energy makes them compete for
the same scarce ammo, which is a real cost to weigh when planning a loadout.

Two scales both called "tier" — do not conflate them:
- RARITY (Common, Uncommon, Rare, Legendary, Exotic) — how the exotic limit and most build talk read
  "tier". This is what get_equipped / list_inventory / inspect_item report as \`tier\`.
- GEAR TIER (1-5) — the Edge of Fate quality scale on armor. Higher tier = a larger stat budget. It is
  per-instance (two copies of the same armor can differ) and reported as \`gearTier\`, only on owned
  gear. Read as the current masterwork level: it equals the drop tier once a piece is fully upgraded,
  and a lower number on an un-upgraded piece means upgrade headroom, not a worse drop. Legacy
  (pre-tier) armor has no gearTier. When comparing two same-slot armor pieces, prefer the higher gear
  tier for its bigger stat budget — but never over the exotic/set/stat-spread needs of the build.

Armor set bonuses — most modern armor belongs to a SET, and equipping multiple pieces of the same set
unlocks set perks (typically a 2-piece and a 4-piece bonus). get_equipped reports each character's
set-bonus progress: which perks are active now and how many more pieces the next one needs. inspect_item
and list_inventory report a piece's \`set\`. Guidance: completing a 2- or 4-piece bonus is often worth
more than a marginal stat or gear-tier gain, so when a player is one piece away from a strong set perk,
say so. Set bonuses are armor-only; weapons have no set. Legacy armor belongs to no set.`,
  },
  {
    id: "equipping",
    title: "How to equip a loadout efficiently",
    body: `Putting a loadout on a character is one batched operation, not a pile of single equips and
manual transfers. Done right it is one tool call; the thrash people hit comes from going piece-by-piece.

Use the cheapest tier that applies, in order:
1. A matching saved in-game loadout → equip_loadout(characterId, loadoutIndex). Check list_loadouts
   first. This hands the whole swap to Bungie, which resolves transfers, equip order, and bucket space
   server-side — the most reliable path by far. Prefer it whenever the player already has the loadout
   saved in-game.
2. Otherwise → ONE equip_items call with the COMPLETE final set (all three weapons + five armor in a
   single itemIds array). Do not equip slot by slot, and do not pre-transfer with transfer_item first:
   equip_items pulls every piece from the vault or another character automatically, and Bungie validates
   the RESULTING equipment state as a whole, so a clean loadout (one exotic weapon + one exotic armor)
   swaps atomically even when it means trading one exotic for another in a different slot. equip_items
   also equips exotics last as insurance, and reports any piece Bungie declined to equip — read that
   result, don't assume success.
3. Single equip_item, one piece at a time, is the LAST resort (e.g. changing just one slot). Each single
   equip is validated against the CURRENT state, so equipping a second exotic of the same category while
   the first is still on is rejected. When you must go one at a time across an exotic swap, equip the new
   exotic LAST — after a non-exotic has taken the outgoing exotic's slot — so only one exotic is ever
   equipped at a time.

Space rarely needs pre-clearing for an equip: equipping DISPLACES the worn piece into inventory rather
than filling a new inventory slot, so the only overflow risk is the brief pull onto the character.
equip_items handles the common case by bumping a duplicate of the same item to the vault; if a bucket is
genuinely full of distinct items it stops and names what to move. Only then reach for transfer_item (one
piece to the vault) or vault_inventory (clear all unequipped gear), then retry the equip. Don't vault
things up front "to be safe" — it just adds operations.

Equipping is a LIVE action: it only succeeds while the player is signed into Destiny 2 (Bungie returns
error 1623 / DestinyCannotPerformActionAtThisLocation otherwise). Transfers between character and vault
work offline, but the equip at the end does not — if equips fail with 1623, the player needs to be in
the game, it is not a tool bug. The one-exotic rule itself lives in the loadout section; this topic is
only about carrying it out without stepping on the tools.`,
  },
  {
    id: "armor",
    title: "Armor: the Edge of Fate stat system",
    body: `What an armor piece actually contributes, once you look past its appearance. The model is
not "any piece can roll any stats" — three things define a piece, and the player's eye (the look) is
not one of them.

The six stats and what each governs (read the live values with inspect_item; these are what they do):
- Weapons — weapon reload speed and handling, plus weapon damage against minor and major combatants.
- Health — health gained per Orb of Power picked up, and reduced flinch while aiming. This is the
  survivability stat; it is NOT the old Resilience (there is no flat damage-resist stat anymore).
- Class — class-ability cooldown and energy gain.
- Grenade — grenade cooldown and energy gain.
- Super — Super energy gain.
- Melee — melee cooldown and energy gain.

Stats are not freely chosen — they come from a piece's ARCHETYPE and its GEAR-TIER budget, not from the
set it belongs to. Each piece has a dominant stat (its archetype) and a total stat budget set by its gear
tier (1-5, see the loadout section); tuning mods and the masterwork bonus only nudge stats within that
budget. So two same-slot pieces are not stat-interchangeable: to chase a stat (e.g. Grenade for an
ability-spam build) you pick the archetype whose dominant stat is the one you want, at the highest gear
tier you can get — the set name is irrelevant to that.

A piece's mechanical identity is therefore: archetype (its stat spread) + gear tier (its stat budget) +
set bonus. Appearance is fully decoupled — universal ornaments (see cosmetics) let any legendary piece
wear any unlocked look — so never pick armor for how it (or its set) looks, and never infer a piece's
function from its model. The look travels independently of everything that matters.

Set bonuses are element-neutral UTILITY, not subclass synergy. No set bonus amplifies a subclass verb
(Devour, Jolt, Ignition, Suspend, Shatter); they grant survivability, ammo economy, or weapon-archetype
perks that work regardless of subclass. "Match the armor set to your Void/Solar/etc. subclass" is a
category error — a Solar-flavored set bonus does nothing extra on a Solar subclass, and a neutral one is
no worse on Void. Choose a set bonus for whether you will actually trigger it given how you play (e.g. a
damage-resist-on-Orb-pickup bonus on an Orb-heavy build), or split four legendary slots into two 2-piece
bonuses from different sets to stack two effects. Pick the bonus, not the theme.`,
  },
  {
    id: "cosmetics",
    title: "Cosmetics: shaders, ornaments, and emblems",
    body: `How a player changes how their gear looks, separate from what it does. Cosmetics never touch
stats, perks, element, or the exotic limit — only appearance. There are three kinds, and they are not
applied the same way.

Shaders — recolor a single weapon or armor piece. Every weapon and armor piece has one shader socket.
Shaders unlock account-wide in Collections; once unlocked a shader is reusable and never consumed, and
applying it costs nothing. Applying a shader is a free socket insert (insert_plug into that piece's
shader socket).

Ornaments — change a piece's model/silhouette, also a free socket insert into the piece's ornament
socket. Two flavours:
- Item-specific ornaments are tied to one exotic (or one legendary set): an exotic ornament only fits
  the exotic it was made for, and shows up only in that item's ornament socket. You must own/unlock it
  (earned in-game, or bought with Bright Dust / Silver).
- Universal (transmog) ornaments are armor-only and class-specific (Hunter / Titan / Warlock). They let
  any Legendary armor of that class take the look of another set you have unlocked as a universal
  ornament (via Synthesis / Synthweave). They fit the armor's universal-ornament socket; an exotic armor
  piece uses its own dedicated ornaments instead.

Emblems — the nameplate shown on your character and in other players' rosters. Unlike shaders and
ornaments, an emblem is an equipped ITEM in the Emblems slot, not a socket plug: change it with
equip_item (the emblem must be in that character's inventory first), NOT insert_plug.

Mechanics and constraints:
- Applying a shader or ornament: POST InsertSocketPlugFree (the insert_plug tool) with the piece's
  socketIndex and the cosmetic's plugItemHash. It is free, reversible, and instant.
- You can only insert a cosmetic the account has unlocked. Exotic ornaments fit only their exotic;
  universal ornaments fit only same-class Legendary armor.
- Workflow to theme a look: search_items (category shader / ornament / emblem, plus a name or theme)
  to find candidates and their hashes → inspect_sockets on each piece to find the socketIndex and
  confirm the plug is available → insert_plug per piece (or equip_item for the emblem).`,
  },
  {
    id: "triumphs",
    title: "Triumphs: location/activity tagging and what to chase next",
    body: `Triumphs (Records) track in-game accomplishments and feed seals (titles). Three tools cover them,
all reading live account state — never answer a Triumph question from memory:
- get_triumphs — the seal overview: total score plus every title with its live completion, closest-first.
- search_records — find specific Triumphs by name, completion state, seal, location, or activity.
- suggest_triumphs — the advisor: ranks the player's incomplete Triumphs by what's worth doing next.

Location and activity are NOT in the manifest's record data — a Triumph carries no destination or activity
hash. They come from an enriched offline index (data/triumphs.json, keyed by record hash, regenerated by
scripts/triumphs/build_index.ts), exactly like the cosmetic search indexes. Its signal is the manifest
itself: a record's place in the presentation-node tree ("The Moon", "Raids", "Crucible") and, for
raid/dungeon Triumphs, the activity catalog that ties a named activity to its world — both authoritative.
A one-time, vocabulary-constrained model pass fills residual gaps and adds qualitative fields (solo vs.
fireteam, rough effort, a one-line summary); it never overrides a manifest placement. So a Triumph's
location/activity is as trustworthy as its element/tier — surfaced precisely so "what can I do on the
Moon" is answerable without guessing.

The load-bearing caveat: most Triumphs are NOT location-scoped. Seasonal and Episode Triumphs are
time-scoped; Moments of Triumph, Guardian Ranks, and account-wide grinds (weapon catalysts, "defeat
targets with X anywhere") have no destination at all. A location filter narrows to the place-bound ones,
so a thin result for a place means few of its Triumphs are place-bound — not that there's nothing to do
there. When asked something like "Moments of Triumph on the Moon", say plainly that MoT goals aren't
location-scoped, then pivot to the actual Moon Triumphs feeding the player's nearest seal.

How to answer "what should I go after (on the Moon)": lead with suggest_triumphs (add location/activity
to scope it). It ranks by closeness (live %), time pressure (expiring), title progress (feeds an unearned
seal), and Triumph score, and returns a "why" for each — so the top of the list is the highest-leverage
work. Use get_triumphs to frame the nearest title and search_records to drill into a specific Triumph's
objectives.`,
  },
  {
    id: "verbs",
    title: "Keyword glossary (the verbs)",
    body: `Verbs are the buffs and debuffs that builds chain together. Grouped by element.

Arc — aggression and chaining:
- Jolt: target periodically chains lightning to nearby enemies when damaged. Great add-clear engine.
- Blind: enemies cannot see or shoot; disorients. Strong crowd control and Overload disruption.
- Amplified: gained after rapid kills — faster movement, reload, and weapon handling.
- Ionic Traces: tracking energy pickups that recharge abilities. The Arc ability-regen currency.
- Bolt Charge: stacks of stored lightning that discharge into nearby foes when full.

Solar — burning and healing:
- Scorch: stacking burn damage. Build it up to trigger Ignition.
- Ignition: a large area detonation when scorch stacks peak. The premier Solar burst.
- Radiant: weapons deal bonus damage and become anti-barrier.
- Restoration: heal-over-time that persists even through damage. The strongest survivability verb.
- Cure: an instant heal. Firesprites: pickups that grant grenade energy / can trigger Restoration.

Void — control and sustain:
- Volatile: affected enemies explode when further damaged; explosions spread volatile.
- Weaken: target takes increased damage from all sources. A damage debuff for bosses and adds.
- Suppress: cancels enemy abilities and stuns; denies elite/Overload actions.
- Invisibility: vanish from enemy sight; reposition, revive, or reset aggro.
- Overshield: a layer of absorbing health. Devour: kills heal you fully and refund grenade energy.

Stasis — freezing and shattering:
- Slow: stacking slow that impairs enemies; enough stacks Freezes them.
- Freeze: locks an enemy in place, unable to act.
- Shatter: breaking a frozen target (or a Stasis crystal) detonates for area damage.
- Frost Armor: stacking damage resistance gained from Stasis final blows / shards.

Strand — control and threadlings:
- Sever: reduces the damage enemies deal. A defensive debuff.
- Suspend: lifts enemies into the air, immobilized — the strongest single-target/area lockdown.
- Unravel: unraveling rounds tear targets apart and spawn Threadlings; pierces some defenses.
- Tangle: a throwable knot that damages and can be cut into Threadlings.
- Woven Mail: stacking damage resistance. Threadlings: small seeking minions that chase and kill.`,
  },
  {
    id: "arc",
    title: "Arc subclass",
    body: `Fantasy: speed and chain reactions. The loop is Jolt for add-clear and Amplified +
Ionic Traces for relentless ability uptime; Bolt Charge adds passive lightning pressure.

Engine: Jolt everything, stay Amplified, let Ionic Traces refund abilities. Blind for control.

Key aspects (verify exact effects via inspect_item on the equipped subclass): aspects that grant
Amplified on demand, make abilities Jolt, or spawn Ionic Traces / Bolt Charge on kills.

Signature exotics (examples — confirm the player owns them via list_inventory):
- Warlock: Crown of Tempests (ability energy on Arc kills), Fallen Sunstar (boosts Ionic Traces),
  Geomag Stabilizers (super economy).
- Titan: Heart of Inmost Light (neutral — empowers all abilities after using one).
- Hunter: Raiden Flux (Arrowdynamics super), Gemini Jester / mobility-and-Blind kits.

Weapons: Arc weapons with Voltshot (reload after a kill makes the next hit Jolt) are the ideal
feeder — they apply the engine's verb on demand. Match Arc element for surge.`,
  },
  {
    id: "solar",
    title: "Solar subclass",
    body: `Fantasy: fire that both kills and keeps you alive. Two engines: Ignition spam (offense)
and Restoration uptime (survivability) — the best Solar builds run both at once.

Engine A (offense): stack Scorch quickly to trigger Ignitions; Radiant for weapon damage.
Engine B (sustain): keep Restoration active so you out-heal incoming damage indefinitely.

Key aspects/fragments: those that apply scorch on abilities, convert scorch to Ignition more
easily, and grant Restoration/Radiant from kills, healing grenades, or firesprites.

Signature exotics (examples):
- Warlock: Sunbracers (grenade kills grant unlimited Solar grenades briefly — explosive add-clear),
  Dawn Chorus (boosts scorch/Ignition damage).
- Titan: Loreley Splendor (sunspot heals you when critical — near-unkillable), Phoenix Cradle.
- Hunter: Young Ahamkara's Spine (tripmine spam), Caliban / knife-Ignition kits.

Weapons: Incandescent (kills spread Scorch) is the perfect Solar feeder for the Ignition engine.
Radiant makes any weapon anti-barrier. Match Solar element for surge.`,
  },
  {
    id: "void",
    title: "Void subclass",
    body: `Fantasy: control the battlefield and never die. The Devour loop is one of the most
durable engines in the game: a kill heals you fully and refunds grenade energy, so you grenade,
kill, heal, repeat. Volatile provides chain add-clear; Weaken anchors boss damage; Invisibility
is the universal panic button.

Engine: open Devour, then sustain it with kills. Layer Volatile for AoE and Weaken for DPS.

Key aspects/fragments: those that grant Devour on kill/ability, make grenades or weapons apply
Volatile, and grant Invisibility/Overshield to allies.

Signature exotics (examples):
- Warlock: Contraverse Hold (grenade energy on cast + damage), Nezarec's Sin (ability energy on
  Void kills — pairs with Devour for infinite grenades).
- Hunter: Gyrfalcon's Hauberk (volatile rounds out of invisibility), Omnioculus (team invis/sustain).
- Titan: Doom Fang Pauldron (super economy), Heart of Inmost Light (neutral).

Weapons: Destabilizing Rounds (kills make nearby weapon hits apply Volatile) feeds the AoE engine.
A Weaken source plus a heavy weapon is the standard boss-DPS pairing. Match Void element for surge.`,
  },
  {
    id: "stasis",
    title: "Stasis subclass",
    body: `Fantasy: lock the room down and detonate it. The loop is Slow into Freeze into Shatter,
while Frost Armor stacks keep you tanky. Excellent for crowd control and for stopping dangerous
elites cold.

Engine: freeze clusters of enemies, then Shatter them (or shatter crystals) for area damage;
gather shards for Frost Armor.

Key aspects/fragments: those that spawn crystals, freeze on ability/shatter, and convert kills or
shards into Frost Armor and ability energy.

Signature exotics (examples):
- Warlock: Osmiomancy Gloves (two coldsnap grenades + faster regen — a freezing machine).
- Hunter: Renewal Grasps (defensive duskfield), Mask of Bakris (Arc/Stasis hybrid burst).
- Titan: Hoarfrost-Z (Stasis barricade becomes a crystal wall).

Weapons: Chill Clip (applies slow/stacks toward freeze) lets a weapon feed the freeze engine.
Headstone (kills spawn a Stasis crystal) feeds the Shatter engine. Match Stasis element for surge.`,
  },
  {
    id: "strand",
    title: "Strand subclass",
    body: `Fantasy: puppeteer the battlefield with threads. Suspend is the standout — it removes a
pack of enemies from the fight entirely. Threadlings provide passive add-clear; Woven Mail and
Sever cover survivability.

Engine: Suspend to neutralize threats, Unravel to spread Threadlings, generate Tangles for more.

Key aspects/fragments: those that Suspend on ability/Tangle, grant Woven Mail, and spawn or buff
Threadlings.

Signature exotics (examples):
- Warlock: Swarmers (destroying a Tangle spawns Threadlings — turns the kit into an army),
  Necrotic Grip (poison spread, iconic with the Thorn hand cannon).
- Hunter: Cyrtarachne's Facade (Woven Mail on grapple — aggressive and tanky), Star-Eater (super).
- Titan: Abeyant Leap (Drengr's Lash Suspend becomes a wide, multi-target lockdown).

Weapons: Hatchling (precision kills spawn a Threadling) and Unraveling Rounds feed the engine.
Match Strand element for surge.`,
  },
  {
    id: "prismatic",
    title: "Prismatic subclass",
    body: `Prismatic (The Final Shape) mixes Light and Darkness on one subclass: it can hold aspects
from multiple subclasses at once and access both a Light and a Dark verb, enabling pairings that
were impossible on a single element. It also has Transcendence.

Transcendence: dealing Light and Darkness damage fills two gauges; when both are full you become
Transcendent — a special Prismatic grenade plus large bonuses to weapon and ability damage and
regeneration. Builds are designed to fill both gauges quickly and cycle Transcendence often.

The power of Prismatic is the cross-element loop. Famous examples (confirm aspects/exotics via
inspect_item and list_inventory):
- Warlock: Void Devour for survivability + Stasis Bleak Watcher turret for control + a Solar Hellion
  for passive damage — sustain, lockdown, and DPS in one kit.
- Titan: Solar Consecration spam + Arc Knockout healing + Stasis Diamond Lance, on Synthoceps or
  Wormgod for melee multiplication.
- Hunter: Arc combination melee (Combination Blow) + Void invisibility (Stylish Executioner) for a
  punch-kill-vanish-repeat loop, with Liar's Handshake or a Prismatic exotic class item.

Prismatic exotic class items (Final Shape) roll two exotic perks from different exotics at once —
inspect_item reveals the exact pairing on a given roll, which can define the whole build.`,
  },
  {
    id: "archetypes",
    title: "Build archetypes",
    body: `Most builds fall into one of these templates. Pick the archetype, then fill it with the
subclass engine and exotic that powers it.

- Ability spam: an exotic refunds ability energy on kills/hits so you cast a grenade or melee almost
  constantly. Engine examples: Sunbracers (Solar nades), Contraverse + Devour (Void nades),
  Consecration loop (Titan melee). Stat priority: the ability's regen stat, high.
- Weapon DPS / burst: stack damage buffs (Radiant, Weaken, surges, Transcendence) onto a heavy or
  special weapon for boss damage. Engine: a debuff source + a high-burst weapon.
- Add-clear / AoE: a verb that chains or detonates across packs — Jolt, Ignition, Volatile, Shatter,
  Threadlings. Pair a weapon perk that applies the verb (Voltshot, Incandescent, Destabilizing).
- Survivability / solo: stack heal-over-time and damage resistance — Restoration (Loreley), Devour,
  Frost Armor, Woven Mail, overshields. For hard solo content this is the backbone.
- Crowd control / lockdown: deny the enemy the ability to act — Suspend, Freeze, Blind, Suppress.
  Strongest where being overwhelmed is the failure mode.`,
  },
  {
    id: "systems",
    title: "Cross-cutting systems",
    body: `These apply across all subclasses.

- Armor Charge: armor mods build and spend stacks of Armor Charge. "Spending" mods consume stacks
  for a payoff (e.g. bonus weapon damage, ability energy); "feeding" mods grant stacks (often from
  picking up Orbs of Power). The loop: generate Orbs, convert to Armor Charge, spend on a payoff.
- Orbs of Power: created by masterworked-weapon multikills and by certain mods (e.g. Heavy Handed on
  melee kills, Firepower on grenade kills). Orbs are the fuel for the Armor Charge economy and super.
- Surges: damage mods that boost a matching element. Match weapon elements to your subclass to keep
  surge bonuses active. This is why element-matched weapons are preferred.
- Champions: in endgame content, special enemies require specific stuns. Many subclass verbs gained
  intrinsic champion-stun properties in The Final Shape. As a rule of thumb (confirm in-game or via
  the active artifact): Blind / Jolt / Suppress disrupt Overload; Freeze / Suspend / Scorch-Ignition
  lock down Unstoppable; Radiant weapons and Unraveling / Volatile rounds pierce Barrier.
- Stats: ability regeneration and effectiveness scale with the character's six stats (Weapons, Health,
  Class, Grenade, Super, Melee — see the armor section for what each governs). Build around the one or
  two your engine depends on — the Grenade, Melee, or Class stat for an ability loop — plus Health for
  survivability. inspect_item shows the actual values on a given piece; read them rather than assuming.`,
  },
  {
    id: "recipes",
    title: "Proven synergy recipes",
    // These are exemplars of the loop grammar, not a closed catalog. The atoms to synthesise a
    // playstyle for any specific build — its actual aspects, fragments, and exotic with rules text —
    // ride along on import_build and get_equipped; reason the loop from those against this section.
    body: `Concrete loops that work. Each names an engine, the components that sustain it, and the
weapon perk that feeds it. Treat exotic/weapon names as examples and verify ownership and rolls.

- Void Devour loop: open Devour → kills heal + refund grenade → grenade again. Sustain with a
  grenade-energy exotic (Contraverse / Nezarec's Sin). Feeder weapon perk: Destabilizing Rounds for
  Volatile add-clear. Outcome: near-unkillable infinite grenades.
- Solar Ignition spam: Incandescent weapon spreads Scorch → Scorch peaks → Ignition. Sunbracers
  (Warlock) turns one melee kill into a wave of Solar grenades. Add Radiant for anti-barrier.
- Solar Restoration tank: Loreley (Titan) or healing-grenade fragments keep Restoration up through
  damage. Pair with anything — it is a survivability underlay, not a damage engine.
- Arc Jolt chain: Voltshot weapon → reload after a kill → next hit Jolts → Jolt chains across the
  pack. Stay Amplified; Ionic Traces refund abilities. Best raw add-clear.
- Stasis freeze-and-shatter: Chill Clip or coldsnap to Freeze a cluster → Shatter for area damage →
  collect shards for Frost Armor. Osmiomancy (Warlock) doubles the freezing grenades.
- Strand Suspend lockdown: Suspend a pack (Abeyant Leap widens it on Titan) → they cannot act →
  Unravel and Threadlings clean up. Woven Mail covers the approach.
- Prismatic Transcendence cycle: alternate Light and Dark damage to fill both gauges, go
  Transcendent for the damage/regen spike, and time it for burst windows or to reset a tough room.`,
  },
  {
    id: "god-rolls",
    title: "God rolls: what makes a weapon roll great",
    body: `A "god roll" is the most desirable combination of random perks a Legendary weapon can drop with.
A weapon rolls one plug per column — barrel/sight, magazine, then two trait columns (and an origin trait)
— so the roll is which option landed in each column. The roll that maximizes the weapon's job is the god
roll. Exotics and fixed-roll weapons don't have one (no random perks to chase).

What makes the two trait columns good — this is where a roll is won or lost:
- The two traits should combine into a loop, not just be individually fine. The first trait usually
  primes or enables (reload/handling/accuracy buffs, charges a state), the second pays off (a damage or
  add-clear verb). E.g. a reload-on-kill trait feeding a damage trait, or Voltshot (applies Jolt) behind
  a perk that keeps it loaded.
- Match the trait to the weapon's role and your build's engine: a damage-perk (Rampage, Onslaught,
  Frenzy) on a DPS weapon; a verb-applier (Voltshot, Incandescent, Destabilizing, Hatchling) on an
  add-clear weapon to feed the same verb your subclass runs — see the verbs and recipes topics.
- Barrel and magazine matter less; they tune stability, range, reload, and magazine size. Pick the ones
  that fix the weapon's weakness (e.g. a recoil-direction barrel on a loose-recoil auto). They rarely
  define the roll.

God rolls are activity-dependent. The PvE roll and the PvP roll for the same weapon are usually
different — PvE leans into damage and verb uptime, PvP into range, accuracy, and dueling consistency.
Always say which you mean, and infer it from the player's question and build.

How the tools serve this — these are grounded in the community DIM wishlist (top theorycrafters'
recommendations), keyed by item hash and resolved against the live manifest:
- god_roll(weapon or itemHash) — the recommended roll(s) for a weapon, each with a label, PvE/PvP tags,
  and the accepted perks per column, plus any community-flagged trash perks. This answers "what's the god
  roll for X" and tells the player which perks to chase.
- inspect_item on an owned instance — judges the perks actually rolled on that copy: which recommended
  rolls it fully matches (isGodRoll), or the closest roll and which columns are missing. This is the
  "is my roll any good" answer.
- inspect_sockets — flags each candidate plug in a socket that appears in a recommended roll, so when
  comparing two copies or deciding what to keep you can see the wishlisted options at a glance.

Use them rather than reciting a roll from memory: the wishlist and the manifest are the source of truth,
and a recall answer will miss reissues, new perks, and recent rebalances. When a weapon isn't covered
(brand-new, or niche), fall back to the trait-column reasoning above and name the perks explicitly.`,
  },
];
