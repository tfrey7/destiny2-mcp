import {
  agendaCardModel,
  agendaIconMap,
  renderAgendaCardText,
  type AgendaCard,
} from "../format/agenda/index.js";
import { armorIconBlock, armorIconMap } from "../format/armor/images.js";
import { type ArmorCard, renderArmorCardText } from "../format/armor/index.js";
import { renderArtifactCardText, type ArtifactView } from "../format/artifact.js";
import type { UiAction } from "../format/loadout/html.js";
import { ELEMENT_PIP, iconBlocks, iconMap } from "../format/loadout/images.js";
import { renderLoadoutCardText, type LoadoutCard } from "../format/loadout/index.js";
import { cardModel } from "../format/loadout/model.js";
import {
  recapCardModel,
  recapIconMap,
  renderRecapCardText,
  type RecapCard,
} from "../format/recap/index.js";
import {
  renderTitleDetailText,
  titleDetailIconMap,
  titleDetailModel,
  type TitleDetailCard,
} from "../format/title/index.js";
import {
  renderTitleCardText,
  titleCardModel,
  titleIconMap,
  type TitleCard,
} from "../format/titles/index.js";
import {
  renderTriumphCardText,
  triumphCardModel,
  triumphIconMap,
  type TriumphCard,
} from "../format/triumphs/index.js";
import { weaponIconBlock, weaponIconMap } from "../format/weapon/images.js";
import { renderWeaponCardText, type WeaponCard } from "../format/weapon/index.js";

/** How a card's gear art is delivered to the model. Only the bare icon blocks, for now. */
type ImageStyle = "icons";

/**
 * Wrap any value as a tool response carrying its pretty-printed JSON.
 *
 * @example
 * json({ light: 2010, class: "Hunter" })
 * // → { content: [{ type: "text", text: '{\n  "light": 2010,\n  "class": "Hunter"\n}' }] }
 */
export function json(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] };
}

/**
 * Wrap a loadout as a tool response carrying its rendered box card (see renderLoadoutCardText).
 *
 * The text card is always present — it is the universal fallback and the model-visible form.
 * When `images` is "icons", each item's bare Bungie icon is fetched and appended as model-visible
 * image content (see iconBlocks). When `ui` is supplied (only for UI-capable hosts; see
 * clientSupportsUi), the loadout's cardModel rides along as structuredContent. The host forwards
 * that to the iframe rendered from the `ui://destiny2/loadout` template (registered separately,
 * linked via the tool's `_meta.ui.resourceUri`) over `ui/notifications/tool-result`. An optional
 * `action` becomes the card's button. Plain (non-UI) hosts and the CLI just get the text card
 * (plus any images), byte-identical.
 *
 * @example
 * // → { content: [{ type: "text", text: "╭───╮\n│ Threadrunner … │\n…╰───╯" }] }
 */
export async function card(
  spec: LoadoutCard,
  opts?: { ui?: { action?: UiAction }; images?: ImageStyle },
) {
  const model = cardModel(spec);
  const images = opts?.images === "icons" ? await iconBlocks(model) : [];

  if (!opts?.ui) {
    // No iframe: the text card IS the output, so it's the model-visible content.
    return { content: [{ type: "text" as const, text: renderLoadoutCardText(spec) }, ...images] };
  }

  // UI host: the human sees the rendered card. Give the model a terse note rather than the full text
  // card, so it doesn't echo the whole loadout back in prose underneath the card. (The text card
  // stays the output on non-UI hosts above.)
  const note = `Loadout card for ${spec.className} shown to the user — subclass, weapons, and armor with their perks, mods, and aspects${spec.artifact ? ", plus the seasonal artifact and its perks" : ""}. The card is the answer; don't restate its contents in prose.`;
  const content = [{ type: "text" as const, text: note }, ...images];

  // The iframe renders client-side from structuredContent, which never reaches the model — so the
  // base64 icon map rides here at zero token cost. Inlining as data URIs is required because Claude
  // Desktop's MCP-App sandbox blocks remote image hosts (it allows data: URIs); elementPips lets the
  // client map a weapon's element to its pip icon.
  const action = opts.ui.action;
  const structuredContent: Record<string, unknown> = {
    ...model,
    ...(action ? { action } : {}),
    icons: await iconMap(model),
    elementPips: ELEMENT_PIP,
  };

  return { content, structuredContent };
}

