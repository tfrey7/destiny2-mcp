import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { BuildRecipe, DimLoadout } from "../src/tools/builds/recipes.js";

const BUILDERS = "https://builders.gg/destiny/dim-builds";
const DIM_API = "https://api.destinyitemmanager.com/loadout_share";
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const SUBCLASSES = ["Prismatic", "Solar", "Arc", "Void", "Stasis", "Strand"];

const OUT_FILE = join(dirname(fileURLToPath(import.meta.url)), "..", "data", "builds.json");

interface Card {
  shareId: string;
  slug: string;
  subclass: string;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function listUrl(className: string, popular: boolean, page: number): string {
  const params = new URLSearchParams({
    "q[dclass]": className,
    "q[view]": "by_build",
    page: String(page),
  });

  params.set("q[sort]", popular ? "likes" : "date_added");
  if (popular) {
    params.set("q[top]", "true");
  }
  return `${BUILDERS}?${params}`;
}

async function fetchPage(url: string): Promise<string> {
  const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });

  if (!response.ok) {
    throw new Error(`[destiny2-mcp] builders.gg returned ${response.status} for ${url}`);
  }
  return response.text();
}

function parseCards(html: string, className: string): Card[] {
  const label = new RegExp(`\\b(${SUBCLASSES.join("|")}) ${className}\\b`);
  const cards: Card[] = [];
  const seen = new Set<string>();

  for (const match of html.matchAll(/href="\/destiny\/dim-builds\/([a-z0-9]+)\/([a-z0-9-]+)"/g)) {
    const [, shareId, slug] = match;

    if (seen.has(shareId)) {
      continue;
    }
    seen.add(shareId);

    const window = html.slice(match.index, match.index + 600).replace(/<[^>]+>/g, " ");
    const subclass = window.match(label)?.[1] ?? "Unknown";

    cards.push({ shareId, slug, subclass });
  }

  return cards;
}

async function fetchLoadout(shareId: string): Promise<DimLoadout | null> {
  const response = await fetch(`${DIM_API}?shareId=${shareId}`, {
    headers: { "User-Agent": USER_AGENT },
  });

  if (!response.ok) {
    console.warn(`[destiny2-mcp]   ! DIM API ${response.status} for ${shareId}, skipping`);
    return null;
  }
  const data = (await response.json()) as { loadout?: DimLoadout };

  return data.loadout ?? null;
}

async function collectCards(className: string, popular: boolean, limit: number): Promise<Card[]> {
  const cards: Card[] = [];
  const seen = new Set<string>();

  for (let page = 1; cards.length < limit && page <= 10; page++) {
    const pageCards = parseCards(
      await fetchPage(listUrl(className, popular, page)),
      capitalize(className),
    );
    const fresh = pageCards.filter((card) => !seen.has(card.shareId));

    if (fresh.length === 0) {
      break;
    }

    for (const card of fresh) {
      seen.add(card.shareId);
      cards.push(card);
    }
  }

  return cards.slice(0, limit);
}

async function main(): Promise<void> {
  const className = (process.argv[2] ?? "warlock").toLowerCase();
  const limit = Number(process.argv[3] ?? 10);
  const popular = process.argv[4] === "popular";

  console.log(`[destiny2-mcp] Collecting ${className} builds from builders.gg…`);
  const cards = await collectCards(className, popular, limit);

  console.log(`[destiny2-mcp] Found ${cards.length} builds. Resolving DIM loadouts…`);

  const builds: BuildRecipe[] = [];

  for (const card of cards) {
    const loadout = await fetchLoadout(card.shareId);

    if (!loadout) {
      continue;
    }
    console.log(`[destiny2-mcp]   ✓ ${loadout.name} (${card.subclass} ${capitalize(className)})`);
    builds.push({
      shareId: card.shareId,
      dimLink: `https://dim.gg/${card.shareId}`,
      source: "builders.gg",
      className: capitalize(className),
      subclass: card.subclass,
      slug: card.slug,
      loadout,
    });
  }

  await mkdir(dirname(OUT_FILE), { recursive: true });
  const payload = { source: "builders.gg + dim.gg", scrapedAt: new Date().toISOString(), builds };

  await writeFile(OUT_FILE, JSON.stringify(payload, null, 2));
  console.log(`[destiny2-mcp] Wrote ${builds.length} builds to ${OUT_FILE}`);
}

await main();
