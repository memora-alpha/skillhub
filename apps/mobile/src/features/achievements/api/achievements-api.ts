import { z } from "zod";
import type { HttpClient } from "@/lib/http/client";
import { AppError } from "@/lib/http/errors";

const titleSchema = z.object({ selectedTitle: z.string().nullable() });
const achievementsSchema = titleSchema.extend({
  items: z.array(
    z.object({
      code: z.string().min(1),
      title: z.string().min(1),
      description: z.string(),
      unlockedAt: z.iso.datetime({ offset: true }),
    }),
  ),
});
export type Achievements = z.infer<typeof achievementsSchema>;

export function createAchievementsApi(
  client: HttpClient,
  isCurrent = () => true,
) {
  async function request(
    path: string,
    code?: string | null,
    signal?: AbortSignal,
  ) {
    if (!isCurrent()) throw new AppError("session");
    const result = await client.request(path, {
      authenticated: true,
      signal,
      ...(code !== undefined
        ? {
            method: "PATCH" as const,
            body: code === null ? {} : { code },
          }
        : {}),
    });
    if (!isCurrent()) throw new AppError("session");
    return result;
  }
  return {
    async mine(signal?: AbortSignal): Promise<Achievements> {
      const parsed = achievementsSchema.safeParse(
        await request("/me/achievements", undefined, signal),
      );
      if (!parsed.success) throw new AppError("protocol");
      return parsed.data;
    },
    async selectTitle(code: string | null) {
      const parsed = titleSchema.safeParse(
        await request("/me/achievements/selected-title", code),
      );
      if (!parsed.success) throw new AppError("protocol");
      return parsed.data;
    },
  };
}
