"use client";
import styles from "../components/learning-layout.module.css";
import { ProductIcon } from "../components/product-icon";
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
  settlementConsentMessage,
  watchSettlement,
} from "./settlement-presentation";
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
      refetchInterval: (s) => (s && watchSettlement(s.status) ? 15000 : false),
    },
  );
  const { request } = useUserSession();
  const consent = useUserCommand();
  const retry = useUserCommand();
  const [reviewing, setReviewing] = useState(false);
  const [notice, setNotice] = useState<string>();
  const [checking, setChecking] = useState(false);
  const [readError, setReadError] = useState<string>();
  async function reconcile() {
    if (checking || consent.pending || retry.pending) return;
    setChecking(true);
    setReadError(undefined);
    try {
      const fresh = readSettlementStatus(
        (await request("learning-paths/" + pathId + "/settlement-status")).data,
        pathId,
      );
      consent.resetAfterRead();
      retry.resetAfterRead();
      setReviewing(false);
      function reconciliationNotice() {
        if (fresh.settledAt) {
          return "Thỏa thuận đã được quyết toán.";
        }
        if (fresh.immediateSettlement.ownApprovedAt) {
          return "Máy chủ đã ghi nhận ý kiến của bạn.";
        }
        return "Đã cập nhật trạng thái. Bạn có thể tiếp tục các thao tác được phép bên dưới.";
      }
      setNotice(reconciliationNotice());
      query.reload();
    } catch (cause) {
      setReadError(
        cause instanceof Error
          ? cause.message
          : "Chưa kiểm tra được trạng thái.",
      );
    } finally {
      setChecking(false);
    }
  }
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
        "Đã ghi nhận đồng ý giải ngân. Máy chủ tự xử lý khi đủ ý kiến hai bên và đủ điều kiện.",
      );
    }
    query.reload();
  }
  function refreshLabel() {
    if (checking) {
      return "Đang kiểm tra…";
    }
    if (consent.uncertain || retry.uncertain) {
      return "Kiểm tra lại kết quả";
    }
    return "Cập nhật trạng thái";
  }
  return (
    <Panel title="Quyết toán Credit" className={styles.settlement}>
      <div className={styles.settlementVisual}>
        <ProductIcon name="wallet" size={34} />
        <span>Theo dõi hoàn Credit & giải ngân</span>
      </div>
      <p>
        Hệ thống tự quyết toán khi toàn bộ thỏa thuận đủ điều kiện. Hai bên có
        thể đồng ý giải ngân sớm; xác nhận hoàn thành buổi học là bước riêng.
      </p>
      <Feedback
        loading={query.loading}
        error={readError ?? query.error ?? contractError}
        reload={() => void reconcile()}
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
          {settlementConsentMessage(status) && (
            <p>
              <output>{settlementConsentMessage(status)}</output>
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
                  Đồng ý giải ngân
                </button>
              ) : (
                <div>
                  <p>
                    Giải ngân ngay sẽ kết thúc thời gian chờ khiếu nại. Báo cáo
                    sau đó không tự hoàn Credit.
                  </p>
                  <div className="learner-actions">
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={
                        checking ||
                        consent.pending ||
                        query.loading ||
                        !!query.error
                      }
                      onClick={() => void approve()}
                    >
                      Tôi đồng ý giải ngân ngay
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
          {status.retryable && status.status === "RETRYING" && (
            <button
              type="button"
              className="btn"
              disabled={
                retry.pending ||
                checking ||
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
              Thử lại quyết toán
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
          disabled={
            checking || query.loading || consent.pending || retry.pending
          }
          onClick={() => void reconcile()}
        >
          {refreshLabel()}
        </button>
        <Link className="btn" href="/learn/wallet">
          Xem ví
        </Link>
      </div>
    </Panel>
  );
}
