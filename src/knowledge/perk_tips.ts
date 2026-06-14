/**
 * Curated "how do I actually use this" tips for notable weapon perks — the playstyle nuance the
 * manifest leaves out. The manifest tells you what a perk *does*; these tell you *when and how* to use
 * it: what to activate before a damage phase, how a perk fits a rotation, what pairs with it. Keyed by
 * perk name (lowercased); look one up with perkTip(). Only perks with non-obvious sequencing or usage
 * earn an entry, so a weapon card surfaces tips for the few that matter and stays quiet for plain stat
 * perks (barrels, magazines, handling traits). An exotic's intrinsic is a "perk" here too, so its entry
 * doubles as the weapon's usage blurb. Destiny is at end-of-life with balance frozen, so these are stable.
 *
 * @example
 * perkTip("Bait and Switch")
 * // → "Boss-DPS perk: damage the target with all three of your weapons within ~3s, then swap here — …"
 */
export function perkTip(perkName: string): string | undefined {
  return PERK_TIPS[perkName.toLowerCase()];
}

const PERK_TIPS: Record<string, string> = {
  // Damage-rotation traits — the ones where sequencing matters most.
  "bait and switch":
    "Boss-DPS perk: deal damage with all three of your weapons within ~3s, then swap here for ~10s of +35% damage. Trigger it right before your damage window — it does nothing until all three have hit.",
  "explosive light":
    "Pick up Orbs of Power (up to 6) BEFORE your damage phase; each charges a buffed, high-damage shot. Collect orbs, then dump them into the boss.",
  frenzy:
    "Stay in combat for 12s and it auto-activates — bonus damage, handling, and reload — and stays on until you leave combat. Great for sustained add-clear; no manual trigger.",
  "fourth time's the charm":
    "Landing 4 rapid precision hits returns 2 rounds to the mag — chains near-infinite DPS on a precision target. Aim for the crit and don't miss.",
  "reservoir burst":
    "Fire only on a FULL magazine: the shot deals bonus damage and explodes on kill. Reload to full before engaging, then unload.",
  "cascade point":
    "After a melee, grenade, or Super kill, this fires much faster for a few seconds — get the kill first, then immediately swap here for a burst-fire DPS window.",
  "envious assassin":
    "Get kills with your OTHER weapons before swapping here — each reloads extra rounds, overflowing the mag well past base for a longer damage phase.",
  bipod:
    "Doubles your rockets in the mag at the cost of damage per rocket — strong sustained DPS, not burst. Just fire away; no setup.",
  "vorpal weapon":
    "Flat bonus damage vs bosses, vehicles, and minibosses — no setup needed, just a reliable DPS pick against tough targets.",
  "firing line":
    "+20% precision damage while two allies stand near you — in a fireteam, group up for the boss damage phase before firing.",

  // Reload / sustain traits worth flagging.
  "rewind rounds":
    "Misses and hits refill the mag from reserves on a delay — keep firing; the mag tops itself back up so you rarely reload.",
  demolitionist:
    "Kills charge your grenade; activating your grenade reloads this weapon. Loop kills → grenade → free reload to keep DPS up.",
  "rapid hit":
    "Rapid precision hits stack reload speed AND stability — stay on the crit to make the weapon snappier the longer you fire.",

  // Subclass-verb traits (Light 3.0 / Strand) — pair with a matching subclass.
  voltshot:
    "Reload after a kill to load a jolting shot — your next hit chains Arc damage to nearby enemies. Best on an Arc build; get a kill, reload, then spread the jolt.",
  incandescent:
    "Kills scatter scorch to nearby enemies — chain kills to ignite groups. Pairs with a Solar build.",
  "destabilizing rounds":
    "Kills make your next hits volatile, spreading Void damage. Lean into it on a Void build for chain detonations.",
  hatchling:
    "Precision kills (or Strand final blows) spawn a Threadling that seeks an enemy — feed a Strand build's add-clear.",
  headstone:
    "Precision kills drop a Stasis crystal where the enemy stood — shatter it for damage and freeze; great with a Stasis build.",
  "chill clip":
    "A few hits slow, then freeze the target — alternate fire to lock down a tough enemy, then shatter it with follow-up damage.",
};
