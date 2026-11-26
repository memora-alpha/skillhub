"use client";
import { useEffect } from "react";
import { useUserResource } from "../hooks/use-user-resource";
import { Feedback } from "../components/common";
import { LoadingSkeleton } from "@/components/loading-skeleton";

const terminalStates = [
  "READY",
  "REJECTED",
  "DELETED",
  "FAILED",
  "SCAN_FAILED",
  "UPLOAD_FAILED",
  "CLEANUP_PENDING",
];

export function ReportEvidence({
  id,
  onState,
  onRemove,
  disabled,
}: Readonly<{
  id: string;
  onState: (id: string, state: string) => void;
  onRemove: () => void;
  disabled: boolean;
}>) {
  const query = useUserResource<{
    fileId: string;
    state: string;
    moderationStatus?: string;
  }>("reports/evidence-files/" + id, {
    refetchInterval: (file) =>
      file &&
      !terminalStates.includes(file.state) &&
      !["REVIEW_REQUIRED", "FAILED"].includes(file.moderationStatus ?? "")
        ? 5000
        : false,
  });
  const needsReview =
    query.data?.fileId === id &&
    query.data.moderationStatus === "REVIEW_REQUIRED";
  const state =
    query.data?.fileId === id
      ? needsReview
        ? "REVIEW_REQUIRED"
        : query.data.state
      : undefined;
  let stateLabel = "Chưa có kết quả kiểm tra tệp";
  if (state === "READY") stateLabel = "Sẵn sàng gửi";
  else if (state === "REVIEW_REQUIRED")
    stateLabel = "Tệp cần kiểm duyệt thêm trước khi gửi";
  else if (state === "REJECTED") stateLabel = "Tệp bị từ chối, hãy bỏ tệp này";
  else if (
    state === "FAILED" ||
    state === "SCAN_FAILED" ||
    state === "UPLOAD_FAILED"
  )
    stateLabel = "Kiểm tra tệp không thành công, hãy bỏ tệp và thử lại";
  else if (state === "DELETED" || state === "CLEANUP_PENDING")
    stateLabel = "Tệp đã bị xóa";
  const processing =
    !query.error &&
    (!state ||
      (!terminalStates.includes(state) && state !== "REVIEW_REQUIRED"));
  useEffect(() => {
    if (state) onState(id, state);
  }, [id, state, onState]);
  return (
    <div>
      <p>
        Bằng chứng {id.slice(0, 8)} ·{" "}
        {processing ? (
          <LoadingSkeleton variant="inline" label="Đang kiểm tra tệp" />
        ) : (
          stateLabel
        )}
      </p>
      <Feedback error={query.error} reload={query.reload} />
      <button
        type="button"
        className="btn"
        disabled={disabled}
        onClick={onRemove}
      >
        Bỏ khỏi báo cáo
      </button>
    </div>
  );
}
