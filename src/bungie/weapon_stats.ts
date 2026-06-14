import { bungieFetch } from "./client.js";
import { itemMeta } from "./manifest.js";
import { Component, getPrimaryMembership, getProfile } from "./profile.js";

// The narrow projection of one weapon's lifetime usage the read tool surfaces: the manifest-resolved
// name, type, element, and rarity instead of a bare hash, plus the aggregated kill totals and the
// precision fraction recomputed from those totals. itemHash rides along for a downstream drill-down.
export interface WeaponKillEntry {
  name: string;
  type: string;
  element?: string;
  tier: string;
  kills: number;
  precisionKills: number;
  precisionRatio: number;
  itemHash: number;
}

export interface WeaponKillsOptions {
  type?: string;
  element?: string;
  name?: string;
  characterId?: string;
  limit?: number;
  sort?: "kills" | "precision";
}

// The per-weapon kill totals across the player's characters (or one, when scoped), aggregated by
// weapon hash and enriched from the manifest. GetUniqueWeaponHistory is per-character, so this fans
// out across characters and sums each weapon's kills/precision kills, then recomputes the precision
// ratio from the summed totals. Filters by weapon type (abbreviations accepted), element, and name
// substring; sorts by kills (default) or precision ratio; caps at `limit`. Weapons the account has
// never fired simply don't appear in the API response — that's expected, not a gap.
export async function weaponKills(options: WeaponKillsOptions): Promise<WeaponKillEntry[]> {
  const membership = await getPrimaryMembership();
  const characters = await characterIds(options.characterId);

  const batches = await Promise.all(
    characters.map((characterId) => characterWeapons(membership, characterId)),
  );

  const totals = new Map<number, { kills: number; precisionKills: number }>();

  for (const weapon of batches.flat()) {
    const value = (key: string): number => weapon.values[key]?.basic?.value ?? 0;
    const existing = totals.get(weapon.referenceId) ?? { kills: 0, precisionKills: 0 };

    existing.kills += value("uniqueWeaponKills");
    existing.precisionKills += value("uniqueWeaponPrecisionKills");
    totals.set(weapon.referenceId, existing);
  }

  const entries = await project(totals);

  return sort(filter(entries, options), options.sort).slice(0, options.limit ?? 25);
}

interface Membership {
  membershipType: number;
  destinyMembershipId: string;
}

interface RawWeapon {
  referenceId: number;
  values: Record<string, { basic?: { value?: number } }>;
}

async function characterIds(characterId?: string): Promise<string[]> {
  if (characterId) {
    return [characterId];
  }

  const profile = await getProfile([Component.Characters]);

  return Object.keys(profile.characters);
}

async function characterWeapons(membership: Membership, characterId: string): Promise<RawWeapon[]> {
  const data = await bungieFetch<{ weapons?: RawWeapon[] }>(
    `/Destiny2/${membership.membershipType}/Account/${membership.destinyMembershipId}/Character/${characterId}/Stats/UniqueWeapons/`,
  );

  return data.weapons ?? [];
}

// Resolve each summed hash against the manifest, recomputing the precision ratio from the summed
// totals (not averaging per-character ratios). A weapon whose definition is missing is skipped — the
// API occasionally references retired hashes the local manifest no longer carries.
async function project(
  totals: Map<number, { kills: number; precisionKills: number }>,
): Promise<WeaponKillEntry[]> {
  const resolved = await Promise.all(
    [...totals.entries()].map(async ([itemHash, total]) => {
      const meta = await itemMeta(itemHash);

      if (!meta) {
        return undefined;
      }

      return {
        name: meta.name,
        type: meta.type,
        ...(meta.element ? { element: meta.element } : {}),
        tier: meta.rarity,
        kills: total.kills,
        precisionKills: total.precisionKills,
        precisionRatio: total.kills > 0 ? round(total.precisionKills / total.kills) : 0,
        itemHash,
      };
    }),
  );

  return resolved.filter((entry): entry is WeaponKillEntry => entry !== undefined);
}

function filter(entries: WeaponKillEntry[], options: WeaponKillsOptions): WeaponKillEntry[] {
  const type = options.type ? resolveType(options.type) : undefined;
  const element = options.element?.toLowerCase().trim();
  const name = options.name?.toLowerCase().trim();

  return entries.filter((entry) => {
    if (type && !entry.type.toLowerCase().includes(type)) {
      return false;
    }

    if (element && entry.element?.toLowerCase() !== element) {
      return false;
    }

    if (name && !entry.name.toLowerCase().includes(name)) {
      return false;
    }

    return true;
  });
}

function sort(entries: WeaponKillEntry[], by: WeaponKillsOptions["sort"]): WeaponKillEntry[] {
  if (by === "precision") {
    return [...entries].sort((a, b) => b.precisionRatio - a.precisionRatio || b.kills - a.kills);
  }

  return [...entries].sort((a, b) => b.kills - a.kills);
}

// The manifest has no weapon-subtype enum — the only signal is the human `itemTypeDisplayName`
// ("Hand Cannon", "Submachine Gun", …). Map common abbreviations to that display text so a caller can
// ask for "smg" or "hc"; an unknown input falls through as a raw substring against the type.
const TYPE_ALIASES: Record<string, string> = {
  smg: "submachine gun",
  hc: "hand cannon",
  ar: "auto rifle",
  lmg: "machine gun",
  mg: "machine gun",
  gl: "grenade launcher",
  rl: "rocket launcher",
  fusion: "fusion rifle",
  sniper: "sniper rifle",
  shotgun: "shotgun",
  pulse: "pulse rifle",
  scout: "scout rifle",
  sidearm: "sidearm",
  bow: "bow",
  glaive: "glaive",
  sword: "sword",
  trace: "trace rifle",
};

function resolveType(type: string): string {
  const key = type.toLowerCase().trim();

  return TYPE_ALIASES[key] ?? key;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
