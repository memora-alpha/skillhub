import { z } from "zod";
import { AppError } from "@/lib/http/errors";

const moderationEntry = z.object({
  action: z.enum(["HIDE", "REQUEST_EDIT"]),
  reason: z.string().trim().min(1).max(1000),
  at: z.iso.datetime({ offset: true }),
});
const moderationSchema = z.object({
  bio: moderationEntry.optional(),
  avatar: moderationEntry.optional(),
});
export type ProfileModeration = z.infer<typeof moderationSchema>;

export function parseProfileModeration(
  value: unknown,
): ProfileModeration | null {
  if (value === null || value === undefined) return null;
  const parsed = moderationSchema.safeParse(value);
  if (!parsed.success) throw new AppError("protocol");
  return parsed.data;
}
