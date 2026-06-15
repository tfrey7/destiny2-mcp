/** URI of the registered MCP Apps UI template show_titles links to via `_meta.ui.resourceUri`. */
export const TITLES_UI_RESOURCE_URI = "ui://destiny2/titles";

/** MIME the host declared it can render (SEP-1865); must match the registered resource. */
export const TITLES_UI_MIME = "text/html;profile=mcp-app";

/**
 * The MCP Apps Titles-gallery template — a single static HTML document the host fetches once via
 * `resources/read` and renders in a sandboxed iframe. Like the loadout and triumph cards it carries
 * no data: it initiates the `ui/initialize` handshake, then renders client-side from the
 * `structuredContent` (a TitleCardModel) the host pushes over `ui/notifications/tool-result`.
 *
 * The card emulates Destiny 2's Seals screen — a grid of crest tiles, each led by its gold seal
 * emblem and the earned title word in the in-game gold-gothic style, with the seal's source beneath,
 * a completion bar, and the Triumph count. Earned titles glow gold (gilded ones show their laurel
 * count); in-progress titles take an amber accent; untouched titles are dimmed. Hovering a tile
 * reveals the unlock requirement and the exact Triumph tally. A "waiting" shell shows before data
 * arrives.
 */
export function renderTitlesTemplate(): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 18px; font: 14px/1.4 system-ui, -apple-system, "Segoe UI", sans-serif; background: radial-gradient(120% 80% at 50% 0%, #14151d 0%, #0a0b0f 60%); color: #e9eaf0; }
  .card { max-width: 880px; margin: 0 auto; }
  header { text-align: center; padding-bottom: 4px; border-bottom: 1px solid #2a2620; }
  header h1 { margin: 0; font-size: 17px; letter-spacing: .42em; color: #e8cf8c; text-transform: uppercase; text-indent: .42em; font-weight: 600; }
  header .subtitle { margin-top: 6px; font-size: 12px; color: #8a8d9f; letter-spacing: .04em; }
  .waiting, .empty { padding: 30px 4px; color: #6f7287; font-size: 13px; text-align: center; }
  .grid { margin-top: 16px; display: grid; grid-template-columns: repeat(auto-fill, minmax(196px, 1fr)); gap: 11px; }

  /* Each tile is a vertical crest: emblem on top, the title word as the hero, source + progress
     below. The amber wash and gold hover border echo the in-game Seals panel. */
  .tile { position: relative; display: flex; flex-direction: column; align-items: center; text-align: center; padding: 16px 13px 13px; border: 1px solid #2a2823; border-radius: 10px; background: linear-gradient(180deg, #15161d 0%, #101117 100%); transition: border-color .12s, box-shadow .12s, transform .12s; }
  .tile:hover { border-color: #c6a14a; box-shadow: 0 0 0 1px rgba(198,161,74,.35), 0 8px 26px rgba(0,0,0,.55); transform: translateY(-2px); z-index: 40; }

  /* Status treatments — earned crests glow, in-progress take an amber rail, untouched ones dim. */
  .tile.earned { border-color: #6e5a2c; background: linear-gradient(180deg, #1d1a12 0%, #121117 100%); }
  .tile.earned::before { content: ""; position: absolute; inset: 0; border-radius: 10px; box-shadow: inset 0 0 38px rgba(214,176,84,.16); pointer-events: none; }
  .tile.in_progress { border-top: 2px solid #b98f3e; }
  .tile.not_started { opacity: .72; }

  .crest { width: 72px; height: 72px; display: flex; align-items: center; justify-content: center; line-height: 0; }
  .crest img { width: 100%; height: 100%; object-fit: contain; filter: drop-shadow(0 2px 6px rgba(0,0,0,.6)); }
  .earned .crest img { filter: drop-shadow(0 0 12px rgba(228,200,120,.55)); }
  .not_started .crest img { filter: grayscale(.65) brightness(.7); }
  .crest .glyph { font-size: 40px; color: #5a5440; }

  /* The title word — the marquee. Gold gradient text in a serif face to evoke the in-game lettering;
     web fonts can't load in the sandbox, so a serif system stack carries it. */
  .ttl { margin-top: 9px; font-family: "Cinzel", "Trajan Pro", "Bodoni MT", Georgia, "Times New Roman", serif; font-size: 18px; font-weight: 700; letter-spacing: .03em; line-height: 1.15; background: linear-gradient(180deg, #f7e9b4 0%, #d8b25e 52%, #a87f2e 100%); -webkit-background-clip: text; background-clip: text; color: transparent; }
  .not_started .ttl { background: linear-gradient(180deg, #c7cad6, #6d7283); -webkit-background-clip: text; background-clip: text; }
  .in_progress .ttl { filter: saturate(.92); }

  .gild { margin-top: 5px; font-size: 11px; font-weight: 700; letter-spacing: .12em; color: #f0d27a; text-transform: uppercase; }
  .gild .lr { color: #c6a14a; }

  .src { margin-top: 6px; font-size: 11px; letter-spacing: .03em; color: #8f93a4; }
  .earned .src { color: #b6a981; }

  .prog { margin-top: 11px; width: 100%; height: 5px; border-radius: 999px; background: #211f18; overflow: hidden; }
  .fill { height: 100%; border-radius: 999px; background: linear-gradient(90deg, #b98f3e, #e3c878); }
  .earned .fill { background: linear-gradient(90deg, #d9b65f, #f6e6a8); }
  .not_started .fill { background: #4a4f5c; }
  .count { margin-top: 6px; font-size: 10.5px; font-weight: 600; letter-spacing: .03em; color: #9a9276; font-variant-numeric: tabular-nums; }
  .earned .count { color: #cdbb84; }

  /* Hover panel — the unlock requirement and exact tally, anchored to the tile (see triumphs .panel). */
  .panel { position: absolute; left: 0; top: calc(100% + 7px); width: 280px; max-width: 92vw; text-align: left; background: #0a0b0e; border: 1px solid #2c2920; border-top: 2px solid #c6a14a; border-radius: 8px; padding: 12px 13px; box-shadow: 0 12px 32px rgba(0,0,0,.7); opacity: 0; visibility: hidden; transition: opacity .12s; z-index: 50; pointer-events: none; }
  .tile:hover .panel { opacity: 1; visibility: visible; }
  .panel .pttl { font-size: 13px; font-weight: 700; color: #f0d27a; letter-spacing: .04em; }
  .panel .psrc { font-size: 11px; color: #8f93a4; margin-top: 2px; }
  .panel .preq { font-size: 12px; color: #aeb3bb; line-height: 1.45; margin-top: 9px; }
  .panel .pstat { display: flex; justify-content: space-between; gap: 10px; font-size: 11.5px; margin-top: 10px; color: #cfd3d9; }
  .panel .pstat .k { color: #8b8f9e; }
  .panel .pearned { margin-top: 9px; font-size: 11px; font-weight: 700; letter-spacing: .08em; color: #6fcf8a; text-transform: uppercase; }
  /* "What's left" — the seal's still-incomplete Triumphs, each with its live closeness. */
  .panel .psect { font-size: 9.5px; letter-spacing: .1em; color: #b58e3d; font-weight: 700; margin: 11px 0 6px; }
  .rem { list-style: none; margin: 0; padding: 0; max-height: 232px; overflow: auto; }
  .rem li { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; padding: 4px 0; border-top: 1px solid #1b1a16; font-size: 11.5px; }
  .rem li:first-child { border-top: 0; }
  .rem .rn { color: #d2d5dd; min-width: 0; }
  .rem .rp { flex: none; font-size: 10.5px; font-weight: 600; color: #9a9276; font-variant-numeric: tabular-nums; }
  .rem .rp.started { color: #e3c878; }
  .rem .more { color: #8b8f9e; font-style: italic; border-top: 1px solid #1b1a16; padding-top: 5px; }
</style>
</head>
<body>
  <div class="card" id="card"><div class="waiting">Loading Titles…</div></div>
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
  function send(m) { parent.postMessage(m, "*"); }
  function notify(method, params) { send({ jsonrpc: "2.0", method: method, params: params || {} }); }
  function sizeChanged() { notify("ui/notifications/size-changed", { height: document.documentElement.scrollHeight }); }
  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function clamp(n) { n = Number(n) || 0; return n < 0 ? 0 : n > 100 ? 100 : n; }

  // Resolve a CDN path to its inlined data: URI, falling back to the remote URL (works outside the
  // sandbox). A data: URI is used verbatim; only a bare path needs escaping into the attribute.
  function imgSrc(path) { return ICONS[path] ? ICONS[path] : BUNGIE + esc(path); }

  function crest(tile) {
    if (!tile.icon) return '<div class="crest"><span class="glyph">\\u2756</span></div>';
    return '<div class="crest"><img src="' + imgSrc(tile.icon) + '" alt="" /></div>';
  }

  // A gilded title shows its laurel-wrapped count, mirroring the in-game gilding badge.
  function gild(tile) {
    if (tile.status !== "earned" || !tile.gilded) return "";
    return '<div class="gild"><span class="lr">\\u028a</span> Gilded ' + esc(tile.gilded) + ' <span class="lr">\\u025e</span></div>';
  }

  // The face count: earned reads "Complete" (with a gildable hint), otherwise the live tally.
  function countText(tile) {
    if (tile.status === "earned") return tile.gildable && !tile.gilded ? "Complete \\u00b7 gildable" : "Complete";
    var tally = tile.total ? esc(tile.complete) + " / " + esc(tile.total) + " Triumphs" : "";
    return tally ? tally + " \\u00b7 " + clamp(tile.percent) + "%" : clamp(tile.percent) + "%";
  }

  // The remaining (still-incomplete) Triumphs — the answer to "what's left for this title", with
  // each one's live closeness. Capped so a 30-Triumph seal doesn't overflow the panel.
  function remainingHtml(tile) {
    var rem = tile.remaining || [];
    if (!rem.length) return "";
    var CAP = 14;
    var rows = rem.slice(0, CAP).map(function (r) {
      var started = r.percent > 0;
      var pct = started ? '<span class="rp started">' + clamp(r.percent) + '%</span>' : '<span class="rp">\\u2014</span>';
      return '<li><span class="rn">' + esc(r.name) + "</span>" + pct + "</li>";
    });
    if (rem.length > CAP) rows.push('<li class="more">+ ' + (rem.length - CAP) + " more</li>");
    return '<div class="psect">WHAT\\u2019S LEFT \\u00b7 ' + rem.length + '</div><ul class="rem">' + rows.join("") + "</ul>";
  }

  function panelHtml(tile) {
    var req = tile.requirement ? '<div class="preq">' + esc(tile.requirement) + "</div>" : "";
    var body = tile.status === "earned"
      ? '<div class="pearned">\\u2713 Title earned' + (tile.gilded ? " \\u00b7 gilded \\u00d7" + esc(tile.gilded) : "") + "</div>"
      : remainingHtml(tile);
    return '<div class="panel"><div class="pttl">' + esc(tile.title) + '</div>' +
      '<div class="psrc">' + esc(tile.name) + " Seal</div>" + req + body + "</div>";
  }

  function tileHtml(tile) {
    var cls = "tile " + (tile.status || "not_started");
    var pct = tile.status === "earned" ? 100 : clamp(tile.percent);
    return '<div class="' + cls + '">' + crest(tile) +
      '<div class="ttl">' + esc(tile.title) + "</div>" + gild(tile) +
      '<div class="src">' + esc(tile.name) + "</div>" +
      '<div class="prog"><div class="fill" style="width:' + pct + '%"></div></div>' +
      '<div class="count">' + countText(tile) + "</div>" +
      panelHtml(tile) + "</div>";
  }

  function render(data) {
    ICONS = data.icons || {};
    var tiles = data.tiles || [];
    var body = tiles.length
      ? '<div class="grid">' + tiles.map(tileHtml).join("") + "</div>"
      : '<div class="empty">No titles found.</div>';
    document.getElementById("card").innerHTML =
      "<header><h1>" + esc(data.title) + '</h1><div class="subtitle">' + esc(data.subtitle) + "</div></header>" + body;
    sizeChanged();
  }

  // A tooltip can't render outside the iframe, so a tile near an edge gets its hover panel clipped.
  // On hover, re-anchor the panel to stay inside the viewport: centered over its tile, nudged in at
  // either side, kept below unless that would clip — then flipped above. Delegated from mouseover.
  function clampTip(host) {
    var tip = host.querySelector(".panel");
    if (!tip) return;
    var margin = 8;
    tip.style.maxWidth = (window.innerWidth - margin * 2) + "px";
    var h = host.getBoundingClientRect();
    var t = tip.getBoundingClientRect();
    var left = h.left + h.width / 2 - t.width / 2;
    left = Math.max(margin, Math.min(left, window.innerWidth - margin - t.width));
    tip.style.left = (left - h.left) + "px";
    tip.style.right = "auto";
    var roomBelow = h.bottom + t.height + margin <= window.innerHeight;
    var roomAbove = t.height + margin <= h.top;
    var below = roomBelow || !roomAbove;
    tip.style.top = below ? "calc(100% + 7px)" : "auto";
    tip.style.bottom = below ? "auto" : "calc(100% + 7px)";
  }

  document.addEventListener("mouseover", function (e) {
    var host = e.target.closest && e.target.closest(".tile");
    if (host) clampTip(host);
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
  send({ jsonrpc: "2.0", id: INIT_ID, method: "ui/initialize", params: { appInfo: { name: "destiny2-titles", version: "1.0.0" }, appCapabilities: {}, protocolVersion: "2026-01-26" } });
  sizeChanged();
})();
`;
