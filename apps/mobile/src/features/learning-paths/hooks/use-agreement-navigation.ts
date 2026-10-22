import { useCallback, useRef, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { useConnections } from "@/features/connections";
import { useLearningPathsApi } from "./use-learning-paths-api";

// Resolve before leaving Chat; no intermediary list for a single agreement.
export function useAgreementNavigation(conversationId: string) {
  const runtime = useConnections(),
    api = useLearningPathsApi(),
    router = useRouter();
  const epoch = useRef(0),
    busy = useRef(false),
    active = useRef(false);
  const request = useRef<AbortController | undefined>(undefined);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>();
  useFocusEffect(
    useCallback(() => {
      active.current = true;
      epoch.current++;
      setPending(false);
      setError(undefined);
      return () => {
        active.current = false;
        epoch.current++;
        busy.current = false;
        request.current?.abort();
      };
    }, []),
  );
  const open = async () => {
    if (busy.current || !active.current || !runtime.isCurrent()) return;
    const generation = epoch.current;
    const current = () =>
      active.current && generation === epoch.current && runtime.isCurrent();
    const controller = new AbortController();
    request.current = controller;
    busy.current = true;
    setPending(true);
    setError(undefined);
    try {
      const paths = await api.mine(controller.signal);
      if (!current()) return;
      const matches = paths.filter(
        (path) => path.conversationId === conversationId,
      );
      router.push(
        matches.length === 1
          ? {
              pathname: "/paths/[id]",
              params: { id: matches[0]!.id, fromConversation: conversationId },
            }
          : {
              pathname: "/agreement-type",
              params: { conversationId, mode: "api" },
            },
      );
    } catch (cause) {
      if (current()) setError(cause);
    } finally {
      if (generation === epoch.current) {
        busy.current = false;
        if (runtime.isCurrent()) setPending(false);
      }
    }
  };
  return { open, pending, error };
}
