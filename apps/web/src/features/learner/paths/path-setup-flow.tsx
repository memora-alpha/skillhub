"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { LoadingButton } from "@/components/loading-button";
import { useUserSession } from "../auth/session";
import { ProductIcon } from "../components/product-icon";
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

const stepDescriptions: readonly string[] = [
  "Hai bên rà soát hình thức học, vai trò và mức Credit rồi cùng xác nhận điều khoản.",
  "Người hướng dẫn lập kế hoạch chi tiết theo từng buổi và người học xác nhận nội dung.",
  "Đề xuất khung giờ Việt Nam cho từng buổi học và chờ cả hai bên xác nhận cùng phiên bản.",
  "Kiểm tra tổng thể thỏa thuận, kế hoạch và lịch học trước khi chốt lịch và tạm giữ Credit.",
];

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

  const progressPct = Math.round(((index + 1) / setupSteps.length) * 100);

  return (
    <section className={styles.flow} aria-label="Thiết lập lộ trình học">
      <div className={styles.stepperCard}>
        <div className={styles.progressBarWrap}>
          <span>Thiết lập lộ trình · Bước {index + 1}/4</span>
          <div className={styles.progressBarTrack} aria-hidden="true">
            <span
              className={styles.progressBarFill}
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <span>{progressPct}%</span>
        </div>

        <nav aria-label="Bốn bước thiết lập lộ trình">
          <ol className={styles.steps}>
            {setupSteps.map((item, i) => {
              const complete = i < progress.availableStep;
              const current = i === index;
              return (
                <li key={item.key} data-complete={complete}>
                  <button
                    type="button"
                    aria-current={current ? "step" : undefined}
                    disabled={
                      checking || (i > index && i > progress.availableStep)
                    }
                    onClick={() => void navigate(i)}
                  >
                    <span className={styles.number}>
                      {complete && !current ? (
                        <ProductIcon name="check" size={15} />
                      ) : (
                        i + 1
                      )}
                    </span>
                    <span className={styles.stepCopy}>
                      {item.label}
                      <small>
                        {complete
                          ? "Đủ điều kiện"
                          : current
                            ? "Đang thực hiện"
                            : "Chưa hoàn tất"}
                      </small>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>
      </div>

      <div className={styles.heading}>
        <div>
          <h2 ref={heading} tabIndex={-1}>
            Bước {index + 1}: {setupSteps[index]!.label}
          </h2>
          <p>{stepDescriptions[index]}</p>
        </div>
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
        <div className={styles.issueBanner} role="status">
          <strong>Chưa thể chuyển sang bước tiếp theo</strong>
          <ul>
            {issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
          {progress.availableStep < index && (
            <div>
              <button
                type="button"
                className="btn btn-sm"
                disabled={checking}
                onClick={() => move(setupSteps[progress.availableStep]!.key)}
              >
                Về bước {progress.availableStep + 1} để kiểm tra
              </button>
            </div>
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
          ← Quay lại
        </button>

        <div className={styles.stepIndicator}>
          <span className={styles.stepDots} aria-hidden="true">
            {setupSteps.map((item, i) => (
              <span
                key={item.key}
                className={
                  styles.stepDot +
                  (i === index
                    ? ` ${styles.stepDotActive}`
                    : i < progress.availableStep
                      ? ` ${styles.stepDotDone}`
                      : "")
                }
              />
            ))}
          </span>
          <span>Bước {index + 1} / 4</span>
        </div>

        {index < 3 ? (
          <LoadingButton
            type="button"
            className="btn btn-primary"
            loading={checking}
            onClick={() => void navigate(index + 1)}
          >
            Tiếp theo
            <ProductIcon name="arrow" size={15} />
          </LoadingButton>
        ) : (
          <span />
        )}
      </div>
    </section>
  );
}
