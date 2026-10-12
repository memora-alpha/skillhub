import { useEffect, useRef, useState } from "react";
import { useRouter } from "expo-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ZodError } from "zod";
import { useToast } from "@/providers/ToastProvider";
import { formValidationOptions } from "@/utils/form-validation";
import {
  requestFormSchema,
  requestDefaults,
  draftToInput,
  type RequestDraft,
} from "../schemas/request-form";
import { useRequestsRuntime } from "../context";
import { useRequestSync } from "./use-requests";
import { requestPatch } from "../utils/request-policy";
import { requestPreflight } from "../utils/request-preflight";
import { useRequestRecovery, type EditorRead } from "./use-request-recovery";
import type { OwnerRequest } from "../types";
export function useRequestForm(incoming?: OwnerRequest, source?: EditorRead) {
  const [initial, setInitial] = useState(incoming);
  const router = useRouter();
  const { api, isCurrent } = useRequestsRuntime();
  const sync = useRequestSync();
  const { showToast } = useToast();
  const saving = useRef(false);
  const [mutating, setPending] = useState(false);
  const [error, setError] = useState<unknown>();
  const [saved, setSaved] = useState<OwnerRequest>();
  const form = useForm<RequestDraft>({
    ...formValidationOptions,
    resolver: zodResolver(requestFormSchema(initial)),
    defaultValues: requestDefaults(initial),
  });
  const recovery = useRequestRecovery(initial, setInitial, form, source);
  const pending = mutating || recovery.reading;
  // Navigate only after rendering the page with its pending navigation guard released.
  useEffect(() => {
    if (saved && !pending && isCurrent()) {
      if (initial && router.canGoBack()) router.back();
      else if (initial) router.replace(`/requests/${saved.id}`);
      else router.replace(`/requests/${saved.id}`);
    }
  }, [saved, pending, isCurrent, initial, router]);
  async function save(draft: RequestDraft) {
    if (saving.current || recovery.blocked || recovery.isReading() || saved)
      return;
    let input;
    try {
      input = draftToInput(draft, initial);
    } catch (failure) {
      if (failure instanceof ZodError) {
        for (const issue of failure.issues)
          form.setError(issue.path[0] as keyof RequestDraft, {
            message: issue.message,
          });
      } else setError(failure);
      return;
    }
    const patch = initial ? requestPatch(initial, input) : undefined;
    if (initial && !patch) {
      showToast("Nội dung chưa thay đổi.");
      return;
    }
    saving.current = true;
    setPending(true);
    setError(undefined);
    try {
      if (initial) {
        let preflight;
        try {
          preflight = await requestPreflight(
            initial,
            "edit",
            recovery.readCurrent,
            isCurrent,
          );
        } catch (failure) {
          recovery.readFailed(failure, true);
          return;
        }
        if (!isCurrent()) return;
        if (preflight.kind !== "ready") {
          recovery.showLatest(preflight.request);
          return;
        }
        // A preflight may take long enough for newly entered slots to pass.
        input = draftToInput(draft, initial);
      }
      const result = initial
        ? await api.edit(initial.id, requestPatch(initial, input)!)
        : await api.create(input);
      if (!isCurrent()) return;
      showToast(initial ? "Đã lưu thay đổi." : "Đã lưu bản nháp.", "success");
      void sync(result);
      setSaved(result);
    } catch (failure) {
      if (!isCurrent()) return;
      if (failure instanceof ZodError) {
        for (const issue of failure.issues)
          form.setError(issue.path[0] as keyof RequestDraft, {
            message: issue.message,
          });
      } else {
        setError(failure);
        recovery.mutationFailed(failure);
      }
    } finally {
      saving.current = false;
      if (isCurrent()) setPending(false);
    }
  }
  return {
    form,
    initial,
    pending,
    error,
    blocked: recovery.blocked,
    save,
    recovery,
    acceptLatest: (keepDraft = true) => {
      if (recovery.acceptLatest(keepDraft)) setError(undefined);
    },
  };
}
