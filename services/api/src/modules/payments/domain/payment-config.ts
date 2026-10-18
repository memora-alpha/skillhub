import { z } from "zod";

const httpsUrl = z.url().refine((value) => {
  if (!URL.canParse(value)) return false;
  const url = new URL(value);
  return (
    url.protocol === "https:" && !url.username && !url.password && !url.hash
  );
});
const enabledSchema = z.object({
  PAYOS_CLIENT_ID: z.string().min(1).max(100),
  PAYOS_API_KEY: z.string().min(1),
  PAYOS_CHECKSUM_KEY: z.string().min(1),
  PAYOS_RETURN_URL: httpsUrl,
  PAYOS_CANCEL_URL: httpsUrl,
});

export type PaymentConfiguration =
  | { enabled: false; creationPaused: boolean }
  | ({ enabled: true; creationPaused: boolean } & z.infer<
      typeof enabledSchema
    >);

/** Provider capability only: business limits/bucket policy still gate payment creation. */
export function paymentConfiguration(
  input: Record<string, unknown>,
): PaymentConfiguration {
  const flag = input.PAYMENTS_ENABLED ?? "false";
  const pause = input.PAYMENT_CREATION_PAUSED ?? "false";
  if (pause !== "true" && pause !== "false")
    throw new Error("Invalid payment configuration: PAYMENT_CREATION_PAUSED");
  const creationPaused = pause === "true";
  if (flag !== "true" && flag !== "false")
    throw new Error("Invalid payment configuration: PAYMENTS_ENABLED");
  if (flag === "false") return { enabled: false, creationPaused };
  const result = enabledSchema.safeParse(input);
  if (!result.success) {
    const fields = [
      ...new Set(result.error.issues.map((issue) => issue.path.join("."))),
    ];
    throw new Error(`Invalid payment configuration: ${fields.join(", ")}`);
  }
  return { enabled: true, creationPaused, ...result.data };
}
