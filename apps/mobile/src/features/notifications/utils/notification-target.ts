import type { Href } from "expo-router";
import { uuid } from "@/lib/http/contracts";
import type { InboxNotification } from "../api/notifications-api";

const proposalTypes = new Set([
  "proposal.created",
  "proposal.updated",
  "proposal.accepted",
  "proposal.rejected",
  "proposal.withdrawn",
  "proposal.expired",
]);

// Payloads are references, never trusted URLs. Unknown types remain readable in the inbox.
export function notificationTarget(item: InboxNotification): Href | undefined {
  if (
    !item.payload ||
    typeof item.payload !== "object" ||
    Array.isArray(item.payload)
  )
    return;
  const payload = item.payload as Record<string, unknown>;
  const valid = (field: string) => uuid.safeParse(payload[field]).success;
  if (item.type === "chat.message.delivered" && valid("conversationId"))
    return {
      pathname: "/chat/[proposalId]",
      params: { proposalId: payload.conversationId as string, mode: "api" },
    };
  if (proposalTypes.has(item.type) && valid("proposalId"))
    return {
      pathname: "/proposal/[id]",
      params: { id: payload.proposalId as string },
    };
  if (item.type === "LEARNING_REQUEST_REJECTED" && valid("requestId"))
    return {
      pathname: "/requests/[id]",
      params: { id: payload.requestId as string },
    };
  if (
    ["skill.verification.decided", "skill.evidence.revoked"].includes(
      item.type,
    ) &&
    valid("sharingSkillId") &&
    valid("verificationId")
  )
    return {
      pathname: "/my-skills/[sharingSkillId]/verifications/[verificationId]",
      params: {
        sharingSkillId: payload.sharingSkillId as string,
        verificationId: payload.verificationId as string,
      },
    };
  if (
    ["learning-path.locked", "learning-path.settled"].includes(item.type) &&
    valid("pathId")
  )
    return {
      pathname: "/paths/[id]",
      params: { id: payload.pathId as string, mode: "api" },
    };
}
