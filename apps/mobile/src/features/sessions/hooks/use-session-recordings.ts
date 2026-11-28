import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSessionsRuntime } from "../runtime";
import { useClassroomActivity } from "./use-classroom-activity";
import { classroomError } from "../utils/classroom-presentation";
import type { RecordingAction } from "../api/classroom-api";
import { sessionReadGuard } from "../utils/session-read";

export function useSessionRecordings(sessionId: string, enabled = true) {
  const runtime = useSessionsRuntime();
  const client = useQueryClient();
  const key = useMemo(
    () => [...runtime.key, "recordings", sessionId],
    [runtime.key, sessionId],
  );
  const guard = useMemo(() => sessionReadGuard(client, key), [client, key]);
  const active = useClassroomActivity(enabled && runtime.enabled);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const lock = useRef(false),
    mounted = useRef(false),
    activeRef = useRef(active);
  activeRef.current = active;
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const query = useQuery({
    queryKey: key,
    enabled: active,
    retry: false,
    staleTime: 0,
    refetchInterval: active ? 5000 : false,
    refetchIntervalInBackground: false,
    meta: { sessionReadGuard: guard },
    queryFn: ({ signal }) =>
      guard.read(
        () => runtime.api.recordings(sessionId, signal),
        runtime.isCurrent,
      ),
  });
  const current = () => mounted.current && runtime.isCurrent();
  const denied = !!guard.denial;
  async function run(action: RecordingAction, id?: string) {
    if (
      !activeRef.current ||
      !current() ||
      lock.current ||
      query.isFetching ||
      query.isError ||
      denied ||
      !query.data
    )
      return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await runtime.api.recordingAction(sessionId, action, id);
    } catch (cause) {
      if (current()) setError(classroomError(cause));
    } finally {
      // Reconcile uncertain writes before enabling another action; never replay them.
      if (current()) {
        await query.refetch({ cancelRefetch: false });
        if (current()) setBusy(false);
      }
      lock.current = false;
    }
  }
  return {
    ...query,
    data: !active || denied ? undefined : query.data,
    busy,
    run,
    active,
    message: error || (query.error ? classroomError(query.error) : ""),
    userId: runtime.userId,
  };
}
