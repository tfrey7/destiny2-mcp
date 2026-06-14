import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderTriumphTemplate, triumphCardModel } from "../../src/format/triumphs/index.js";
import type { TriumphSuggestion } from "../../src/bungie/progression.js";

// Renders the Triumph grid in a normal browser, without Claude Desktop, the manifest, or auth. It
// embeds the REAL ui:// template and a tiny host shim that performs the actual MCP-Apps handshake
// (answer ui/initialize → push ui/notifications/tool-result), then feeds it hand-authored sample
// suggestions reduced through the REAL triumphCardModel. Icons resolve from the live Bungie CDN
// (a browser, unlike Desktop's sandbox, can load remote hosts), so the structuredContent ships no
// data: URIs. Run: `npx tsx scripts/triumphs/preview.ts` — it writes and opens an HTML file.

const ROOT = dirname(fileURLToPath(import.meta.url));
const OUT_FILE = join(ROOT, "..", "..", "release", "triumphs-preview.html");

// Sample suggestions spanning the states the card must handle: near-complete, mid-progress,
// not-started, multi-objective, seal-feeding, and expiring. Icon paths are real manifest paths so
// the CDN serves actual Triumph art in the browser.
const SAMPLE: TriumphSuggestion[] = [
  {
    recordHash: 1,
    name: "The Hollowed Lair",
    description: "Complete the Hollowed Lair strike.",
    state: "in_progress",
    percent: 63,
    score: 50,
    location: ["The Moon"],
    activityType: "strike",
    effort: "quick",
    objectives: [{ description: "Enemies defeated", progress: 145, total: 230, complete: false }],
    rewards: [],
    why: ["63% complete", "quick effort", "50 Triumph points"],
  },
  {
    recordHash: 2,
    name: "Flawless Master",
    description:
      "Complete a flawless run of any dungeon without any member of your fireteam dying.",
    state: "in_progress",
    percent: 90,
    score: 100,
    seal: "Discerning Taste",
    activityType: "dungeon",
    scope: "fireteam",
    effort: "grind",
    objectives: [{ description: "Flawless dungeons", progress: 9, total: 10, complete: false }],
    rewards: ["Emblem"],
    why: ["90% complete", "feeds the Discerning Taste title (78% earned)", "grind effort"],
  },
  {
    recordHash: 3,
    name: "Eyes on the Moon",
    description: "Defeat combatants and complete activities across the Moon to grow your power.",
    state: "in_progress",
    percent: 41,
    score: 25,
    location: ["The Moon"],
    objectives: [
      { description: "Combatants defeated", progress: 412, total: 1000, complete: false },
      { description: "Public events completed", progress: 6, total: 10, complete: false },
    ],
    rewards: [],
    why: ["41% complete", "25 Triumph points"],
  },
  {
    recordHash: 4,
    name: "Vox Obscura",
    description: "Complete the exotic mission 'Vox Obscura'.",
    state: "not_started",
    percent: 0,
    score: 30,
    location: ["EDZ"],
    activityType: "exotic mission",
    objectives: [{ description: "Mission complete", progress: 0, total: 1, complete: false }],
    rewards: ["Dead Messenger"],
    why: ["30 Triumph points"],
  },
  {
    recordHash: 5,
    name: "Last Wish: Conqueror",
    description: "Defeat Riven of a Thousand Voices, the final boss of the Last Wish raid.",
    state: "not_started",
    percent: 0,
    score: 100,
    seal: "Rivensbane",
    location: ["Dreaming City"],
    activityType: "raid",
    scope: "fireteam",
    effort: "grind",
    objectives: [{ description: "Riven defeated", progress: 0, total: 1, complete: false }],
    rewards: ["Tysonics"],
    why: ["feeds the Rivensbane title (12% earned)", "grind effort", "100 Triumph points"],
  },
  {
    recordHash: 6,
    name: "Seasonal Challenge: Vanguard",
    description: "Complete Vanguard playlist activities and earn rank-up packages this season.",
    state: "in_progress",
    percent: 78,
    score: 12,
    activityType: "vanguard",
    expires: "expires this season",
    objectives: [{ description: "Vanguard activities", progress: 7, total: 9, complete: false }],
    rewards: ["Bright Dust"],
    why: ["78% complete", "expires this season", "12 Triumph points"],
  },
];

