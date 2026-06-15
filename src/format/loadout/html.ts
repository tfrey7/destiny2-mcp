/** URI of the registered MCP Apps UI template tools link to via `_meta.ui.resourceUri`. */
export const LOADOUT_UI_RESOURCE_URI = "ui://destiny2/loadout";

/** MIME the host declared it can render (SEP-1865); must match the registered resource. */
export const LOADOUT_UI_MIME = "text/html;profile=mcp-app";

/** A tool the card's action button asks the host to call on the user's behalf. */
export interface UiAction {
  toolName: string;
  args: Record<string, unknown>;
  label: string;
}

/**
 * The MCP Apps loadout template — a single static HTML document the host fetches once via
 * `resources/read` and renders in a sandboxed iframe. Unlike a baked card, it carries no
 * loadout data: it initiates the `ui/initialize` handshake, then renders client-side from the
 * `structuredContent` (a cardModel) the host pushes over `ui/notifications/tool-result`.
 *
 * The card lays out like the in-game loadout: a subclass row (with its aspects + fragments) on
 * top, then weapons on the left and armor on the right. Each item shows its icon (weapons carry an
 * element pip), a name that links to light.gg, and its socketed plugs as icons — weapon perks and
 * armor mods — with a hover tooltip naming each plug and what it does. The same template serves
 * every loadout; the data varies per tool call. A "waiting" shell shows before data arrives.
 */
