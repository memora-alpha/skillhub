import { useMemo, useState } from "react";
import { useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { useConnections } from "@/features/connections";
import { useToast } from "@/providers/ToastProvider";
import {
  createOwnerMaterialActions,
  type OwnerActionState,
} from "../utils/owner-material-actions";
import { useMaterialsApi } from "./use-materials";
import type { ApiMaterial } from "../api/material-contracts";

type OwnerPage = Awaited<
  ReturnType<ReturnType<typeof useMaterialsApi>["minePage"]>
>;
type OwnerPages = InfiniteData<OwnerPage>;

function removeFromOwnerPages(data: OwnerPages | undefined, id: string) {
  if (!data) return data;
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      items: page.items.filter((item) => item.id !== id),
    })),
  };
}

function updateOwnerPages(
  data: OwnerPages | undefined,
  row: ApiMaterial,
  filter: unknown,
) {
  if (!data) return data;
  const keep =
    filter === "CURRENT" ? row.status !== "ARCHIVED" : filter === row.status;
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      items: page.items.flatMap((item) => {
        if (item.id !== row.id) return [item];
        return keep ? [row] : [];
      }),
    })),
  };
}

export function useOwnerMaterialActions() {
  const runtime = useConnections();
  const api = useMaterialsApi();
  const cache = useQueryClient();
  const { showToast } = useToast();
  const [snapshot, setSnapshot] = useState<{
    scope: typeof runtime;
    value: OwnerActionState;
  }>();
  const actions = useMemo(() => {
    const base = [...runtime.key, "materials"];
    const invalidate = () => {
      void cache.invalidateQueries({ queryKey: base });
    };
    return createOwnerMaterialActions({
      api,
      isCurrent: runtime.isCurrent,
      onChange: (value) => setSnapshot({ scope: runtime, value }),
      onFailure: invalidate,
      onNotice: showToast,
      onDeleted: async (id) => {
        await cache.cancelQueries({ queryKey: base });
        if (!runtime.isCurrent()) return;
        cache.setQueriesData<OwnerPages>(
          { queryKey: [...base, "mine", "pages"] },
          (data) => removeFromOwnerPages(data, id),
        );
        cache.removeQueries({ queryKey: [...base, "detail", id], exact: true });
        cache.removeQueries({ queryKey: [...base, "owner", id], exact: true });
        invalidate();
        if (runtime.isCurrent()) showToast("Đã xóa tài liệu.", "success");
      },
      onResult: async (row) => {
        await cache.cancelQueries({ queryKey: base });
        if (!runtime.isCurrent()) return;
        for (const [key] of cache.getQueriesData({
          queryKey: [...base, "mine", "pages"],
        })) {
          const filter = key.at(-1);
          cache.setQueryData<OwnerPages>(key, (data) =>
            updateOwnerPages(data, row, filter),
          );
        }
        cache.setQueryData([...base, "detail", row.id], row);
        cache.setQueryData([...base, "owner", row.id], row);
        invalidate();
      },
    });
  }, [api, cache, runtime, showToast]);
  return { ...(snapshot?.scope === runtime ? snapshot.value : {}), ...actions };
}
