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
      setNotice("Đã ghi nhận đồng ý quyết toán sớm.");
    }
    query.reload();
  }
  return (
    <Panel title="Hoàn Credit & quyết toán">
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
              {!reviewing ? (
                <button
                  type="button"
                  className="btn"
                  onClick={() => setReviewing(true)}
                >
                  Quyết toán sớm
                </button>
              ) : (
                <div>
                  <p>
                    Quyết toán ngay sẽ kết thúc thời gian chờ khiếu nại. Báo cáo
                    sau đó không tự hoàn Credit.
                  </p>
                  <div className="learner-actions">
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={
                        consent.pending || query.loading || !!query.error
                      }
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
          Làm mới
        </button>
        <Link className="btn" href="/learn/wallet">
          Xem ví
        </Link>
      </div>
    </Panel>
  );
}