export function renderLoadoutTemplate(): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 16px; font: 14px/1.4 system-ui, -apple-system, "Segoe UI", sans-serif; background: #14151a; color: #e9eaf0; }
  .card { max-width: 680px; border: 1px solid #2b2d36; border-radius: 12px; background: #15171c; }
  header { padding: 14px 16px; background: #1c1e26; border-bottom: 1px solid #2b2d36; border-radius: 12px 12px 0 0; }
  header h1 { margin: 0; font-size: 16px; letter-spacing: .04em; }
  header .subtitle { margin-top: 2px; font-size: 12px; color: #9a9db0; }
  .waiting { padding: 18px 16px; color: #6f7287; font-size: 13px; }
  .body { padding: 4px 16px 16px; }
  .seclabel { margin: 16px 0 8px; padding-bottom: 6px; border-bottom: 1px solid #23252e; font-size: 10px; letter-spacing: .12em; color: #6f7287; font-weight: 600; }
  .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 2px 22px; }
  .col .seclabel { margin-top: 14px; }
  .item { display: flex; gap: 11px; align-items: flex-start; padding: 6px 0; }
  .thumb { position: relative; flex: none; line-height: 0; }
  .thumb .ic { width: 50px; height: 50px; border-radius: 6px; background: #24272f; display: block; }
  .thumb .pip { position: absolute; right: 5px; bottom: 5px; width: 17px; height: 17px; filter: drop-shadow(0 0 2px #000) drop-shadow(0 0 2px #000); }
  .thumb .wm { position: absolute; left: 0; top: 0; width: 50px; height: 50px; border-radius: 6px; pointer-events: none; }
  .meta { min-width: 0; }
  a.nm, .nm { display: block; line-height: 1.25; font-weight: 600; text-decoration: none; color: #e9eaf0; }
  a.nm:hover { text-decoration: underline; }
  .nm.muted { color: #54566a; font-style: italic; font-weight: 400; }
  .own, .need { display: inline-block; margin-top: 4px; font-size: 10px; font-weight: 600; letter-spacing: .03em; padding: 1px 7px; border-radius: 999px; }
  .own { background: rgba(74,158,91,.16); color: #6fcf8a; }
  .need { background: rgba(214,158,46,.16); color: #f0c674; }
  .plugrow { display: flex; align-items: center; gap: 6px; margin-top: 5px; flex-wrap: wrap; }
  .plug { position: relative; display: inline-block; line-height: 0; }
  .plug > img { width: 25px; height: 25px; background: #2a2d36; padding: 2px; box-sizing: border-box; }
  .plug.circle > img { border-radius: 50%; }
  .plug.square > img { border-radius: 6px; }
  .plug:hover > img { background: #3a3f4a; }
  .tip { position: absolute; left: 50%; bottom: 135%; transform: translateX(-50%); width: 220px; background: #0b0c10; border: 1px solid #343a45; border-radius: 8px; padding: 9px 11px; font-size: 12px; line-height: 1.45; color: #dfe2e7; box-shadow: 0 6px 22px rgba(0,0,0,.6); opacity: 0; visibility: hidden; transition: opacity .12s; z-index: 30; pointer-events: none; }
  .tip b { display: block; margin-bottom: 3px; font-size: 12.5px; color: #fff; }
  .tip .td { white-space: pre-line; color: #aeb3bb; }
  .plug:hover .tip { opacity: 1; visibility: visible; }
  footer { padding: 12px 16px; border-top: 1px solid #2b2d36; background: #1c1e26; border-radius: 0 0 12px 12px; }
  button { width: 100%; padding: 9px 12px; border: none; border-radius: 8px; cursor: pointer; font: inherit; font-weight: 600; background: #3b5bdb; color: #fff; }
  button:hover { background: #4263eb; }
  button:disabled { background: #2b2d36; color: #6f7287; cursor: default; }
</style>
</head>
<body>
  <div class="card" id="card"><div class="waiting">Loading loadout…</div></div>
  <script>${CLIENT_SCRIPT}</script>
</body>
</html>`;
}

// Client-side bridge + renderer. Plain ES5-ish JS (no template literals) so it survives being
// embedded in the outer template literal untouched. Implements the iframe (View) side of the
// MCP Apps handshake — which the View INITIATES (per SEP-1865): send ui/initialize, await the
// host's result, send ui/notifications/initialized, then report ui/notifications/size-changed so
// the host gives the iframe height (without it the iframe stays hidden/zero-height). Renders on
// the host's ui/notifications/tool-result push, and relays the action button as a tools/call.
const CLIENT_SCRIPT = `
(function () {
  var BUNGIE = "https://www.bungie.net";
  var LIGHTGG = "https://www.light.gg/db/items/";
  var RARITY = { Exotic: "#f5dc56", Legendary: "#b78fdb", Rare: "#4f87c4", Uncommon: "#4a9e5b", Common: "#cfd3d9", Basic: "#cfd3d9" };
  // Filled per render from the tool data: ICONS maps a CDN path to its base64 data: URI (Claude
  // Desktop's sandbox blocks remote image hosts but allows data:), PIPS maps an element to its pip path.
  var ICONS = {};
  var PIPS = {};
  var INIT_ID = 1;
  var nextId = 2;
  function send(m) { parent.postMessage(m, "*"); }
  function notify(method, params) { send({ jsonrpc: "2.0", method: method, params: params || {} }); }
  function sizeChanged() { notify("ui/notifications/size-changed", { height: document.documentElement.scrollHeight }); }
  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  // Resolve a CDN path to its inlined data: URI, falling back to the remote URL (works outside the
  // sandbox). A data: URI is used verbatim; only a bare path needs escaping into the attribute.
  function img(path, cls) {
    if (!path) return "";
    var data = ICONS[path];
    var src = data ? data : BUNGIE + esc(path);
    return '<img class="' + cls + '" src="' + src + '" alt="" />';
  }

  function thumb(row, isWeapon) {
    var pipPath = isWeapon && row.element ? PIPS[row.element] : null;
    var pip = pipPath ? img(pipPath, "pip") : "";
    var wm = row.watermark ? img(row.watermark, "wm") : "";
    return '<span class="thumb">' + img(row.icon, "ic") + wm + pip + "</span>";
  }

  function plugsHtml(plugs) {
    if (!plugs || !plugs.length) return "";
    var cells = plugs.map(function (p) {
      var shape = p.shape === "square" ? "square" : "circle";
      var tip = '<span class="tip"><b>' + esc(p.name) + '</b><span class="td">' + esc(p.description) + "</span></span>";
      return '<span class="plug ' + shape + '">' + img(p.icon, "") + tip + "</span>";
    }).join("");
    return '<div class="plugrow">' + cells + "</div>";
  }

  function nameHtml(row) {
    if (row.empty) return '<span class="nm muted">(empty)</span>';
    var color = RARITY[row.rarity] || "#e9eaf0";
    var label = esc(row.name);
    if (row.hash) {
      return '<a class="nm" style="color: ' + color + '" href="' + LIGHTGG + row.hash +
        '/" target="_blank" rel="noopener">' + label + "</a>";
    }
    return '<span class="nm" style="color: ' + color + '">' + label + "</span>";
  }

  // Owned/needed pill for a target build. Absent (returns "") on real loadouts, where every piece is
  // owned by definition and row.owned is undefined.
  function badge(row) {
    if (row.owned === true) return '<span class="own">✓ Owned</span>';
    if (row.owned === false) return '<span class="need">⚒ Farm</span>';
    return "";
  }

  function itemHtml(row, isWeapon) {
    return '<div class="item">' + thumb(row, isWeapon) +
      '<div class="meta">' + nameHtml(row) + badge(row) + plugsHtml(row.plugs) + "</div></div>";
  }

  function section(data, label) {
    var found = (data.sections || []).filter(function (s) { return s.label === label; })[0];
    return found ? (found.rows || []) : [];
  }

  function render(data) {
    ICONS = data.icons || {};
    PIPS = data.elementPips || {};
    var subclass = section(data, "SUBCLASS").map(function (r) { return itemHtml(r, false); }).join("");
    var weapons = section(data, "WEAPONS").map(function (r) { return itemHtml(r, true); }).join("");
    var armor = section(data, "ARMOR").map(function (r) { return itemHtml(r, false); }).join("");

    var body = "";
    if (subclass) body += '<div class="seclabel">SUBCLASS</div>' + subclass;
    body += '<div class="cols">' +
      '<div class="col"><div class="seclabel">WEAPONS</div>' + weapons + "</div>" +
      '<div class="col"><div class="seclabel">ARMOR</div>' + armor + "</div></div>";

    var footer = data.action ? '<footer><button id="act">' + esc(data.action.label) + "</button></footer>" : "";
    document.getElementById("card").innerHTML =
      "<header><h1>" + esc(data.title) + '</h1><div class="subtitle">' + esc(data.subtitle) + "</div></header>" +
      '<div class="body">' + body + "</div>" + footer;

    if (data.action) {
      var btn = document.getElementById("act");
      btn.addEventListener("click", function () {
        btn.disabled = true;
        send({ jsonrpc: "2.0", id: nextId++, method: "tools/call", params: { name: data.action.toolName, arguments: data.action.args } });
      });
    }
    sizeChanged();
  }

  // A tooltip can't render outside the iframe, so a host near an edge gets its tooltip clipped. On
  // hover, measure the tip and re-anchor it (overriding the CSS anchor) to stay inside the viewport:
  // centered over its host and nudged in at either side, kept on its preferred vertical side unless
  // that side would clip — then flipped. Delegated from mouseover so it covers every tooltip host.
  function clampTip(host, sel, preferBelow) {
    var tip = host.querySelector(sel);
    if (!tip) return;
    var margin = 8;
    tip.style.maxWidth = (window.innerWidth - margin * 2) + "px";
    var h = host.getBoundingClientRect();
    var t = tip.getBoundingClientRect();
    var left = h.left + h.width / 2 - t.width / 2;
    left = Math.max(margin, Math.min(left, window.innerWidth - margin - t.width));
    tip.style.left = (left - h.left) + "px";
    tip.style.right = "auto";
    tip.style.transform = "none";
    var roomAbove = t.height + margin <= h.top;
    var roomBelow = h.bottom + t.height + margin <= window.innerHeight;
    var below = preferBelow ? roomBelow || !roomAbove : !(roomAbove || !roomBelow);
    tip.style.top = below ? "116%" : "auto";
    tip.style.bottom = below ? "auto" : "116%";
  }

  document.addEventListener("mouseover", function (e) {
    var host = e.target.closest && e.target.closest(".plug");
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
      if (data && data.sections) render(data);
    }
  });

  // View initiates the handshake, then reports its size so the host reveals the iframe.
  // protocolVersion is REQUIRED — a strict host rejects ui/initialize without it (= blank iframe).
  send({ jsonrpc: "2.0", id: INIT_ID, method: "ui/initialize", params: { appInfo: { name: "destiny2-loadout", version: "1.0.0" }, appCapabilities: {}, protocolVersion: "2026-01-26" } });
  sizeChanged();
})();
`;
