import type { ArmorCard } from "./model.js";

/**
 * Render an armor piece as a monochrome box card — the model-visible form and the universal fallback
 * when a host can't render the interactive card. The header names the piece and its attributes; the
 * six archetype stats follow as a value + bar block (the headline), then the exotic intrinsic, the
 * set bonuses, and, on an owned copy, the slotted mods.
 *
 * @example
 * ╭────────────────────────────────────────────────╮
 * │ STAR-EATER SCALES ★                            │
 * ├────────────────────────────────────────────────┤
 * │ Hunter · Leg Armor · Tier 5 · Exotic           │
 * │                                                │
 * │ Weapons   11 ████░░░░░░░░░░░░░░░░               │
 * │ Health    24 █████████░░░░░░░░░░░               │
 * │ Grenade   33 █████████████░░░░░░░               │
 * │ Super      8 ███░░░░░░░░░░░░░░░░░               │
 * │ Class      4 █░░░░░░░░░░░░░░░░░░░               │
 * │ Melee      4 █░░░░░░░░░░░░░░░░░░░               │
 * │                                                │
 * │ Intrinsic: Feast of Light                      │
 * ╰────────────────────────────────────────────────╯
 */
export function renderArmorCardText(card: ArmorCard): string {
  const title =
    card.rarity === "Exotic"
      ? `${card.name.toUpperCase()} ${EXOTIC_MARK}`
      : card.name.toUpperCase();
  const lines = [
    "╭" + "─".repeat(BOX_WIDTH + 2) + "╮",
    boxLine(truncate(title, BOX_WIDTH)),
    "├" + "─".repeat(BOX_WIDTH + 2) + "┤",
    boxLine(truncate(attributes(card), BOX_WIDTH)),
    boxLine(""),
  ];

  // The six archetype stats are the headline — but they're per-copy, so only an owned instance has a
  // real roll. A manifest piece (empty stats) shows a note in their place; bars scale to a stable
  // per-piece cap so owned cards compare.
  if (card.stats.length > 0) {
    const barMax = Math.max(STAT_BAR_FLOOR, ...card.stats.map((stat) => stat.value));

    for (const stat of card.stats) {
      lines.push(boxLine(statLine(stat.name, stat.value, barMax)));
    }
  } else {
    for (const line of wrap(
      "Stats vary per copy — inspect an owned copy to see its roll.",
      BOX_WIDTH,
    )) {
      lines.push(boxLine(line));
    }
  }

  if (card.exoticPerk) {
    lines.push(boxLine(""));
    lines.push(boxLine(truncate(`Intrinsic: ${card.exoticPerk.name}`, BOX_WIDTH)));

    for (const line of wrap(card.exoticPerk.description, BOX_WIDTH)) {
      lines.push(boxLine(line));
    }
  }

  if (card.set) {
    lines.push(boxLine(""));
    lines.push(boxLine(truncate(`SET: ${card.set.name.toUpperCase()}`, BOX_WIDTH)));

    for (const bonus of card.set.bonuses) {
      for (const line of wrap(
        `[${bonus.requiredCount}] ${bonus.name}: ${bonus.description}`,
        BOX_WIDTH,
      )) {
        lines.push(boxLine(line));
      }
    }
  }

  // Mods exist only on an owned copy — a manifest piece has none inserted, so the section is omitted.
  if (card.mods.length > 0) {
    lines.push(boxLine(""));
    lines.push(boxLine("MODS"));

    for (const mod of card.mods) {
      lines.push(boxLine(`  ${truncate(mod.name, BOX_WIDTH - 2)}`));
    }
  }

  // Curated usage blurbs for an exotic — the build nuance not in the manifest.
  if (card.tips && card.tips.length > 0) {
    lines.push(boxLine(""));
    lines.push(boxLine("HOW TO USE"));

    for (const { perk, tip } of card.tips) {
      for (const line of wrap(`${perk}: ${tip}`, BOX_WIDTH)) {
        lines.push(boxLine(line));
      }
    }
  }

  lines.push("╰" + "─".repeat(BOX_WIDTH + 2) + "╯");
  return lines.join("\n");
}

const BOX_WIDTH = 46;
const EXOTIC_MARK = "★";
// Width of the ASCII stat bar, and the value the bar fills at. Armor's per-piece stats top out in the
// low 40s (a full stack plus masterwork tier), so a floor of 45 keeps bars comparable across cards
// while letting an unusually high stat expand the cap rather than clip past 100%.
const BAR_WIDTH = 18;
const STAT_BAR_FLOOR = 45;
const STAT_NAME_WIDTH = 8;

// A "type · slot · tier · rarity" line, skipping any the piece lacks; gear tier shows only for an owned
// copy. Class leads — it's the armor attribute the exotic limit and equip rules turn on.
function attributes(card: ArmorCard): string {
  const tier = card.gearTier !== undefined ? `Tier ${card.gearTier}` : undefined;

  return [card.className, card.slot, tier, card.rarity].filter(Boolean).join(" · ");
}

// One stat row: name, value, and a proportional bar of filled/empty blocks.
function statLine(name: string, value: number, barMax: number): string {
  const filled = Math.min(BAR_WIDTH, Math.round((value / barMax) * BAR_WIDTH));
  const bar = "█".repeat(filled) + "░".repeat(BAR_WIDTH - filled);

  return `${pad(name, STAT_NAME_WIDTH)} ${value.toString().padStart(3)} ${bar}`;
}

function pad(text: string, width: number): string {
  return text + " ".repeat(Math.max(0, width - text.length));
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : text.slice(0, max - 1) + "…";
}

function boxLine(content: string): string {
  return `│ ${pad(truncate(content, BOX_WIDTH), BOX_WIDTH)} │`;
}

// Greedy word-wrap to a max width, so a long description or tip stays inside the box. A single word
// longer than the width is left whole (one over-long line rather than mangled mid-word).
function wrap(text: string, width: number): string[] {
  const lines: string[] = [];
  let current = "";

  for (const word of text.split(/\s+/).filter(Boolean)) {
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
