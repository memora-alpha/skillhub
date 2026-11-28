"use client";
import { LoadingButton } from "@/components/loading-button";
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
import { ProductIcon } from "../components/product-icon";
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
import styles from "./path-detail.module.css";

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
        result.settlement.outcome === "SETTLED"
          ? "Thỏa thuận đã được quyết toán."
          : "Đã ghi nhận đồng ý giải ngân. Máy chủ tự xử lý khi đủ ý kiến hai bên và đủ điều kiện.",
      );
    }
    query.reload();
  }

  function refreshLabel() {
    if (checking) return "Đang kiểm tra…";
    if (consent.uncertain || retry.uncertain) return "Kiểm tra lại kết quả";
    return "Cập nhật trạng thái";
  }

  const settled = status?.status === "SETTLED";
  const consentMessage = status ? settlementConsentMessage(status) : null;

  return (
    <Panel title="Quyết toán Credit">
      <div className={styles.settlementStack}>
        <div
          className={
            styles.settlementBanner +
            (settled ? ` ${styles.settlementBannerOk}` : "")
          }
        >
          <span className={styles.settlementBannerIcon}>
            <ProductIcon name={settled ? "check" : "wallet"} size={22} />
          </span>
          <div className={styles.settlementBannerCopy}>
            <small>Theo dõi hoàn Credit &amp; giải ngân</small>
            <strong>
              <output>
                {status
                  ? (settlementStatusLabels[status.status] ??
                    "Kiểm tra trạng thái quyết toán")
                  : "Đang kiểm tra trạng thái quyết toán"}
              </output>
            </strong>
          </div>
        </div>

        <p className={styles.metaNote}>
          Hệ thống tự quyết toán khi toàn bộ thỏa thuận đủ điều kiện. Hai bên có
          thể đồng ý giải ngân sớm; xác nhận hoàn thành buổi học là bước riêng.
        </p>

        <Feedback
          loading={query.initialLoading}
          error={readError ?? query.error ?? contractError}
          reload={() => void reconcile()}
          refreshing={!!(query.loading && !query.initialLoading)}
        />

        {status && (
          <>
            {(status.autoSettlementAt || status.settledAt) && (
              <div className={styles.settlementMetaGrid}>
                {status.autoSettlementAt && !status.settledAt && (
                  <div className={styles.settlementMetaTile}>
                    <span>Hạn chờ tự quyết toán</span>
                    <strong>{formatTime(status.autoSettlementAt)}</strong>
                  </div>
                )}
                {status.settledAt && (
                  <div className={styles.settlementMetaTile}>
                    <span>Thời điểm đã quyết toán</span>
                    <strong>{formatTime(status.settledAt)}</strong>
                  </div>
                )}
              </div>
            )}

            {status.reasonCode && (
              <p className="learner-notice">
                {userErrorText(409, status.reasonCode)}
              </p>
            )}

            {consentMessage && (
              <p className="learner-notice">
                <output>{consentMessage}</output>
              </p>
            )}

            {status.immediateSettlement.canApprove && !consent.uncertain && (
              <>
                {!reviewing ? (
                  <div className={styles.actionRow}>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => setReviewing(true)}
                    >
                      <ProductIcon name="check" size={16} />
                      Đồng ý giải ngân sớm
                    </button>
                  </div>
                ) : (
                  <div className={styles.warningBox}>
                    <p>
                      <strong>Xác nhận giải ngân ngay:</strong> Thao tác này sẽ
                      kết thúc thời gian chờ khiếu nại. Báo cáo sau khi giải
                      ngân sẽ không tự động hoàn Credit.
                    </p>
                    <div className={styles.actionRow}>
                      <LoadingButton
                        type="button"
                        className="btn btn-primary"
                        disabled={
                          checking ||
                          consent.pending ||
                          query.loading ||
                          !!query.error
                        }
                        onClick={() => void approve()}
                        loading={
                          !!(checking || consent.pending || query.loading)
                        }
                      >
                        Tôi đồng ý giải ngân ngay
                      </LoadingButton>
                      <LoadingButton
                        type="button"
                        className="btn"
                        disabled={consent.pending}
                        onClick={() => setReviewing(false)}
                        loading={!!consent.pending}
                      >
                        Tiếp tục chờ theo hạn
                      </LoadingButton>
                    </div>
                  </div>
                )}
              </>
            )}

            {status.status === "NEEDS_REVIEW" && (
              <p className="learner-notice">
                Cần nhân sự đối soát. Gửi mã lộ trình khi liên hệ hỗ trợ:{" "}
                <code>{pathId}</code>
              </p>
            )}

            {status.retryable &&
              ["RETRYING", "READY"].includes(status.status) && (
                <div className={styles.actionRow}>
                  <LoadingButton
                    type="button"
                    className="btn btn-primary"
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
                    loading={!!(retry.pending || checking || query.loading)}
                  >
                    Thử lại quyết toán
                  </LoadingButton>
                </div>
              )}
          </>
        )}

        {notice && (
          <p className="learner-notice">
            <output>{notice}</output>
          </p>
        )}

        <CommandFeedback command={consent} />
        <CommandFeedback command={retry} />

        {(consent.uncertain || retry.uncertain) && (
          <p className={styles.metaNote}>
            Kết quả chưa rõ. Tải lại trạng thái để xem máy chủ đã ghi nhận;
            không cần đồng ý hoặc gửi lại ngay.
          </p>
        )}

        <div className={styles.actionRow}>
          <LoadingButton
            type="button"
            className="btn"
            disabled={
              checking || query.loading || consent.pending || retry.pending
            }
            onClick={() => void reconcile()}
            loading={
              !!(checking || query.loading || consent.pending || retry.pending)
            }
          >
            <ProductIcon name="refresh" size={15} />
            {refreshLabel()}
          </LoadingButton>
          <Link className="btn" href="/learn/wallet">
            <ProductIcon name="wallet" size={15} />
            Xem ví Credit
          </Link>
        </div>
      </div>
    </Panel>
  );
}
