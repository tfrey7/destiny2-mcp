import {
  BUCKET,
  CLASS_ITEM_BUCKET,
  ELEMENT,
  RARITY_COLOR,
  WIDE_GLYPHS,
  type Section,
} from "./data.js";

type Rgb = [number, number, number];

export interface LoadoutCardItem {
  name: string;
  rarity: string;
  type: string;
  element?: string;
  bucketHash: number;
}

export interface LoadoutCard {
  title: string;
  className: string;
  /** Saved-loadout slot index. Omit for community builds, which have no slot. */
  slot?: number;
  /** Overrides the detail shown after the class name. Defaults to `slot N` when slot is set. */
  subtitle?: string;
  items: LoadoutCardItem[];
}

const BOX_WIDTH = 46;
const NAME_WIDTH = 18;
const MIDDLE_WIDTH = 13;

const ANSI = /\x1b\[[0-9;]*m/g;

function displayWidth(text: string): number {
  let width = 0;
  for (const ch of text.replace(ANSI, "")) {
    width += WIDE_GLYPHS.has(ch) ? 2 : 1;
  }
  return width;
}

function pad(text: string, width: number): string {
  return text + " ".repeat(Math.max(0, width - displayWidth(text)));
}

function truncate(text: string, max: number): string {
  if (displayWidth(text) <= max) {
    return text;
  }
  let out = "";
  for (const ch of text) {
    if (displayWidth(out + ch + "…") > max) {
      break;
    }
    out += ch;
  }
  return out + "…";
}

function rgb(text: string, [r, g, b]: Rgb): string {
  return `\x1b[38;2;${r};${g};${b}m${text}\x1b[0m`;
}

function dim(text: string): string {
  return `\x1b[2m${text}\x1b[0m`;
}

function elementTag(element: string | undefined): string {
  const entry = element ? ELEMENT[element] : undefined;
  if (!entry || !element) {
    return "";
  }
  return `${entry.icon} ${rgb(element, entry.color)}`;
}

function boxLine(content: string): string {
  return `│ ${pad(content, BOX_WIDTH)} │`;
}

function row(name: string, color: Rgb, middle: string, tail: string): string {
  const nameCell = rgb(name, color) + " ".repeat(Math.max(0, NAME_WIDTH - displayWidth(name)));
  return `  ${nameCell}${pad(middle, MIDDLE_WIDTH)}${tail}`;
}

function rarityColor(rarity: string): Rgb {
  return RARITY_COLOR[rarity] ?? RARITY_COLOR.Basic;
}

function inSection(items: LoadoutCardItem[], section: Section): LoadoutCardItem[] {
  return items
    .filter((item) => BUCKET[item.bucketHash]?.section === section)
    .sort((a, b) => (BUCKET[a.bucketHash]?.order ?? 99) - (BUCKET[b.bucketHash]?.order ?? 99));
}

export function renderLoadoutCard(card: LoadoutCard): string {
  const detail = card.subtitle ?? (card.slot !== undefined ? `slot ${card.slot}` : undefined);
  const subtitle = dim(detail ? `${card.className} · ${detail}` : card.className);
  // Reserve one space between a long title and the subtitle so the right border stays aligned.
  const titleWidth = BOX_WIDTH - displayWidth(subtitle);
  const lines = [
    "╭" + "─".repeat(BOX_WIDTH + 2) + "╮",
    boxLine(pad(truncate(card.title, titleWidth - 1), titleWidth) + subtitle),
    "├" + "─".repeat(BOX_WIDTH + 2) + "┤",
  ];

  const weapons = inSection(card.items, "WEAPONS");
  if (weapons.length > 0) {
    lines.push(boxLine(dim("WEAPONS")));
    for (const item of weapons) {
      lines.push(
        boxLine(row(item.name, rarityColor(item.rarity), item.type, elementTag(item.element))),
      );
    }
    lines.push(boxLine(""));
  }

  lines.push(boxLine(dim("ARMOR")));
  const armor = inSection(card.items, "ARMOR");
  for (const item of armor) {
    lines.push(
      boxLine(row(item.name, rarityColor(item.rarity), BUCKET[item.bucketHash].label, "")),
    );
  }
  if (!armor.some((item) => item.bucketHash === CLASS_ITEM_BUCKET)) {
    lines.push(boxLine(row("—", rarityColor("Basic"), "Class item", dim("(empty)"))));
  }

  const subclass = inSection(card.items, "SUBCLASS")[0];
  if (subclass) {
    const color = subclass.element
      ? (ELEMENT[subclass.element]?.color ?? rarityColor("Basic"))
      : rarityColor("Basic");
    lines.push(boxLine(""), boxLine(dim("SUBCLASS")));
    lines.push(
      boxLine(row(subclass.name, color, subclass.element ?? "", elementTag(subclass.element))),
    );
  }

  lines.push("╰" + "─".repeat(BOX_WIDTH + 2) + "╯");
  return lines.join("\n");
}