/**
 * Wrap the advisor's Triumph suggestions as a tool response carrying the rendered grid card.
 *
 * Mirrors `card()`: the text card is the universal, model-visible fallback. When `ui` is supplied
 * (UI-capable hosts only; see clientSupportsUi), the TriumphCardModel rides along as
 * structuredContent — the host forwards it to the iframe rendered from the `ui://destiny2/triumphs`
 * template (registered separately, linked via the tool's `_meta.ui.resourceUri`). On a UI host the
 * model gets a terse note instead of the full text card, so it doesn't restate the grid in prose;
 * plain hosts and the CLI just get the text card.
 */
export async function triumphCard(spec: TriumphCard, opts?: { ui?: boolean }) {
  if (!opts?.ui) {
    return { content: [{ type: "text" as const, text: renderTriumphCardText(spec) }] };
  }

  const model = triumphCardModel(spec);
  const note = `Triumph grid shown to the user — ${model.tiles.length} ranked Triumph${model.tiles.length === 1 ? "" : "s"} to chase, each with its score, progress, objectives, and the reasons it's worth doing. The card is the answer; don't restate its contents in prose.`;

  // The iframe renders client-side from structuredContent, which never reaches the model — so the
  // base64 icon map rides here at zero token cost (Claude Desktop's sandbox blocks remote hosts but
  // allows data: URIs).
  const structuredContent: Record<string, unknown> = {
    ...model,
    icons: await triumphIconMap(model),
  };

  return { content: [{ type: "text" as const, text: note }], structuredContent };
}

/**
 * Wrap the Titles gallery as a tool response carrying the rendered Seals card.
 *
 * Mirrors `triumphCard()`: the text card is the universal, model-visible fallback. When `ui` is
 * supplied (UI-capable hosts only; see clientSupportsUi), the TitleCardModel rides along as
 * structuredContent — the host forwards it to the iframe rendered from the `ui://destiny2/titles`
 * template (registered separately, linked via the tool's `_meta.ui.resourceUri`). On a UI host the
 * model gets a terse note instead of the full text card, so it doesn't restate the gallery in prose;
 * plain hosts and the CLI just get the text card. The seal emblems inline as data: URIs (Claude
 * Desktop's sandbox blocks remote hosts but allows data:).
 */
export async function titleCard(spec: TitleCard, opts?: { ui?: boolean }) {
  if (!opts?.ui) {
    return { content: [{ type: "text" as const, text: renderTitleCardText(spec) }] };
  }

  const model = titleCardModel(spec);
  const earned = model.tiles.filter((tile) => tile.status === "earned").length;
  const note = `Titles gallery shown to the user — ${model.tiles.length} seal${model.tiles.length === 1 ? "" : "s"}, ${earned} earned, each with its title, the seal's source, completion, and unlock requirement. The card is the answer; don't restate its contents in prose.`;

  const structuredContent: Record<string, unknown> = {
    ...model,
    icons: await titleIconMap(model),
  };

  return { content: [{ type: "text" as const, text: note }], structuredContent };
}

/**
 * Wrap one resolved title as a tool response carrying the single-title detail card.
 *
 * Mirrors `titleCard()`: the text card is the universal, model-visible fallback. When `ui` is
 * supplied (UI-capable hosts only; see clientSupportsUi), the TitleDetailModel rides along as
 * structuredContent — the host forwards it to the iframe rendered from the `ui://destiny2/title`
 * template. On a UI host the model gets a terse note instead of the full text card; plain hosts and
 * the CLI just get the text card. The seal emblem and member-Triumph icons inline as data: URIs.
 */
