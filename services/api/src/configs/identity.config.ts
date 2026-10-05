import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { IdentityCrypto } from "../modules/auth/domain/identity-crypto";
import { validTimezone } from "../modules/users/domain/profile-policy";

@Injectable()
export class IdentityConfig {
  private readonly previousKeys = new Map<string, IdentityCrypto>();
  readonly crypto: IdentityCrypto;
  readonly accessSeconds: number;
  readonly refreshSeconds: number;
  readonly rememberSeconds: number;
  readonly resetSeconds: number;
  readonly reauthSeconds: number;
  readonly jwtKey: string;
  readonly issuer: string;
  readonly audience: string;
  readonly keyId: string;
  readonly termsVersion: string;
  readonly timezone: string;
  readonly initialReputation: number | null;
  readonly throttleWindowMs: number;
  readonly emailLimit: number;
  readonly ipLimit: number;
  readonly deviceLimit: number;
  readonly requestLimit: number;
  readonly deliveryAttempts: number;
  readonly deliveryRetentionSeconds: number;
  readonly notificationSeconds: number;
  readonly avatarRetentionSeconds: number;
  constructor(readonly env: ConfigService) {
    const required = (name: string): string => {
      const value = env.get<string>(name);
      if (!value?.trim())
        throw new Error(`Missing identity configuration: ${name}`);
      return value;
    };
    const seconds = (name: string): number => {
      const value = Number(required(name));
      if (!Number.isSafeInteger(value) || value < 1)
        throw new Error(`Invalid identity configuration: ${name}`);
      return value;
    };
    const key = (name: string): Buffer => {
      const value = required(name);
      const decoded = Buffer.from(value, "base64");
      if (decoded.length !== 32 || decoded.toString("base64") !== value)
        throw new Error(`Invalid identity configuration: ${name}`);
      return decoded;
    };
    this.jwtKey = required("IDENTITY_JWT_KEY");
    if (Buffer.byteLength(this.jwtKey) < 32)
      throw new Error("IDENTITY_JWT_KEY must contain at least 32 bytes");
    const otpKey = key("IDENTITY_OTP_KEY");
    const encryptionKey = key("IDENTITY_ENCRYPTION_KEY");
    if (
      otpKey.equals(encryptionKey) ||
      otpKey.equals(Buffer.from(this.jwtKey)) ||
      encryptionKey.equals(Buffer.from(this.jwtKey))
    )
      throw new Error("Identity keys must be distinct");
    this.crypto = new IdentityCrypto({ otpKey, encryptionKey });
    this.keyId = required("IDENTITY_KEY_ID");
    this.loadPreviousKeys(env.get<string>("IDENTITY_PREVIOUS_KEYS"));
    this.issuer = required("IDENTITY_JWT_ISSUER");
    this.audience = required("IDENTITY_JWT_AUDIENCE");
    this.accessSeconds = seconds("IDENTITY_ACCESS_SECONDS");
    this.refreshSeconds = seconds("IDENTITY_REFRESH_SECONDS");
    this.rememberSeconds = seconds("IDENTITY_REMEMBER_SECONDS");
    this.resetSeconds = seconds("IDENTITY_RESET_SECONDS");
    this.reauthSeconds = seconds("IDENTITY_REAUTH_SECONDS");
    this.throttleWindowMs = seconds("IDENTITY_THROTTLE_WINDOW_SECONDS") * 1000;
    this.emailLimit = seconds("IDENTITY_EMAIL_RATE_LIMIT");
    this.ipLimit = seconds("IDENTITY_IP_RATE_LIMIT");
    this.deviceLimit = seconds("IDENTITY_DEVICE_RATE_LIMIT");
    this.requestLimit = seconds("IDENTITY_REQUEST_RATE_LIMIT");
    this.deliveryAttempts = seconds("IDENTITY_DELIVERY_ATTEMPTS");
    this.deliveryRetentionSeconds = seconds(
      "IDENTITY_DELIVERY_RETENTION_SECONDS",
    );
    this.notificationSeconds = seconds("IDENTITY_NOTIFICATION_SECONDS");
    this.avatarRetentionSeconds = seconds("IDENTITY_AVATAR_RETENTION_SECONDS");
    if (this.rememberSeconds < this.refreshSeconds)
      throw new Error(
        "Remember lifetime must not be shorter than normal refresh lifetime",
      );
    this.termsVersion = required("IDENTITY_TERMS_VERSION");
    this.timezone = required("IDENTITY_DEFAULT_TIMEZONE");
    if (!validTimezone(this.timezone))
      throw new Error("Invalid IDENTITY_DEFAULT_TIMEZONE");
    const reputation = env.get<string>("IDENTITY_INITIAL_REPUTATION");
    this.initialReputation = reputation ? Number(reputation) : null;
    if (
      (this.initialReputation !== null &&
        (!Number.isSafeInteger(this.initialReputation) ||
          this.initialReputation < 0 ||
          this.initialReputation > 100)) ||
      (env.get("NODE_ENV") === "production" && this.initialReputation === null)
    )
      throw new Error("Approved IDENTITY_INITIAL_REPUTATION required");
  }
  cryptoFor(id: string): IdentityCrypto | undefined {
    return id === this.keyId ? this.crypto : this.previousKeys.get(id);
  }
  private loadPreviousKeys(previous: string | undefined): void {
    if (!previous) return;
    try {
      const entries: Record<string, { otpKey: string; encryptionKey: string }> =
        JSON.parse(previous);
      if (!entries || typeof entries !== "object" || Array.isArray(entries))
        throw new Error("Previous keys must be an object");
      for (const [id, keys] of Object.entries(entries)) {
        this.previousKeys.set(id, this.previousCrypto(id, keys));
      }
    } catch {
      throw new Error("Invalid IDENTITY_PREVIOUS_KEYS");
    }
  }
  private previousCrypto(
    id: string,
    keys: { otpKey: string; encryptionKey: string },
  ): IdentityCrypto {
    const otpKey = Buffer.from(keys.otpKey, "base64");
    const encryptionKey = Buffer.from(keys.encryptionKey, "base64");
    if (
      id === this.keyId ||
      !id ||
      otpKey.length !== 32 ||
      encryptionKey.length !== 32 ||
      otpKey.equals(encryptionKey) ||
      otpKey.toString("base64") !== keys.otpKey ||
      encryptionKey.toString("base64") !== keys.encryptionKey
    )
      throw new Error("Invalid previous identity key");
    return new IdentityCrypto({ otpKey, encryptionKey });
  }
}
