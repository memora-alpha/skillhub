"use client";
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
import type { LearningPath } from "../types";
import {
  commitmentSnapshot,
  finalizeWithRecovery,
  reviewedFinalizeIntent,
  readFinalizePath,
  type FinalizeIntent,
} from "./finalize-recovery";
import { PathAgreementSummary } from "./agreement-summary";
export function FinalizePanel({
  path,
  blocked,
}: Readonly<{ path: LearningPath; blocked: boolean }>) {
  const { actor, request, refresh } = useUserSession();
  const storageKey =
    "skillhub-user-draft:" + actor.userId + ":finalize:" + path.id;
  const [saved, setSaved] = useState<FinalizeIntent | null>(() => {
    try {
      const value = JSON.parse(
        sessionStorage.getItem(storageKey) ?? "null",
      ) as FinalizeIntent | null;
      return value &&
        value.pathId === path.id &&
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
  const [reviewed, setReviewed] = useState(false);
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
  return (
    <Panel title="Kiểm tra cuối, khóa lịch và giữ Credit">
      {saved && (
        <details open>
          <summary>
            Bản đã gửi cần đối chiếu · phiên bản {saved.version}
          </summary>
          <PathAgreementSummary path={saved.snapshot} />
          {saved.snapshot.plans.map((plan) => (
            <div key={plan.id}>
              <p>{plan.learningGoal}</p>
              {plan.schedule?.items.map((slot) => (
                <p key={slot.sessionNo}>
                  Buổi {slot.sessionNo}: {formatTime(slot.startAt)} –{" "}
                  {formatTime(slot.endAt)}
                </p>
              ))}
            </div>
          ))}
        </details>
      )}
      {show.lockedVersion !== null ? (
        <>
          <p role="status">
            Máy chủ đã xác nhận thỏa thuận đã khóa. Xem các buổi chính thức bên
            dưới.
          </p>
          {show.plans
            .flatMap((plan) => plan.sessions)
            .map((session) => (
              <p key={session.id}>
                <Link href={"/learn/sessions/" + session.id}>
                  Buổi {session.sessionNo} · {formatTime(session.startAt)}
                </Link>
              </p>
            ))}
          <Link className="btn" href="/learn/calendar">
            Mở lịch học
          </Link>
        </>
      ) : (
        <>
          <p>
            Kiểm tra trước không giữ chỗ lịch hay số dư. Khi chốt, máy chủ kiểm
            tra lại; nếu không đủ điều kiện, chưa được coi là đã khóa.
          </p>
          <label>
            <input
              type="checkbox"
              checked={reviewed}
              disabled={command.pending || !!saved}
              onChange={(e) => setReviewed(e.target.checked)}
            />{" "}
            Tôi đã đối chiếu vai trò, Credit và các buổi học của phiên bản này.
          </label>
          <button
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
              const signature = saved?.signature ?? commitmentSnapshot(show);
              void command
                .run(signature, async (key) => {
                  const current = intent.current ?? {
                    pathId: path.id,
                    version: show.currentVersion,
                    signature,
                    snapshot: show,
                    key,
                  };
                  intent.current = current;
                  setSaved(current);
                  try {
                    sessionStorage.setItem(storageKey, JSON.stringify(current));
                  } catch {
                    setNotice(
                      "Không lưu được yêu cầu vào trình duyệt. Giữ màn hình này để kiểm tra lại cùng yêu cầu.",
                    );
                  }
                  return finalizeWithRecovery(request, current);
                })
                .then((outcome) => {
                  if (outcome?.path.lockedVersion !== null && outcome?.path) {
                    setResult(outcome.path);
                    clear();
                    setNotice(
                      outcome.recovered
                        ? "Đã khôi phục thỏa thuận và các buổi học hiện tại từ máy chủ."
                        : "Đã kiểm tra lại thỏa thuận và các buổi học chính thức sau khi chốt.",
                    );
                  }
                });
            }}
          >
            {command.pending
              ? "Đang kiểm tra và chốt…"
              : saved
                ? "Đọc lại rồi thử cùng yêu cầu chốt"
                : "Chốt lịch và giữ Credit theo thỏa thuận"}
          </button>
        </>
      )}
      <button
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
              setNotice(
                "Máy chủ đã xác nhận thỏa thuận được khóa. Sử dụng các buổi học hiện tại.",
              );
            } else {
              setNotice(
                "Chưa nhận được xác nhận thỏa thuận đã khóa. Nếu lần gửi trước chưa rõ kết quả, tiếp tục kiểm tra hoặc thử lại cùng yêu cầu đã lưu.",
              );
              setCanReset(
                !!saved && commitmentSnapshot(latest) !== saved.signature,
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
      >
        Kiểm tra thỏa thuận / buổi học hiện tại
      </button>
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
                sessionStorage.setItem(storageKey, JSON.stringify(next));
              } catch {
                /* Preserve the in-memory key. */
              }
            } else clear();
            setReviewed(false);
            setCanReset(false);
            setNotice(
              "Phiên bản máy chủ đã đổi. Đối chiếu lại nội dung mới trước khi chốt.",
            );
          }}
        >
          Đã đối chiếu nội dung mới, tiếp tục yêu cầu chốt
        </button>
      )}
      <CommandFeedback command={command} />
      <Feedback error={checkError} />
      {notice && (
        <p role="status" className="learner-notice">
          {notice}
        </p>
      )}
    </Panel>
  );
}
