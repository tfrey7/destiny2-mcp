import { cardModel, type CardRow, type LoadoutCard } from "./model.js";

/**
 * Render a loadout as a monochrome box card. Exotics are marked with a star, elements named in plain text.
 *
 * @example
 * ╭────────────────────────────────────────────────╮
 * │ Threadrunner                   Hunter · slot 2 │
 * ├────────────────────────────────────────────────┤
 * │ WEAPONS                                        │
 * │   Quicksilver Sto… ★Auto Rifle   ● Strand      │
 * │   The Immortal      SMG          ● Arc         │
 * │   Cataclysmic       Linear Fusion● Solar       │
 * │                                                │
 * │ ARMOR                                          │
 * │   Mask of Bakris ★  Helmet                     │
 * │   Gloves            Gauntlets                  │
 * │   Chestpiece        Chest                      │
 * │   Boots             Legs                       │
 * │   —                 Class item   (empty)       │
 * │                                                │
 * │ SUBCLASS                                       │
 * │   Strand Hunter     Strand       ● Strand      │
 * ╰────────────────────────────────────────────────╯
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

  lines.push("╰" + "─".repeat(BOX_WIDTH + 2) + "╯");
  return lines.join("\n");
}

const BOX_WIDTH = 46;
const NAME_WIDTH = 18;
const MIDDLE_WIDTH = 13;
const EXOTIC_MARK = "★";

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
  return boxLine(`  ${nameCell(row)}${pad(row.middle, MIDDLE_WIDTH)}${tail(row)}`);
}
