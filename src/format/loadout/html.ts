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
 * The same template serves every loadout; the data varies per tool call. It shows a "waiting"
 * shell on load so a host that renders the iframe is visible even before data arrives.
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
  .card { max-width: 460px; border: 1px solid #2b2d36; border-radius: 12px; overflow: hidden; }
  header { padding: 14px 16px; background: #1c1e26; border-bottom: 1px solid #2b2d36; }
  header h1 { margin: 0; font-size: 16px; letter-spacing: .04em; }
  header .subtitle { margin-top: 2px; font-size: 12px; color: #9a9db0; }
  .waiting { padding: 18px 16px; color: #6f7287; font-size: 13px; }
  section { padding: 10px 16px; border-top: 1px solid #23252e; }
  section:first-of-type { border-top: none; }
  h2 { margin: 0 0 6px; font-size: 10px; letter-spacing: .12em; color: #6f7287; font-weight: 600; }
  /* Fixed 3-column grid so name / type / element line up across every row and section. */
  .row { display: grid; grid-template-columns: minmax(0, 1fr) 124px 76px; align-items: center; gap: 10px; padding: 3px 0; }
  .row .name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .row.exotic .name { color: #f5d863; font-weight: 600; }
  .row.empty .name { color: #54566a; font-style: italic; }
  .row .middle { color: #9a9db0; font-size: 12px; }
  .row .el { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; color: #c4c6d4; }
  .row .el.dot::before { content: ""; width: 8px; height: 8px; border-radius: 50%; background: var(--elc, #8a8d9c); }
  .row .el.muted { color: #54566a; font-style: italic; }
  footer { padding: 12px 16px; border-top: 1px solid #2b2d36; background: #1c1e26; }
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
  var ELEMENT_COLOR = { Strand: "#34d399", Arc: "#7dd3fc", Solar: "#fb923c", Void: "#a855f7", Stasis: "#60a5fa", Kinetic: "#d4d4d8" };
  var INIT_ID = 1;
  var nextId = 2;
  function send(m) { parent.postMessage(m, "*"); }
  function notify(method, params) { send({ jsonrpc: "2.0", method: method, params: params || {} }); }
  function sizeChanged() { notify("ui/notifications/size-changed", { height: document.documentElement.scrollHeight }); }
  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function elCell(row) {
    if (row.empty) return '<span class="el muted">(empty)</span>';
    if (row.element) return '<span class="el dot" style="--elc: ' + (ELEMENT_COLOR[row.element] || "#8a8d9c") + '">' + esc(row.element) + "</span>";
    return '<span class="el"></span>';
  }

  function rowHtml(row) {
    var cls = "row" + (row.rarity === "Exotic" ? " exotic" : "") + (row.empty ? " empty" : "");
    return '<div class="' + cls + '"><span class="name">' + esc(row.name) + '</span><span class="middle">' + esc(row.middle) + "</span>" + elCell(row) + "</div>";
  }

  function render(data) {
    var sections = (data.sections || []).map(function (s) {
      return "<section><h2>" + esc(s.label) + "</h2>" + (s.rows || []).map(rowHtml).join("") + "</section>";
    }).join("");
    var footer = data.action ? '<footer><button id="act">' + esc(data.action.label) + "</button></footer>" : "";
    document.getElementById("card").innerHTML =
      "<header><h1>" + esc(data.title) + '</h1><div class="subtitle">' + esc(data.subtitle) + "</div></header>" + sections + footer;
    if (data.action) {
      var btn = document.getElementById("act");
      btn.addEventListener("click", function () {
        btn.disabled = true;
        send({ jsonrpc: "2.0", id: nextId++, method: "tools/call", params: { name: data.action.toolName, arguments: data.action.args } });
      });
    }
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
      if (data && data.sections) render(data);
    }
  });

  // View initiates the handshake, then reports its size so the host reveals the iframe.
  // protocolVersion is REQUIRED — a strict host rejects ui/initialize without it (= blank iframe).
  send({ jsonrpc: "2.0", id: INIT_ID, method: "ui/initialize", params: { appInfo: { name: "destiny2-loadout", version: "1.0.0" }, appCapabilities: {}, protocolVersion: "2026-01-26" } });
  sizeChanged();
})();
`;
