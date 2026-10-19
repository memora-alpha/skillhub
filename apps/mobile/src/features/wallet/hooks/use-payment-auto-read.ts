import { useEffect, useRef, useState } from "react";
import { startPaymentReadLoop } from "../utils/payment-auto-read";

export function usePaymentAutoRead({
  active,
  id,
  current,
  snapshot,
  read,
}: {
  active: boolean;
  id?: string;
  current: () => boolean;
  snapshot: () => {
    id?: string;
    status?: string;
    denied?: boolean;
    stale?: boolean;
  };
  read: () => Promise<unknown>;
}) {
  const latest = useRef({ current, snapshot, read });
  latest.current = { current, snapshot, read };
  const [watching, setWatching] = useState(false);
  useEffect(() => {
    if (!active || !id) {
      setWatching(false);
      return;
    }
    setWatching(true);
    return startPaymentReadLoop({
      current: () => latest.current.current(),
      snapshot: () => latest.current.snapshot(),
      read: () => latest.current.read(),
      onStop: () => setWatching(false),
    });
  }, [active, id]);
  return watching;
}
