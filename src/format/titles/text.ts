import { titleCardModel, type TitleCard, type TitleTile } from "./model.js";

/**
 * Render the Titles gallery as a monochrome box card — the CLI fallback and the model-visible form.
 * Each row shows its status marker, the title word and its seal source, a percent bar, the
 * Triumph count, and a gilding note when the title has been gilded.
 *
 * @example
 * ╭──────────────────────────────────────────────────╮
 * │ TITLES                  3 of 42 earned · 13,865 │
 * ├──────────────────────────────────────────────────┤
 * │ ✓ Vidmaster — 30th Anniversary           earned │
 * │   ████████████████████ 10/10                     │
 * │                                                  │
 * │ ● Rivensbane — Last Wish                    44% │
 * │   ████████░░░░░░░░░░░░ 7/16                       │
 * ╰──────────────────────────────────────────────────╯
 */
export function renderTitleCardText(card: TitleCard): string {
  const model = titleCardModel(card);
  const titleWidth = BOX_WIDTH - model.subtitle.length;
  const lines = [
    "╭" + "─".repeat(BOX_WIDTH + 2) + "╮",
    boxLine(pad(truncate(model.title, titleWidth - 1), titleWidth) + model.subtitle),
    "├" + "─".repeat(BOX_WIDTH + 2) + "┤",
  ];

  if (model.tiles.length === 0) {
    lines.push(boxLine("No titles found."));
  }

  model.tiles.forEach((tile, i) => {
    if (i > 0) {
      lines.push(boxLine(""));
    }

    for (const line of tileLines(tile)) {
      lines.push(boxLine(line));
    }
  });

  lines.push("╰" + "─".repeat(BOX_WIDTH + 2) + "╯");
  return lines.join("\n");
}

const BOX_WIDTH = 48;
const BAR_WIDTH = 20;
const IN_PROGRESS_MARK = "●";
const NOT_STARTED_MARK = "○";
const EARNED_MARK = "✓";

function tileLines(tile: TitleTile): string[] {
  return [headerLine(tile), `  ${bar(tile.percent)} ${countText(tile)}`];
}

// "✓ Vidmaster — 30th Anniversary            earned" — the title word and its seal source on the
// left, then the status note (earned / gilded ×N / percent) flush right.
function headerLine(tile: TitleTile): string {
  const note = statusNote(tile);
  const label = `${marker(tile)} ${tile.title} — ${tile.name}`;

  return pad(truncate(label, BOX_WIDTH - note.length - 1), BOX_WIDTH - note.length) + note;
}

function statusNote(tile: TitleTile): string {
  if (tile.status === "earned") {
    return tile.gilded > 0 ? `gilded ×${tile.gilded}` : "earned";
  }

  return `${tile.percent}%`;
}

function countText(tile: TitleTile): string {
  const triumphs = tile.total > 0 ? `${tile.complete}/${tile.total}` : "";

  if (tile.status === "earned" && tile.gildable) {
    return `${triumphs} · gildable`.trim();
  }

  return triumphs;
}

function marker(tile: TitleTile): string {
  if (tile.status === "earned") {
    return EARNED_MARK;
  }

  return tile.status === "in_progress" ? IN_PROGRESS_MARK : NOT_STARTED_MARK;
}

function bar(percent: number): string {
  const filled = Math.round((Math.min(100, Math.max(0, percent)) / 100) * BAR_WIDTH);

  return "█".repeat(filled) + "░".repeat(BAR_WIDTH - filled);
}

function pad(text: string, width: number): string {
  return text + " ".repeat(Math.max(0, width - text.length));
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : text.slice(0, max - 1) + "…";
}

function boxLine(content: string): string {
  return `│ ${pad(content, BOX_WIDTH)} │`;
}