const ICON: Record<number, string> = {
  1: "/common/destiny2_content/icons/597efc5fa6965b4d4ce448737dc28f62.png",
  2: "/common/destiny2_content/icons/0e096fc6af03d3692950c8bf6e015b67.png",
  3: "/common/destiny2_content/icons/1406f929d0c25506a5ab5ea73956fcb3.png",
  4: "/common/destiny2_content/icons/df6141550b275c1f4d6b0d44d07cabf4.jpg",
  5: "/common/destiny2_content/icons/267fd51cdf75c4b6fa8528e1aff8100c.png",
  6: "/common/destiny2_content/icons/df61a7b3a257523281256c5b43cd6936.jpg",
};

// Reward items keyed by recordHash, resolved to name + a real CDN icon path — the shape the tool's
// recordRewards produces. The grid renders each with its icon in the hover panel.
const REWARDS: Record<number, { name: string; icon?: string }[]> = {
  2: [
    {
      name: "Terror's End",
      icon: "/common/destiny2_content/icons/2f78f7e4300af9f3106ab752d1131f35.jpg",
    },
  ],
  4: [
    {
      name: "Dead Messenger",
      icon: "/common/destiny2_content/icons/0824b34bb37e0bb7c32b91adf6dcb79e.jpg",
    },
  ],
  5: [
    {
      name: "Tysonics",
      icon: "/common/destiny2_content/icons/df6141550b275c1f4d6b0d44d07cabf4.jpg",
    },
  ],
  6: [
    {
      name: "Bright Dust",
      icon: "/common/destiny2_content/icons/412a7bde9758cbf20f6d0fbe91aa4340.jpg",
    },
  ],
};

const model = triumphCardModel({
  title: "Triumphs to Chase",
  subtitle: `${SAMPLE.length} ranked · sample data`,
  suggestions: SAMPLE,
  icons: ICON,
  rewards: REWARDS,
});

// The host pushes icons as a path→URL map (the iframe inlines them as data: URIs in Desktop; here
// the bare CDN paths resolve to absolute Bungie URLs the browser can fetch directly).
const icons: Record<string, string> = {};

for (const path of Object.values(ICON)) {
  icons[path] = `https://www.bungie.net${path}`;
}

const structuredContent = { ...model, icons };

// Inject a value into the page's <script> safely: the template HTML contains its own `</script>`,
// which would close the outer tag early, so escape every `<` as a JSON < escape.
function forScript(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

// The outer page is the MCP host stand-in: it loads the real template into an iframe via srcdoc
// (JSON-injected to dodge attribute escaping), completes the handshake the iframe initiates, and
// pushes the tool result — the same message flow Claude Desktop runs.
const harness = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Triumph card preview</title>
<style>
  body { margin: 0; background: #0a0b0e; }
  iframe { width: 100%; border: 0; display: block; }
</style>
</head>
<body>
<iframe id="frame"></iframe>
<script>
  var TEMPLATE = ${forScript(renderTriumphTemplate())};
  var DATA = ${forScript(structuredContent)};
  var frame = document.getElementById("frame");
  window.addEventListener("message", function (e) {
    var m = e.data;
    if (!m || typeof m !== "object") return;
    var win = frame.contentWindow;
    if (m.method === "ui/initialize") {
      win.postMessage({ jsonrpc: "2.0", id: m.id, result: {} }, "*");
    } else if (m.method === "ui/notifications/initialized") {
      win.postMessage({ jsonrpc: "2.0", method: "ui/notifications/tool-result", params: { structuredContent: DATA } }, "*");
    } else if (m.method === "ui/notifications/size-changed") {
      frame.style.height = (m.params.height + 6) + "px";
    }
  });
  frame.srcdoc = TEMPLATE;
</script>
</body>
</html>`;

await mkdir(dirname(OUT_FILE), { recursive: true });
await writeFile(OUT_FILE, harness);
console.log(`Wrote ${OUT_FILE}`);
