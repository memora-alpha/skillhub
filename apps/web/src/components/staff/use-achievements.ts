"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { StaffApiError, isSessionFailure } from "@/lib/staff/client";
import {
  parseAchievements,
  parseSelectedTitle,
  type Achievements,
} from "@/lib/staff/achievements";
import { useStaffSession } from "./session";

export function useAchievements() {
  const { api, expire } = useStaffSession();
  const [data, setData] = useState<Achievements>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const read = useRef<AbortController | null>(null);
  const write = useRef<AbortController | null>(null);
  const failure = useCallback(
    (error: unknown) => {
      if (isSessionFailure(error)) expire();
      if (error instanceof StaffApiError && [401, 403].includes(error.status))
        setData(undefined);
      setError(
        error instanceof Error
          ? error.message
          : "Không thể cập nhật thành tích.",
      );
    },
    [expire],
  );
  const load = useCallback(() => {
    if (write.current) return;
    read.current?.abort();
    const controller = new AbortController();
    read.current = controller;
    return api<unknown>("achievements", { signal: controller.signal })
      .then((result) => {
        if (!controller.signal.aborted) setData(parseAchievements(result.data));
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) failure(error);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
  }, [api, failure]);
  const reload = useCallback(
    (preserveError = false) => {
      if (write.current) return Promise.resolve();
      setLoading(true);
      if (!preserveError) setError(undefined);
      return load();
    },
    [load],
  );
  useEffect(() => {
    void load();
    return () => {
      read.current?.abort();
      write.current?.abort();
    };
  }, [load]);
  async function select(code: string | null) {
    if (write.current) return;
    read.current?.abort();
    const controller = new AbortController();
    write.current = controller;
    setSaving(true);
    setLoading(false);
    setSuccess(false);
    setError(undefined);
    try {
      const result = await api<unknown>("achievements/selected-title", {
        method: "PATCH",
        body: code === null ? {} : { code },
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      const title = parseSelectedTitle(result.data);
      setData((current) => (current ? { ...current, ...title } : current));
      setSuccess(true);
    } catch (error) {
      if (!controller.signal.aborted) failure(error);
    } finally {
      if (write.current === controller) write.current = null;
      if (!controller.signal.aborted) {
        setSaving(false);
        void reload(true);
      }
    }
  }
  return { data, error, loading, saving, success, reload, select };
}
