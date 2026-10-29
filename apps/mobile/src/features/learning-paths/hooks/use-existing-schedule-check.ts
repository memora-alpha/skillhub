import { useEffect, useRef, useState } from "react";
import { useIsFocused } from "expo-router";
import { useWatch, type Control } from "react-hook-form";
import {
  deviceTimezone,
  listIsLimited,
  useSessionList,
} from "@/features/sessions";
import type { ApiLearningPlan } from "../api/learning-paths-contract";
import type { ScheduleInput } from "../schemas/schedule-input";
import {
  previewScheduleItems,
  type ScheduleSlot,
} from "../utils/schedule-conflicts";
import {
  existingScheduleRange,
  existingScheduleConflicts,
} from "../utils/schedule-existing-conflicts";

const emptyRange = {
  from: "1970-01-01T00:00:00.000Z",
  to: "1970-01-01T00:00:00.000Z",
};

export function useExistingScheduleCheck(
  control: Control<ScheduleInput>,
  plan: ApiLearningPlan,
  pathId: string,
  allowed: boolean,
  applyVersion = 0,
) {
  const focused = useIsFocused();
  const items = useWatch({ control, name: "items" });
  const slots = previewScheduleItems(items ?? [], plan.schedule?.items);
  const range = existingScheduleRange(slots);
  const query = useSessionList(
    range ?? emptyRange,
    deviceTimezone(),
    allowed && focused && !!range,
  );
  const available =
    query.enabled && !query.error && !query.denial && query.data !== undefined;
  const conflicts = available
    ? existingScheduleConflicts(slots, query.data!, pathId)
    : [];
  const [validating, setValidating] = useState(false);
  const pending =
    query.enabled &&
    (query.isFetching ||
      validating ||
      (!query.error && !query.denial && query.data === undefined));
  const limited = available && listIsLimited(query.data!);
  const snapshot = {
    signature: JSON.stringify(slots),
    scope: JSON.stringify(query.queryKey),
    enabled: query.enabled,
    pathId,
    refetch: query.refetch,
  };
  const latest = useRef({ snapshot, inFlight: false, mounted: true });
  latest.current.snapshot = snapshot;
  useEffect(() => {
    latest.current.mounted = true;
    return () => {
      latest.current.mounted = false;
    };
  }, []);
  const rangeFrom = range?.from,
    rangeTo = range?.to;
  useEffect(() => {
    if (query.enabled && rangeFrom && rangeTo)
      void query.refetch({ cancelRefetch: false });
  }, [query.enabled, query.refetch, rangeFrom, rangeTo, applyVersion]);
  return {
    hasSlots: slots.length > 0,
    pending,
    blocked: slots.length > 0 && (!available || limited || pending),
    available,
    checkedSessionCount: available
      ? query.data!.filter((session) => session.status !== "CANCELLED").length
      : 0,
    conflicts,
    error: query.error,
    denial: query.denial,
    limited,
    retry: () => query.refetch({ cancelRefetch: false }),
    validate: async (submitted: readonly ScheduleSlot[]) => {
      const current = latest.current.snapshot;
      const empty = { pending: false, unavailable: true, conflicts: [] };
      if (
        !latest.current.mounted ||
        !current.enabled ||
        JSON.stringify(submitted) !== current.signature
      )
        return empty;
      if (latest.current.inFlight) return { ...empty, pending: true };
      latest.current.inFlight = true;
      setValidating(true);
      try {
        const result = await current.refetch({ cancelRefetch: false });
        const active = latest.current.snapshot;
        if (
          !latest.current.mounted ||
          !active.enabled ||
          active.scope !== current.scope ||
          active.signature !== current.signature ||
          result.error ||
          result.data === undefined ||
          listIsLimited(result.data)
        )
          return empty;
        return {
          pending: false,
          unavailable: false,
          conflicts: existingScheduleConflicts(
            submitted,
            result.data,
            current.pathId,
          ),
        };
      } catch {
        return empty;
      } finally {
        latest.current.inFlight = false;
        setValidating(false);
      }
    },
  };
}
