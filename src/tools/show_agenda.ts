import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { itemMeta } from "../bungie/manifest.js";
import {
  Component,
  getProfile,
  getTriumphsProfile,
  type ProfileFor,
  type TriumphsProfile,
} from "../bungie/profile.js";
import { recordIcon, recordSuggestion, titleDetail } from "../bungie/progression.js";
import { AGENDA_UI_RESOURCE_URI } from "../format/agenda/html.js";
import type { AgendaCard, AgendaEmbed, AgendaItem, AgendaPhase } from "../format/agenda/model.js";
import { titleDetailModel } from "../format/title/index.js";
import { triumphCardModel } from "../format/triumphs/index.js";
import { agendaCard } from "./response.js";
import { armorCardSpec } from "./show_armor.js";
import { clientSupportsUi } from "./ui_capability.js";
import { weaponCardSpec } from "./show_weapon.js";

// The profile slice an embed may need: a weapon embed reads rolled perks (sockets + reusable plugs),
// an armor embed reads stats + slotted mods. Fetched once, best-effort, and passed to both spec
// builders (their narrower profile shapes are satisfied by this superset).
const EMBED_COMPONENTS = [
  Component.Characters,
  Component.CharacterEquipment,
  Component.CharacterInventories,
  Component.ProfileInventories,
  Component.ItemSockets,
  Component.ItemReusablePlugs,
  Component.ItemStats,
] as const;

type EmbedProfile = ProfileFor<typeof EMBED_COMPONENTS>;

const itemSchema = z.object({
  name: z.string().describe("The activity or objective, e.g. 'Win 3 Gambit matches'."),
  detail: z
    .string()
    .optional()
    .describe("One line on why it's worth doing now — the reward, the seal it feeds, the payoff."),
  minutes: z.number().int().min(0).optional().describe("Rough time estimate in minutes."),
  current: z.number().min(0).optional().describe("Live progress numerator (e.g. 2 of 3 wins)."),
  total: z.number().min(0).optional().describe("Live progress denominator (e.g. 3 of 3 wins)."),
  progressLabel: z
    .string()
    .optional()
    .describe("Overrides the derived 'current/total' label, e.g. 'step 3/5', 'quest', 'weekly'."),
  expiring: z
    .boolean()
    .optional()
    .describe("Flags a time-limited item (expiring Triumph, seasonal challenge) with an ⏰ badge."),
  activityType: z
    .string()
    .optional()
    .describe("Place/mode chip — 'Gambit', 'Raid', 'Crucible', 'Nightfall'."),
  location: z
    .string()
    .optional()
    .describe("Destination chip — 'The Moon', 'Europa', 'Dreaming City'."),
  iconHash: z
    .number()
    .optional()
    .describe(
      "Manifest item hash for a reward/quest/exotic icon to show next to the item — from list_active_quests, suggest_triumphs rewards, or search_items. Omit to show a neutral bullet.",
    ),
  embed: z
    .object({
      kind: z
        .enum(["weapon", "armor", "triumph"])
        .describe("What the item links to: a weapon, an armor piece, or a Triumph."),
      hash: z
        .number()
        .int()
        .describe(
          "The linked entity's hash — itemHash for weapon/armor (from search_items), recordHash for triumph (from search_records / suggest_triumphs).",
        ),
      instanceId: z
        .string()
        .optional()
        .describe(
          "For weapon/armor: an owned copy's itemInstanceId (from list_inventory / get_equipped) to show its real rolled perks/stats. Omit to show the manifest's god-roll/candidate pool.",
        ),
    })
    .optional()
    .describe(
      "Attach the full weapon/armor/triumph card to this item; the player can expand it inline in the timeline. Use when the item IS a weapon (a catalyst grind), an armor piece, or a Triumph.",
    ),
});

const phaseSchema = z.object({
  label: z
    .string()
    .describe("The phase name — 'Warm-up', 'Focus', 'Stretch', or whatever fits the session."),
  minutes: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe("Time budget for the phase. Omit to sum the items' estimates."),
  items: z.array(itemSchema).describe("The activities to do in this phase, in order."),
});

