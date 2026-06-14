import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { itemMeta } from "../../src/bungie/manifest.js";
import type { GodRoll, GodRollsFile, WeaponGodRolls } from "../../src/tools/godrolls/logic.js";

// Compiles the DIM community wishlist (voltron.txt) into the hash-keyed index the god-roll tools read.
// The wishlist enumerates the full cartesian product of acceptable perks per weapon — one "god roll"
// expands into dozens of lines covering every barrel×mag×trait combination — so each contiguous block
// of dimwishlist lines is transposed back into per-column option sets. Perks are stored as bare hashes
// (resolved to names at read time); the manifest is consulted only to label each weapon and to keep
// just the items it still knows as weapons, so the index stays current as Bungie retires gear.

const VOLTRON_URL =
  "https://raw.githubusercontent.com/48klocs/dim-wish-list-sources/master/voltron.txt";
const WILDCARD_ITEM = 69420;
const WEAPON_ITEM_TYPE = 3;

const OUT_FILE = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "data",
  "god-rolls.json",
);

interface RawRoll {
  label?: string;
  tags: string[];
  columns: number[][];
}

interface RawWeapon {
  rolls: RawRoll[];
  trash: Set<number>;
}

function parse(text: string): Map<number, RawWeapon> {
  const weapons = new Map<number, RawWeapon>();
  const weaponFor = (hash: number): RawWeapon => {
    let weapon = weapons.get(hash);

    if (!weapon) {
      weapon = { rolls: [], trash: new Set() };
      weapons.set(hash, weapon);
    }

    return weapon;
  };

  let pendingLabel: string | undefined;
  let pendingTags: string[] = [];
  let blockItem: number | undefined;
  let blockLabel: string | undefined;
  let blockTags: string[] = [];
  let blockLines: number[][] = [];

  const flush = (): void => {
    if (blockItem !== undefined && blockLines.length > 0) {
      weaponFor(blockItem).rolls.push({
        label: blockLabel,
        tags: blockTags,
        columns: transpose(blockLines),
      });
    }

    blockItem = undefined;
    blockLines = [];
  };

  for (const raw of text.split("\n")) {
    const line = raw.trim();

    if (line.startsWith("dimwishlist:")) {
      const item = Number(line.match(/item=(-?\d+)/)?.[1]);
      const perks = (line.match(/perks=([\d,]+)/)?.[1] ?? "")
        .split(",")
        .map(Number)
        .filter((hash) => hash > 0);

      if (!item || Math.abs(item) === WILDCARD_ITEM) {
        continue;
      }

      if (item < 0) {
        flush();
        for (const perk of perks) {
          weaponFor(-item).trash.add(perk);
        }

        continue;
      }

      if (item !== blockItem) {
        flush();
        blockItem = item;
        blockLabel = pendingLabel;
        blockTags = pendingTags;
        pendingLabel = undefined;
        pendingTags = [];
      }

      if (perks.length > 0) {
        blockLines.push(perks);
      }

      continue;
    }

    flush();

    if (line.startsWith("//notes:")) {
      const tags = line.split("|tags:")[1];

      pendingTags = tags
        ? tags
            .trim()
            .split(/[\s,]+/)
            .filter(Boolean)
        : [];
    } else if (line.startsWith("//")) {
      const content = line.slice(2).trim();

      // A title comment names the roll, as either "Weapon - Intent (god-pve)" or "Weapon (PvP roll)".
      // Skip the perk-summary comment (a parenthesized column list, starts with "("), source/URL notes,
      // and the long prose that DIM sometimes leaves uncommented above a block.
      const commas = content.match(/,/g)?.length ?? 0;

      if (
        content.length < 80 &&
        commas < 2 &&
        !content.startsWith("(") &&
        !/^https?:|^taken from/i.test(content) &&
        (content.includes(" - ") || /\([^)]*\)\s*$/.test(content))
      ) {
        pendingLabel = content;
      }
    }
  }

  flush();

  return weapons;
}

