// Reads window.__CFG__ = { img, title, subtitle, margin?, top?, bottom?, ann:[...] }
// Each ann: { t:[x,y] target in image px, side:'l'|'r', ay: label top in page px,
//             code: html, sub: html, w?: label width px, y?: true => gold (instance/live) }
(function () {
  const css = `
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:#0a0d13;font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif}
  #stage{position:relative}
  #shot{position:absolute;box-shadow:0 0 0 1px #2a3342}
  svg{position:absolute;top:0;left:0;pointer-events:none}
  .lbl{position:absolute;width:var(--w,340px);color:#cdd6e4}
  .lbl .code{font-family:'SF Mono','Consolas',monospace;font-size:14px;color:#7fd0ff;word-break:break-word;line-height:1.3}
  .lbl .code.codeY{color:#ffd76b}
  .lbl .sub{font-size:12.5px;line-height:1.5;color:#94a2b6;margin-top:4px}
  .lbl.r{text-align:left}
  .lbl.l{text-align:right}
  #title{position:absolute;color:#fff;font-size:16px;letter-spacing:3px;font-weight:600}
  #subtitle{position:absolute;color:#6a7888;font-size:12.5px;letter-spacing:1px}
  .key{position:absolute;font-size:11.5px;color:#6a7888;letter-spacing:.3px}
  .key b{color:#7fd0ff;font-weight:600}.key i{color:#ffd76b;font-style:normal;font-weight:600}`;
  const st = document.createElement("style");
  st.textContent = css;
  document.head.appendChild(st);

  const CFG = window.__CFG__;
  const M = CFG.margin ?? 380,
    T = CFG.top ?? 82,
    B = CFG.bottom ?? 56;
  const stage = document.createElement("div");
  stage.id = "stage";
  document.body.appendChild(stage);
  const shot = document.createElement("img");
  shot.id = "shot";
  stage.appendChild(shot);
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.id = "lines";
  stage.appendChild(svg);

  shot.onload = () => {
    const W = shot.naturalWidth,
      H = shot.naturalHeight;
    const pageW = W + 2 * M,
      pageH = H + T + B;
    stage.style.width = pageW + "px";
    stage.style.height = pageH + "px";
    shot.style.left = M + "px";
    shot.style.top = T + "px";

    const ttl = document.createElement("div");
    ttl.id = "title";
    ttl.textContent = CFG.title;
    ttl.style.left = M + "px";
    ttl.style.top = "28px";
    stage.appendChild(ttl);
    const sub = document.createElement("div");
    sub.id = "subtitle";
    sub.textContent = CFG.subtitle;
    sub.style.left = M + "px";
    sub.style.top = "52px";
    stage.appendChild(sub);
    const key = document.createElement("div");
    key.className = "key";
    key.innerHTML =
      "<b>blue = static manifest definition</b> &nbsp;·&nbsp; <i>gold = live per-instance / live profile data</i>";
    key.style.left = M + "px";
    key.style.top = pageH - 22 + "px";
    stage.appendChild(key);

    svg.setAttribute("width", pageW);
    svg.setAttribute("height", pageH);
    const anchors = [];
    CFG.ann.forEach((a) => {
      const d = document.createElement("div");
      d.className = "lbl " + a.side;
      if (a.w) d.style.setProperty("--w", a.w + "px");
      d.innerHTML = `<div class="code ${a.y ? "codeY" : ""}">${a.code}</div><div class="sub">${a.sub}</div>`;
      const w = a.w || 340;
      d.style.top = a.ay + "px";
      d.style.left = a.side === "l" ? M - 22 - w + "px" : M + W + 22 + "px";
      stage.appendChild(d);
      anchors.push({ d, a, w });
    });
    requestAnimationFrame(() => {
      let s = "";
      anchors.forEach(({ d, a, w }) => {
        const r = d.getBoundingClientRect();
        const ay = r.top + window.scrollY + r.height / 2;
        const ax = a.side === "l" ? M - 22 : M + W + 22;
        const tx = M + a.t[0],
          ty = T + a.t[1];
        const col = a.y ? "#caa23a" : "#3f7fb5",
          dot = a.y ? "#ffd76b" : "#7fd0ff";
        const mx = a.side === "l" ? ax - 26 : ax + 26;
        s += `<path d="M${ax} ${ay} L${mx} ${ay} L${tx} ${ty}" stroke="${col}" stroke-width="1.6" fill="none" opacity=".95"/>`;
        s += `<circle cx="${tx}" cy="${ty}" r="4.5" fill="${dot}"/><circle cx="${tx}" cy="${ty}" r="9" fill="none" stroke="${dot}" stroke-width="1.2" opacity=".5"/>`;
      });
      svg.innerHTML = s;
      document.title = "READY";
    });
  };
  shot.src = CFG.img;
})();
