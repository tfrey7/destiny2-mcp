/** URI of the registered MCP Apps UI template activity_recap links to via `_meta.ui.resourceUri`. */
export const RECAP_UI_RESOURCE_URI = "ui://destiny2/recap";

/** MIME the host declared it can render (SEP-1865); must match the registered resource. */
export const RECAP_UI_MIME = "text/html;profile=mcp-app";

/**
 * The MCP Apps activity-recap template — a single static HTML document the host fetches once via
 * `resources/read` and renders in a sandboxed iframe. Like the other cards it carries no data: it
 * initiates the `ui/initialize` handshake, then renders client-side from the `structuredContent`
 * (a RecapCardModel) the host pushes over `ui/notifications/tool-result`.
 *
 * The card is a time-series dashboard: a period header over the window's marquee PGCR art, a banner
 * of four headline stats (activities / time / KDR / clears), a by-mode bar breakdown, and the notable
 * runs. A "waiting" shell shows before data arrives.
 */
export function renderRecapTemplate(): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 16px; font: 14px/1.4 system-ui, -apple-system, "Segoe UI", sans-serif; background: #0c0d11; color: #e9eaf0; }
  .card { max-width: 620px; margin: 0 auto; border: 1px solid #2a2823; border-radius: 10px; overflow: hidden; background: #101117; }
  .waiting { padding: 28px 16px; color: #6f7287; font-size: 13px; }
  .empty { padding: 24px 16px; color: #6f7287; font-size: 13px; }
  /* Header sits over the window's PGCR art, darkened so the title and stat tiles stay legible. */
  .hero { position: relative; padding: 15px 16px 16px; background: #15161c; background-size: cover; background-position: center; }
  .hero::before { content: ""; position: absolute; inset: 0; background: linear-gradient(180deg, rgba(8,9,12,.62), rgba(8,9,12,.9)); }
  .hero > * { position: relative; }
  .htitle { font-size: 14px; letter-spacing: .17em; color: #d9bd72; text-transform: uppercase; font-weight: 700; }
  .hsub { margin-top: 3px; font-size: 12px; color: #c2c5d2; }
  .stats { margin-top: 14px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
  .stat { background: rgba(20,21,28,.62); border: 1px solid #2c2920; border-radius: 8px; padding: 9px 6px; text-align: center; }
  .stat .v { font-size: 19px; font-weight: 700; color: #f0ead9; line-height: 1.15; }
  .stat .l { margin-top: 2px; font-size: 10px; letter-spacing: .04em; color: #9a9276; text-transform: uppercase; }
  .body { padding: 14px 16px 16px; }
  .sect { font-size: 9.5px; letter-spacing: .1em; color: #b58e3d; font-weight: 700; margin: 0 0 8px; }
  .sect.gap { margin-top: 16px; }
  .mode { display: grid; grid-template-columns: 88px 1fr auto; align-items: center; gap: 10px; margin-bottom: 7px; font-size: 12px; }
  .mode .mname { color: #cfd3d9; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .mtrack { height: 8px; border-radius: 999px; background: #1c1a14; overflow: hidden; }
  .mtrack > span { display: block; height: 100%; border-radius: 999px; background: linear-gradient(90deg, #b98f3e, #e3c878); }
  .mcount { font-variant-numeric: tabular-nums; color: #9a9276; font-size: 11.5px; white-space: nowrap; }
  .mcount b { color: #e9eaf0; font-weight: 700; }
  .note { display: flex; align-items: baseline; gap: 8px; margin-bottom: 6px; font-size: 12px; }
  .note .gem { flex: none; color: #c6a14a; }
  .note .nlabel { flex: none; width: 64px; color: #9a9276; font-size: 11px; letter-spacing: .03em; }
  .note .nname { flex: 1; color: #e9eaf0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .note .ndetail { flex: none; color: #d9bd72; font-weight: 700; font-variant-numeric: tabular-nums; }
</style>
</head>
<body>
  <div class="card" id="card"><div class="waiting">Loading recap…</div></div>
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

  function statsHtml(stats) {
    return (stats || []).map(function (s) {
      return '<div class="stat"><div class="v">' + esc(s.value) + '</div><div class="l">' + esc(s.label) + "</div></div>";
    }).join("");
  }

  // Each mode row: name, a fill bar scaled to the busiest mode, and the run count with its clears.
  function modesHtml(modes) {
    if (!modes || !modes.length) return "";
    var rows = modes.map(function (m) {
      var tail = m.clears > 0 ? "<b>" + esc(m.count) + "</b> · " + esc(m.clears) + " clears" : "<b>" + esc(m.count) + "</b>";
      return '<div class="mode"><span class="mname">' + esc(m.mode) + "</span>" +
        '<span class="mtrack"><span style="width:' + clamp(m.widthPercent) + '%"></span></span>' +
        '<span class="mcount">' + tail + "</span></div>";
    }).join("");
    return '<div class="sect">BY MODE</div>' + rows;
  }

  function notableHtml(notable) {
    if (!notable || !notable.length) return "";
    var rows = notable.map(function (n) {
      return '<div class="note"><span class="gem">◆</span><span class="nlabel">' + esc(n.label) + "</span>" +
        '<span class="nname">' + esc(n.name) + '</span><span class="ndetail">' + esc(n.detail) + "</span></div>";
    }).join("");
    return '<div class="sect gap">NOTABLE</div>' + rows;
  }

  function render(data) {
    ICONS = data.icons || {};
    var heroStyle = data.pgcrImage ? ' style="background-image:url(' + imgSrc(data.pgcrImage) + ')"' : "";
    var hero =
      '<div class="hero"' + heroStyle + '>' +
        '<div class="htitle">' + esc(data.title) + '</div>' +
        '<div class="hsub">' + esc(data.subtitle) + '</div>' +
        '<div class="stats">' + statsHtml(data.stats) + "</div></div>";
    var body = data.empty
      ? '<div class="empty">No activities in this window.</div>'
      : '<div class="body">' + modesHtml(data.modes) + notableHtml(data.notable) + "</div>";

    document.getElementById("card").innerHTML = hero + body;
    sizeChanged();
  }

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
  send({ jsonrpc: "2.0", id: INIT_ID, method: "ui/initialize", params: { appInfo: { name: "destiny2-recap", version: "1.0.0" }, appCapabilities: {}, protocolVersion: "2026-01-26" } });
  sizeChanged();
})();
`;
