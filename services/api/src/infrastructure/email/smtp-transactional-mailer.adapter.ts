import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import type { TransactionalMailer } from "../../modules/notifications/application/ports/notification-channels";

/** Event emails over the same SMTP account as identity mail (SMTP_* settings). */
@Injectable()
export class SmtpTransactionalMailer
  implements TransactionalMailer, OnModuleDestroy
{
  private readonly transporter: Transporter;
  private readonly from: string | { name: string; address: string };

  constructor(config: ConfigService) {
    const port = Number(config.getOrThrow("SMTP_PORT"));
    const sender = config.getOrThrow<string>("SMTP_FROM");
    const user = config.get<string>("SMTP_USER");
    const pass = config.get<string>("SMTP_PASSWORD");
    this.from = sender.includes("@")
      ? sender
      : { name: sender, address: user ?? "" };
    const secure = config.get<string>("SMTP_SECURE")?.trim();
    this.transporter = nodemailer.createTransport({
      host: config.getOrThrow<string>("SMTP_HOST"),
      port,
      secure: secure ? secure === "true" : port === 465,
      requireTLS: config.get("NODE_ENV") === "production",
      auth: user && pass ? { user, pass } : undefined,
      connectionTimeout: 5000,
      socketTimeout: 10000,
    });
  }

  async send(input: {
    to: string;
    subject: string;
    text: string;
    messageId: string;
  }): Promise<void> {
    await this.transporter.sendMail({
      from: this.from,
      to: input.to,
      subject: input.subject,
      text: input.text,
      messageId: `<${input.messageId}>`,
    });
  }

  onModuleDestroy(): void {
    this.transporter.close();
  }
}
