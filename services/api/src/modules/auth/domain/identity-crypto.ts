import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from "node:crypto";
import * as argon2 from "argon2";

export class IdentityCrypto {
  constructor(
    private readonly keys: { otpKey: Buffer; encryptionKey: Buffer },
  ) {}
  secret(): string {
    return randomBytes(32).toString("base64url");
  }
  otp(): string {
    return randomInt(1000000).toString().padStart(6, "0");
  }
  secretDigest(secret: string): Uint8Array<ArrayBuffer> {
    return Uint8Array.from(createHash("sha256").update(secret).digest());
  }
  otpDigest(
    id: string,
    purpose: string,
    code: string,
  ): Uint8Array<ArrayBuffer> {
    return Uint8Array.from(
      createHmac("sha256", this.keys.otpKey)
        .update(JSON.stringify([id, purpose, code]))
        .digest(),
    );
  }
  matches(a: Uint8Array, b: Uint8Array): boolean {
    return a.length === b.length && timingSafeEqual(a, b);
  }
  encrypt(value: string, context: string): Uint8Array<ArrayBuffer> {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.keys.encryptionKey, iv);
    cipher.setAAD(Buffer.from(context));
    const data = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
    return Uint8Array.from(Buffer.concat([iv, cipher.getAuthTag(), data]));
  }
  decrypt(value: Uint8Array, context: string): string {
    const data = Buffer.from(value);
    const cipher = createDecipheriv(
      "aes-256-gcm",
      this.keys.encryptionKey,
      data.subarray(0, 12),
    );
    cipher.setAAD(Buffer.from(context));
    cipher.setAuthTag(data.subarray(12, 28));
    return Buffer.concat([
      cipher.update(data.subarray(28)),
      cipher.final(),
    ]).toString("utf8");
  }
  hashPassword(value: string): Promise<string> {
    return argon2.hash(value, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 1,
    });
  }
  async verifyPassword(hash: string, value: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, value);
    } catch {
      return false;
    }
  }
}
