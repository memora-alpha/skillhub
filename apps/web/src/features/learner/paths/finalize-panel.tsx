"use client";
import { LoadingButton } from "@/components/loading-button";
import { formatVietnamTime } from "@/lib/vietnam-time";
import Link from "next/link";
import { useRef, useState } from "react";
import { useUserSession } from "../auth/session";
import { useUserCommand } from "../hooks/use-user-command";
import {
  CommandFeedback,
  Feedback,
  Panel,
  formatTime,
} from "../components/common";
import { ProductIcon } from "../components/product-icon";
import type { LearningPath } from "../types";
import {
  commitmentSnapshot,
  finalizeWithRecovery,
  reviewedFinalizeIntent,
  readFinalizePath,
  type FinalizeIntent,
} from "./finalize-recovery";
import { PathAgreementSummary } from "./agreement-summary";
import { InvalidScheduleNotice } from "./invalid-schedule";
import styles from "./path-detail.module.css";

export function FinalizePanel({
  path,
  blocked,
  onEditSchedule,
}: Readonly<{
  path: LearningPath;
  blocked: boolean;
  onEditSchedule: (planId: string) => void;
}>) {
  const { actor, request, refresh } = useUserSession();
  const storageKey =
    "skillhub-user-draft:" + actor.userId + ":finalize:" + path.id;
  const [saved, setSaved] = useState<FinalizeIntent | null>(() => {
    try {
      const value = JSON.parse(
        sessionStorage.getItem(storageKey) ?? "null",
      ) as FinalizeIntent | null;
      return value?.pathId === path.id &&
        value.snapshot?.id === path.id &&
        typeof value.signature === "string" &&
        /^[0-9a-f-]{36}$/i.test(value.key) &&
        Number.isSafeInteger(value.version) &&
        value.snapshot?.agreement &&
        Array.isArray(value.snapshot.plans) &&
        value.snapshot.plans.every((plan) => Array.isArray(plan.sessions)) &&
        commitmentSnapshot(value.snapshot) === value.signature
        ? value
        : null;
    } catch {
      return null;
    }
  });
  const intent = useRef(saved);
  const command = useUserCommand(true);
  const [reviewedSignature, setReviewedSignature] = useState<string | null>(
    null,
  );
  const [checking, setChecking] = useState(false);
  const [notice, setNotice] = useState<string>();
  const [checkError, setCheckError] = useState<string>();
  const [result, setResult] = useState<LearningPath>();
  const [canReset, setCanReset] = useState(false);

  const clear = () => {
    intent.current = null;
    setSaved(null);
    try {
      sessionStorage.removeItem(storageKey);
    } catch {
      /* In-memory state remains available. */
    }
  };

  const show = result ?? path;
  const signature = commitmentSnapshot(show);
  const reviewed = reviewedSignature === signature;
  let submitLabel = "Hoàn thành thiết lập và giữ Credit";
  if (command.pending) submitLabel = "Đang kiểm tra và chốt…";
  else if (saved) submitLabel = "Kiểm tra và thử lại";

  return (
    <Panel title="Chốt lịch & tạm giữ Credit">
      <div className={styles.finalizeBox}>
        {saved && (
          <details className={styles.savedDetails} open>
            <summary>
              Bản đã gửi cần đối chiếu · phiên bản {saved.version}
            </summary>
            <div style={{ marginTop: 12 }}>
              <PathAgreementSummary path={saved.snapshot} />
            </div>
            {saved.snapshot.plans.map((plan) => (
              <div key={plan.id} style={{ marginTop: 10 }}>
                <strong>{plan.learningGoal}</strong>
                {plan.schedule?.items.map((slot) => (
                  <p key={slot.sessionNo} className={styles.metaNote}>
                    Buổi {slot.sessionNo}: {formatTime(slot.startAt)} –{" "}
                    {formatVietnamTime(slot.endAt)}
                  </p>
                ))}
              </div>
            ))}
          </details>
        )}

        {show.lockedVersion !== null ? (
          <div className={styles.finalizeSuccess}>
            <div className={styles.finalizeSuccessHead}>
              <ProductIcon name="check" size={20} />
              <output>Lộ trình đã chốt lịch thành công!</output>
            </div>
            <ul className={styles.slotList}>
              {show.plans
                .flatMap((plan) => plan.sessions)
                .map((session) => (
                  <li key={session.id} className={styles.slotItem}>
                    <div className={styles.slotLeft}>
                      <span className={styles.slotBadge}>
                        Buổi {session.sessionNo}
                      </span>
                      <div className={styles.slotTimeWrap}>
                        <strong>{formatTime(session.startAt)}</strong>
                      </div>
                    </div>
                    <Link
                      className="btn btn-sm"
                      href={"/learn/sessions/" + session.id}
                    >
                      Mở buổi học
                    </Link>
                  </li>
                ))}
            </ul>
            <div className={styles.actionRow}>
              <Link className="btn btn-primary" href="/learn/calendar">
                <ProductIcon name="calendar" size={16} />
                Mở lịch học của tôi
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className={styles.finalizeCallout}>
              <span className={styles.finalizeCalloutIcon}>
                <ProductIcon name="shield" size={20} />
              </span>
              <div>
                <h3>Khóa lịch học và bảo vệ Credit an toàn</h3>
                <p>
                  Khi bấm hoàn thành, hệ thống sẽ chốt các buổi học trên lịch và
                  tạm giữ Credit theo đúng thỏa thuận. Credit chỉ được quyết
                  toán sau khi lộ trình hoàn tất đủ điều kiện.
                </p>
              </div>
            </div>

            <label
              className={
                styles.consentCard +
                (reviewed ? ` ${styles.consentCardChecked}` : "")
              }
            >
              <input
                type="checkbox"
                checked={reviewed}
                disabled={command.pending || !!saved}
                onChange={(e) =>
                  setReviewedSignature(e.target.checked ? signature : null)
                }
              />
              <span>
                Tôi đã xem lại thỏa thuận, kế hoạch từng buổi, lịch học và đồng
                ý giữ Credit theo thỏa thuận này.
              </span>
            </label>

            <div className={styles.actionRow}>
              <LoadingButton
                type="button"
                className="btn btn-primary"
                disabled={
                  blocked ||
                  checking ||
                  command.pending ||
                  (!saved && (!reviewed || path.status !== "CONFIRMED")) ||
                  (command.uncertain && !command.canRetry)
                }
                onClick={() => {
                  const currentSig =
                    saved?.signature ?? commitmentSnapshot(show);
                  void command
                    .run(currentSig, async (key) => {
                      const current = intent.current ?? {
                        pathId: path.id,
                        version: show.currentVersion,
                        signature: currentSig,
                        snapshot: show,
                        key,
                      };
                      intent.current = current;
                      setSaved(current);
                      try {
                        sessionStorage.setItem(
                          storageKey,
                          JSON.stringify(current),
                        );
                      } catch {
                        setNotice(
                          "Không lưu được yêu cầu vào trình duyệt. Giữ màn hình này để kiểm tra lại cùng yêu cầu.",
                        );
                      }
                      return finalizeWithRecovery(request, current);
                    })
                    .then((outcome) => {
                      if (
                        outcome?.path.lockedVersion !== null &&
                        outcome?.path
                      ) {
                        setResult(outcome.path);
                        clear();
                        setNotice(
                          outcome.recovered
                            ? "Đã tìm thấy lịch học đã chốt."
                            : "Chốt lịch thành công.",
                        );
                      }
                    });
                }}
                loading={!!(checking || command.pending)}
              >
                <ProductIcon name="check" size={16} />
                {submitLabel}
              </LoadingButton>

              <LoadingButton
                type="button"
                className="btn"
                disabled={checking || command.pending}
                onClick={async () => {
                  setChecking(true);
                  setCheckError(undefined);
                  setCanReset(false);
                  try {
                    const latest = await readFinalizePath(request, path.id);
                    setResult(latest);
                    refresh();
                    if (latest.lockedVersion !== null) {
                      clear();
                      setNotice("Lịch học đã được chốt.");
                    } else {
                      setNotice(
                        "Chưa xác nhận được kết quả. Kiểm tra lại hoặc thử cùng yêu cầu đã lưu.",
                      );
                      setCanReset(
                        !!saved &&
                          commitmentSnapshot(latest) !== saved.signature,
                      );
                    }
                  } catch (cause) {
                    setCheckError(
                      cause instanceof Error
                        ? cause.message
                        : "Chưa kiểm tra được trạng thái.",
                    );
                  } finally {
                    setChecking(false);
                  }
                }}
                loading={!!(checking || command.pending)}
              >
                <ProductIcon name="refresh" size={15} />
                Kiểm tra lại trạng thái
              </LoadingButton>

              {canReset && (
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    if (!result || !saved || !command.resetAfterRead()) return;
                    const next = reviewedFinalizeIntent(saved, result);
                    if (next) {
                      intent.current = next;
                      setSaved(next);
                      try {
                        sessionStorage.setItem(
                          storageKey,
                          JSON.stringify(next),
                        );
                      } catch {
                        /* Preserve the in-memory key. */
                      }
                    } else clear();
                    setReviewedSignature(null);
                    setCanReset(false);
                    setNotice(
                      "Thỏa thuận đã đổi. Kiểm tra nội dung mới trước khi chốt.",
                    );
                  }}
                >
                  Dùng nội dung đã cập nhật
                </button>
              )}
            </div>
          </>
        )}

        <CommandFeedback command={command} />
        <InvalidScheduleNotice
          error={command.failure}
          onEdit={onEditSchedule}
        />
        <Feedback error={checkError} />
        {notice && (
          <p className="learner-notice">
            <output>{notice}</output>
          </p>
        )}
      </div>
    </Panel>
  );
}
