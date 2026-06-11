import { Resvg } from "@resvg/resvg-js";
import { cardModel, type LoadoutCard, type Rgb } from "./model.js";

// Layout metrics, in SVG user units. The card is laid out on a monospace grid so
// the three columns (name / type / element) line up like the terminal card does.
const FONT = "Menlo, 'DejaVu Sans Mono', 'Courier New', monospace";
const CHAR_W = 12;
const FONT_SIZE = 21;
const LINE_H = 33;
const PAD = 30;
const INDENT = 22;
// Item names clip to NAME_CHARS so they never collide with the type column; the
// column itself reserves one extra char as a gap. Wider than the 18-char ANSI
// card since a PNG isn't bound to terminal width.
const NAME_CHARS = 20;
const NAME_COL = (NAME_CHARS + 1) * CHAR_W;
const MIDDLE_COL = 13 * CHAR_W;
const ELEM_TEXT = 10 * CHAR_W;

const BG: Rgb = [22, 24, 26];
const BORDER = "rgb(58,63,68)";
const TITLE = "rgb(233,233,234)";
const DIM = "rgb(138,144,153)";

function css([r, g, b]: Rgb): string {
  return `rgb(${r},${g},${b})`;
}

function esc(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function clip(text: string, maxChars: number): string {
  return text.length <= maxChars ? text : text.slice(0, maxChars - 1) + "…";
}

function textEl(
  x: number,
  y: number,
  size: number,
  fill: string,
  content: string,
  extra = "",
): string {
  return `<text x="${x}" y="${y}" font-family="${FONT}" font-size="${size}" fill="${fill}"${extra}>${esc(content)}</text>`;
}

/** Render a loadout card as an SVG string. */
export function renderLoadoutCardSvg(card: LoadoutCard): string {
  const model = cardModel(card);
  const width = Math.round(PAD + INDENT + NAME_COL + MIDDLE_COL + ELEM_TEXT + PAD);

  const titleY = PAD + 26;
  const divY = PAD + 46;

  const body: string[] = [];
  let y = divY + 38;
  model.sections.forEach((section, i) => {
    if (i > 0) {
      y += LINE_H * 0.45;
    }
    body.push(textEl(PAD, y, FONT_SIZE - 5, DIM, section.label, ` letter-spacing="2"`));
    y += LINE_H;
    for (const item of section.rows) {
      const nameX = PAD + INDENT;
      const middleX = nameX + NAME_COL;
      const elemX = middleX + MIDDLE_COL;
      body.push(textEl(nameX, y, FONT_SIZE, css(item.color), clip(item.name, NAME_CHARS)));
      body.push(textEl(middleX, y, FONT_SIZE - 2, DIM, item.middle));
      if (item.empty) {
        body.push(textEl(elemX, y, FONT_SIZE - 2, DIM, "(empty)"));
      } else if (item.element) {
        body.push(
          `<circle cx="${elemX + 7}" cy="${y - 7}" r="6" fill="${css(item.element.color)}"/>`,
        );
        body.push(textEl(elemX + 22, y, FONT_SIZE - 2, css(item.element.color), item.element.name));
      }
      y += LINE_H;
    }
  });

  const height = Math.round(y - LINE_H + FONT_SIZE * 0.4 + PAD);

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `<rect x="0" y="0" width="${width}" height="${height}" rx="14" fill="${css(BG)}"/>`,
    `<rect x="1" y="1" width="${width - 2}" height="${height - 2}" rx="13" fill="none" stroke="${BORDER}" stroke-width="1.5"/>`,
    textEl(PAD, titleY, FONT_SIZE + 2, TITLE, model.title, ` font-weight="bold"`),
    textEl(width - PAD, titleY, FONT_SIZE - 4, DIM, model.subtitle, ` text-anchor="end"`),
    `<line x1="${PAD}" y1="${divY}" x2="${width - PAD}" y2="${divY}" stroke="${BORDER}" stroke-width="1"/>`,
    ...body,
    `</svg>`,
  ].join("\n");
}

/** Render a loadout card as a 2x PNG buffer for inline display in MCP clients. */
export function renderLoadoutCardPng(card: LoadoutCard): Buffer {
  const resvg = new Resvg(renderLoadoutCardSvg(card), {
    fitTo: { mode: "zoom", value: 2 },
    font: { loadSystemFonts: true, defaultFontFamily: "Menlo" },
  });
  return resvg.render().asPng();
}
