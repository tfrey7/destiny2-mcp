import { renderArtifactCardText, type ArtifactView } from "../format/artifact.js";
import { renderLoadoutCardText, type LoadoutCard } from "../format/loadout/index.js";

export function json(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] };
}

export function card(spec: LoadoutCard) {
  return { content: [{ type: "text" as const, text: renderLoadoutCardText(spec) }] };
}

export function artifactCard(view: ArtifactView) {
  return { content: [{ type: "text" as const, text: renderArtifactCardText(view) }] };
}

export function ok(message: string, response: unknown) {
  return {
    content: [{ type: "text" as const, text: `${message}\n${JSON.stringify(response, null, 2)}` }],
  };
}
