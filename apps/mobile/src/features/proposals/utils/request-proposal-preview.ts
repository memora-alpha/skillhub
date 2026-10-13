import { z } from "zod";

export type RequestProposalPreviewParams = {
  mode?: string;
  requestId?: string;
  previewTitle?: string;
  previewOwnerId?: string;
  previewOwnerName?: string;
  previewSkillName?: string;
};

const previewSchema = z.object({
  mode: z.literal("mock-request"),
  requestId: z.uuid(),
  previewTitle: z.string().trim().min(1).max(120),
  previewOwnerId: z.uuid(),
  previewOwnerName: z.string().trim().min(1).max(100),
  previewSkillName: z.string().trim().min(1).max(100),
});

export function readRequestProposalPreview(value: unknown) {
  const result = previewSchema.safeParse(value);
  if (!result.success) return null;
  const input = result.data;
  return {
    // The real identifier is only used for Back navigation, not the mock store.
    sourceRequestId: input.requestId,
    id: `preview-request:${input.requestId}`,
    userId: `preview-user:${input.previewOwnerId}`,
    user: input.previewOwnerName,
    title: input.previewTitle,
    tags: [input.previewSkillName],
    budget: "50",
    sessions: 4,
    teachingSkills: [
      {
        id: "preview-skill",
        name: input.previewSkillName,
        verified: false,
      },
    ],
  };
}
