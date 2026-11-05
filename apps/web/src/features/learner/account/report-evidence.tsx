"use client";
import { useEffect } from "react";
import { useUserResource } from "../hooks/use-user-resource";
import { Feedback } from "../components/common";

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
  useEffect(() => {
    if (state) onState(id, state);
  }, [id, state, onState]);
  return (
    <div>
      <p>
        Bằng chứng {id.slice(0, 8)} ·{" "}
        {state === "READY"
          ? "Sẵn sàng gửi"
          : state === "REJECTED"
            ? "Tệp bị từ chối, hãy bỏ tệp này"
            : "Đang kiểm tra tệp"}
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
