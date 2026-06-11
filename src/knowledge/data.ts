export interface KnowledgeSection {
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
5. Close the loop with armor mods (Armor Charge economy, ability regen, orb generation).

Always ground the build in reality: list_inventory to see what the player owns, and inspect_item
on candidate weapons/armor and on the equipped subclass to read the actual rolled perks, aspects,
and fragments with their current in-game descriptions. Do not assume a roll — verify it.`,
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

Ammo types — Primary (infinite), Special (scarce), Heavy. Power-slot weapons are Heavy; Kinetic and
Energy weapons are Primary or Special. Running Special in both Kinetic and Energy makes them compete for
the same scarce ammo, which is a real cost to weigh when planning a loadout.`,
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
- Stats: ability regeneration and effectiveness scale with the character's stats. Build around the
  one or two stats your engine depends on (the grenade, melee, or class-ability stat) and Resilience
  for survivability. inspect_item shows the actual current stat names and values — use it rather than
  assuming, since the exact stat lineup is whatever the live manifest reports.`,
  },
  {
    id: "recipes",
    title: "Proven synergy recipes",
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
];
