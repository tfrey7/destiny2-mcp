import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { findItemByName, itemMeta } from "../../src/bungie/manifest.js";
import { loadManifest } from "../../src/bungie/manifest_db.js";
import { Component, type FullProfile, getProfile } from "../../src/bungie/profile.js";
import { renderArmorTemplate } from "../../src/format/armor/html.js";
import { armorIconMap } from "../../src/format/armor/images.js";
import { armorCardSpec } from "../../src/tools/show_armor.js";
import { instanceMap } from "../../src/tools/inventory.js";

// Render the armor-inspect card to a self-contained HTML file you can open in a normal browser, so the
// MCP-UI template can be iterated on without Claude Desktop. The file embeds the REAL template in an
// iframe and a tiny host shim that drives the same `ui/initialize` → `ui/notifications/tool-result`
// handshake the desktop host does, feeding it the same structuredContent (ArmorCard + inlined icons)
// show_armor would. So what you see here is what Desktop renders — minus the sandbox CSP, which is why
// icons are inlined as data: URIs either way. Pass an armor name; prefix --owned to render YOUR copies'
// actual rolls (one card per owned copy from the live profile — requires being logged in):
//
//   npm run preview:armor -- "Star-Eater Scales"      # manifest: base stats + exotic perk
//   npm run preview:armor -- --owned "Cenotaph Mask"  # your copies: real stat rolls + mods, one each
//   npm run preview:armor                             # defaults to Star-Eater Scales

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT_FILE = join(ROOT, "previews", "armor.html");
const DEFAULT_ARMOR = "Star-Eater Scales";

const argv = process.argv.slice(2);
const owned = argv[0] === "--owned";
const name =
  argv
    .slice(owned ? 1 : 0)
    .join(" ")
    .trim() || DEFAULT_ARMOR;

await loadManifest();

// One target per card. The manifest path yields a single card; --owned yields one per owned copy, so
// owning several copies with different stat spreads renders several stacked cards — exactly what
// show_armor produces when the assistant calls it once per instanceId.
const targets = owned ? await ownedInstances(name) : [await manifestItem(name)];

const cards = await Promise.all(
  targets.map(async (target) => {
    const spec = await armorCardSpec(target.hash, target.instanceId, target.profile);

    return { ...spec, icons: await armorIconMap(spec) };
  }),
);

await mkdir(dirname(OUT_FILE), { recursive: true });
await writeFile(OUT_FILE, previewHtml(renderArmorTemplate(), cards));

const source = owned ? `owned ×${cards.length}` : "manifest";

console.log(`Wrote ${cards[0].name} [${source}] → ${OUT_FILE}`);
console.log(`Open it: open ${OUT_FILE}`);

// The profile slice armorCardSpec reads — sockets (mods, gear tier) and stats.
type CardProfile = Pick<FullProfile, "itemSockets" | "itemStats">;

// Resolve an armor piece by name straight from the manifest — base stats and exotic perk, no live roll.
async function manifestItem(armorName: string) {
  const hash = await findItemByName(armorName);

  if (hash === undefined) {
    console.error(`No item named "${armorName}" found in the manifest.`);
    process.exit(1);
  }

  const meta = await itemMeta(hash);

  if (meta?.itemType !== 2) {
    console.error(
      `"${meta?.name ?? armorName}" is not an armor piece (${meta?.type || "unknown type"}).`,
    );
    process.exit(1);
  }

  return { hash, instanceId: undefined, profile: null as CardProfile | null };
}

// Find EVERY owned copy of a named armor piece in the live profile (across equipment, character
// inventories, and the vault) so the preview can render one card per copy — the multi-copy case, where
// each card shows that copy's actual stat roll and mods. Requires being logged in.
async function ownedInstances(armorName: string) {
  const profile = await getProfile([
    Component.Characters,
    Component.CharacterEquipment,
    Component.CharacterInventories,
    Component.ProfileInventories,
    Component.ItemSockets,
    Component.ItemStats,
  ]);

  const wanted = armorName.toLowerCase();
  const copies: { hash: number; instanceId: string; profile: CardProfile }[] = [];

  for (const [instanceId, hash] of instanceMap(profile)) {
    const meta = await itemMeta(hash);

    if (meta?.itemType === 2 && meta.name.toLowerCase() === wanted) {
      copies.push({ hash, instanceId, profile });
    }
  }

  if (copies.length === 0) {
    console.error(
      `No owned copy of "${armorName}" found. Drop --owned to preview the manifest card.`,
    );
    process.exit(1);
  }

  return copies;
}

// Wrap the template + one data object per card into a single page that plays the host. Each card gets
// its own iframe loading the template via srcdoc; on a frame's ui/initialize we reply with a result
// (completing the handshake) and push the tool-result carrying that frame's structuredContent, matching
// the sender by e.source so multiple stacked cards stay independent. Frame height tracks reported size.
function previewHtml(template: string, cards: unknown[]): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Destiny 2 armor card preview</title>
<style>body { margin: 0; background: #0e0f13; padding: 20px; }</style>
</head>
<body>
<script>
  var TEMPLATE = ${embed(template)};
  var CARDS = ${embed(cards)};
  var frames = CARDS.map(function (data) {
    var frame = document.createElement("iframe");
    frame.setAttribute("sandbox", "allow-scripts allow-popups");
    frame.style.cssText = "width:100%;max-width:660px;border:0;display:block;margin-bottom:18px;";
    frame._data = data;
    document.body.appendChild(frame);
    return frame;
  });
  window.addEventListener("message", function (e) {
    var m = e.data;
    if (!m || typeof m !== "object") return;
    var frame = frames.filter(function (f) { return f.contentWindow === e.source; })[0];
    if (!frame) return;
    if (m.method === "ui/initialize") {
      frame.contentWindow.postMessage({ jsonrpc: "2.0", id: m.id, result: {} }, "*");
      frame.contentWindow.postMessage({ jsonrpc: "2.0", method: "ui/notifications/tool-result", params: { structuredContent: frame._data } }, "*");
    }
    if (m.method === "ui/notifications/size-changed" && m.params && m.params.height) {
      frame.style.height = (m.params.height + 4) + "px";
    }
  });
  frames.forEach(function (frame) { frame.srcdoc = TEMPLATE; });
</script>
</body>
</html>`;
}

// Escape every "<" so an embedded "</script>" (the template carries one) can't close the host's own
// script tag early — the standard trick for inlining HTML/JSON into a <script> block.
function embed(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
