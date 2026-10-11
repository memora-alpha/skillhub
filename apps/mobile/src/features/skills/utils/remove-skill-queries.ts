import type {
  InfiniteData,
  QueryClient,
  QueryKey,
} from "@tanstack/react-query";
import type { Page } from "@/lib/http/response";
import type { PublicSkill } from "../types/skills";

// Apply only after the server confirms soft deletion. Keep other users and pages.
export function removeSkillQueries(
  client: QueryClient,
  scope: QueryKey,
  id: string,
) {
  for (const list of ["own", "public"]) {
    client.setQueriesData<InfiniteData<Page<PublicSkill>>>(
      { queryKey: [...scope, list] },
      (current) =>
        current && {
          ...current,
          pages: current.pages.map((page) => ({
            ...page,
            data: page.data.filter((skill) => skill.id !== id),
          })),
        },
    );
  }
  client.setQueryData([...scope, "detail", id], null);
  client.removeQueries({ queryKey: [...scope, "history", id] });
  client.removeQueries({ queryKey: [...scope, "verification", id] });
}
