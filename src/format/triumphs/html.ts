/** URI of the registered MCP Apps UI template show_triumphs links to via `_meta.ui.resourceUri`. */
export const TRIUMPHS_UI_RESOURCE_URI = "ui://destiny2/triumphs";

/** MIME the host declared it can render (SEP-1865); must match the registered resource. */
export const TRIUMPHS_UI_MIME = "text/html;profile=mcp-app";

/**
 * The MCP Apps Triumph-grid template — a single static HTML document the host fetches once via
 * `resources/read` and renders in a sandboxed iframe. Like the loadout card it carries no data: it
 * initiates the `ui/initialize` handshake, then renders client-side from the `structuredContent`
 * (a TriumphCardModel) the host pushes over `ui/notifications/tool-result`.
 *
 * The card emulates Destiny 2's Triumphs screen — a responsive grid of tiles, each with its icon, a
 * cyan Triumph-score gem, the name, and a completion bar coloured by state. Hovering a tile reveals
 * an expanded panel: the description, each objective's live progress as a mini bar, the advisor's
 * reasons it's worth chasing, the seal / location / activity chips, and any rewards. A "waiting"
 * shell shows before data arrives.
 */
export function renderTriumphTemplate(): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 16px; font: 14px/1.4 system-ui, -apple-system, "Segoe UI", sans-serif; background: #0c0d11; color: #e9eaf0; }
  .card { max-width: 760px; margin: 0 auto; }
  header h1 { margin: 0; font-size: 15px; letter-spacing: .17em; color: #d9bd72; text-transform: uppercase; }
  header .subtitle { margin-top: 3px; font-size: 12px; color: #8a8d9f; }
  .caveat { margin: 10px 0 0; padding: 9px 11px; background: #17160f; border: 1px solid #2c2920; border-left: 3px solid #c6a14a; border-radius: 6px; font-size: 11.5px; color: #b6ab8e; }
  .waiting { padding: 28px 4px; color: #6f7287; font-size: 13px; }
  .empty { padding: 22px 4px; color: #6f7287; font-size: 13px; }
  .grid { margin-top: 14px; display: grid; grid-template-columns: repeat(auto-fill, minmax(232px, 1fr)); gap: 9px; }
  /* Tiles carry the in-game amber wash (dark on the icon side, gold-tinted on the right) and a gold
     hover border, with a state-coloured left accent + progress fill so "how close" stays legible. */
  .tile { position: relative; padding: 11px 12px; border: 1px solid #2a2823; border-left-width: 3px; border-radius: 8px; background: linear-gradient(100deg, #15161c 48%, rgba(180,142,56,.13)); transition: border-color .12s, box-shadow .12s, transform .12s; }
  .tile:hover { border-color: #c6a14a; box-shadow: 0 0 0 1px rgba(198,161,74,.35), 0 6px 20px rgba(0,0,0,.5); transform: translateY(-1px); z-index: 40; }
  .tile.in_progress { border-left-color: #c6a14a; }
  .tile.not_started { border-left-color: #44474f; }
  .tile.completed { border-left-color: #f0d27a; }
  .tile.obscured { opacity: .72; }
  .head { display: flex; gap: 10px; align-items: flex-start; }
  .thumb { flex: none; width: 46px; height: 46px; border-radius: 6px; background: #211f18; border: 1px solid #34301f; display: flex; align-items: center; justify-content: center; line-height: 0; overflow: hidden; }
  .thumb img { width: 100%; height: 100%; object-fit: cover; }
  .thumb .glyph { font-size: 22px; color: #c6a14a; }
  .hmeta { min-width: 0; flex: 1; }
  .nm { font-weight: 600; font-size: 13px; line-height: 1.25; color: #f0ead9; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
  /* The Triumph score gem — cyan, matching the in-game score glyph (distinct from the gold seal art). */
  .gem { display: inline-flex; align-items: center; gap: 3px; margin-top: 4px; font-size: 11px; font-weight: 700; color: #5fd3e0; letter-spacing: .02em; }
  .gem .d { font-size: 9px; }
  .prog { margin-top: 10px; height: 5px; border-radius: 999px; background: #211f18; overflow: hidden; }
  .fill { height: 100%; border-radius: 999px; background: linear-gradient(90deg, #b98f3e, #e3c878); }
  .completed .fill { background: linear-gradient(90deg, #d9b65f, #f3df9a); }
  .not_started .fill { background: #4a4f5c; }
  .pct { margin-top: 5px; font-size: 10.5px; color: #9a9276; font-weight: 600; }
  /* Hover panel — a floating expanded view anchored to the tile (see loadout .tip). */
  .panel { position: absolute; left: 0; top: calc(100% + 7px); width: 304px; max-width: 92vw; background: #0a0b0e; border: 1px solid #2c2920; border-top: 2px solid #c6a14a; border-radius: 8px; padding: 12px 13px; box-shadow: 0 12px 32px rgba(0,0,0,.7); opacity: 0; visibility: hidden; transition: opacity .12s; z-index: 50; pointer-events: none; }
  .tile:hover .panel { opacity: 1; visibility: visible; }
  .panel .pname { font-size: 13px; font-weight: 700; color: #fff; text-transform: uppercase; letter-spacing: .03em; }
  .panel .pcat { font-size: 11px; font-weight: 600; color: #d9bd72; margin-top: 2px; }
  .panel .desc { font-size: 12px; color: #aeb3bb; line-height: 1.45; margin: 8px 0 2px; }
  .sect { font-size: 9.5px; letter-spacing: .1em; color: #b58e3d; font-weight: 700; margin: 10px 0 5px; }
  .obj { margin-bottom: 7px; }
  .obj .ol { display: flex; justify-content: space-between; gap: 8px; font-size: 11.5px; color: #cfd3d9; }
  .obj .olabel { display: flex; align-items: center; gap: 6px; min-width: 0; }
  .obj .cbox { flex: none; width: 14px; height: 14px; border: 1px solid #4a4434; border-radius: 3px; display: inline-flex; align-items: center; justify-content: center; font-size: 10px; line-height: 1; color: transparent; }
  .obj .cbox.done { border-color: #5aa86a; background: rgba(90,168,106,.2); color: #6fcf8a; }
  .obj .oc { color: #9a9276; font-variant-numeric: tabular-nums; flex: none; }
  .obj .oc.done { color: #6fcf8a; }
  .obar { margin-top: 4px; height: 3px; border-radius: 999px; background: #211f18; overflow: hidden; }
  .obar > span { display: block; height: 100%; background: linear-gradient(90deg, #b98f3e, #e3c878); }
  .obar.done > span { background: #5aa86a; }
  .why { margin: 0; padding: 0; list-style: none; }
  .why li { position: relative; padding-left: 13px; font-size: 11.5px; color: #b9bdc9; line-height: 1.5; }
  .why li::before { content: "›"; position: absolute; left: 2px; color: #c6a14a; }
  .chips { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 4px; }
  .chip { font-size: 10px; font-weight: 600; letter-spacing: .02em; padding: 2px 7px; border-radius: 999px; background: #1a1812; color: #c2ab7e; border: 1px solid #38321f; }
  .rewards { display: flex; flex-wrap: wrap; gap: 9px; margin-top: 4px; }
  .reward { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; color: #d6dae1; }
  .reward img { width: 22px; height: 22px; border-radius: 4px; background: #211f18; border: 1px solid #34301f; }
</style>
</head>
<body>
  <div class="card" id="card"><div class="waiting">Loading Triumphs…</div></div>
  <script>${CLIENT_SCRIPT}</script>
</body>
</html>`;
}

// Client-side bridge + renderer. Plain ES5-ish JS (no template literals) so it survives being
// embedded in the outer template literal untouched. Implements the iframe (View) side of the MCP
// Apps handshake — which the View INITIATES (per SEP-1865): send ui/initialize, await the host's
// result, send ui/notifications/initialized, then report ui/notifications/size-changed so the host
// gives the iframe height. Renders on the host's ui/notifications/tool-result push.
const CLIENT_SCRIPT = `
(function () {
  var BUNGIE = "https://www.bungie.net";
  // Filled per render: ICONS maps a CDN path to its base64 data: URI (Claude Desktop's sandbox
  // blocks remote image hosts but allows data:).
  var ICONS = {};
  var INIT_ID = 1;
  var nextId = 2;
  function send(m) { parent.postMessage(m, "*"); }
  function notify(method, params) { send({ jsonrpc: "2.0", method: method, params: params || {} }); }
  function sizeChanged() { notify("ui/notifications/size-changed", { height: document.documentElement.scrollHeight }); }
  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function clamp(n) { n = Number(n) || 0; return n < 0 ? 0 : n > 100 ? 100 : n; }

  // Resolve a CDN path to its inlined data: URI, falling back to the remote URL (works outside the
  // sandbox). A data: URI is used verbatim; only a bare path needs escaping into the attribute.
  function imgSrc(path) { return ICONS[path] ? ICONS[path] : BUNGIE + esc(path); }

  function thumb(tile) {
    if (!tile.icon) return '<span class="thumb"><span class="glyph">◆</span></span>';
    return '<span class="thumb"><img src="' + imgSrc(tile.icon) + '" alt="" /></span>';
  }

  function gem(score) {
    if (!score) return "";
    return '<span class="gem"><span class="d">◆</span>' + esc(score) + "</span>";
  }

  // Objective rows mirror the in-game tooltip: a checkbox (filled green when complete), the label,
  // a count on the right (only when the objective tracks more than one), and a progress bar.
  function objectivesHtml(objectives) {
    if (!objectives || !objectives.length) return "";
    var rows = objectives.map(function (o) {
      var done = o.complete ? " done" : "";
      var check = o.complete ? "✓" : "";
      var count = o.total > 1 ? esc(o.progress) + " / " + esc(o.total) : "";
      return '<div class="obj"><div class="ol">' +
        '<span class="olabel"><span class="cbox' + done + '">' + check + "</span>" + esc(o.label) + "</span>" +
        '<span class="oc' + done + '">' + count + "</span></div>" +
        '<div class="obar' + done + '"><span style="width:' + clamp(o.percent) + '%"></span></div></div>';
    }).join("");
    return '<div class="sect">OBJECTIVES</div>' + rows;
  }

  function whyHtml(why) {
    if (!why || !why.length) return "";
    var items = why.map(function (w) { return "<li>" + esc(w) + "</li>"; }).join("");
    return '<div class="sect">WHY CHASE THIS</div><ul class="why">' + items + "</ul>";
  }

  function chipsHtml(chips) {
    if (!chips || !chips.length) return "";
    var cells = chips.map(function (c) { return '<span class="chip">' + esc(c) + "</span>"; }).join("");
    return '<div class="chips">' + cells + "</div>";
  }

  // Each reward as its manifest icon plus name — the icons inline from the same data: URI map.
  function rewardsHtml(rewards) {
    if (!rewards || !rewards.length) return "";
    var cells = rewards.map(function (r) {
      var ic = r.icon ? '<img src="' + imgSrc(r.icon) + '" alt="" />' : "";
      return '<span class="reward">' + ic + "<span>" + esc(r.name) + "</span></span>";
    }).join("");
    return '<div class="sect">REWARDS</div><div class="rewards">' + cells + "</div>";
  }

  function panelHtml(tile) {
    // The gold category line under the name — the seal this Triumph feeds, like the in-game
    // "Gilded Title Triumph" subtitle. Omitted for Triumphs outside any seal.
    var cat = tile.seal ? '<div class="pcat">' + esc(tile.seal) + " Seal</div>" : "";
    var desc = tile.description ? '<div class="desc">' + esc(tile.description) + "</div>" : "";
    return '<div class="panel"><div class="pname">' + esc(tile.name) + "</div>" + cat + desc +
      objectivesHtml(tile.objectives) + whyHtml(tile.why) + chipsHtml(tile.chips) + rewardsHtml(tile.rewards) + "</div>";
  }

  function tileHtml(tile) {
    var cls = "tile " + (tile.state || "not_started") + (tile.obscured ? " obscured" : "");
    var pct = clamp(tile.percent);
    return '<div class="' + cls + '">' +
      '<div class="head">' + thumb(tile) +
        '<div class="hmeta"><div class="nm">' + esc(tile.name) + "</div>" + gem(tile.score) + "</div></div>" +
      '<div class="prog"><div class="fill" style="width:' + pct + '%"></div></div>' +
      '<div class="pct">' + pct + '% complete</div>' +
      panelHtml(tile) + "</div>";
  }

  function render(data) {
    ICONS = data.icons || {};
    var tiles = data.tiles || [];
    var caveat = data.caveat ? '<div class="caveat">' + esc(data.caveat) + "</div>" : "";
    var body = tiles.length
      ? '<div class="grid">' + tiles.map(tileHtml).join("") + "</div>"
      : '<div class="empty">No incomplete Triumphs matched.</div>';

    document.getElementById("card").innerHTML =
      "<header><h1>" + esc(data.title) + '</h1><div class="subtitle">' + esc(data.subtitle) + "</div></header>" +
      caveat + body;
    sizeChanged();
  }

  // A tooltip can't render outside the iframe, so a tile near an edge gets its hover panel clipped. On
  // hover, measure the panel and re-anchor it (overriding the CSS anchor) to stay inside the viewport:
  // centered over its tile and nudged in at either side, kept on its preferred vertical side (below,
  // matching the panel's default) unless that side would clip — then flipped. Delegated from mouseover.
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
    var host = e.target.closest && e.target.closest(".tile");
    if (host) clampTip(host, ".panel", true);
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
      if (data && data.tiles) render(data);
    }
  });

  // View initiates the handshake, then reports its size so the host reveals the iframe.
  // protocolVersion is REQUIRED — a strict host rejects ui/initialize without it (= blank iframe).
  send({ jsonrpc: "2.0", id: INIT_ID, method: "ui/initialize", params: { appInfo: { name: "destiny2-triumphs", version: "1.0.0" }, appCapabilities: {}, protocolVersion: "2026-01-26" } });
  sizeChanged();
})();
`;
