"use client";
import { useEffect } from "react";
import { useUserResource } from "../hooks/use-user-resource";
import { Feedback } from "../components/common";
import { LoadingSkeleton } from "@/components/loading-skeleton";

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
  const query = useUserResource<{ fileId: string; state: string }>(
    "reports/evidence-files/" + id,
    {
      refetchInterval: (file) =>
        file && !["READY", "REJECTED", "DELETED", "FAILED"].includes(file.state)
          ? 5000
          : false,
    },
  );
  const state = query.data?.fileId === id ? query.data.state : undefined;
  let stateLabel = "Chưa có kết quả kiểm tra tệp";
  if (state === "READY") stateLabel = "Sẵn sàng gửi";
  else if (state === "REJECTED") stateLabel = "Tệp bị từ chối, hãy bỏ tệp này";
  else if (state === "FAILED") stateLabel = "Kiểm tra tệp không thành công";
  else if (state === "DELETED") stateLabel = "Tệp đã bị xóa";
  const processing =
    !query.error &&
    (!state || !["READY", "REJECTED", "DELETED", "FAILED"].includes(state));
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