export async function titleDetailCard(spec: TitleDetailCard, opts?: { ui?: boolean }) {
  if (!opts?.ui) {
    return { content: [{ type: "text" as const, text: renderTitleDetailText(spec) }] };
  }

  const model = titleDetailModel(spec);
  const standing = model.earned
    ? "earned" + (model.gilded ? ` (gilded ×${model.gilded})` : "")
    : `${model.complete}/${model.total} Triumphs · ${model.percent}%`;
  const note = `Title detail card for "${model.title}" (${model.name} Seal) shown to the user — ${standing}, with every member Triumph laid out and its progress. The card is the answer; don't restate its Triumphs in prose.`;

  const structuredContent: Record<string, unknown> = {
    ...model,
    icons: await titleDetailIconMap(model),
  };

  return { content: [{ type: "text" as const, text: note }], structuredContent };
}

/**
 * Wrap a session agenda as a tool response carrying its rendered timeline card.
 *
 * Mirrors `triumphCard()`: the text card is the universal, model-visible fallback. When `ui` is
 * supplied (UI-capable hosts only; see clientSupportsUi), the AgendaCardModel rides along as
 * structuredContent — the host forwards it to the iframe rendered from the `ui://destiny2/agenda`
 * template (registered separately, linked via the tool's `_meta.ui.resourceUri`). On a UI host the
 * model gets a terse note instead of the full text card, so it doesn't restate the agenda in prose;
 * plain hosts and the CLI just get the text card. Item icons inline as data: URIs (Claude Desktop's
 * sandbox blocks remote hosts but allows data:).
 */
export async function agendaCard(spec: AgendaCard, opts?: { ui?: boolean }) {
  if (!opts?.ui) {
    return { content: [{ type: "text" as const, text: renderAgendaCardText(spec) }] };
  }

  const model = agendaCardModel(spec);
  const items = model.phases.reduce((sum, phase) => sum + phase.items.length, 0);
  const note = `Agenda shown to the user — ${items} item${items === 1 ? "" : "s"} across ${model.phases.length} phase${model.phases.length === 1 ? "" : "s"}, each with its time estimate, progress, and reason. The card is the answer; don't restate its contents in prose.`;

  const structuredContent: Record<string, unknown> = {
    ...model,
    icons: await agendaIconMap(model),
    // An embedded weapon card maps its element to a pip icon by path, the way the weapon card does.
    elementPips: ELEMENT_PIP,
  };

  return { content: [{ type: "text" as const, text: note }], structuredContent };
}

/**
 * Wrap a weapon as a tool response carrying its inspect card (see renderWeaponCardText).
 *
 * The weapon's own icon rides along as a model-visible image block (like show_item), and the text
 * card is the model-visible content on plain hosts and the CLI. When `ui` is true (a UI-capable host;
 * see clientSupportsUi), the WeaponCard rides as structuredContent — forwarded to the iframe rendered
 * from the `ui://destiny2/weapon` template — and the model gets a terse note instead of the text card,
 * so it doesn't echo the perk grid back in prose. The inlined icon map (perk + element icons as data
 * URIs) rides in structuredContent at zero token cost, as Claude Desktop's sandbox blocks remote hosts.
 */
export async function weaponCard(spec: WeaponCard, opts?: { ui?: boolean }) {
  const block = await weaponIconBlock(spec);
  const images = block ? [block] : [];

  if (!opts?.ui) {
    return {
      content: [{ type: "text" as const, text: renderWeaponCardText(spec) }, ...images],
    };
  }

  const rolled = spec.instance ? ", with the equipped roll highlighted" : "";
  const note = `Weapon inspect card for ${spec.name} shown to the user — its intrinsic frame and the candidate perks per column${rolled}. The card is the answer; don't restate its perks in prose.`;
  const structuredContent: Record<string, unknown> = {
    ...spec,
    icons: await weaponIconMap(spec),
    elementPips: ELEMENT_PIP,
  };

  return { content: [{ type: "text" as const, text: note }, ...images], structuredContent };
}

