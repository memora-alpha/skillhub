import { AppError } from "@/lib/http/errors";
import type { Page } from "@/lib/http/response";
import type { PublicSkill } from "../types/skills";

export async function findPublicSkill(
  id: string,
  readPage: (
    cursor?: string,
    signal?: AbortSignal,
  ) => Promise<Page<PublicSkill>>,
  signal?: AbortSignal,
): Promise<PublicSkill | null> {
  let cursor: string | undefined;
  const seen = new Set<string>();
  do {
    if (signal?.aborted) throw new AppError("session");
    const page = await readPage(cursor, signal);
    const skill = page.data.find((item) => item.id === id);
    if (skill) return skill;
    if (!page.pagination.hasMore) return null;
    cursor = page.pagination.nextCursor ?? undefined;
    if (!cursor || seen.has(cursor)) throw new AppError("protocol");
    seen.add(cursor);
  } while (cursor);
  return null;
}
