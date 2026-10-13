import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";

const step = 5;
export function useProfileSkillWindow({
  count,
  hasNextPage = false,
  fetchNextPage,
}: {
  count: number;
  hasNextPage?: boolean;
  fetchNextPage?: () => Promise<{ isError: boolean }>;
}) {
  const [visible, setVisible] = useState(step);
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const generation = useRef(0);
  useFocusEffect(
    useCallback(() => {
      generation.current += 1;
      locked.current = false;
      setBusy(false);
      setVisible(step);
      return () => {
        generation.current += 1;
        locked.current = false;
      };
    }, []),
  );
  const showMore = async () => {
    if (locked.current) return;
    if (count > visible) {
      setVisible((current) => current + step);
      return;
    }
    if (!hasNextPage || !fetchNextPage) return;
    locked.current = true;
    const requestGeneration = generation.current;
    setBusy(true);
    try {
      const result = await fetchNextPage();
      if (generation.current === requestGeneration && !result.isError)
        setVisible((current) => current + step);
    } finally {
      if (generation.current === requestGeneration) {
        locked.current = false;
        setBusy(false);
      }
    }
  };
  return { visible, busy, hasMore: count > visible || hasNextPage, showMore };
}
