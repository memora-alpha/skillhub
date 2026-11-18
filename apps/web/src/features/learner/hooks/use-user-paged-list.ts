"use client";
import { useUserList } from "./use-user-resource";
import { useListPages } from "@/components/pagination/use-list-pages";

export function listPagePath(path: string) {
  const [pathname, search] = path.split("?");
  const params = new URLSearchParams(search);
  if (!params.has("limit")) params.set("limit", "20");
  return `${pathname}?${params}`;
}
export function useUserPagedList<T extends { id: string }>(
  path: string,
  nestedItems = false,
) {
  const query = useUserList<T>(listPagePath(path), nestedItems);
  const pagination = useListPages({ ...query, hasMore: !!query.cursor });
  return { ...query, ...pagination, allItems: query.items };
}
