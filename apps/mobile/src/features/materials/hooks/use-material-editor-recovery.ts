import { useEffect, useRef, useState } from "react";
import { useConnections } from "@/features/connections";
import { AppError } from "@/lib/http/errors";
import type { ApiMaterial } from "../api/material-contracts";
import { canEditMaterial } from "../utils/owner-material-presentation";
import { useMaterialsApi } from "./use-materials";

export function useMaterialEditorRecovery(
  currentMaterial: ApiMaterial | undefined,
  commandError: unknown,
) {
  // Background reads must not silently rebase an unsaved draft.
  const base = useRef(currentMaterial);
  const api = useMaterialsApi();
  const runtime = useConnections();
  const [latest, setLatest] = useState<ApiMaterial>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>();
  const [handled, setHandled] = useState<unknown>();
  const controller = useRef<AbortController | undefined>(undefined);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      controller.current?.abort();
    };
  }, []);
  const conflict =
    !!base.current &&
    commandError !== handled &&
    commandError instanceof AppError &&
    commandError.kind === "http" &&
    commandError.code === "MATERIAL_VERSION_CONFLICT";
  const reload = async () => {
    if (
      !conflict ||
      !mounted.current ||
      controller.current ||
      !runtime.isCurrent()
    )
      return;
    const request = new AbortController();
    controller.current = request;
    setLoading(true);
    setLatest(undefined);
    setError(undefined);
    try {
      const rows = await api.mine(request.signal);
      if (!mounted.current || request.signal.aborted || !runtime.isCurrent())
        return;
      const row = rows.find((item) => item.id === base.current?.id);
      if (!row) throw new AppError("http", 404);
      setLatest(row);
    } catch (failure) {
      if (mounted.current && !request.signal.aborted && runtime.isCurrent())
        setError(failure);
    } finally {
      if (controller.current === request) controller.current = undefined;
      if (mounted.current && runtime.isCurrent()) setLoading(false);
    }
  };
  const adopt = () => {
    if (
      !conflict ||
      !mounted.current ||
      !latest ||
      loading ||
      !canEditMaterial(latest) ||
      !runtime.isCurrent()
    )
      return;
    base.current = latest;
    setHandled(commandError);
    setLatest(undefined);
    setError(undefined);
    return latest;
  };
  return {
    material: base.current,
    conflict,
    latest,
    loading,
    error,
    reload,
    adopt,
    handledError: commandError !== undefined && commandError === handled,
  };
}
