"use client";
import { LoadingButton } from "@/components/loading-button";
import { formatVietnamDayMonth, formatVietnamTime } from "@/lib/vietnam-time";
import Link from "next/link";
import { useState } from "react";
import type { LearningPath, Plan } from "../types";
import { useUserSession } from "../auth/session";
import { useUserCommand } from "../hooks/use-user-command";
import { CommandFeedback, Status, formatTime } from "../components/common";
import { ProductIcon } from "../components/product-icon";
import { PlanEditor } from "./plan-editor";
import { ScheduleEditor } from "./schedule-editor";
import styles from "./path-detail.module.css";

function minutesBetween(startAt: string, endAt: string) {
  const diff = Math.round((Date.parse(endAt) - Date.parse(startAt)) / 60000);
  return Number.isFinite(diff) && diff > 0 ? diff : null;
}

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
  const { actor, request } = useUserSession();
  const command = useUserCommand();
  const [edit, setEdit] = useState(false);
  const [editSchedule, setEditSchedule] = useState(false);

  const teacher = actor.userId === plan.teacherId;
  const editable =
    path.lockedVersion === null &&
    agreementReady &&
    ["PROPOSED", "PARTIALLY_CONFIRMED", "CONFIRMED"].includes(path.status);

  const isParticipantA = actor.userId === path.participantAId;
  const ownScheduleConfirmed = isParticipantA
    ? plan.schedule?.participantAConfirmedAt
    : plan.schedule?.participantBConfirmedAt;
  const partnerScheduleConfirmed = isParticipantA
    ? plan.schedule?.participantBConfirmedAt
    : plan.schedule?.participantAConfirmedAt;

  const proposeScheduleLabel = plan.schedule
    ? "Điều chỉnh lịch dự kiến"
    : "Đề nghị lịch học";
  const scheduleLabel = editSchedule
    ? "Đóng chỉnh sửa lịch"
    : proposeScheduleLabel;

  const outlineBySessionNo = new Map(
    plan.sessionOutline.map((item) => [item.sessionNo, item.content]),
  );
  const completedCount = plan.sessions.filter(
    (item) => item.status === "COMPLETED",
  ).length;

  return (
    <div
      id={mode === "schedule" ? "schedule-plan-" + plan.id : undefined}
      tabIndex={-1}
    >
      <section className={styles.planCard}>
        <div className={styles.planHeader}>
          <div className={styles.planHeaderLeft}>
            <span
              className={
                styles.planRoleBadge +
                " " +
                (teacher ? styles.planRoleTeach : styles.planRoleLearn)
              }
            >
              <ProductIcon name={teacher ? "book" : "award"} size={13} />
              {teacher ? "Kế hoạch bạn hướng dẫn" : "Kế hoạch bạn học"}
            </span>
            <h3 className={styles.planGoal}>{plan.learningGoal}</h3>
          </div>

          <div className={styles.planMetaPills}>
            <Status value={plan.status} />
            <span className={styles.countPill}>
              <ProductIcon name="calendar" size={13} />
              {plan.sessions.length > 0
                ? `${completedCount}/${plan.sessions.length} buổi xong`
                : `${plan.totalSessions} buổi`}
            </span>
          </div>
        </div>

        {mode === "plan" && (
          <>
            <ol className={styles.outlineList}>
              {plan.sessionOutline.map((item) => (
                <li key={item.sessionNo} className={styles.outlineItem}>
                  <span className={styles.outlineNum}>{item.sessionNo}</span>
                  <div className={styles.outlineBody}>
                    <strong>Buổi {item.sessionNo}</strong>
                    <p>{item.content}</p>
                  </div>
                </li>
              ))}
            </ol>

            {editable && (
              <div className={styles.actionRow}>
                {!teacher && !plan.learnerConfirmedAt && (
                  <LoadingButton
                    type="button"
                    className="btn btn-primary"
                    disabled={command.pending || command.uncertain}
                    onClick={() => {
                      void command.run(
                        "plan:" + plan.id + ":" + plan.version,
                        () =>
                          request(
                            "learning-paths/plans/" + plan.id + "/confirm",
                            {
                              method: "POST",
                              body: { expectedVersion: plan.version },
                            },
                          ),
                      );
                    }}
                    loading={!!command.pending}
                  >
                    <ProductIcon name="check" size={16} />
                    Xác nhận kế hoạch
                  </LoadingButton>
                )}

                {teacher && (
                  <button
                    type="button"
                    className="btn"
                    onClick={() => setEdit(!edit)}
                  >
                    {edit ? "Đóng chỉnh sửa" : "Chỉnh sửa kế hoạch"}
                  </button>
                )}
              </div>
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
            {!plan.sessions.length && (
              <>
                <div className={styles.sectionSubhead}>
                  <h4>Lịch dự kiến</h4>
                  {plan.schedule && <Status value={plan.schedule.status} />}
                </div>

                {plan.schedule ? (
                  <>
                    <div className={styles.confirmGrid}>
                      <div
                        className={
                          styles.confirmParticipant +
                          (ownScheduleConfirmed
                            ? ` ${styles.confirmParticipantDone}`
                            : "")
                        }
                      >
                        <div className={styles.confirmParticipantLabel}>
                          <small>Xác nhận lịch</small>
                          <strong>Bạn</strong>
                        </div>
                        <span
                          className={
                            styles.confirmBadge +
                            " " +
                            (ownScheduleConfirmed
                              ? styles.confirmBadgeDone
                              : styles.confirmBadgeWait)
                          }
                        >
                          <ProductIcon
                            name={ownScheduleConfirmed ? "check" : "clock"}
                            size={12}
                          />
                          {ownScheduleConfirmed
                            ? "Đã xác nhận"
                            : "Chưa xác nhận"}
                        </span>
                      </div>

                      <div
                        className={
                          styles.confirmParticipant +
                          (partnerScheduleConfirmed
                            ? ` ${styles.confirmParticipantDone}`
                            : "")
                        }
                      >
                        <div className={styles.confirmParticipantLabel}>
                          <small>Xác nhận lịch</small>
                          <strong>Đối tác</strong>
                        </div>
                        <span
                          className={
                            styles.confirmBadge +
                            " " +
                            (partnerScheduleConfirmed
                              ? styles.confirmBadgeDone
                              : styles.confirmBadgeWait)
                          }
                        >
                          <ProductIcon
                            name={partnerScheduleConfirmed ? "check" : "clock"}
                            size={12}
                          />
                          {partnerScheduleConfirmed
                            ? "Đã xác nhận"
                            : "Chờ xác nhận"}
                        </span>
                      </div>
                    </div>

                    <ul className={styles.slotList}>
                      {plan.schedule.items.map((item) => {
                        const mins = minutesBetween(item.startAt, item.endAt);
                        const topic = outlineBySessionNo.get(item.sessionNo);
                        return (
                          <li key={item.sessionNo} className={styles.slotItem}>
                            <div className={styles.slotLeft}>
                              <span className={styles.slotBadge}>
                                Buổi {item.sessionNo}
                              </span>
                              <div className={styles.slotTimeWrap}>
                                <strong>
                                  {formatTime(item.startAt)} –{" "}
                                  {formatVietnamTime(item.endAt)}
                                </strong>
                                {topic && <small>{topic}</small>}
                              </div>
                            </div>
                            {mins && (
                              <span className={styles.durationPill}>
                                <ProductIcon name="clock" size={13} />
                                {mins} phút
                              </span>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </>
                ) : (
                  <p className={styles.metaNote}>
                    {plan.learnerConfirmedAt
                      ? "Người hướng dẫn có thể đề nghị khung giờ các buổi học để hai bên cùng xác nhận."
                      : "Xác nhận kế hoạch học trước khi đề nghị lịch học."}
                  </p>
                )}

                <div className={styles.actionRow}>
                  {editable &&
                    plan.schedule &&
                    plan.schedule.appliedVersion === null && (
                      <LoadingButton
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
                                  body: {
                                    expectedVersion: plan.schedule!.version,
                                  },
                                },
                              ),
                          );
                        }}
                        loading={!!command.pending}
                      >
                        <ProductIcon name="check" size={16} />
                        {ownScheduleConfirmed
                          ? "Bạn đã xác nhận lịch"
                          : "Xác nhận lịch này"}
                      </LoadingButton>
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
                        <ProductIcon name="calendar" size={16} />
                        {scheduleLabel}
                      </button>
                    )}
                </div>

                {editSchedule && editable && teacher && (
                  <ScheduleEditor
                    key={plan.schedule?.version ?? "new"}
                    plan={plan}
                    onSaved={() => setEditSchedule(false)}
                  />
                )}
              </>
            )}

            {!!plan.sessions.length && (
              <>
                <div className={styles.sectionSubhead}>
                  <h4>Danh sách buổi học đã chốt</h4>
                  <span className="muted">
                    Hoàn thành {completedCount}/{plan.sessions.length} buổi
                  </span>
                </div>

                <div className={styles.sessionList}>
                  {plan.sessions.map((session) => {
                    const topic = outlineBySessionNo.get(session.sessionNo);
                    const mins = minutesBetween(session.startAt, session.endAt);
                    const done = session.status === "COMPLETED";
                    return (
                      <article
                        key={session.id}
                        className={
                          styles.sessionRow +
                          (done ? ` ${styles.sessionRowCompleted}` : "")
                        }
                      >
                        <div
                          className={
                            styles.dateTile +
                            (done ? ` ${styles.dateTileDone}` : "")
                          }
                        >
                          <strong>
                            {formatVietnamDayMonth(session.startAt)}
                          </strong>
                          <span>{formatVietnamTime(session.startAt)}</span>
                        </div>

                        <div className={styles.sessionInfo}>
                          <div className={styles.sessionInfoTop}>
                            <span className={styles.sessionNo}>
                              Buổi {session.sessionNo}
                            </span>
                            <Status value={session.status} />
                          </div>
                          {topic && (
                            <p className={styles.sessionTopic}>{topic}</p>
                          )}
                          <span className={styles.sessionTimeLine}>
                            <ProductIcon name="clock" size={13} />
                            {formatTime(session.startAt)} –{" "}
                            {formatVietnamTime(session.endAt)}
                            {mins ? ` (${mins} phút)` : ""}
                          </span>
                        </div>

                        <Link
                          className={`btn btn-primary btn-sm ${styles.sessionAction}`}
                          href={"/learn/sessions/" + session.id}
                        >
                          {done ? "Xem lại buổi" : "Chi tiết / vào học"}
                          <ProductIcon name="arrow" size={14} />
                        </Link>
                      </article>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}

        <CommandFeedback command={command} />
      </section>
    </div>
  );
}
