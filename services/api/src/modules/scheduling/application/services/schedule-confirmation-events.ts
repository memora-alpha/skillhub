import { randomUUID } from "node:crypto";
import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";
import { enqueueSystemMessage } from "../../../conversations/application/services/system-messages";
import { readUserDisplayNames } from "../../../users/application/services/user-display-names";

type Confirmation = {
  pathId: string;
  conversationId: string;
  actorId: string;
  recipientId: string;
  scheduleId: string;
  scheduleVersion: number;
  bothConfirmed: boolean;
  isReschedule: boolean;
  rescheduleApplied: boolean;
};

function confirmationStatus(input: Confirmation, otherName: string) {
  if (input.rescheduleApplied)
    return "Hai bên đã xác nhận đổi lịch. Lịch mới đã được áp dụng.";
  if (input.bothConfirmed)
    return "Hai bên đã xác nhận lịch này. Chờ chốt thỏa thuận.";
  if (input.isReschedule)
    return `Đang chờ ${otherName} xác nhận đổi lịch. Lịch hiện tại vẫn giữ nguyên.`;
  return `Đang chờ ${otherName} xác nhận.`;
}

/** Called only on the first confirmation by this participant/version, under the path lock. */
export async function recordScheduleConfirmation(
  tx: TransactionContext,
  input: Confirmation,
) {
  const item = await tx.scheduleItem.findFirst({
    where: {
      scheduleProposalId: input.scheduleId,
      scheduleVersion: input.scheduleVersion,
    },
    orderBy: { sessionNo: "asc" },
    select: { planId: true, planVersion: true },
  });
  if (!item) throw new Error("CONFIRMED_SCHEDULE_PLAN_MISSING");
  const plan = await tx.learningPlan.findUniqueOrThrow({
    where: { id: item.planId },
    select: { teacherId: true, learnerId: true },
  });
  const names = await readUserDisplayNames(tx, [
    input.actorId,
    input.recipientId,
  ]);
  const name = (id: string) => names.get(id) || "Người dùng";
  const action = input.isReschedule ? "đồng ý đổi lịch" : "xác nhận lịch";
  const body = `${name(input.actorId)} đã ${action} ${name(plan.teacherId)} dạy ${name(plan.learnerId)}. ${confirmationStatus(input, name(input.recipientId))}`;
  const messageId = await enqueueSystemMessage(tx, {
    conversationId: input.conversationId,
    senderId: input.actorId,
    messageText: body,
    objectType: "SCHEDULE_PROPOSAL",
    objectId: input.scheduleId,
    objectVersion: input.scheduleVersion,
  });
  await tx.outboxEvent.create({
    data: {
      aggregateType: "SCHEDULE_PROPOSAL",
      aggregateId: input.scheduleId,
      version: 1,
      type: "learning-path.schedule.confirmed",
      payload: {
        ...input,
        planId: item.planId,
        planVersion: item.planVersion,
        teacherId: plan.teacherId,
        learnerId: plan.learnerId,
        messageId,
        body,
      },
      dedupeKey: `schedule-confirmed:${input.scheduleId}:v${input.scheduleVersion}:${input.actorId}`,
      correlationId: randomUUID(),
    },
  });
}
