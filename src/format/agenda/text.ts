import {
  agendaCardModel,
  type AgendaCard,
  type AgendaItemLine,
  type AgendaPhaseModel,
} from "./model.js";

/**
 * Render a session agenda as a monochrome box card — the CLI fallback and the model-visible form.
 * The header carries the title, the session length, and the objective; each phase is a labelled band
 * with its time budget, and each item shows its time tag, an expiry flag, a progress bar with its
 * count, the why line, and its place/mode chips.
 *
 * @example
 * ╭────────────────────────────────────────────────╮
 * │ TONIGHT'S AGENDA              ~90 min · 3 phases │
 * │ ◎ Chase the Dredgen title                       │
 * ├────────────────────────────────────────────────┤
 * │ ◷ WARM-UP                                ~15m │
 * │   ▸ Gambit bounties                       ~10m │
 * │     ███░░░░░░░░░░░░░░░░░ 1/4                    │
 * │     Knock out the easy daily progress          │
 * │     Gambit                                     │
 * ╰────────────────────────────────────────────────╯
 */
export function renderAgendaCardText(card: AgendaCard): string {
  const model = agendaCardModel(card);
  const titleWidth = BOX_WIDTH - model.subtitle.length;
  const lines = [
    "╭" + "─".repeat(BOX_WIDTH + 2) + "╮",
    boxLine(pad(truncate(model.title, titleWidth - 1), titleWidth) + model.subtitle),
  ];

  if (model.objective) {
    for (const line of wrap(`◎ ${model.objective}`, BOX_WIDTH)) {
      lines.push(boxLine(line));
    }
  }

  lines.push("├" + "─".repeat(BOX_WIDTH + 2) + "┤");

  if (model.phases.length === 0) {
    lines.push(boxLine("No agenda items."));
  }

  model.phases.forEach((phase, i) => {
    if (i > 0) {
      lines.push(boxLine(""));
    }

    for (const line of phaseLines(phase)) {
      lines.push(line);
    }
  });

  lines.push("╰" + "─".repeat(BOX_WIDTH + 2) + "╯");
  return lines.join("\n");
}

const BOX_WIDTH = 46;
const BAR_WIDTH = 20;

function phaseLines(phase: AgendaPhaseModel): string[] {
  const budget = phase.minutes !== undefined ? `~${phase.minutes}m` : "";
  const header = `◷ ${truncate(phase.label.toUpperCase(), BOX_WIDTH - budget.length - 3)}`;
  const lines = [boxLine(pad(header, BOX_WIDTH - budget.length) + budget)];

  for (const item of phase.items) {
    for (const line of itemLines(item)) {
      lines.push(boxLine(line));
    }
  }

  return lines;
}

function itemLines(item: AgendaItemLine): string[] {
  const flag = item.expiring ? " ⏰" : "";
  const time = item.minutes !== undefined ? `~${item.minutes}m` : "";
  const name = `▸ ${truncate(item.name, BOX_WIDTH - time.length - flag.length - 4)}${flag}`;
  const lines = [pad(`  ${name}`, BOX_WIDTH - time.length) + time];

  if (item.percent !== undefined) {
    const label = item.progressLabel ? ` ${item.progressLabel}` : "";

    lines.push(`    ${bar(item.percent)}${label}`);
  } else if (item.progressLabel) {
    lines.push(`    ${item.progressLabel}`);
  }

  if (item.detail) {
    for (const line of wrap(item.detail, BOX_WIDTH - 4)) {
      lines.push(`    ${line}`);
    }
  }

  if (item.chips.length > 0) {
    for (const line of wrap(item.chips.join(" · "), BOX_WIDTH - 4)) {
      lines.push(`    ${line}`);
    }
  }

  return lines;
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

// Greedy word-wrap to a column width, so a long detail or chip row fits the box.
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
