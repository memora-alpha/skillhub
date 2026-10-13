import { useEffect, useRef, useState } from "react";
import { useRouter } from "expo-router";
import { AppError } from "@/lib/http/errors";
import { useToast } from "@/providers/ToastProvider";
import { useRequestsRuntime } from "../context";
import { useRequestSync, type useRequestDetail } from "./use-requests";
import { isOwnRequest } from "../utils/request-policy";
import { requestPreflight } from "../utils/request-preflight";
import { mutationNeedsReconcile } from "../utils/request-recovery";

export function useRequestAction(query: ReturnType<typeof useRequestDetail>) {
  const { api, isCurrent } = useRequestsRuntime();
  const sync = useRequestSync(),
    router = useRouter(),
    { showToast } = useToast();
  const busy = useRef(false),
    sequence = useRef(0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>();
  const [blocked, setBlocked] = useState(false);
  const [editReady, setEditReady] = useState<{
    id: string;
    current: () => boolean;
  }>();
  useEffect(() => {
    sequence.current++;
    busy.current = false;
    setPending(false);
    setBlocked(false);
    setError(undefined);
    setEditReady(undefined);
  }, [api]);
  useEffect(() => {
    if (editReady && !pending && editReady.current()) {
      router.navigate(`/requests/${editReady.id}/edit`);
      setEditReady(undefined);
    }
  }, [editReady, pending, router]);
  const read = async () => {
    const result = await query.refetch({
      cancelRefetch: false,
      throwOnError: true,
    });
    if (!result.data) throw new AppError("protocol");
    return result.data;
  };
  async function run(command: "edit" | "publish" | "cancel") {
    const request = query.data;
    if (
      !request ||
      !isOwnRequest(request) ||
      busy.current ||
      blocked ||
      query.readDenied ||
      query.isFetching ||
      !isCurrent()
    )
      return;
    const ticket = ++sequence.current;
    busy.current = true;
    setPending(true);
    setError(undefined);
    let sending = false;
    try {
      const prepared = await requestPreflight(
        request,
        command,
        read,
        isCurrent,
      );
      if (!isCurrent()) return;
      if (
        prepared.kind === "readonly" ||
        (command !== "edit" && prepared.kind === "changed")
      ) {
        setError(new AppError("http", 409));
        setBlocked(true);
        return;
      }
      if (command === "edit") {
        setEditReady({ id: prepared.request.id, current: isCurrent });
        return;
      }
      sending = true;
      const result = await api.action(
        request.id,
        command,
        prepared.request.version,
      );
      if (!isCurrent()) return;
      let message = "Yêu cầu đang chờ duyệt.";
      if (command === "cancel") message = "Đã hủy yêu cầu.";
      else if (result.status === "OPEN") message = "Yêu cầu đã được đăng.";
      showToast(message, "success");
      void sync(result);
    } catch (error_) {
      if (!isCurrent()) return;
      setError(error_);
      setBlocked(!sending || mutationNeedsReconcile(error_));
    } finally {
      if (ticket === sequence.current) {
        busy.current = false;
        if (isCurrent()) setPending(false);
      }
    }
  }
  async function refresh() {
    if (busy.current || !query.valid || !isCurrent()) return;
    const ticket = ++sequence.current;
    busy.current = true;
    setPending(true);
    try {
      await read();
      if (isCurrent()) {
        setError(undefined);
        setBlocked(false);
      }
    } catch (error_) {
      if (isCurrent()) setError(error_);
    } finally {
      if (ticket === sequence.current) {
        busy.current = false;
        if (isCurrent()) setPending(false);
      }
    }
  }
  return { pending, error, blocked, run, refresh };
}
