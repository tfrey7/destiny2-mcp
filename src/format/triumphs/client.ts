/**
 * The Triumph card's client-side render module, as an ES5 snippet string — a namespaced IIFE (`var
 * Triumph = (function(){…})()`) so its builders don't collide with the weapon/armor modules in the
 * agenda iframe. It closes over the shared globals from COMMON_CLIENT (esc, imgSrc, clamp). A template's
 * script is COMMON_CLIENT + this + plumbing.
 *
 * `Triumph.tile(tile)` returns the standalone grid tile (head + progress + hover panel) — the markup the
 * Triumph template rendered inline before. `Triumph.compact(tile)` returns a single-tile detail view
 * (header + progress + objectives + reasons) for the agenda to scope under `.embed-triumph`; it reuses
 * the same objective/why/chip sub-builders as the grid's hover panel.
 */
export const TRIUMPH_RENDER = `
var Triumph = (function () {
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

  // Single-tile detail for an inline/hover embed: the icon, name, score gem, and seal line, then the
  // progress bar and the same objective/why/chip rows the grid's hover panel uses.
  function compact(tile) {
    var pct = clamp(tile.percent);
    var seal = tile.seal ? '<div class="eseal">' + esc(tile.seal) + " Seal</div>" : "";
    var desc = tile.description ? '<div class="edesc">' + esc(tile.description) + "</div>" : "";
    return '<div class="ecard">' +
      '<div class="ehead">' + thumb(tile) +
        '<div class="ehmeta"><div class="ename">' + esc(tile.name) + "</div>" + gem(tile.score) + seal + "</div></div>" +
      '<div class="ebody">' +
        '<div class="eprog"><div class="efill" style="width:' + pct + '%"></div></div>' +
        '<div class="epct">' + pct + '% complete</div>' + desc +
        objectivesHtml(tile.objectives) + whyHtml(tile.why) + chipsHtml(tile.chips) +
      "</div></div>";
  }

  return { tile: tileHtml, compact: compact };
})();
`;
