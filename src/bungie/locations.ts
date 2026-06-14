import { allDefinitions, getDefinition } from "./manifest_db.js";

// The navigable worlds a Triumph can concern. Names are player-facing; aliases cover the
// presentation-node label, the manifest place/destination spellings, and colloquial terms a caller
// might pass as a filter. The set is curated rather than scraped because the manifest's place table
// is noisy (orbits, playlists, "Unknown Space") — but every entry is checked against the manifest by
// validateWorlds(), so the vocabulary stays grounded in real destinations.
export interface World {
  name: string;
  aliases: string[];
}

export const CANONICAL_WORLDS: World[] = [
  { name: "The Moon", aliases: ["moon", "luna"] },
  { name: "Europa", aliases: ["rathmore chaos"] },
  { name: "Neomuna", aliases: ["neptune"] },
  { name: "The Dreaming City", aliases: ["dreaming city"] },
  {
    name: "Savathûn's Throne World",
    aliases: ["throne world", "savathun's throne world", "savathun"],
  },
  { name: "The Pale Heart", aliases: ["pale heart"] },
  { name: "Nessus", aliases: ["arcadian valley"] },
  { name: "The Cosmodrome", aliases: ["cosmodrome"] },
  { name: "The European Dead Zone", aliases: ["european dead zone", "edz"] },
  { name: "Kepler", aliases: [] },
  { name: "The Last City", aliases: ["last city", "tower"] },
  { name: "Mars", aliases: ["hellas basin"] },
  { name: "Io", aliases: [] },
  { name: "Titan", aliases: ["new pacific arcology"] },
  { name: "Mercury", aliases: [] },
  { name: "Venus", aliases: ["ishtar sink"] },
  { name: "The Tangled Shore", aliases: ["tangled shore"] },
  { name: "The Leviathan", aliases: ["leviathan", "derelict leviathan"] },
  { name: "Prison of Elders", aliases: [] },
  { name: "Dreadnaught", aliases: [] },
  { name: "The Reckoning", aliases: ["reckoning"] },
  { name: "The Menagerie", aliases: ["menagerie"] },
];

// The activity kinds a Triumph can be scoped to, with the aliases that show up as presentation-node
// labels and activity-type names in the manifest. Matched the same way as worlds.
export interface ActivityType {
  name: string;
  aliases: string[];
}

export const CANONICAL_ACTIVITY_TYPES: ActivityType[] = [
  { name: "Raid", aliases: ["raids"] },
  { name: "Dungeon", aliases: ["dungeons"] },
  { name: "Strike", aliases: ["strikes", "vanguard", "vanguard ops", "nightfall", "vanguard op"] },
  { name: "Crucible", aliases: ["pvp", "competitive", "control", "clash", "rumble", "survival"] },
  { name: "Gambit", aliases: ["gambit prime"] },
  { name: "Trials of Osiris", aliases: ["trials", "osiris"] },
  { name: "Iron Banner", aliases: [] },
  { name: "Lost Sector", aliases: ["lost sectors"] },
  { name: "Exotic Mission", aliases: ["exotic missions"] },
  { name: "Onslaught", aliases: [] },
  { name: "Story", aliases: ["mission", "missions", "campaign"] },
  { name: "Patrol", aliases: ["exploration", "patrols", "free roam"] },
];

// Normalize a term (a filter argument or a presentation-node label) to a canonical world, or
// undefined when nothing matches. Matching is whole-word: a short name like "Io" must appear as its
// own token, never as the "io" buried in "champions" or "precision" — substring matching on names
// this short produces a flood of false positives.
export function matchWorld(term: string): string | undefined {
  return matchVocabulary(term, CANONICAL_WORLDS);
}

export function matchActivityType(term: string): string | undefined {
  return matchVocabulary(term, CANONICAL_ACTIVITY_TYPES);
}

// The world an activity takes place on, resolved through the manifest's
// activity → destination → place chain (with the activity's own placeHash as a fallback) and mapped
// onto the canonical vocabulary. Returns undefined for orbit/playlist activities with no real world.
export async function activityWorld(activityHash: number): Promise<string | undefined> {
  const activity = await getDefinition<RawActivity>("DestinyActivityDefinition", activityHash);

  return worldFromActivity(activity);
}

// A lowercased activity-name → canonical-world map, built once from the whole activity catalog. The
// index build joins raid/dungeon Triumphs to a world by their activity name, which the presentation
// tree alone doesn't always carry.
export async function activityWorldByName(): Promise<Map<string, string>> {
  const index = new Map<string, string>();

  for await (const { def } of allDefinitions<RawActivity>("DestinyActivityDefinition")) {
    if (def.redacted) {
      continue;
    }

    const name = def.displayProperties?.name;
    const world = await worldFromActivity(def);

    if (name && world) {
      index.set(normalize(name), world);
    }
  }

  return index;
}

// Confirm every canonical world (or one of its aliases) names a real manifest place or destination,
// so the vocabulary can't drift away from what the game actually ships. Returns the worlds that
// resolved to nothing; the index build logs them as a warning.
export async function validateWorlds(): Promise<string[]> {
  const known = new Set<string>();

  for await (const { def } of allDefinitions<RawPlaced>("DestinyPlaceDefinition")) {
    const name = def.displayProperties?.name;

    if (name) {
      known.add(normalize(name));
    }
  }

  for await (const { def } of allDefinitions<RawPlaced>("DestinyDestinationDefinition")) {
    const name = def.displayProperties?.name;

    if (name) {
      known.add(normalize(name));
    }
  }

  return CANONICAL_WORLDS.filter((world) => {
    const terms = [normalize(world.name), ...world.aliases];

    return !terms.some((term) => [...known].some((entry) => entry.includes(term)));
  }).map((world) => world.name);
}

interface RawActivity {
  displayProperties?: { name?: string };
  destinationHash?: number;
  placeHash?: number;
  redacted?: boolean;
}

interface RawPlaced {
  displayProperties?: { name?: string };
  placeHash?: number;
}

async function worldFromActivity(activity: RawActivity): Promise<string | undefined> {
  if (activity.destinationHash) {
    const destination = await getDefinition<RawPlaced>(
      "DestinyDestinationDefinition",
      activity.destinationHash,
    );
    const fromDestination = destination.displayProperties?.name
      ? matchWorld(destination.displayProperties.name)
      : undefined;

    if (fromDestination) {
      return fromDestination;
    }

    if (destination.placeHash) {
      const fromPlace = await worldFromPlace(destination.placeHash);

      if (fromPlace) {
        return fromPlace;
      }
    }
  }

  return activity.placeHash ? worldFromPlace(activity.placeHash) : undefined;
}

async function worldFromPlace(placeHash: number): Promise<string | undefined> {
  const place = await getDefinition<RawPlaced>("DestinyPlaceDefinition", placeHash);

  return place.displayProperties?.name ? matchWorld(place.displayProperties.name) : undefined;
}

function matchVocabulary(
  term: string,
  vocabulary: { name: string; aliases: string[] }[],
): string | undefined {
  const text = normalize(term);

  if (!text) {
    return undefined;
  }

  for (const entry of vocabulary) {
    if (normalize(entry.name) === text || entry.aliases.includes(text)) {
      return entry.name;
    }
  }

  for (const entry of vocabulary) {
    if ([normalize(entry.name), ...entry.aliases].some((token) => containsWord(text, token))) {
      return entry.name;
    }
  }

  return undefined;
}

function containsWord(text: string, token: string): boolean {
  return new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(token)}(?![\\p{L}\\p{N}])`, "u").test(text);
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalize(text: string): string {
  return text.toLowerCase().trim();
}
