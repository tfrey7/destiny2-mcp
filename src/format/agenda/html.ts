import { ARMOR_RENDER } from "../armor/client.js";
import { COMMON_CLIENT } from "../card_client.js";
import { TITLE_RENDER } from "../title/client.js";
import { TRIUMPH_RENDER } from "../triumphs/client.js";
import { WEAPON_RENDER } from "../weapon/client.js";

/** URI of the registered MCP Apps UI template show_agenda links to via `_meta.ui.resourceUri`. */
export const AGENDA_UI_RESOURCE_URI = "ui://destiny2/agenda";

/** MIME the host declared it can render (SEP-1865); must match the registered resource. */
export const AGENDA_UI_MIME = "text/html;profile=mcp-app";

/**
 * The MCP Apps agenda template — a single static HTML document the host fetches once via
 * `resources/read` and renders in a sandboxed iframe. Like the loadout template it carries no data:
 * it initiates the `ui/initialize` handshake, then renders client-side from the `structuredContent`
 * (an agendaCardModel) the host pushes over `ui/notifications/tool-result`.
 *
 * The card lays out as a vertical play-session timeline: a header (title, session length, objective),
 * then one band per phase — each with a coloured rail node, a time budget, and its activities. Each
 * activity shows an optional reward/quest icon, its name and time estimate, a progress bar with its
 * count, an expiry flag, and place/mode chips. The same template serves every agenda; the data varies
 * per call. A "waiting" shell shows before data arrives.
 */
