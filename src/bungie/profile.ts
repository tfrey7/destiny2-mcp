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

export interface ProfileResponse {
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

export async function getProfile(components: number[]): Promise<ProfileResponse> {
  const { membershipType, destinyMembershipId } = await getPrimaryMembership();
  const query = components.join(",");

  return bungieFetch<ProfileResponse>(
    `/Destiny2/${membershipType}/Profile/${destinyMembershipId}/?components=${query}`,
  );
}

interface ItemBucket {
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
