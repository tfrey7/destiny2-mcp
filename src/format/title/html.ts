import { COMMON_CLIENT } from "../card_client.js";
import { TITLE_RENDER } from "./client.js";

/** URI of the registered MCP Apps UI template show_title links to via `_meta.ui.resourceUri`. */
export const TITLE_UI_RESOURCE_URI = "ui://destiny2/title";

/** MIME the host declared it can render (SEP-1865); must match the registered resource. */
export const TITLE_UI_MIME = "text/html;profile=mcp-app";

/**
 * The MCP Apps single-title template — a static HTML document the host fetches once via
 * `resources/read` and renders in a sandboxed iframe. Like the other cards it carries no data: it
 * initiates the `ui/initialize` handshake, then renders client-side from the `structuredContent` (a
 * TitleDetailModel) the host pushes over `ui/notifications/tool-result`.
 *
 * Where the gallery shows every seal as a tile with a hover panel, this lays ONE title out in full:
 * a hero header (the gold emblem, the title word in the in-game gold-gothic style, the seal's source,
 * the unlock requirement, and an overall completion bar) above a grid of its Triumphs — each an
 * always-visible row with its icon, name, score, live progress, and objective lines. No hover; the
 * detail is the card. Completed Triumphs read gold and checked; in-progress take an amber accent;
 * unstarted ones are dimmed.
 */
