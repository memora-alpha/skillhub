import { LoadingButton } from "@/components/loading-button";
import { formatVietnamTime, vietnamDateKey } from "@/lib/vietnam-time";
import Link from "next/link";
import type { ReactNode } from "react";
import type { LearningSession } from "../types";
import { ProductIcon } from "../components/product-icon";
import { ProfileAvatar } from "../components/profile-avatar";
import { Panel, Status, formatTime } from "../components/common";
import { SessionJoinWindow } from "./session-join-window";
import { SessionCompletionActions } from "./session-completion-actions";
import { canEnterSession } from "./session-policy";
import { sessionMakeupState } from "./session-makeup-policy";
import { userErrorText } from "../api/client";
import type { SessionPresentation } from "./session-detail-presentation";
import styles from "./session-detail.module.css";

const sessionDateFormatter = new Intl.DateTimeFormat("vi-VN", {
  timeZone: "Asia/Ho_Chi_Minh",
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

function formatSessionSchedule(startAt: string, endAt: string) {
  const startMs = Date.parse(startAt);
  const endMs = Date.parse(endAt);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
    return {
      primary: `${formatTime(startAt)} – ${formatTime(endAt)}`,
      secondary: "Giờ Việt Nam (UTC+7)",
    };
  }
  if (vietnamDateKey(startMs) === vietnamDateKey(endMs)) {
    return {
      primary: `${formatVietnamTime(startAt)} – ${formatVietnamTime(endAt)} (UTC+7)`,
      secondary: sessionDateFormatter.format(new Date(startMs)),
    };
  }
  return {
    primary: `${formatTime(startAt)} – ${formatTime(endAt)}`,
    secondary: "Giờ Việt Nam (UTC+7)",
  };
}

function heroToneClass(tone: SessionPresentation["tone"]) {
  if (tone === "success") return styles.heroToneSuccess;
  if (tone === "warning") return styles.heroToneWarning;
  if (tone === "danger") return styles.heroToneDanger;
  return styles.heroToneInfo;
}

function bannerIconName(tone: SessionPresentation["tone"]) {
  if (tone === "success") return "shield" as const;
  if (tone === "danger") return "alert" as const;
  if (tone === "warning") return "clock" as const;
  return "info" as const;
}

function progressPercent(completed: number, total: number) {
  if (total <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((completed / total) * 100)));
}

