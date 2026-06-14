import { itemInfo } from "../bungie/manifest.js";
import { getDefinition } from "../bungie/manifest_db.js";
import { objectivePercent, resolveObjectives, type ObjectiveView } from "../bungie/progression.js";
import { type DestinyItem, type ProfileResponse } from "../bungie/profile.js";

// An in-progress quest step a player is actively working: the current step, where it sits in its
// quest line, what's left on its objectives, and what completing it grants.
interface ActiveQuest {
  name: string;
  questLine?: string;
  step?: string;
  characterId: string;
  itemHash: number;
  percent: number;
  objectives: ObjectiveView[];
  rewards: string[];
}

// Enumerate the active quest steps across every character. A quest step is an inventory item in a
// quest bucket carrying the quest trait (which separates it from bounties); we keep only the ones
// the live objectives component (301) is tracking, since those are the steps actually in progress —
// Destiny leaves long-finished steps sitting in the bucket with no live objectives.
export async function activeQuests(profile: ProfileResponse): Promise<ActiveQuest[]> {
  const objectives = profile.itemComponents?.objectives?.data ?? {};
  const quests: ActiveQuest[] = [];

  for (const [characterId, bucket] of Object.entries(profile.characterInventories?.data ?? {})) {
    for (const item of bucket.items) {
      if (!QUEST_BUCKETS.has(item.bucketHash) || !item.itemInstanceId) {
        continue;
      }

      const live = objectives[item.itemInstanceId]?.objectives;

      if (!live) {
        continue;
      }

      const step = await questStep(item.itemHash);

      if (!step?.isQuest) {
        continue;
      }

      const views = await resolveObjectives(live);

      quests.push({
        name: step.name,
        ...(step.questLine ? { questLine: step.questLine } : {}),
        ...(step.step ? { step: step.step } : {}),
        characterId,
        itemHash: item.itemHash,
        percent: views.every((view) => view.complete) ? 100 : objectivePercent(views),
        objectives: views,
        rewards: await Promise.all(step.rewardItemHashes.map(rewardName)),
      });
    }
  }

  return quests;
}

// DestinyInventoryBucketDefinition hashes for the two buckets that hold quest steps: "Quests" and
// the pursuits tray. Bounties share these buckets, so the quest trait below does the real filtering.
const QUEST_BUCKETS = new Set([1345459588, 1801258597]);

const QUEST_TRAIT = "inventory_filtering.quest";

interface QuestStep {
  name: string;
  isQuest: boolean;
  questLine?: string;
  step?: string;
  rewardItemHashes: number[];
}

interface RawQuestStep {
  displayProperties?: { name?: string };
  traitIds?: string[];
  setData?: { questLineName?: string; itemList?: { itemHash: number }[] };
  value?: { itemValue?: { itemHash: number }[] };
}

async function questStep(itemHash: number): Promise<QuestStep | undefined> {
  const def = await getDefinition<RawQuestStep>("DestinyInventoryItemDefinition", itemHash);
  const name = def.displayProperties?.name;

  if (!name) {
    return undefined;
  }

  return {
    name,
    isQuest: def.traitIds?.includes(QUEST_TRAIT) ?? false,
    questLine: def.setData?.questLineName || undefined,
    step: stepPosition(itemHash, def.setData?.itemList),
    // itemValue pads the reward list with empty (itemHash 0) slots; keep only the real grants.
    rewardItemHashes: (def.value?.itemValue ?? [])
      .map((reward) => reward.itemHash)
      .filter((hash) => hash !== 0),
  };
}

// "3 of 11" when the current step can be located in its quest line's ordered step list.
function stepPosition(itemHash: number, itemList?: { itemHash: number }[]): string | undefined {
  if (!itemList?.length) {
    return undefined;
  }

  const index = itemList.findIndex((entry) => entry.itemHash === itemHash);

  return index >= 0 ? `${index + 1} of ${itemList.length}` : undefined;
}

async function rewardName(itemHash: number): Promise<string> {
  return (await itemInfo(itemHash))?.name ?? `Item ${itemHash >>> 0}`;
}
