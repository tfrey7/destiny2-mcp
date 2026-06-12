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
  ItemStats: 304,
  ItemSockets: 305,
  ItemReusablePlugs: 310,
  Collectibles: 800,
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

export interface Membership {
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

interface ItemBucket {
  items: DestinyItem[];
}

export interface ArtifactPerk {
  itemHash: number;
  isActive: boolean;
  isVisible?: boolean;
}

export interface ArtifactTier {
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

export interface ItemInstance {
  primaryStat?: { value: number };
  damageType?: number;
  energy?: { energyCapacity?: number };
}

export interface ItemSocket {
  plugHash?: number;
  isEnabled?: boolean;
  isVisible?: boolean;
}

export interface ReusablePlug {
  plugItemHash: number;
  canInsert?: boolean;
  enabled?: boolean;
}

interface PlugSets {
  data?: { plugs?: Record<string, ReusablePlug[]> };
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
  itemComponents?: {
    instances?: { data?: Record<string, ItemInstance> };
    stats?: { data?: Record<string, { stats?: Record<string, { value?: number }> }> };
    sockets?: { data?: Record<string, { sockets?: ItemSocket[] }> };
    reusablePlugs?: { data?: Record<string, { plugs?: Record<string, ReusablePlug[]> }> };
  };
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
