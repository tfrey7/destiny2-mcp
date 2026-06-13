import type { Element, ItemCategory } from "../schemas.js";
import { allDefinitions, findDefinition, getDefinition, onManifestSwap } from "./manifest_db.js";

export interface ItemInfo {
  name: string;
  tier?: string;
  itemType?: string;
  collectibleHash?: number;
}

export interface ItemMeta {
  name: string;
  rarity: string;
  type: string;
  // The numeric DestinyItemType (3 = weapon, 2 = armor, …); the coarse category classifier keys off
  // it, the way searchItems does, so weapon/armor can't drift between the two tools.
  itemType?: number;
  element?: string;
  bucketHash: number;
  // The armor set this piece belongs to, if any. Set bonuses live on the set, not the piece.
  setHash?: number;
  // Relative path to the item's icon on Bungie's CDN (prepend https://www.bungie.net). The
  // manifest stores the path, not the bytes; renderers that show art fetch it from the CDN.
  icon?: string;
}

export interface SocketEntry {
  socketTypeHash?: number;
  singleInitialItemHash?: number;
  reusablePlugItems?: { plugItemHash: number }[];
  reusablePlugSetHash?: number;
  randomizedPlugSetHash?: number;
}

export interface SocketCategoryEntry {
  socketCategoryHash: number;
  socketIndexes: number[];
}

export interface ItemDefinition {
  displayProperties?: { name?: string; description?: string; icon?: string };
  itemTypeDisplayName?: string;
  flavorText?: string;
  inventory?: { tierTypeName?: string; bucketTypeHash?: number };
  defaultDamageType?: number;
  equippingBlock?: { ammoType?: number; equipableItemSetHash?: number };
  sockets?: { socketEntries?: SocketEntry[]; socketCategories?: SocketCategoryEntry[] };
  stats?: { stats?: Record<string, { value?: number }> };
  // Present only on plug items (the things that go into sockets). The category id distinguishes a
  // masterwork plug from a mod or shader; investmentStats carry the stat bonuses it grants.
  plug?: { plugCategoryIdentifier?: string };
  investmentStats?: { statTypeHash: number; value: number }[];
  // The sandbox perks an item confers. For subclass aspects and fragments the rules text lives here,
  // not on the item's own displayProperties — see plugDescription.
  perks?: { perkHash: number }[];
}

interface SandboxPerkDefinition {
  displayProperties?: { description?: string };
}

export interface SetPerk {
  requiredCount: number;
  name: string;
  description: string;
}

export interface ItemSet {
  name: string;
  perks: SetPerk[];
}

// The equip slot a weapon competes for, or undefined for non-weapons.
export function slotFromBucketHash(bucketHash: number | undefined): string | undefined {
  return bucketHash === undefined ? undefined : WEAPON_SLOT_BY_BUCKET[bucketHash];
}

// True for a bucket holding equippable weapons or armor — the gear a player vaults to clear a
// character. Excludes subclass, postmaster, consumables, and cosmetics, which a plain transfer
// either can't move or the player keeps on the character.
export function isGearBucket(bucketHash: number | undefined): boolean {
  if (bucketHash === undefined) {
    return false;
  }

  return WEAPON_SLOT_BY_BUCKET[bucketHash] !== undefined || ARMOR_BUCKETS.has(bucketHash);
}

// True for the five armor equip buckets. Gear tier and set bonuses are armor-only, so this gates the
// per-instance socket walk to armor and spares it the weapons/ghosts/ships that can never carry one.
export function isArmorBucket(bucketHash: number | undefined): boolean {
  return bucketHash !== undefined && ARMOR_BUCKETS.has(bucketHash);
}

// True when an item's live bucket is the Postmaster — i.e. it's uncollected mail, not on-person gear.
export function isPostmaster(bucketHash: number | undefined): boolean {
  return bucketHash === POSTMASTER_BUCKET;
}

// The ammo a weapon draws from, or undefined when None / not a weapon.
export function ammoTypeLabel(ammoType: number | undefined): string | undefined {
  return ammoType === undefined ? undefined : AMMO_TYPE[ammoType];
}

// The class an armor piece is restricted to, or "Any" for class-agnostic gear; undefined when absent.
export function classTypeLabel(classType: number | undefined): string | undefined {
  return classType === undefined ? undefined : CLASS_TYPE[classType];
}

