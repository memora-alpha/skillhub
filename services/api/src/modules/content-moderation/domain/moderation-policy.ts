export const moderationSurfaces = [
  "chat",
  "learning_request",
  "review",
  "material_review",
  "material",
  "report",
  "case_message",
  "report_evidence",
  "profile",
  "sharing_skill",
  "tag_request",
  "proposal",
  "learning_path",
  "schedule",
  "session",
  "media",
] as const;

export type ModerationSurface = (typeof moderationSurfaces)[number];
export type ModerationMode = "off" | "observe" | "enforce";
export type ModerationOutcome = "ALLOW" | "BLOCK" | "REVIEW" | "RETRY";

export const moderationFlags = [
  "harassment",
  "harassment/threatening",
  "hate",
  "hate/threatening",
  "illicit",
  "illicit/violent",
  "self-harm",
  "self-harm/intent",
  "self-harm/instructions",
  "sexual",
  "sexual/minors",
  "violence",
  "violence/graphic",
] as const;

type ModerationFlag = (typeof moderationFlags)[number];

const alwaysBlockWhenFlagged: ReadonlySet<ModerationFlag> = new Set([
  "harassment/threatening",
  "hate/threatening",
  "illicit/violent",
  "sexual/minors",
  "violence/graphic",
]);

const scoreThresholds: Partial<
  Record<ModerationFlag, { review: number; block: number }>
> = {
  harassment: { review: 0.4, block: 0.6 },
  hate: { review: 0.4, block: 0.6 },
  sexual: { review: 0.4, block: 0.6 },
  violence: { review: 0.25, block: 0.35 },
};

export const moderationPolicyVersion = "skillhub-content-v2";

export type ProviderClassification = {
  id: string;
  model: string;
  flagged: boolean;
  categories: Record<string, boolean>;
  category_scores: Record<string, number>;
};

export function assessClassification(result: ProviderClassification): {
  outcome: ModerationOutcome;
  reasonCodes: string[];
} {
  const flagged = moderationFlags.filter((name) => result.categories[name]);
  if (result.flagged && flagged.length === 0)
    return { outcome: "REVIEW", reasonCodes: ["UNMAPPED_FLAG"] };

  const blocked = flagged.filter((name) => {
    const thresholds = scoreThresholds[name];
    const score = result.category_scores[name];
    return (
      alwaysBlockWhenFlagged.has(name) ||
      (thresholds && score !== undefined && score >= thresholds.block)
    );
  });
  if (blocked.length) return { outcome: "BLOCK", reasonCodes: blocked };

  const review = flagged.filter((name) => {
    const thresholds = scoreThresholds[name];
    const score = result.category_scores[name];
    return !thresholds || score === undefined || score >= thresholds.review;
  });
  if (review.length) return { outcome: "REVIEW", reasonCodes: review };

  return { outcome: "ALLOW", reasonCodes: [] };
}
