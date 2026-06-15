/**
 * Curated "how do I actually play this" tips for a weapon's intrinsic — the frame archetype on a
 * legendary, or the unique intrinsic perk on an exotic. Every weapon has an intrinsic, so this is what
 * lets the weapon card show a HOW TO USE block for *every* weapon (a plain legendary or a bare-bones
 * exotic that has no notable column perks would otherwise show nothing). The manifest's intrinsic text
 * says what the frame *is*; these say how it *plays* — its range band (close/mid/long), how it engages
 * (precision vs. forgiving/area), and its cadence and role (burst-then-retreat, sustained DPS,
 * add-clear, boss-DPS). Matches the voice of perk_tips.ts: concrete, second-person, when-and-how.
 *
 * Resolution is layered, most-specific first (see intrinsicTip):
 *   1. EXOTIC_TIPS  — the exotic's unique intrinsic, keyed `${type} · ${name}` (type-qualified because
 *      one intrinsic name, "Gathering Light", is shared by Ergo Sum [Sword] and Traveler's Chosen
 *      [Sidearm], and the two play differently).
 *   2. FRAME_TIPS   — a legendary frame archetype, also keyed `${type} · ${name}`: the same frame name
 *      (Adaptive Frame, High-Impact Frame…) plays differently on each weapon type, so the type is part
 *      of the key.
 *   3. BASELINE_TIPS — a per-weapon-type fallback so a never-before-seen frame still yields a usable tip
 *      and the resolver is never empty.
 *
 * Keys are lowercased. Destiny is at end-of-life with balance frozen, so these are stable.
 *
 * @example
 * intrinsicTip("Hand Cannon", "Mark of the Devourer") // Thorn's exotic intrinsic
 * // → "Rounds pierce targets and inflict a poison damage-over-time; …"
 * intrinsicTip("Scout Rifle", "High-Impact Frame")    // a legendary frame
 * // → "Slowest, hardest-hitting scout, most accurate planted and aiming. …"
 */
export function intrinsicTip(weaponType: string, intrinsicName: string): string | undefined {
  const type = weaponType.toLowerCase();
  const key = `${type} · ${intrinsicName.toLowerCase()}`;

  return EXOTIC_TIPS[key] ?? FRAME_TIPS[key] ?? BASELINE_TIPS[type];
}

// Per-weapon-type fallback — how the weapon class plays in general, used when no frame/exotic entry
// matches (a brand-new frame archetype, say). Keyed by lowercased itemTypeDisplayName.
const BASELINE_TIPS: Record<string, string> = {
  "auto rifle":
    "Mid-range sustained fire. Hold the trigger on a target and ride the recoil; lean on forgiving body-shot damage for steady add-clear rather than burst spikes.",
  "combat bow":
    "Long-range precision. Draw fully before firing for max damage and accuracy, land headshots, and reposition between shots — it rewards patience, not spray.",
  "fusion rifle":
    "Close-to-mid burst. Pre-charge behind cover, then peek and release the bolt into one body — a single charged volley deletes a target. Time the charge so you fire the instant you're exposed.",
  glaive:
    "Point-blank hybrid. Melee in close, block to raise the shield and tank hits, and fire ranged shots to keep the shield charged. Brawl up close, not at range.",
  "grenade launcher":
    "Mid-range area damage. Lob rounds at grouped enemies or bank them off walls; aim for the floor under a cluster rather than a single body to catch the splash.",
  "hand cannon":
    "Mid-range precision. Land headshots in controlled bursts and let it settle between shots — duel from cover, peek-shoot, and don't spray at range.",
  "linear fusion rifle":
    "Long-range boss DPS. Aim down sights, charge, and land precision hits from safety — a sustained-damage heavy for chipping a boss across the arena, not for add-clear.",
  "machine gun":
    "Mid-range sustained heavy. Brace and hold the trigger on a group or boss; the first rounds are wild, so let it settle and walk your fire into crits.",
  "pulse rifle":
    "Mid-to-long-range burst. Fire in controlled bursts and pull back between them to keep the burst on the crit — a precision pick that rewards staying at range.",
  "rocket launcher":
    "Long-range burst DPS. A heavy you swap to for a damage window — fire into a boss or tight group, then swap off; mind the splash at close range.",
  "scout rifle":
    "Long-range precision. Pick targets off from distance with single headshots; your safe poke tool for chipping from cover well outside other weapons' range.",
  "sniper rifle":
    "Long-range precision burst. Scope in, land a crit, and pull off — a single-target tool for picking high-value targets or chipping a boss from safety.",
  shotgun:
    "Point-blank burst. Close the gap, fire into a body for a one-shot, then retreat — an in-your-face tool, useless past short range.",
  sidearm:
    "Close-to-mid rapid fire. Stay mobile and pour quick shots into nearby targets; a forgiving panic tool for clearing adds in your face, not a ranged pick.",
  "submachine gun":
    "Close-range sustained fire. Strafe and hold the trigger on nearby targets — a high-rate add-clear tool best inside short range where its spread stays tight.",
  sword:
    "Point-blank melee. Light-attack to build energy, then unload heavy attacks on a full meter; block to tank hits while you close. Brawl in melee range.",
  "trace rifle":
    "Mid-range sustained beam. Hold the laser on one target and let damage ramp — a continuous-fire special that rewards staying locked on a single enemy.",
};