// Decode an instance's gear tier from the plugs socketed on it. The masterwork plug carries the
// tier as the bonus it grants to the archetype stats; returns undefined for gear with no tier
// (legacy armor, or anything that isn't tiered armor). Reads the effective tier — i.e. the current
// masterwork level — which on a fully upgraded piece equals its drop tier.
export async function gearTierFromPlugs(plugHashes: number[]): Promise<number | undefined> {
  for (const hash of plugHashes) {
    const definition = await itemDefinition(hash);

    if (!definition.plug?.plugCategoryIdentifier?.includes("armor.masterworks")) {
      continue;
    }

    const tierStat = definition.investmentStats?.find((stat) =>
      ARMOR_ARCHETYPE_STATS.has(stat.statTypeHash),
    );

    if (tierStat) {
      return tierStat.value;
    }
  }

  return undefined;
}

export function itemDefinition(hash: number): Promise<ItemDefinition> {
  return getDefinition<ItemDefinition>(ITEM_TABLE, hash);
}

// The rules text for a plug. Subclass aspects and fragments leave their own displayProperties.description
// empty and carry the text on a linked sandbox perk instead, so fall back to the first perk that has one.
export async function plugDescription(definition: ItemDefinition): Promise<string> {
  const own = definition.displayProperties?.description;

  if (own) {
    return own;
  }

  for (const { perkHash } of definition.perks ?? []) {
    const perk = await getDefinition<SandboxPerkDefinition>(
      "DestinySandboxPerkDefinition",
      perkHash,
    );
    const description = perk.displayProperties?.description;

    if (description) {
      return description;
    }
  }

  return "";
}

// Resolve plug hashes to the atoms a player reasons with: each plug's name and rules text, following
// the sandbox-perk link for aspects/fragments whose own description is blank. Deduped by name. This
// is the shared resolver behind inspect_item's perk list and the mechanics the build tools surface
// inline, so a loadout's loop can be reasoned out from its parts rather than looked up one by one.
export async function describePlugs(
  plugHashes: number[],
): Promise<{ name: string; description: string }[]> {
  const definitions = await Promise.all(plugHashes.map((hash) => itemDefinition(hash)));
  const described = await Promise.all(
    definitions.map(async (definition) => ({
      name: definition.displayProperties?.name,
      description: await plugDescription(definition),
    })),
  );

  const seen = new Set<string>();
  const plugs: { name: string; description: string }[] = [];

  for (const { name, description } of described) {
    if (!name || seen.has(name)) {
      continue;
    }

    seen.add(name);
    plugs.push({ name, description });
  }

  return plugs;
}

// The perks an item confers from its default sockets — what an exotic actually does, as opposed to
// its flavor text. Reads the item definition's initial plugs, so it works for gear you don't own.
export async function intrinsicPerks(
  itemHash: number,
): Promise<{ name: string; description: string }[]> {
  const definition = await itemDefinition(itemHash);
  const plugHashes = (definition.sockets?.socketEntries ?? [])
    .map((entry) => entry.singleInitialItemHash)
    .filter((plugHash): plugHash is number => plugHash !== undefined && plugHash !== 0);

  return describePlugs(plugHashes);
}

export async function statName(hash: number): Promise<string> {
  const stat = await getDefinition<StatDefinition>("DestinyStatDefinition", hash);

  return stat.displayProperties?.name ?? `Stat ${hash >>> 0}`;
}

export async function itemName(hash: number): Promise<string> {
  const item = await findDefinition<RawItem>(ITEM_TABLE, hash);

  return item?.displayProperties?.name ?? `Unknown item ${hash >>> 0}`;
}

export async function itemInfo(hash: number): Promise<ItemInfo | undefined> {
  const item = await findDefinition<RawItem>(ITEM_TABLE, hash);
  const name = item?.displayProperties?.name;

  if (!name) {
    return undefined;
  }

  return {
    name,
    tier: item.inventory?.tierTypeName,
    itemType: item.itemTypeDisplayName || undefined,
    collectibleHash: item.collectibleHash,
  };
}

export async function itemMeta(hash: number): Promise<ItemMeta | undefined> {
  const item = await findDefinition<RawItem>(ITEM_TABLE, hash);
  const name = item?.displayProperties?.name;

  if (!name) {
    return undefined;
  }

  return {
    name,
    rarity: item.inventory?.tierTypeName ?? "Basic",
    type: item.itemTypeDisplayName ?? "",
    itemType: item.itemType,
    element: elementOf(item),
    bucketHash: item.inventory?.bucketTypeHash ?? 0,
    setHash: item.equippingBlock?.equipableItemSetHash || undefined,
    icon: item.displayProperties?.icon || undefined,
  };
}

