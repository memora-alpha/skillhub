import { useCallback, useRef, useState } from "react";
import { BackHandler } from "react-native";
import { useFocusEffect } from "expo-router";
import { randomUUID } from "expo-crypto";
import { useToast } from "@/providers/ToastProvider";
import { useSkills } from "../context/SkillsProvider";
import { createMutationIntent } from "../utils/mutation-intent";
import { skillError } from "../utils/skill-errors";

export function useSkillAction({ notifySuccess = true } = {}) {
  const { isCurrent, refresh } = useSkills();
  const { showToast } = useToast();
  const focused = useRef(false);
  const lock = useRef(false);
  const intent = useRef(createMutationIntent(randomUUID));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);
  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      if (!lock.current) setPending(false);
      const back = BackHandler.addEventListener(
        "hardwareBackPress",
        () => lock.current,
      );
      return () => {
        focused.current = false;
        back.remove();
      };
    }, []),
  );
  const current = () => focused.current && isCurrent();
  function notifySaved(refreshed: boolean, successMessage?: string) {
    if (!notifySuccess) return;
    const message = refreshed
      ? (successMessage ?? "Đã lưu thay đổi.")
      : `${successMessage ?? "Đã lưu."} Chưa cập nhật được toàn bộ dữ liệu; hãy tải lại.`;
    showToast(message, refreshed ? "success" : "info");
  }
  async function run<T>(
    operation: string,
    body: unknown,
    execute: (key: string) => Promise<T>,
    done?: (result: T, refreshed: boolean) => void,
    refreshAfter = true,
    successMessage?: string,
  ) {
    if (lock.current || !current()) return;
    lock.current = true;
    setPending(true);
    setError(null);
    try {
      const result = await execute(intent.current.key(operation, body));
      if (!current()) return;
      // The write committed. Refresh errors must never turn it into a failed write.
      const refreshed = refreshAfter ? await refresh() : true;
      if (!current()) return;
      intent.current.clear();
      if (refreshAfter) notifySaved(refreshed, successMessage);
      done?.(result, refreshed);
      return result;
    } catch (failure) {
      if (current()) {
        setError(failure);
        showToast(skillError(failure, refreshAfter), "error");
      }
    } finally {
      lock.current = false;
      if (current()) setPending(false);
    }
  }
  return {
    run,
    pending,
    error,
    current,
    locked: () => lock.current,
    clearError: () => setError(null),
  };
}