// Legendary frame archetypes, keyed `${type} · ${frame}` (lowercased). The same frame name plays
// differently per weapon type, so each combination is its own entry.
const FRAME_TIPS: Record<string, string> = {
  // Auto Rifle
  "auto rifle · adaptive frame":
    "Mid-range generalist. Steady cadence — hold on a target, ride the light recoil, and lean on reliable body-shot damage for sustained add-clear.",
  "auto rifle · balanced heat weapon":
    "A no-reload auto that never needs ammo but builds heat. Fire in long strings, then tap reload to vent before it overheats; manage the heat bar instead of a magazine. Bonus damage vs. tough combatants makes it a steady mid-range pick.",
  "auto rifle · high-impact frame":
    "Slowest, hardest-hitting auto — most accurate when stationary and aiming. Plant your feet at mid-to-long range and land bursts on the crit; it punishes movement, so hold still.",
  "auto rifle · lightweight frame":
    "Fast-handling auto that boosts move speed. Stay mobile, strafe through fights, and spray nearby groups — trades raw impact for mobility and snappy add-clear.",
  "auto rifle · precision frame":
    "Vertical-recoil auto that's easy to control at range. Hold the crit and let the predictable kick climb straight — a steady mid-range precision pick.",
  "auto rifle · rapid-fire frame":
    "Fastest-firing auto with deep reserves and a faster empty reload. Hold the trigger and dump the mag into groups — fire to empty for the reload bonus; built for sustained add-clear.",
  "auto rifle · support frame":
    "A healing auto — hip-fire at allies to heal them once charged, harm foes to build the charge. Alternate shooting enemies and hipfiring teammates; rapid heals boost your damage and overshield allies. A support tool, not a damage pick.",

  // Combat Bow
  "combat bow · high-impact frame":
    "Slow, hard-hitting bow — most accurate stationary and aiming. Draw fully, hold still, and land precision shots from range; one well-placed arrow does big damage.",
  "combat bow · high-impact longbow":
    "Heavy-draw longbow with over-penetrating arrows that pierce lined-up targets. Take the slow full draw, line enemies up, and fire from long range.",
  "combat bow · lightweight frame":
    "Fast recurve bow that draws quickly and boosts move speed. Snap-fire arrows while staying mobile; tap reload mid-draw to cancel a shot. Built for quick close-to-mid kills.",
  "combat bow · precision frame":
    "Compound bow with a longer draw tuned for damage. Take the full draw for max payoff and land precision hits from range; reload cancels the shot if you need to bail.",

  // Fusion Rifle
  "fusion rifle · adaptive frame":
    "Well-rounded fusion. Pre-charge behind cover, peek, and release a bolt volley into one body at close-to-mid range — reliable burst that doesn't demand perfect timing.",
  "fusion rifle · aggressive frame":
    "High-damage fusion with a wide horizontal volley and moderate charge. Pre-charge, peek, and sweep the spread across grouped targets up close — strong against multiple bodies at once.",
  "fusion rifle · high-impact frame":
    "Slow, hard-hitting fusion, most accurate planted and aiming. Charge from cover, hold still, and land the full bolt on one target — punishes a high-value body at mid range.",
  "fusion rifle · precision frame":
    "Vertical-recoil fusion that lands its bolt tightly. Pre-charge, peek, and put the concentrated volley on one body at close-to-mid range — the most consistent one-burst kill.",
  "fusion rifle · rapid-fire frame":
    "Fast-charging fusion with deep reserves. Charge quickly and chain bolts through a group up close; fire to empty for the faster reload — sustained burst rather than one big hit.",

  // Glaive
  "glaive · adaptive glaive":
    "Balanced melee/ranged polearm with a frontal shield. Melee up close, fire ranged shots to recharge the shield, and block to tank hits — a sturdy all-round brawler.",
  "glaive · aggressive glaive":
    "Hard-hitting, slow glaive with a shield. Land heavy melee blows up close and fire ranged shots to keep the shield charged — trades speed for melee punch.",
  "glaive · rapid-fire glaive":
    "Fast-firing glaive with a shield. Mix quick ranged shots and melee while blocking to stay alive — leans on its rate of fire for ranged pressure between melees.",

  // Grenade Launcher
  "grenade launcher · adaptive frame":
    "Well-rounded GL. Lob rounds at grouped enemies or bank them off walls; aim for the floor under a cluster to catch the splash at mid range.",
  "grenade launcher · area denial frame":
    "Burst-fire GL that drops lingering damage pools on impact. Carpet a chokepoint or under a boss with pools and let the damage-over-time tick — zone control, not burst.",
  "grenade launcher · compressed wave frame":
    "Projectiles release a wave of energy along the ground on impact. Fire at the floor in front of a group so the wave rolls through them — aim low for the ground-hugging wave.",
  "grenade launcher · double fire":
    "Fires hard-hitting twin rounds. Land both on one target for a heavy double-hit at mid range — a punchier single-target option.",
  "grenade launcher · lightweight frame":
    "One-shot handheld GL with remote detonation — hold to fire, release to detonate mid-air. Time the release to burst the round right over a group; boosts move speed too.",
  "grenade launcher · micro-missile frame":
    "Fires a fast micro-missile in a straight line with reduced self-damage and boosted move speed. Aim direct-impact at a target like a rocket — flat, fast trajectory, safe up close.",
  "grenade launcher · precision frame":
    "Fires a slower bouncing grenade — hold to fire, release to detonate. Bank it around corners or roll it into a group, then release to airburst over them.",
  "grenade launcher · rapid-fire frame":
    "Fast-firing GL with deep reserves and faster empty reload. Pepper a group with quick rounds and fire to empty for the reload — sustained splash over single big hits.",
  "grenade launcher · wave frame":
    "One-shot handheld GL whose projectile releases a wave of energy along the ground. Fire at the floor ahead of a line of adds so the wave washes through them — premier add-clear.",

  // Hand Cannon
  "hand cannon · adaptive frame":
    "Well-rounded hand cannon. Land headshots in controlled bursts from mid range, duel from cover, and let it settle between shots.",
  "hand cannon · aggressive frame":
    "High-damage, high-recoil hand cannon tuned for long range. Plant your feet, land precise headshots, and fight the heavy kick between shots — a long-range duelist.",
  "hand cannon · dynamic heat weapon":
    "A no-reload hand cannon with higher base damage that builds high heat. Fire, then tap reload to vent; it cools fast between shots, so pace your shots and vent before overheating.",
  "hand cannon · heavy burst":
    "Fires a hard-hitting two-round burst with reduced flinch. Land both rounds on the crit from mid range — a precise burst duelist that resists incoming fire.",
  "hand cannon · lightweight frame":
    "Fast-handling hand cannon that boosts move speed. Stay mobile, peek-shoot at mid range, and rely on snappy handling for quick duels.",
  "hand cannon · precision frame":
    "Vertical-recoil hand cannon that fires quickly and accurately, with faster ADS move speed. Hold the crit and let the predictable kick climb straight — the most controllable mid-range duelist.",
  "hand cannon · spread shot":
    "Fires a short-range spread of pellets like a mini-shotgun. Get close and fire into a body — built for in-your-face kills, not ranged precision.",

  // Linear Fusion Rifle
  "linear fusion rifle · adaptive burst":
    "Fires a three-round burst. Aim down sights and land all three on a boss's crit from long range — a sustained-damage heavy for chipping high-value targets.",
  "linear fusion rifle · precision frame":
    "Fires a long-range precision bolt with vertical recoil. Scope in and land single charged hits on a boss crit from safety — sustained ranged DPS, not add-clear.",

  // Machine Gun
  "machine gun · adaptive frame":
    "Well-rounded MG. Brace and hold the trigger on a group or boss at mid range; let the first rounds settle, then walk fire into crits for sustained damage.",
  "machine gun · aggressive frame":
    "High-damage, high-recoil MG. Plant and fight the heavy kick — big per-shot damage rewards landing crits on a tough target through the recoil.",
  "machine gun · balanced heat weapon":
    "A no-reload MG that builds little heat. Hold the trigger in long strings, tapping reload to vent before overheating — sustained fire without ever stopping to reload.",
  "machine gun · high-impact frame":
    "Slow, hard-hitting MG, most accurate stationary and aiming. Plant your feet, hold the crit, and land heavy rounds on a boss — punishes movement, so stay put.",
  "machine gun · rapid-fire frame":
    "Fastest-firing MG with deep reserves and faster empty reload. Hold the trigger and bury a group; fire to empty for the reload — relentless add-clear.",

  // Pulse Rifle
  "pulse rifle · adaptive frame":
    "Well-rounded pulse. Fire controlled bursts on the crit at mid-to-long range and pull back between them — a reliable precision poke tool.",
  "pulse rifle · aggressive burst":
    "Hard-hitting four-round burst. Land the full burst on one crit from mid range for a heavy chunk — a high-damage burst duelist.",
  "pulse rifle · balanced heat weapon":
    "A no-reload pulse with bonus damage vs. tough combatants. Fire bursts, tap reload to vent heat, and never stop for ammo — sustained mid-range pressure.",
  "pulse rifle · dynamic heat weapon":
    "A no-reload pulse with higher base damage vs. tough combatants; builds high heat but cools fast. Fire bursts, vent with reload, and pace shots to stay under the overheat.",
  "pulse rifle · heavy burst":
    "Fires a hard-hitting two-round burst with reduced flinch. Land both on the crit from mid range — a precise, flinch-resistant duelist.",
  "pulse rifle · high-impact frame":
    "Slow, hard-hitting pulse, most accurate planted and aiming. Hold still at long range and land full bursts on the crit — rewards patience over aggression.",
  "pulse rifle · legacy pr-55 frame":
    "Tuned for hip-fire — dramatically better accuracy and targeting while hipfiring. Fire from the hip up close to lean on the bonus rather than aiming down sights.",
  "pulse rifle · lightweight frame":
    "Fast-handling pulse that boosts move speed. Stay mobile, burst at mid range, and rely on snappy handling for repositioning duels.",
  "pulse rifle · micro-missile frame":
    "Fires self-propelled micro-missiles that explode on impact for high damage. Land bursts on a group and let the explosions splash — a hard-hitting hybrid burst.",
  "pulse rifle · rapid-fire frame":
    "Fastest-firing pulse with deep reserves and faster empty reload. Chain bursts into a group and fire to empty for the reload — sustained add-clear.",

  // Rocket Launcher
  "rocket launcher · adaptive frame":
    "Well-rounded rocket. Swap to it for a damage window, fire into a boss or tight group, then swap off — mind the splash up close.",
  "rocket launcher · aggressive frame":
    "High-damage, high-recoil rocket. Big per-rocket damage for a burst window on a boss — fire from range and brace for the kick.",
  "rocket launcher · high-impact frame":
    "Slow, hard-hitting rocket, most accurate planted and aiming. Plant your feet, aim at a boss, and land the heavy hit — burst DPS from a stationary firing line.",
  "rocket launcher · precision frame":
    "Fires small auto-tracking rockets that lock on when aimed. Aim at a target to lock, then fire — the tracking lands hits on moving targets from range.",

  // Scout Rifle
  "scout rifle · aggressive frame":
    "High-damage, high-recoil scout. Land precise headshots from long range and fight the kick — big crit damage for picking targets off at distance.",
  "scout rifle · balanced heat weapon":
    "A no-reload scout with bonus damage vs. tough combatants. Fire from long range, tap reload to vent heat, and poke without ever stopping for ammo.",
  "scout rifle · high-impact frame":
    "Slowest, hardest-hitting scout, most accurate planted and aiming. Hold still at long range and land headshots — premier safe poke from maximum distance.",
  "scout rifle · lightweight frame":
    "Fast-handling scout that boosts move speed. Stay mobile and pick targets at long range with snappy handling — poke and reposition.",
  "scout rifle · precision frame":
    "Vertical-recoil scout that's easy to control. Land single headshots from long range and let the predictable kick climb straight — the steadiest poke tool.",
  "scout rifle · rapid-fire frame":
    "Full-auto scout with deep reserves and faster empty reload. Hold the trigger on targets at range and fire to empty for the reload — sustained ranged pressure.",

  // Shotgun
  "shotgun · aggressive frame":
    "Hard-hitting, high-recoil shotgun that fires faster after kills. Close the gap, one-shot a body, and let the post-kill fire-rate boost carry you through a group point-blank.",
  "shotgun · heavy burst":
    "Fires a hard-hitting two-round burst with reduced flinch. Close in and land both on a body — a punchy burst at short range.",
  "shotgun · lightweight frame":
    "Fast-handling shotgun that boosts move speed. Slide in, one-shot a body up close, and reposition — built for aggressive shotgun rushing.",
  "shotgun · mida synergy":
    "Vertical-recoil shotgun that pairs with MIDA Multi-Tool — equip MIDA for extra speed and to feed it mod progress. Run alongside MIDA and brawl up close.",
  "shotgun · pinpoint slug frame":
    "Fires a single precise slug with vertical recoil. Aim for the crit at slightly longer shotgun range — a precision slug, not a spread, so place the shot.",
  "shotgun · precision frame":
    "Vertical-recoil spread shotgun. Center the spread on a body up close for a reliable one-shot — the steady, predictable point-blank pick.",
  "shotgun · rapid fire slug":
    "Fast-firing slug rounds with deep reserves. Chain quick precise slugs into a target at short-to-mid range — sustained slug damage rather than one big blast.",
  "shotgun · rapid-fire frame":
    "Full-auto shotgun with deep reserves and faster empty reload. Hold the trigger and bury a target up close; fire to empty for the reload — relentless close-range damage.",
  "shotgun · shot package":
    "Aggressive shotgun tuned for a tighter ADS spread. Aim down sights to land more pellets on a body — squeeze the spread for a reliable point-blank one-shot.",

  // Sidearm
  "sidearm · adaptive burst":
    "Well-rounded sidearm firing a reliable 3-round burst. Pour bursts into nearby targets while staying mobile — a forgiving close-range add-clear tool.",
  "sidearm · adaptive frame":
    "Well-rounded sidearm. Stay mobile and pour quick shots into nearby targets — a forgiving panic tool for clearing adds in your face.",
  "sidearm · dynamic heat weapon":
    "A no-reload sidearm with higher base damage vs. tough combatants; high heat but cools fast. Fire, tap reload to vent, and pace shots to stay under the overheat up close.",
  "sidearm · heavy burst":
    "Fires a hard-hitting two-round burst with reduced flinch. Land both on a nearby target — a punchy, flinch-resistant close-range pick.",
  "sidearm · lightweight frame":
    "Fast-handling sidearm that boosts move speed. Strafe through fights and snap-fire at nearby adds — mobility-first close-range clear.",
  "sidearm · micro-missile frame":
    "Fires self-propelled micro-missiles that explode on impact. Land shots on grouped adds and let the explosions splash — a hard-hitting close-range clear tool.",
  "sidearm · precision frame":
    "Vertical-recoil sidearm. Land controlled shots on the crit up close and let the predictable kick climb straight — the steadiest close-range pick.",
  "sidearm · rapid-fire frame":
    "Full-auto sidearm with deep reserves and faster empty reload. Hold the trigger on nearby adds and fire to empty for the reload — sustained close-range clear.",
  "sidearm · together forever":
    "A well-rounded sidearm (Drang) built to pair with Sturm — final blows reload it and overflow a bonus-damage round into Sturm. Clear adds with it, then swap to Sturm for the empowered shot; run the two together.",

  // Sniper Rifle
  "sniper rifle · adaptive frame":
    "Well-rounded sniper. Scope in, land a crit, and pull off — a balanced single-target pick for chipping a boss or picking high-value targets from range.",
  "sniper rifle · aggressive frame":
    "High-damage, high-recoil sniper. Land the heavy crit from long range and ride out the big kick — top-end per-shot damage for boss chip.",
  "sniper rifle · disruption weapon [shield-piercing]":
    "Fires a single heavy round that disintegrates on impact and pierces Barrier shields. Scope in, land the crit, and use it to break Barrier Champions from range.",
  "sniper rifle · dynamic heat weapon":
    "A no-reload sniper with higher base damage; high heat but cools fast. Land crits, tap reload to vent, and pace shots to stay under the overheat — boss chip without reloading.",
  "sniper rifle · high-impact frame":
    "Slowest, hardest-hitting sniper, most accurate planted and aiming. Hold still at long range and land the heavy crit — top single-shot damage from a stationary firing line.",
  "sniper rifle · rapid-fire frame":
    "Fastest-firing sniper with deep reserves and faster empty reload. Chain quick crits on a boss and fire to empty for the reload — sustained sniper DPS over single big hits.",

  // Submachine Gun
  "submachine gun · adaptive frame":
    "Well-rounded SMG. Strafe and hold the trigger on nearby targets — a steady close-range add-clear tool.",
  "submachine gun · aggressive burst":
    "Hard-hitting four-round burst SMG. Land bursts on nearby targets at close range — a punchier burst alternative to full-auto spray.",
  "submachine gun · aggressive frame":
    "High-damage, high-recoil SMG. Hold the trigger on a close target and fight the kick — big per-shot damage for in-your-face kills.",
  "submachine gun · balanced heat weapon":
    "A no-reload SMG with bonus damage vs. tough combatants. Hold the trigger in strings, tap reload to vent heat, and never stop for ammo up close.",
  "submachine gun · lightweight frame":
    "Fast-handling SMG that boosts move speed. Strafe through fights and spray nearby groups — mobility-first close-range clear.",
  "submachine gun · mida synergy":
    "Fast-handling SMG that pairs with MIDA Multi-Tool — equip MIDA for extra speed and to feed it mod progress. Run alongside MIDA and clear adds up close.",
  "submachine gun · precision frame":
    "Vertical-recoil SMG. Hold the crit on a close target and let the predictable kick climb straight — the steadiest close-range spray.",

  // Sword
  "sword · adaptive frame":
    "All-round sword. Build energy with light attacks, then unload a heavy uppercut on a full meter; block to tank hits while you close. Heavies hit hardest at full energy.",
  "sword · aggressive frame":
    "Hard-hitting sword. Build energy, then land a heavy slam on a full meter for big damage; block to tank hits while closing — slow but punishing.",
  "sword · caster frame":
    "Ranged-projectile sword. Build energy, then fire a heavy projectile attack on a full meter — lets you hit from a step back instead of pure melee.",
  "sword · lightweight frame":
    "Fast sword. Build energy, then heavy-dash to close distance and hit on a full meter; great mobility for gap-closing into a brawl.",
  "sword · vortex frame":
    "Spin-attack sword. Build energy, then unleash a heavy spin on a full meter to hit everything around you — premier add-clear when surrounded.",
  "sword · wave sword frame":
    "Heavy attack launches a shockwave uppercut into the air; an immediate follow-up swing deploys a homing strike. Uppercut, then swing again mid-air to send the seeking follow-up at a target.",

  // Trace Rifle
  "trace rifle · adaptive frame":
    "Well-rounded trace rifle. Hold the beam on one target at mid range and let sustained damage ramp — a continuous-fire special that rewards locking on a single enemy.",
};