export async function socketCategoryName(hash: number): Promise<string> {
  const category = await getDefinition<NameDefinition>("DestinySocketCategoryDefinition", hash);

  return category.displayProperties?.name ?? `Socket category ${hash >>> 0}`;
}

// The candidate plugs for a non-randomized socket (shader, ornament, emblem variant) live in a
// plug set keyed off the item definition; the live profile component only fills in what's unlocked.
export async function plugSetItemHashes(plugSetHash: number): Promise<number[]> {
  const plugSet = await getDefinition<{ reusablePlugItems?: { plugItemHash: number }[] }>(
    "DestinyPlugSetDefinition",
    plugSetHash,
  );

  return (plugSet.reusablePlugItems ?? []).map((plug) => plug.plugItemHash);
}

// The name of the armor set a piece belongs to — the cheap lookup for list projections that only
// need to group pieces, not explain the bonuses.
export async function itemSetName(setHash: number): Promise<string | undefined> {
  const set = await getDefinition<EquipableItemSetDefinition>(
    "DestinyEquipableItemSetDefinition",
    setHash,
  );

  return set.displayProperties?.name || undefined;
}

// The full set: its name plus each bonus and the piece count that unlocks it, with live perk text.
// This is the armor set-bonus system added late in Destiny 2 — every armor set defines bonuses at
// (typically) 2 and 4 equipped pieces. Legacy armor belongs to no set and resolves to undefined.
export async function equipableItemSet(setHash: number): Promise<ItemSet | undefined> {
  const set = await getDefinition<EquipableItemSetDefinition>(
    "DestinyEquipableItemSetDefinition",
    setHash,
  );
  const name = set.displayProperties?.name;

  if (!name) {
    return undefined;
  }

  const perks = await Promise.all(
    (set.setPerks ?? []).map(async (perk) => {
      const sandbox = await getDefinition<{
        displayProperties?: { name?: string; description?: string };
      }>("DestinySandboxPerkDefinition", perk.sandboxPerkHash);

      return {
        requiredCount: perk.requiredSetCount,
        name: sandbox.displayProperties?.name ?? `Perk ${perk.sandboxPerkHash >>> 0}`,
        description: sandbox.displayProperties?.description ?? "",
      };
    }),
  );

  return { name, perks };
}

export async function artifactName(hash: number): Promise<string> {
  const artifact = await getDefinition<NameDefinition>("DestinyArtifactDefinition", hash);

  return artifact.displayProperties?.name ?? `Artifact ${hash >>> 0}`;
}

// An artifact perk carries its name on the item but its tooltip on a linked sandbox perk.
export async function artifactPerkText(
  itemHash: number,
): Promise<{ name: string; description: string }> {
  const item = await getDefinition<ArtifactPerkDefinition>(ITEM_TABLE, itemHash);
  const name = item.displayProperties?.name ?? `Perk ${itemHash >>> 0}`;

  if (item.displayProperties?.description) {
    return { name, description: item.displayProperties.description };
  }

  const perkHash = item.perks?.[0]?.perkHash;

  if (perkHash === undefined) {
    return { name, description: "" };
  }

  const sandbox = await getDefinition<
    NameDefinition & { displayProperties?: { description?: string } }
  >("DestinySandboxPerkDefinition", perkHash);

  return { name, description: sandbox.displayProperties?.description ?? "" };
}

export async function loadoutName(hash: number): Promise<string> {
  const loadout = await findDefinition<NameDefinition>("DestinyLoadoutNameDefinition", hash);

  return loadout?.displayProperties?.name ?? loadout?.name ?? "Unnamed loadout";
}

export async function collectibleSource(collectibleHash: number): Promise<string | undefined> {
  const collectible = await findDefinition<CollectibleDefinition>(
    "DestinyCollectibleDefinition",
    collectibleHash,
  );

  return collectible?.sourceString || undefined;
}

// Prefer the highest rarity, then a candidate that actually has a Collections source.
export async function findItemByName(name: string): Promise<number | undefined> {
  if (!nameIndexPromise) {
    nameIndexPromise = (async () => {
      try {
        return buildNameIndex();
      } catch (error) {
        nameIndexPromise = null;
        throw error;
      }
    })();
  }

  const candidates = (await nameIndexPromise).get(name.toLowerCase());

  if (!candidates?.length) {
    return undefined;
  }

  const owned = (entry: { collectibleHash?: number }): number => (entry.collectibleHash ? 1 : 0);

  return [...candidates].sort((a, b) => compareByTier(a, b) || owned(b) - owned(a))[0].hash;
}

