import { useCallback, useEffect, useMemo, useState } from "react";
import { useFocusEffect } from "expo-router";
import { AppState } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { useConnections } from "@/features/connections";
import { AppError } from "@/lib/http/errors";
import { useCommunityApi, useReputation } from "./use-community";

export function useReputationPolicy(enabled = true) {
  const runtime = useConnections();
  const api = useCommunityApi();
  const cache = useQueryClient();
  const scope = useMemo(
    () => ({
      alive: true,
      focused: false,
      enabled: false,
      busy: false,
      epoch: 0,
      receiptRead: 0,
    }),
    // A fresh owner/session must never inherit a previous acknowledgement.
    [runtime],
  );
  scope.enabled = enabled;
  useEffect(() => {
    scope.alive = true;
    return () => {
      scope.alive = false;
    };
  }, [scope]);
  useFocusEffect(
    useCallback(() => {
      scope.epoch++;
      scope.focused = true;
      return () => {
        scope.focused = false;
        scope.epoch++;
      };
    }, [scope]),
  );
  const query = useReputation(enabled);
  const data = query.data?.pages[0];
  useFocusEffect(
    useCallback(() => {
      if (!enabled || !runtime.isCurrent()) return;
      const future =
        data?.activeRestrictions
          .map((item) => Date.parse(item.endsAt))
          .filter((end) => end > Date.now()) ?? [];
      if (!future.length) return;
      const timer = setTimeout(
        () => {
          if (runtime.isCurrent() && AppState.currentState === "active")
            void query.refetch({ cancelRefetch: false });
        },
        Math.min(Math.min(...future) - Date.now() + 1000, 2_147_483_647),
      );
      return () => clearTimeout(timer);
    }, [enabled, runtime, data, query.refetch]),
  );
  const [state, setState] = useState({
    scope,
    pending: false,
    acknowledged: false,
    needsCheck: false,
    error: undefined as unknown,
  });
  const stored =
    state.scope === scope
      ? state
      : {
          scope,
          pending: false,
          acknowledged: false,
          needsCheck: false,
          error: undefined,
        };
  // Count successful cache writes, including structurally identical responses.
  // A later GET can require a new explicit acceptance of the same policy text.
  const readVersion = () =>
    cache.getQueryState([...runtime.key, "reputation"])?.dataUpdateCount ?? 0;
  const revision = readVersion();
  const historyPage = cache.getQueryState([...runtime.key, "reputation"])
    ?.fetchMeta?.fetchMore;
  const receiptChecked =
    stored.acknowledged &&
    !stored.pending &&
    !scope.busy &&
    revision > scope.receiptRead &&
    !historyPage &&
    !!data &&
    !query.error &&
    !query.isFetching;
  const current = receiptChecked
    ? { ...stored, acknowledged: !data?.policyNotice?.length, error: undefined }
    : stored;
  useEffect(() => {
    if (!receiptChecked) return;
    setState((previous) =>
      previous.scope === scope
        ? {
            ...previous,
            acknowledged: !data?.policyNotice?.length,
            error: undefined,
          }
        : previous,
    );
  }, [receiptChecked, revision, data, scope]);
  const valid = () => scope.alive && runtime.isCurrent();
  const canAct = () => valid() && scope.focused && scope.enabled;
  const read = async () => {
    const result = await query.refetch({
      cancelRefetch: false,
      throwOnError: true,
    });
    if (!valid()) throw new AppError("session");
    const latest = result.data?.pages[0];
    if (!latest || result.error) throw result.error ?? new AppError("protocol");
    return latest;
  };
  async function refresh() {
    if (scope.busy || !canAct()) return;
    scope.busy = true;
    setState({ ...current, pending: true, error: undefined });
    try {
      const data = await read();
      if (canAct())
        setState({
          scope,
          pending: false,
          acknowledged: current.acknowledged && !data.policyNotice?.length,
          needsCheck: false,
          error: undefined,
        });
      return data;
    } catch (error) {
      if (valid()) setState({ ...current, pending: false, error });
    } finally {
      scope.busy = false;
      if (valid())
        setState((previous) =>
          previous.scope === scope ? { ...previous, pending: false } : previous,
        );
    }
  }
  async function acknowledge() {
    const shown = data?.policyNotice;
    if (
      scope.busy ||
      !canAct() ||
      current.needsCheck ||
      current.acknowledged ||
      query.isFetching ||
      query.error ||
      !shown?.length
    )
      return;
    scope.busy = true;
    setState({
      scope,
      pending: true,
      acknowledged: false,
      needsCheck: false,
      error: undefined,
    });
    let sent = false;
    let acknowledged = false;
    const epoch = scope.epoch;
    try {
      const latest = await read();
      if (!canAct() || scope.epoch !== epoch) return;
      // If policy text changed, show the fresh text before accepting a new click.
      if (JSON.stringify(latest.policyNotice) !== JSON.stringify(shown)) return;
      sent = true;
      await api.acknowledgePolicy();
      if (!valid()) return;
      acknowledged = true;
      scope.receiptRead = readVersion();
      setState({
        scope,
        pending: true,
        acknowledged: true,
        needsCheck: false,
        error: undefined,
      });
      await cache.invalidateQueries({
        queryKey: [...runtime.key, "reputation"],
        refetchType: "none",
      });
      await read();
    } catch (error) {
      if (valid())
        setState({
          scope,
          pending: true,
          acknowledged,
          needsCheck: sent && !acknowledged,
          error,
        });
    } finally {
      scope.busy = false;
      if (valid())
        setState((previous) =>
          previous.scope === scope ? { ...previous, pending: false } : previous,
        );
    }
  }
  return { query, data, ...current, refresh, acknowledge };
}
