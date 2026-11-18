import { AppError } from "@/lib/http/errors";
import { isRejectedCommand } from "@/lib/http/command-intent";
import type { ApiMaterial } from "../api/material-contracts";
import type { createMaterialsApi } from "../api/materials-api";
import {
  canArchiveMaterial,
  canSubmitMaterial,
  canDeleteMaterial,
  canWithdrawMaterial,
  materialArchivePresentation,
} from "./owner-material-presentation";

export type OwnerMaterialAction = "submit" | "archive" | "delete" | "withdraw";
type Intent = { id: string; action: OwnerMaterialAction; version: number };
export type OwnerActionState = {
  pending?: Intent;
  uncertain?: Intent;
  error?: unknown;
};
export function createOwnerMaterialActions(deps: {
  api: Pick<
    ReturnType<typeof createMaterialsApi>,
    "submit" | "archive" | "ownerDetail" | "remove" | "withdraw"
  >;
  isCurrent: () => boolean;
  onChange: (state: OwnerActionState) => void;
  onResult: (row: ApiMaterial) => Promise<void>;
  onDeleted: (id: string) => Promise<void>;
  onFailure: () => void;
  onNotice?: (message: string, tone: "success" | "info") => void;
}) {
  let busy = false;
  let uncertain: Intent | undefined;
  const emit = (state: OwnerActionState) => {
    if (deps.isCurrent()) deps.onChange(state);
  };
  const notify = (
    message: string | undefined,
    tone: "success" | "info" = "success",
  ) => {
    if (message && deps.isCurrent()) deps.onNotice?.(message, tone);
  };
  const remove = async (intent: Intent) => {
    const receipt = await deps.api.remove(intent.id, intent.version);
    if (deps.isCurrent()) await deps.onDeleted(receipt.id);
    return receipt;
  };
  return {
    resetFeedback() {
      if (!busy && !uncertain) emit({});
    },
    async run(action: OwnerMaterialAction, row: ApiMaterial) {
      if (busy || uncertain || !deps.isCurrent()) return;
      if (
        !(action === "delete"
          ? canDeleteMaterial(row)
          : action === "submit"
            ? canSubmitMaterial(row)
            : action === "withdraw"
              ? canWithdrawMaterial(row)
              : canArchiveMaterial(row))
      )
        return;
      busy = true;
      const intent = { action, id: row.id, version: row.listingVersion };
      emit({ pending: intent });
      try {
        const result =
          action === "delete"
            ? await remove(intent)
            : action === "withdraw"
              ? await deps.api.withdraw(row.id, intent.version)
              : await deps.api[action](row.id, intent.version);
        if (!deps.isCurrent()) return;
        if ("status" in result) await deps.onResult(result);
        emit({});
        if (action !== "delete")
          notify(
            action === "submit"
              ? "Đã gửi tài liệu để duyệt."
              : action === "withdraw"
                ? "Đã rút yêu cầu duyệt."
                : materialArchivePresentation(row)?.notice,
          );
        return result;
      } catch (error) {
        if (!deps.isCurrent()) return;
        if (!isRejectedCommand(error)) uncertain = intent;
        emit({ error, uncertain });
        deps.onFailure();
      } finally {
        busy = false;
      }
    },
    async reconcile() {
      if (busy || !uncertain || !deps.isCurrent()) return;
      busy = true;
      emit({ pending: uncertain, uncertain });
      try {
        // DELETE is replay-safe; retry the exact version only after an explicit action.
        if (uncertain.action === "delete") {
          const receipt = await remove(uncertain);
          if (!deps.isCurrent()) return;
          uncertain = undefined;
          emit({});
          return receipt;
        }
        // Read the owned target directly, including archived listings.
        const current = await deps.api.ownerDetail(uncertain.id);
        if (!deps.isCurrent()) return;
        if (!current) throw new AppError("protocol");
        await deps.onResult(current);
        if (!deps.isCurrent()) return;
        uncertain = undefined;
        emit({});
        notify(
          "Đã cập nhật trạng thái tài liệu. Kiểm tra trước khi thao tác tiếp.",
          "info",
        );
        return current;
      } catch (error) {
        if (uncertain?.action === "delete" && isRejectedCommand(error))
          uncertain = undefined;
        emit({ error, uncertain });
        if (deps.isCurrent()) deps.onFailure();
      } finally {
        busy = false;
      }
    },
  };
}
