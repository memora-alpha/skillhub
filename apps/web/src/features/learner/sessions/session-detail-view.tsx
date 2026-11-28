"use client";
import { LoadingSkeleton } from "@/components/loading-skeleton";
import { useState } from "react";
import Link from "next/link";
import { useUserSession } from "../auth/session";
import { useUserResource } from "../hooks/use-user-resource";
import type { LearningSession, LearningPath } from "../types";
import { Feedback, Panel, formatTime } from "../components/common";
import { ProductIcon } from "../components/product-icon";
import { SessionReschedule } from "./session-reschedule";
import { useClock } from "../hooks/use-clock";
import { AttendanceRules } from "./attendance-rules";
import { sessionRefreshInterval } from "./attendance-presentation";
import { SessionAttendanceStatus } from "./session-attendance-status";
import { SessionLimits } from "./session-limits";
import { SessionMakeupPanel } from "./session-makeup-panel";
import { SessionWhiteboardPanel } from "./session-whiteboard-panel";
import { SessionRecordingsPanel } from "./session-recordings-panel";
import { LearningChangePanel } from "../paths/learning-change-panel";
import { canRequestCancellation } from "../paths/post-session-contract";
import { allSessionsCompleted } from "../paths/settlement-policy";
import { SettlementStatusPanel } from "../paths/settlement-status-panel";
import type { PublicProfile } from "../discovery/discovery-types";
import { sessionPresentation } from "./session-detail-presentation";
import {
  SessionActionCard,
  SessionCardHeading,
  SessionDetailHeader,
  SessionProgress,
} from "./session-detail-sections";
import styles from "./session-detail.module.css";

function deadlineLabel(key: string, attendanceCase?: string | null) {
  if (key === "confirmBy") return "Hạn xác nhận";
  if (key === "excuseOrReportBy") {
    return attendanceCase === "BOTH_ABSENT"
      ? "Hạn báo cáo kết quả điểm danh"
      : "Hạn giải trình / báo cáo vắng";
  }
  if (key === "makeupBy") return "Hạn chốt lịch học bù";
  if (key === "reportBy") return "Hạn gửi báo cáo buổi học";
  return key;
}

