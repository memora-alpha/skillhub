"use client";
import { LoadingButton } from "@/components/loading-button";
import { formText } from "../components/form-data";
import { useState } from "react";
import type { LearningPath, Plan, SharingSkill } from "../types";
import { useUserSession } from "../auth/session";
import { useUserCommand } from "../hooks/use-user-command";
import { useUserList } from "../hooks/use-user-resource";
import { CommandFeedback, Feedback, More } from "../components/common";
import styles from "./path-detail.module.css";

export function PlanEditor({
  path,
  plan,
  onSaved,
}: Readonly<{ path: LearningPath; plan?: Plan; onSaved: () => void }>) {
  const { request } = useUserSession();
  const command = useUserCommand();
  const skills = useUserList<SharingSkill>("me/skills?limit=50");
  const [count, setCount] = useState(plan?.totalSessions ?? 1);
  const choices = [
    ...new Map(
      skills.items
        .filter((skill) => skill.isVisible && !skill.archivedAt)
        .map((skill) => [skill.skill.id, skill.skill]),
    ).values(),
  ];
  const disabled = command.pending || command.uncertain;

  return (
    <form
      className="learner-form"
      onSubmit={async (event) => {
        event.preventDefault();
        const fields = new FormData(event.currentTarget);
        const body = {
          skillId: formText(fields, "skill"),
          learningGoal: formText(fields, "goal").trim(),
          totalSessions: count,
          sessionOutline: Array.from({ length: count }, (_, index) => ({
            content: formText(fields, "outline-" + index).trim(),
          })),
          ...(plan ? { expectedVersion: plan.version } : {}),
        };
        const result = await command.run(JSON.stringify(body), () =>
          request(
            plan
              ? "learning-paths/plans/" + plan.id
              : "learning-paths/" + path.id + "/plans",
            { method: plan ? "PATCH" : "POST", body },
          ),
        );
        if (result) onSaved();
      }}
    >
      <Feedback
        loading={skills.initialLoading}
        error={skills.error}
        reload={skills.reload}
        refreshing={!!(skills.loading && !skills.initialLoading)}
      />

      <div className={styles.editorTopGrid}>
        <label>
          <span>Kỹ năng bạn hướng dẫn</span>
          <select
            name="skill"
            defaultValue={plan?.skillId ?? ""}
            required
            disabled={disabled}
          >
            <option value="">Chọn kỹ năng của bạn</option>
            {choices.map((skill) => (
              <option value={skill.id} key={skill.id}>
                {skill.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Tổng số buổi</span>
          <div className={styles.stepperRow}>
            <button
              type="button"
              className={styles.stepperBtn}
              aria-label="Giảm số buổi"
              disabled={disabled || count <= 1}
              onClick={() => setCount((value) => Math.max(1, value - 1))}
            >
              −
            </button>
            <input
              type="number"
              className={styles.stepperInput}
              min={1}
              max={100}
              value={count}
              onChange={(event) => {
                const value = Number(event.target.value);
                if (Number.isInteger(value) && value >= 1 && value <= 100)
                  setCount(value);
              }}
              required
              disabled={disabled}
            />
            <button
              type="button"
              className={styles.stepperBtn}
              aria-label="Tăng số buổi"
              disabled={disabled || count >= 100}
              onClick={() => setCount((value) => Math.min(100, value + 1))}
            >
              +
            </button>
          </div>
        </label>
      </div>

      <More
        cursor={skills.cursor}
        loading={skills.loading}
        onMore={() => {
          void skills.more();
        }}
      />

      <label>
        <span>Mục tiêu chung của kế hoạch</span>
        <textarea
          name="goal"
          defaultValue={plan?.learningGoal}
          minLength={1}
          maxLength={1500}
          rows={3}
          placeholder="Ví dụ: Hoàn thiện kỹ năng giao tiếp tiếng Anh công sở sau 6 buổi thực hành tình huống."
          required
          disabled={disabled}
        />
      </label>

      <div className={styles.editorSessionList}>
        {Array.from({ length: count }, (_, index) => (
          <div key={index} className={styles.editorSessionCard}>
            <div className={styles.editorSessionHead}>
              <span className={styles.editorSessionBadge}>{index + 1}</span>
              <span>Nội dung buổi {index + 1}</span>
            </div>
            <textarea
              aria-label={`Nội dung buổi ${index + 1}`}
              name={"outline-" + index}
              defaultValue={plan?.sessionOutline[index]?.content}
              minLength={1}
              maxLength={2000}
              rows={2}
              placeholder={`Mô tả kiến thức, bài tập hoặc mục tiêu cần đạt trong buổi ${index + 1}...`}
              required
              disabled={disabled}
            />
          </div>
        ))}
      </div>

      <CommandFeedback command={command} />

      <div className={styles.actionRow}>
        <LoadingButton
          type="submit"
          className="btn btn-primary"
          disabled={disabled || !choices.length}
          loading={!!command.pending}
        >
          Lưu kế hoạch của tôi
        </LoadingButton>
      </div>
    </form>
  );
}
