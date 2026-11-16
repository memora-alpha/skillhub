import { AppError } from "@/lib/http/errors";
import { isRejectedCommand } from "@/lib/http/command-intent";
import type { ApiMaterial } from "../api/material-contracts";
import type { createMaterialsApi } from "../api/materials-api";
import {
  canArchiveMaterial,
  canSubmitMaterial,
  materialArchivePresentation,
} from "./owner-material-presentation";

export type OwnerMaterialAction = "submit" | "archive";
type Intent = { id: string; action: OwnerMaterialAction };
export type OwnerActionState = {
  pending?: Intent;
  uncertain?: Intent;
  error?: unknown;
  notice?: string;
};
export function createOwnerMaterialActions(deps: {
  api: Pick<
    ReturnType<typeof createMaterialsApi>,
    "submit" | "archive" | "mine"
  >;
  isCurrent: () => boolean;
  onChange: (state: OwnerActionState) => void;
  onResult: (row: ApiMaterial) => Promise<void>;
  onFailure: () => void;
}) {
  let busy = false;
  let uncertain: Intent | undefined;
  const emit = (state: OwnerActionState) => {
    if (deps.isCurrent()) deps.onChange(state);
  };
  return {
    resetFeedback() {
      if (!busy && !uncertain) emit({});
    },
    async run(action: OwnerMaterialAction, row: ApiMaterial) {
      if (busy || uncertain || !deps.isCurrent()) return;
      if (
        !(action === "submit"
          ? canSubmitMaterial(row)
          : canArchiveMaterial(row))
      )
        return;
      busy = true;
      const intent = { action, id: row.id };
      emit({ pending: intent });
      try {
        const result = await deps.api[action](row.id);
        if (!deps.isCurrent()) return;
        await deps.onResult(result);
        emit({
          notice:
            action === "submit"
              ? "Đã gửi tài liệu để duyệt."
              : materialArchivePresentation(row).notice,
        });
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
        // The owner list is paginated; inspect every page, not just loaded rows.
        const rows = await deps.api.mine();
        if (!deps.isCurrent()) return;
        const current = rows.find((row) => row.id === uncertain?.id);
        if (!current) throw new AppError("protocol");
        await deps.onResult(current);
        if (!deps.isCurrent()) return;
        uncertain = undefined;
        emit({
          notice:
            "Đã cập nhật trạng thái tài liệu. Kiểm tra trước khi thao tác tiếp.",
        });
        return current;
      } catch (error) {
        emit({ error, uncertain });
        if (deps.isCurrent()) deps.onFailure();
      } finally {
        busy = false;
      }
    },
  };
}
