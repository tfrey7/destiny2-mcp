import { bungieFetch } from "./client.js";

export const Component = {
  ProfileInventories: 102,
  Characters: 200,
  CharacterInventories: 201,
  CharacterEquipment: 205,
  CharacterLoadouts: 206,
  ItemInstances: 300,
} as const;

export const ClassType: Record<number, string> = {
  0: "Titan",
  1: "Hunter",
  2: "Warlock",
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

export interface ProfileResponse {
  characters?: { data?: Record<string, DestinyCharacter> };
  characterEquipment?: { data?: Record<string, ItemBucket> };
  characterInventories?: { data?: Record<string, ItemBucket> };
  characterLoadouts?: { data?: Record<string, { loadouts: DestinyLoadout[] }> };
  profileInventory?: { data?: ItemBucket };
  itemComponents?: { instances?: { data?: Record<string, { primaryStat?: { value: number } }> } };
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
  if (cachedMembership) return cachedMembership;

  const data = await bungieFetch<MembershipsResponse>("/User/GetMembershipsForCurrentUser/");
  const memberships = data.destinyMemberships;

  let chosen = memberships.find((m) => m.membershipId === data.primaryMembershipId);
  if (!chosen) chosen = memberships.find((m) => m.crossSaveOverride === m.membershipType);
  if (!chosen) chosen = memberships[0];
  if (!chosen) throw new Error("[destiny2-mcp] No Destiny membership found on this account.");

  cachedMembership = { membershipType: chosen.membershipType, destinyMembershipId: chosen.membershipId };
  return cachedMembership;
}

export async function getProfile(components: number[]): Promise<ProfileResponse> {
  const { membershipType, destinyMembershipId } = await getPrimaryMembership();
  const query = components.join(",");
  return bungieFetch<ProfileResponse>(
    `/Destiny2/${membershipType}/Profile/${destinyMembershipId}/?components=${query}`,
  );
}
