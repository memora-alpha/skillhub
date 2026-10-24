import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import type { Page } from "@/lib/http/response";
import type { OwnSkill } from "../types/skills";
import { useSkills } from "../context/SkillsProvider";
import { z } from "zod";
import {
  filteredSkillPage,
  skillListPlaceholder,
  type SkillFilter,
} from "../utils/skill-filter";
import { withSubmittedVerification } from "../utils/verification-state";
import { useSkillReadFocus } from "./use-skill-read-focus";
import { useCallback, useEffect } from "react";
import { usePrivateSkillQuery } from "./use-private-skill-query";

export function validId(value?: string | string[]) {
  return typeof value === "string" && z.uuid().safeParse(value).success
    ? value
    : null;
}
export function useOwnSkills(
  filter: SkillFilter = "ALL",
  options: { preview?: boolean; enabled?: boolean } = {},
) {
  const client = useQueryClient();
  const {
    api,
    scope,
    assertCurrent,
    deletedSkillIds,
    submittedVerifications,
    observeCreatedSkills,
    privateReads,
  } = useSkills();
  const key = [...scope, "own", false, filter];
  const signature = JSON.stringify(key);
  const enabled = options.enabled ?? true;
  const query = useInfiniteQuery<
    Page<OwnSkill>,
    Error,
    InfiniteData<Page<OwnSkill>, string | undefined>,
    readonly unknown[],
    string | undefined
  >({
    queryKey: key,
    enabled,
    staleTime: options.preview ? 30_000 : 0,
    placeholderData: (previous) =>
      skillListPlaceholder(
        client.getQueryData<InfiniteData<Page<OwnSkill>, string | undefined>>([
          ...scope,
          "own",
          false,
          "ALL",
        ]) ?? previous,
        filter,
        deletedSkillIds,
        submittedVerifications,
      ),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) =>
      privateReads.read(key, async () => {
        return filteredSkillPage(
          async (cursor) => {
            const result = await api.own(false, cursor, signal);
            assertCurrent();
            observeCreatedSkills(
              result.data,
              !cursor && !result.pagination.hasMore,
            );
            return {
              ...result,
              data: result.data
                .map((skill) =>
                  withSubmittedVerification(skill, submittedVerifications),
                )
                .filter(
                  (skill) =>
                    !skill.archivedAt && !deletedSkillIds.has(skill.id),
                ),
            };
          },
          filter,
          pageParam,
        );
      }),
    getNextPageParam: (last) =>
      last.pagination.hasMore
        ? (last.pagination.nextCursor ?? undefined)
        : undefined,
  });
  const refresh = useCallback(
    () =>
      client.refetchQueries(
        {
          queryKey: JSON.parse(signature),
          exact: true,
          type: "active",
          ...(options.preview ? { stale: true } : {}),
        },
        { cancelRefetch: false },
      ),
    [client, signature, options.preview],
  );
  useSkillReadFocus(refresh, enabled);
  return usePrivateSkillQuery(key, query);
}
export { usePublicSkills, useCatalog } from "./use-public-skill-queries";
export function useOwnSkill(id: string | null) {
  const {
    api,
    scope,
    assertCurrent,
    deletedSkillIds,
    submittedVerifications,
    observeCreatedSkills,
    recentlyCreatedSkills,
    privateReads,
  } = useSkills();
  const key = [...scope, "detail", id];
  const query = useQuery({
    queryKey: key,
    enabled: !!id && !deletedSkillIds.has(id),
    staleTime: 0,
    queryFn: ({ signal }) =>
      privateReads.read(key, async () => {
        const result = await api.findOwn(id!, signal);
        assertCurrent();
        if (result) observeCreatedSkills([result]);
        else recentlyCreatedSkills.delete(id!);
        return deletedSkillIds.has(id!) || !result
          ? null
          : withSubmittedVerification(result, submittedVerifications);
      }),
  });
  useSkillReadFocus(query.refetch, !!id && !deletedSkillIds.has(id));
  return usePrivateSkillQuery(key, query);
}
export function useVerificationHistory(id: string | null) {
  const { api, scope, assertCurrent, observeVerifications, privateReads } =
    useSkills();
  const key = [...scope, "history", id];
  const query = useInfiniteQuery({
    queryKey: key,
    enabled: !!id,
    staleTime: 0,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) =>
      privateReads.read(key, async () => {
        const result = await api.history(id!, pageParam, signal);
        assertCurrent();
        return result;
      }),
    getNextPageParam: (last) =>
      last.pagination.hasMore
        ? (last.pagination.nextCursor ?? undefined)
        : undefined,
  });
  const result = usePrivateSkillQuery(key, query);
  useEffect(() => {
    observeVerifications(result.data?.pages.flatMap((page) => page.data) ?? []);
  }, [result.data, observeVerifications]);
  useSkillReadFocus(query.refetch, !!id);
  return result;
}
export function useVerification(
  id: string | null,
  verificationId: string | null,
) {
  const { api, scope, assertCurrent, observeVerifications, privateReads } =
    useSkills();
  const key = [...scope, "verification", id, verificationId];
  const query = useQuery({
    queryKey: key,
    enabled: !!id && !!verificationId,
    staleTime: 0,
    queryFn: ({ signal }) =>
      privateReads.read(key, async () => {
        const result = await api.verification(id!, verificationId!, signal);
        assertCurrent();
        return result;
      }),
  });
  const result = usePrivateSkillQuery(key, query);
  useEffect(() => {
    if (result.data) observeVerifications([result.data]);
  }, [result.data, observeVerifications]);
  useSkillReadFocus(query.refetch, !!id && !!verificationId);
  return result;
}
export function uniqueItems<T extends { id: string }>(pages?: { data: T[] }[]) {
  return [
    ...new Map(
      pages?.flatMap((page) => page.data).map((item) => [item.id, item]),
    ).values(),
  ];
}
