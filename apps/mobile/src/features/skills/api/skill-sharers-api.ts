import { z } from "zod";
import type { RequestOptions } from "@/lib/http/client";
import { AppError } from "@/lib/http/errors";
import { parsePage, pageQuery, resourcePath, uuid } from "@/lib/http/contracts";
import { publicSkillSchema } from "./skill-contracts";

const sharerSchema = publicSkillSchema.safeExtend({
  user: z.object({
    userId: uuid,
    fullName: z.string(),
    bio: z.string().nullable(),
    avatarUrl: z.url().nullable(),
    reputationScore: z.number().int().min(0).max(100),
  }),
});
export type SkillSharer = z.infer<typeof sharerSchema>;
export function createSkillSharersApi(
  call: (path: string, options?: RequestOptions) => Promise<unknown>,
) {
  return {
    async list(
      skillId: string,
      verifiedOnly: boolean,
      cursor?: string,
      signal?: AbortSignal,
    ) {
      const path = `${resourcePath("skills", skillId)}/sharers`;
      const query = pageQuery(cursor);
      query.set("verifiedOnly", String(verifiedOnly));
      const result = parsePage(
        sharerSchema,
        await call(`${path}?${query}`, { includeMeta: true, signal }),
      );
      if (
        result.items.some(
          (row) =>
            row.skill.id !== skillId ||
            row.skill.status !== "ACTIVE" ||
            (verifiedOnly && row.verificationStatus !== "VERIFIED"),
        ) ||
        new Set(result.items.map((row) => row.id)).size !==
          result.items.length ||
        (cursor !== undefined && result.nextCursor === cursor)
      )
        throw new AppError("protocol");
      return result;
    },
  };
}
