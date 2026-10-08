export interface OtpRecord {
  id: string;
  userId: string;
  securityVersion: number;
  keyId: string;
  digest: string;
  expiresAt: number;
  failedAttempts: number;
  registration?: string;
}

export abstract class OtpStore {
  abstract issue(
    email: string,
    purpose: string,
    record: OtpRecord,
    expectedId?: string,
  ): Promise<boolean>;
  abstract read(email: string, purpose: string): Promise<OtpRecord | null>;
  abstract claim(
    email: string,
    purpose: string,
    id: string,
    digest: string,
    lease: string,
  ): Promise<boolean>;
  abstract finish(
    email: string,
    purpose: string,
    id: string,
    lease: string,
    consumed: boolean,
  ): Promise<void>;
}

export interface RegistrationDraft {
  fullName: string;
  passwordHash: string;
  timezone: string;
  locale?: "vi" | "en";
  termsVersion: string;
  termsAcceptedAt: string;
}
