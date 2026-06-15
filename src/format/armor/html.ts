import { COMMON_CLIENT } from "../card_client.js";
import { ARMOR_RENDER } from "./client.js";

/** URI of the registered MCP Apps UI template show_armor links to via `_meta.ui.resourceUri`. */
export const ARMOR_UI_RESOURCE_URI = "ui://destiny2/armor";

/** MIME the host declared it can render (SEP-1865); must match the registered resource. */
export const ARMOR_UI_MIME = "text/html;profile=mcp-app";

/**
 * The MCP Apps armor-inspect template — a single static HTML document the host fetches once via
 * `resources/read` and renders in a sandboxed iframe. Like the weapon/loadout templates it carries no
 * armor data: it initiates the `ui/initialize` handshake, then renders client-side from the
 * `structuredContent` (an ArmorCard + inlined icons) the host pushes over `ui/notifications/tool-result`.
 *
 * The card emulates the in-game inspect screen: the armor icon, its name (linking to light.gg) and
 * attributes (class · slot · gear tier · rarity) up top, then the six Armor 3.0 archetype stats as a
 * value + bar block — the headline. Below sit the exotic intrinsic perk (exotics only, with a hover
 * tooltip), the set bonuses at 2/4 pieces, and, on an owned copy, the slotted mods as icons with
 * tooltips. A "waiting" shell shows before data arrives.
 */
