import type { WeaponCard } from "./model.js";

/**
 * Render a weapon as a monochrome box card — the model-visible form and the universal fallback when a
 * host can't render the interactive grid. The header names the weapon and its attributes; each perk
 * column lists its candidate perks, and on an owned copy the rolled perk in each column is marked ●.
 *
 * @example
 * ╭────────────────────────────────────────────────╮
 * │ FATEBRINGER ★                                  │
 * ├────────────────────────────────────────────────┤
 * │ Hand Cannon · Solar · Primary · Exotic         │
 * │ Intrinsic: Adaptive Frame                      │
 * │                                                │
 * │ BARREL                                         │
 * │   Corkscrew Rifling                            │
 * │   Smallbore                                    │
 * │                                                │
 * │ TRAIT                                          │
 * │ ● Explosive Payload                            │
 * │   Firefly                                      │
 * │                                                │
 * │ ● equipped                                     │
 * ╰────────────────────────────────────────────────╯
 */
export function renderWeaponCardText(card: WeaponCard): string {
  const title =
    card.rarity === "Exotic"
      ? `${card.name.toUpperCase()} ${EXOTIC_MARK}`
      : card.name.toUpperCase();
  const lines = [
    "╭" + "─".repeat(BOX_WIDTH + 2) + "╮",
    boxLine(truncate(title, BOX_WIDTH)),
    "├" + "─".repeat(BOX_WIDTH + 2) + "┤",
    boxLine(truncate(attributes(card), BOX_WIDTH)),
  ];

  if (card.intrinsic) {
    lines.push(boxLine(truncate(`Intrinsic: ${card.intrinsic.name}`, BOX_WIDTH)));
  }

  for (const column of card.columns) {
    lines.push(boxLine(""));
    lines.push(boxLine(column.label.toUpperCase()));

    for (const plug of column.plugs) {
      const mark = plug.hash === column.selected ? SELECTED_MARK : " ";

      lines.push(boxLine(`${mark} ${truncate(plug.name, BOX_WIDTH - 2)}`));
    }
  }

  // Curated usage blurbs — the playstyle nuance not in the manifest — for whichever perks have one.
  if (card.tips && card.tips.length > 0) {
    lines.push(boxLine(""));
    lines.push(boxLine("HOW TO USE"));

    for (const { perk, tip } of card.tips) {
      for (const line of wrap(`${perk}: ${tip}`, BOX_WIDTH)) {
        lines.push(boxLine(line));
      }
    }
  }

  // The ● legend appears only for an owned copy, where one perk per column is the actual roll; a
  // manifest item shows the full unmarked pool, so it reads unchanged.
  if (card.instance) {
    lines.push(boxLine(""));
    lines.push(boxLine(`${SELECTED_MARK} equipped`));
  }

  lines.push("╰" + "─".repeat(BOX_WIDTH + 2) + "╯");
  return lines.join("\n");
}

const BOX_WIDTH = 46;
const EXOTIC_MARK = "★";
const SELECTED_MARK = "●";

// The attributes line: type · element · ammo · rarity, skipping any the weapon lacks.
function attributes(card: WeaponCard): string {
  return [card.type, card.element, card.ammoType, card.rarity].filter(Boolean).join(" · ");
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

// Greedy word-wrap to a max width, so a long usage tip stays inside the box. A single word longer than
// the width is left whole (it'll be one over-long line rather than mangled mid-word).
function wrap(text: string, width: number): string[] {
  const lines: string[] = [];
  let current = "";

  for (const word of text.split(" ")) {
    const candidate = current ? `${current} ${word}` : word;

    if (candidate.length > width && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }

  if (current) {
    lines.push(current);
  }

  return lines;
}
