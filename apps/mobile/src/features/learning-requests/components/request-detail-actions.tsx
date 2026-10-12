import { useState } from "react";
import { Button } from "@/components/Button";
import { Copy } from "@/components/feature-page";
import { RequestSection } from "./request-section";
import {
  cancelableRequest,
  editableRequest,
  requestState,
} from "../utils/request-policy";
import type { OwnerRequest } from "../types";

export function RequestDetailActions({
  request,
  pending,
  blocked,
  run,
}: {
  request: OwnerRequest;
  pending: boolean;
  blocked: boolean;
  run: (command: "edit" | "publish" | "cancel") => Promise<void>;
}) {
  const [confirm, setConfirm] = useState(false);
  const disabled = pending || blocked;
  return (
    <>
      {editableRequest(request) && (
        <Button
          variant="paper"
          disabled={disabled}
          onPress={() => void run("edit")}
        >
          Chỉnh sửa yêu cầu
        </Button>
      )}
      {requestState(request) === "DRAFT" && (
        <Button
          variant="craft"
          disabled={disabled}
          onPress={() => void run("publish")}
        >
          {pending ? "Đang xử lý..." : "Đăng yêu cầu học"}
        </Button>
      )}
      {cancelableRequest(request) && (
        <Button
          variant="paper"
          disabled={disabled}
          onPress={() => setConfirm(true)}
        >
          Hủy yêu cầu
        </Button>
      )}
      {confirm && cancelableRequest(request) && (
        <RequestSection title="Hủy yêu cầu này?">
          <Copy>
            Bài sẽ không nhận đề xuất mới. Lịch sử đề xuất được giữ lại.
          </Copy>
          <Button
            variant="craft"
            disabled={disabled}
            onPress={() => void run("cancel")}
          >
            {pending ? "Đang hủy..." : "Xác nhận hủy"}
          </Button>
          <Button
            variant="paper"
            disabled={pending}
            onPress={() => setConfirm(false)}
          >
            Giữ yêu cầu
          </Button>
        </RequestSection>
      )}
    </>
  );
}
