import { z } from "zod";
import type { HttpClient } from "@/lib/http/client";
import { AppError } from "@/lib/http/errors";
import type { PublicProfile } from "../types/profile";

const profileSchema = z.object({
  userId: z.uuid(),
  fullName: z.string(),
  headline: z.string(),
  bio: z.string(),
  avatarUrl: z.string().nullable(),
  reputationScore: z.number().finite().nullable(),
  verifiedSkillCount: z.number().int().nonnegative(),
  completedSessionCount: z.number().int().nonnegative(),
  selectedTitle: z.string().nullable().optional().default(null),
});

export function createPublicProfileApi(
  client: HttpClient,
  isCurrent = () => true,
) {
  return {
    async get(
      userId: string,
      signal?: AbortSignal,
    ): Promise<PublicProfile | null> {
      if (!z.uuid().safeParse(userId).success) throw new AppError("protocol");
      if (!isCurrent()) throw new AppError("session");
      try {
        const response = await client.request(
          `/profiles/${encodeURIComponent(userId)}`,
          { authenticated: true, signal },
        );
        if (!isCurrent()) throw new AppError("session");
        const parsed = profileSchema.safeParse(response);
        if (!parsed.success || parsed.data.userId !== userId)
          throw new AppError("protocol");
        // Public skills use their paginated endpoint, never raw nested metadata.
        return { ...parsed.data, sharingSkills: [] };
      } catch (error) {
        if (!isCurrent()) throw new AppError("session");
        if (
          error instanceof AppError &&
          (error.status === 403 || error.status === 404)
        )
          return null;
        throw error;
      }
    },
  };
}