export function SessionDetail({ id }: Readonly<{ id: string }>) {
  const now = useClock();
  const { actor } = useUserSession();
  const query = useUserResource<LearningSession>("sessions/" + id, {
    refetchInterval: sessionRefreshInterval,
  });
  const session = query.data;
  const path = useUserResource<LearningPath>(
    session ? "learning-paths/" + session.pathId : null,
    {
      refetchInterval: (value) =>
        value && !value.settledAt && value.status !== "CANCELLED"
          ? 30000
          : false,
    },
  );
  const partnerId =
    session &&
    (session.teacherId === actor.userId
      ? session.learnerId
      : session.teacherId);
  const partner = useUserResource<PublicProfile>(
    partnerId ? "profiles/" + partnerId : null,
  );
  const [reschedule, setReschedule] = useState(false);

  const plan = path.data?.plans.find((item) => item.id === session?.planId);
  const sessionNo =
    session?.outlineSessionNo ??
    plan?.sessions.find((item) => item.id === id)?.sessionNo;
  const outline = plan?.sessionOutline.find(
    (item) => item.sessionNo === sessionNo,
  )?.content;

  function refresh() {
    query.reload();
    path.reload();
    partner.reload();
  }

  if (!session)
    return (
      <div className={styles.page}>
        <nav aria-label="Đường dẫn" className={styles.breadcrumbs}>
          <Link href="/learn/calendar">← Lịch học</Link>
          <span className={styles.breadcrumbsSep} aria-hidden="true">
            /
          </span>
          <strong>Chi tiết buổi học</strong>
        </nav>
        <Feedback
          loading={query.initialLoading}
          error={query.error}
          reload={query.reload}
          refreshing={!!(query.loading && !query.initialLoading)}
          variant="page"
        />
      </div>
    );

  const view = sessionPresentation(session, actor.userId, now, path.data);
  const settled = path.data?.status === "COMPLETED" && !!path.data.settledAt;
  const finished = !!path.data && allSessionsCompleted(path.data);
  const canReschedule =
    ["CONFIRMED", "READY"].includes(session.status) &&
    Date.parse(session.startAt) - now >= 3600000 &&
    (session.rescheduleCount ?? 0) < 3 &&
    !!path.data &&
    ["SCHEDULED", "ACTIVE"].includes(path.data.status);
  const missingPathContent = path.error
    ? "Chưa tải được nội dung lộ trình."
    : "Chưa có nội dung chi tiết cho buổi học này.";
  const deadlineEntries = Object.entries(session.deadlines ?? {}).filter(
    ([, value]) => Boolean(value),
  );

  return (
    <div className={styles.page}>
      <SessionDetailHeader
        session={session}
        title={outline || plan?.learningGoal || "Chi tiết buổi học"}
        goal={outline ? plan?.learningGoal : undefined}
        sessionNo={sessionNo}
        view={view}
        loading={query.loading || path.loading}
        refresh={refresh}
        partner={partner.data}
        conversationId={path.data?.conversationId}
      />

      <Feedback error={query.error} reload={refresh} />
      <Feedback error={path.error} reload={path.reload} />

      <div className={styles.grid}>
        <section
          className={styles.actionSlot}
          aria-label="Hành động chính cho buổi học"
        >
          <SessionActionCard
            session={session}
            view={view}
            now={now}
            settled={settled}
            finished={finished}
            blocked={
              !!path.data && !["SCHEDULED", "ACTIVE"].includes(path.data.status)
            }
          />
        </section>

        <div className={styles.mainColumn}>
          <Panel className={styles.card}>
            <SessionCardHeading
              icon="book"
              title="Nội dung buổi học"
              subtitle="Nội dung đã thống nhất trong lộ trình"
            />
            <div className={styles.content}>
              <div className={styles.lessonOutlineBox}>
                {outline ||
                  plan?.learningGoal ||
                  (path.initialLoading ? (
                    <LoadingSkeleton
                      variant="inline"
                      label="Đang tải nội dung từ lộ trình"
                    />
                  ) : (
                    missingPathContent
                  ))}
              </div>
              <div className={styles.cardFooterLinks}>
                <Link
                  className={styles.inlineLink}
                  href={"/learn/paths/" + session.pathId}
                >
                  Xem lộ trình và kế hoạch
                  <ProductIcon name="arrow" size={15} />
                </Link>
                {path.data?.conversationId && (
                  <Link
                    className={styles.inlineLink}
                    href={`/learn/messages/${path.data.conversationId}`}
                  >
                    <ProductIcon name="chat" size={15} />
                    Trao đổi với đối tác
                  </Link>
                )}
              </div>
            </div>
          </Panel>

          <Panel className={styles.card}>
            <SessionCardHeading
              icon="users"
              title="Điểm danh và xác nhận"
              subtitle="Thời lượng và kết quả được máy chủ ghi nhận"
            />
            <SessionAttendanceStatus
              session={session}
              userId={actor.userId}
              loading={query.loading}
              refresh={refresh}
              hideRefresh
              partner={partner.data}
            />
          </Panel>

          <SessionMakeupPanel
            session={session}
            path={path.data}
            now={now}
            disabled={!!query.error || !!path.error || path.initialLoading}
          />

          {finished && !settled && (
            <section id="session-settlement" className={styles.after}>
              <SettlementStatusPanel pathId={session.pathId} />
            </section>
          )}

          {settled && path.data && (
            <section id="session-review" className={styles.after}>
              <Panel className={styles.card}>
                <SessionCardHeading
                  icon="shield"
                  tone="sage"
                  title="Đánh giá sau lộ trình"
                  subtitle="Thỏa thuận đã hoàn tất và quyết toán"
                />
                <div className={`${styles.content} ${styles.reviewCard}`}>
                  <p>
                    Thỏa thuận đã hoàn tất. Chia sẻ trải nghiệm hoặc xem phản
                    hồi của đối tác trên trang đánh giá riêng.
                  </p>
                  <div>
                    <Link
                      className="btn btn-primary"
                      href={`/learn/paths/${session.pathId}/review`}
                    >
                      Viết / xem đánh giá
                      <ProductIcon name="arrow" size={15} />
                    </Link>
                  </div>
                </div>
              </Panel>
            </section>
          )}

          <SessionProgress session={session} />
          <SessionWhiteboardPanel sessionId={id} />
          <SessionRecordingsPanel sessionId={id} />
        </div>

        <aside
          className={styles.sideColumn}
          aria-label="Lịch và quản lý buổi học"
        >
          <Panel className={styles.card}>
            <SessionCardHeading
              icon="calendar"
              title="Lịch và quản lý buổi học"
              subtitle="Thông tin lịch và các mốc thời hạn đang áp dụng"
            />
            <div className={styles.content}>
              <dl className={styles.deadlines}>
                <div className={styles.deadlineRow}>
                  <dt>Lịch hiện tại</dt>
                  <dd>{formatTime(session.startAt)}</dd>
                </div>
                {session.originalStartAt && (
                  <div className={styles.deadlineRow}>
                    <dt>Lịch ban đầu</dt>
                    <dd>{formatTime(session.originalStartAt)}</dd>
                  </div>
                )}
                <div className={styles.deadlineRow}>
                  <dt>Đổi lịch thông thường</dt>
                  <dd>
                    <span className={styles.quotaPill}>
                      {session.rescheduleCount ?? "—"} / 3 lần
                    </span>
                  </dd>
                </div>
                {session.makeupQuota && (
                  <div className={styles.deadlineRow}>
                    <dt>Lượt học bù còn lại</dt>
                    <dd>
                      <span className={styles.quotaPill}>
                        {session.makeupQuota.remaining} /{" "}
                        {session.makeupQuota.limit} lượt
                      </span>
                    </dd>
                  </div>
                )}
                {deadlineEntries.map(([key, value]) => (
                  <div
                    key={key}
                    className={`${styles.deadlineRow} ${styles.deadlineUrgent}`}
                  >
                    <dt>{deadlineLabel(key, session.attendance?.case)}</dt>
                    <dd>{formatTime(value!)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </Panel>

          {canReschedule && (
            <Panel className={styles.card}>
              <SessionCardHeading
                icon="calendar"
                title="Đổi lịch học"
                subtitle="Đề xuất thời gian mới cùng đối tác"
              />
              <div className={styles.content} id="session-reschedule-request">
                <p>
                  Hai bên cùng xác nhận lịch mới. Lịch hiện tại giữ hiệu lực cho
                  tới khi máy chủ áp dụng thay đổi.
                </p>
                <button
                  type="button"
                  className="btn"
                  aria-expanded={reschedule}
                  aria-controls="session-reschedule"
                  onClick={() => setReschedule(!reschedule)}
                >
                  <ProductIcon name="calendar" size={15} />
                  {reschedule ? "Đóng đề xuất" : "Xem / đề nghị lịch mới"}
                </button>
                {reschedule && path.data && (
                  <div
                    id="session-reschedule"
                    className={styles.rescheduleDrawer}
                  >
                    <SessionReschedule session={session} path={path.data} />
                  </div>
                )}
              </div>
            </Panel>
          )}

          <LearningChangePanel
            pathId={session.pathId}
            sessionId={id}
            startAt={session.startAt}
            canRequest={canRequestCancellation(session, now)}
            blocked={query.loading || !!query.error}
          />

          <details className={styles.disclosure}>
            <summary>
              <span className={styles.disclosureSummaryTitle}>
                <ProductIcon name="info" size={17} />
                Quy tắc tham gia, đổi lịch và học bù
              </span>
              <span className={styles.chevronIcon} aria-hidden="true">
                <ProductIcon name="chevron" size={16} />
              </span>
            </summary>
            <div className={styles.disclosureBody}>
              <AttendanceRules />
              <SessionLimits session={session} />
            </div>
          </details>
        </aside>
      </div>
    </div>
  );
}
