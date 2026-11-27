import { useIsFocused } from "expo-router";
import { useConnectionList, useConnectionQuery } from "@/features/connections";
import { useSubscriptions } from "../context/subscriptions-provider";

export function useMembership() {
  const { api } = useSubscriptions();
  return useConnectionQuery(["subscriptions", "me"], api.me, useIsFocused(), {
    refreshOnFocus: "stale",
    cancelOnDisable: true,
  });
}
export function useSubscriptionPlans() {
  const { api } = useSubscriptions();
  return useConnectionQuery(
    ["subscriptions", "plans"],
    api.plans,
    useIsFocused(),
    { refreshOnFocus: "stale", cancelOnDisable: true },
  );
}
export function useSubscriptionCharges() {
  const { api } = useSubscriptions();
  return useConnectionList(
    ["subscriptions", "charges"],
    api.charges,
    useIsFocused(),
    { refreshOnFocus: "stale", cancelOnDisable: true },
  );
}
