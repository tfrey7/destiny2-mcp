import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderTitlesTemplate, titleCardModel } from "../../src/format/titles/index.js";
import type { TitleView } from "../../src/bungie/progression.js";

// Renders the Titles (Seals) gallery in a normal browser, without Claude Desktop, the manifest, or
// auth. It embeds the REAL ui:// template and a tiny host shim that performs the actual MCP-Apps
// handshake (answer ui/initialize → push ui/notifications/tool-result), then feeds it hand-authored
// sample titles reduced through the REAL titleCardModel. Emblems resolve from the live Bungie CDN
// (a browser, unlike Desktop's sandbox, can load remote hosts), so the structuredContent ships no
// data: URIs. Run: `npm run preview:titles` — it writes and opens an HTML file.

const ROOT = dirname(fileURLToPath(import.meta.url));
const OUT_FILE = join(ROOT, "..", "..", "release", "titles-preview.html");

// Sample titles spanning every state the gallery must handle: earned + gilded, earned, gildable but
// unearned, deep in progress, just started, and untouched. Icon paths are real manifest paths so the
// CDN serves actual seal emblem art in the browser.
const SAMPLE: TitleView[] = [
  {
    sealHash: 1,
    name: "Iron Banner",
    title: "Iron Lord",
    requirement: "Complete all Iron Banner Triumphs.",
    complete: 4,
    total: 4,
    percent: 100,
    earned: true,
    gildable: true,
    gilded: 3,
    icon: "/common/destiny2_content/icons/e21661f666d3d5024e3cbeee563f115d.png",
    remaining: [],
  },
  {
    sealHash: 2,
    name: "30th Anniversary",
    title: "Vidmaster",
    requirement: "Complete all 30th Anniversary Triumphs.",
    complete: 10,
    total: 10,
    percent: 100,
    earned: true,
    gildable: false,
    gilded: 0,
    icon: "/common/destiny2_content/icons/e401b359dab97aab30aa9079ec1c6bfc.png",
    remaining: [],
  },
  {
    sealHash: 3,
    name: "Flamekeeper",
    title: "Flamekeeper",
    requirement: "Complete all Flamekeeper Triumphs.",
    complete: 8,
    total: 8,
    percent: 100,
    earned: true,
    gildable: false,
    gilded: 0,
    icon: "/common/destiny2_content/icons/c2618024dd4088be66b1e1dc5aaecab1.png",
    remaining: [],
  },
  {
    sealHash: 4,
    name: "Spire of the Watcher",
    title: "WANTED",
    requirement: "Complete all Spire of the Watcher Triumphs.",
    complete: 9,
    total: 10,
    percent: 90,
    earned: false,
    gildable: false,
    gilded: 0,
    icon: "/common/destiny2_content/icons/40874c5d1b92e82321e226d1681eb57e.png",
    remaining: [{ name: "Heartless", percent: 40 }],
  },
  {
    sealHash: 5,
    name: "Deadeye",
    title: "Deadeye",
    requirement: "Complete all Deadeye Triumphs.",
    complete: 20,
    total: 31,
    percent: 65,
    earned: false,
    gildable: false,
    gilded: 0,
    icon: "/common/destiny2_content/icons/4f6316116ec4c42f573e319bd8b44a09.png",
    remaining: [
      { name: "Precision Hand Cannon", percent: 80 },
      { name: "Sniper Rifle Mastery", percent: 55 },
      { name: "Trace Rifle Specialist", percent: 30 },
      { name: "Linear Fusion Marksman", percent: 12 },
      { name: "Bow Virtuoso", percent: 0 },
    ],
  },
  {
    sealHash: 6,
    name: "Last Wish",
    title: "Rivensbane",
    requirement: "Complete all Last Wish Triumphs.",
    complete: 7,
    total: 16,
    percent: 44,
    earned: false,
    gildable: false,
    gilded: 0,
    icon: "/common/destiny2_content/icons/9457a85d386aff3a5170287bf24b3ae2.png",
    remaining: [
      { name: "Summoning Ritual", percent: 66 },
      { name: "Forever Fight", percent: 50 },
      { name: "Strength of Memory", percent: 25 },
      { name: "Petra's Run", percent: 0 },
      { name: "The Imperial Inquisition", percent: 0 },
    ],
  },
  {
    sealHash: 7,
    name: "Gambit",
    title: "Dredgen",
    requirement: "Complete all Gambit Triumphs.",
    complete: 5,
    total: 9,
    percent: 56,
    earned: false,
    gildable: true,
    gilded: 0,
    icon: "/common/destiny2_content/icons/9c7f93c682f64ce996de315fe6d4ea31.png",
    remaining: [
      { name: "Black Armory Machinist", percent: 70 },
      { name: "Breakneck", percent: 40 },
      { name: "Last Hope", percent: 10 },
      { name: "Reckoner", percent: 0 },
    ],
  },
  {
    sealHash: 8,
    name: "Conqueror",
    title: "Conqueror",
    requirement: "Complete all Conqueror Triumphs.",
    complete: 0,
    total: 4,
    percent: 0,
    earned: false,
    gildable: true,
    gilded: 0,
    icon: "/common/destiny2_content/icons/ccbd2e8964312423205752e8d0cc5157.png",
    remaining: [
      { name: "Grandmaster: Solo", percent: 0 },
      { name: "Grandmaster: Flawless", percent: 0 },
      { name: "Master Nightfall Sweep", percent: 0 },
      { name: "Platinum Rewards", percent: 0 },
    ],
  },
];

const model = titleCardModel({
  title: "Titles",
  subtitle: `3 of 42 earned · 13,865 Triumph score · sample data`,
  titles: SAMPLE,
});

// The host pushes icons as a path→URL map (the iframe inlines them as data: URIs in Desktop; here
// the bare CDN paths resolve to absolute Bungie URLs the browser can fetch directly).
const icons: Record<string, string> = {};

for (const tile of model.tiles) {
  if (tile.icon) {
    icons[tile.icon] = `https://www.bungie.net${tile.icon}`;
  }
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
<title>Titles card preview</title>
<style>
  body { margin: 0; background: #0a0b0f; }
  iframe { width: 100%; border: 0; display: block; }
</style>
</head>
<body>
<iframe id="frame"></iframe>
<script>
  var TEMPLATE = ${forScript(renderTitlesTemplate())};
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
