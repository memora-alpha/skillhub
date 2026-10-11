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

export function validId(value?: string | string[]) {
  return typeof value === "string" && z.uuid().safeParse(value).success
    ? value
    : null;
}
export function useOwnSkills(filter: SkillFilter = "ALL") {
  const client = useQueryClient();
  const { api, scope, assertCurrent, deletedSkillIds, submittedVerifications } =
    useSkills();
  const query = useInfiniteQuery<
    Page<OwnSkill>,
    Error,
    InfiniteData<Page<OwnSkill>, string | undefined>,
    readonly unknown[],
    string | undefined
  >({
    queryKey: [...scope, "own", false, filter],
    staleTime: 0,
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
    queryFn: async ({ pageParam, signal }) => {
      return filteredSkillPage(
        async (cursor) => {
          const result = await api.own(false, cursor, signal);
          assertCurrent();
          return {
            ...result,
            data: result.data
              .map((skill) =>
                withSubmittedVerification(skill, submittedVerifications),
              )
              .filter(
                (skill) => !skill.archivedAt && !deletedSkillIds.has(skill.id),
              ),
          };
        },
        filter,
        pageParam,
      );
    },
    getNextPageParam: (last) =>
      last.pagination.hasMore
        ? (last.pagination.nextCursor ?? undefined)
        : undefined,
  });
  useSkillReadFocus(query.refetch);
  return query;
}
export function usePublicSkills() {
  const { api, scope, userId, assertCurrent, deletedSkillIds } = useSkills();
  const query = useInfiniteQuery({
    queryKey: [...scope, "public", userId],
    staleTime: 0,
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam, signal }) => {
      const result = await api.publicSkills(userId, pageParam, signal);
      assertCurrent();
      return {
        ...result,
        data: result.data.filter((skill) => !deletedSkillIds.has(skill.id)),
      };
    },
    getNextPageParam: (last) =>
      last.pagination.hasMore
        ? (last.pagination.nextCursor ?? undefined)
        : undefined,
  });
  useSkillReadFocus(query.refetch);
  return query;
}
export function useCatalog(search: string, enabled = true) {
  const { api, scope, assertCurrent } = useSkills();
  const q = search.trim().normalize("NFC");
  const length = [...q].length;
  return useInfiniteQuery({
    queryKey: [...scope, "catalog", q],
    enabled: enabled && (!length || (length >= 2 && length <= 100)),
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam, signal }) => {
      const result = await api.catalog(q || undefined, pageParam, signal);
      assertCurrent();
      return result;
    },
    getNextPageParam: (last) =>
      last.pagination.hasMore
        ? (last.pagination.nextCursor ?? undefined)
        : undefined,
  });
}
export function useOwnSkill(id: string | null) {
  const { api, scope, assertCurrent, deletedSkillIds, submittedVerifications } =
    useSkills();
  const query = useQuery({
    queryKey: [...scope, "detail", id],
    enabled: !!id && !deletedSkillIds.has(id),
    staleTime: 0,
    queryFn: async ({ signal }) => {
      const result = await api.findOwn(id!, signal);
      assertCurrent();
      return deletedSkillIds.has(id!) || !result
        ? null
        : withSubmittedVerification(result, submittedVerifications);
    },
  });
  useSkillReadFocus(query.refetch, !!id && !deletedSkillIds.has(id));
  return query;
}
export function useVerificationHistory(id: string | null) {
  const { api, scope, assertCurrent } = useSkills();
  const query = useInfiniteQuery({
    queryKey: [...scope, "history", id],
    enabled: !!id,
    staleTime: 0,
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam, signal }) => {
      const result = await api.history(id!, pageParam, signal);
      assertCurrent();
      return result;
    },
    getNextPageParam: (last) =>
      last.pagination.hasMore
        ? (last.pagination.nextCursor ?? undefined)
        : undefined,
  });
  useSkillReadFocus(query.refetch, !!id);
  return query;
}
export function useVerification(
  id: string | null,
  verificationId: string | null,
) {
  const { api, scope, assertCurrent } = useSkills();
  const query = useQuery({
    queryKey: [...scope, "verification", id, verificationId],
    enabled: !!id && !!verificationId,
    staleTime: 0,
    queryFn: async ({ signal }) => {
      const result = await api.verification(id!, verificationId!, signal);
      assertCurrent();
      return result;
    },
  });
  useSkillReadFocus(query.refetch, !!id && !!verificationId);
  return query;
}
export function uniqueItems<T extends { id: string }>(pages?: { data: T[] }[]) {
  return [
    ...new Map(
      pages?.flatMap((page) => page.data).map((item) => [item.id, item]),
    ).values(),
  ];
}
