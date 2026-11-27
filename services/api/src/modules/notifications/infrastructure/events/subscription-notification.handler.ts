import { Injectable, OnModuleInit } from "@nestjs/common";
import { z } from "zod";
import {
  OutboxPublisherRegistry,
  type OutboxMessage,
  type OutboxPublisher,
} from "../../../../infrastructure/events/outbox.types";
import { formatCredit } from "../../../credit/domain/money";
import { NotificationDispatcher } from "../../application/services/notification-dispatcher";

const planCode = z.enum(["CREATOR", "PRO"]);
const credit = z.string().regex(/^[1-9]\d*$/);
const instant = z.iso.datetime({ precision: 3 });
const base = { subscriptionId: z.uuid(), userId: z.uuid(), planCode };

/** Spec 021 contracts "Events": one schema per event the renewal job writes. */
const schemas = {
  "subscription.renewed": z.strictObject({
    ...base,
    interval: z.enum(["MONTH", "YEAR"]),
    amount: credit,
    termEnd: instant,
  }),
  "subscription.grace-started": z.strictObject({
    ...base,
    amountDue: credit,
    graceUntil: instant,
  }),
  "subscription.expired": z.strictObject({
    ...base,
    reason: z.enum(["AUTO_RENEW_OFF", "GRACE_ELAPSED", "PLAN_UNAVAILABLE"]),
    endedAt: instant,
  }),
} as const;

type EventType = keyof typeof schemas;

const planName = (code: z.infer<typeof planCode>) =>
  code === "PRO" ? "Creator Pro" : "Creator";

function message(type: EventType, data: Record<string, string>) {
  const plan = planName(data.planCode as z.infer<typeof planCode>);
  if (type === "subscription.renewed")
    return {
      title: `Đã gia hạn gói ${plan}`,
      body: `Gói ${plan} đã được gia hạn, trừ ${formatCredit(BigInt(data.amount!))} Credit. Kỳ mới kết thúc lúc ${data.termEnd}.`,
    };
  if (type === "subscription.grace-started")
    return {
      title: `Chưa gia hạn được gói ${plan}`,
      body: `Ví chưa đủ ${formatCredit(BigInt(data.amountDue!))} Credit để gia hạn. Quyền lợi của gói được giữ đến ${data.graceUntil}; hãy nạp Credit trước thời điểm này.`,
    };
  const reasons: Record<string, string> = {
    AUTO_RENEW_OFF: "Tự động gia hạn đã tắt.",
    GRACE_ELAPSED: "Hết thời gian chờ mà ví vẫn chưa đủ Credit.",
    PLAN_UNAVAILABLE: "Gói không còn được bán.",
  };
  return {
    title: `Gói ${plan} đã kết thúc`,
    body: `${reasons[data.reason!]} Dữ liệu đã lưu vẫn được giữ theo thời hạn lúc tạo.`,
  };
}

@Injectable()
export class SubscriptionNotificationHandler
  implements OnModuleInit, OutboxPublisher
{
  constructor(
    private readonly registry: OutboxPublisherRegistry,
    private readonly dispatcher: NotificationDispatcher,
  ) {}

  onModuleInit(): void {
    for (const type of Object.keys(schemas)) this.registry.register(type, this);
  }

  async publish(event: OutboxMessage): Promise<void> {
    const schema = schemas[event.type as EventType];
    const parsed = schema?.safeParse(event.payload);
    if (!schema || event.version < 1 || !parsed?.success)
      throw new Error("INVALID_SUBSCRIPTION_EVENT");
    const data = parsed.data as Record<string, string>;
    const text = message(event.type as EventType, data);
    await this.dispatcher.dispatch({
      eventId: event.eventId,
      type: event.type,
      userIds: [data.userId!],
      title: text.title,
      body: text.body,
      payload: {
        subscriptionId: data.subscriptionId!,
        planCode: data.planCode!,
      },
    });
  }
}
