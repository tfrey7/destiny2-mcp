import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { findItemByName, itemMeta } from "../../src/bungie/manifest.js";
import { loadManifest } from "../../src/bungie/manifest_db.js";
import { Component, getProfile } from "../../src/bungie/profile.js";
import type { WeaponSocketProfile } from "../../src/bungie/weapon.js";
import { ELEMENT_PIP } from "../../src/format/loadout/images.js";
import { renderWeaponTemplate } from "../../src/format/weapon/html.js";
import { weaponIconMap } from "../../src/format/weapon/images.js";
import { weaponCardSpec } from "../../src/tools/show_weapon.js";
import { instanceMap } from "../../src/tools/inventory.js";

// Render the weapon-inspect card to a self-contained HTML file you can open in a normal browser, so the
// MCP-UI template can be iterated on without Claude Desktop. The file embeds the REAL template in an
// iframe and a tiny host shim that drives the same `ui/initialize` → `ui/notifications/tool-result`
// handshake the desktop host does, feeding it the same structuredContent (WeaponCard + inlined icons)
// show_weapon would. So what you see here is what Desktop renders — minus the sandbox CSP, which is why
// icons are inlined as data: URIs either way. Pass a weapon name; prefix --owned to render YOUR copy's
// actual roll (resolves an equipped/held instance from the live profile — requires being logged in):
//
//   npm run preview:weapon -- "Fatebringer"              # manifest: the full "what can roll" grid
//   npm run preview:weapon -- --owned "No Time to Explain" # your copy: the perks it actually has
//   npm run preview:weapon                                # defaults to Fatebringer

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT_FILE = join(ROOT, "previews", "weapon.html");
const DEFAULT_WEAPON = "Fatebringer";

const argv = process.argv.slice(2);
const owned = argv[0] === "--owned";
const name =
  argv
    .slice(owned ? 1 : 0)
    .join(" ")
    .trim() || DEFAULT_WEAPON;

await loadManifest();

// One target per card. The manifest path yields a single card; --owned yields one per owned copy, so
// owning several copies with different rolls renders several stacked cards — exactly what show_weapon
// produces when the assistant calls it once per instanceId.
const targets = owned ? await ownedInstances(name) : [await manifestItem(name)];

const cards = await Promise.all(
  targets.map(async (target) => {
    const spec = await weaponCardSpec(target.hash, target.instanceId, target.profile);

    return { ...spec, icons: await weaponIconMap(spec), elementPips: ELEMENT_PIP };
  }),
);

await mkdir(dirname(OUT_FILE), { recursive: true });
await writeFile(OUT_FILE, previewHtml(renderWeaponTemplate(), cards));

const source = owned ? `owned ×${cards.length}` : "manifest";

console.log(`Wrote ${cards[0].name} [${source}] → ${OUT_FILE}`);
console.log(`Open it: open ${OUT_FILE}`);

// Resolve a weapon by name straight from the manifest — the full candidate-perk grid, no live roll.
async function manifestItem(weaponName: string) {
  const hash = await findItemByName(weaponName);

  if (hash === undefined) {
    console.error(`No item named "${weaponName}" found in the manifest.`);
    process.exit(1);
  }

  const meta = await itemMeta(hash);

  if (meta?.itemType !== 3) {
    console.error(
      `"${meta?.name ?? weaponName}" is not a weapon (${meta?.type || "unknown type"}).`,
    );
    process.exit(1);
  }

  return {
    hash,
    instanceId: undefined as string | undefined,
    profile: null as WeaponSocketProfile | null,
  };
}

// Find EVERY owned copy of a named weapon in the live profile (across equipment, character
// inventories, and the vault) so the preview can render one card per copy — the multi-copy case, where
// each card shows that copy's actual roll. Requires being logged in.
async function ownedInstances(weaponName: string) {
  const profile = await getProfile([
    Component.Characters,
    Component.CharacterEquipment,
    Component.CharacterInventories,
    Component.ProfileInventories,
    Component.ItemSockets,
    Component.ItemReusablePlugs,
  ]);

  const wanted = weaponName.toLowerCase();
  const copies: { hash: number; instanceId: string; profile: WeaponSocketProfile }[] = [];

  for (const [instanceId, hash] of instanceMap(profile)) {
    const meta = await itemMeta(hash);

    if (meta?.itemType === 3 && meta.name.toLowerCase() === wanted) {
      copies.push({ hash, instanceId, profile });
    }
  }

  if (copies.length === 0) {
    console.error(
      `No owned copy of "${weaponName}" found. Drop --owned to preview the manifest grid.`,
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
<title>Destiny 2 weapon card preview</title>
<style>body { margin: 0; background: #0e0f13; padding: 20px; }</style>
</head>
<body>
<script>
  var TEMPLATE = ${embed(template)};
  var CARDS = ${embed(cards)};
  var frames = CARDS.map(function (data) {
    var frame = document.createElement("iframe");
    frame.setAttribute("sandbox", "allow-scripts allow-popups");
    frame.style.cssText = "width:100%;max-width:800px;border:0;display:block;margin-bottom:18px;";
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