export function registerShowAgenda(server: McpServer): void {
  server.registerTool(
    "show_agenda",
    {
      description:
        "Render a play-session agenda as a timeline card — the prioritized things to focus on this " +
        "session, grouped into phases (e.g. Warm-up / Focus / Stretch). This is how you answer 'what " +
        "should I do tonight?' or 'give me an agenda for <goal>': lead with this card, not prose. The " +
        "agenda is YOUR synthesis of the player's live state — gather it first from list_active_quests, " +
        "suggest_triumphs (already ROI-ranked; scope by location/activity for a stated objective), " +
        "get_triumphs, get_artifact, and activity_recap — then sequence it into phases here. This server " +
        "has no weekly/seasonal rotation data, so build the agenda from the player's own pursuits, not " +
        "an invented 'this week's Nightfall'. Give each item a time estimate, its live progress, an " +
        "expiry flag if time-limited, and a reward/quest icon (iconHash) when you have one. When an item " +
        "IS a weapon, armor piece, or Triumph, attach an `embed` so its name reveals that full card on " +
        "hover (the weapon/armor/triumph card); when the goal IS a title, pass titleQuery so the " +
        "objective pill reveals the seal's remaining Triumphs on hover. Read get_build_knowledge('agenda') " +
        "for the full procedure. The card IS the answer — follow it only with a few short 'why this order' " +
        "bullets; don't restate its contents. Read-only; changes nothing.",
      inputSchema: {
        title: z.string().describe('Agenda heading, e.g. "Tonight\'s Agenda".'),
        objective: z
          .string()
          .optional()
          .describe(
            "The session's theme, e.g. 'Chase the Dredgen title'. Shown as a pill in the header.",
          ),
        titleQuery: z
          .string()
          .optional()
          .describe(
            "When the session's goal IS a title/seal, the title word ('Dredgen'), seal source ('Gambit'), or seal hash. The objective pill then reveals that seal's card — every remaining member Triumph and its progress — on hover.",
          ),
        phases: z.array(phaseSchema).describe("The ordered phases that make up the session."),
      },
      annotations: { readOnlyHint: true },
      _meta: { ui: { resourceUri: AGENDA_UI_RESOURCE_URI, visibility: ["model", "app"] } },
    },
    async ({ title, objective, titleQuery, phases }) => {
      // Embeds may need live state: a weapon/armor copy's rolled perks (gear profile, only when an
      // instanceId is given), a Triumph's live progress, or a title's seal (both Triumphs profile).
      // Fetch each once, best-effort and only when something needs it — a logged-out call still renders
      // the agenda (a gear embed falls back to the manifest god-roll; a Triumph/title embed is dropped).
      const items = phases.flatMap((phase) => phase.items);
      const wantsGear = items.some(
        (item) =>
          (item.embed?.kind === "weapon" || item.embed?.kind === "armor") &&
          item.embed.instanceId !== undefined,
      );
      const wantsTriumphs =
        titleQuery !== undefined || items.some((item) => item.embed?.kind === "triumph");
      const profiles: EmbedProfiles = {
        gear: wantsGear ? await tryProfile() : null,
        triumphs: wantsTriumphs ? await tryTriumphsProfile() : null,
      };

      const resolvedPhases: AgendaPhase[] = await Promise.all(
        phases.map(async (phase) => ({
          label: phase.label,
          ...(phase.minutes !== undefined ? { minutes: phase.minutes } : {}),
          items: await Promise.all(phase.items.map((item) => resolveItem(item, profiles))),
        })),
      );

      const objectiveEmbed = titleQuery
        ? await resolveTitleEmbed(profiles.triumphs, titleQuery)
        : undefined;

      const spec: AgendaCard = {
        title: title.toUpperCase(),
        ...(objective ? { objective } : {}),
        ...(objectiveEmbed ? { objectiveEmbed } : {}),
        phases: resolvedPhases,
      };

      // UI-capable hosts get the interactive timeline via structuredContent; the CLI falls through to
      // the text card. The agenda is visual-only — no action button.
      return agendaCard(spec, { ui: clientSupportsUi(server) });
    },
  );
}

