import { Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { createHmac } from "node:crypto";
import { z } from "zod";
import { IdentityConfig } from "../../../../configs/identity.config";
import { chatAttachmentOriginKey } from "../../../../infrastructure/storage/chat-attachment-policy";
import type { Principal } from "../../../auth/application/services/sessions.service";

const ticketSeconds = 60;
const uuid = z.string().uuid();
const claimsSchema = z.object({
  sub: uuid,
  sid: uuid,
  sv: z.number().int().nonnegative(),
  conversationId: uuid,
  messageId: uuid,
  attachmentId: uuid,
});
type Target = {
  conversationId: string;
  messageId: string;
  attachmentId: string;
};

@Injectable()
export class ChatDownloadTicketService {
  private readonly jwt = new JwtService();
  private readonly secret: Buffer;

  constructor(
    private readonly config: ConfigService,
    identity: IdentityConfig,
  ) {
    this.secret = createHmac("sha256", identity.jwtKey)
      .update("skillhub:chat-download:v1")
      .digest();
  }

  get enabled() {
    return !!this.config.get<string>(chatAttachmentOriginKey);
  }

  async issue(principal: Principal, target: Target) {
    const origin = this.config.getOrThrow<string>(chatAttachmentOriginKey);
    const ticket = await this.jwt.signAsync(
      { ...target, sid: principal.sessionId, sv: principal.securityVersion },
      {
        secret: this.secret,
        algorithm: "HS256",
        subject: principal.userId,
        expiresIn: ticketSeconds,
      },
    );
    const url = new URL("/api/v1/chat-attachment-content", origin);
    url.searchParams.set("ticket", ticket);
    return {
      url: url.toString(),
      expiresAt: new Date(Date.now() + ticketSeconds * 1000),
    };
  }

  async read(
    ticket: unknown,
  ): Promise<{ principal: Principal; target: Target }> {
    if (!this.enabled || typeof ticket !== "string" || ticket.length > 2048)
      throw new NotFoundException();
    const data: unknown = await this.jwt
      .verifyAsync(ticket, { secret: this.secret, algorithms: ["HS256"] })
      .catch(() => undefined);
    const parsed = claimsSchema.safeParse(data);
    if (!parsed.success) throw new NotFoundException();
    const { sub, sid, sv, ...target } = parsed.data;
    return {
      principal: {
        userId: sub,
        sessionId: sid,
        securityVersion: sv,
        roles: [],
        permissions: [],
      },
      target,
    };
  }
}
