"use client";
import Link from "next/link";
import { useState } from "react";
import type { LearningPath, Plan } from "../types";
import { useUserSession } from "../auth/session";
import { useUserCommand } from "../hooks/use-user-command";
import {
  CommandFeedback,
  Panel,
  Status,
  formatTime,
} from "../components/common";
import { PlanEditor } from "./plan-editor";
import { ScheduleEditor } from "./schedule-editor";
export function PlanPanel({
  path,
  plan,
  agreementReady,
  mode = "plan",
}: Readonly<{
  path: LearningPath;
  plan: Plan;
  agreementReady: boolean;
  mode?: "plan" | "schedule";
}>) {
  const { actor, request } = useUserSession(),
    command = useUserCommand();
  const [edit, setEdit] = useState(false),
    [editSchedule, setEditSchedule] = useState(false);
  const teacher = actor.userId === plan.teacherId,
    editable =
      path.lockedVersion === null &&
      agreementReady &&
      ["PROPOSED", "PARTIALLY_CONFIRMED", "CONFIRMED"].includes(path.status);
  const ownScheduleConfirmed =
    actor.userId === path.participantAId
      ? plan.schedule?.participantAConfirmedAt
      : plan.schedule?.participantBConfirmedAt;
  const proposeScheduleLabel = plan.schedule
    ? "Điều chỉnh lịch dự kiến"
    : "Đề nghị lịch học";
  const scheduleLabel = editSchedule
    ? "Đóng đề nghị lịch"
    : proposeScheduleLabel;
  return (
    <Panel title={teacher ? "Kế hoạch bạn hướng dẫn" : "Kế hoạch bạn học"}>
      <p className="panel-kicker">
        {teacher ? "BẠN HƯỚNG DẪN" : "BẠN ĐANG HỌC"}
      </p>
      <Status value={plan.status} />
      {mode === "plan" && (
        <>
          <h3>{plan.learningGoal}</h3>
          <ol>
            {plan.sessionOutline.map((item) => (
              <li key={item.sessionNo} className="learner-prose">
                <strong>Buổi {item.sessionNo}</strong>
                <span>{item.content}</span>
              </li>
            ))}
          </ol>
          <p>
            {plan.totalSessions} buổi · Phiên bản {plan.version}
          </p>
          {editable && !teacher && !plan.learnerConfirmedAt && (
            <button
              type="button"
              className="btn btn-primary"
              disabled={command.pending || command.uncertain}
              onClick={() => {
                void command.run("plan:" + plan.id + ":" + plan.version, () =>
                  request("learning-paths/plans/" + plan.id + "/confirm", {
                    method: "POST",
                    body: { expectedVersion: plan.version },
                  }),
                );
              }}
            >
              Tôi xác nhận kế hoạch phiên bản này
            </button>
          )}
          {editable && teacher && (
            <button
              type="button"
              className="btn"
              onClick={() => setEdit(!edit)}
            >
              {edit ? "Đóng chỉnh sửa" : "Chỉnh sửa kế hoạch"}
            </button>
          )}
          {edit && editable && teacher && (
            <PlanEditor
              key={plan.version}
              path={path}
              plan={plan}
              onSaved={() => setEdit(false)}
            />
          )}
        </>
      )}
      {mode === "schedule" && (
        <>
          <h3>{plan.learningGoal}</h3>
          <h3>Lịch dự kiến</h3>
          {plan.schedule ? (
            <>
              <Status value={plan.schedule.status} />
              <ul>
                {plan.schedule.items.map((item) => (
                  <li key={item.sessionNo}>
                    Buổi {item.sessionNo}: {formatTime(item.startAt)} –{" "}
                    {formatTime(item.endAt)}
                  </li>
                ))}
              </ul>
              {editable && plan.schedule.appliedVersion === null && (
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={
                    !!ownScheduleConfirmed ||
                    command.pending ||
                    command.uncertain
                  }
                  onClick={() => {
                    void command.run(
                      "schedule:" +
                        plan.schedule!.id +
                        ":" +
                        plan.schedule!.version,
                      () =>
                        request(
                          "schedule-proposals/" +
                            plan.schedule!.id +
                            "/confirm",
                          {
                            method: "POST",
                            body: { expectedVersion: plan.schedule!.version },
                          },
                        ),
                    );
                  }}
                >
                  {ownScheduleConfirmed
                    ? "Bạn đã xác nhận lịch này"
                    : "Xác nhận lịch phiên bản này"}
                </button>
              )}
            </>
          ) : (
            <p className="muted">
              Chưa có lịch. Cần đủ xác nhận kế hoạch trước khi đề nghị giờ học.
            </p>
          )}
          {editable &&
            teacher &&
            path.status === "CONFIRMED" &&
            plan.learnerConfirmedAt && (
              <button
                type="button"
                className="btn"
                onClick={() => setEditSchedule(!editSchedule)}
              >
                {scheduleLabel}
              </button>
            )}
          {editSchedule && editable && teacher && (
            <ScheduleEditor
              key={plan.schedule?.version ?? "new"}
              plan={plan}
              onSaved={() => setEditSchedule(false)}
            />
          )}
          {!!plan.sessions.length && (
            <>
              <h3>Buổi học đã chốt</h3>
              <div className="learner-stack">
                {plan.sessions.map((session) => (
                  <div key={session.id}>
                    <Status value={session.status} />
                    <p>
                      Buổi {session.sessionNo} · {formatTime(session.startAt)}
                    </p>
                    <Link
                      className="btn btn-primary"
                      href={"/learn/sessions/" + session.id}
                    >
                      Chi tiết / vào học
                    </Link>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
      <CommandFeedback command={command} />
    </Panel>
  );
}
