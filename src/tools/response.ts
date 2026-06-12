import { renderArtifactCardText, type ArtifactView } from "../format/artifact.js";
import type { UiAction } from "../format/loadout/html.js";
import { renderLoadoutCardText, type LoadoutCard } from "../format/loadout/index.js";
import { cardModel } from "../format/loadout/model.js";

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
 * When `ui` is supplied (only for UI-capable hosts; see clientSupportsUi), the loadout's
 * cardModel rides along as structuredContent. The host forwards that to the iframe rendered
 * from the `ui://destiny2/loadout` template (registered separately, linked via the tool's
 * `_meta.ui.resourceUri`) over `ui/notifications/tool-result`. An optional `action` becomes the
 * card's button. Plain (non-UI) hosts and the CLI just get the text card, byte-identical.
 *
 * @example
 * // → { content: [{ type: "text", text: "╭───╮\n│ Threadrunner … │\n…╰───╯" }] }
 */
export function card(spec: LoadoutCard, ui?: { action?: UiAction }) {
  const content = [{ type: "text" as const, text: renderLoadoutCardText(spec) }];

  if (!ui) {
    return { content };
  }

  const model = cardModel(spec);

  return { content, structuredContent: ui.action ? { ...model, action: ui.action } : model };
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
