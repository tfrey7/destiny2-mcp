import {
  recapCardModel,
  type RecapCard,
  type RecapModeBar,
  type RecapNotableLine,
  type RecapStatTile,
} from "./model.js";

/**
 * Render the recap as a monochrome box card — the CLI fallback and the model-visible form. A header
 * with the period, a banner of the four headline stats, a by-mode bar breakdown, and the notable runs.
 *
 * @example
 * ╭────────────────────────────────────────────────╮
 * │ ACTIVITY RECAP                 Last 7 days · all │
 * ├────────────────────────────────────────────────┤
 * │ 47 activities · 12h 38m played · 3.20 KDR · 18… │
 * ├────────────────────────────────────────────────┤
 * │ BY MODE                                          │
 * │ Crucible  ████████████████████  22               │
 * │ Strike    ██████████            11               │
 * │ Raid      ███████                7 · 3 clears     │
 * ├────────────────────────────────────────────────┤
 * │ NOTABLE                                          │
 * │ ◆ Longest  Vow of the Disciple          1h 02m   │
 * │ ◆ Best KDR Rumble                          6.40  │
 * ╰────────────────────────────────────────────────╯
 */
export function renderRecapCardText(card: RecapCard): string {
  const model = recapCardModel(card);
  const titleWidth = BOX_WIDTH - model.subtitle.length;
  const lines = [
    "╭" + "─".repeat(BOX_WIDTH + 2) + "╮",
    boxLine(pad(truncate("ACTIVITY RECAP", titleWidth - 1), titleWidth) + model.subtitle),
    divider(),
  ];

  if (model.empty) {
    lines.push(boxLine("No activities in this window."));
    lines.push("╰" + "─".repeat(BOX_WIDTH + 2) + "╯");

    return lines.join("\n");
  }

  for (const line of wrap(statBanner(model.stats), BOX_WIDTH)) {
    lines.push(boxLine(line));
  }

  lines.push(divider());
  lines.push(boxLine("BY MODE"));

  for (const mode of model.modes) {
    for (const line of modeLines(mode)) {
      lines.push(boxLine(line));
    }
  }

  if (model.notable.length > 0) {
    lines.push(divider());
    lines.push(boxLine("NOTABLE"));

    for (const line of model.notable) {
      lines.push(boxLine(notableLine(line)));
    }
  }

  lines.push("╰" + "─".repeat(BOX_WIDTH + 2) + "╯");

  return lines.join("\n");
}

const BOX_WIDTH = 48;
const BAR_WIDTH = 20;
const MODE_LABEL_WIDTH = 10;

// "47 activities · 12h 38m played · 3.20 KDR · 18 clears" — the stat tiles inlined as one prose row.
function statBanner(stats: RecapStatTile[]): string {
  return stats.map((stat) => `${stat.value} ${stat.label}`).join(" · ");
}

function modeLines(mode: RecapModeBar): string[] {
  const label = pad(truncate(mode.mode, MODE_LABEL_WIDTH), MODE_LABEL_WIDTH);
  const tail = mode.clears > 0 ? `${mode.count} · ${mode.clears} clears` : String(mode.count);

  return [`${label} ${bar(mode.widthPercent)} ${tail}`];
}

function notableLine(line: RecapNotableLine): string {
  const head = `◆ ${pad(line.label, 8)} ${line.name}`;
  const max = BOX_WIDTH - line.detail.length - 1;

  return pad(truncate(head, max), max + 1) + line.detail;
}

function bar(percent: number): string {
  const filled = Math.round((Math.min(100, Math.max(0, percent)) / 100) * BAR_WIDTH);

  return "█".repeat(filled) + "░".repeat(BAR_WIDTH - filled);
}

function divider(): string {
  return "├" + "─".repeat(BOX_WIDTH + 2) + "┤";
}

function boxLine(content: string): string {
  return `│ ${pad(content, BOX_WIDTH)} │`;
}

function pad(text: string, width: number): string {
  return text + " ".repeat(Math.max(0, width - text.length));
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : text.slice(0, max - 1) + "…";
}

// Greedy word-wrap to a column width, so the stat banner fits the box.
function wrap(text: string, width: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    if (line && line.length + 1 + word.length > width) {
      lines.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }

  if (line) {
    lines.push(line);
  }

  return lines;
}
