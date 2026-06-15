import { COMMON_CLIENT } from "../card_client.js";
import { WEAPON_RENDER } from "./client.js";

/** URI of the registered MCP Apps UI template show_weapon links to via `_meta.ui.resourceUri`. */
export const WEAPON_UI_RESOURCE_URI = "ui://destiny2/weapon";

/** MIME the host declared it can render (SEP-1865); must match the registered resource. */
export const WEAPON_UI_MIME = "text/html;profile=mcp-app";

/**
 * The MCP Apps weapon-inspect template — a single static HTML document the host fetches once via
 * `resources/read` and renders in a sandboxed iframe. Like the loadout template it carries no weapon
 * data: it initiates the `ui/initialize` handshake, then renders client-side from the `structuredContent`
 * (a WeaponCard + inlined icons) the host pushes over `ui/notifications/tool-result`.
 *
 * The card emulates the in-game inspect screen: the weapon icon (with an element pip), its name (linking
 * to light.gg) and attributes up top, the intrinsic frame below, then the perk grid — one column per
 * socket, each listing its candidate perks as an icon + name with a hover tooltip naming the perk and what
 * it does. On an owned copy the rolled perk in each column is highlighted; a manifest item shows the full
 * candidate pool unmarked. A "waiting" shell shows before data arrives.
 */
