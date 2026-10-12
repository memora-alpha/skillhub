import { useEffect, useRef, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { AppError } from "@/lib/http/errors";
import { useRequestsRuntime } from "../context";
import { requestDefaults, type RequestDraft } from "../schemas/request-form";
import type { OwnerRequest, PublicRequestDetail } from "../types";
import { editableRequest, isOwnRequest } from "../utils/request-policy";
import { needsExpiryRead } from "../utils/request-preflight";
import {
  mutationNeedsReconcile,
  rebaseRequestDraft,
} from "../utils/request-recovery";
import { RequestReadGuard, type ReadDenial } from "../utils/request-read";

export type EditorRead = {
  data?: OwnerRequest | PublicRequestDetail;
  error?: unknown;
  readDenied?: ReadDenial;
  isFetching: boolean;
  dataUpdatedAt: number;
  read: () => Promise<OwnerRequest | PublicRequestDetail>;
};
export function useRequestRecovery(
  initial: OwnerRequest | undefined,
  setInitial: (request: OwnerRequest) => void,
  form: UseFormReturn<RequestDraft>,
  source?: EditorRead,
) {
  const { api, isCurrent } = useRequestsRuntime();
  const [latest, setLatest] = useState<OwnerRequest>();
  const [mode, setMode] = useState<
    "compare" | "unknown" | "readonly" | "expiry" | "denied"
  >();
  const [error, setError] = useState<unknown>();
  const [denied, setDenied] = useState<ReadDenial>();
  const [reading, setReading] = useState(false);
  const busy = useRef(false);
  const access = useRef(new RequestReadGuard());
  const readCurrent = async () => {
    if (!initial) throw new AppError("protocol");
    const result = await access.current.read(
      () => (source ? source.read() : api.detail(initial.id)),
      isCurrent,
    );
    if (!isOwnRequest(result)) throw new AppError("http", 403);
    if (result.id !== initial.id) throw new AppError("protocol");
    return result;
  };
  function showLatest(request: OwnerRequest, compare = true) {
    if (!isCurrent() || !initial || request.id !== initial.id) return;
    setLatest(request);
    setDenied(undefined);
    setError(undefined);
    setMode(
      !editableRequest(request)
        ? "readonly"
        : compare ||
            request.version !== initial.version ||
            request.publishedAt !== initial.publishedAt
          ? "compare"
          : undefined,
    );
  }
  function readFailed(failure: unknown, expiry = false) {
    if (!isCurrent()) return;
    access.current.fail(failure);
    setDenied(access.current.denial);
    setError(failure);
    setLatest(undefined);
    setMode((current) =>
      access.current.denial
        ? "denied"
        : (current ?? (expiry ? "expiry" : "compare")),
    );
  }
  async function loadLatest(compare = true) {
    if (!initial || busy.current || !isCurrent()) return;
    busy.current = true;
    setReading(true);
    try {
      showLatest(await readCurrent(), compare);
    } catch (failure) {
      readFailed(failure, !compare);
    } finally {
      busy.current = false;
      if (isCurrent()) setReading(false);
    }
  }
  function mutationFailed(failure: unknown) {
    if (mutationNeedsReconcile(failure)) {
      setMode(
        failure instanceof AppError && failure.status === 409
          ? "compare"
          : "unknown",
      );
      setLatest(undefined);
    }
  }
  function acceptLatest(keepDraft = true) {
    if (
      !initial ||
      !latest ||
      denied ||
      reading ||
      !isCurrent() ||
      !editableRequest(latest)
    )
      return false;
    const draft = keepDraft
      ? rebaseRequestDraft(initial, form.getValues(), latest)
      : requestDefaults(latest);
    setInitial(latest);
    form.reset(draft, { keepErrors: keepDraft });
    setMode(undefined);
    setLatest(undefined);
    setError(undefined);
    return true;
  }
  useEffect(() => {
    if (!initial || !source || !isCurrent()) return;
    if (source.readDenied) {
      access.current.denial = source.readDenied;
      setDenied(source.readDenied);
      setMode("denied");
      setLatest(undefined);
    } else if (source.error) setError(source.error);
    else if (source.data && !source.isFetching) {
      if (!isOwnRequest(source.data)) readFailed(new AppError("http", 403));
      else if (
        source.data.version !== initial.version ||
        !editableRequest(source.data) ||
        access.current.denial
      )
        showLatest(source.data);
    }
    // Only a new query result may update read authority; changing draft/mode
    // must not replay an older query error or automatically accept its version.
  }, [
    source?.data,
    source?.error,
    source?.readDenied,
    source?.dataUpdatedAt,
    source?.isFetching,
    initial?.id,
    initial?.version,
    isCurrent,
  ]);
  useEffect(() => {
    if (initial && needsExpiryRead(initial)) void loadLatest(false);
    // One entry preflight per mounted request. Submit independently checks time.
  }, [initial?.id]);
  const sourceChanged =
    !!initial &&
    !!source?.data &&
    (!isOwnRequest(source.data) ||
      !editableRequest(source.data) ||
      source.data.version !== initial.version);
  const hidden =
    source?.readDenied ??
    (source?.data && !isOwnRequest(source.data) ? "forbidden" : undefined) ??
    denied;
  return {
    latest,
    mode,
    error,
    denied: hidden,
    reading,
    blocked: !!mode || !!hidden || sourceChanged,
    isReading: () => busy.current,
    readCurrent,
    showLatest,
    readFailed,
    mutationFailed,
    loadLatest,
    acceptLatest,
  };
}
