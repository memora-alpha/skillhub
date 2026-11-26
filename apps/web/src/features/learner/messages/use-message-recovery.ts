"use client";
import { useEffect, useRef, useState } from "react";
import { useUserSession } from "../auth/session";
import type { Message } from "../types";
import { readForwardMessages } from "./message-recovery";

export function useMessageRecovery(id: string, items: Message[]) {
  const { request } = useUserSession();
  const checkpoint = useRef<string | undefined>(undefined);
  const [recovered, setRecovered] = useState<Message[]>([]);
  const [error, setError] = useState<string>();
  const [attempt, setAttempt] = useState(0);
  const highest = items.reduce<string | undefined>(
    (value, row) =>
      !value || BigInt(row.sequence) > BigInt(value) ? row.sequence : value,
    undefined,
  );
  useEffect(() => {
    if (!highest) return;
    if (!checkpoint.current) {
      checkpoint.current = highest;
      return;
    }
    const controller = new AbortController();
    void readForwardMessages(
      (path, signal) => request<Message[]>(path, { signal }),
      id,
      checkpoint.current,
      controller.signal,
    )
      .then((rows) => {
        if (controller.signal.aborted) return;
        if (rows.length) {
          checkpoint.current = rows.at(-1)!.sequence;
          setRecovered((previous) => [
            ...new Map(
              [...previous, ...rows].map((row) => [row.id, row]),
            ).values(),
          ]);
        }
        setError(undefined);
      })
      .catch((cause) => {
        if (!controller.signal.aborted)
          setError(
            cause instanceof Error
              ? cause.message
              : "Chưa khôi phục đủ tin nhắn.",
          );
      });
    return () => controller.abort();
  }, [highest, attempt, id, request]);
  useEffect(() => {
    const resume = () => {
      if (document.visibilityState === "visible")
        setAttempt((value) => value + 1);
    };
    document.addEventListener("visibilitychange", resume);
    return () => document.removeEventListener("visibilitychange", resume);
  }, []);
  return { recovered, error, retry: () => setAttempt((value) => value + 1) };
}
