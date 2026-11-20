import { ServiceUnavailableException } from "@nestjs/common";
import type { ContentModerationService } from "../../../content-moderation/application/content-moderation.service";
import {
  evaluateModeration,
  type ModerationContent,
  type ModerationRuleSnapshot,
} from "../../domain/moderation.policy";

export async function assessLearningRequest(
  content: ModerationContent,
  rules: ModerationRuleSnapshot,
  version: number,
  classifier?: ContentModerationService,
) {
  const local = evaluateModeration(content, rules);
  const assessment = await classifier?.evaluateText(
    "learning_request",
    String(version),
    [
      content.title,
      content.description,
      content.learningGoal,
      content.teachingOverview,
      ...content.tags,
      ...(content.proposedTags ?? []),
    ],
  );
  if (!assessment || assessment.outcome === "ALLOW") return local;
  if (assessment.outcome === "RETRY")
    throw new ServiceUnavailableException(
      "CONTENT_MODERATION_TEMPORARILY_UNAVAILABLE",
    );
  const categories = new Set([
    ...local.categories,
    ...assessment.reasonCodes.map((code) => `AI:${code}`),
  ]);
  return { ...local, flagged: true, categories: [...categories] };
}
