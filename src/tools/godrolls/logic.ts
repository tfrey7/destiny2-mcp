import { readFile } from "node:fs/promises";
import { itemName } from "../../bungie/manifest.js";
import { GOD_ROLLS_FILE } from "../../setup/config.js";

// One roll the community recommends. Each column holds the plug hashes accepted in that slot (a barrel,
// a magazine, a trait); the roll matches when every column is satisfied. Perks are stored as bare hashes
// — names resolve from the manifest at read time, the server's single source of truth, so a renamed perk
// never goes stale in this file.
export interface GodRoll {
  label: string;
  tags: string[];
  columns: number[][];
}

export interface WeaponGodRolls {
  name: string;
  type: string;
  rolls: GodRoll[];
  trash: number[];
}

export interface GodRollsFile {
  source: string;
  generatedAt: string;
  weapons: Record<string, WeaponGodRolls>;
}

export interface NamedPerk {
  hash: number;
  name: string;
}

// The verdict for a single owned roll against the community wishlist: which recommended rolls the
// equipped perks fully satisfy, and the nearest miss when none do.
export interface GodRollVerdict {
  covered: boolean;
  isGodRoll: boolean;
  matched: { label: string; tags: string[] }[];
  closest?: { label: string; tags: string[]; missing: string[] };
}

export async function loadGodRolls(): Promise<GodRollsFile> {
  cache ??= readGodRolls();

  return cache;
}

export async function godRollsFor(weaponHash: number): Promise<WeaponGodRolls | undefined> {
  const { weapons } = await loadGodRolls();

  return weapons[String(weaponHash)];
}

// The set of plug hashes the wishlist recommends anywhere on this weapon, for flagging a socket's
// candidate plugs in inspect_sockets. Names aren't needed here — the caller already has the hash.
export async function recommendedPlugHashes(weaponHash: number): Promise<Set<number>> {
  const weapon = await godRollsFor(weaponHash);

  return new Set(weapon?.rolls.flatMap((roll) => roll.columns.flat()) ?? []);
}

// Resolve a roll's columns (and trash perks) to {hash, name} for display in the god_roll tool.
export async function nameColumns(columns: number[][]): Promise<NamedPerk[][]> {
  return Promise.all(columns.map(named));
}

export async function namePerks(hashes: number[]): Promise<NamedPerk[]> {
  return named(hashes);
}

// Judge an owned roll: the equipped plug hashes (and their names, to absorb enhanced↔base perks that
// don't share a hash) against every recommended roll for the weapon. A column is satisfied by a hash
// match or a name match; a roll matches when all its columns are satisfied.
export async function judgeRoll(
  weaponHash: number,
  equippedHashes: number[],
  equippedNames: string[],
): Promise<GodRollVerdict> {
  const weapon = await godRollsFor(weaponHash);

  if (!weapon) {
    return { covered: false, isGodRoll: false, matched: [] };
  }

  const hashes = new Set(equippedHashes);
  const names = new Set(equippedNames.map(normalize));
  const matched: { label: string; tags: string[] }[] = [];
  let closest: GodRollVerdict["closest"];
  let fewestMissing = Infinity;

  for (const roll of weapon.rolls) {
    const missing: string[] = [];

    for (const column of roll.columns) {
      if (column.some((hash) => hashes.has(hash))) {
        continue;
      }

      const perks = await named(column);

      if (!perks.some((perk) => names.has(normalize(perk.name)))) {
        missing.push(perks.map((perk) => perk.name).join(" / "));
      }
    }

    if (missing.length === 0) {
      matched.push({ label: roll.label, tags: roll.tags });
    } else if (missing.length < fewestMissing) {
      fewestMissing = missing.length;
      closest = { label: roll.label, tags: roll.tags, missing };
    }
  }

  return {
    covered: true,
    isGodRoll: matched.length > 0,
    matched,
    ...(matched.length === 0 && closest ? { closest } : {}),
  };
}

async function named(hashes: number[]): Promise<NamedPerk[]> {
  return Promise.all(hashes.map(async (hash) => ({ hash, name: await itemName(hash) })));
}

let cache: Promise<GodRollsFile> | null = null;

async function readGodRolls(): Promise<GodRollsFile> {
  return JSON.parse(await readFile(GOD_ROLLS_FILE, "utf8")) as GodRollsFile;
}

// Enhanced perks carry a different hash from their base but the same name modulo the word "Enhanced",
// so name-matching on this normal form lets an enhanced roll satisfy a wishlist that lists the base.
function normalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/\benhanced\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
