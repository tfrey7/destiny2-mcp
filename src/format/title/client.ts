/**
 * The single-title card's client-side render module, as an ES5 snippet string — a namespaced IIFE
 * (`var Title = (function(){…})()`) so its builders don't collide with the other card modules in the
 * agenda iframe. It closes over the shared globals from COMMON_CLIENT (esc, imgSrc, clamp). A template's
 * script is COMMON_CLIENT + this + plumbing.
 *
 * `Title.full(data)` returns the standalone detail card (hero header + every member Triumph as a row) —
 * the markup the title template rendered inline before. `Title.compact(data)` returns a smaller hero +
 * the still-incomplete Triumphs (capped, with a "+N more" tail) for the agenda to scope under
 * `.embed-title`, so an agenda objective can reveal the seal's remaining work on hover.
 */
export const TITLE_RENDER = `
var Title = (function () {
  function crest(data) {
    if (!data.icon) return '<div class="crest"><span class="glyph">\\u2756</span></div>';
    return '<div class="crest"><img src="' + imgSrc(data.icon) + '" alt="" /></div>';
  }

  function badge(data) {
    if (data.status === "earned") {
      var g = data.gilded ? ' <span class="lr">\\u028a</span> Gilded ' + esc(data.gilded) : "";
      return '<div class="badge earned">\\u2713 Title earned' + g + "</div>";
    }
    if (data.gildable) return '<div class="badge progress">Gildable title</div>';
    return "";
  }

  function thumb(tr) {
    if (!tr.icon) return '<span class="thumb"><span class="glyph">\\u25c6</span></span>';
    return '<span class="thumb"><img src="' + imgSrc(tr.icon) + '" alt="" /></span>';
  }

  function objectivesHtml(tr) {
    if (tr.state === "completed" || !tr.objectives || !tr.objectives.length) return "";
    return tr.objectives.map(function (o) {
      var count = o.total > 1 ? esc(o.progress) + " / " + esc(o.total) : "";
      return '<div class="obj"><div class="ol"><span>' + esc(o.label) + '</span><span class="oc">' + count + "</span></div>" +
        '<div class="obar"><span style="width:' + clamp(o.percent) + '%"></span></div></div>';
    }).join("");
  }

  function right(tr) {
    if (tr.state === "completed") return '<span class="check">\\u2713</span>';
    if (tr.score) return '<span class="gem"><span class="d">\\u25c6</span>' + esc(tr.score) + "</span>";
    return "";
  }

  function triumphHtml(tr) {
    var cls = "tr " + (tr.state || "not_started") + (tr.obscured ? " obscured" : "");
    var desc = tr.description ? '<div class="trdesc">' + esc(tr.description) + "</div>" : "";
    return '<div class="' + cls + '">' + thumb(tr) +
      '<div class="trmeta"><div class="trhead"><span class="trname">' + esc(tr.name) + "</span>" + right(tr) + "</div>" +
      desc + objectivesHtml(tr) + "</div></div>";
  }

  function heroHtml(data, mini) {
    var pct = data.status === "earned" ? 100 : clamp(data.percent);
    var tally = (data.total ? esc(data.complete) + " / " + esc(data.total) + " Triumphs \\u00b7 " : "") + pct + "%";
    var req = !mini && data.requirement ? '<div class="req">' + esc(data.requirement) + "</div>" : "";
    return '<div class="hero ' + (data.status || "not_started") + '">' + crest(data) +
      '<div class="hmeta"><div class="ttl">' + esc(data.title) + "</div>" +
      '<div class="src">' + esc(data.name) + " Seal</div>" + req + (mini ? "" : badge(data)) +
      '<div class="ovr"><div class="bar"><div class="fill" style="width:' + pct + '%"></div></div>' +
      '<div class="lbl">' + tally + "</div></div></div></div>";
  }

  function full(data) {
    var triumphs = data.triumphs || [];
    var body = triumphs.length
      ? '<div class="sectlabel">Triumphs</div><div class="grid">' + triumphs.map(triumphHtml).join("") + "</div>"
      : '<div class="empty">No Triumphs found for this title.</div>';
    return heroHtml(data, false) + body;
  }

  // The agenda hover view: the mini hero plus the still-incomplete Triumphs (closest first, the order
  // titleDetail set), capped so the popover stays bounded, with a tail counting the rest.
  function compact(data) {
    var triumphs = data.triumphs || [];
    var incomplete = triumphs.filter(function (t) { return t.state !== "completed"; });
    var shown = incomplete.slice(0, 6);
    var rows = shown.map(triumphHtml).join("");
    var more = incomplete.length - shown.length;
    var tail = incomplete.length === 0
      ? '<div class="emore">All Triumphs complete</div>'
      : more > 0 ? '<div class="emore">+' + more + " more to earn</div>" : "";
    return '<div class="ecard">' + heroHtml(data, true) + '<div class="tlist">' + rows + tail + "</div></div>";
  }

  return { full: full, compact: compact };
})();
`;
