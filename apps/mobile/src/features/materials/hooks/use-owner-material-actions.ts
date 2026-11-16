import { useMemo, useState } from "react";
import { useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { useConnections } from "@/features/connections";
import { useToast } from "@/providers/ToastProvider";
import type { ApiMaterial } from "../api/material-contracts";
import {
  createOwnerMaterialActions,
  type OwnerActionState,
} from "../utils/owner-material-actions";
import { useMaterialsApi } from "./use-materials";

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
      onDeleted: async (id) => {
        await cache.cancelQueries({ queryKey: base });
        if (!runtime.isCurrent()) return;
        type Page = Awaited<ReturnType<typeof api.minePage>>;
        cache.setQueryData<InfiniteData<Page>>(
          [...base, "mine", "pages"],
          (data) =>
            data && {
              ...data,
              pages: data.pages.map((page) => ({
                ...page,
                items: page.items.filter((item) => item.id !== id),
              })),
            },
        );
        cache.setQueryData<ApiMaterial[]>([...base, "mine"], (data) =>
          data?.filter((item) => item.id !== id),
        );
        cache.removeQueries({ queryKey: [...base, "detail", id], exact: true });
        invalidate();
        if (runtime.isCurrent()) showToast("Đã xóa bản nháp.", "success");
      },
      onResult: async (row) => {
        await cache.cancelQueries({ queryKey: base });
        if (!runtime.isCurrent()) return;
        type Page = Awaited<ReturnType<typeof api.minePage>>;
        cache.setQueryData<InfiniteData<Page>>(
          [...base, "mine", "pages"],
          (data) =>
            data && {
              ...data,
              pages: data.pages.map((page) => ({
                ...page,
                items: page.items.map((item) =>
                  item.id === row.id ? row : item,
                ),
              })),
            },
        );
        cache.setQueryData<ApiMaterial[]>([...base, "mine"], (data) =>
          data?.map((item) => (item.id === row.id ? row : item)),
        );
        cache.setQueryData([...base, "detail", row.id], row);
        invalidate();
      },
    });
  }, [api, cache, runtime, showToast]);
  return { ...(snapshot?.scope === runtime ? snapshot.value : {}), ...actions };
}
