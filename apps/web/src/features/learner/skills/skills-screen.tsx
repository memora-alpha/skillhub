"use client";
import { formText } from "../components/form-data";

import { useState } from "react";
import { useUserSession } from "../auth/session";
import { useUserList, useUserResource } from "../hooks/use-user-resource";
import { useUserCommand } from "../hooks/use-user-command";
import type { SharingSkill } from "../types";
import { SkillPicker } from "../components/skill-picker";
import {
  CommandFeedback,
  Empty,
  Feedback,
  More,
  PageHeading,
  Panel,
} from "../components/common";
import { SkillManagementCard } from "./skill-management-card";
type Level = {
  id: string;
  name: string;
  code: string;
  status: string;
  sortOrder: number;
};
export function SkillsScreen() {
  const [includeArchived, setIncludeArchived] = useState(false);
  const query = useUserList<SharingSkill>(
      "me/skills?limit=20&includeArchived=" + includeArchived,
    ),
    { request } = useUserSession(),
    command = useUserCommand(true);
  const [skillId, setSkillId] = useState(""),
    [message, setMessage] = useState<string>();
  const levels = useUserResource<Level[]>(
    skillId ? "skills/" + skillId + "/levels" : null,
  );
  return (
    <>
      <PageHeading
        title="Kỹ năng tôi có thể chia sẻ"
        description="Giúp người muốn học hiểu kinh nghiệm và thế mạnh của bạn."
      />
      <label className="learner-actions">
        <input
          type="checkbox"
          checked={includeArchived}
          onChange={(event) => setIncludeArchived(event.target.checked)}
        />{" "}
        Hiển thị cả kỹ năng đã lưu trữ
      </label>
      <div className="learner-two-columns">
        <div className="learner-stack">
          <Feedback
            loading={query.loading}
            error={query.error}
            reload={query.reload}
          />
          {query.items.map((skill) => (
            <SkillManagementCard
              key={skill.id}
              skill={skill}
              blocked={!!query.error || query.loading}
              reload={query.reload}
            />
          ))}
          {!query.loading && !query.error && !query.items.length && (
            <Empty>Bạn chưa khai báo kỹ năng chia sẻ.</Empty>
          )}
          <More
            cursor={query.cursor}
            loading={query.loading}
            onMore={() => {
              void query.more();
            }}
          />
        </div>
        <Panel title="Thêm kỹ năng">
          <form
            className="learner-form"
            onSubmit={async (event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              const body = {
                skillId,
                levelId: formText(data, "levelId"),
                description: formText(data, "description").trim(),
                isVisible: true,
              };
              const result = await command.run(JSON.stringify(body), (key) =>
                request("me/skills", { method: "POST", key, body }),
              );
              if (result)
                setMessage(
                  "Đã thêm kỹ năng. Bạn có thể gửi đề xuất cho bài học phù hợp.",
                );
            }}
          >
            <SkillPicker
              value={skillId}
              onChange={setSkillId}
              disabled={command.pending || command.uncertain}
            />
            <Feedback
              loading={levels.loading}
              error={levels.error}
              reload={levels.reload}
            />
            <label>
              <span>Trình độ</span>
              <select
                name="levelId"
                key={skillId}
                required
                disabled={!levels.data || command.pending}
              >
                <option value="">Chọn trình độ</option>
                {levels.data
                  ?.filter((level) => level.status === "ACTIVE")
                  .sort(
                    (left, right) =>
                      left.sortOrder - right.sortOrder ||
                      left.id.localeCompare(right.id),
                  )
                  .map((level) => (
                    <option value={level.id} key={level.id}>
                      {level.name}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              <span>Kinh nghiệm và điều bạn có thể hướng dẫn</span>
              <textarea
                name="description"
                rows={5}
                minLength={20}
                maxLength={1500}
                required
                disabled={command.pending}
              />
            </label>
            <CommandFeedback command={command} />
            {message && <p className="learner-notice">{message}</p>}
            <button
              type="submit"
              className="btn btn-primary"
              disabled={
                !skillId ||
                !levels.data ||
                command.pending ||
                (command.uncertain && !command.canRetry)
              }
            >
              Lưu kỹ năng
            </button>
          </form>
        </Panel>
      </div>
    </>
  );
}
