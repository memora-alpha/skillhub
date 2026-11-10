import Link from "next/link";
import type { LearningPath, LearningSession } from "../types";
import { Panel, formatTime } from "../components/common";
import { SessionCardHeading } from "./session-detail-sections";
import { SessionReschedule } from "./session-reschedule";
import { sessionMakeupState } from "./session-makeup-policy";
import styles from "./session-detail.module.css";

export function SessionMakeupPanel({
  session,
  path,
  now,
  disabled,
}: Readonly<{
  session: LearningSession;
  path?: LearningPath;
  now: number;
  disabled: boolean;
}>) {
  const state = sessionMakeupState(session, now, path?.status);
  if (!state) return null;
  const granted = session.status === "MAKEUP_REQUIRED";
  const schedule = path?.plans.find(
    (plan) => plan.id === session.planId,
  )?.schedule;
  const confirming =
    granted &&
    schedule?.appliedVersion != null &&
    schedule.version > schedule.appliedVersion;
  const deadline = granted
    ? session.deadlines?.makeupBy
    : session.deadlines?.excuseOrReportBy;
  return (
    <section id="session-makeup" className={styles.after}>
      <Panel className={styles.card}>
        <SessionCardHeading
          icon="calendar"
          title={
            granted
              ? "Thống nhất lịch học bù"
              : "Bước tiếp theo khi cả hai vắng"
          }
          subtitle="Theo dõi kết quả và cùng đối tác thống nhất lịch mới"
        />
        <div className={`${styles.content} ${styles.makeupContent}`}>
          <ol className={styles.makeupSteps} aria-label="Tiến trình học bù">
            {[
              "Chốt kết quả điểm danh",
              "Đề xuất lịch học bù",
              "Hai bên xác nhận lịch mới",
            ].map((label, index) => {
              function makeupStep() {
                if (confirming) {
                  return 2;
                }
                if (granted) {
                  return 1;
                }
                return 0;
              }
              return (
                <li
                  key={label}
                  aria-current={index === makeupStep() ? "step" : undefined}
                >
                  <span>{index + 1}</span>
                  {label}
                </li>
              );
            })}
          </ol>
          {state === "waiting" && (
            <output>
              Kết quả cả hai vắng còn trong thời hạn phản hồi. Khi hết hạn, nếu
              đủ điều kiện và không có báo cáo đang mở, hệ thống tự cấp học bù
              để hai bạn thống nhất lịch mới, không cần Staff duyệt lịch.
            </output>
          )}
          {state === "processing" && (
            <output>
              Đang chờ máy chủ cập nhật kết quả và quyền học bù. Trang tự kiểm
              tra lại mỗi 30 giây; form chọn lịch sẽ xuất hiện khi được phép.
            </output>
          )}
          {deadline && state !== "blocked" && (
            <div className={styles.inset}>
              <strong>
                {granted
                  ? "Hạn hai bên chốt lịch học bù"
                  : "Hạn phản hồi kết quả điểm danh"}
              </strong>
              <p>{formatTime(deadline)} (giờ Việt Nam)</p>
            </div>
          )}
          {state === "available" && (
            <>
              <p>
                Buổi học đã được cấp học bù. Một người đề xuất thời gian, sau đó
                cả hai xác nhận để áp dụng lịch mới. Hai bạn có thể tự thực hiện
                ngay tại đây, không cần Staff duyệt lịch.
              </p>
              {session.makeupQuota && (
                <p className="muted">
                  Lượt học bù đã được tính khi cấp cho buổi này. Bạn còn{" "}
                  {session.makeupQuota.remaining} lượt cho các buổi khác trong
                  thỏa thuận.
                </p>
              )}
              {path ? (
                <SessionReschedule
                  key={schedule?.version ?? session.id}
                  session={session}
                  path={path}
                  disabled={disabled}
                />
              ) : (
                <output>
                  Đang chờ tải lịch trong lộ trình. Bạn có thể dùng nút Làm mới
                  ở đầu trang nếu chưa tải được.
                </output>
              )}
            </>
          )}
          {state === "closed" && (
            <output>
              Đã hết hạn chốt lịch học bù. Không thể gửi hoặc xác nhận lịch mới;
              đang chờ hệ thống cập nhật hướng xử lý tiếp theo.
            </output>
          )}
          {state === "blocked" && (
            <>
              <p>
                Buổi học hoặc thỏa thuận đang bị chặn xử lý. Theo dõi kết quả
                trong lộ trình trước khi chọn lịch học bù.
              </p>
              <Link className="btn" href={`/learn/paths/${session.pathId}`}>
                Theo dõi xử lý trong lộ trình
              </Link>
            </>
          )}
          {state === "waiting" &&
            session.allowedActions?.includes("REPORT_NO_SHOW") && (
              <Link
                className={styles.link}
                href={`/learn/reports/new?sessionId=${session.id}`}
              >
                Kết quả chưa đúng hoặc có sự cố? Gửi báo cáo
              </Link>
            )}
        </div>
      </Panel>
    </section>
  );
}
