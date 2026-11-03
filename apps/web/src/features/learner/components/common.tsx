import type { ReactNode } from "react";
import Link from "next/link";
const labels: Record<string, string> = {
  DRAFT: "Bản nháp",
  OPEN: "Đang tìm người học",
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
export function Status({ value }: Readonly<{ value: string }>) {
  return (
    <span className={"learner-status learner-status-" + value.toLowerCase()}>
      {statusText(value)}
    </span>
  );
}
export function Panel({
  title,
  children,
  className = "",
}: Readonly<{ title?: string; children: ReactNode; className?: string }>) {
  return (
    <section className={"learner-card " + className}>
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
        <p className="learner-notice" role="status">
          Đang tải…
        </p>
      )}
      {error && (
        <div className="learner-error" role="alert">
          {error}{" "}
          {reload && (
            <button className="learner-text-button" onClick={reload}>
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
    <header className="learner-page-heading">
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
export const formatTime = (date: string) =>
  new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(date));
export function More({
  cursor,
  loading,
  onMore,
}: Readonly<{ cursor: string | null; loading: boolean; onMore: () => void }>) {
  return cursor ? (
    <button className="btn" disabled={loading} onClick={onMore}>
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
