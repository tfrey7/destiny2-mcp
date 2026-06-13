import { renderArtifactCardText, type ArtifactView } from "../format/artifact.js";
import type { UiAction } from "../format/loadout/html.js";
import { ELEMENT_PIP, iconBlocks, iconMap } from "../format/loadout/images.js";
import { renderLoadoutCardText, type LoadoutCard } from "../format/loadout/index.js";
import { cardModel } from "../format/loadout/model.js";

/** How a card's gear art is delivered to the model. Only the bare icon blocks, for now. */
export type ImageStyle = "icons";

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
  const note = `Loadout card for ${spec.className} shown to the user — subclass, weapons, and armor with their perks, mods, and aspects. The card is the answer; don't restate its contents in prose.`;
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
