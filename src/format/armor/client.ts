/**
 * The armor card's client-side render module, as an ES5 snippet string — a namespaced IIFE (`var Armor =
 * (function(){…})()`) so its builders don't collide with the weapon/triumph modules in the agenda
 * iframe. It closes over the shared globals from COMMON_CLIENT (esc, img, tip, RARITY, LIGHTGG). A
 * template's script is COMMON_CLIENT + this + plumbing.
 *
 * `Armor.full(data)` returns the standalone inspect card body (header + stats + exotic perk + set
 * bonuses + mods + usage tips) — the markup the armor template rendered inline before. `Armor.compact`
 * returns the header + the six archetype stats + the exotic perk (the headline), wrapped in `.ecard` for
 * the agenda to scope under `.embed-armor`.
 */
export const ARMOR_RENDER = `
var Armor = (function () {
  // Armor's per-piece stats top out in the low 40s; a floor of 45 keeps bars comparable across cards
  // while an unusually high stat expands the cap rather than clipping.
  var STAT_BAR_FLOOR = 45;

  function headerHtml(data) {
    var color = RARITY[data.rarity] || "#e9eaf0";
    var name = data.hash
      ? '<a class="nm" style="color:' + color + '" href="' + LIGHTGG + data.hash + '/" target="_blank" rel="noopener">' + esc(data.name) + "</a>"
      : '<span class="nm" style="color:' + color + '">' + esc(data.name) + "</span>";
    var tierBadge = data.gearTier != null ? '<span class="tier">T' + esc(data.gearTier) + "</span>" : "";
    var wm = data.watermark ? img(data.watermark, "wm") : "";
    var tierAttr = data.gearTier != null ? ("Tier " + data.gearTier) : null;
    var parts = [data.className, data.slot, tierAttr, data.rarity].filter(Boolean).map(esc);
    var attrs = parts.join('<span class="dot">·</span>');
    return '<header><span class="thumb">' + img(data.icon, "ic") + wm + tierBadge + "</span>" +
      '<span class="htext">' + name + '<div class="attrs">' + attrs + "</div></span></header>";
  }

  function statsHtml(stats) {
    // Stats are per-copy: a manifest piece (no instance) has no real roll, so note that instead of
    // showing a misleading row of empty bars.
    if (!stats || !stats.length) return '<div class="statnote">Stats vary per copy — inspect an owned copy to see its roll.</div>';
    var max = STAT_BAR_FLOOR;
    stats.forEach(function (s) { if (s.value > max) max = s.value; });
    var rows = stats.map(function (s) {
      var pct = Math.max(0, Math.min(100, Math.round((s.value / max) * 100)));
      return '<div class="sl">' + esc(s.name) + "</div>" +
        '<div class="sv">' + esc(s.value) + "</div>" +
        '<div class="track"><div class="fill" style="width:' + pct + '%"></div></div>';
    }).join("");
    return '<div class="stats">' + rows + "</div>";
  }

  function intrinsicHtml(perk) {
    if (!perk) return "";
    return '<div class="seclabel">ARMOR PERK</div>' +
      '<div class="intrinsic">' + img(perk.icon, "ico") +
      '<span><div class="iname">' + esc(perk.name) + "</div>" +
      '<div class="idesc">' + esc(perk.description) + "</div></span>" +
      tip(perk.name, perk.description) + "</div>";
  }

  function setHtml(set) {
    if (!set || !set.bonuses || !set.bonuses.length) return "";
    var rows = set.bonuses.map(function (b) {
      return '<div class="brow"><span class="pill">' + esc(b.requiredCount) + "</span>" +
        '<span><span class="bname">' + esc(b.name) + "</span> — " + esc(b.description) + "</span>" +
        tip(b.name, b.description) + "</div>";
    }).join("");
    return '<div class="seclabel">SET BONUSES</div>' +
      '<div class="set"><div class="sname">' + esc(set.name) + "</div>" + rows + "</div>";
  }

  function modsHtml(mods) {
    if (!mods || !mods.length) return "";
    var tiles = mods.map(function (m) {
      return '<div class="mod" role="img" aria-label="' + esc(m.name) + '">' +
        img(m.icon, "mic") + tip(m.name, m.description) + "</div>";
    }).join("");
    return '<div class="seclabel">MODS</div><div class="mods">' + tiles + "</div>";
  }

  function usageHtml(tips) {
    if (!tips || !tips.length) return "";
    var rows = tips.map(function (t) {
      return '<div class="urow"><b>' + esc(t.perk) + "</b> — " + esc(t.tip) + "</div>";
    }).join("");
    return '<div class="usage"><div class="seclabel">HOW TO USE</div>' + rows + "</div>";
  }

  function full(data) {
    return headerHtml(data) +
      '<div class="body">' + statsHtml(data.stats) + intrinsicHtml(data.exoticPerk) +
      setHtml(data.set) + modsHtml(data.mods) + usageHtml(data.tips) + "</div>";
  }

  function compact(data) {
    return '<div class="ecard">' + headerHtml(data) +
      '<div class="ebody">' + statsHtml(data.stats) + intrinsicHtml(data.exoticPerk) + "</div></div>";
  }

  return { full: full, compact: compact };
})();
`;
