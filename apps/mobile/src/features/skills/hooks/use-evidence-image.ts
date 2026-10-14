import { useCallback, useState } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "expo-router";
import { useSkills } from "../context/SkillsProvider";

export function useEvidenceImage(id: string, evidenceId: string) {
  const { api, isCurrent } = useSkills();
  const [uri, setUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [attempt, retry] = useState(0);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      let expiry: ReturnType<typeof setTimeout> | undefined;
      const abort = new AbortController();
      setUri(null);
      setLoading(true);
      const load = async () => {
        try {
          const result = await api.download(id, evidenceId, abort.signal);
          const remaining = Date.parse(result.expiresAt) - Date.now();
          if (!active || !isCurrent() || abort.signal.aborted) return;
          if (remaining <= 0) throw new Error("expired");
          setUri(result.url);
          expiry = setTimeout(
            () => {
              if (active && isCurrent()) setUri(null);
            },
            Math.min(remaining, 2_147_483_647),
          );
        } catch {
          if (active && isCurrent()) setUri(null);
        } finally {
          if (active && isCurrent()) setLoading(false);
        }
      };
      void load();
      const subscription = AppState.addEventListener("change", (state) => {
        if (state !== "active") {
          active = false;
          abort.abort();
          clearTimeout(expiry);
          setUri(null);
        } else retry((value) => value + 1);
      });
      return () => {
        active = false;
        abort.abort();
        clearTimeout(expiry);
        subscription.remove();
        setUri(null);
      };
    }, [api, id, evidenceId, attempt, isCurrent]),
  );
  return {
    uri,
    loading,
    retry: () => retry((value) => value + 1),
    failed: () => setUri(null),
  };
}
