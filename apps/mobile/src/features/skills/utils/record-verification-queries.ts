import type { InfiniteData, QueryClient } from "@tanstack/react-query";
import type { Page } from "@/lib/http/response";
import type { OwnSkill, Verification } from "../types/skills";
import { matchesSkillFilter, type SkillFilter } from "./skill-filter";
import { withSubmittedVerification } from "./verification-state";

export function recordVerificationQueries(
  client: QueryClient,
  scope: readonly unknown[],
  response: Verification,
  submitted: Map<string, Verification>,
) {
  const history = client.getQueryData<InfiniteData<Page<Verification>>>([
    ...scope,
    "history",
    response.sharingSkillId,
  ]);
  const detail = client.getQueryData<Verification>([
    ...scope,
    "verification",
    response.sharingSkillId,
    response.id,
  ]);
  const batch = [
    ...(history?.pages.flatMap((page) => page.data) ?? []),
    ...(detail ? [detail] : []),
  ]
    .filter((item) => item.id === response.id)
    .reduce(
      (current, item) => (item.version > current.version ? item : current),
      response,
    );
  if (batch.status === "PENDING") submitted.set(batch.sharingSkillId, batch);
  else submitted.delete(batch.sharingSkillId);
  client.setQueryData<OwnSkill | null>(
    [...scope, "detail", batch.sharingSkillId],
    (skill) => (skill ? withSubmittedVerification(skill, submitted) : skill),
  );
  const lists = client.getQueriesData<InfiniteData<Page<OwnSkill>>>({
    queryKey: [...scope, "own"],
  });
  const known =
    client.getQueryData<OwnSkill | null>([
      ...scope,
      "detail",
      batch.sharingSkillId,
    ]) ??
    lists
      .flatMap(([, data]) => data?.pages.flatMap((page) => page.data) ?? [])
      .find((skill) => skill.id === batch.sharingSkillId);
  for (const [key, data] of lists) {
    if (!data) continue;
    const filter = key.at(-1) as SkillFilter;
    const updated = known ? withSubmittedVerification(known, submitted) : null;
    const insert =
      updated &&
      !updated.archivedAt &&
      matchesSkillFilter(updated, filter) &&
      !data.pages.some((page) =>
        page.data.some((skill) => skill.id === batch.sharingSkillId),
      );
    client.setQueryData(key, {
      ...data,
      pages: data.pages.map((page, index) => ({
        ...page,
        data: [...(insert && index === 0 ? [updated] : []), ...page.data]
          .map((skill) =>
            skill.id === batch.sharingSkillId
              ? withSubmittedVerification(skill, submitted)
              : skill,
          )
          .filter((skill) => matchesSkillFilter(skill, filter)),
      })),
    });
  }
  client.setQueryData<InfiniteData<Page<Verification>>>(
    [...scope, "history", batch.sharingSkillId],
    (data) =>
      !data
        ? data
        : {
            ...data,
            pages: data.pages.map((page, index) => ({
              ...page,
              data: [
                ...(index === 0 ? [batch] : []),
                ...page.data.filter((item) => item.id !== batch.id),
              ],
            })),
          },
  );
  client.setQueryData(
    [...scope, "verification", batch.sharingSkillId, batch.id],
    batch,
  );
}