export interface CatalogEntry {
  hash: number;
  name: string;
  tier?: string;
  type?: string;
  element?: string;
  slot?: string;
  ammoType?: string;
  classType?: string;
  itemType?: number;
  collectibleHash?: number;
  setHash?: number;
  setName?: string;
  // The manifest's per-table insertion order. Not a release date, but new content is appended, so a
  // higher index reliably reads as "more recently added" — the only recency signal the manifest carries.
  index?: number;
}

export interface SearchFilters {
  name?: string;
  element?: string;
  type?: string;
  tier?: string;
  category?: ItemCategory;
  class?: string;
  set?: string;
  owned?: boolean;
  // "newest" orders by manifest index descending (latest-added first) instead of the default
  // tier-then-name, so "the newest exotic hand cannon" resolves without guessing from memory.
  sort?: "newest";
  limit?: number;
}

// Ownership lives in the player's account, not the manifest, so the caller supplies the lookup.
export type OwnershipLookup = (entry: { name: string; collectibleHash?: number }) => boolean;

export interface SearchResult {
  count: number;
  truncated: boolean;
  items: CatalogEntry[];
}

export async function searchItems(
  filters: SearchFilters,
  isOwned?: OwnershipLookup,
): Promise<SearchResult> {
  if (!catalogPromise) {
    catalogPromise = (async () => {
      try {
        return buildCatalog();
      } catch (error) {
        catalogPromise = null;
        throw error;
      }
    })();
  }

  const catalog = await catalogPromise;
  const setNames = await setNamesByHash(catalog);

  const name = filters.name?.toLowerCase();
  const type = filters.type?.toLowerCase();
  const set = filters.set?.toLowerCase();
  const setNameOf = (entry: CatalogEntry) =>
    entry.setHash ? setNames.get(entry.setHash) : undefined;

  const matches = catalog.filter((entry) => {
    if (name && !entry.name.toLowerCase().includes(name)) {
      return false;
    }

    if (type && !entry.type?.toLowerCase().includes(type)) {
      return false;
    }

    if (filters.element && entry.element !== filters.element) {
      return false;
    }

    if (filters.tier && entry.tier !== filters.tier) {
      return false;
    }

    if (set && !setNameOf(entry)?.toLowerCase().includes(set)) {
      return false;
    }

    if (filters.category && !inCategoryGroup(entry, filters.category)) {
      return false;
    }

    // "Any" gear (class items, class-agnostic exotics) is usable on every class, so it survives a class filter.
    if (filters.class && entry.classType !== filters.class && entry.classType !== "Any") {
      return false;
    }

    if (filters.owned !== undefined && isOwned && isOwned(entry) !== filters.owned) {
      return false;
    }

    return true;
  });

  const sorted = dedupeByName(matches).sort(
    filters.sort === "newest"
      ? (a, b) => (b.index ?? 0) - (a.index ?? 0)
      : (a, b) => compareByTier(a, b) || a.name.localeCompare(b.name),
  );

  const limit = filters.limit ?? 50;
  const items = sorted.slice(0, limit).map((entry) => ({ ...entry, setName: setNameOf(entry) }));

  return { count: sorted.length, truncated: sorted.length > limit, items };
}

const ITEM_TABLE = "DestinyInventoryItemDefinition";

interface RawItem {
  displayProperties?: { name?: string; icon?: string };
  itemType?: number;
  itemTypeDisplayName?: string;
  collectibleHash?: number;
  defaultDamageType?: number;
  talentGrid?: { hudDamageType?: number };
  equippingBlock?: { ammoType?: number; equipableItemSetHash?: number };
  inventory?: { tierTypeName?: string; bucketTypeHash?: number };
  classType?: number;
  index?: number;
}

interface CollectibleDefinition {
  sourceString?: string;
}

interface NameDefinition {
  displayProperties?: { name?: string };
  name?: string;
}

interface StatDefinition {
  displayProperties?: { name?: string };
}

interface EquipableItemSetDefinition {
  displayProperties?: { name?: string };
  setPerks?: { requiredSetCount: number; sandboxPerkHash: number }[];
}

const DAMAGE_TYPE: Record<number, Element> = {
  1: "Kinetic",
  2: "Arc",
  3: "Solar",
  4: "Void",
  6: "Stasis",
  7: "Strand",
};

