import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { buildKnowledge } from "./data.js";

function render(sections: typeof buildKnowledge): string {
  return sections.map((section) => `## ${section.title}\n\n${section.body}`).join("\n\n");
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
