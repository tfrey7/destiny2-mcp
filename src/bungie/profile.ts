import type { ClassName, Element } from "../schemas.js";
import { bungieFetch } from "./client.js";

export const Component = {
  ProfileInventories: 102,
  Characters: 200,
  CharacterInventories: 201,
  CharacterProgressions: 202,
  CharacterEquipment: 205,
  CharacterLoadouts: 206,
  ItemInstances: 300,
  ItemObjectives: 301,
  ItemStats: 304,
  ItemSockets: 305,
  ItemReusablePlugs: 310,
  PresentationNodes: 700,
  Collectibles: 800,
  Records: 900,
} as const;

export const ClassType: Record<number, ClassName> = {
  0: "Titan",
  1: "Hunter",
  2: "Warlock",
};

export const DamageType: Record<number, Element> = {
  1: "Kinetic",
  2: "Arc",
  3: "Solar",
  4: "Void",
  6: "Stasis",
  7: "Strand",
};

interface Membership {
  membershipType: number;
  destinyMembershipId: string;
}

export interface DestinyItem {
  itemHash: number;
  itemInstanceId?: string;
  quantity: number;
  bucketHash: number;
}

export interface DestinyCharacter {
  characterId: string;
  classType: number;
  light: number;
  dateLastPlayed: string;
}

export interface DestinyLoadout {
  colorHash: number;
  iconHash: number;
  nameHash: number;
  items: { itemInstanceId: string; plugItemHashes: number[] }[];
}

interface ArtifactPerk {
  itemHash: number;
  isActive: boolean;
  isVisible?: boolean;
}

interface ArtifactTier {
  tierHash: number;
  isUnlocked: boolean;
  pointsToUnlock: number;
  items: ArtifactPerk[];
}

export interface SeasonalArtifact {
  artifactHash: number;
  pointsUsed: number;
  resetCount: number;
  tiers: ArtifactTier[];
}

interface ItemInstance {
  primaryStat?: { value: number };
  damageType?: number;
  energy?: { energyCapacity?: number };
}

interface ItemSocket {
  plugHash?: number;
  isEnabled?: boolean;
  isVisible?: boolean;
}

// Per-objective live progress, shared by records (component 900), presentation nodes (700), and
// instanced item objectives (301). `complete` and `progress`/`completionValue` are authoritative;
// the objective's human label comes from DestinyObjectiveDefinition, not this payload.
export interface ObjectiveProgress {
  objectiveHash: number;
  progress?: number;
  completionValue?: number;
  complete?: boolean;
  visible?: boolean;
}

// A Triumph's live state: a DestinyRecordState bitmask plus its objectives' progress.
export interface RecordComponentState {
  state: number;
  objectives?: ObjectiveProgress[];
  intervalsRedeemedCount?: number;
  // How many times a repeatable record has been completed — the gilding count for a seal's
  // gilding-tracking record (how many seasons a gildable title has been re-earned).
  completedCount?: number;
}

// A records component, whether account-wide (profileRecords) or per-character (characterRecords).
// The account-wide copy also carries the running Triumph score and the root nodes of the seal and
// category trees.
export interface RecordsComponent {
  records?: Record<string, RecordComponentState>;
  score?: number;
  activeScore?: number;
  legacyScore?: number;
  lifetimeScore?: number;
  recordCategoriesRootNodeHash?: number;
  recordSealsRootNodeHash?: number;
}

// A presentation node's live rollup: how many of its leaves are complete (progressValue /
// completionValue), and an optional gating objective when the node tracks one.
export interface PresentationNodeState {
  state: number;
  objective?: ObjectiveProgress;
  progressValue?: number;
  completionValue?: number;
}

export interface ReusablePlug {
  plugItemHash: number;
  canInsert?: boolean;
  enabled?: boolean;
}

// The raw Bungie profile envelope: every component is optional (present only if requested) and wraps
// its payload in a `{ data }` shell. This is internal — `getProfile` unwraps it into the narrow,
// required shape `ProfileFor<C>` so call sites never touch `?.data ?? {}`.
interface RawProfile {
  characters?: { data?: Record<string, DestinyCharacter> };
  characterEquipment?: { data?: Record<string, ItemBucket> };
  characterInventories?: { data?: Record<string, ItemBucket> };
  characterLoadouts?: { data?: Record<string, { loadouts: DestinyLoadout[] }> };
  characterProgressions?: { data?: Record<string, { seasonalArtifact?: SeasonalArtifact }> };
  profileInventory?: { data?: ItemBucket };
  profileCollectibles?: { data?: { collectibles?: Record<string, { state: number }> } };
  characterCollectibles?: {
    data?: Record<string, { collectibles?: Record<string, { state: number }> }>;
  };
  profilePlugSets?: PlugSets;
  characterPlugSets?: { data?: Record<string, { plugs?: Record<string, ReusablePlug[]> }> };
  profileRecords?: { data?: RecordsComponent };
  characterRecords?: { data?: Record<string, RecordsComponent> };
  profilePresentationNodes?: { data?: { nodes?: Record<string, PresentationNodeState> } };
  characterPresentationNodes?: {
    data?: Record<string, { nodes?: Record<string, PresentationNodeState> }>;
  };
  itemComponents?: {
    instances?: { data?: Record<string, ItemInstance> };
    stats?: { data?: Record<string, { stats?: Record<string, { value?: number }> }> };
    sockets?: { data?: Record<string, { sockets?: ItemSocket[] }> };
    reusablePlugs?: { data?: Record<string, { plugs?: Record<string, ReusablePlug[]> }> };
    objectives?: { data?: Record<string, { objectives?: ObjectiveProgress[] }> };
  };
}

