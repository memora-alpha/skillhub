import { useCallback, useRef } from "react";
import { useFocusEffect } from "expo-router";

/** Each explicit action belongs to one visit, even after blur and refocus. */
export function useProposalLifecycle(resourceKey: string) {
  const visit = useRef({ focused: false, epoch: 0, resourceKey });
  useFocusEffect(
    useCallback(() => {
      visit.current.focused = true;
      visit.current.resourceKey = resourceKey;
      visit.current.epoch++;
      return () => {
        visit.current.focused = false;
        visit.current.epoch++;
      };
    }, [resourceKey]),
  );
  return (isSessionCurrent: () => boolean) => {
    const epoch = visit.current.epoch;
    return () =>
      visit.current.focused &&
      visit.current.resourceKey === resourceKey &&
      visit.current.epoch === epoch &&
      isSessionCurrent();
  };
}
