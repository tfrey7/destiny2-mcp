import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { buildKnowledge } from "./data.js";

// The build knowledge is static reference content, so each section is also exposed as a resource —
// a client can browse or attach a single topic by URI (knowledge://loadout) without the model
// having to call a tool. The tool below stays for autonomous, model-driven retrieval mid-build;
// both read from buildKnowledge so data.ts remains the single source of truth.
export function registerKnowledgeResources(server: McpServer): void {
  const template = new ResourceTemplate(`${SCHEME}://{topic}`, {
    list: () => ({
      resources: buildKnowledge.map((section) => ({
        name: section.id,
        uri: `${SCHEME}://${section.id}`,
        title: section.title,
        mimeType: "text/markdown" as const,
      })),
    }),
    complete: {
      topic: (value) =>
        buildKnowledge
          .map((section) => section.id)
          .filter((id) => id.startsWith(value.toLowerCase())),
    },
  });

  server.registerResource(
    "build-knowledge",
    template,
    {
      description:
        "Curated Destiny 2 build-crafting knowledge, one section per topic. Static reference frozen " +
        "at the game's end-of-life — pair with the live tools for exact effects and the player's gear.",
      mimeType: "text/markdown",
    },
    (uri, { topic }) => {
      const id = String(topic).toLowerCase();
      const section = buildKnowledge.find((candidate) => candidate.id === id);

      if (!section) {
        throw new Error(
          `No knowledge section "${topic}". Topics: ${buildKnowledge.map((s) => s.id).join(", ")}.`,
        );
      }

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "text/markdown" as const,
            text: render([section]),
          },
        ],
      };
    },
  );
}

export function registerKnowledgeTools(server: McpServer): void {
  const topics = buildKnowledge.map((section) => section.id).join(", ");

  server.registerTool(
    "get_build_knowledge",
    {
      description:
        "Curated Destiny 2 build-crafting knowledge: loadout mechanics (slots, elements, exotic limits), " +
        "the verb system, each subclass's engine, build archetypes, cross-cutting systems, and proven " +
        "synergy recipes. Qualitative reasoning frozen at " +
        "the game's end-of-life — pair it with inspect_item / list_inventory for exact current effects and " +
        `the player's actual gear. Optionally pass a topic to read one section. Topics: ${topics}.`,
      inputSchema: {
        topic: z.string().optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ topic }) => {
      if (!topic) {
        return { content: [{ type: "text" as const, text: render(buildKnowledge) }] };
      }

      const term = topic.toLowerCase();
      const matches = buildKnowledge.filter(
        (section) => section.id === term || section.title.toLowerCase().includes(term),
      );

      if (matches.length === 0) {
        return {
          content: [{ type: "text" as const, text: `No section "${topic}". Topics: ${topics}.` }],
        };
      }

      return { content: [{ type: "text" as const, text: render(matches) }] };
    },
  );
}

const SCHEME = "knowledge";

function render(sections: typeof buildKnowledge): string {
  return sections.map((section) => `## ${section.title}\n\n${section.body}`).join("\n\n");
}
