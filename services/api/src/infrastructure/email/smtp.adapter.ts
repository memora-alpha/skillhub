import { IdentityMailer } from "../../modules/notifications/application/ports/identity-email-providers";
import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

@Injectable()
export class SmtpAdapter extends IdentityMailer implements OnModuleDestroy {
  private readonly transporter: Transporter;
  private readonly from: string;
  constructor(config: ConfigService) {
    super();
    this.from = config.getOrThrow<string>("SMTP_FROM");
    const host = config.getOrThrow<string>("SMTP_HOST");
    const port = Number(config.getOrThrow("SMTP_PORT"));
    if (
      !host ||
      !this.from ||
      !Number.isInteger(port) ||
      port < 1 ||
      port > 65535
    )
      throw new Error("Invalid SMTP configuration");
    const user = config.get<string>("SMTP_USER");
    const pass = config.get<string>("SMTP_PASSWORD");
    if (!!user !== !!pass)
      throw new Error("Invalid SMTP authentication configuration");
    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: config.get("SMTP_SECURE") === "true",
      requireTLS: config.get("NODE_ENV") === "production",
      auth: user && pass ? { user, pass } : undefined,
      connectionTimeout: 5000,
      greetingTimeout: 5000,
      socketTimeout: 10000,
    });
  }
  async send(
    id: string,
    recipient: string,
    kind: string,
    code: string | null,
  ): Promise<string> {
    const result = await this.transporter.sendMail({
      from: this.from,
      to: recipient,
      messageId: `<${id}@skillhub>`,
      subject:
        kind === "PASSWORD_CHANGED"
          ? "SkillHub: password changed"
          : "SkillHub: verification code",
      text:
        kind === "PASSWORD_CHANGED"
          ? "Your password was changed. Contact support if this was not you."
          : `Your SkillHub code is ${code}. Do not share it.`,
    });
    if (!result.accepted?.length) throw new Error("SMTP_REJECTED");
    return String(result.messageId);
  }
  onModuleDestroy() {
    this.transporter.close();
  }
}
