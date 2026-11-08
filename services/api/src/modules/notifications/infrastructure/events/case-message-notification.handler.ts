import { Injectable, OnModuleInit } from "@nestjs/common";
import { z } from "zod";
import { TransactionRunner } from "../../../../infrastructure/database/transaction-runner";
import {
  OutboxPublisherRegistry,
  type OutboxMessage,
  type OutboxPublisher,
} from "../../../../infrastructure/events/outbox.types";
import { UsersService } from "../../../users/application/services/users.service";
import { NotificationDispatcher } from "../../application/services/notification-dispatcher";
const payload = z.object({
  caseId: z.uuid(),
  partyId: z.uuid(),
  senderId: z.uuid(),
  messageId: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .optional(),
  evidenceId: z.uuid().optional(),
});
@Injectable()
export class CaseMessageNotificationHandler
  implements OnModuleInit, OutboxPublisher
{
  constructor(
    private readonly registry: OutboxPublisherRegistry,
    private readonly transactions: TransactionRunner,
    private readonly users: UsersService,
    private readonly dispatcher: NotificationDispatcher,
  ) {}
  onModuleInit() {
    this.registry.register("report.case.message", this);
    this.registry.register("report.case.evidence", this);
  }
  async publish(event: OutboxMessage) {
    const data = payload.parse(event.payload);
    const recipients = await this.transactions.run(async (tx) => {
      if (event.type === "report.case.message" && data.messageId) {
        const receipt = await tx.reportMessageReceipt.findUnique({
          where: { messageId: data.messageId },
        });
        if (
          !receipt ||
          receipt.caseId !== data.caseId ||
          receipt.partyId !== data.partyId ||
          receipt.senderId !== data.senderId
        )
          throw new Error("INVALID_CASE_MESSAGE_RECEIPT");
      } else if (event.type === "report.case.evidence" && data.evidenceId) {
        const evidence = await tx.reportEvidence.findUnique({
          where: { id: data.evidenceId },
        });
        if (
          !evidence ||
          evidence.caseId !== data.caseId ||
          evidence.partyId !== data.partyId ||
          data.senderId !== data.partyId
        )
          throw new Error("INVALID_CASE_EVIDENCE_EVENT");
      } else throw new Error("INVALID_CASE_SUPPORT_EVENT");
      const report = await tx.reportCase.findUniqueOrThrow({
        where: { id: data.caseId },
      });
      if (data.senderId !== data.partyId) return [data.partyId];
      if (!report.handlerId) return [];
      const handler = await this.users.byId(tx, report.handlerId);
      if (!handler || handler.accountStatus !== "ACTIVE") return [];
      const grants = await this.users.grants(tx, report.handlerId);
      if (
        !grants.roles.some((role) => role === "STAFF" || role === "ADMIN") ||
        !grants.permissions.includes("report:communicate") ||
        !grants.permissions.includes("report:moderate")
      )
        return [];
      return [report.handlerId];
    });
    await this.dispatcher.dispatch({
      eventId: event.eventId,
      type: event.type,
      userIds: recipients,
      title: "Tin nhắn hỗ trợ mới",
      body: "Có cập nhật trong trao đổi hỗ trợ của bạn.",
      payload: { caseId: data.caseId, partyId: data.partyId },
    });
  }
}
