"use client";
import Link from "next/link";
import { useState } from "react";
import { useUserSession } from "../auth/session";
import { useUserResource } from "../hooks/use-user-resource";
import { useUserCommand } from "../hooks/use-user-command";
import type { LearningSession, LearningPath } from "../types";
import {
  Back,
  CommandFeedback,
  Feedback,
  PageHeading,
  Panel,
  Status,
  formatTime,
} from "../components/common";
import { canEnterSession } from "./session-policy";
import { UserApiError, userErrorText } from "../api/client";
import { SessionReschedule } from "./session-reschedule";
import { useClock } from "../hooks/use-clock";
export function SessionDetail({ id }: Readonly<{ id: string }>) {
  const now = useClock();
  const query = useUserResource<LearningSession>("sessions/" + id),
    { request } = useUserSession(),
    command = useUserCommand();
  const path = useUserResource<LearningPath>(
      query.data ? "learning-paths/" + query.data.pathId : null,
    ),
    session = query.data;
  const [confirm, setConfirm] = useState(false),
    [reschedule, setReschedule] = useState(false);
  const plan = path.data?.plans.find((item) => item.id === session?.planId);
  const allowed = session?.allowedActions ?? [];
  return (
    <>
      <Back href="/learn/calendar" />
      <Feedback
        loading={query.loading}
        error={query.error}
        reload={query.reload}
      />
      {session && (
        <>
          <PageHeading
            title={plan?.learningGoal ?? "Chi tiết buổi học"}
            description={
              formatTime(session.startAt) + " – " + formatTime(session.endAt)
            }
            action={<Status value={session.status} />}
          />
          <div className="learner-two-columns">
            <div className="learner-stack">
              <Panel title="Buổi học của bạn">
                <p>
                  Thời lượng:{" "}
                  {(Date.parse(session.endAt) - Date.parse(session.startAt)) /
                    60000}{" "}
                  phút · Một buổi trong lộ trình đã chốt.
                </p>
                {plan && (
                  <p>
                    {
                      plan.sessionOutline.find(
                        (item) =>
                          item.sessionNo ===
                          plan.sessions.find((item) => item.id === id)
                            ?.sessionNo,
                      )?.content
                    }
                  </p>
                )}
                <Link className="btn" href={"/learn/paths/" + session.pathId}>
                  Xem lộ trình và kế hoạch
                </Link>
              </Panel>
              <Panel title="Điểm danh và xác nhận">
                {session.attendance?.state === "PENDING_DATA" && (
                  <p className="learner-notice">
                    Hệ thống đang tổng hợp điểm danh. Tải lại sau để kiểm tra.
                  </p>
                )}
                {(["teacher", "learner"] as const).map((side) => {
                  const value = session.attendance?.[side];
                  return (
                    value && (
                      <p key={side}>
                        {side === "teacher" ? "Người dạy" : "Người học"}:{" "}
                        {value.verdict === "PRESENT"
                          ? "Có mặt"
                          : value.verdict === "ABSENT"
                            ? "Vắng mặt"
                            : "Chưa xác minh"}{" "}
                        · {value.seconds} giây
                      </p>
                    )
                  );
                })}
                {session.deadlines &&
                  Object.entries(session.deadlines).map(
                    ([key, value]) =>
                      value && (
                        <p key={key}>
                          {
                            {
                              confirmBy: "Hạn xác nhận",
                              excuseOrReportBy: "Hạn giải trình/báo cáo",
                              makeupBy: "Hạn học bù",
                            }[key]
                          }
                          : {formatTime(value)}
                        </p>
                      ),
                  )}
                {allowed.includes("CONFIRM_COMPLETION") && (
                  <>
                    <label>
                      <input
                        type="checkbox"
                        checked={confirm}
                        onChange={(event) => setConfirm(event.target.checked)}
                      />{" "}
                      Tôi xác nhận đã tham gia buổi học này.
                    </label>
                    <button
                      className="btn btn-primary"
                      disabled={
                        !confirm ||
                        command.pending ||
                        command.uncertain ||
                        query.loading
                      }
                      onClick={() => {
                        void command
                          .run("complete:" + id, async () => {
                            const fresh = (
                              await request<LearningSession>("sessions/" + id)
                            ).data;
                            if (
                              !fresh.allowedActions?.includes(
                                "CONFIRM_COMPLETION",
                              )
                            )
                              throw new UserApiError(
                                409,
                                "SESSION_CANNOT_BE_COMPLETED",
                              );
                            return request(
                              "sessions/" + id + "/confirm-completion",
                              { method: "POST", body: {} },
                            );
                          })
                          .then((result) => {
                            if (result) setConfirm(false);
                          });
                      }}
                    >
                      Xác nhận hoàn tất buổi học
                    </button>
                  </>
                )}
                {session.excuse && (
                  <p>
                    Giải trình: {session.excuse.reason} ·{" "}
                    {session.excuse.status === "PENDING"
                      ? "Chờ phản hồi"
                      : session.excuse.status === "ACCEPTED"
                        ? "Đã chấp nhận"
                        : "Không chấp nhận"}
                  </p>
                )}
                {allowed.includes("SUBMIT_EXCUSE") && (
                  <form
                    className="learner-form"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const reason = String(
                        new FormData(event.currentTarget).get("reason"),
                      ).trim();
                      void command.run("excuse:" + id + ":" + reason, () =>
                        request("sessions/" + id + "/absence-excuse", {
                          method: "POST",
                          body: { reason },
                        }),
                      );
                    }}
                  >
                    <label>
                      Lý do vắng học
                      <textarea
                        name="reason"
                        minLength={10}
                        maxLength={1000}
                        required
                        disabled={command.pending || command.uncertain}
                      />
                    </label>
                    <button
                      className="btn"
                      disabled={command.pending || command.uncertain}
                    >
                      Gửi giải trình
                    </button>
                  </form>
                )}
                {allowed.includes("DECIDE_EXCUSE") && (
                  <div className="learner-actions">
                    {[true, false].map((accept) => (
                      <button
                        className="btn"
                        key={String(accept)}
                        disabled={command.pending || command.uncertain}
                        onClick={() => {
                          void command.run("decide:" + id + ":" + accept, () =>
                            request(
                              "sessions/" + id + "/absence-excuse/decision",
                              { method: "POST", body: { accept } },
                            ),
                          );
                        }}
                      >
                        {accept
                          ? "Chấp nhận và học bù"
                          : "Không chấp nhận lý do"}
                      </button>
                    ))}
                  </div>
                )}
                <CommandFeedback command={command} />
                <p className="muted">
                  Rời phòng không tự xác nhận hoàn tất. Điểm danh và kết quả do
                  máy chủ ghi nhận.
                </p>
              </Panel>
            </div>
            <div className="learner-stack">
              <Panel title="Phòng học trực tuyến">
                {canEnterSession(session, now) ? (
                  <Link
                    className="btn btn-primary"
                    href={"/learn/sessions/" + id + "/room"}
                  >
                    Vào phòng học
                  </Link>
                ) : (
                  <p className="learner-notice">
                    {userErrorText(
                      409,
                      session.join?.reason ?? "SESSION_NOT_JOINABLE",
                    )}
                  </p>
                )}
                {session.join?.opensAt && (
                  <p>Mở phòng: {formatTime(session.join.opensAt)}</p>
                )}
                <button
                  className="btn"
                  disabled={query.loading}
                  onClick={query.reload}
                >
                  Kiểm tra lại phòng
                </button>
              </Panel>
              {(allowed.includes("PROPOSE_MAKEUP") ||
                (["CONFIRMED", "READY"].includes(session.status) &&
                  Date.parse(session.startAt) - now >= 3600000)) && (
                <Panel
                  title={
                    session.status === "MAKEUP_REQUIRED"
                      ? "Thống nhất lịch học bù"
                      : "Đổi lịch học"
                  }
                >
                  <p>
                    Hai bên cần xác nhận cùng phiên bản lịch. Lịch mới chỉ áp
                    dụng khi máy chủ chấp nhận.
                  </p>
                  <button
                    className="btn"
                    onClick={() => setReschedule(!reschedule)}
                  >
                    {reschedule ? "Đóng" : "Xem / đề nghị lịch mới"}
                  </button>
                  {reschedule && path.data && (
                    <SessionReschedule session={session} path={path.data} />
                  )}
                </Panel>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
