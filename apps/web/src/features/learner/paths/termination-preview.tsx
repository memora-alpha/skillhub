"use client";
import { systemCodeLabel } from "@/lib/system-text";
import { useUserResource } from "../hooks/use-user-resource";
import { useUserSession } from "../auth/session";
import { Feedback } from "../components/common";
import styles from "./path-detail.module.css";

type Quote = {
  pathId: string;
  status: string;
  reasonCodes: string[];
  completedSessions: number;
  totalSessions: number;
  allocations: {
    allocationId: string;
    userId: string;
    refund: string;
    counterpartyPayment: string;
    platformFee: string;
    compensationCredit: string;
  }[];
};

export function TerminationPreview({ pathId }: Readonly<{ pathId: string }>) {
  const query = useUserResource<Quote>(
    `learning-paths/${pathId}/termination-requests/quote`,
  );
  const { actor } = useUserSession();

  return (
    <section className={styles.quoteSection}>
      <h3>Credit dự kiến khi dừng lộ trình</h3>
      <Feedback
        loading={query.initialLoading}
        error={query.error}
        reload={query.reload}
        refreshing={!!(query.loading && !query.initialLoading)}
      />
      {query.data && (
        <>
          <p className={styles.metaNote}>
            Tiến độ đã hoàn thành:{" "}
            <strong>
              {query.data.completedSessions}/{query.data.totalSessions} buổi
            </strong>
          </p>
          {query.data.status === "BLOCKED" && (
            <p className="learner-notice">
              Cần xử lý các buổi học hoặc vụ việc còn mở trước khi chốt Credit.
            </p>
          )}
          {query.data.reasonCodes.length > 0 && (
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
              {query.data.reasonCodes.map((code) => (
                <li key={code}>
                  {systemCodeLabel(
                    code,
                    "Cần nhân viên kiểm tra điều kiện tất toán.",
                  )}
                </li>
              ))}
            </ul>
          )}
          <div className={styles.allocationGrid}>
            {query.data.allocations.map((row) => (
              <div key={row.allocationId} className={styles.allocationCard}>
                <strong>
                  {row.userId === actor.userId
                    ? "Credit bạn đang giữ"
                    : "Credit đối tác đang giữ"}
                </strong>
                <dl>
                  <dt>Hoàn lại người giữ</dt>
                  <dd>{row.refund} CR</dd>
                  <dt>Trả cho bên còn lại</dt>
                  <dd>{row.counterpartyPayment} CR</dd>
                  {row.compensationCredit &&
                    !/^0(?:\.0+)?$/.test(row.compensationCredit) && (
                      <>
                        <dt>Bồi hoàn theo kết luận</dt>
                        <dd>{row.compensationCredit} CR</dd>
                      </>
                    )}
                  <dt>Phí nền tảng</dt>
                  <dd>{row.platformFee} CR</dd>
                </dl>
              </div>
            ))}
          </div>
          <small className={styles.metaNote}>
            Số liệu được máy chủ tính tại thời điểm xem và có thể đổi theo kết
            quả buổi học.
          </small>
        </>
      )}
    </section>
  );
}
