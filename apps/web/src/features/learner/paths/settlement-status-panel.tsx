"use client";
import { useState } from "react";
import Link from "next/link";
import { useUserSession } from "../auth/session";
import { useUserResource } from "../hooks/use-user-resource";
import { useUserCommand } from "../hooks/use-user-command";
import {
  CommandFeedback,
  Feedback,
  Panel,
  formatTime,
} from "../components/common";
import { UserApiError, userErrorText } from "../api/client";
import {
  readSettlementStatus,
  readConsentReceipt,
  settlementStatusLabels,
  type SettlementStatus,
} from "./post-session-contract";

export function SettlementStatusPanel({
  pathId,
}: Readonly<{ pathId: string }>) {
  const query = useUserResource<SettlementStatus>(
    "learning-paths/" + pathId + "/settlement-status",
    {
      refetchInterval: (s) =>
        s && ["RETRYING", "READY"].includes(s.status) ? 15000 : false,
    },
  );
  const { request } = useUserSession();
  const consent = useUserCommand();
  const retry = useUserCommand();
  const [reviewing, setReviewing] = useState(false);
  const [notice, setNotice] = useState<string>();
  let status: SettlementStatus | undefined;
  let contractError: string | undefined;
  if (query.data) {
    try {
      status = readSettlementStatus(query.data, pathId);
    } catch {
      contractError =
        "Máy chủ chưa trả đủ thông tin quyết toán mới. Tải lại hoặc liên hệ hỗ trợ.";
    }
  }
  async function approve() {
    if (!status || !reviewing) return;
    const version = status.pathVersion;
    const result = await consent.run(
      "consent:" + pathId + ":" + version,
      async () => {
        const fresh = readSettlementStatus(
          (await request("learning-paths/" + pathId + "/settlement-status"))
            .data,
          pathId,
        );
        if (
          !fresh.immediateSettlement.canApprove ||
          fresh.pathVersion !== version ||
          !version
        )
          throw new UserApiError(409, "SETTLEMENT_STATE_CHANGED");
        return readConsentReceipt(
          (
            await request("sessions/paths/" + pathId + "/settlement-consent", {
              method: "POST",
              body: { expectedVersion: version },
            })
          ).data,
          pathId,
        );
      },
    );
    if (result) {
      setReviewing(false);
      setNotice(
        "Đã ghi nhận ý kiến của bạn. Kết quả quyết toán được tải lại từ máy chủ.",
      );
    }
    query.reload();
  }
  return (
    <Panel title="Hoàn Credit & quyết toán">
      <p>
        Trao đổi hai chiều: mỗi người nhận lại 96% Credit đã giữ của mình. Học
        một chiều: người dạy nhận 96% Credit thỏa thuận. Phần còn lại là phí nền
        tảng.
      </p>
      <Feedback
        loading={query.loading}
        error={query.error ?? contractError}
        reload={query.reload}
      />
      {status && (
        <>
          <p>
            <output>
              {settlementStatusLabels[status.status] ??
                "Kiểm tra trạng thái quyết toán"}
            </output>
          </p>
          {status.reasonCode && <p>{userErrorText(409, status.reasonCode)}</p>}
          {status.autoSettlementAt && !status.settledAt && (
            <p>Hạn chờ tự quyết toán: {formatTime(status.autoSettlementAt)}</p>
          )}
          {status.settledAt && (
            <p>Đã quyết toán lúc {formatTime(status.settledAt)}</p>
          )}
          {status.lastCheckedAt && (
            <p className="muted">
              Kiểm tra lần cuối: {formatTime(status.lastCheckedAt)} ·{" "}
              {status.attemptCount} lần
            </p>
          )}
          {status.immediateSettlement.ownApprovedAt && (
            <p>
              Bạn đã đồng ý quyết toán sớm.{" "}
              {status.immediateSettlement.partnerApprovedAt
                ? "Đối tác cũng đã đồng ý."
                : "Đang chờ ý kiến đối tác hoặc hết thời hạn."}
            </p>
          )}
          {status.immediateSettlement.canApprove && !consent.uncertain && (
            <>
              <p>
                Hoàn thành buổi học không đồng nghĩa với đồng ý quyết toán tiền.
                Hai bên có thể chọn quyết toán ngay thay vì chờ hết hạn khiếu
                nại. Sau quyết toán, báo cáo không tự đảo giao dịch Credit.
              </p>
              {!reviewing ? (
                <button
                  type="button"
                  className="btn"
                  onClick={() => setReviewing(true)}
                >
                  Xem và đồng ý quyết toán sớm
                </button>
              ) : (
                <div className="learner-actions">
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={consent.pending || query.loading || !!query.error}
                    onClick={() => void approve()}
                  >
                    Tôi đồng ý quyết toán ngay
                  </button>
                  <button
                    type="button"
                    className="btn"
                    disabled={consent.pending}
                    onClick={() => setReviewing(false)}
                  >
                    Tiếp tục chờ theo hạn
                  </button>
                </div>
              )}
            </>
          )}
          {status.status === "NEEDS_REVIEW" && (
            <p>
              Cần nhân sự đối soát. Gửi mã lộ trình khi liên hệ hỗ trợ: {pathId}
            </p>
          )}
          {status.retryable && (
            <button
              type="button"
              className="btn"
              disabled={
                retry.pending ||
                retry.uncertain ||
                query.loading ||
                !!query.error
              }
              onClick={() =>
                void retry
                  .run("settlement:" + pathId, () =>
                    request("sessions/paths/" + pathId + "/settlement", {
                      method: "POST",
                    }),
                  )
                  .then(() => query.reload())
              }
            >
              Yêu cầu kiểm tra quyết toán
            </button>
          )}
        </>
      )}
      {notice && (
        <p>
          <output>{notice}</output>
        </p>
      )}
      <CommandFeedback command={consent} />
      <CommandFeedback command={retry} />
      {(consent.uncertain || retry.uncertain) && (
        <p>
          Kết quả chưa rõ. Tải lại trạng thái để xem máy chủ đã ghi nhận; không
          cần đồng ý hoặc gửi lại ngay.
        </p>
      )}
      <div className="learner-actions">
        <button
          type="button"
          className="btn"
          disabled={query.loading}
          onClick={query.reload}
        >
          Tải lại trạng thái
        </button>
        <Link className="btn" href="/learn/wallet">
          Xem ví & lịch sử Credit
        </Link>
      </div>
    </Panel>
  );
}
