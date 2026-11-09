"use client";
import { useUserResource } from "../hooks/use-user-resource";
import { useUserSession } from "../auth/session";
import { Feedback } from "../components/common";
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
    ),
    { actor } = useUserSession();
  return (
    <section>
      <h3>Credit dự kiến khi dừng</h3>
      <Feedback
        loading={query.loading}
        error={query.error}
        reload={query.reload}
      />
      {query.data && (
        <>
          <p>
            Đã hoàn thành {query.data.completedSessions}/
            {query.data.totalSessions} buổi.
          </p>
          {query.data.status === "BLOCKED" && (
            <p className="learner-notice">
              Cần xử lý các buổi học hoặc vụ việc còn mở trước khi chốt Credit.
            </p>
          )}
          {query.data.allocations.map((row) => (
            <div key={row.allocationId}>
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
                <dt>Phí nền tảng</dt>
                <dd>{row.platformFee} CR</dd>
              </dl>
            </div>
          ))}
          <small>
            Số liệu được máy chủ tính tại thời điểm xem và có thể đổi theo kết
            quả buổi học.
          </small>
        </>
      )}
    </section>
  );
}