export function renderTitleTemplate(): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 18px; font: 14px/1.4 system-ui, -apple-system, "Segoe UI", sans-serif; background: radial-gradient(120% 70% at 50% 0%, #15161e 0%, #0a0b0f 60%); color: #e9eaf0; }
  .card { max-width: 820px; margin: 0 auto; }

  /* Hero header — the seal crest beside the title word, requirement, and overall completion. */
  .hero { display: flex; gap: 18px; align-items: center; padding: 4px 4px 16px; border-bottom: 1px solid #2a2620; }
  .hero .crest { flex: none; width: 96px; height: 96px; display: flex; align-items: center; justify-content: center; line-height: 0; }
  .hero .crest img { width: 100%; height: 100%; object-fit: contain; filter: drop-shadow(0 0 14px rgba(228,200,120,.4)); }
  .hero.not_started .crest img { filter: grayscale(.6) brightness(.7); }
  .hero .crest .glyph { font-size: 56px; color: #5a5440; }
  .hmeta { min-width: 0; flex: 1; }
  .ttl { font-family: "Cinzel", "Trajan Pro", "Bodoni MT", Georgia, "Times New Roman", serif; font-size: 30px; font-weight: 700; letter-spacing: .03em; line-height: 1.05; background: linear-gradient(180deg, #f7e9b4 0%, #d8b25e 52%, #a87f2e 100%); -webkit-background-clip: text; background-clip: text; color: transparent; }
  .src { margin-top: 3px; font-size: 13px; letter-spacing: .03em; color: #9aa0b2; }
  .req { margin-top: 9px; font-size: 12.5px; color: #aeb3bb; line-height: 1.45; }
  .badge { display: inline-flex; align-items: center; gap: 6px; margin-top: 11px; font-size: 11px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; padding: 4px 11px; border-radius: 999px; }
  .badge.earned { color: #0c0d11; background: linear-gradient(180deg, #f6e6a8, #d8b25e); }
  .badge.progress { color: #e3c878; background: #1c1a12; border: 1px solid #4a4434; }
  .badge .lr { color: inherit; opacity: .8; }
  .ovr { margin-top: 13px; }
  .ovr .bar { height: 7px; border-radius: 999px; background: #211f18; overflow: hidden; }
  .ovr .fill { height: 100%; border-radius: 999px; background: linear-gradient(90deg, #b98f3e, #e3c878); }
  .earned .ovr .fill { background: linear-gradient(90deg, #d9b65f, #f6e6a8); }
  .ovr .lbl { margin-top: 6px; font-size: 11.5px; font-weight: 600; color: #b6a981; font-variant-numeric: tabular-nums; }

  .sectlabel { margin: 16px 2px 9px; font-size: 10px; letter-spacing: .18em; color: #b58e3d; font-weight: 700; text-transform: uppercase; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(330px, 1fr)); gap: 9px; }

  /* Each Triumph is an always-open row (no hover) — icon, name, score, progress, objectives. */
  .tr { display: flex; gap: 11px; padding: 11px 12px; border: 1px solid #2a2823; border-left-width: 3px; border-radius: 8px; background: #14151b; }
  .tr.completed { border-left-color: #f0d27a; background: linear-gradient(100deg, #181712 60%, rgba(180,142,56,.10)); }
  .tr.in_progress { border-left-color: #c6a14a; }
  .tr.not_started { border-left-color: #3c3f47; opacity: .82; }
  .tr.obscured { opacity: .66; }
  .thumb { flex: none; width: 42px; height: 42px; border-radius: 6px; background: #211f18; border: 1px solid #34301f; display: flex; align-items: center; justify-content: center; line-height: 0; overflow: hidden; }
  .thumb img { width: 100%; height: 100%; object-fit: cover; }
  .completed .thumb img { } .not_started .thumb img { filter: grayscale(.5) brightness(.8); }
  .thumb .glyph { font-size: 20px; color: #6c6650; }
  .trmeta { min-width: 0; flex: 1; }
  .trhead { display: flex; gap: 8px; align-items: baseline; justify-content: space-between; }
  .trname { font-weight: 600; font-size: 13px; color: #eef0f5; line-height: 1.2; }
  .completed .trname { color: #f3e7c4; }
  .gem { flex: none; display: inline-flex; align-items: center; gap: 3px; font-size: 11px; font-weight: 700; color: #5fd3e0; }
  .gem .d { font-size: 9px; }
  .check { flex: none; color: #6fcf8a; font-size: 13px; font-weight: 700; }
  .trdesc { margin-top: 4px; font-size: 11.5px; color: #9298a4; line-height: 1.4; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
  .obj { margin-top: 8px; }
  .ol { display: flex; justify-content: space-between; gap: 8px; font-size: 11px; color: #c4c8d0; }
  .oc { color: #9a9276; font-variant-numeric: tabular-nums; flex: none; }
  .obar { margin-top: 3px; height: 3px; border-radius: 999px; background: #211f18; overflow: hidden; }
  .obar > span { display: block; height: 100%; background: linear-gradient(90deg, #b98f3e, #e3c878); }
  .waiting, .empty { padding: 30px 4px; color: #6f7287; font-size: 13px; text-align: center; }
</style>
</head>
<body>
  <div class="card" id="card"><div class="waiting">Loading title…</div></div>
  <script>${CLIENT_SCRIPT}</script>
</body>
</html>`;
}

// Client-side bridge + renderer. Plain ES5-ish JS (no template literals) so it survives being
// embedded in the outer template literal untouched. Implements the iframe (View) side of the MCP
// Apps handshake (View INITIATES per SEP-1865): send ui/initialize, await the host's result, send
// ui/notifications/initialized, then report size. Renders on the host's tool-result push.
const CLIENT_SCRIPT = `
(function () {
${COMMON_CLIENT}
${TITLE_RENDER}
  var INIT_ID = 1;

  function render(data) {
    ICONS = data.icons || {};
    document.getElementById("card").innerHTML = Title.full(data);
    sizeChanged();
  }

  window.addEventListener("message", function (e) {
    var m = e.data;
    if (!m || typeof m !== "object") return;
    if (m.id === INIT_ID && m.result) { notify("ui/notifications/initialized", {}); sizeChanged(); return; }
    if (m.method === "ui/notifications/tool-result" || m.method === "ui/notifications/tool-input") {
      var data = m.params && (m.params.structuredContent || (m.params.result && m.params.result.structuredContent));
      if (data && data.triumphs) render(data);
    }
  });

  // protocolVersion is REQUIRED — a strict host rejects ui/initialize without it (= blank iframe).
  send({ jsonrpc: "2.0", id: INIT_ID, method: "ui/initialize", params: { appInfo: { name: "destiny2-title", version: "1.0.0" }, appCapabilities: {}, protocolVersion: "2026-01-26" } });
  sizeChanged();
})();
`;