// DestinyInventoryBucketDefinition hashes for the three weapon equip slots. An item only carries a
// meaningful slot if it lives in one of these buckets; armor and everything else map to undefined.
const WEAPON_SLOT_BY_BUCKET: Record<number, string> = {
  1498876634: "Kinetic",
  2465295065: "Energy",
  953998645: "Power",
};

// DestinyInventoryBucketDefinition hashes for the five armor equip slots (helmet, gauntlets, chest,
// legs, class item). With the three weapon buckets above, these are the buckets holding gear that
// transfers freely between a character and the vault — unlike subclass, postmaster, or cosmetic buckets.
const ARMOR_BUCKETS = new Set([3448274439, 3551918588, 14239492, 20886954, 1585787867]);

// The Lost Items (Postmaster) bucket. Bungie returns its contents inside CharacterInventories, so an
// item's *current* bucket — not its definition's home bucket — is the only signal that it's sitting in
// the inbox rather than the player's actual loadout. Such items can't be equipped or vaulted directly.
const POSTMASTER_BUCKET = 215593132;

// DestinyAmmunitionType enum: 0 = None (non-weapon), 1 = Primary, 2 = Special, 3 = Heavy.
const AMMO_TYPE: Record<number, string> = {
  1: "Primary",
  2: "Special",
  3: "Heavy",
};

// DestinyClass enum: 0 = Titan, 1 = Hunter, 2 = Warlock, 3 = Any (non-class-restricted, e.g. weapons).
const CLASS_TYPE: Record<number, string> = {
  0: "Titan",
  1: "Hunter",
  2: "Warlock",
  3: "Any",
};

// The six Armor 3.0 archetype stats (Weapons, Health, Grenade, Super, Class, Melee). An armor
// masterwork plug ("Upgrade Armor") adds the same value to all six, and that value IS the gear
// tier (1-5) — Edge of Fate's quality scale, separate from rarity. (Armor Energy Capacity, also on
// the plug, is a legacy stat fixed at 10, not the tier.) Legacy pre-tier armor has no such plug.
const ARMOR_ARCHETYPE_STATS = new Set([
  2996146975, // Weapons
  392767087, // Health
  1735777505, // Grenade
  144602215, // Super
  1943323491, // Class
  4244567218, // Melee
]);

const TIER_RANK: Record<string, number> = {
  Exotic: 4,
  Legendary: 3,
  Rare: 2,
  Uncommon: 1,
  Common: 0,
};

// Comparator: higher tier first. Returns 0 for equal tiers so callers can chain a tiebreaker with `||`.
function compareByTier(a: { tier?: string }, b: { tier?: string }): number {
  return (TIER_RANK[b.tier ?? ""] ?? 0) - (TIER_RANK[a.tier ?? ""] ?? 0);
}

// Weapons carry their element in defaultDamageType; subclasses leave it 0 and use talentGrid.hudDamageType.
function elementOf(item: RawItem): string | undefined {
  return (
    DAMAGE_TYPE[item.defaultDamageType ?? 0] ??
    DAMAGE_TYPE[item.talentGrid?.hudDamageType ?? 0] ??
    (item.displayProperties?.name?.includes("Prismatic") ? "Prismatic" : undefined)
  );
}

interface ArtifactPerkDefinition {
  displayProperties?: { name?: string; description?: string };
  perks?: { perkHash: number }[];
}

let nameIndexPromise: Promise<
  Map<string, { hash: number; tier?: string; collectibleHash?: number }[]>
> | null = null;

// Resolving a name to a hash means scanning the whole item table once; cache the index for
// the process lifetime. Names repeat across rarities and reissues, so keep every candidate.
async function buildNameIndex() {
  const index = new Map<string, { hash: number; tier?: string; collectibleHash?: number }[]>();

  for await (const { hash, def } of allDefinitions<RawItem>(ITEM_TABLE)) {
    const name = def.displayProperties?.name;

    if (!name) {
      continue;
    }

    const key = name.toLowerCase();
    const candidates = index.get(key) ?? [];

    candidates.push({
      hash,
      tier: def.inventory?.tierTypeName,
      collectibleHash: def.collectibleHash,
    });
    index.set(key, candidates);
  }

  return index;
}

interface Categorizable {
  itemType?: number;
  type?: string;
}

// Universal/transmog ornaments carry no dedicated category hash (just the generic Mods category), so
// the item type display name ("Weapon Ornament", "Hunter Universal Ornament", …) is the reliable signal.
const isOrnament = (item: Categorizable) => Boolean(item.type?.includes("Ornament"));

