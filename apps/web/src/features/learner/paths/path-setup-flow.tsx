"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { LoadingButton } from "@/components/loading-button";
import { useUserSession } from "../auth/session";
import type { LearningPath, Reply } from "../types";
import { InvalidScheduleNotice } from "./invalid-schedule";
import { PathSetupReview } from "./path-setup-review";
import {
  checkSetupAdvance,
  pathSetupProgress,
  setupSteps,
  type PathSetupStep,
} from "./path-setup-policy";
import styles from "./path-setup-flow.module.css";

export function PathSetupFlow({
  path,
  step,
  enabled,
  onStep,
  children,
}: Readonly<{
  path: LearningPath;
  step: PathSetupStep;
  enabled: boolean;
  onStep: (step: PathSetupStep) => void;
  children: ReactNode;
}>) {
  const { actor, request } = useUserSession();
  const cache = useQueryClient();
  const content = useRef<HTMLFieldSetElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const active = useRef(true);
  const lock = useRef(false);
  const [checking, setChecking] = useState(false);
  const [issues, setIssues] = useState<string[]>([]);
  const [failure, setFailure] = useState<unknown>();
  const index = setupSteps.findIndex((item) => item.key === step);
  const progress = pathSetupProgress(path);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const move = (target: PathSetupStep) => {
    setIssues([]);
    setFailure(undefined);
    onStep(target);
    requestAnimationFrame(() => heading.current?.focus());
  };
  async function navigate(target: number) {
    if (lock.current || target === index) return;
    const pane = content.current?.querySelector(`[data-setup-pane="${step}"]`);
    if (pane?.querySelector('[aria-busy="true"]')) {
      setIssues(["Chờ thao tác hiện tại hoàn tất rồi chuyển bước."]);
      return;
    }
    if (target < index) {
      move(setupSteps[target]!.key);
      return;
    }
    // Earlier panes remain mounted so going back does not discard draft fields.
    const form = Array.from(
      content.current?.querySelectorAll("form") ?? [],
    ).find((item) => {
      const key = item
        .closest("[data-setup-pane]")
        ?.getAttribute("data-setup-pane");
      const formStep = setupSteps.findIndex(
        (candidate) => candidate.key === key,
      );
      return formStep >= 0 && formStep < target;
    });
    if (form) {
      const key = form
        .closest("[data-setup-pane]")
        ?.getAttribute("data-setup-pane");
      const formStep = setupSteps.findIndex((item) => item.key === key);
      if (key === step) form.reportValidity();
      setIssues([
        `Vui lòng lưu nội dung đang nhập hoặc đóng phần chỉnh sửa ở bước ${formStep + 1} trước khi tiếp tục.`,
      ]);
      return;
    }
    lock.current = true;
    setChecking(true);
    setIssues([]);
    setFailure(undefined);
    try {
      const result = await checkSetupAdvance(request, path.id, target);
      if (!active.current) return;
      cache.setQueryData<Reply<LearningPath>>(
        ["learner", actor.userId, "learning-paths/" + path.id],
        (previous) => ({ ...previous, success: true, data: result.path }),
      );
      if (result.issues.length) setIssues(result.issues);
      else
        move(
          result.path.lockedVersion === null
            ? setupSteps[target]!.key
            : "schedule",
        );
    } catch (cause) {
      if (!active.current) return;
      setFailure(cause);
      setIssues([
        cause instanceof Error
          ? cause.message
          : "Chưa kiểm tra được. Vui lòng thử lại.",
      ]);
    } finally {
      lock.current = false;
      if (active.current) setChecking(false);
    }
  }
  if (!enabled) return <div className={styles.content}>{children}</div>;
  return (
    <section className={styles.flow} aria-label="Thiết lập lộ trình học">
      <nav aria-label="Bốn bước thiết lập lộ trình">
        <ol className={styles.steps}>
          {setupSteps.map((item, i) => (
            <li key={item.key} data-complete={i < progress.availableStep}>
              <button
                type="button"
                aria-current={i === index ? "step" : undefined}
                disabled={checking || (i > index && i > progress.availableStep)}
                onClick={() => void navigate(i)}
              >
                <span className={styles.number}>{i + 1}</span>
                <span>
                  {item.label}
                  <small>
                    {i < progress.availableStep
                      ? "Đủ điều kiện"
                      : i === index
                        ? "Đang thực hiện"
                        : "Chưa hoàn tất"}
                  </small>
                </span>
              </button>
            </li>
          ))}
        </ol>
      </nav>
      <div className={styles.heading}>
        <h2 ref={heading} tabIndex={-1}>
          Bước {index + 1}: {setupSteps[index]!.label}
        </h2>
        <p>
          {index === 3
            ? "Xem lại trước khi hoàn thành thiết lập và giữ Credit theo thỏa thuận."
            : "Hoàn tất nội dung và xác nhận ở bước này, sau đó bấm Tiếp theo để kiểm tra."}
        </p>
      </div>
      <fieldset
        ref={content}
        className={styles.content}
        disabled={checking}
        aria-busy={checking}
      >
        <legend className={styles.srOnly}>Nội dung bước {index + 1}</legend>
        {index === 3 && (
          <PathSetupReview
            path={path}
            onEdit={(target) =>
              void navigate(setupSteps.findIndex((item) => item.key === target))
            }
          />
        )}
        {children}
      </fieldset>
      {!!issues.length && (
        <div className="learner-notice" role="status">
          <strong>Chưa thể chuyển bước</strong>
          <ul>
            {issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
          {progress.availableStep < index && (
            <button
              type="button"
              className="btn"
              disabled={checking}
              onClick={() => move(setupSteps[progress.availableStep]!.key)}
            >
              Về bước {progress.availableStep + 1} để kiểm tra
            </button>
          )}
        </div>
      )}
      <InvalidScheduleNotice error={failure} onEdit={() => move("schedule")} />
      <div className={styles.actions}>
        <button
          type="button"
          className="btn"
          disabled={checking || index === 0}
          onClick={() => void navigate(index - 1)}
        >
          Quay lại
        </button>
        <span>Bước {index + 1} / 4</span>
        {index < 3 && (
          <LoadingButton
            type="button"
            className="btn btn-primary"
            loading={checking}
            onClick={() => void navigate(index + 1)}
          >
            Tiếp theo
          </LoadingButton>
        )}
      </div>
    </section>
  );
}
