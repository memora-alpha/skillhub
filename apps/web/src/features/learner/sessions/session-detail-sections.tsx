import Link from "next/link";
import type { ReactNode } from "react";
import type { LearningSession } from "../types";
import { ProductIcon } from "../components/product-icon";
import { Panel, Status, formatTime } from "../components/common";
import { SessionJoinWindow } from "./session-join-window";
import { SessionCompletionActions } from "./session-completion-actions";
import { canEnterSession } from "./session-policy";
import { sessionMakeupState } from "./session-makeup-policy";
import { userErrorText } from "../api/client";
import type { SessionPresentation } from "./session-detail-presentation";
import styles from "./session-detail.module.css";

export function SessionDetailHeader({
  session,
  title,
  goal,
  sessionNo,
  view,
  loading,
  refresh,
}: Readonly<{
  session: LearningSession;
  title: string;
  goal?: string;
  sessionNo?: number;
  view: SessionPresentation;
  loading: boolean;
  refresh: () => void;
}>) {
  const minutes =
    (Date.parse(session.endAt) - Date.parse(session.startAt)) / 60000;
  return (
    <>
      <nav aria-label="Đường dẫn" className={styles.breadcrumbs}>
        <Link href="/learn/calendar">← Lịch học</Link>
        <span aria-hidden="true">/</span>
        <strong>Chi tiết buổi học</strong>
      </nav>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>
            {sessionNo
              ? `BUỔI ${sessionNo} TRONG LỘ TRÌNH`
              : "BUỔI HỌC CỦA BẠN"}
          </p>
          <h1>{title}</h1>
          {goal && <p className={styles.subtitle}>Lộ trình: {goal}</p>}
        </div>
        <Status value={session.status} />
      </header>
      <div className={styles.meta}>
        <span>
          <ProductIcon name="calendar" size={17} />
          {formatTime(session.startAt)} – {formatTime(session.endAt)} (UTC+7)
        </span>
        <span>
          <ProductIcon name="clock" size={17} />
          {Number.isFinite(minutes) ? `${minutes} phút` : "Chưa có thời lượng"}
        </span>
        <span>
          <ProductIcon name="user" size={17} />
          Bạn là {session.role === "TEACHER" ? "người dạy" : "người học"}
        </span>
      </div>
      <section
        className={`${styles.banner} ${styles[view.tone]}`}
        aria-label="Trạng thái và bước tiếp theo"
      >
        <ProductIcon
          name={view.tone === "success" ? "shield" : "clock"}
          size={22}
        />
        <div>
          <strong>{view.title}</strong>
          <p>{view.description}</p>
        </div>
        <button
          type="button"
          className="btn"
          onClick={refresh}
          disabled={loading}
        >
          <ProductIcon name="refresh" size={16} />
          {loading ? "Đang cập nhật…" : "Làm mới"}
        </button>
      </section>
      {view.step > 0 &&
        !["CANCELLED", "NO_SHOW", "MAKEUP_REQUIRED", "DISPUTED"].includes(
          session.status,
        ) &&
        session.attendance?.outcomeStatus !== "DISPUTED" && (
          <SessionJourney step={view.step} />
        )}
    </>
  );
}
function SessionJourney({ step }: Readonly<{ step: number }>) {
  return (
    <section className={styles.journey} aria-label="Các bước sau buổi học">
      <p>Từ buổi học đến hoàn tất thỏa thuận</p>
      <ol className={styles.steps}>
        {[
          "Tham gia buổi học",
          "Chốt kết quả buổi",
          "Hoàn tất các buổi",
          "Quyết toán thỏa thuận",
          "Mở đánh giá",
        ].map((label, index) => {
          function journeyStepClass() {
            if (index === step) {
              return styles.current;
            }
            if (index < step) {
              return styles.done;
            }
            return undefined;
          }
          return (
            <li
              key={label}
              className={journeyStepClass()}
              aria-current={index === step ? "step" : undefined}
            >
              <span>
                {index < step ? (
                  <ProductIcon name="check" size={15} />
                ) : (
                  index + 1
                )}
              </span>
              {label}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
export function SessionCardHeading({
  icon,
  title,
  subtitle,
  extra,
}: Readonly<{
  icon: "book" | "users" | "calendar";
  title: string;
  subtitle?: string;
  extra?: ReactNode;
}>) {
  return (
    <div className={styles.cardHeading}>
      <div>
        <span className={styles.headingIcon}>
          <ProductIcon name={icon} size={20} />
        </span>
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
      </div>
      {extra}
    </div>
  );
}
export function SessionProgress({
  session,
}: Readonly<{ session: LearningSession }>) {
  if (!session.progress) return null;
  return (
    <Panel className={styles.card}>
      <SessionCardHeading
        icon="book"
        title="Tiến độ lộ trình"
        subtitle="Tiến độ cập nhật khi kết quả buổi học được chốt"
      />
      <div className={`${styles.content} ${styles.progressGrid}`}>
        {(
          [
            ["agreement", "Toàn bộ thỏa thuận"],
            ["plan", "Lộ trình của buổi này"],
          ] as const
        ).map(([key, label]) => {
          const row = session.progress![key];
          return (
            <div key={key}>
              <div className={styles.progressLabel}>
                <span>{label}</span>
                <strong>
                  {row.completed} / {row.total} buổi
                </strong>
              </div>
              {row.total > 0 && (
                <progress
                  aria-label={label}
                  value={row.completed}
                  max={row.total}
                />
              )}
            </div>
          );
        })}
        <Link href={"/learn/paths/" + session.pathId} className={styles.link}>
          Xem lộ trình và kế hoạch →
        </Link>
      </div>
    </Panel>
  );
}
export function SessionActionCard({
  session,
  view,
  now,
  settled,
  finished,
  blocked,
}: Readonly<{
  session: LearningSession;
  view: SessionPresentation;
  now: number;
  settled: boolean;
  finished: boolean;
  blocked: boolean;
}>) {
  const joinable = !blocked && canEnterSession(session, now);
  const after = session.status === "COMPLETED";
  const allowed = session.allowedActions ?? [];
  const makeup = sessionMakeupState(
    session,
    now,
    blocked ? "DISPUTED" : undefined,
  );
  const reportPrimary =
    session.attendance?.case !== "BOTH_ABSENT" &&
    allowed.includes("REPORT_NO_SHOW") &&
    !allowed.includes("SUBMIT_EXCUSE") &&
    !allowed.includes("DECIDE_EXCUSE");
  let destination = "/learn/paths/" + session.pathId;
  let actionLabel = "Tiếp tục lộ trình";
  if (settled) {
    destination = `/learn/paths/${session.pathId}/review`;
    actionLabel = "Đánh giá và xem phản hồi";
  } else if (finished) {
    destination = "#session-settlement";
    actionLabel = "Theo dõi quyết toán";
  }
  function roomSectionLabel() {
    if (after) {
      return "SAU BUỔI HỌC";
    }
    if (makeup) {
      return "HỌC BÙ VÀ LỊCH MỚI";
    }
    return "PHÒNG HỌC TRỰC TUYẾN";
  }
  return (
    <Panel className={styles.card}>
      <div
        className={`${styles.roomVisual} ${joinable ? styles.roomOpen : ""}`}
      >
        <ProductIcon name={joinable ? "video" : "clock"} size={28} />
        <div>
          <small>{roomSectionLabel()}</small>
          <strong>{view.room}</strong>
        </div>
      </div>
      <div className={styles.actions}>
        {joinable && (
          <Link
            className="btn btn-primary"
            href={`/learn/sessions/${session.id}/room`}
          >
            {session.status === "ONGOING"
              ? "Trở lại phòng học"
              : "Vào phòng học"}
          </Link>
        )}
        {!joinable && !after && !makeup && (
          <p>
            {userErrorText(409, session.join?.reason ?? "SESSION_NOT_JOINABLE")}
          </p>
        )}
        <SessionCompletionActions
          key={session.id}
          session={session}
          blocked={blocked}
        />
        {makeup === "available" && (
          <a className="btn btn-primary" href="#session-makeup">
            Đề xuất lịch học bù
          </a>
        )}
        {(makeup === "waiting" ||
          makeup === "processing" ||
          makeup === "closed") && (
          <a className="btn" href="#session-makeup">
            Theo dõi bước học bù tiếp theo
          </a>
        )}
        {after && (
          <Link className="btn btn-primary" href={destination}>
            {actionLabel}
          </Link>
        )}
        {view.tone === "danger" &&
          blocked &&
          session.status !== "CANCELLED" && (
            <Link className="btn" href={"/learn/paths/" + session.pathId}>
              Theo dõi vụ việc trong lộ trình
            </Link>
          )}
        {session.status !== "CANCELLED" && (
          <Link
            className={reportPrimary ? "btn btn-primary" : styles.link}
            href={`/learn/reports/new?sessionId=${session.id}`}
          >
            Báo sự cố kỹ thuật / vấn đề khác
          </Link>
        )}
        <details>
          <summary className={styles.link}>
            Thời gian và điều kiện vào phòng
          </summary>
          <SessionJoinWindow session={session} />
        </details>
      </div>
    </Panel>
  );
}