export function SessionDetailHeader({
  session,
  title,
  goal,
  sessionNo,
  view,
  loading,
  refresh,
  partner,
  conversationId,
}: Readonly<{
  session: LearningSession;
  title: string;
  goal?: string;
  sessionNo?: number;
  view: SessionPresentation;
  loading: boolean;
  refresh: () => void;
  partner?: { fullName: string; avatarUrl: string | null };
  conversationId?: string;
}>) {
  const minutes = Math.round(
    (Date.parse(session.endAt) - Date.parse(session.startAt)) / 60000,
  );
  const isTeacher = session.role === "TEACHER";
  const partnerRoleLabel = isTeacher ? "Người học" : "Người dạy";
  const partnerDisplayName = partner?.fullName ?? partnerRoleLabel;
  const schedule = formatSessionSchedule(session.startAt, session.endAt);

  return (
    <>
      <nav aria-label="Đường dẫn" className={styles.breadcrumbs}>
        <Link href="/learn/calendar">← Lịch học</Link>
        <span className={styles.breadcrumbsSep} aria-hidden="true">
          /
        </span>
        <Link href={`/learn/paths/${session.pathId}`}>Lộ trình học</Link>
        <span className={styles.breadcrumbsSep} aria-hidden="true">
          /
        </span>
        <strong>{sessionNo ? `Buổi ${sessionNo}` : "Chi tiết buổi học"}</strong>
      </nav>

      <header className={styles.hero}>
        <div className={`${styles.heroTop} ${heroToneClass(view.tone)}`}>
          <div className={styles.heroMain}>
            <div className={styles.heroBadges}>
              <span className={styles.sessionBadge}>
                <ProductIcon name="book" size={13} />
                {sessionNo ? `Buổi ${sessionNo}` : "Buổi học 1:1"}
              </span>
              <Status value={session.status} />
              <span
                className={`${styles.roleBadge} ${
                  isTeacher ? styles.roleTeach : styles.roleLearn
                }`}
              >
                <ProductIcon name="user" size={13} />
                {isTeacher ? "Bạn là người dạy" : "Bạn là người học"}
              </span>
            </div>

            <h1 className={styles.heroTitle}>{title}</h1>

            {goal && (
              <Link
                href={`/learn/paths/${session.pathId}`}
                className={styles.heroGoalLink}
              >
                <span>Lộ trình: {goal}</span>
                <ProductIcon name="arrow" size={14} />
              </Link>
            )}
          </div>

          <div className={styles.heroActions}>
            {conversationId && (
              <Link className="btn" href={`/learn/messages/${conversationId}`}>
                <ProductIcon name="chat" size={16} />
                Nhắn tin
              </Link>
            )}
            <LoadingButton
              type="button"
              className="btn"
              onClick={refresh}
              disabled={loading}
              loading={!!loading}
            >
              <ProductIcon name="refresh" size={16} />
              {loading ? "Đang cập nhật…" : "Làm mới"}
            </LoadingButton>
          </div>
        </div>

        <div className={styles.heroFacts} aria-label="Thông tin nhanh buổi học">
          <div className={styles.heroFact}>
            <span className={styles.heroFactIcon} aria-hidden="true">
              <ProductIcon name="calendar" size={18} />
            </span>
            <div className={styles.heroFactBody}>
              <small>Thời gian học</small>
              <strong>{schedule.primary}</strong>
              <span className={styles.heroFactSub}>{schedule.secondary}</span>
            </div>
          </div>

          <div className={styles.heroFact}>
            <span className={styles.heroFactIcon} aria-hidden="true">
              <ProductIcon name="clock" size={18} />
            </span>
            <div className={styles.heroFactBody}>
              <small>Thời lượng</small>
              <strong>
                {Number.isFinite(minutes) && minutes > 0
                  ? `${minutes} phút`
                  : "Chưa có"}
              </strong>
              <span className={styles.heroFactSub}>Trực tuyến 1:1</span>
            </div>
          </div>

          <div className={styles.heroFact}>
            <ProfileAvatar
              fullName={partnerDisplayName}
              avatarUrl={partner?.avatarUrl ?? null}
              className={styles.partnerAvatar}
            />
            <div className={styles.heroFactBody}>
              <small>Đối tác của bạn</small>
              <strong>{partnerDisplayName}</strong>
              <span className={styles.heroFactSub}>{partnerRoleLabel}</span>
            </div>
          </div>
        </div>
      </header>

      <section
        className={`${styles.banner} ${styles[view.tone]}`}
        aria-label="Trạng thái và bước tiếp theo"
      >
        <span className={styles.bannerIcon} aria-hidden="true">
          <ProductIcon name={bannerIconName(view.tone)} size={20} />
        </span>
        <div className={styles.bannerBody}>
          <strong>{view.title}</strong>
          <p>{view.description}</p>
        </div>
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

const journeySteps = [
  "Tham gia buổi học",
  "Chốt kết quả buổi",
  "Hoàn tất các buổi",
  "Quyết toán thỏa thuận",
  "Mở đánh giá",
] as const;

function SessionJourney({ step }: Readonly<{ step: number }>) {
  const displayStep = Math.min(journeySteps.length, Math.max(1, step + 1));
  return (
    <section className={styles.journey} aria-label="Các bước sau buổi học">
      <div className={styles.journeyHead}>
        <p>Từ buổi học đến hoàn tất thỏa thuận</p>
        <small>
          Bước {displayStep} / {journeySteps.length}
        </small>
      </div>
      <ol className={styles.steps}>
        {journeySteps.map((label, index) => {
          function journeyStepClass() {
            if (index === step) return styles.current;
            if (index < step) return styles.done;
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
  tone = "brand",
}: Readonly<{
  icon: "book" | "users" | "calendar" | "video" | "edit" | "shield" | "clock";
  title: string;
  subtitle?: string;
  extra?: ReactNode;
  tone?: "brand" | "sage" | "warn";
}>) {
  function iconToneClass() {
    if (tone === "sage") return ` ${styles.headingIconSage}`;
    if (tone === "warn") return ` ${styles.headingIconWarn}`;
    return "";
  }
  return (
    <div className={styles.cardHeading}>
      <div className={styles.cardHeadingMain}>
        <span className={styles.headingIcon + iconToneClass()}>
          <ProductIcon name={icon} size={19} />
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
  const rows = [
    {
      key: "agreement" as const,
      label: "Toàn bộ thỏa thuận",
      fillClass: styles.progressFillPrimary,
    },
    {
      key: "plan" as const,
      label: "Lộ trình của buổi này",
      fillClass: styles.progressFillSecondary,
    },
  ];
  return (
    <Panel className={styles.card}>
      <SessionCardHeading
        icon="shield"
        tone="sage"
        title="Tiến độ lộ trình"
        subtitle="Tự động cập nhật khi kết quả buổi học được chốt"
      />
      <div className={`${styles.content} ${styles.progressGrid}`}>
        <div className={styles.progressPair}>
          {rows.map(({ key, label, fillClass }) => {
            const row = session.progress![key];
            const percent = progressPercent(row.completed, row.total);
            return (
              <div key={key} className={styles.progressTile}>
                <div className={styles.progressLabel}>
                  <span>{label}</span>
                  <strong>
                    {row.completed} / {row.total} buổi
                    {row.total > 0 && (
                      <span className={styles.progressPercent}>
                        ({percent}%)
                      </span>
                    )}
                  </strong>
                </div>
                {row.total > 0 && (
                  <div
                    className={styles.progressTrack}
                    role="progressbar"
                    aria-label={label}
                    aria-valuenow={row.completed}
                    aria-valuemin={0}
                    aria-valuemax={row.total}
                  >
                    <span
                      className={fillClass}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <Link
          href={"/learn/paths/" + session.pathId}
          className={styles.inlineLink}
        >
          Xem lộ trình và kế hoạch
          <ProductIcon name="arrow" size={15} />
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
    if (after) return "SAU BUỔI HỌC";
    if (makeup) return "HỌC BÙ VÀ LỊCH MỚI";
    return "PHÒNG HỌC TRỰC TUYẾN";
  }

  function roomToneClass() {
    if (joinable) return ` ${styles.roomOpen}`;
    if (view.tone === "danger") return ` ${styles.roomDanger}`;
    if (makeup) return ` ${styles.roomMakeup}`;
    return "";
  }

  function roomIconName() {
    if (joinable) return "video" as const;
    if (after) return "check" as const;
    if (view.tone === "danger") return "alert" as const;
    if (makeup) return "calendar" as const;
    return "clock" as const;
  }

  return (
    <Panel
      className={`${styles.card}${joinable ? ` ${styles.actionCardActive}` : ""}`}
    >
      <div className={styles.roomVisual + roomToneClass()}>
        <span className={styles.roomVisualIcon} aria-hidden="true">
          <ProductIcon name={roomIconName()} size={22} />
        </span>
        <div className={styles.roomVisualCopy}>
          <small>
            {joinable && session.status === "ONGOING" && (
              <span className={styles.liveDot} aria-hidden="true" />
            )}
            {roomSectionLabel()}
          </small>
          <strong>{view.room}</strong>
        </div>
      </div>

      <div className={styles.actions}>
        {joinable && (
          <Link
            className="btn btn-primary"
            href={`/learn/sessions/${session.id}/room`}
          >
            <ProductIcon name="video" size={17} />
            {session.status === "ONGOING"
              ? "Trở lại phòng học"
              : "Vào phòng học"}
          </Link>
        )}

        {!joinable && !after && !makeup && (
          <p className={styles.actionHintBox}>
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
            <ProductIcon name="calendar" size={16} />
            Đề xuất lịch học bù
          </a>
        )}

        {(makeup === "waiting" ||
          makeup === "processing" ||
          makeup === "closed") && (
          <a className="btn" href="#session-makeup">
            <ProductIcon name="arrow" size={16} />
            Theo dõi bước học bù tiếp theo
          </a>
        )}

        {after && (
          <Link className="btn btn-primary" href={destination}>
            {actionLabel}
            <ProductIcon name="arrow" size={16} />
          </Link>
        )}

        {view.tone === "danger" &&
          blocked &&
          session.status !== "CANCELLED" && (
            <Link className="btn" href={"/learn/paths/" + session.pathId}>
              Theo dõi vụ việc trong lộ trình
            </Link>
          )}

        {(session.reporting?.canReport ||
          session.reporting?.reportBy ||
          (session.reporting && !session.reporting.canReport)) && (
          <div className={styles.reportSection}>
            {session.reporting?.canReport && (
              <Link
                className={
                  reportPrimary ? "btn btn-primary" : styles.reportLink
                }
                href={`/learn/reports/new?sessionId=${session.id}`}
              >
                <ProductIcon name="alert" size={15} />
                Báo sự cố kỹ thuật / vấn đề khác
              </Link>
            )}
            {session.reporting?.reportBy && (
              <span className={styles.deadlineHint}>
                <ProductIcon name="clock" size={14} />
                Hạn báo sự cố: {formatTime(session.reporting.reportBy)}
              </span>
            )}
            {session.reporting && !session.reporting.canReport && (
              <small className="muted">
                {userErrorText(
                  409,
                  session.reporting.blockedReason ??
                    "REPORT_POLICY_UNAVAILABLE",
                )}
              </small>
            )}
          </div>
        )}

        <details className={styles.joinDisclosure}>
          <summary>
            <span>Thời gian và điều kiện vào phòng</span>
            <span className={styles.chevronIcon} aria-hidden="true">
              <ProductIcon name="chevron" size={16} />
            </span>
          </summary>
          <SessionJoinWindow session={session} />
        </details>
      </div>
    </Panel>
  );
}
