"use client";
import { useStaffList } from "./hooks";
import { useListPages } from "@/components/pagination/use-list-pages";

export function useStaffListPages<T extends { id?: string; userId?: string }>(
  path: string,
) {
  const [pathname, search] = path.split("?");
  const params = new URLSearchParams(search);
  params.set("limit", "20");
  const query = useStaffList<T>(`${pathname}?${params}`);
  const pagination = useListPages({ ...query, hasMore: !!query.page?.hasMore });
  return { ...query, ...pagination, allItems: query.items };
}