export function renderAgendaTemplate(): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 16px; font: 14px/1.4 system-ui, -apple-system, "Segoe UI", sans-serif; background: #14151a; color: #e9eaf0; }
  .card { max-width: 600px; border: 1px solid #2b2d36; border-radius: 12px; background: #15171c; }
  header { padding: 14px 16px; background: #1c1e26; border-bottom: 1px solid #2b2d36; border-radius: 12px 12px 0 0; }
  .htop { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; }
  header h1 { margin: 0; font-size: 16px; letter-spacing: .04em; }
  header .clock { flex: none; font-size: 12px; font-weight: 600; color: #c7cad8; background: #14151a; border: 1px solid #2b2d36; border-radius: 999px; padding: 2px 10px; white-space: nowrap; }
  .objective { margin-top: 8px; display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; color: #ffd479; background: rgba(214,158,46,.12); border: 1px solid rgba(214,158,46,.28); border-radius: 999px; padding: 3px 11px; }
  .waiting { padding: 18px 16px; color: #6f7287; font-size: 13px; }
  .body { padding: 6px 16px 18px; }
  /* A phase band: a coloured rail down the left with a node dot, the phase label + budget, then items. */
  .phase { position: relative; padding: 12px 0 4px 22px; }
  .phase::before { content: ""; position: absolute; left: 5px; top: 20px; bottom: 0; width: 2px; background: #2b2d36; }
  .phase:last-child::before { display: none; }
  .node { position: absolute; left: 0; top: 16px; width: 12px; height: 12px; border-radius: 50%; border: 2px solid #14151a; box-shadow: 0 0 0 1px #2b2d36; }
  .phead { display: flex; align-items: baseline; gap: 8px; margin-bottom: 4px; }
  .plabel { font-size: 11px; letter-spacing: .12em; font-weight: 700; color: #c7cad8; }
  .pmin { font-size: 11px; color: #7c7f93; }
  .aitem { display: flex; gap: 11px; align-items: flex-start; padding: 9px 0; border-top: 1px solid #1f212a; }
  .aitem:first-of-type { border-top: none; }
  .thumb { flex: none; line-height: 0; }
  .thumb img { width: 38px; height: 38px; border-radius: 6px; background: #24272f; display: block; }
  .abullet { flex: none; width: 38px; height: 38px; border-radius: 6px; background: #20232c; display: flex; align-items: center; justify-content: center; font-size: 17px; }
  .ameta { min-width: 0; flex: 1; }
  .arow { display: flex; align-items: baseline; gap: 8px; }
  .aname { font-weight: 600; color: #e9eaf0; line-height: 1.25; }
  .atime { flex: none; margin-left: auto; font-size: 11px; color: #7c7f93; white-space: nowrap; }
  .exp { flex: none; font-size: 11px; font-weight: 600; color: #ff9a8b; background: rgba(255,90,70,.14); border-radius: 999px; padding: 0 7px; white-space: nowrap; }
  .bar { position: relative; height: 6px; border-radius: 999px; background: #23252e; margin: 6px 0 2px; overflow: hidden; }
  .fill { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 999px; }
  .prog { display: flex; align-items: center; gap: 8px; }
  .prog .bar { flex: 1; margin: 6px 0; }
  .count { flex: none; font-size: 11px; color: #9a9db0; font-variant-numeric: tabular-nums; }
  .detail { margin-top: 3px; font-size: 12px; color: #9a9db0; }
  .chips { margin-top: 5px; display: flex; flex-wrap: wrap; gap: 5px; }
  .chip { font-size: 10px; letter-spacing: .03em; color: #aeb1c2; background: #20222b; border: 1px solid #2b2d36; border-radius: 999px; padding: 1px 8px; }
  /* A name (or the objective pill) linked to a card: a hover host that reveals a floating card. */
  .ehost { position: relative; cursor: help; }
  .ehost:hover { color: #fff; }
  .aname .ehost { border-bottom: 1px dotted #565a70; }
  .hovercard { position: absolute; left: 0; top: 122%; z-index: 60; width: 372px; max-width: 92vw; opacity: 0; visibility: hidden; transition: opacity .12s; pointer-events: none; }
  .ehost:hover .hovercard { opacity: 1; visibility: visible; }
  /* The card surface inside the popover. All card CSS is scoped under .embed (+ a kind class) so a
     card's bare class names (.thumb, .nm, .grid, .stats, .fill, …) can't clash with the agenda's own. */
  .embed { border: 1px solid #343a45; border-radius: 10px; background: #15171c; overflow: hidden; box-shadow: 0 14px 36px rgba(0,0,0,.7); }
  .embed header { display: flex; gap: 11px; align-items: center; padding: 10px 12px; background: #1c1e26; border-bottom: 2px solid #2b2d36; }
  .embed .thumb { position: relative; flex: none; line-height: 0; }
  .embed .thumb .ic { width: 46px; height: 46px; border-radius: 6px; background: #24272f; display: block; }
  .embed .thumb .pip { position: absolute; right: 2px; bottom: 2px; width: 17px; height: 17px; filter: drop-shadow(0 0 2px #000) drop-shadow(0 0 2px #000); }
  .embed .thumb .wm { position: absolute; left: 0; top: 0; width: 46px; height: 46px; border-radius: 6px; pointer-events: none; }
  .embed .thumb .tier { position: absolute; right: -4px; bottom: -4px; min-width: 18px; height: 18px; padding: 0 4px; border-radius: 9px; background: #c9a227; color: #1a1300; font-size: 10px; font-weight: 700; line-height: 18px; text-align: center; box-shadow: 0 0 0 2px #1c1e26; }
  .embed .htext { flex: 1; min-width: 0; }
  .embed a.nm, .embed .nm { display: inline-block; font-size: 15px; font-weight: 700; text-decoration: none; color: #e9eaf0; }
  .embed .attrs { margin-top: 2px; font-size: 11.5px; color: #9a9db0; }
  .embed .attrs .dot { color: #4a4d5c; margin: 0 5px; }
  .embed .tip { position: absolute; opacity: 0; visibility: hidden; pointer-events: none; }
  /* Weapon body: intrinsic frame + perk grid. */
  .embed-weapon .intrinsic { display: flex; align-items: center; gap: 9px; padding: 9px 12px; border-bottom: 1px solid #23252e; }
  .embed-weapon .intrinsic .ico { width: 32px; height: 32px; border-radius: 50%; background: #2a2d36; padding: 3px; flex: none; }
  .embed-weapon .intrinsic .ititle { font-size: 9px; letter-spacing: .12em; color: #6f7287; font-weight: 600; }
  .embed-weapon .intrinsic .iname { font-weight: 600; font-size: 12.5px; }
  .embed-weapon .grid { display: flex; flex-wrap: wrap; gap: 6px 12px; padding: 10px 12px 12px; }
  .embed-weapon .col { flex: 1 1 0; min-width: 118px; }
  .embed-weapon .colhead { padding-bottom: 5px; margin-bottom: 4px; border-bottom: 1px solid #23252e; font-size: 9px; letter-spacing: .12em; color: #6f7287; font-weight: 600; }
  .embed-weapon .col.origin .colhead { color: #c9a227; }
  .embed-weapon .plug { display: flex; align-items: center; gap: 7px; padding: 4px 5px; border-radius: 6px; }
  .embed-weapon .plug.sel { background: rgba(201,162,39,.12); }
  .embed-weapon .plug .pic { width: 26px; height: 26px; border-radius: 50%; background: #2a2d36; padding: 2px; flex: none; }
  .embed-weapon .plug.sel .pic { box-shadow: 0 0 0 2px #c9a227; }
  .embed-weapon .plug .pn { font-size: 11.5px; line-height: 1.2; color: #c8ccd6; min-width: 0; }
  .embed-weapon .plug.sel .pn { color: #f0d98a; font-weight: 600; }
  /* Armor body: the six archetype stats + the exotic perk. */
  .embed-armor .ebody { padding: 12px 14px; }
  .embed-armor .stats { display: grid; grid-template-columns: auto 2.4em 1fr; gap: 6px 10px; align-items: center; }
  .embed-armor .sl { font-size: 10.5px; letter-spacing: .06em; color: #9a9db0; text-transform: uppercase; white-space: nowrap; }
  .embed-armor .sv { font-size: 13px; font-weight: 700; text-align: right; font-variant-numeric: tabular-nums; }
  .embed-armor .track { height: 8px; border-radius: 5px; background: #23252e; overflow: hidden; }
  .embed-armor .stats .fill { position: static; height: 100%; border-radius: 5px; background: linear-gradient(90deg, #6d8cc0, #acc4ec); }
  .embed-armor .statnote { font-size: 12px; color: #9a9db0; }
  .embed-armor .seclabel { margin: 12px 0 7px; font-size: 9px; letter-spacing: .12em; color: #6f7287; font-weight: 600; }
  .embed-armor .intrinsic { display: flex; align-items: flex-start; gap: 10px; padding: 10px; border-radius: 8px; background: rgba(201,162,39,.08); border: 1px solid rgba(201,162,39,.3); }
  .embed-armor .intrinsic .ico { width: 34px; height: 34px; border-radius: 50%; background: #2a2d36; padding: 3px; flex: none; }
  .embed-armor .intrinsic .iname { font-weight: 700; color: #f0d98a; font-size: 13px; }
  .embed-armor .intrinsic .idesc { margin-top: 3px; font-size: 11.5px; line-height: 1.4; color: #c2c6d0; }
  /* Triumph body: icon + name + score, the completion bar, then objectives and reasons. */
  .embed-triumph { background: #0c0d11; }
  .embed-triumph .ehead { display: flex; gap: 10px; align-items: flex-start; padding: 11px 12px; background: linear-gradient(100deg, #15161c 55%, rgba(180,142,56,.12)); border-bottom: 2px solid #2a2823; }
  .embed-triumph .thumb { flex: none; width: 44px; height: 44px; border-radius: 6px; background: #211f18; border: 1px solid #34301f; display: flex; align-items: center; justify-content: center; overflow: hidden; line-height: 0; }
  .embed-triumph .thumb img { width: 100%; height: 100%; object-fit: cover; }
  .embed-triumph .thumb .glyph { font-size: 22px; color: #c6a14a; }
  .embed-triumph .ehmeta { min-width: 0; flex: 1; }
  .embed-triumph .ename { font-weight: 700; font-size: 14px; color: #f0ead9; line-height: 1.25; }
  .embed-triumph .gem { display: inline-flex; align-items: center; gap: 3px; margin-top: 4px; font-size: 11px; font-weight: 700; color: #5fd3e0; }
  .embed-triumph .gem .d { font-size: 9px; }
  .embed-triumph .eseal { margin-top: 3px; font-size: 11px; font-weight: 600; color: #d9bd72; }
  .embed-triumph .ebody { padding: 11px 13px 13px; }
  .embed-triumph .eprog { height: 6px; border-radius: 999px; background: #211f18; overflow: hidden; }
  .embed-triumph .efill { height: 100%; border-radius: 999px; background: linear-gradient(90deg, #b98f3e, #e3c878); }
  .embed-triumph .epct { margin-top: 5px; font-size: 10.5px; color: #9a9276; font-weight: 600; }
  .embed-triumph .edesc { margin: 9px 0 2px; font-size: 12px; line-height: 1.45; color: #aeb3bb; }
  .embed-triumph .sect { font-size: 9.5px; letter-spacing: .1em; color: #b58e3d; font-weight: 700; margin: 11px 0 5px; }
  .embed-triumph .obj { margin-bottom: 7px; }
  .embed-triumph .ol { display: flex; justify-content: space-between; gap: 8px; font-size: 11.5px; color: #cfd3d9; }
  .embed-triumph .olabel { display: flex; align-items: center; gap: 6px; min-width: 0; }
  .embed-triumph .cbox { flex: none; width: 14px; height: 14px; border: 1px solid #4a4434; border-radius: 3px; display: inline-flex; align-items: center; justify-content: center; font-size: 10px; line-height: 1; color: transparent; }
  .embed-triumph .cbox.done { border-color: #5aa86a; background: rgba(90,168,106,.2); color: #6fcf8a; }
  .embed-triumph .oc { color: #9a9276; font-variant-numeric: tabular-nums; flex: none; }
  .embed-triumph .oc.done { color: #6fcf8a; }
  .embed-triumph .obar { margin-top: 4px; height: 3px; border-radius: 999px; background: #211f18; overflow: hidden; }
  .embed-triumph .obar > span { display: block; height: 100%; background: linear-gradient(90deg, #b98f3e, #e3c878); }
  .embed-triumph .obar.done > span { background: #5aa86a; }
  .embed-triumph .why { margin: 0; padding: 0; list-style: none; }
  .embed-triumph .why li { position: relative; padding-left: 13px; font-size: 11.5px; color: #b9bdc9; line-height: 1.5; }
  .embed-triumph .why li::before { content: "›"; position: absolute; left: 2px; color: #c6a14a; }
  .embed-triumph .chips { margin-top: 6px; display: flex; flex-wrap: wrap; gap: 5px; }
  .embed-triumph .chip { font-size: 10px; font-weight: 600; padding: 2px 7px; border-radius: 999px; background: #1a1812; color: #c2ab7e; border: 1px solid #38321f; }
  /* Title body: a compact seal hero (crest + title word + overall bar) then the remaining Triumphs. */
  .embed-title { background: radial-gradient(120% 80% at 50% 0%, #15161e 0%, #0c0d11 70%); }
  .embed-title .hero { display: flex; gap: 12px; align-items: center; padding: 12px 13px; border-bottom: 1px solid #2a2620; }
  .embed-title .crest { flex: none; width: 54px; height: 54px; display: flex; align-items: center; justify-content: center; line-height: 0; }
  .embed-title .crest img { width: 100%; height: 100%; object-fit: contain; filter: drop-shadow(0 0 10px rgba(228,200,120,.35)); }
  .embed-title .hero.not_started .crest img { filter: grayscale(.6) brightness(.7); }
  .embed-title .crest .glyph { font-size: 34px; color: #5a5440; }
  .embed-title .hmeta { min-width: 0; flex: 1; }
  .embed-title .ttl { font-family: "Cinzel", "Trajan Pro", "Bodoni MT", Georgia, serif; font-size: 21px; font-weight: 700; letter-spacing: .03em; line-height: 1.05; background: linear-gradient(180deg, #f7e9b4 0%, #d8b25e 52%, #a87f2e 100%); -webkit-background-clip: text; background-clip: text; color: transparent; }
  .embed-title .src { margin-top: 2px; font-size: 11.5px; color: #9aa0b2; }
  .embed-title .badge { display: none; }
  .embed-title .ovr { margin-top: 8px; }
  .embed-title .ovr .bar { height: 6px; border-radius: 999px; background: #211f18; overflow: hidden; }
  .embed-title .ovr .fill { height: 100%; border-radius: 999px; background: linear-gradient(90deg, #b98f3e, #e3c878); }
  .embed-title .hero.earned .ovr .fill { background: linear-gradient(90deg, #d9b65f, #f6e6a8); }
  .embed-title .ovr .lbl { margin-top: 5px; font-size: 11px; font-weight: 600; color: #b6a981; font-variant-numeric: tabular-nums; }
  .embed-title .tlist { padding: 10px 12px 12px; display: flex; flex-direction: column; gap: 7px; }
  .embed-title .tr { display: flex; gap: 10px; padding: 9px 10px; border: 1px solid #2a2823; border-left-width: 3px; border-radius: 7px; background: #14151b; }
  .embed-title .tr.completed { border-left-color: #f0d27a; }
  .embed-title .tr.in_progress { border-left-color: #c6a14a; }
  .embed-title .tr.not_started { border-left-color: #3c3f47; opacity: .82; }
  .embed-title .tr.obscured { opacity: .66; }
  .embed-title .thumb { flex: none; width: 36px; height: 36px; border-radius: 6px; background: #211f18; border: 1px solid #34301f; display: flex; align-items: center; justify-content: center; overflow: hidden; line-height: 0; }
  .embed-title .thumb img { width: 100%; height: 100%; object-fit: cover; }
  .embed-title .thumb .glyph { font-size: 17px; color: #6c6650; }
  .embed-title .trmeta { min-width: 0; flex: 1; }
  .embed-title .trhead { display: flex; gap: 8px; align-items: baseline; justify-content: space-between; }
  .embed-title .trname { font-weight: 600; font-size: 12.5px; color: #eef0f5; line-height: 1.2; }
  .embed-title .gem { flex: none; display: inline-flex; align-items: center; gap: 3px; font-size: 10.5px; font-weight: 700; color: #5fd3e0; }
  .embed-title .gem .d { font-size: 9px; }
  .embed-title .check { flex: none; color: #6fcf8a; font-size: 12px; font-weight: 700; }
  .embed-title .trdesc { margin-top: 3px; font-size: 11px; color: #9298a4; line-height: 1.4; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
  .embed-title .obj { margin-top: 6px; }
  .embed-title .ol { display: flex; justify-content: space-between; gap: 8px; font-size: 10.5px; color: #c4c8d0; }
  .embed-title .oc { color: #9a9276; font-variant-numeric: tabular-nums; flex: none; }
  .embed-title .obar { margin-top: 3px; height: 3px; border-radius: 999px; background: #211f18; overflow: hidden; }
  .embed-title .obar > span { display: block; height: 100%; background: linear-gradient(90deg, #b98f3e, #e3c878); }
  .embed-title .emore { margin-top: 2px; font-size: 11px; color: #b58e3d; font-weight: 600; text-align: center; }
</style>
</head>
<body>
  <div class="card" id="card"><div class="waiting">Loading agenda…</div></div>
  <script>${CLIENT_SCRIPT}</script>
</body>
</html>`;
}

// Client-side bridge + renderer. Plain ES5-ish JS (no template literals) so it survives being embedded
// in the outer template literal untouched. The shared utilities (esc/img/sizeChanged/clampTip/…) come
// from COMMON_CLIENT and the embedded weapon card's render from WEAPON_RENDER (Weapon.compact); only the
// agenda-specific timeline render + the accordion live here. Implements the iframe (View) side of the
// MCP Apps handshake, which the View INITIATES (per SEP-1865): send ui/initialize, await the host's
// result, send ui/notifications/initialized, then report ui/notifications/size-changed. The agenda is
// visual-only — no action button — so there's no tools/call relay; the embed accordion is local.
const CLIENT_SCRIPT = `
(function () {
${COMMON_CLIENT}
${WEAPON_RENDER}
${ARMOR_RENDER}
${TRIUMPH_RENDER}
${TITLE_RENDER}
  // Per-phase accent, cycled by index — the rail node and progress fill take the phase colour so a
  // glance reads the session's arc (warm green → focus amber → stretch blue → …).
  var ACCENTS = ["#5bbf7a", "#e0a93b", "#5b8fd6", "#b78fdb", "#d6685b"];
  var INIT_ID = 1;

  function thumb(item) {
    if (item.icon) return '<span class="thumb">' + img(item.icon, "") + "</span>";
    return '<span class="abullet">▸</span>';
  }

  function chipsHtml(chips) {
    if (!chips || !chips.length) return "";
    var cells = chips.map(function (c) { return '<span class="chip">' + esc(c) + "</span>"; }).join("");
    return '<div class="chips">' + cells + "</div>";
  }

  function progressHtml(item, accent) {
    if (item.percent == null) {
      return item.progressLabel ? '<div class="detail">' + esc(item.progressLabel) + "</div>" : "";
    }
    var pct = clamp(item.percent);
    var fill = '<div class="bar"><div class="fill" style="width:' + pct + "%;background:" + accent + '"></div></div>';
    var count = item.progressLabel ? '<span class="count">' + esc(item.progressLabel) + "</span>" : "";
    return '<div class="prog">' + fill + count + "</div>";
  }

  // The hover-card popover for an item's embed — its card drawn by the linked card's shared render
  // module (so it matches the standalone card), inside a floating .hovercard the name reveals on hover.
  // Unknown/unwired kinds render nothing (the item stays a plain row).
  function embedHtml(embed) {
    if (!embed) return "";
    var inner = "";
    if (embed.kind === "weapon") inner = '<div class="embed embed-weapon">' + Weapon.compact(embed.card) + "</div>";
    else if (embed.kind === "armor") inner = '<div class="embed embed-armor">' + Armor.compact(embed.card) + "</div>";
    else if (embed.kind === "triumph") inner = '<div class="embed embed-triumph">' + Triumph.compact(embed.tile) + "</div>";
    else if (embed.kind === "title") inner = '<div class="embed embed-title">' + Title.compact(embed.detail) + "</div>";
    if (!inner) return "";
    return '<div class="hovercard">' + inner + "</div>";
  }

  // An item's name — a hover host (with the popover inside) when the item links to a card, plain text
  // otherwise. The host is the name only, so the rest of the row doesn't trigger the card.
  function nameHtml(item) {
    var card = embedHtml(item.embed);
    if (!card) return '<span class="aname">' + esc(item.name) + "</span>";
    return '<span class="aname"><span class="ehost">' + esc(item.name) + card + "</span></span>";
  }

  function itemHtml(item, accent) {
    var time = item.minutes != null ? '<span class="atime">~' + esc(item.minutes) + "m</span>" : "";
    var exp = item.expiring ? '<span class="exp">⏰ expiring</span>' : "";
    var detail = item.detail ? '<div class="detail">' + esc(item.detail) + "</div>" : "";
    return '<div class="aitem">' + thumb(item) +
      '<div class="ameta">' +
        '<div class="arow">' + nameHtml(item) + exp + time + "</div>" +
        progressHtml(item, accent) + detail + chipsHtml(item.chips) +
      "</div></div>";
  }

  function phaseHtml(phase, i) {
    var accent = ACCENTS[i % ACCENTS.length];
    var node = '<span class="node" style="background:' + accent + '"></span>';
    var min = phase.minutes != null ? '<span class="pmin">~' + esc(phase.minutes) + "m</span>" : "";
    var head = '<div class="phead"><span class="plabel" style="color:' + accent + '">' +
      esc((phase.label || "").toUpperCase()) + "</span>" + min + "</div>";
    var items = (phase.items || []).map(function (it) { return itemHtml(it, accent); }).join("");
    return '<div class="phase">' + node + head + items + "</div>";
  }

  function objectiveHtml(data) {
    if (!data.objective) return "";
    // When the objective IS a title, its pill becomes a hover host revealing the seal card.
    var card = data.objectiveEmbed ? embedHtml(data.objectiveEmbed) : "";
    var cls = card ? "objective ehost" : "objective";
    return '<div class="' + cls + '">◎ ' + esc(data.objective) + card + "</div>";
  }

  function render(data) {
    ICONS = data.icons || {};
    PIPS = data.elementPips || {};
    var clock = data.subtitle ? '<span class="clock">' + esc(data.subtitle) + "</span>" : "";
    var objective = objectiveHtml(data);
    var phases = (data.phases || []).map(phaseHtml).join("");

    document.getElementById("card").innerHTML =
      "<header><div class=\\"htop\\"><h1>" + esc(data.title) + "</h1>" + clock + "</div>" + objective + "</header>" +
      '<div class="body">' + phases + "</div>";
    sizeChanged();
  }

  // Re-anchor a name's hover card so it doesn't clip at the iframe edge (centered over the name,
  // nudged in at the sides, flipped above if there's no room below).
  document.addEventListener("mouseover", function (e) {
    var host = e.target.closest && e.target.closest(".ehost");
    if (host) clampTip(host, ".hovercard", true);
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
      if (data && data.phases) render(data);
    }
  });

  // View initiates the handshake, then reports its size so the host reveals the iframe.
  // protocolVersion is REQUIRED — a strict host rejects ui/initialize without it (= blank iframe).
  send({ jsonrpc: "2.0", id: INIT_ID, method: "ui/initialize", params: { appInfo: { name: "destiny2-agenda", version: "1.0.0" }, appCapabilities: {}, protocolVersion: "2026-01-26" } });
  sizeChanged();
})();
`;
