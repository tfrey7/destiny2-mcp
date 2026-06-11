const BOX_WIDTH = 46;
const PERK_NAME_WIDTH = 42;
const ACTIVE_MARK = "●";
const INACTIVE_MARK = "○";

export interface ArtifactPerkView {
  name: string;
  active: boolean;
}

export interface ArtifactTierView {
  tier: number;
  unlocked: boolean;
  perks: ArtifactPerkView[];
}

export interface ArtifactView {
  name: string;
  pointsUsed: number;
  resetCount: number;
  tiers: ArtifactTierView[];
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

function perkLine(perk: ArtifactPerkView): string {
  const mark = perk.active ? ACTIVE_MARK : INACTIVE_MARK;
  return boxLine(`  ${mark} ${truncate(perk.name, PERK_NAME_WIDTH)}`);
}

/** Render the seasonal artifact as a monochrome box card; chosen perks marked ●, the rest ○. */
export function renderArtifactCardText(artifact: ArtifactView): string {
  const subtitle = `${artifact.pointsUsed} pts`;
  const titleWidth = BOX_WIDTH - subtitle.length;
  const lines = [
    "╭" + "─".repeat(BOX_WIDTH + 2) + "╮",
    boxLine(pad(truncate(artifact.name.toUpperCase(), titleWidth - 1), titleWidth) + subtitle),
    "├" + "─".repeat(BOX_WIDTH + 2) + "┤",
  ];

  artifact.tiers.forEach((tier, i) => {
    if (i > 0) {
      lines.push(boxLine(""));
    }
    lines.push(boxLine(tier.unlocked ? `TIER ${tier.tier}` : `TIER ${tier.tier} · locked`));
    for (const perk of tier.perks) {
      lines.push(perkLine(perk));
    }
  });

  lines.push("╰" + "─".repeat(BOX_WIDTH + 2) + "╯");
  return lines.join("\n");
}
