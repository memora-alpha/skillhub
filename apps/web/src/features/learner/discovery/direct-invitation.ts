import { findInPages } from "../api/find-page";
import { UserApiError } from "../api/client";
import type { Proposal } from "../types";
import type { PublicSharingSkill } from "./discovery-types";

export type InvitationBody = {
  sourceType: "DIRECT_SEARCH";
  recipientSharingSkillId: string;
  message: string;
  exchangeTypeHint: string | null;
  candidateSlots: string | null;
  proposedCredit?: string | null;
  proposedDurationMinutes?: number | null;
};

export async function sendDirectInvitation(
  request: Parameters<typeof findInPages>[0],
  target: { recipientId: string; skillId: string },
  body: InvitationBody,
  key: string,
) {
  const pending = await findInPages<Proposal>(
    request,
    "proposals?direction=sent&status=PENDING&limit=100",
    (row) =>
      row.status === "PENDING" &&
      row.sourceType === "DIRECT_SEARCH" &&
      row.recipientId === target.recipientId &&
      row.skillId === target.skillId,
  );
  if (pending) return { id: pending.id };
  const skill = await findInPages<PublicSharingSkill>(
    request,
    "profiles/" + target.recipientId + "/skills?limit=50",
    (row) =>
      row.id === body.recipientSharingSkillId &&
      row.skill.id === target.skillId,
  );
  if (!skill) throw new UserApiError(409, "DIRECT_TARGET_UNAVAILABLE");
  return (await request<Proposal>("proposals", { method: "POST", body, key }))
    .data;
}
