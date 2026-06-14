import {
  triumphCardModel,
  type ObjectiveLine,
  type TriumphCard,
  type TriumphTile,
} from "./model.js";

/**
 * Render the advisor's Triumph suggestions as a monochrome box card — the CLI fallback and the
 * model-visible form. Each tile shows its state marker, name, and Triumph score, a percent bar, its
 * objective progress, the reasons it's worth chasing, and its location/seal chips.
 *
 * @example
 * ╭────────────────────────────────────────────────╮
 * │ TRIUMPHS TO CHASE              15 ranked · Moon │
 * ├────────────────────────────────────────────────┤
 * │ ● The Hollowed Lair                     ◆ 50 │
 * │   63% ████████████░░░░░░░░                     │
 * │   Enemies defeated 6/23                        │
 * │   why: 63% complete · 50 Triumph points        │
 * │   The Moon · strike                            │
 * ╰────────────────────────────────────────────────╯
 */
export function renderTriumphCardText(card: TriumphCard): string {
  const model = triumphCardModel(card);
  const titleWidth = BOX_WIDTH - model.subtitle.length;
  const lines = [
    "╭" + "─".repeat(BOX_WIDTH + 2) + "╮",
    boxLine(pad(truncate(model.title, titleWidth - 1), titleWidth) + model.subtitle),
    "├" + "─".repeat(BOX_WIDTH + 2) + "┤",
  ];

  if (model.caveat) {
    for (const line of wrap(model.caveat, BOX_WIDTH)) {
      lines.push(boxLine(line));
    }

    lines.push(boxLine(""));
  }

  if (model.tiles.length === 0) {
    lines.push(boxLine("No incomplete Triumphs matched."));
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

const BOX_WIDTH = 46;
const BAR_WIDTH = 20;
const IN_PROGRESS_MARK = "●";
const NOT_STARTED_MARK = "○";
const COMPLETE_MARK = "✓";

function tileLines(tile: TriumphTile): string[] {
  const lines = [headerLine(tile)];

  lines.push(`  ${bar(tile.percent)} ${tile.percent}%`);

  for (const objective of tile.objectives) {
    lines.push(`  ${truncate(objectiveText(objective), BOX_WIDTH - 2)}`);
  }

  if (tile.why.length > 0) {
    for (const line of wrap(`why: ${tile.why.join(" · ")}`, BOX_WIDTH - 2)) {
      lines.push(`  ${line}`);
    }
  }

  if (tile.chips.length > 0) {
    for (const line of wrap(tile.chips.join(" · "), BOX_WIDTH - 2)) {
      lines.push(`  ${line}`);
    }
  }

  return lines;
}

// The tile's headline: state marker + name on the left, the Triumph score gem on the right.
function headerLine(tile: TriumphTile): string {
  const gem = tile.score > 0 ? `◆ ${tile.score}` : "";
  const name = `${marker(tile)} ${truncate(tile.name, BOX_WIDTH - gem.length - 3)}`;

  return pad(name, BOX_WIDTH - gem.length) + gem;
}

function objectiveText(objective: ObjectiveLine): string {
  const mark = objective.complete ? `${COMPLETE_MARK} ` : "";
  const count = objective.total > 1 ? ` ${objective.progress}/${objective.total}` : "";

  return `${mark}${objective.label}${count}`;
}

function marker(tile: TriumphTile): string {
  if (tile.state === "completed") {
    return COMPLETE_MARK;
  }

  return tile.state === "in_progress" ? IN_PROGRESS_MARK : NOT_STARTED_MARK;
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

// Greedy word-wrap to a column width, so a caveat or a long chip row fits the box.
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

function boxLine(content: string): string {
  return `│ ${pad(content, BOX_WIDTH)} │`;
}