// Resolve an item's optional iconHash to a CDN icon path and its optional embed to a sub-card model.
// Best-effort: an unknown hash (or a logged-out manifest miss) just drops the icon/embed, so the item
// still renders with its neutral bullet.
// The live profiles an embed may need, fetched once and shared across items.
interface EmbedProfiles {
  gear: EmbedProfile | null;
  triumphs: TriumphsProfile | null;
}

async function resolveItem(
  item: z.infer<typeof itemSchema>,
  profiles: EmbedProfiles,
): Promise<AgendaItem> {
  const { iconHash, embed, ...rest } = item;
  const icon = iconHash !== undefined ? (await itemMeta(iconHash))?.icon : undefined;
  const resolved = embed ? await resolveEmbed(embed, profiles) : undefined;

  return { ...rest, ...(icon ? { icon } : {}), ...(resolved ? { embed: resolved } : {}) };
}

// Resolve an item's embed reference to its card sub-model, reusing the same spec builders the standalone
// tools use so the hover card can't drift from the real one. A miss (unknown hash, wrong item type,
// logged out for a Triumph) drops the embed rather than failing the agenda.
async function resolveEmbed(
  embed: NonNullable<z.infer<typeof itemSchema>["embed"]>,
  profiles: EmbedProfiles,
): Promise<AgendaEmbed | undefined> {
  if (embed.kind === "triumph") {
    return resolveTriumphEmbed(embed.hash, profiles.triumphs);
  }

  if (!(await itemMeta(embed.hash))) {
    return undefined;
  }

  if (embed.kind === "weapon") {
    return {
      kind: "weapon",
      card: await weaponCardSpec(embed.hash, embed.instanceId, profiles.gear),
    };
  }

  return { kind: "armor", card: await armorCardSpec(embed.hash, embed.instanceId, profiles.gear) };
}

// Build a Triumph embed from a record hash: the single-record suggestion reduced to a tile via the same
// triumphCardModel the grid uses. Needs the live Triumphs profile for progress; without it (logged out),
// the embed is dropped.
async function resolveTriumphEmbed(
  recordHash: number,
  profile: TriumphsProfile | null,
): Promise<AgendaEmbed | undefined> {
  if (!profile) {
    return undefined;
  }

  const suggestion = await recordSuggestion(profile, recordHash);

  if (!suggestion) {
    return undefined;
  }

  const icon = await recordIcon(recordHash);
  const model = triumphCardModel({
    title: "",
    subtitle: "",
    suggestions: [suggestion],
    ...(icon ? { icons: { [recordHash]: icon } } : {}),
  });
  const tile = model.tiles[0];

  return tile ? { kind: "triumph", tile } : undefined;
}

// Build a title embed from a title query (title word / seal source / seal hash): the seal resolved via
// titleDetail and reduced through titleDetailModel — the same path show_title uses — with each member
// Triumph's icon resolved. Needs the live Triumphs profile; without it (logged out), the embed is
// dropped and the objective shows as a plain pill.
async function resolveTitleEmbed(
  profile: TriumphsProfile | null,
  query: string,
): Promise<AgendaEmbed | undefined> {
  if (!profile) {
    return undefined;
  }

  const detail = await titleDetail(profile, query);

  if (!detail) {
    return undefined;
  }

  const icons: Record<number, string> = {};

  await Promise.all(
    detail.triumphs.map(async (triumph) => {
      const icon = await recordIcon(triumph.recordHash);

      if (icon) {
        icons[triumph.recordHash] = icon;
      }
    }),
  );

  return { kind: "title", detail: titleDetailModel({ detail, icons }) };
}

// Best-effort gear profile carrying the components a weapon/armor embed needs to read a copy's rolled
// perks, stats, and mods. A logged-out or failed fetch yields null, and the embed falls back to the
// manifest piece (god-roll / candidate pool, no per-copy roll).
async function tryProfile(): Promise<EmbedProfile | null> {
  try {
    return await getProfile([...EMBED_COMPONENTS]);
  } catch {
    return null;
  }
}

// Best-effort live Triumphs profile (records + presentation nodes) for a Triumph embed's progress.
async function tryTriumphsProfile(): Promise<TriumphsProfile | null> {
  try {
    return await getTriumphsProfile();
  } catch {
    return null;
  }
}
