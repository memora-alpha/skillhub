import { BadRequestException } from "@nestjs/common";
import { createHmac, timingSafeEqual } from "node:crypto";

type Scope = { userId: string; type?: string; referenceType?: string };
const MAX_SEQUENCE = 9_223_372_036_854_775_807n;

export class LedgerCursor {
  constructor(private readonly secret: string) {
    if (!secret) throw new Error("Ledger cursor signing key is required");
  }

  private signature(body: string) {
    return createHmac("sha256", this.secret)
      .update(`credit-ledger:v1:${body}`)
      .digest("base64url");
  }

  encode(scope: Scope, watermark: bigint, before: bigint): string {
    const payload = {
      v: 1,
      userId: scope.userId,
      type: scope.type ?? null,
      referenceType: scope.referenceType ?? null,
      watermark: watermark.toString(),
      before: before.toString(),
    };
    const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
    return `${body}.${this.signature(body)}`;
  }

  decode(token: string, scope: Scope): { watermark: bigint; before: bigint } {
    try {
      if (
        token.length > 1024 ||
        !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/.test(token)
      )
        throw new Error("format");
      const [body, signature] = token.split(".") as [string, string];
      if (
        !timingSafeEqual(
          Buffer.from(signature),
          Buffer.from(this.signature(body)),
        )
      )
        throw new Error("signature");
      const value = JSON.parse(
        Buffer.from(body, "base64url").toString("utf8"),
      ) as Record<string, unknown>;
      if (
        value.v !== 1 ||
        value.userId !== scope.userId ||
        value.type !== (scope.type ?? null) ||
        value.referenceType !== (scope.referenceType ?? null) ||
        typeof value.watermark !== "string" ||
        typeof value.before !== "string" ||
        !/^[1-9]\d{0,18}$/.test(value.watermark) ||
        !/^[1-9]\d{0,18}$/.test(value.before)
      )
        throw new Error("scope");
      const watermark = BigInt(value.watermark),
        before = BigInt(value.before);
      if (before > watermark || watermark > MAX_SEQUENCE)
        throw new Error("range");
      return { watermark, before };
    } catch {
      throw new BadRequestException("INVALID_LEDGER_CURSOR");
    }
  }
}