export async function getPrimaryMembership(): Promise<Membership> {
  if (cachedMembership) {
    return cachedMembership;
  }

  const data = await bungieFetch<MembershipsResponse>("/User/GetMembershipsForCurrentUser/");
  const memberships = data.destinyMemberships;

  let chosen = memberships.find((m) => m.membershipId === data.primaryMembershipId);

  if (!chosen) {
    chosen = memberships.find((m) => m.crossSaveOverride === m.membershipType);
  }

  if (!chosen) {
    chosen = memberships[0];
  }

  if (!chosen) {
    throw new Error("[destiny2-mcp] No Destiny membership found on this account.");
  }

  cachedMembership = {
    membershipType: chosen.membershipType,
    destinyMembershipId: chosen.membershipId,
  };
  return cachedMembership;
}

// The valid component values, derived from `Component` so a typo'd or made-up number can't be passed.
export type ComponentValue = (typeof Component)[keyof typeof Component];

// Maps each requested component to the field(s) it populates, already unwrapped (no `{ data }` shell)
// and required. Multi-field components (Records/PresentationNodes/Collectibles) list both their
// profile- and character-level fields; ItemSockets also carries the account-wide plug sets, which
// ride along with component 305. The item components flatten out of the `itemComponents` wrapper to
// top-level `itemInstances` / `itemStats` / `itemSockets` / `itemReusablePlugs` / `itemObjectives`.
interface ProfileComponentData {
  [Component.ProfileInventories]: { profileInventory: ItemBucket };
  [Component.Characters]: { characters: Record<string, DestinyCharacter> };
  [Component.CharacterInventories]: { characterInventories: Record<string, ItemBucket> };
  [Component.CharacterEquipment]: { characterEquipment: Record<string, ItemBucket> };
  [Component.CharacterLoadouts]: {
    characterLoadouts: Record<string, { loadouts: DestinyLoadout[] }>;
  };
  [Component.CharacterProgressions]: {
    characterProgressions: Record<string, { seasonalArtifact?: SeasonalArtifact }>;
  };
  [Component.ItemInstances]: { itemInstances: Record<string, ItemInstance> };
  [Component.ItemObjectives]: {
    itemObjectives: Record<string, { objectives?: ObjectiveProgress[] }>;
  };
  [Component.ItemStats]: {
    itemStats: Record<string, { stats?: Record<string, { value?: number }> }>;
  };
  [Component.ItemSockets]: {
    itemSockets: Record<string, { sockets?: ItemSocket[] }>;
    profilePlugSets: { plugs?: Record<string, ReusablePlug[]> };
    characterPlugSets: Record<string, { plugs?: Record<string, ReusablePlug[]> }>;
  };
  [Component.ItemReusablePlugs]: {
    itemReusablePlugs: Record<string, { plugs?: Record<string, ReusablePlug[]> }>;
  };
  [Component.PresentationNodes]: {
    profilePresentationNodes: { nodes?: Record<string, PresentationNodeState> };
    characterPresentationNodes: Record<string, { nodes?: Record<string, PresentationNodeState> }>;
  };
  [Component.Collectibles]: {
    profileCollectibles: { collectibles?: Record<string, { state: number }> };
    characterCollectibles: Record<string, { collectibles?: Record<string, { state: number }> }>;
  };
  [Component.Records]: {
    profileRecords: RecordsComponent;
    characterRecords: Record<string, RecordsComponent>;
  };
}

type UnionToIntersection<U> = (U extends unknown ? (k: U) => void : never) extends (
  k: infer I,
) => void
  ? I
  : never;

// The profile shape for a given component list: the union of each requested component's fields,
// intersected into one object. A read of a field whose component wasn't requested fails to compile.
export type ProfileFor<C extends readonly ComponentValue[]> = UnionToIntersection<
  ProfileComponentData[C[number]]
>;

// Every field a profile can carry, all required. Helpers that take a profile slice type their
// parameter as a `Pick` of this, so any richer `ProfileFor<...>` result is assignable.
export type FullProfile = UnionToIntersection<ProfileComponentData[ComponentValue]>;

