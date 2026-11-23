import { useIsFocused } from "expo-router";
import { useConnectionList, useConnectionQuery } from "@/features/connections";
import { uuid } from "@/lib/http/contracts";
import { useRewards } from "../context/rewards-provider";

export function useRewardProducts() {
  const { api } = useRewards();
  const focused = useIsFocused();
  return useConnectionQuery(["rewards", "products"], api.products, focused, {
    refreshOnFocus: "stale",
    cancelOnDisable: true,
  });
}
export function useRewardProduct(id: string) {
  const { api } = useRewards();
  const focused = useIsFocused();
  return useConnectionQuery(
    ["rewards", "product", id],
    (signal) => api.product(id, signal),
    focused && uuid.safeParse(id).success,
    { freshOnMount: true, cancelOnDisable: true },
  );
}
export function useRedemptions() {
  const { api } = useRewards();
  const focused = useIsFocused();
  return useConnectionList(
    ["rewards", "redemptions"],
    api.redemptions,
    focused,
    { refreshOnFocus: "stale", cancelOnDisable: true },
  );
}
export function useRedemption(id: string) {
  const { api } = useRewards();
  const focused = useIsFocused();
  return useConnectionQuery(
    ["rewards", "redemption", id],
    (signal) => api.receipt(id, signal),
    focused && uuid.safeParse(id).success,
    { freshOnMount: true, cancelOnDisable: true },
  );
}
