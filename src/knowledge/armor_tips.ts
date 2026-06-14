/**
 * Curated "how do I actually use this" tips for notable EXOTIC armor — the playstyle nuance the
 * manifest leaves out. The manifest tells you what the exotic *does*; these tell you *how to build
 * around it*: what to pair it with, the loop it enables, what to do before a damage phase. Keyed by
 * the exotic's name (lowercased), with the intrinsic perk's name as an alternate key where it differs,
 * so a card can resolve a tip from either; look one up with armorTip(). Only exotics with non-obvious
 * usage earn an entry — a stat-stick or "more grenade energy" exotic stays quiet — so an armor card
 * surfaces a blurb for the few that matter. Destiny is at end-of-life with balance frozen, so stable.
 *
 * @example
 * armorTip("Star-Eater Scales")
 * // → "Damage-phase exotic: collect Orbs of Power to stack Feast of Light (up to 6) BEFORE you cast…"
 */
export function armorTip(name: string): string | undefined {
  return ARMOR_TIPS[name.toLowerCase()];
}

const ARMOR_TIPS: Record<string, string> = {
  // Damage-phase / Super exotics — sequencing matters most here.
  "star-eater scales":
    "Damage-phase exotic: collect Orbs of Power to stack Feast of Light (up to 6) BEFORE you cast — a full stack massively overcharges your Super's damage. Bank orbs during add-clear, then dump a max-stack Super into the boss.",
  "cuirass of the falling star":
    "All-in on Thundercrash: it boosts the slam's damage and adds an overshield on impact. Pair with orb generation to have your Super up for each damage phase, then fly straight into the boss.",
  "phoenix protocol":
    "Warlock Well engine: kills and assists inside your Well of Radiance refund Super energy — often enough to re-cast almost immediately. Place the Well on a busy add-clear point to chain Wells across a fight.",

  // Build-loop exotics — the exotic IS the rotation.
  "heart of inmost light":
    "Using one ability (grenade, melee, or barricade) empowers the other two — bigger and faster-recharging. Keep cycling abilities; never sit on a full charge. The engine of an ability-spam Titan build.",
  sunbracers:
    "Get a Solar melee kill, then throw grenades nonstop for ~5s of free, infinite Solar grenades. Loop: melee a weak target → rain grenades → repeat. Pair with melee-energy sources to keep the trigger up.",
  "necrotic grip":
    "Your melee poisons, and a poisoned kill spreads to nearby enemies — chain melee a group to wipe it. Strongest with Thorn or Osteo Striga, whose poison also triggers the spread.",
  "osmiomancy gloves":
    "Built for Coldsnap grenades: you get a second charge and faster recharge, and the seeker grenades freeze across a room. Spam Coldsnaps to keep enemies frozen, then shatter for damage.",
  "assassin's cowl":
    "A powered melee kill (or finisher) makes you invisible AND heals you. Chain melee kills to stay perma-invisible — great for survivability and re-positioning. Pair with melee-recharge sources.",
  "gyrfalcon's hauberk":
    "Going invisible empowers your next Void weapon damage and applies volatile. On a Void Hunter, fade out (dodge/smoke), then break invis with a weapon hit to spread volatile detonations through a group.",

  // Survivability / utility exotics with a non-obvious trigger.
  "loreley splendor helm":
    "When critically wounded (or on barricade cast) it drops a Sunspot that heals you — a near-automatic panic heal. Lean into it as a survivability crutch in tough content; cast your barricade to trigger it on demand.",
  "mask of bakris":
    "Your dodge becomes a Stasis-shifting blink that also boosts Arc and Stasis weapon damage afterward. Dodge to reposition AND to buff your next burst — use it offensively, not just to escape.",
  "cenotaph mask":
    "Keep a Trace Rifle equipped: damaging bosses/champions with it marks them, and killing a marked target showers your allies with Heavy ammo. You become the team's ammo economy — prioritize tagging tough targets.",
};
