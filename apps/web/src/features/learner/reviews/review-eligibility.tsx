"use client";
import Link from "next/link";
import { Feedback, Status } from "../components/common";
import { useUserResource } from "../hooks/use-user-resource";
import { PathCaseList } from "../paths/path-cases";
import { type PathOverview } from "../paths/path-overview";
import {
  readSettlementStatus,
  settlementStatusLabels,
} from "../paths/post-session-contract";
import styles from "../components/learning-layout.module.css";

export function ReviewEligibility({ pathId }: Readonly<{ pathId: string }>) {
  const query = useUserResource<unknown>(
    `learning-paths/${pathId}/settlement-status`,
  );
  const overview = useUserResource<PathOverview>(
    `learning-paths/${pathId}/overview`,
  );
  let status;
  let invalid: string | undefined;
  if (query.data) {
    try {
      status = readSettlementStatus(query.data, pathId);
    } catch {
      invalid = "Chưa xác nhận được điều kiện đánh giá. Vui lòng tải lại.";
    }
  }
  const finished =
    !!overview.data &&
    !overview.error &&
    ["LEARNING_FINISHED", "COMPLETED"].includes(
      overview.data.learningStage ?? "",
    );
  return (
    <section className={styles.reviewGate}>
      <Status value="PENDING" label="Chưa thể đánh giá" />
      <h2>
        {status && !query.error
          ? (settlementStatusLabels[status.status] ??
            "Lộ trình chưa đủ điều kiện đánh giá")
          : "Đánh giá chưa mở"}
      </h2>
      <p>
        Đánh giá áp dụng cho toàn bộ lộ trình và mở sau khi thỏa thuận hoàn tất,
        Credit đã được quyết toán.
      </p>
      <Feedback
        loading={query.loading}
        error={invalid ?? query.error}
        reload={query.reload}
      />
      <ol className={styles.steps}>
        <li data-current={!finished}>
          <span>1</span>
          <div>
            <strong>Hoàn tất các buổi học</strong>
            <small>
              {finished
                ? "Đã học xong theo tiến độ lộ trình."
                : "Theo dõi tiến độ và xác nhận các buổi học trong lộ trình."}
            </small>
          </div>
        </li>
        <li
          data-current={
            status?.status === "WAITING_DISPUTE" ||
            status?.status === "WAITING_TERMINATION"
          }
        >
          <span>2</span>
          <div>
            <strong>Xử lý các vấn đề còn mở</strong>
            <small>
              {status?.status === "WAITING_DISPUTE"
                ? "Còn vụ việc cần được giải quyết trước khi quyết toán."
                : "Các yêu cầu thay đổi và vụ việc được kiểm tra theo trạng thái máy chủ."}
            </small>
          </div>
        </li>
        <li
          data-current={
            finished &&
            !["WAITING_DISPUTE", "WAITING_TERMINATION"].includes(
              status?.status ?? "",
            )
          }
        >
          <span>3</span>
          <div>
            <strong>Quyết toán Credit</strong>
            <small>Hệ thống xác nhận kết quả trước khi mở đánh giá.</small>
          </div>
        </li>
      </ol>
      <Link className="btn" href={`/learn/paths/${pathId}`}>
        Xem trạng thái lộ trình →
      </Link>
      <PathCaseList key={pathId} pathId={pathId} />
    </section>
  );
}
