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
  { enabled: false } | ({ enabled: true } & z.infer<typeof enabledSchema>);

/** Provider capability only: business limits/bucket policy still gate payment creation. */
export function paymentConfiguration(
  input: Record<string, unknown>,
): PaymentConfiguration {
  const flag = input.PAYMENTS_ENABLED ?? "false";
  if (flag !== "true" && flag !== "false")
    throw new Error("Invalid payment configuration: PAYMENTS_ENABLED");
  if (flag === "false") return { enabled: false };
  const result = enabledSchema.safeParse(input);
  if (!result.success) {
    const fields = [
      ...new Set(result.error.issues.map((issue) => issue.path.join("."))),
    ];
    throw new Error(`Invalid payment configuration: ${fields.join(", ")}`);
  }
  return { enabled: true, ...result.data };
}
