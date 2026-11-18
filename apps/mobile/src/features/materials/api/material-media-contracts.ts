import { z } from "zod";
import { timestamp } from "@/lib/http/contracts";

export const materialImageUrl = z.url().refine((value) => {
  const url = new URL(value);
  return (
    ["https:", "http:"].includes(url.protocol) && !url.username && !url.password
  );
});
const count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const materialRatingSummary = z
  .object({
    average: z
      .string()
      .regex(/^[1-5]\.\d{2}$/)
      .nullable(),
    total: count,
    stars: z.object({ 1: count, 2: count, 3: count, 4: count, 5: count }),
  })
  .superRefine((value, ctx) => {
    const counts = Object.values(value.stars);
    const sum = counts.reduce((total, number) => total + number, 0);
    const weighted = counts.reduce(
      (total, number, i) => total + number * (i + 1),
      0,
    );
    if (
      sum !== value.total ||
      value.average !== (sum ? (weighted / sum).toFixed(2) : null)
    )
      ctx.addIssue({
        code: "custom",
        message: "Invalid material rating summary",
      });
  });
export const materialThumbnail = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("GENERATED"),
    smallUrl: materialImageUrl,
    largeUrl: materialImageUrl,
    expiresAt: timestamp,
  }),
  z.object({
    kind: z.literal("PLACEHOLDER"),
    format: z.enum(["PDF", "DOCX", "XLSX", "PPTX", "FILE"]),
  }),
]);
