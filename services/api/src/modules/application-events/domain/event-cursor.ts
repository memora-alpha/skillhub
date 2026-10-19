import { createHmac, timingSafeEqual } from "node:crypto";
import { BadRequestException, ConflictException } from "@nestjs/common";
export function encodeCursor(
  input: { userId: string; epoch: string; sequence: bigint },
  secret: string,
) {
  const body = Buffer.from(
    JSON.stringify([1, input.userId, input.epoch, input.sequence.toString()]),
  ).toString("base64url");
  return (
    body + "." + createHmac("sha256", secret).update(body).digest("base64url")
  );
}
export function decodeCursor(
  value: string,
  userId: string,
  epoch: string,
  secret: string,
): bigint {
  try {
    if (value.length > 1024) throw new Error("Invalid cursor length");
    const [body, signature, ...extra] = value.split(".");
    if (!body || !signature || extra.length)
      throw new Error("Missing cursor body or signature");
    const actual = Buffer.from(signature, "base64url"),
      expected = createHmac("sha256", secret).update(body).digest();
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
      throw new Error("Invalid cursor signature");
    const parsed: unknown = JSON.parse(
      Buffer.from(body, "base64url").toString(),
    );
    if (
      !Array.isArray(parsed) ||
      parsed.length !== 4 ||
      parsed[0] !== 1 ||
      parsed[1] !== userId ||
      typeof parsed[3] !== "string" ||
      !/^\d{1,19}$/.test(parsed[3])
    )
      throw new Error("Invalid cursor payload");
    if (parsed[2] !== epoch)
      throw new ConflictException("EVENT_CURSOR_EXPIRED");
    return BigInt(parsed[3]);
  } catch (error) {
    if (error instanceof ConflictException) throw error;
    throw new BadRequestException("INVALID_EVENT_CURSOR");
  }
}