// The specific category an item belongs to (never "cosmetic" — that is a query umbrella, not a thing an
// item is). Weapon/armor key off the numeric DestinyItemType; the cosmetic kinds off the type name.
export function categoryOf(item: Categorizable): ItemCategory | undefined {
  if (item.itemType === 3) {
    return "weapon";
  }

  if (item.itemType === 2) {
    return "armor";
  }

  if (item.type === "Shader") {
    return "shader";
  }

  if (item.type === "Emblem") {
    return "emblem";
  }

  if (isOrnament(item)) {
    return "ornament";
  }

  // Weapon/armor perks, enhanced perks, origin traits, and intrinsic frames are all plug items whose
  // type name carries "Trait" or "Intrinsic" — the reliable signal, since they share itemType 19 with
  // shaders, emotes, and mods. Excludes the noisier "…Perk" kinds (artifact/clan/seasonal/deprecated).
  if (item.type && (item.type.includes("Trait") || item.type.includes("Intrinsic"))) {
    return "perk";
  }

  return undefined;
}

// Whether a resolved category satisfies a requested filter category, expanding the "cosmetic" umbrella
// to its member kinds. The single source of truth for that umbrella, so the two tools can't diverge.
export function categoryInGroup(
  category: ItemCategory | undefined,
  requested: ItemCategory,
): boolean {
  if (requested === "cosmetic") {
    return category === "shader" || category === "emblem" || category === "ornament";
  }

  return category === requested;
}

export function inCategoryGroup(item: Categorizable, requested: ItemCategory): boolean {
  return categoryInGroup(categoryOf(item), requested);
}

let catalogPromise: Promise<CatalogEntry[]> | null = null;

onManifestSwap(() => {
  nameIndexPromise = null;
  catalogPromise = null;
});

// Searching by attribute means scanning the whole item table once; cache the catalog for the
// process lifetime, mirroring the name index. Skip rows without a display name (dummies, redacted).
async function buildCatalog(): Promise<CatalogEntry[]> {
  const catalog: CatalogEntry[] = [];

  for await (const { hash, def } of allDefinitions<RawItem>(ITEM_TABLE)) {
    const name = def.displayProperties?.name;

    if (!name) {
      continue;
    }

    catalog.push({
      hash,
      name,
      tier: def.inventory?.tierTypeName,
      type: def.itemTypeDisplayName || undefined,
      element: elementOf(def),
      slot: slotFromBucketHash(def.inventory?.bucketTypeHash),
      ammoType: ammoTypeLabel(def.equippingBlock?.ammoType),
      classType: classTypeLabel(def.classType),
      itemType: def.itemType,
      collectibleHash: def.collectibleHash,
      setHash: def.equippingBlock?.equipableItemSetHash || undefined,
      index: def.index,
    });
  }

  return catalog;
}

// Set membership is a definition-level attribute (a hash on the piece), but the human-readable set
// name lives on a separate definition. Resolve every distinct set in the catalog once so search can
// filter and project by set name without a per-item lookup.
async function setNamesByHash(catalog: CatalogEntry[]): Promise<Map<number, string>> {
  const hashes = [
    ...new Set(catalog.map((entry) => entry.setHash).filter((h): h is number => !!h)),
  ];
  const names = new Map<number, string>();

  await Promise.all(
    hashes.map(async (hash) => {
      const name = await itemSetName(hash);

      if (name) {
        names.set(hash, name);
      }
    }),
  );

  return names;
}

// Names repeat across reissues; keep the copy with a Collections source so its hash chains into
// how_to_acquire, but carry the newest index across all copies so a "newest" sort reflects the latest
// reissue, not whichever copy happens to hold the collectible. Entries are cloned before any mutation —
// the catalog they come from is cached for the process lifetime and must not be touched.
function dedupeByName(entries: CatalogEntry[]): CatalogEntry[] {
  const byName = new Map<string, CatalogEntry>();

  for (const entry of entries) {
    const existing = byName.get(entry.name);

    if (!existing) {
      byName.set(entry.name, { ...entry });
      continue;
    }

    const newestIndex = Math.max(existing.index ?? 0, entry.index ?? 0);

    if (!existing.collectibleHash && entry.collectibleHash) {
      byName.set(entry.name, { ...entry, index: newestIndex });
    } else {
      existing.index = newestIndex;
    }
  }

  return [...byName.values()];
}
