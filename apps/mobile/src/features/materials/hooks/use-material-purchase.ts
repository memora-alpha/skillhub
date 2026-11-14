import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useConnectionCommand, useConnections } from "@/features/connections";
import { useRefreshWallet } from "@/features/wallet";
import type { ApiMaterial, MaterialOrder } from "../api/material-contracts";
import { useMaterialsApi } from "./use-materials";

export function useMaterialPurchase(id: string) {
  const api = useMaterialsApi();
  const runtime = useConnections();
  const cache = useQueryClient();
  const router = useRouter();
  const refreshWallet = useRefreshWallet();
  const command = useConnectionCommand<MaterialOrder>([["materials"]]);
  const finish = async (order: MaterialOrder | undefined) => {
    if (!order || !runtime.isCurrent()) return;
    await cache.cancelQueries({
      queryKey: [...runtime.key, "materials", "orders"],
    });
    if (!runtime.isCurrent()) return;
    cache.setQueryData(
      [...runtime.key, "materials", "orders", id],
      order.status === "SUCCESS" ? order : null,
    );
    void refreshWallet()?.catch(() => undefined);
    if (order.status === "SUCCESS") router.replace(`/materials/${id}`);
    return order;
  };
  const buy = (material: ApiMaterial) =>
    command
      .run(JSON.stringify({ id, version: material.listingVersion }), (key) =>
        api.purchase(id, material.listingVersion, key),
      )
      .then(finish);
  const check = () => command.retry().then(finish);
  return { ...command, buy, check };
}
