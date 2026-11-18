import { useEffect, useRef, useState } from "react";
import { useConnections } from "@/features/connections";
import { uuid } from "@/lib/http/contracts";
import { useToast } from "@/providers/ToastProvider";
import { useMaterialsApi } from "./use-materials";
import {
  prepareMaterialDownload,
  type MaterialDownloadTarget,
} from "../utils/save-material-file";

export function useMaterialDownload(id: string, onIssued?: () => void) {
  const runtime = useConnections();
  const api = useMaterialsApi();
  const { showToast } = useToast();
  const flight = useRef(false);
  const alive = useRef(true);
  const controller = useRef<AbortController | undefined>(undefined);
  const waiting = useRef<{ target: MaterialDownloadTarget } | undefined>(
    undefined,
  );
  const [pending, setPending] = useState(false);
  const [confirmation, setConfirmation] = useState<{
    target: MaterialDownloadTarget;
  }>();
  const [error, setError] = useState<unknown>();
  const current = () => alive.current && runtime.isCurrent();
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      controller.current?.abort();
    };
  }, []);
  const execute = async (target: MaterialDownloadTarget) => {
    const abort = new AbortController();
    controller.current = abort;
    try {
      const file = await api.download(id, abort.signal);
      if (!current()) return;
      onIssued?.();
      await target(file.url, abort.signal);
      if (current()) showToast("Đã gửi tệp đến nơi lưu bạn chọn.", "success");
    } catch (cause) {
      if (current() && !abort.signal.aborted) setError(cause);
    }
  };
  const start = async (purchased: boolean) => {
    if (
      flight.current ||
      waiting.current ||
      !current() ||
      !uuid.safeParse(id).success
    )
      return;
    flight.current = true;
    setPending(true);
    setError(undefined);
    try {
      const target = await prepareMaterialDownload();
      if (!target || !current()) return;
      if (purchased) {
        waiting.current = { target };
        setConfirmation(waiting.current);
      } else await execute(target);
    } catch (cause) {
      if (current()) setError(cause);
    } finally {
      flight.current = false;
      if (current()) setPending(false);
    }
  };
  const confirm = async () => {
    if (!waiting.current || flight.current || !current()) return;
    flight.current = true;
    setPending(true);
    const { target } = waiting.current;
    waiting.current = undefined;
    setConfirmation(undefined);
    try {
      await execute(target);
    } finally {
      flight.current = false;
      if (current()) setPending(false);
    }
  };
  return {
    pending,
    error,
    awaitingConfirmation: !!confirmation,
    start,
    confirm,
    cancel: () => {
      if (!flight.current) {
        waiting.current = undefined;
        setConfirmation(undefined);
      }
    },
  };
}
