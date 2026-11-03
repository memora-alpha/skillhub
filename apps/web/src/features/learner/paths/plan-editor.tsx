"use client";
import { useState } from "react";
import type { LearningPath, Plan, SharingSkill } from "../types";
import { useUserSession } from "../auth/session";
import { useUserCommand } from "../hooks/use-user-command";
import { useUserList } from "../hooks/use-user-resource";
import { CommandFeedback, Feedback, More } from "../components/common";
export function PlanEditor({
  path,
  plan,
  onSaved,
}: Readonly<{ path: LearningPath; plan?: Plan; onSaved: () => void }>) {
  const { request } = useUserSession(),
    command = useUserCommand();
  const skills = useUserList<SharingSkill>("me/skills?limit=50"),
    [count, setCount] = useState(plan?.totalSessions ?? 1);
  const choices = [
    ...new Map(
      skills.items
        .filter((skill) => skill.isVisible && !skill.archivedAt)
        .map((skill) => [skill.skill.id, skill.skill]),
    ).values(),
  ];
  return (
    <form
      className="learner-form"
      onSubmit={async (event) => {
        event.preventDefault();
        const fields = new FormData(event.currentTarget);
        const body = {
          skillId: String(fields.get("skill")),
          learningGoal: String(fields.get("goal")).trim(),
          totalSessions: count,
          sessionOutline: Array.from({ length: count }, (_, index) => ({
            content: String(fields.get("outline-" + index)).trim(),
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
        loading={skills.loading}
        error={skills.error}
        reload={skills.reload}
      />
      <label>
        Kỹ năng bạn hướng dẫn
        <select
          name="skill"
          defaultValue={plan?.skillId ?? ""}
          required
          disabled={command.pending || command.uncertain}
        >
          <option value="">Chọn kỹ năng của bạn</option>
          {choices.map((skill) => (
            <option value={skill.id} key={skill.id}>
              {skill.name}
            </option>
          ))}
        </select>
      </label>
      <More
        cursor={skills.cursor}
        loading={skills.loading}
        onMore={() => {
          void skills.more();
        }}
      />
      <label>
        Mục tiêu của kế hoạch
        <textarea
          name="goal"
          defaultValue={plan?.learningGoal}
          minLength={1}
          maxLength={1500}
          required
          disabled={command.pending || command.uncertain}
        />
      </label>
      <label>
        Số buổi
        <input
          type="number"
          min={1}
          max={100}
          value={count}
          onChange={(event) => {
            const value = Number(event.target.value);
            if (Number.isInteger(value) && value >= 1 && value <= 100)
              setCount(value);
          }}
          required
          disabled={command.pending || command.uncertain}
        />
      </label>
      {Array.from({ length: count }, (_, index) => (
        <label key={index}>
          Nội dung buổi {index + 1}
          <textarea
            name={"outline-" + index}
            defaultValue={plan?.sessionOutline[index]?.content}
            minLength={1}
            maxLength={2000}
            rows={3}
            required
            disabled={command.pending || command.uncertain}
          />
        </label>
      ))}
      <CommandFeedback command={command} />
      <button
        className="btn btn-primary"
        disabled={command.pending || command.uncertain || !choices.length}
      >
        Lưu kế hoạch của tôi
      </button>
    </form>
  );
}
