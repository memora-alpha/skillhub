import { Inject, Injectable } from "@nestjs/common";
import { OutboxConsumer } from "../../../../infrastructure/events/outbox-consumer";
import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";
import {
  InAppNotificationPort,
  type NotificationChannelCode,
  type NotificationMessage,
  PushSender,
  TransactionalMailer,
} from "../ports/notification-channels";

export const ENABLED_NOTIFICATION_CHANNELS = Symbol(
  "ENABLED_NOTIFICATION_CHANNELS",
);

const channelCodes: ReadonlySet<string> = new Set<NotificationChannelCode>([
  "IN_APP",
  "EMAIL",
  "PUSH",
]);

/** Event → channel policy, filtered by the deployment's enabled channels. */
const eventChannels: Record<string, readonly NotificationChannelCode[]> = {
  "learning-path.locked": ["IN_APP", "EMAIL", "PUSH"],
  "learning-path.settled": ["IN_APP", "EMAIL", "PUSH"],
  "report.session.opened": ["IN_APP", "EMAIL", "PUSH"],
  "report.case.updated": ["IN_APP", "EMAIL", "PUSH"],
  "skill.verification.decided": ["IN_APP", "EMAIL", "PUSH"],
  "skill.evidence.revoked": ["IN_APP", "EMAIL", "PUSH"],
  "material.moderated": ["IN_APP", "EMAIL", "PUSH"],
  "material.purchased": ["IN_APP", "EMAIL", "PUSH"],
};

/** NOTIFICATION_CHANNELS is a comma list of channel codes; in-app only by default. */
export function enabledChannels(
  value: string | undefined,
  push: Pick<PushSender, "configured">,
): ReadonlySet<NotificationChannelCode> {
  const codes = (value?.trim() || "IN_APP")
    .split(",")
    .map((code) => code.trim());
  if (codes.some((code) => !channelCodes.has(code))) {
    throw new Error("Invalid NOTIFICATION_CHANNELS configuration");
  }
  if (codes.includes("PUSH") && !push.configured) {
    throw new Error(
      "NOTIFICATION_CHANNELS includes PUSH but FCM_PROJECT_ID, FCM_CLIENT_EMAIL and FCM_PRIVATE_KEY are not set",
    );
  }
  return new Set(codes as NotificationChannelCode[]);
}

const consumers: Record<NotificationChannelCode, string> = {
  IN_APP: "notification.in-app",
  EMAIL: "notification.email",
  PUSH: "notification.push",
};

@Injectable()
export class NotificationDispatcher {
  constructor(
    private readonly consumer: OutboxConsumer,
    private readonly inApp: InAppNotificationPort,
    private readonly mailer: TransactionalMailer,
    private readonly push: PushSender,
    @Inject(ENABLED_NOTIFICATION_CHANNELS)
    private readonly enabled: ReadonlySet<NotificationChannelCode>,
  ) {}

  /**
   * Each channel is its own outbox consumer: a repeated event is delivered at
   * most once per channel, and a failed channel is retried without resending
   * the others.
   */
  async dispatch(message: NotificationMessage): Promise<void> {
    if (message.userIds.length === 0) return;
    const channels = (eventChannels[message.type] ?? ["IN_APP"]).filter(
      (channel) => this.enabled.has(channel),
    );
    await Promise.all(
      channels.map((channel) =>
        this.consumer.processOnce(consumers[channel], message.eventId, (tx) =>
          this.deliver(channel, tx, message),
        ),
      ),
    );
  }

  private deliver(
    channel: NotificationChannelCode,
    tx: TransactionContext,
    message: NotificationMessage,
  ): Promise<void> {
    if (channel === "IN_APP") return this.inApp.notify(tx, message);
    if (channel === "EMAIL") return this.email(tx, message);
    return this.pushToDevices(tx, message);
  }

  /** Verified, active accounts only; the template repeats the generic title and body. */
  private async email(tx: TransactionContext, message: NotificationMessage) {
    const recipients = await tx.user.findMany({
      where: {
        id: { in: message.userIds },
        emailVerified: true,
        accountStatus: "ACTIVE",
      },
      select: { id: true, normalizedEmail: true },
    });
    await Promise.all(
      recipients.map((recipient) =>
        this.mailer.send({
          to: recipient.normalizedEmail,
          subject: `SkillHub: ${message.title}`,
          text: `${message.body}\n\nOpen SkillHub to see the details.`,
          messageId: `${message.eventId}.${recipient.id}@skillhub`,
        }),
      ),
    );
  }

  private async pushToDevices(
    tx: TransactionContext,
    message: NotificationMessage,
  ) {
    const devices = await tx.pushDeviceToken.findMany({
      where: { userId: { in: message.userIds }, revokedAt: null },
      select: { token: true },
    });
    if (devices.length === 0) return;
    const { invalidTokens } = await this.push.send({
      tokens: devices.map(({ token }) => token),
      title: message.title,
      body: message.body,
      data: { type: message.type, ...message.payload },
    });
    if (invalidTokens.length > 0) {
      await tx.pushDeviceToken.updateMany({
        where: { token: { in: invalidTokens } },
        data: { revokedAt: new Date() },
      });
    }
  }
}
