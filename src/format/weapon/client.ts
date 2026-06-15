/**
 * The weapon card's client-side render module, as an ES5 snippet string. It's a namespaced IIFE —
 * `var Weapon = (function(){…})()` — so its private builders don't collide when concatenated alongside
 * the armor/triumph modules in the agenda iframe. It closes over the shared globals from COMMON_CLIENT
 * (esc, img, tip, RARITY, ELEMENT, PIPS, LIGHTGG), so a template's script is COMMON_CLIENT + this +
 * plumbing.
 *
 * `Weapon.full(data)` returns the standalone inspect card body (header + intrinsic + perk grid + usage
 * tips) — the exact markup the weapon template rendered inline before. `Weapon.compact(data)` returns
 * the same minus the usage tips, wrapped in `.ecard` for the agenda to scope under `.embed`. Both share
 * every builder, so a compact embed can't structurally drift from the real card.
 */
export const WEAPON_RENDER = `
var Weapon = (function () {
  function plugHtml(plug, selected) {
    var sel = plug.hash === selected ? " sel" : "";
    return '<div class="plug' + sel + '">' + img(plug.icon, "pic") +
      '<span class="pn">' + esc(plug.name) + "</span>" + tip(plug.name, plug.description) + "</div>";
  }

  function columnHtml(col) {
    var origin = col.kind === "origin" ? " origin" : "";
    var plugs = (col.plugs || []).map(function (p) { return plugHtml(p, col.selected); }).join("");
    return '<div class="col' + origin + '"><div class="colhead">' + esc(col.label) + "</div>" + plugs + "</div>";
  }

  function headerHtml(data) {
    var pipPath = data.element ? PIPS[data.element] : null;
    var pip = pipPath ? img(pipPath, "pip") : "";
    var wm = data.watermark ? img(data.watermark, "wm") : "";
    var color = RARITY[data.rarity] || "#e9eaf0";
    var name = data.hash
      ? '<a class="nm" style="color:' + color + '" href="' + LIGHTGG + data.hash + '/" target="_blank" rel="noopener">' + esc(data.name) + "</a>"
      : '<span class="nm" style="color:' + color + '">' + esc(data.name) + "</span>";
    var parts = [data.type, data.element, data.ammoType, data.rarity].filter(Boolean).map(esc);
    var attrs = parts.join('<span class="dot">·</span>');
    return '<header><span class="thumb">' + img(data.icon, "ic") + wm + pip + "</span>" +
      '<span class="htext">' + name + '<div class="attrs">' + attrs + "</div></span></header>";
  }

  function intrinsicHtml(intr) {
    if (!intr) return "";
    return '<div class="intrinsic">' + img(intr.icon, "ico") +
      '<span><div class="ititle">INTRINSIC</div><div class="iname">' + esc(intr.name) + "</div></span>" +
      tip(intr.name, intr.description) + "</div>";
  }

  function usageHtml(tips) {
    if (!tips || !tips.length) return "";
    var rows = tips.map(function (t) {
      return '<div class="urow"><b>' + esc(t.perk) + "</b> — " + esc(t.tip) + "</div>";
    }).join("");
    return '<div class="usage"><div class="seclabel">HOW TO USE</div>' + rows + "</div>";
  }

  function gridHtml(data) {
    return '<div class="grid">' + (data.columns || []).map(columnHtml).join("") + "</div>";
  }

  function full(data) {
    return headerHtml(data) +
      '<div class="body">' + intrinsicHtml(data.intrinsic) + gridHtml(data) + usageHtml(data.tips) + "</div>";
  }

  function compact(data) {
    return '<div class="ecard">' + headerHtml(data) + intrinsicHtml(data.intrinsic) + gridHtml(data) + "</div>";
  }

  return { full: full, compact: compact };
})();
`;
