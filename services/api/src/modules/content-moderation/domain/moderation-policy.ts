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

const blockedFlags: ReadonlySet<string> = new Set([
  "harassment",
  "harassment/threatening",
  "hate",
  "hate/threatening",
  "illicit/violent",
  "sexual",
  "sexual/minors",
  "violence",
  "violence/graphic",
]);

export const moderationPolicyVersion = "skillhub-content-v1";

export type ProviderClassification = {
  id: string;
  model: string;
  flagged: boolean;
  categories: Record<string, boolean>;
};

export function assessClassification(result: ProviderClassification): {
  outcome: ModerationOutcome;
  reasonCodes: string[];
} {
  const categories = moderationFlags.filter((name) => result.categories[name]);
  if (categories.some((name) => blockedFlags.has(name)))
    return { outcome: "BLOCK", reasonCodes: categories };
  if (result.flagged || categories.length)
    return {
      outcome: "REVIEW",
      reasonCodes: categories.length ? categories : ["UNMAPPED_FLAG"],
    };
  return { outcome: "ALLOW", reasonCodes: [] };
}
