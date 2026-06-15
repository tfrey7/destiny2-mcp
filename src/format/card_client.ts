/**
 * Shared client-side primitives for the MCP Apps card templates. Every card iframe (weapon, armor,
 * triumphs, agenda) renders client-side from `structuredContent` the host pushes, and they all need the
 * same handful of utilities: HTML-escaping, resolving a CDN path to its inlined `data:` URI, the rarity
 * and element palettes, and the tooltip viewport-clamp. These were copy-pasted verbatim into each
 * template's `CLIENT_SCRIPT`; this module is the single source.
 *
 * It is an ES5 snippet STRING (not real module code) because it's concatenated into a template's
 * `<script>` and runs in the iframe — no bundler, no imports there. A template builds its script as
 * `COMMON_CLIENT + <card render module(s)> + <its own plumbing>`, so the render modules and plumbing
 * close over the `var`s declared here (BUNGIE, ICONS, PIPS, esc, img, …).
 *
 * The render modules (WEAPON_RENDER, etc.) are each a namespaced IIFE — `var Weapon = (function(){…})()`
 * — so their private builder names can't collide when several are concatenated into one iframe (the
 * agenda embeds all three). The agenda's per-card embed CSS is scoped under `.embed`, so a card's bare
 * class names (`.thumb`, `.fill`, …) don't clash with the agenda's own.
 */
export const COMMON_CLIENT = `
  var BUNGIE = "https://www.bungie.net";
  var LIGHTGG = "https://www.light.gg/db/items/";
  var RARITY = { Exotic: "#f5dc56", Legendary: "#b78fdb", Rare: "#4f87c4", Uncommon: "#4a9e5b", Common: "#cfd3d9", Basic: "#cfd3d9" };
  var ELEMENT = { Arc: "#7aecf3", Solar: "#f2721b", Void: "#b185df", Stasis: "#4d88ff", Strand: "#35e366", Kinetic: "#d9d9d9" };
  // Filled per render from the tool data: ICONS maps a CDN path to its base64 data: URI (Claude
  // Desktop's sandbox blocks remote image hosts but allows data:), PIPS maps an element to its pip path.
  var ICONS = {};
  var PIPS = {};
  function send(m) { parent.postMessage(m, "*"); }
  function notify(method, params) { send({ jsonrpc: "2.0", method: method, params: params || {} }); }
  function sizeChanged() { notify("ui/notifications/size-changed", { height: document.documentElement.scrollHeight }); }
  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function clamp(n) { n = Number(n) || 0; return n < 0 ? 0 : n > 100 ? 100 : n; }
  // Resolve a CDN path to its inlined data: URI, falling back to the remote URL (works outside the
  // sandbox). A data: URI is used verbatim; only a bare path needs escaping into the attribute.
  function imgSrc(path) { return ICONS[path] ? ICONS[path] : BUNGIE + esc(path); }
  function img(path, cls) { return path ? '<img class="' + cls + '" src="' + imgSrc(path) + '" alt="" />' : ""; }
  function tip(name, desc) { return '<span class="tip"><b>' + esc(name) + '</b><span class="td">' + esc(desc) + "</span></span>"; }

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
`;