/**
 * Wrap an activity recap as a tool response carrying its rendered dashboard card.
 *
 * Mirrors `triumphCard()`: the text card is the universal, model-visible fallback. When `ui` is
 * supplied (UI-capable hosts only; see clientSupportsUi), the RecapCardModel rides along as
 * structuredContent — the host forwards it to the iframe rendered from the `ui://destiny2/recap`
 * template (registered separately, linked via the tool's `_meta.ui.resourceUri`). On a UI host the
 * model gets a terse note instead of the full text card, so it doesn't restate the recap in prose;
 * plain hosts and the CLI just get the text card. The PGCR backdrop inlines as a data: URI (Claude
 * Desktop's sandbox blocks remote hosts but allows data:).
 */
export async function recapCard(spec: RecapCard, opts?: { ui?: boolean }) {
  if (!opts?.ui) {
    return { content: [{ type: "text" as const, text: renderRecapCardText(spec) }] };
  }

  const model = recapCardModel(spec);
  const note = `Activity recap shown to the user — ${spec.summary.totalActivities} activities over ${model.subtitle}, with the headline totals, a by-mode breakdown, and notable runs. The card is the answer; don't restate its contents in prose.`;

  const structuredContent: Record<string, unknown> = {
    ...model,
    icons: await recapIconMap(model),
  };

  return { content: [{ type: "text" as const, text: note }], structuredContent };
}

/**
 * Wrap an armor piece as a tool response carrying its inspect card (see renderArmorCardText).
 *
 * Mirrors weaponCard. The piece's own icon rides along as a model-visible image block (like
 * show_item), and the text card is the model-visible content on plain hosts and the CLI. When `ui` is
 * true (a UI-capable host; see clientSupportsUi), the ArmorCard rides as structuredContent —
 * forwarded to the iframe rendered from the `ui://destiny2/armor` template — and the model gets a
 * terse note instead of the text card, so it doesn't echo the stat block back in prose. The inlined
 * icon map (exotic-perk + mod icons as data URIs) rides in structuredContent at zero token cost, as
 * Claude Desktop's sandbox blocks remote hosts.
 */
export async function armorCard(spec: ArmorCard, opts?: { ui?: boolean }) {
  const block = await armorIconBlock(spec);
  const images = block ? [block] : [];

  if (!opts?.ui) {
    return {
      content: [{ type: "text" as const, text: renderArmorCardText(spec) }, ...images],
    };
  }

  const note = `Armor inspect card for ${spec.name} shown to the user — its six archetype stats, exotic perk, set bonuses, and slotted mods. The card is the answer; don't restate its stats in prose.`;
  const structuredContent: Record<string, unknown> = {
    ...spec,
    icons: await armorIconMap(spec),
  };

  return { content: [{ type: "text" as const, text: note }, ...images], structuredContent };
}

/**
 * Wrap an artifact as a tool response carrying its rendered box card (see renderArtifactCardText).
 *
 * @example
 * // → { content: [{ type: "text", text: "╭───╮\n│ TERMINAL OVERLOAD … │\n…╰───╯" }] }
 */
export function artifactCard(view: ArtifactView) {
  return { content: [{ type: "text" as const, text: renderArtifactCardText(view) }] };
}

/**
 * Wrap a confirmation message followed by the response payload's pretty-printed JSON.
 *
 * @example
 * ok("Equipped Quicksilver Storm.", { equipped: true })
 * // → { content: [{ type: "text", text: 'Equipped Quicksilver Storm.\n{\n  "equipped": true\n}' }] }
 */
export function ok(message: string, response: unknown) {
  return {
    content: [{ type: "text" as const, text: `${message}\n${JSON.stringify(response, null, 2)}` }],
  };
}
