"use client";
import { useState } from "react";
import Link from "next/link";
import { useUserSession } from "../auth/session";
import { useUserResource } from "../hooks/use-user-resource";
import type { LearningSession, LearningPath } from "../types";
import { Feedback, Panel, formatTime } from "../components/common";
import { SessionReschedule } from "./session-reschedule";
import { useClock } from "../hooks/use-clock";
import { AttendanceRules } from "./attendance-rules";
import { sessionRefreshInterval } from "./attendance-presentation";
import { SessionAttendanceStatus } from "./session-attendance-status";
import { SessionLimits } from "./session-limits";
import { SessionMakeupPanel } from "./session-makeup-panel";
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
        <Link href="/learn/calendar" className={styles.link}>
          ← Lịch học
        </Link>
        <Feedback
          loading={query.initialLoading}
          error={query.error}
          reload={query.reload}
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
      />
      <Feedback error={query.error} reload={refresh} />
      <Feedback error={path.error} reload={path.reload} />
      <div className={styles.grid}>
        <div className={styles.column}>
          <Panel className={styles.card}>
            <SessionCardHeading
              icon="book"
              title="Nội dung buổi học"
              subtitle="Nội dung đã thống nhất trong lộ trình"
            />
            <div className={styles.content}>
              <p>
                {outline ||
                  plan?.learningGoal ||
                  "Đang tải nội dung từ lộ trình…"}
              </p>
              <Link
                className={styles.link}
                href={"/learn/paths/" + session.pathId}
              >
                Xem lộ trình và kế hoạch →
              </Link>
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
          <SessionProgress session={session} />
          {finished && !settled && (
            <section id="session-settlement" className={styles.after}>
              <SettlementStatusPanel pathId={session.pathId} />
            </section>
          )}
          {settled && path.data && (
            <section id="session-review" className={styles.after}>
              <Panel title="Đánh giá sau lộ trình">
                <p>
                  Thỏa thuận đã hoàn tất. Chia sẻ trải nghiệm hoặc xem phản hồi
                  của đối tác trên trang đánh giá riêng.
                </p>
                <Link
                  className="btn btn-primary"
                  href={`/learn/paths/${session.pathId}/review`}
                >
                  Viết / xem đánh giá
                </Link>
              </Panel>
            </section>
          )}
        </div>
        <aside
          className={styles.column}
          aria-label="Hành động và quản lý buổi học"
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
          <Panel className={styles.card}>
            <SessionCardHeading
              icon="calendar"
              title="Lịch và quản lý buổi học"
              subtitle="Thông tin lịch đang áp dụng"
            />
            <div className={styles.content}>
              <dl className={styles.deadlines}>
                <div>
                  <dt>Lịch hiện tại</dt>
                  <dd>{formatTime(session.startAt)}</dd>
                </div>
                {session.originalStartAt && (
                  <div>
                    <dt>Lịch ban đầu</dt>
                    <dd>{formatTime(session.originalStartAt)}</dd>
                  </div>
                )}
                <div>
                  <dt>Đổi lịch thông thường</dt>
                  <dd>{session.rescheduleCount ?? "—"} / 3 lần</dd>
                </div>
                {session.makeupQuota && (
                  <div>
                    <dt>Lượt học bù của bạn còn lại</dt>
                    <dd>
                      {session.makeupQuota.remaining} /{" "}
                      {session.makeupQuota.limit} lượt
                    </dd>
                  </div>
                )}
                {Object.entries(session.deadlines ?? {}).map(
                  ([key, value]) =>
                    value && (
                      <div key={key}>
                        <dt>
                          {
                            {
                              confirmBy: "Hạn xác nhận",
                              excuseOrReportBy:
                                session.attendance?.case === "BOTH_ABSENT"
                                  ? "Hạn báo cáo kết quả điểm danh"
                                  : "Hạn giải trình / báo cáo vắng",
                              makeupBy: "Hạn chốt lịch học bù",
                            }[key]
                          }
                        </dt>
                        <dd>{formatTime(value)}</dd>
                      </div>
                    ),
                )}
              </dl>
            </div>
          </Panel>
          {canReschedule && (
            <Panel className={styles.card}>
              <SessionCardHeading icon="calendar" title="Đổi lịch học" />
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
                  {reschedule ? "Đóng đề xuất" : "Xem / đề nghị lịch mới"}
                </button>
                {reschedule && path.data && (
                  <div id="session-reschedule">
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
            <summary>Quy tắc tham gia, đổi lịch và học bù</summary>
            <div>
              <AttendanceRules />
              <SessionLimits session={session} />
            </div>
          </details>
        </aside>
      </div>
    </div>
  );
}