// Reverse the cartesian expansion: column i is the distinct plug hashes seen at position i across the
// block's lines, in first-seen order.
function transpose(lines: number[][]): number[][] {
  const width = Math.max(...lines.map((line) => line.length));
  const columns: number[][] = [];

  for (let i = 0; i < width; i++) {
    const seen = new Set<number>();

    for (const line of lines) {
      if (line[i] !== undefined) {
        seen.add(line[i]);
      }
    }

    columns.push([...seen]);
  }

  return columns;
}

// Reduce a wishlist title to just the roll's intent. Titles come as "Weapon - Intent (god-pve)" or
// "Weapon (PvP first choice roll)", so strip the weapon name, then prefer the lead text and fall back
// to the parenthetical. With no usable title, fall back to the loudest tag, then a generic label.
function cleanLabel(label: string | undefined, weaponName: string, tags: string[]): string {
  if (label) {
    const stripped = label
      .replace(new RegExp(`^${escapeRegExp(weaponName)}\\s*-?\\s*`, "i"), "")
      .trim();
    const lead = stripped.replace(/\s*\([^)]*\)\s*$/, "").trim();
    const paren = stripped.match(/\(([^)]*)\)\s*$/)?.[1]?.trim();
    const intent = lead || paren;

    if (intent) {
      return intent;
    }
  }

  return (
    tags.find((tag) => /god/i.test(tag)) ??
    tags.find((tag) => /^pv[ep]$/i.test(tag)) ??
    tags[0] ??
    "Recommended"
  );
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function resolveWeapon(raw: RawWeapon, weaponName: string): GodRoll[] {
  const seen = new Set<string>();
  const rolls: GodRoll[] = [];

  for (const roll of raw.rolls) {
    const signature = roll.columns.map((column) => column.join(",")).join("|");

    if (seen.has(signature)) {
      continue;
    }

    seen.add(signature);
    rolls.push({
      label: cleanLabel(roll.label, weaponName, roll.tags),
      tags: roll.tags,
      columns: roll.columns,
    });
  }

  return rolls;
}

async function main(): Promise<void> {
  console.log(`[destiny2-mcp] Fetching wishlist from ${VOLTRON_URL}…`);
  const response = await fetch(VOLTRON_URL);

  if (!response.ok) {
    throw new Error(`[destiny2-mcp] voltron.txt returned ${response.status}`);
  }

  const parsed = parse(await response.text());

  console.log(`[destiny2-mcp] Parsed ${parsed.size} item hashes. Resolving against the manifest…`);

  const resolved: { hash: number; weapon: WeaponGodRolls }[] = [];

  for (const [hash, raw] of parsed) {
    const meta = await itemMeta(hash);

    if (!meta || meta.itemType !== WEAPON_ITEM_TYPE) {
      continue;
    }

    resolved.push({
      hash,
      weapon: {
        name: meta.name,
        type: meta.type,
        rolls: resolveWeapon(raw, meta.name),
        trash: [...raw.trash],
      },
    });
  }

  // Insert in weapon-name order so the committed JSON diffs cleanly between regenerations.
  resolved.sort((a, b) => a.weapon.name.localeCompare(b.weapon.name));

  const weapons: Record<string, WeaponGodRolls> = {};

  for (const { hash, weapon } of resolved) {
    weapons[String(hash)] = weapon;
  }

  const payload: GodRollsFile = {
    source: "github.com/48klocs/dim-wish-list-sources voltron.txt",
    generatedAt: new Date().toISOString(),
    weapons,
  };

  await mkdir(dirname(OUT_FILE), { recursive: true });
  await writeFile(OUT_FILE, `${JSON.stringify(payload, null, 2)}\n`);

  console.log(`[destiny2-mcp] Wrote ${Object.keys(weapons).length} weapons to ${OUT_FILE}`);
}

await main();
