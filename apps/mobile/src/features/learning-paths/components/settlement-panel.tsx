import { useMemo, useState } from "react";
import { Panel, Copy, RouteButton } from "@/components/feature-page";
import { Button } from "@/components/Button";
import {
  useConnections,
  useConnectionQuery,
  useConnectionCommand,
  ConnectionFeedback,
} from "@/features/connections";
import { AppError } from "@/lib/http/errors";
import { createPostLearningApi } from "../api/post-learning-api";
const labels: Record<string, string> = {
  SETTLED: "Đã quyết toán",
  TERMINATED: "Lộ trình đã dừng",
  NOT_LOCKED: "Chưa chốt lộ trình",
  WAITING_SESSIONS: "Chờ hoàn thành các buổi",
  WAITING_TERMINATION: "Chờ xử lý yêu cầu dừng",
  WAITING_DISPUTE: "Chờ xử lý tranh chấp",
  WAITING_DISPUTE_WINDOW: "Đang trong hạn khiếu nại",
  NEEDS_REVIEW: "Cần nhân sự đối soát",
  RETRYING: "Hệ thống đang thử quyết toán lại",
  READY: "Đủ điều kiện kiểm tra quyết toán",
};
export function PathSettlementPanel({
  pathId,
  blocked,
}: Readonly<{ pathId: string; blocked: boolean }>) {
  const runtime = useConnections();
  const api = useMemo(() => createPostLearningApi(runtime.call), [runtime]);
  const query = useConnectionQuery(
    ["learning-paths", pathId, "settlement"],
    (signal) => api.status(pathId, signal),
  );
  const consent = useConnectionCommand([["learning-paths"], ["wallet"]]),
    retry = useConnectionCommand([["learning-paths"], ["wallet"]]);
  const [reviewing, setReviewing] = useState(false);
  const status = query.data;
  const disabled =
    blocked ||
    query.isFetching ||
    !!query.error ||
    consent.pending ||
    consent.uncertain ||
    retry.pending ||
    retry.uncertain;
  return (
    <Panel title="Credit & quyết toán">
      <Copy>
        Hai chiều: mỗi người nhận lại 96% Credit đã giữ của mình. Một chiều:
        người dạy nhận 96% Credit thỏa thuận. Phần còn lại là phí nền tảng.
      </Copy>
      <ConnectionFeedback loading={query.isLoading} error={query.error} />
      {status && (
        <>
          <Copy>{labels[status.status]}</Copy>
          {status.autoSettlementAt && !status.settledAt && (
            <Copy>
              Hạn chờ tự quyết toán:{" "}
              {new Date(status.autoSettlementAt).toLocaleString("vi-VN")}
            </Copy>
          )}
          {status.settledAt && (
            <Copy>
              Quyết toán lúc{" "}
              {new Date(status.settledAt).toLocaleString("vi-VN")}
            </Copy>
          )}
          {status.lastCheckedAt && (
            <Copy muted>
              Kiểm tra lần cuối:{" "}
              {new Date(status.lastCheckedAt).toLocaleString("vi-VN")} ·{" "}
              {status.attemptCount} lần
            </Copy>
          )}
          {status.immediateSettlement.ownApprovedAt && (
            <Copy>
              Bạn đã đồng ý quyết toán sớm.{" "}
              {status.immediateSettlement.partnerApprovedAt
                ? "Đối tác cũng đã đồng ý."
                : "Đang chờ đối tác hoặc hết thời hạn."}
            </Copy>
          )}
          {status.immediateSettlement.canApprove && !consent.uncertain && (
            <>
              <Copy>
                Xác nhận học xong không thay cho đồng ý quyết toán. Hai bên có
                thể chọn quyết toán ngay thay vì chờ hết hạn khiếu nại. Báo cáo
                sau quyết toán không tự đảo giao dịch Credit.
              </Copy>
              {!reviewing ? (
                <Button disabled={disabled} onPress={() => setReviewing(true)}>
                  Xem và đồng ý quyết toán sớm
                </Button>
              ) : (
                <>
                  <Button
                    disabled={disabled}
                    onPress={() =>
                      void consent
                        .run(
                          `consent:${pathId}:${status.pathVersion}`,
                          async () => {
                            const fresh = await api.status(pathId);
                            if (
                              !fresh.immediateSettlement.canApprove ||
                              fresh.pathVersion !== status.pathVersion ||
                              !fresh.pathVersion
                            )
                              throw new AppError(
                                "http",
                                409,
                                "SETTLEMENT_STATE_CHANGED",
                              );
                            return api.consent(pathId, fresh.pathVersion);
                          },
                        )
                        .then((result) => {
                          if (result) setReviewing(false);
                          void query.refetch();
                        })
                    }
                  >
                    Tôi đồng ý quyết toán ngay
                  </Button>
                  <Button
                    variant="paper"
                    disabled={disabled}
                    onPress={() => setReviewing(false)}
                  >
                    Tiếp tục chờ theo hạn
                  </Button>
                </>
              )}
            </>
          )}
          {status.status === "NEEDS_REVIEW" && (
            <Copy>Liên hệ nhân sự kèm mã lộ trình để đối soát: {pathId}</Copy>
          )}
          {status.retryable && (
            <Button
              variant="paper"
              disabled={disabled}
              onPress={() =>
                void retry
                  .run(`settlement:${pathId}`, () =>
                    api.retrySettlement(pathId),
                  )
                  .then(() => void query.refetch())
              }
            >
              Yêu cầu kiểm tra quyết toán
            </Button>
          )}
        </>
      )}
      <ConnectionFeedback error={consent.error} />
      <ConnectionFeedback error={retry.error} />
      {(consent.uncertain || retry.uncertain) && (
        <Copy>
          Kết quả chưa rõ. Tải lại trạng thái để xem máy chủ đã ghi nhận trước
          khi thao tác tiếp.
        </Copy>
      )}
      <Button
        variant="paper"
        disabled={query.isFetching || consent.pending || retry.pending}
        onPress={() => void query.refetch()}
      >
        Tải lại trạng thái
      </Button>
      <RouteButton href="/wallet/history">Xem ví & lịch sử Credit</RouteButton>
    </Panel>
  );
}