// One extractor per component: pull its payload out of the raw envelope, defaulting an absent
// component (Bungie can omit it — privacy, empty account) to an empty collection so the field stays
// present and non-optional. This is the one place the old per-call-site `?.data ?? {}` now lives.
const EXTRACTORS: Record<ComponentValue, (raw: RawProfile) => Record<string, unknown>> = {
  [Component.ProfileInventories]: (r) => ({
    profileInventory: r.profileInventory?.data ?? { items: [] },
  }),
  [Component.Characters]: (r) => ({ characters: r.characters?.data ?? {} }),
  [Component.CharacterInventories]: (r) => ({
    characterInventories: r.characterInventories?.data ?? {},
  }),
  [Component.CharacterEquipment]: (r) => ({ characterEquipment: r.characterEquipment?.data ?? {} }),
  [Component.CharacterLoadouts]: (r) => ({ characterLoadouts: r.characterLoadouts?.data ?? {} }),
  [Component.CharacterProgressions]: (r) => ({
    characterProgressions: r.characterProgressions?.data ?? {},
  }),
  [Component.ItemInstances]: (r) => ({ itemInstances: r.itemComponents?.instances?.data ?? {} }),
  [Component.ItemObjectives]: (r) => ({ itemObjectives: r.itemComponents?.objectives?.data ?? {} }),
  [Component.ItemStats]: (r) => ({ itemStats: r.itemComponents?.stats?.data ?? {} }),
  [Component.ItemSockets]: (r) => ({
    itemSockets: r.itemComponents?.sockets?.data ?? {},
    profilePlugSets: r.profilePlugSets?.data ?? {},
    characterPlugSets: r.characterPlugSets?.data ?? {},
  }),
  [Component.ItemReusablePlugs]: (r) => ({
    itemReusablePlugs: r.itemComponents?.reusablePlugs?.data ?? {},
  }),
  [Component.PresentationNodes]: (r) => ({
    profilePresentationNodes: r.profilePresentationNodes?.data ?? {},
    characterPresentationNodes: r.characterPresentationNodes?.data ?? {},
  }),
  [Component.Collectibles]: (r) => ({
    profileCollectibles: r.profileCollectibles?.data ?? {},
    characterCollectibles: r.characterCollectibles?.data ?? {},
  }),
  [Component.Records]: (r) => ({
    profileRecords: r.profileRecords?.data ?? {},
    characterRecords: r.characterRecords?.data ?? {},
  }),
};

// Fetch a profile and project it to exactly the components requested. The return type is computed
// from the component list, so each requested field is present and unwrapped, and reading a field that
// wasn't requested is a compile error. `const C` captures the literal component values without the
// caller writing `as const` on an inline array.
export async function getProfile<const C extends readonly ComponentValue[]>(
  components: C,
): Promise<ProfileFor<C>> {
  const { membershipType, destinyMembershipId } = await getPrimaryMembership();
  const query = components.join(",");

  const raw = await bungieFetch<RawProfile>(
    `/Destiny2/${membershipType}/Profile/${destinyMembershipId}/?components=${query}`,
  );

  const result: Record<string, unknown> = {};

  for (const component of components) {
    Object.assign(result, EXTRACTORS[component](raw));
  }

  return result as ProfileFor<C>;
}

// Named fetchers for the common shapes. Long-tail combinations call `getProfile([...])` directly —
// they're just as fully typed; these only spare the repeated component list at the popular call sites.

// Characters + all inventory buckets: the base for locating an item by instance and for ownership
// maps. Deliberately no item components, so the per-item payload stays small on transfer/equip paths.
export const getGearProfile = () =>
  getProfile([
    Component.Characters,
    Component.CharacterEquipment,
    Component.CharacterInventories,
    Component.ProfileInventories,
  ]);

// Worn gear plus its live sockets — scoped to equipped items only (no inventories), keeping the
// socket payload tiny.
export const getEquippedProfile = () =>
  getProfile([Component.Characters, Component.CharacterEquipment, Component.ItemSockets]);

export const getArtifactProfile = () => getProfile([Component.CharacterProgressions]);

export const getTriumphsProfile = () =>
  getProfile([Component.Records, Component.PresentationNodes]);

export type GearProfile = Awaited<ReturnType<typeof getGearProfile>>;
export type TriumphsProfile = Awaited<ReturnType<typeof getTriumphsProfile>>;

export interface ItemBucket {
  items: DestinyItem[];
}

interface PlugSets {
  data?: { plugs?: Record<string, ReusablePlug[]> };
}

interface MembershipsResponse {
  primaryMembershipId?: string;
  destinyMemberships: {
    membershipId: string;
    membershipType: number;
    crossSaveOverride: number;
  }[];
}

let cachedMembership: Membership | null = null;
