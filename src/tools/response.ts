import { renderArtifactCardText, type ArtifactView } from "../format/artifact.js";
import { renderLoadoutCardText, type LoadoutCard } from "../format/loadout/index.js";

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
 * @example
 * // → { content: [{ type: "text", text: "╭───╮\n│ Threadrunner … │\n…╰───╯" }] }
 */
export function card(spec: LoadoutCard) {
  return { content: [{ type: "text" as const, text: renderLoadoutCardText(spec) }] };
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
