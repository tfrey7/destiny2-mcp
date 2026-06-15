import { titleDetailModel, type TitleDetailCard, type TitleTriumphRow } from "./model.js";

/**
 * Render a single title as a monochrome box card — the CLI fallback and the model-visible form. A
 * header block names the title, its source, the unlock requirement, and overall completion; then
 * every member Triumph is listed inline with its state marker, name, score, percent bar, and
 * objective progress.
 *
 * @example
 * ╭──────────────────────────────────────────────────╮
 * │ DREDGEN — Gambit                            56% │
 * │ Complete all Gambit Triumphs.                    │
 * │ 5 / 9 Triumphs · gildable                        │
 * ├──────────────────────────────────────────────────┤
 * │ ✓ Playing for Keeps                       ◆ 10 │
 * │ ● Breakneck                          40%  ◆ 25 │
 * │   Motes banked 120/300                           │
 * ╰──────────────────────────────────────────────────╯
 */
export function renderTitleDetailText(card: TitleDetailCard): string {
  const model = titleDetailModel(card);
  const right = model.earned ? "earned" : `${model.percent}%`;
  const heading = `${model.title.toUpperCase()} — ${model.name}`;
  const lines = [
    "╭" + "─".repeat(BOX_WIDTH + 2) + "╮",
    boxLine(pad(truncate(heading, BOX_WIDTH - right.length - 1), BOX_WIDTH - right.length) + right),
  ];

  if (model.requirement) {
    for (const line of wrap(model.requirement, BOX_WIDTH)) {
      lines.push(boxLine(line));
    }
  }

  lines.push(boxLine(summaryLine(model.complete, model.total, model.gildable, model.gilded)));
  lines.push("├" + "─".repeat(BOX_WIDTH + 2) + "┤");

  if (model.triumphs.length === 0) {
    lines.push(boxLine("No Triumphs found for this title."));
  }

  model.triumphs.forEach((triumph, i) => {
    if (i > 0) {
      lines.push(boxLine(""));
    }

    for (const line of triumphLines(triumph)) {
      lines.push(boxLine(line));
    }
  });

  lines.push("╰" + "─".repeat(BOX_WIDTH + 2) + "╯");
  return lines.join("\n");
}

const BOX_WIDTH = 48;
const IN_PROGRESS_MARK = "●";
const NOT_STARTED_MARK = "○";
const COMPLETE_MARK = "✓";

// "5 / 9 Triumphs · gildable" — overall tally, with the gilding state when it applies.
function summaryLine(complete: number, total: number, gildable: boolean, gilded: number): string {
  const tally = total > 0 ? `${complete} / ${total} Triumphs` : "";

  if (gilded > 0) {
    return `${tally} · gilded ×${gilded}`;
  }

  return gildable ? `${tally} · gildable` : tally;
}

function triumphLines(triumph: TitleTriumphRow): string[] {
  const lines = [headerLine(triumph)];

  if (triumph.state !== "completed") {
    for (const objective of triumph.objectives) {
      const count = objective.total > 1 ? ` ${objective.progress}/${objective.total}` : "";

      lines.push(`  ${truncate(objective.label + count, BOX_WIDTH - 2)}`);
    }
  }

  return lines;
}

// "● Breakneck                          40%  ◆ 25" — marker + name on the left, then percent (when
// in progress) and the Triumph score gem flush right.
function headerLine(triumph: TitleTriumphRow): string {
  const gem = triumph.score > 0 ? `◆ ${triumph.score}` : "";
  const pct = triumph.state === "in_progress" ? `${triumph.percent}%` : "";
  const right = [pct, gem].filter(Boolean).join("  ");
  const name = `${marker(triumph)} ${truncate(triumph.name, BOX_WIDTH - right.length - 3)}`;

  return pad(name, BOX_WIDTH - right.length) + right;
}

function marker(triumph: TitleTriumphRow): string {
  if (triumph.state === "completed") {
    return COMPLETE_MARK;
  }

  return triumph.state === "in_progress" ? IN_PROGRESS_MARK : NOT_STARTED_MARK;
}

function pad(text: string, width: number): string {
  return text + " ".repeat(Math.max(0, width - text.length));
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : text.slice(0, max - 1) + "…";
}

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
