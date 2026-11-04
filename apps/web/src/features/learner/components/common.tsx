import type { ReactNode } from "react";
import Link from "next/link";
export { formatVietnamDateTime as formatTime } from "@/lib/vietnam-time";
const labels: Record<string, string> = {
  FREE: "Miễn phí",
  PAID: "Đã thanh toán",
  SUCCESS: "Thành công",
  FAILED: "Không thành công",
  REVERSED: "Đã được đảo",
  REFUNDED: "Đã hoàn Credit",
  REVIEW: "Đang đối soát",
  CREATED: "Đang chuẩn bị",
  PENDING_REVIEW: "Chờ duyệt",
  PUBLISHED: "Đã xuất bản",
  HIDDEN: "Đã ẩn",
  ARCHIVED: "Đã lưu trữ",
  VERIFIED: "Đã xác minh",
  UNVERIFIED: "Chưa xác minh",
  APPROVED: "Đã duyệt",
  REVOKED: "Đã thu hồi",
  QUARANTINED: "Đang kiểm tra",
  SCANNING: "Đang quét tệp",
  SCAN_FAILED: "Lỗi kiểm tra tệp",
  UPLOAD_FAILED: "Tải tệp thất bại",
  UNDER_REVIEW: "Đang xem xét",
  NEED_MORE_INFO: "Cần bổ sung thông tin",
  RESOLVED: "Đã xử lý",
  DRAFT: "Bản nháp",
  OPEN: "Đang tìm người hướng dẫn",
  PENDING_MODERATION: "Chờ duyệt",
  REJECTED: "Đã từ chối",
  NEGOTIATING: "Đang trao đổi",
  MATCHED: "Đã chốt lịch",
  CLOSED: "Đã hoàn tất",
  PENDING: "Chờ phản hồi",
  ACCEPTED: "Đã kết nối",
  WITHDRAWN: "Đã rút",
  EXPIRED: "Đã hết hạn",
  PROPOSED: "Đang thống nhất",
  PARTIALLY_CONFIRMED: "Chờ đủ xác nhận",
  CONFIRMED: "Đã xác nhận",
  SCHEDULED: "Đã chốt lịch",
  ACTIVE: "Đang học",
  COMPLETED: "Hoàn thành",
  CANCELLED: "Đã hủy",
  DISPUTED: "Đang tranh chấp",
  READY: "Sắp bắt đầu",
  ONGOING: "Đang diễn ra",
  AWAITING_CONFIRMATION: "Chờ xác nhận hoàn tất",
  NO_SHOW: "Có người vắng học",
  MAKEUP_REQUIRED: "Cần học bù",
  LOCKED: "Đã khóa lịch",
  NEEDS_REVISION: "Cần thống nhất lại",
};
export function statusText(status: string) {
  return labels[status] ?? status;
}
export function Status({
  value,
  label,
}: Readonly<{ value: string; label?: string }>) {
  return (
    <span className={"learner-status learner-status-" + value.toLowerCase()}>
      {label ?? statusText(value)}
    </span>
  );
}
export function Panel({
  title,
  children,
  className = "",
}: Readonly<{ title?: string; children: ReactNode; className?: string }>) {
  return (
    <section className={"learner-card panel " + className}>
      {title && <h2>{title}</h2>}
      {children}
    </section>
  );
}
export function Feedback({
  loading,
  error,
  reload,
}: Readonly<{ loading?: boolean; error?: string; reload?: () => void }>) {
  return (
    <>
      {loading && (
        <p className="learner-notice">
          <output>Đang tải…</output>
        </p>
      )}
      {error && (
        <div className="learner-error" role="alert">
          {error}{" "}
          {reload && (
            <button
              type="button"
              className="learner-text-button"
              onClick={reload}
            >
              Thử lại
            </button>
          )}
        </div>
      )}
    </>
  );
}
export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: Readonly<{
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}>) {
  return (
    <header className="learner-page-heading page-header">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p className="muted">{description}</p>}
      </div>
      {action}
    </header>
  );
}
export function Empty({ children }: Readonly<{ children: ReactNode }>) {
  return <div className="learner-empty">{children}</div>;
}
export function More({
  cursor,
  loading,
  onMore,
}: Readonly<{ cursor: string | null; loading: boolean; onMore: () => void }>) {
  return cursor ? (
    <button type="button" className="btn" disabled={loading} onClick={onMore}>
      Xem thêm
    </button>
  ) : null;
}
export function Back({
  href,
  children = "Quay lại",
}: Readonly<{ href: string; children?: ReactNode }>) {
  return (
    <Link className="learner-back" href={href}>
      ← {children}
    </Link>
  );
}
export function CommandFeedback({
  command,
}: Readonly<{
  command: { pending: boolean; error?: string; uncertain: boolean };
}>) {
  return (
    <>
      <Feedback loading={command.pending} error={command.error} />
      {command.uncertain && (
        <p className="learner-notice">
          Chưa rõ kết quả lần gửi. Hãy kiểm tra dữ liệu mới trước khi thử lại;
          không tạo yêu cầu khác để tránh gửi trùng.
        </p>
      )}
    </>
  );
}
