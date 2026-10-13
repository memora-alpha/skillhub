import type {
  InfiniteData,
  QueryClient,
  QueryKey,
} from "@tanstack/react-query";
import type { Page } from "@/lib/http/response";
import { publicSkillSchema } from "../api/skill-contracts";
import type { OwnSkill, PublicSkill } from "../types/skills";
import { matchesSkillFilter, type SkillFilter } from "./skill-filter";

// Use the confirmed server DTO before refetching. Preserve the server's cursors
// and never construct a public record from owner data unless already public.
export function recordSkillQueries(
  client: QueryClient,
  scope: QueryKey,
  response: OwnSkill,
) {
  const lists = client.getQueriesData<InfiniteData<Page<OwnSkill>>>({
    queryKey: [...scope, "own"],
  });
  const cached = client.getQueryData<OwnSkill | null>([
    ...scope,
    "detail",
    response.id,
  ]);
  const skill = [
    ...(cached ? [cached] : []),
    ...lists.flatMap(
      ([, data]) => data?.pages.flatMap((page) => page.data) ?? [],
    ),
  ]
    .filter((item) => item.id === response.id)
    .reduce(
      (current, item) => (item.version > current.version ? item : current),
      response,
    );
  client.setQueryData([...scope, "detail", skill.id], skill);
  if (!skill.isVisible || skill.archivedAt || skill.skill.status !== "ACTIVE")
    client.setQueriesData(
      {
        queryKey: [...scope, "public-detail"],
        predicate: (query) => query.queryKey.at(-1) === skill.id,
      },
      null,
    );
  for (const [key, data] of lists) {
    if (!data) continue;
    const include =
      !skill.archivedAt && matchesSkillFilter(skill, key.at(-1) as SkillFilter);
    const found = data.pages.some((page) =>
      page.data.some((item) => item.id === skill.id),
    );
    client.setQueryData(key, {
      ...data,
      pages: data.pages.map((page, index) => ({
        ...page,
        data: [
          ...(include && !found && index === 0 ? [skill] : []),
          ...page.data.flatMap((item) => {
            if (item.id !== skill.id) return [item];
            return include ? [skill] : [];
          }),
        ],
      })),
    });
  }
  client.setQueriesData<InfiniteData<Page<PublicSkill>>>(
    { queryKey: [...scope, "public"] },
    (data) =>
      data && {
        ...data,
        pages: data.pages.map((page) => ({
          ...page,
          data: page.data.flatMap((item) => {
            if (item.id !== skill.id) return [item];
            if (
              !skill.isVisible ||
              skill.archivedAt ||
              skill.skill.status !== "ACTIVE"
            )
              return [];
            return [publicSkillSchema.parse(skill)];
          }),
        })),
      },
  );
}