export function renderArmorTemplate(): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 16px; font: 14px/1.4 system-ui, -apple-system, "Segoe UI", sans-serif; background: #14151a; color: #e9eaf0; }
  .card { max-width: 620px; border: 1px solid #2b2d36; border-radius: 12px; background: #15171c; overflow: hidden; }
  .waiting { padding: 18px 16px; color: #6f7287; font-size: 13px; }
  header { display: flex; gap: 14px; align-items: center; padding: 16px; background: #1c1e26; border-bottom: 2px solid #2b2d36; }
  .thumb { position: relative; flex: none; line-height: 0; }
  .thumb .ic { width: 64px; height: 64px; border-radius: 6px; background: #24272f; display: block; }
  .thumb .tier { position: absolute; right: -5px; bottom: -5px; min-width: 20px; height: 20px; padding: 0 4px; border-radius: 10px; background: #c9a227; color: #1a1300; font-size: 11px; font-weight: 700; line-height: 20px; text-align: center; box-shadow: 0 0 0 2px #1c1e26; }
  .thumb .wm { position: absolute; left: 0; top: 0; width: 64px; height: 64px; border-radius: 6px; pointer-events: none; }
  .htext { min-width: 0; }
  a.nm, .nm { display: inline-block; font-size: 19px; font-weight: 700; letter-spacing: .01em; text-decoration: none; color: #e9eaf0; }
  a.nm:hover { text-decoration: underline; }
  .attrs { margin-top: 3px; font-size: 12.5px; color: #9a9db0; }
  .attrs .dot { color: #4a4d5c; margin: 0 6px; }
  .body { padding: 14px 16px 18px; }
  .stats { display: grid; grid-template-columns: auto 2.4em 1fr; gap: 7px 10px; align-items: center; }
  .stats .sl { font-size: 11px; letter-spacing: .08em; color: #9a9db0; text-transform: uppercase; white-space: nowrap; }
  .stats .sv { font-size: 14px; font-weight: 700; color: #e9eaf0; text-align: right; font-variant-numeric: tabular-nums; }
  .stats .track { height: 9px; border-radius: 5px; background: #23252e; overflow: hidden; }
  .stats .fill { height: 100%; border-radius: 5px; background: linear-gradient(90deg, #6d8cc0, #acc4ec); }
  .statnote { font-size: 12.5px; line-height: 1.45; color: #9a9db0; }
  .seclabel { margin: 18px 0 8px; font-size: 10px; letter-spacing: .12em; color: #6f7287; font-weight: 600; }
  .intrinsic { position: relative; display: flex; align-items: center; gap: 10px; padding: 12px; border-radius: 8px; background: rgba(201,162,39,.08); border: 1px solid rgba(201,162,39,.3); }
  .intrinsic .ico { width: 40px; height: 40px; border-radius: 50%; background: #2a2d36; padding: 3px; flex: none; }
  .intrinsic .iname { font-weight: 700; color: #f0d98a; }
  .intrinsic .idesc { margin-top: 3px; font-size: 12px; line-height: 1.45; color: #c2c6d0; }
  .set { padding: 12px 14px; border-radius: 8px; background: #181b22; border: 1px solid #23252e; }
  .set .sname { font-weight: 700; margin-bottom: 8px; }
  .set .brow { position: relative; display: flex; gap: 9px; font-size: 12.5px; line-height: 1.45; color: #c2c6d0; margin-top: 8px; }
  .set .brow:first-of-type { margin-top: 0; }
  .set .pill { flex: none; min-width: 30px; height: 20px; padding: 0 7px; border-radius: 10px; background: #2b2f3a; color: #c8ccd6; font-size: 11px; font-weight: 700; line-height: 20px; text-align: center; }
  .set .bname { color: #e3e6ec; font-weight: 600; }
  .mods { display: flex; flex-wrap: wrap; gap: 9px; }
  .mod { position: relative; }
  .mod .mic { width: 38px; height: 38px; border-radius: 8px; background: #2a2d36; padding: 3px; border: 1px solid #3a3e4a; display: block; }
  .tip { position: absolute; left: 50%; bottom: 116%; transform: translateX(-50%); width: 230px; background: #0b0c10; border: 1px solid #343a45; border-radius: 8px; padding: 9px 11px; font-size: 12px; line-height: 1.45; color: #dfe2e7; box-shadow: 0 6px 22px rgba(0,0,0,.6); opacity: 0; visibility: hidden; transition: opacity .12s; z-index: 30; pointer-events: none; }
  .tip b { display: block; margin-bottom: 3px; font-size: 12.5px; color: #fff; }
  .tip .td { white-space: pre-line; color: #aeb3bb; }
  .mod:hover .tip, .intrinsic:hover .tip, .set .brow:hover .tip { opacity: 1; visibility: visible; }
  .intrinsic .tip, .set .brow .tip { left: 0; transform: none; }
  .usage { margin-top: 16px; padding: 12px 14px; border-radius: 8px; background: #181b22; border: 1px solid #23252e; border-left: 3px solid #c9a227; }
  .usage .seclabel { margin: 0 0 8px; }
  .usage .urow { font-size: 12.5px; line-height: 1.5; color: #c2c6d0; margin-top: 7px; }
  .usage .urow:first-of-type { margin-top: 0; }
  .usage .urow b { color: #f0d98a; }
</style>
</head>
<body>
  <div class="card" id="card"><div class="waiting">Loading armor…</div></div>
  <script>${CLIENT_SCRIPT}</script>
</body>
</html>`;
}

// Client-side bridge + renderer. Plain ES5-ish JS (no template literals) so it survives being embedded
// in the outer template literal untouched. Implements the iframe (View) side of the MCP Apps handshake,
// which the View INITIATES (per SEP-1865): send ui/initialize, await the host's result, send
// ui/notifications/initialized, then report ui/notifications/size-changed so the host gives the iframe
// height. Renders on the host's ui/notifications/tool-result push. Mirrors the weapon template's bridge.
// Client-side bridge + renderer. Plain ES5-ish JS (no template literals) so it survives being embedded
// in the outer template literal untouched. The shared utilities (esc/img/tip/clampTip/handshake) come
// from COMMON_CLIENT and the model→DOM builders from ARMOR_RENDER (Armor.full) — see card_client.ts;
// only the per-template plumbing lives here. Implements the iframe (View) side of the MCP Apps
// handshake, which the View INITIATES (per SEP-1865): send ui/initialize, await the host's result, send
// ui/notifications/initialized, then report ui/notifications/size-changed. Renders on tool-result.
const CLIENT_SCRIPT = `
(function () {
${COMMON_CLIENT}
${ARMOR_RENDER}
  var INIT_ID = 1;

  function render(data) {
    ICONS = data.icons || {};
    document.getElementById("card").innerHTML = Armor.full(data);
    sizeChanged();
  }

  document.addEventListener("mouseover", function (e) {
    var host = e.target.closest && e.target.closest(".plug, .intrinsic, .mod, .brow");
    if (host) clampTip(host, ".tip", false);
  });

  window.addEventListener("message", function (e) {
    var m = e.data;
    if (!m || typeof m !== "object") return;
    // Host's result to our ui/initialize → complete the handshake.
    if (m.id === INIT_ID && m.result) {
      notify("ui/notifications/initialized", {});
      sizeChanged();
      return;
    }
    // Host pushes the tool's data.
    if (m.method === "ui/notifications/tool-result" || m.method === "ui/notifications/tool-input") {
      var data = m.params && (m.params.structuredContent || (m.params.result && m.params.result.structuredContent));
      if (data && data.stats) render(data);
    }
  });

  // View initiates the handshake, then reports its size so the host reveals the iframe.
  // protocolVersion is REQUIRED — a strict host rejects ui/initialize without it (= blank iframe).
  send({ jsonrpc: "2.0", id: INIT_ID, method: "ui/initialize", params: { appInfo: { name: "destiny2-armor", version: "1.0.0" }, appCapabilities: {}, protocolVersion: "2026-01-26" } });
  sizeChanged();
})();
`;
