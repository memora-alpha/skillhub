"use client";
import { useEffect, useRef, useState } from "react";
import { useUserSession } from "../auth/session";
import { UserApiError } from "../api/client";
export function useUserCommand(idempotent = false) {
  const { refresh } = useUserSession();
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const lock = useRef(false),
    identity = useRef<{ fingerprint: string; key: string } | null>(null);
  const [pending, setPending] = useState(false),
    [error, setError] = useState<string>(),
    [uncertain, setUncertain] = useState(false);
  async function run<T>(
    fingerprint: string,
    work: (key: string) => Promise<T>,
  ): Promise<T | undefined> {
    if (lock.current || !active.current) return;
    if (
      identity.current &&
      (!idempotent || identity.current.fingerprint !== fingerprint)
    ) {
      setError(
        "Chưa xác định kết quả lần trước. Tải lại trạng thái trước khi tạo yêu cầu mới.",
      );
      return;
    }
    identity.current ??= { fingerprint, key: crypto.randomUUID() };
    lock.current = true;
    setPending(true);
    setError(undefined);
    try {
      const result = await work(identity.current.key);
      if (!active.current) return;
      identity.current = null;
      setUncertain(false);
      refresh();
      return result;
    } catch (cause) {
      if (!active.current) return;
      const unknown =
        !(cause instanceof UserApiError) ||
        cause.status === 0 ||
        cause.status === 408 ||
        cause.status >= 500;
      if (!unknown) identity.current = null;
      setUncertain(unknown);
      setError(cause instanceof Error ? cause.message : "Không thể hoàn tất.");
      refresh();
    } finally {
      lock.current = false;
      if (active.current) setPending(false);
    }
  }
  return { run, pending, error, uncertain, canRetry: idempotent && uncertain };
}