export function renderWeaponTemplate(): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 16px; font: 14px/1.4 system-ui, -apple-system, "Segoe UI", sans-serif; background: #14151a; color: #e9eaf0; }
  .card { max-width: 760px; border: 1px solid #2b2d36; border-radius: 12px; background: #15171c; overflow: hidden; }
  .waiting { padding: 18px 16px; color: #6f7287; font-size: 13px; }
  header { display: flex; gap: 14px; align-items: center; padding: 16px; background: #1c1e26; border-bottom: 2px solid #2b2d36; }
  .thumb { position: relative; flex: none; line-height: 0; }
  .thumb .ic { width: 64px; height: 64px; border-radius: 6px; background: #24272f; display: block; }
  .thumb .pip { position: absolute; right: 3px; bottom: 3px; width: 22px; height: 22px; filter: drop-shadow(0 0 2px #000) drop-shadow(0 0 2px #000); }
  .thumb .wm { position: absolute; left: 0; top: 0; width: 64px; height: 64px; border-radius: 6px; pointer-events: none; }
  .htext { min-width: 0; }
  a.nm, .nm { display: inline-block; font-size: 19px; font-weight: 700; letter-spacing: .01em; text-decoration: none; color: #e9eaf0; }
  a.nm:hover { text-decoration: underline; }
  .attrs { margin-top: 3px; font-size: 12.5px; color: #9a9db0; }
  .attrs .dot { color: #4a4d5c; margin: 0 6px; }
  .body { padding: 8px 16px 18px; }
  .intrinsic { position: relative; display: flex; align-items: center; gap: 10px; padding: 12px 0; border-bottom: 1px solid #23252e; }
  .intrinsic .tip { left: 0; transform: none; top: 108%; bottom: auto; }
  .intrinsic:hover .tip { opacity: 1; visibility: visible; }
  .intrinsic .ico { width: 38px; height: 38px; border-radius: 50%; background: #2a2d36; padding: 3px; flex: none; cursor: default; }
  .intrinsic .ititle { font-size: 10px; letter-spacing: .12em; color: #6f7287; font-weight: 600; }
  .intrinsic .iname { font-weight: 600; }
  .grid { display: flex; flex-wrap: wrap; gap: 8px 14px; margin-top: 14px; }
  .col { flex: 1 1 0; min-width: 150px; }
  .colhead { padding-bottom: 6px; margin-bottom: 6px; border-bottom: 1px solid #23252e; font-size: 10px; letter-spacing: .12em; color: #6f7287; font-weight: 600; }
  .col.origin .colhead { color: #c9a227; }
  .plug { position: relative; display: flex; align-items: center; gap: 8px; padding: 5px 7px; border-radius: 7px; border: 1px solid transparent; }
  .plug:hover { background: #20232c; }
  .plug.sel { background: rgba(201,162,39,.12); border-color: rgba(201,162,39,.5); }
  .plug .pic { width: 32px; height: 32px; border-radius: 50%; background: #2a2d36; padding: 2px; flex: none; }
  .plug.sel .pic { box-shadow: 0 0 0 2px #c9a227; }
  .plug .pn { font-size: 12.5px; line-height: 1.25; color: #c8ccd6; min-width: 0; }
  .plug.sel .pn { color: #f0d98a; font-weight: 600; }
  .tip { position: absolute; left: 50%; bottom: 116%; transform: translateX(-50%); width: 230px; background: #0b0c10; border: 1px solid #343a45; border-radius: 8px; padding: 9px 11px; font-size: 12px; line-height: 1.45; color: #dfe2e7; box-shadow: 0 6px 22px rgba(0,0,0,.6); opacity: 0; visibility: hidden; transition: opacity .12s; z-index: 30; pointer-events: none; }
  .tip b { display: block; margin-bottom: 3px; font-size: 12.5px; color: #fff; }
  .tip .td { white-space: pre-line; color: #aeb3bb; }
  .plug:hover .tip { opacity: 1; visibility: visible; }
  .usage { margin-top: 16px; padding: 12px 14px; border-radius: 8px; background: #181b22; border: 1px solid #23252e; border-left: 3px solid #c9a227; }
  .usage .seclabel { margin: 0 0 8px; padding: 0; border: 0; }
  .usage .urow { font-size: 12.5px; line-height: 1.5; color: #c2c6d0; margin-top: 7px; }
  .usage .urow:first-of-type { margin-top: 0; }
  .usage .urow b { color: #f0d98a; }
</style>
</head>
<body>
  <div class="card" id="card"><div class="waiting">Loading weapon…</div></div>
  <script>${CLIENT_SCRIPT}</script>
</body>
</html>`;
}

// Client-side bridge + renderer. Plain ES5-ish JS (no template literals) so it survives being embedded
// in the outer template literal untouched. The shared utilities (esc/img/tip/clampTip/handshake) come
// from COMMON_CLIENT and the model→DOM builders from WEAPON_RENDER (Weapon.full) — see card_client.ts;
// only the per-template plumbing lives here. Implements the iframe (View) side of the MCP Apps
// handshake, which the View INITIATES (per SEP-1865): send ui/initialize, await the host's result, send
// ui/notifications/initialized, then report ui/notifications/size-changed so the host gives the iframe
// height. Renders on the host's ui/notifications/tool-result push.
const CLIENT_SCRIPT = `
(function () {
${COMMON_CLIENT}
${WEAPON_RENDER}
  var INIT_ID = 1;

  function render(data) {
    ICONS = data.icons || {};
    PIPS = data.elementPips || {};
    document.getElementById("card").innerHTML = Weapon.full(data);
    var accent = ELEMENT[data.element];
    if (accent) {
      var hdr = document.querySelector("header");
      if (hdr) hdr.style.borderBottomColor = accent;
    }
    sizeChanged();
  }

  document.addEventListener("mouseover", function (e) {
    var host = e.target.closest && e.target.closest(".plug, .intrinsic");
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
      if (data && data.columns) render(data);
    }
  });

  // View initiates the handshake, then reports its size so the host reveals the iframe.
  // protocolVersion is REQUIRED — a strict host rejects ui/initialize without it (= blank iframe).
  send({ jsonrpc: "2.0", id: INIT_ID, method: "ui/initialize", params: { appInfo: { name: "destiny2-weapon", version: "1.0.0" }, appCapabilities: {}, protocolVersion: "2026-01-26" } });
  sizeChanged();
})();
`;
