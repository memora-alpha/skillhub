import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export type VoucherSecret = {
  code: string | null;
  pin: string | null;
  link: string | null;
};
export type SealedSecret = {
  ciphertext: Uint8Array<ArrayBuffer>;
  iv: Uint8Array<ArrayBuffer>;
  tag: Uint8Array<ArrayBuffer>;
  keyVersion: number;
};

/** AES-256-GCM; the redemption ID is bound as additional authenticated data. */
@Injectable()
export class VoucherSecretCipher {
  constructor(private readonly config: ConfigService) {}

  private key(): { key: Buffer; version: number } {
    const encoded = this.config.get<string>("VOUCHER_SECRET_KEY");
    const key = encoded ? Buffer.from(encoded, "base64") : undefined;
    if (key?.length !== 32)
      throw new Error("VOUCHER_SECRET_KEY must be 32 base64-encoded bytes");
    return {
      key,
      version: Number(this.config.get("VOUCHER_SECRET_KEY_VERSION") ?? 1),
    };
  }

  seal(redemptionId: string, secret: VoucherSecret): SealedSecret {
    const { key, version } = this.key();
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    cipher.setAAD(Buffer.from(redemptionId));
    const ciphertext = Buffer.concat([
      cipher.update(JSON.stringify(secret), "utf8"),
      cipher.final(),
    ]);
    return {
      ciphertext: new Uint8Array(ciphertext),
      iv: new Uint8Array(iv),
      tag: new Uint8Array(cipher.getAuthTag()),
      keyVersion: version,
    };
  }

  open(
    redemptionId: string,
    sealed: { ciphertext: Uint8Array; iv: Uint8Array; tag: Uint8Array },
  ): VoucherSecret {
    const { key } = this.key();
    const decipher = createDecipheriv("aes-256-gcm", key, sealed.iv);
    decipher.setAAD(Buffer.from(redemptionId));
    decipher.setAuthTag(Buffer.from(sealed.tag));
    const plain = Buffer.concat([
      decipher.update(sealed.ciphertext),
      decipher.final(),
    ]);
    return JSON.parse(plain.toString("utf8")) as VoucherSecret;
  }
}
