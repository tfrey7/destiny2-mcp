import { artifactName, artifactPerkText } from "../bungie/manifest.js";
import { type FullProfile, type SeasonalArtifact } from "../bungie/profile.js";

// The artifact is account-wide, so its unlock state is identical on every character; read the first.
export function seasonalArtifact(
  profile: Pick<FullProfile, "characterProgressions">,
): SeasonalArtifact | undefined {
  for (const character of Object.values(profile.characterProgressions)) {
    if (character.seasonalArtifact) {
      return character.seasonalArtifact;
    }
  }

  return undefined;
}

export async function describeArtifact(artifact: SeasonalArtifact) {
  const tiers = await Promise.all(
    artifact.tiers.map(async (tier, index) => ({
      tier: index + 1,
      unlocked: tier.isUnlocked,
      perks: await Promise.all(
        tier.items
          .filter((perk) => perk.isVisible !== false)
          .map(async (perk) => {
            const { name, description } = await artifactPerkText(perk.itemHash);

            return { name, description, active: perk.isActive };
          }),
      ),
    })),
  );

  return {
    name: await artifactName(artifact.artifactHash),
    pointsUsed: artifact.pointsUsed,
    resetCount: artifact.resetCount,
    tiers,
  };
}
