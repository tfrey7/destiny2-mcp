import { cardModel, type CardRow, type LoadoutCard } from "./model.js";

/**
 * Render a loadout as a monochrome box card. Exotics are marked with a star, elements named in plain text.
 *
 * @example
 * ╭────────────────────────────────────────────────╮
 * │ Threadrunner                   Hunter · slot 2 │
 * ├────────────────────────────────────────────────┤
 * │ SUBCLASS                                       │
 * │   Strand Hunter     Strand       ● Strand      │
 * │                                                │
 * │ WEAPONS                                        │
 * │ ✓ Quicksilver Sto…★Auto Rifle   ● Strand       │
 * │ + The Immortal      SMG          ● Arc         │
 * │   Cataclysmic       Linear Fusion● Solar       │
 * │                                                │
 * │ ARMOR                                          │
 * │ ✓ Mask of Bakris ★  Helmet                     │
 * │ + Gloves            Gauntlets                  │
 * │                                                │
 * │ ✓ owned   + farm                               │
 * ╰────────────────────────────────────────────────╯
 *
 * The leading column marks each piece on a target build — ✓ owned, + still to farm — and is blank
 * (matching the old two-space indent) on real loadouts and the subclass row, where ownership is moot.
 */
export function renderLoadoutCardText(card: LoadoutCard): string {
  const model = cardModel(card);
  // Reserve one space between a long title and the subtitle so the right border stays aligned.
  const titleWidth = BOX_WIDTH - model.subtitle.length;
  const lines = [
    "╭" + "─".repeat(BOX_WIDTH + 2) + "╮",
    boxLine(pad(truncate(model.title, titleWidth - 1), titleWidth) + model.subtitle),
    "├" + "─".repeat(BOX_WIDTH + 2) + "┤",
  ];

  model.sections.forEach((section, i) => {
    if (i > 0) {
      lines.push(boxLine(""));
    }

    lines.push(boxLine(section.label));
    for (const row of section.rows) {
      lines.push(rowLine(row));
    }
  });

  // A target build mixes owned and still-to-farm pieces; the legend appears only when at least one
  // piece is flagged as needed, so real loadouts (every piece owned, unmarked) read unchanged.
  if (model.sections.some((section) => section.rows.some((row) => row.owned === false))) {
    lines.push(boxLine(""));
    lines.push(boxLine(`${OWNED_MARK} owned   ${NEEDED_MARK} farm`));
  }

  lines.push("╰" + "─".repeat(BOX_WIDTH + 2) + "╯");
  return lines.join("\n");
}

const BOX_WIDTH = 46;
const NAME_WIDTH = 18;
const MIDDLE_WIDTH = 13;
const EXOTIC_MARK = "★";
const OWNED_MARK = "✓";
const NEEDED_MARK = "+";

function pad(text: string, width: number): string {
  return text + " ".repeat(Math.max(0, width - text.length));
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : text.slice(0, max - 1) + "…";
}

function nameCell(row: CardRow): string {
  const name =
    row.rarity === "Exotic"
      ? `${truncate(row.name, NAME_WIDTH - 2)} ${EXOTIC_MARK}`
      : truncate(row.name, NAME_WIDTH);

  return pad(name, NAME_WIDTH);
}

function tail(row: CardRow): string {
  if (row.empty) {
    return "(empty)";
  }

  return row.element ? `● ${row.element}` : "";
}

function boxLine(content: string): string {
  return `│ ${pad(content, BOX_WIDTH)} │`;
}

function rowLine(row: CardRow): string {
  return boxLine(`${marker(row)} ${nameCell(row)}${pad(row.middle, MIDDLE_WIDTH)}${tail(row)}`);
}

// The one-character ownership column. Blank for real loadouts and the subclass row (owned undefined),
// so a marker + space lands exactly where the old two-space indent did and column widths don't shift.
function marker(row: CardRow): string {
  if (row.owned === undefined) {
    return " ";
  }

  return row.owned ? OWNED_MARK : NEEDED_MARK;
}
