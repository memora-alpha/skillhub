import { createHash } from "node:crypto";
import { Injectable, OnModuleInit } from "@nestjs/common";
import { PrismaService } from "../../../../infrastructure/database/prisma.service";
import {
  OutboxPublisherRegistry,
  type OutboxMessage,
  type OutboxPublisher,
} from "../../../../infrastructure/events/outbox.types";
import { NotificationDispatcher } from "../../application/services/notification-dispatcher";

const eventTypes = [
  "admin.fee-policy.approved",
  "credit.fee-policy.effective",
] as const;
const policyCodes = ["ONE_WAY", "TWO_WAY", "MATERIAL_PAID"] as const;
const batchSize = 500;

type FeePolicyPayload = {
  policyId: string;
  policyCode: (typeof policyCodes)[number];
  versionNo: number;
  feeBps: number;
  previousFeeBps?: number;
  effectiveAt: string;
  approvedByUserId?: string;
};

function validBps(value: unknown): value is number {
  return (
    Number.isInteger(value) &&
    (value as number) >= 0 &&
    (value as number) < 10_000
  );
}

function payload(event: OutboxMessage): FeePolicyPayload {
  const value = event.payload;
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("INVALID_FEE_POLICY_EVENT");
  const data = value as Record<string, unknown>;
  const effectiveAt =
    typeof data.effectiveAt === "string" ? new Date(data.effectiveAt) : null;
  if (
    event.version < 1 ||
    !eventTypes.includes(event.type as (typeof eventTypes)[number]) ||
    typeof data.policyId !== "string" ||
    !policyCodes.includes(data.policyCode as (typeof policyCodes)[number]) ||
    !Number.isInteger(data.versionNo) ||
    data.versionNo !== event.version ||
    !validBps(data.feeBps) ||
    (data.previousFeeBps !== undefined && !validBps(data.previousFeeBps)) ||
    !effectiveAt ||
    !Number.isFinite(+effectiveAt) ||
    (event.type === "admin.fee-policy.approved" &&
      typeof data.approvedByUserId !== "string")
  )
    throw new Error("INVALID_FEE_POLICY_EVENT");
  return data as FeePolicyPayload;
}

function rate(bps: number): string {
  const whole = Math.floor(bps / 100);
  const decimal = String(bps % 100)
    .padStart(2, "0")
    .replace(/0+$/u, "");
  return decimal ? `${whole},${decimal}%` : `${whole}%`;
}

function policyLabel(code: FeePolicyPayload["policyCode"]): string {
  if (code === "ONE_WAY") return "học một chiều";
  if (code === "TWO_WAY") return "trao đổi hai chiều";
  return "tài liệu trả phí";
}

function deterministicEventId(eventId: string, batch: number): string {
  const hex = createHash("sha256")
    .update(`fee-policy-notification:${eventId}:${batch}`)
    .digest("hex");
  const variant = ((Number.parseInt(hex[16]!, 16) & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-8${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

@Injectable()
export class FeePolicyNotificationHandler
  implements OnModuleInit, OutboxPublisher
{
  constructor(
    private readonly registry: OutboxPublisherRegistry,
    private readonly dispatcher: NotificationDispatcher,
    private readonly db: PrismaService,
  ) {}

  onModuleInit(): void {
    for (const type of eventTypes) this.registry.register(type, this);
  }

  async publish(event: OutboxMessage): Promise<void> {
    const data = payload(event);
    const changed =
      data.previousFeeBps === undefined
        ? `được đặt ở mức ${rate(data.feeBps)}`
        : `thay đổi từ ${rate(data.previousFeeBps)} thành ${rate(data.feeBps)}`;
    const effectiveAt = new Date(data.effectiveAt).toISOString();
    const commonPayload = {
      feePolicyId: data.policyId,
      policyCode: data.policyCode,
      versionNo: String(data.versionNo),
      feeBps: String(data.feeBps),
      effectiveAt,
    };
    if (event.type === "admin.fee-policy.approved") {
      await this.dispatcher.dispatch({
        eventId: event.eventId,
        type: event.type,
        userIds: [data.approvedByUserId!],
        title: "Đã duyệt chính sách phí",
        body: `Phí ${policyLabel(data.policyCode)} ${changed}, hiệu lực từ ${effectiveAt}.`,
        payload: commonPayload,
      });
      return;
    }

    const suffix =
      data.policyCode === "MATERIAL_PAID"
        ? "Chỉ áp dụng cho giao dịch mua mới từ thời điểm này."
        : "Chỉ áp dụng cho thỏa thuận được khóa sau thời điểm này.";
    let cursor: string | undefined;
    let batch = 0;
    let hasMore = true;
    while (hasMore) {
      const users = await this.db.user.findMany({
        where: {
          accountStatus: "ACTIVE",
          ...(cursor ? { id: { gt: cursor } } : {}),
        },
        orderBy: { id: "asc" },
        take: batchSize,
        select: { id: true },
      });
      if (!users.length) break;
      await this.dispatcher.dispatch({
        eventId: deterministicEventId(event.eventId, batch),
        type: event.type,
        userIds: users.map((user) => user.id),
        title: "Chính sách phí SkillHub đã thay đổi",
        body: `Phí ${policyLabel(data.policyCode)} ${changed}, hiệu lực từ ${effectiveAt}. ${suffix}`,
        payload: commonPayload,
      });
      cursor = users.at(-1)!.id;
      batch += 1;
      hasMore = users.length === batchSize;
    }
  }
}