// Exotic intrinsics, keyed `${type} · ${name}` (lowercased). Each is the weapon's usage blurb — when to
// pull it out, what to set up before firing, how its mechanic shapes a rotation.
const EXOTIC_TIPS: Record<string, string> = {
  "hand cannon · memento mori":
    "Get a kill, then reload — the next few rounds deal bonus damage. Chain kill → reload → dump the buffed shots into your next target; you also keep radar while aiming.",
  "trace rifle · ager's call":
    "Hold the beam on a target; final blows send out a slowing burst around them. Use it to slow and control groups on a Stasis build — kills do the freezing setup for you.",
  "grenade launcher · harvester spike":
    "Fire the spike into combatants; final blows spawn Vestiges, and impaling tougher targets streams them out. Tag a powerful combatant and farm the Vestiges it produces.",
  "grenade launcher · arc traps":
    "Stick two grenades on or near a target and they chain Arc lightning between them. Place mines across a boss before a damage phase and let the chained ticks stack — sustained trap DPS.",
  "linear fusion rifle · compounding force":
    "Fires shield-breaking slugs and pierces Barrier Champions. Swap to it to instantly pop an elemental shield or stun a Barrier Champion, then finish with your primary.",
  "pulse rifle · string of curses":
    "Kills refill the mag, boost damage, and feed Super energy. Chain kills to keep the buff and Super battery rolling — fire full-auto through a room and never stop killing.",
  "submachine gun · panic response":
    "Deal damage to build blight; stop firing to refill the mag, then reload to convert blight into Blighted Seekers. Alternate bursts and reloads to spit seekers at adds.",
  "fusion rifle · saint's fists":
    "Fires three rapid spreads of force. Melee a target first for bonus damage, faster charge, and reload — punch, then unload the burst up close for a melee-fed DPS combo.",
  "sword · crow's wings":
    "Heavy attack fires a suppressing projectile that spreads to nearby suppressed targets. Fling projectiles to suppress a group from range without closing to melee.",
  "sniper rifle · the fundamentals":
    "Use the alternate action to cycle Void/Arc/Solar; match the element to a shield or an active elemental buff/debuff for bonus damage. Switch to the right element, then crit it down.",
  "sidearm · hungering quarrel":
    "Double-fires tracking bolts that leech health on hit. Pour bolts into a target up close to heal yourself while you clear — a self-sustaining add tool on a Void build.",
  "auto rifle · overcharge capacitor":
    "Sprint, slide, and fire to build charge — boosting range and reload; high-charge kills explode and max-charge explosions blind. Stay moving to build charge, then detonate a group.",
  "auto rifle · four-headed dog":
    "Sprays erratic bullets from four barrels — a close-range firehose. Get in a target's face where the spread connects; useless at range, devastating point-blank.",
  "auto rifle · command frame":
    "Fires heavy extended-range rounds at a slower rate with bonus precision damage when aiming. Aim down sights and land crits at mid-to-long range — plays more like a precision rifle than a sprayer.",
  "sniper rifle · mortal polarity":
    "Precision kills spawn a lightning bolt at the target and grant Bolt Charge. Land headshot kills on adds to chain lightning strikes through a group — add-clear from a sniper.",
  "trace rifle · cold fusion":
    "Hold the Arc beam on one target; damage ramps the longer it stays on. Lock onto a single tough target and keep the laser glued — don't break the beam, the ramp is the payoff.",
  "pulse rifle · void leech":
    "On a Void build it stores debuffs from suppressed/weakened/volatile targets, then alt-fire to spread them. Apply Void debuffs, leech them, and re-spread — a Void-debuff engine.",
  "shotgun · split decision":
    "Dual barrels fire Stasis and Solar — freezing then igniting a target, and it staggers Unstoppable Champions. Get close, fire both, and use it to freeze-and-ignite or stun an Unstoppable.",
  "hand cannon · banned weapon":
    "Fires a 3-round burst and heals you on precision kills while refilling the mag. Land bursts on crits to stay topped up — a self-healing mid-range duelist.",
  "sidearm · ln2 burst":
    "Get a final blow, then alt-fire to enable a charged Stasis shot that freezes. Clear an add, then unload the charged shot to freeze a tougher target up close.",
  "sniper rifle · personal assistant":
    "Scoping a target shows its health and jolts on hits; strong vs. Overload Champions. Hold the scope on a boss or Overload Champion — the bonus damage and jolt come from staying on target.",
  "scout rifle · cranial spike":
    "Chaining precision hits stacks range, reload, and damage. Land consecutive headshots to ramp the buff — hip-fire works too; keep hitting crits and never drop the chain.",
  "grenade launcher · trinary vision":
    "One-shot handheld GL firing a fan of three ground waves. Fire at the floor ahead of a group so all three waves wash through them — wide add-clear.",
  "rocket launcher · dark deliverance":
    "Fire, then release to detonate the projectile in mid-air, raining Void orbs on the group below. Airburst it directly over a cluster for maximum raining damage — height matters.",
  "fusion rifle · traitor's vessel":
    "Hip-fire a wide spread; kills generate Ionic Traces (always from powerful foes). Hipfire into groups on an Arc build to farm Ionic Traces and feed your ability energy.",
  "machine gun · vexadecimal":
    "Hold the trigger — every fourth round weakens, and it pierces Barrier Champions. Keep sustained fire on one target so the weakening procs land; built to debuff a boss while you hose it.",
  "sidearm · close the gap":
    "Kills make Firesprites; grab one, then alt-fire for a charged Solar laser beam, and it staggers Unstoppables. Clear an add, scoop the sprite, and beam a tougher target or stun an Unstoppable.",
  "trace rifle · judgment":
    "Sustained fire traps the target in a weakening field that stuns Overload Champions and opens a crit cage for your fireteam. Hold the beam on a boss so allies pile into the cage — a team debuff tool.",
  "rocket launcher · composite propellant":
    "Rockets embed and periodically eject fuel that scorches; wait longer between shots for more fuel, and it staggers Unstoppables. Stick a boss and let the scorch tick while you do other damage.",
  "shotgun · compression chamber":
    "Hip-fire a pellet spread up close, or aim for a single high-damage slug at range. Hipfire to clear adds in your face; aim down sights to snipe a tougher target with the slug.",
  "glaive · edge of action":
    "Build charge with melee and projectile hits, then alt-fire a special projectile — final blows detonate volatile and grant Volatile Rounds. Charge up, fire the special into a group for Void detonations.",
  "glaive · edge of concurrence":
    "Build charge, then alt-fire a heavy ranged attack; sustained damage jolts targets. Charge up and unload the special into a group on an Arc build for chained jolts.",
  "glaive · edge of intent":
    "Build charge, then alt-fire a special projectile; final blows scorch nearby targets, and it spawns a healing turret. Charge up, fire into a group for Solar scorch, and lean on the turret's sustain.",
  "sword · gathering light":
    "Final blows stack Gathering Light (better guard and lunge); stow the sword to spend the stacks for melee, grenade, and class ability energy. Rack up kills, then swap off to dump the ability energy.",
  "hand cannon · looks can kill":
    "Fires shield-piercing rounds and ignites on breaking a matched shield or a Champion barrier; strong vs. Barriers. Open on a shielded target or Barrier Champion — the first scoped shot does the heavy lifting.",
  "linear fusion rifle · unwound":
    "Sustained damage spawns Threadlings at the target on a Strand build. Hold fire on a boss to bleed Threadlings into the fight — a heavy DPS option that also feeds Strand add-clear.",
  "grenade launcher · corrupted nucleosynthesis":
    "It enrages when dealing or taking sustained damage, firing faster while enraged. Stay in the thick of a fight to keep it enraged, then ride the boosted fire rate against the group.",
  "rocket launcher · eyes on all":
    "Tracks and fires at multiple targets at once. Aim at a cluster of adds and let it split fire across them — built for clearing a group, not single-target DPS.",
  "linear fusion rifle · quantum nova":
    "Alt-fire spends reserves to dramatically Weaken a target — the more ammo, the longer the debuff. Dump a big charge to weaken a boss before your fireteam's damage phase, then chip with the rest.",
  "grenade launcher · delayed gratification":
    "A primary GL — grenades bounce off surfaces; hold to fire, release to detonate. Bank shots off walls and floors at mid range, then release to airburst over a group.",
  "sidearm · all at once":
    "Hold the trigger to mark targets and load rounds, then release for a stable burst — a full charge on a marked target unravels it. Paint a group on a Strand build, release, and unravel them.",
  "linear fusion rifle · ruinscribe's forge":
    "Alt-fire (costs 3 ammo) deploys an auto-firing turret — aim it skyward for clear sight lines. Drop a turret overlooking a fight and let it chip while you use your other weapons.",
  "sidearm · full stop":
    "Oversized full-auto sidearm with heavy rounds and bonus precision damage on unshielded targets. Land crits on unshielded adds at close-to-mid range — a hard-hitting, snappy primary.",
  "rocket launcher · wolfpack rounds":
    "Rockets split into tracking micro-missiles on detonation, and it grants Wolfpack to nearby allies' rockets too. Fire into a boss for the cluster damage; in a fireteam, everyone's rockets get the buff.",
  "machine gun · wrath of the colossus":
    "Build up missiles by hitting targets, then it charges and fires full-auto heavy slugs. Stack the missile counter on adds, then unload the charged burst into a boss for a damage spike.",
  "pulse rifle · black hole":
    "The second shot of each burst does massive damage with no falloff and detonates kills into Void bursts. Focus the second-shot crit; kills chain Void explosions through a group — premier Void add-clear.",
  "hand cannon · temporal manipulation":
    "Alt-fire swaps between fast Arc and slow Stasis modes; kills/precision overcharge the opposite mode. Match the mode to your need — Arc to spray adds, Stasis to control — and swap to overcharge.",
  "auto rifle · volatile light":
    "Rounds overpenetrate, ricochet off walls, and gain damage after a bounce; alt-fire cycles the element. Bank shots off surfaces in tight rooms and match the element to a shield — a versatile mid-range sprayer.",
  "hand cannon · paracausal shot":
    "Kills and precision hits stack Paracausal Charge; the final round in the mag hits huge based on stacks. Build stacks, then land that last round on a tough target — don't stow on the final round or you lose it.",
  "sword · exhumation":
    "Heavy attacks at full energy turn you invisible and fire exploding Void projectiles. Build energy, then heavy to vanish and detonate a group — escape and add-clear in one on a Void build.",
  "machine gun · heavy slug thrower":
    "Aim down sights to spin up — it only fires once spun, and full spin-up grants a protective overshield. Pre-spin behind cover, then hold the trigger on a boss with the overshield up for safe sustained DPS.",
  "combat bow · bolt thrower":
    "Fires high-powered explosive bolts and staggers Unstoppable Champions. Draw fully and land explosive shots from range — use it to stun Unstoppables on demand.",
  "combat bow · guidance ring":
    "Precision hits and kills build energy; at full charge, hipfire creates a Guidance Ring that boosts arrows shot through it. Build the ring, then fire arrows through it at a boss for amplified damage.",
  "sniper rifle · no backpack":
    "It has no reserves — ammo regenerates over time from kills/assists with other weapons. Fire a shot, then let it refill while you use other guns; defeating powerful combatants gives multiple rounds.",
  "sniper rifle · honed edge":
    "Alt-fire consumes the mag to load one massively boosted round. Reload to full, alt-fire to pack the magazine into one shot, and land that Honed Edge crit on a boss for a burst spike.",
  "auto rifle · the right choice":
    "Every seventh round ricochets to nearby targets. Hold sustained fire on a group so the ricochet rounds bounce between adds — a steady mid-range clear tool.",
  "combat bow · poison arrows":
    "Perfect-draw arrows poison; precision hits stun and spread poison, and it's strong vs. Overload Champions. Hit the perfect draw, land crits to spread poison through a group and stun Overloads.",
  "shotgun · shock blast":
    "Fires overpenetrating Arc blasts — a massive close-range burst. Get point-blank on a tough target or lined-up group and unload; huge damage, tiny range.",
  "combat bow · big-game hunter":
    "Fires a massive bolt that stuns unshielded combatants and staggers Unstoppables. Draw and land the heavy bolt on a high-value target or to stun an Unstoppable Champion.",
  "trace rifle · starlight beam":
    "Fires a stable, accurate low-intensity Arc beam. Hold it on one target at mid range — easy to keep on the crit; a steady Arc DPS beam that feeds Arc builds.",
  "shotgun · shrapnel launcher":
    "Fires a rapid short-range burst of Solar damage. Hold the trigger on a target up close for a stream of Solar shrapnel — sustained close-range damage rather than a single blast.",
  "linear fusion rifle · lagrangian sight":
    "Final blows on marked targets drop telemetry; grab three without dying for a long damage buff and a refill. Mark and kill to collect telemetry, then cash the buff into a boss damage window.",
  "hand cannon · noble rounds":
    "Kills leave Remnants; absorb one to turn your next hipfire into an ally-healing Noble Round. Clear an add, grab the Remnant, and hipfire at a teammate to heal and buff them — a support hand cannon.",
  "scout rifle · mida multi-tool":
    "Boosts move speed and keeps radar up while aiming. Stay mobile, poke at long range, and lean on the constant radar for map awareness — a fast, safe poke primary.",
  "hand cannon · explosive shadow":
    "Slugs burrow into a target; enough stacked slugs detonate, stunning survivors and staggering Unstoppables. Land a full mag into a tough target to trigger the blow-up — strong vs. bigger combatants and Unstoppables.",
  "fusion rifle · charge shot":
    "Hold to charge a tracking bolt that explodes and burns on impact. Charge, then release toward a target — the bolt seeks them, so it's forgiving; great for chip damage and area Solar burn.",
  "fusion rifle · conserve momentum":
    "Non-killing hits ramp its charge speed. Chip a boss with the first bolts to spin up the charge time, then later bolts fire fast — a sustained boss-DPS fusion; keep it on one target.",
  "trace rifle · paracausal beam":
    "Fires a Kinetic beam with massive bonus shield damage; a heavy primary-style trace. Hold it on a boss for steady DPS — strong, ammo-efficient, and great into shields.",
  "auto rifle · monte carlo method":
    "Dealing damage slashes your melee cooldown and kills can fully charge it. Spray to keep your melee always up — pair with a melee-hungry build and treat it as a melee battery.",
  "auto rifle · cursebringer":
    "Precision kills trigger a Cursed Thrall explosion that corrupts; chained explosions refill the mag. Land headshot kills to start the chain, then let the explosions clear the room and reload you.",
  "sniper rifle · the master":
    "Precision hits ramp its damage until you die, and reserves are huge. Stay alive and keep landing crits on a boss to stack the damage — a long-haul DPS sniper that rewards not getting hit.",
  "pulse rifle · atomizing rounds":
    "Rounds embed in targets; alt-fire detonates them. Stick a burst into a group, then alt-fire to blow the embedded rounds for a delayed area hit — set up, then detonate.",
  "pulse rifle · rewind again":
    "Precision shots and hits on Stasis-slowed/frozen targets return to the mag, plus a time portal adds a second gun. On a Stasis build, freeze then fire for a near-endless mag — keep hitting crits.",
  "fusion rifle · ahamkara's eye":
    "Charging unleashes a continuous beam of fire. Hold the trigger on a boss or down a lane of adds — the beam sweeps and burns; pure sustained DPS, mind the heavy ammo cost.",
  "submachine gun · screaming swarm":
    "Fires tracking toxic rounds; kills spread poison and refill the mag. Tag one target and let the swarm track and poison the group — forgiving aim, premier add-clear.",
  "pulse rifle · the corruption spreads":
    "Rapid hits and precision kills spawn SIVA nanite swarms that chew through targets. Land bursts to spawn the bots — they ramp on tough targets, so it doubles as surprising boss DPS.",
  "grenade launcher · worm's hunger":
    "The shot's damage scales with kills you got just before firing. Rack up add kills, then fire the buffed worm at a boss — clear, then cash the stacks into one big hit.",
  "scout rifle · the perfect fifth":
    "Four precision hits load a delayed Solar explosive round; precision hits return ammo. Land four crits, then fire the explosive shot to scorch a group — chain it to keep the loop going.",
  "sword · ranged weapon":
    "Heavy attack throws the blade to seek targets; hold for a powerful straight throw, attack to recall. Fling it into a group from range and recall — a sword that fights at a distance.",
  "trace rifle · prismatic inferno":
    "The Solar beam grows a heat field as you fire and scorches on sustained damage. Sweep it across a group up close — the field widens, so it clears adds better the longer you hold it.",
  "auto rifle · missile tracers":
    "Landing hits turns the next shot into a homing micro-missile, and the grenades it spawns enable Strand. Hold sustained fire to keep launching missiles into a group — a hybrid sprayer/launcher on a Strand build.",
  "sidearm · rat pack":
    "It grows stronger when allies also equip it — stacks up to six. Run it as a fireteam for the full buff (invis on reload too); solo it's just a fast sidearm, so coordinate.",
  "pulse rifle · redemption":
    "Kills cure you; reloading after a kill cures nearby allies. Push fights aggressively — every kill heals you, and the post-kill reload tops off the team; a self- and team-sustain primary.",
  "pulse rifle · hunter's trace":
    "Pierces Barrier Champions; precision hits load high-damage alt-scope rounds that exhaust targets. Land crits to bank charges, then alt-fire the heavy shockwave rounds — strong vs. Barriers and groups.",
  "submachine gun · arc conductor":
    "Taking Arc damage overcharges it — more damage, chaining lightning, and Arc resistance; kills extend it. Fire into Arc-damage situations to proc it, then ride the chain-lightning through a group.",
  "trace rifle · transmutation":
    "Kills collapse victims into Void Transmutation spheres you can pick up and wield. Clear a few adds, grab a sphere, and use the slam/shield to control the area — a Void utility beam.",
  "auto rifle · suros legacy":
    "The bottom half of each mag deals bonus damage and can return health on kill. Don't reload early — fire into the back half of the mag for the damage and healing payoff.",
  "grenade launcher · cryocannon":
    "Hold to charge; release to spawn Stasis crystals and freeze a group, and it staggers Unstoppables. Charge and fire into a cluster to freeze them for a shatter, or build crystals for a Stasis build.",
  "machine gun · dichotomous thinking":
    "Hitting foes builds a charge; hipfire at allies to heal them and refill your mag, and rapid heals spawn Threadlings. Alternate damaging the boss and hipfiring teammates — a Strand support heavy.",
  "scout rifle · slug rifle":
    "Aim for fast straight slugs, or hipfire for a bigger scorching explosion; bonus vs. Cabal. Aim down sights to snipe at range, hipfire to scorch a close group — two modes, pick per situation.",
  "shotgun · nightsworn sight":
    "Final blows grant Nightsworn Sight — boosted reload, precision damage, Truesight, and weakening submunitions. Get a kill to enter the buff, then snowball through the group while it's active.",
  "linear fusion rifle · dornröschen":
    "The laser overpenetrates and refracts off hard surfaces. Line up targets to pierce them, or bank the beam off a wall onto a boss crit — high sustained DPS, great into lined-up bosses.",
  "sniper rifle · cayde's retribution":
    "Charge the Super bar with Orbs and precision hits, then alt-fire to fire Golden Gun shots. Bank the charge, then dump the Golden Gun rounds into a boss — a portable burst-DPS Super.",
  "hand cannon · accomplice":
    "Kills with it refill your equipped Energy weapon from reserves. Get a kill, then swap to your energy weapon with a full overflowed mag — pair it deliberately with a DPS energy gun (or Drang).",
  "hand cannon · sunburn":
    "Fires explosive Solar rounds; kills make targets explode and highlight others. Land body shots into a group and let the chain explosions clear the room — premier Solar add-clear, no precision needed.",
  "auto rifle · payday":
    "Holding the trigger ramps accuracy and rate of fire, and picking up ammo reloads it. Spin it up and keep it spun — the longer you fire, the tighter and faster it gets; a minigun for hordes.",
  "scout rifle · revolution":
    "Precision hits build Arc Seeker charge; alt-fire to launch tracking Arc seekers. Land crits to bank seekers, then alt-fire them at a group — ranged precision that converts into tracking add-clear.",
  "submachine gun · ravenous beast":
    "Damage builds power; at full, alt-fire to unleash a high-damage, Solar-resistant mode until it runs dry. Build the meter on adds, then unload the Beast into a boss for a burst DPS window.",
  "fusion rifle · unplanned reprieve":
    "Bolts attach and detonate on a delay with a Void blast. Stick a target or group, then let the delayed explosions do the work — fire-and-forget area Void damage; great for setting up volatile.",
  "fusion rifle · property: undecidable":
    "Its damage type matches your equipped grenade, and kills feed grenade and Transcendence energy. Match the element to your build, fire to fuel your grenade — a Prismatic-friendly DPS fusion.",
  "shotgun · precision slug":
    "Fires a single precision slug; precision hits grant The Roadborn for boosted fire rate and damage. Land the crit slug from mid-shotgun range, then ride Roadborn — aim it like a shotgun-sniper.",
  "grenade launcher · insectoid robot grenades":
    "Grenades are robots that chase targets and explode; tough kills spawn more. Fire at a group and let the bots hunt — forgiving area clear, and reserves sustain off kills.",
  "shotgun · thunderer":
    "Full-auto with a very high fire rate; final blows auto-load and powerful kills fully reload. Empty the burst into a tough target up close — built to dump a magazine fast for a point-blank spike.",
  "submachine gun · ride the bull":
    "Holding the trigger ramps fire rate and recoil; kills reload the mag. Hold and spray through a room — kills keep it loaded, so chain them and let the recoil climb.",
  "scout rifle · the fate of all fools":
    "Chaining precision shots stores damage into a buffed body shot and refills the mag; a body shot spends a stack. Land crits at range, then cash a stack with a body shot — alternate to keep the loop.",
  "sword · banshee's wail":
    "Hold block to rev the blade — revved attacks pierce shields and stack damage and resistance. Rev before you swing, build stacks on a boss, then unload revved heavies — premier sword DPS.",
  "hand cannon · fan fire":
    "Full-auto with bonus hip-fire precision damage and faster reload. Hipfire from the hip up close — it's a close-range duelist, so don't aim down sights; fan the trigger and stay mobile.",
  "submachine gun · soaring fang":
    "Damage while airborne extends antigrav repulsors that keep you aloft. Stay in the air and spray — it rewards aerial play on a Void build; alt-fire to disengage when you need to land.",
  "trace rifle · protective weave":
    "Firing at an ally grants both of you Woven Mail, and it does more damage while you have it. Beam a teammate to armor up the team, then fire on enemies with the damage bonus — a Strand support trace.",
  "grenade launcher · excavation":
    "Grenades stick and you hold the trigger to detonate them all at once; kills make Arc explosions. Carpet an area with sticky grenades, then release to blow them together — area denial on demand.",
  "linear fusion rifle · wire rifle":
    "Alt-fire swaps scopes to change firing behavior, and it blinds; strong vs. Unstoppables. Land the heavy bolt on a target to blind and stagger — switch scopes for the handling you want.",
  "rocket launcher · mad scientist":
    "Fires a chaotic volley of rockets and grants Bolt Charge to allies every other shot. Get close-to-mid and dump the volley into a group — spread, not precision; the swarm clears packs.",
  "scout rifle · tri-planar mass driver":
    "Fires a spread of Void projectiles; aiming narrows the spread. Hipfire to spray a close group, aim down sights to tighten it onto a single target at range — adjust the spread to the range.",
  "hand cannon · mark of the devourer":
    "Rounds pierce targets and inflict a poison damage-over-time; kills leave Remnants you absorb to boost damage and regen. Tag targets to let the poison finish them, grab Remnants, and snowball a fight at mid range.",
  "machine gun · reign havoc":
    "Sustained kills call down lightning strikes that grant Bolt Charge; strong vs. Overloads. Hold the trigger on a group to trigger the storm — the longer you fire, the more lightning rains; great add-clear on Arc.",
  "combat bow · sacred flame":
    "Hipfire launches tracking projectiles that mark targets; marked targets explode on death or chain. Hipfire to paint a group, then detonate the chain — forgiving Solar add-clear; aimed shots hit harder single-target.",
  "auto rifle · ignition trigger":
    "Sustained fire overheats it for bonus damage but burns you — pair with health regen. Hold the trigger for the damage ramp, but watch your health; best with a healing source to offset the self-burn.",
  "scout rifle · touch of malice":
    "The final round deals bonus damage from your own life and self-regenerates; kills restore health. Hold on the last round to chip a boss for free, and let kills top you back up — a sustain-DPS scout.",
  "shotgun · repulsor force":
    "Fires an impulse that pushes targets, suppresses abilities, and heavily weakens; strong vs. Overloads. Hit a boss to weaken it before your fireteam's damage phase — a debuff tool, not a damage gun.",
  "sidearm · gathering light":
    "Final blows stack Gathering Light; alt-fire consumes the stacks to grant melee, grenade, and class ability energy. Clear adds to stack, then cash out for a big ability-energy refund — an ability battery.",
  "sidearm · unrepentant":
    "Reloading after a kill loads a longer, more powerful superburst. Get a kill, reload, then dump the superburst into your next target up close — kill-reload-burst is the loop.",
  "combat bow · split electron":
    "Arrows split on release; aiming and full draw tighten the spread, and (with its catalyst) kills electrify the next shot to chain lightning. Aim for single targets, or loose the spread into a group to chain Arc.",
  "rocket launcher · prototype trueseeker":
    "Rockets aggressively track — lock on by aiming down sights. Aim at a target to lock, then fire and let the rocket chase it; near-guaranteed hits, great vs. evasive targets.",
  "hand cannon · latent power":
    "Damage builds Latent Power; at full, hold alt-fire for Unleashed Power — boosted fire rate and weakening shots — but overstaying turns it on you. Trigger it for a damage window, then reload or stow before it backfires.",
  "rocket launcher · twintails":
    "Fires a Void and a Solar rocket that track the same target; strong vs. Overloads (with catalyst, adds a suppressing Void burst). Lock on and fire both into a boss — double-element burst, mind the close splash.",
  "combat bow · hail barrage":
    "Final blows grant Stasis arrows; your next hipfire looses them all in one volley. Land kills to bank arrows, then hipfire the barrage into a group to freeze and shatter on a Stasis build.",
  "fusion rifle · timeless mythoclast":
    "Fires single full-auto bolts; emptying the mag refills it from your hits landed. Land shots to keep the mag topped — a primary-style fusion for sustained mid-range damage; catalyst adds a ramping linear mode.",
  "glaive · m1r distribution matrix":
    "Blocking damage grants Void overshields to you and allies. Fire the spread, then block to build overshield for the team — a sustain glaive on a Void build; the shield drains, so keep feeding it.",
  "pulse rifle · harsh truths":
    "Fires a 5-round burst; when a nearby ally dies, you gain health regen and speed. Fight at mid range in a fireteam — it pays off when teammates go down; a sturdy, comeback-flavored duelist.",
  "trace rifle · harmonic laser":
    "The beam oscillates through three power levels as you hold the trigger. Keep it on one target and let the power cycle ramp — a Void DPS beam; with the catalyst, Orbs grant the max-power mode.",
  "rocket launcher · coronal culmination":
    "Hold to charge, release to fire a delayed Solar payload. Charge and lob it into a group, then the delayed Solar blast detonates — area burst on a Solar build.",
  "sniper rifle · white nail":
    "Higher base precision damage; three rapid precision hits refill the mag from reserves. Land three crits in a row to top the mag and chain near-infinite sniper DPS on a boss — don't miss the crit.",
  "scout rifle · creeping attrition":
    "Rapid precision hits slow the target; strong vs. Overloads. Land consecutive crits to slow and freeze on a Stasis build, and use it to stun Overload Champions — a precision Stasis scout.",
  "glaive · big frigid glaive":
    "Fires a big tracking energy ball that freezes nearby targets; strong vs. Unstoppables. Lob it into a group to freeze them for a shatter, or use it to stun an Unstoppable — a heavy Stasis control glaive.",
  "combat bow · queen's wrath":
    "Full-draw ADS highlights enemies through walls and arrows pierce shields; strong vs. Barriers. Take the full draw to wallhack-and-pierce a lined-up group or stun a Barrier Champion from range.",
  "combat bow · snareweaver":
    "Precision hits and kills build a Snareweaver arrow; on impact it lays traps that suspend nearby targets. Build the charge, then hipfire the trap arrow into a group to suspend them on a Strand build.",
  "grenade launcher · primeval's torment":
    "Projectiles blight the target or area, dealing damage over time. Tag a boss or a chokepoint and let the blight tick while you do other damage — a fire-and-forget DoT primary; pairs with any rotation.",
  "sword · resurgence directive":
    "Light attacks build energy and can spawn healing Quicksilver nanites that attach to you. Light-attack through a brawl to stay healed, then spend energy on heavies — a self-sustain sword.",
  "sword · tesseract":
    "Heavy attack while sprinting at full energy launches a blink dash; a kill with it lets you immediately blink again. Sprint and blink-strike through targets, chaining the dash on each kill — mobile melee burst.",
  "machine gun · pyrotoxin rounds":
    "Fires slow, high-powered explosive rounds with no falloff. Land each heavy shot on a target at any range — consistent explosive damage that ignores distance; great for chunky single targets and Champions.",
};
