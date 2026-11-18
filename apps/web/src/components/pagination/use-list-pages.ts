"use client";
import { useEffect, useRef, useState } from "react";

export function splitPages<T>(items: readonly T[], size = 20): T[][] {
  if (!Number.isSafeInteger(size) || size < 1)
    throw new RangeError("Kích thước trang không hợp lệ.");
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size)
    result.push(items.slice(index, index + size));
  return result;
}
export function useListPages<T>(source: {
  scope: string;
  chunks: T[][];
  loading: boolean;
  hasMore: boolean;
  error?: string;
  more: () => unknown;
  reload: () => unknown;
}) {
  const [selection, setSelection] = useState({ scope: source.scope, page: 1 });
  const activeScope = useRef<string | null>(null);
  useEffect(() => {
    activeScope.current = source.scope;
    return () => {
      if (activeScope.current === source.scope) activeScope.current = null;
    };
  }, [source.scope]);
  const known = Math.max(1, source.chunks.length);
  const requested = selection.scope === source.scope ? selection.page : 1;
  const pageNumber = Math.min(requested, known);
  return {
    items: source.chunks[pageNumber - 1] ?? [],
    pageNumber,
    totalPages: source.hasMore ? undefined : known,
    hasNext: pageNumber < known || source.hasMore,
    loading: source.loading,
    goToPage: (target: number) => {
      if (
        activeScope.current !== source.scope ||
        !Number.isSafeInteger(target) ||
        target < 1 ||
        source.loading ||
        target > known + (source.hasMore ? 1 : 0)
      )
        return;
      setSelection({ scope: source.scope, page: target });
      if (target > known) void source.more();
    },
    reload: () => {
      if (activeScope.current !== source.scope) return;
      setSelection({ scope: source.scope, page: 1 });
      return source.reload();
    },
  };
}
