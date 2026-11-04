"use client";
import { formText } from "../components/form-data";

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
        loading={skills.loading}
        error={skills.error}
        reload={skills.reload}
      />
      <label>
        <span>Kỹ năng bạn hướng dẫn</span>
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
        <span>Mục tiêu của kế hoạch</span>
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
        <span>Số buổi</span>
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
          <span>Nội dung buổi {index + 1}</span>
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
        type="submit"
        className="btn btn-primary"
        disabled={command.pending || command.uncertain || !choices.length}
      >
        Lưu kế hoạch của tôi
      </button>
    </form>
  );
}
