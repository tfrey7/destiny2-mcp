import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderTitleTemplate, titleDetailModel } from "../../src/format/title/index.js";
import type { TitleDetail } from "../../src/bungie/progression.js";

// Renders the single-title detail card in a normal browser, without Claude Desktop, the manifest, or
// auth. It embeds the REAL ui:// template and a tiny host shim that performs the actual MCP-Apps
// handshake (answer ui/initialize → push ui/notifications/tool-result), then feeds it a hand-authored
// sample title reduced through the REAL titleDetailModel. Icons resolve from the live Bungie CDN
// (a browser, unlike Desktop's sandbox, can load remote hosts). Run: `npm run preview:title` — it
// writes an HTML file.

const ROOT = dirname(fileURLToPath(import.meta.url));
const OUT_FILE = join(ROOT, "..", "..", "release", "title-preview.html");

const TRIUMPH_ICON = "/common/destiny2_content/icons/9c7f93c682f64ce996de315fe6d4ea31.png";

// A sample title (Dredgen / Gambit) spanning completed, in-progress, and not-started member
// Triumphs so the detail card's row states all show.
const DETAIL: TitleDetail = {
  title: {
    sealHash: 3665267419,
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
    remaining: [],
  },
  triumphs: [
    {
      recordHash: 11,
      name: "Black Armory Machinist",
      description: "Defeat combatants with Grenade Launchers in Gambit.",
      state: "in_progress",
      percent: 70,
      score: 25,
      objectives: [
        { description: "Grenade Launcher kills", progress: 140, total: 200, complete: false },
      ],
      rewards: [],
    },
    {
      recordHash: 12,
      name: "Breakneck",
      description: "Complete the 'Pledge to the Drifter' quest and earn the Breakneck auto rifle.",
      state: "in_progress",
      percent: 40,
      score: 25,
      objectives: [{ description: "Gambit matches won", progress: 8, total: 20, complete: false }],
      rewards: [],
    },
    {
      recordHash: 13,
      name: "Reckoner",
      description: "Defeat the Primeval while wielding the slayer.",
      state: "not_started",
      percent: 0,
      score: 30,
      objectives: [{ description: "Primevals defeated", progress: 0, total: 5, complete: false }],
      rewards: [],
    },
    {
      recordHash: 14,
      name: "Playing for Keeps",
      description: "Win a match of Gambit.",
      state: "completed",
      percent: 100,
      score: 10,
      objectives: [{ description: "Matches won", progress: 1, total: 1, complete: true }],
      rewards: [],
    },
    {
      recordHash: 15,
      name: "Mote Master",
      description: "Bank a large number of Motes across your Gambit career.",
      state: "completed",
      percent: 100,
      score: 10,
      objectives: [{ description: "Motes banked", progress: 1000, total: 1000, complete: true }],
      rewards: [],
    },
    {
      recordHash: 16,
      name: "Invader's Gambit",
      description: "Defeat opponents as an Invader.",
      state: "completed",
      percent: 100,
      score: 10,
      objectives: [{ description: "Invader kills", progress: 50, total: 50, complete: true }],
      rewards: [],
    },
  ],
};

const model = titleDetailModel({
  detail: DETAIL,
  icons: Object.fromEntries(DETAIL.triumphs.map((t) => [t.recordHash, TRIUMPH_ICON])),
});

// The host pushes icons as a path→URL map (the iframe inlines them as data: URIs in Desktop; here
// the bare CDN paths resolve to absolute Bungie URLs the browser can fetch directly).
const icons: Record<string, string> = {};

if (model.icon) {
  icons[model.icon] = `https://www.bungie.net${model.icon}`;
}

for (const triumph of model.triumphs) {
  if (triumph.icon) {
    icons[triumph.icon] = `https://www.bungie.net${triumph.icon}`;
  }
}

const structuredContent = { ...model, icons };

// Inject a value into the page's <script> safely: the template HTML contains its own `</script>`,
// which would close the outer tag early, so escape every `<` as a JSON < escape.
function forScript(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

// The outer page is the MCP host stand-in: it loads the real template into an iframe via srcdoc,
// completes the handshake the iframe initiates, and pushes the tool result — the same message flow
// Claude Desktop runs.
const harness = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Title detail preview</title>
<style>
  body { margin: 0; background: #0a0b0f; }
  iframe { width: 100%; border: 0; display: block; }
</style>
</head>
<body>
<iframe id="frame"></iframe>
<script>
  var TEMPLATE = ${forScript(renderTitleTemplate())};
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
