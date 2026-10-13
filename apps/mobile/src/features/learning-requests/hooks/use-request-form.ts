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
import type { OwnerRequest, RequestInput } from "../types";
export function useRequestForm(incoming?: OwnerRequest, source?: EditorRead) {
  const [initial, setInitial] = useState(incoming);
  const router = useRouter();
  const { api, isCurrent } = useRequestsRuntime();
  const sync = useRequestSync();
  const { showToast } = useToast();
  const saving = useRef(false);
  const [mutating, setMutating] = useState(false);
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
      else router.replace(`/requests/${saved.id}`);
    }
  }, [saved, pending, isCurrent, initial, router]);
  function reportError(error_: unknown, mutation = false) {
    if (error_ instanceof ZodError) {
      for (const issue of error_.issues)
        form.setError(issue.path[0] as keyof RequestDraft, {
          message: issue.message,
        });
      return;
    }
    setError(error_);
    if (mutation) recovery.mutationFailed(error_);
  }
  function prepareInput(draft: RequestDraft) {
    try {
      return draftToInput(draft, initial);
    } catch (error_) {
      reportError(error_);
      return undefined;
    }
  }
  async function prepareEdit(draft: RequestDraft) {
    if (!initial) return undefined;
    let preflight;
    try {
      preflight = await requestPreflight(
        initial,
        "edit",
        recovery.readCurrent,
        isCurrent,
      );
    } catch (error_) {
      recovery.readFailed(error_, true);
      return undefined;
    }
    if (!isCurrent()) return undefined;
    if (preflight.kind !== "ready") {
      recovery.showLatest(preflight.request);
      return undefined;
    }
    // A preflight may take long enough for newly entered slots to pass.
    return draftToInput(draft, initial);
  }
  async function persist(input: RequestInput) {
    if (initial) return api.edit(initial.id, requestPatch(initial, input)!);
    return api.create(input);
  }
  async function save(draft: RequestDraft) {
    if (saving.current || recovery.blocked || recovery.isReading() || saved)
      return;
    let input = prepareInput(draft);
    if (!input) return;
    if (initial && !requestPatch(initial, input)) {
      showToast("Nội dung chưa thay đổi.");
      return;
    }
    saving.current = true;
    setMutating(true);
    setError(undefined);
    try {
      if (initial) {
        const prepared = await prepareEdit(draft);
        if (!prepared) return;
        input = prepared;
      }
      const result = await persist(input);
      if (!isCurrent()) return;
      showToast(initial ? "Đã lưu thay đổi." : "Đã lưu bản nháp.", "success");
      void sync(result);
      setSaved(result);
    } catch (error_) {
      if (!isCurrent()) return;
      reportError(error_, true);
    } finally {
      saving.current = false;
      if (isCurrent()) setMutating(false);
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
