"use client";
import Link from "next/link";
import { useState } from "react";
import { useUserSession } from "../auth/session";
import { useUserCommand } from "../hooks/use-user-command";
import { useUserResource } from "../hooks/use-user-resource";
import { CommandFeedback, Feedback, Panel, Status } from "../components/common";
import { formText } from "../components/form-data";
import type { SharingSkill } from "../types";

type Intent = {
  path: string;
  method: "POST" | "PATCH";
  body: Record<string, unknown>;
};
type Level = { id: string; name: string; status: string };
export function SkillManagementCard({
  skill,
  blocked,
  reload,
}: Readonly<{
  skill: SharingSkill;
  blocked: boolean;
  reload: () => void;
}>) {
  const { request } = useUserSession();
  const command = useUserCommand(true);
  const [editing, setEditing] = useState<SharingSkill>();
  const [levelId, setLevelId] = useState("");
  const [intent, setIntent] = useState<Intent>();
  const [notice, setNotice] = useState<string>();
  const levels = useUserResource<Level[]>(
    editing ? "skills/" + skill.skill.id + "/levels" : null,
  );
  const disabled = blocked || command.pending || command.uncertain;
  const stale = editing && editing.version !== skill.version;
  function openEditor() {
    setLevelId(skill.levelId ?? "");
    setEditing({ ...skill });
  }
  async function send(value: Intent) {
    setIntent(value);
    const result = await command.run(JSON.stringify(value), (key) =>
      request(value.path, { ...value, key }),
    );
    if (result) {
      setIntent(undefined);
      setEditing(undefined);
      setNotice("Máy chủ đã lưu thay đổi kỹ năng.");
      reload();
    }
  }
  function act(action: "archive" | "restore" | "visibility") {
    void send({
      path:
        "me/skills/" + skill.id + (action === "visibility" ? "" : "/" + action),
      method: action === "visibility" ? "PATCH" : "POST",
      body: {
        expectedVersion: skill.version,
        ...(action === "visibility" ? { isVisible: !skill.isVisible } : {}),
      },
    });
  }
  const visibilityLabel = skill.isVisible ? "Đang hiển thị" : "Đang ẩn";
  const stateLabel = skill.archivedAt ? "Đã lưu trữ" : visibilityLabel;
  return (
    <Panel title={skill.skill.name}>
      <p className="learner-prose">{skill.description}</p>
      <p>
        <Status value={skill.verificationStatus ?? "UNVERIFIED"} />
      </p>
      <p className="muted">
        Trình độ: {skill.level} · {stateLabel}
      </p>
      <Link
        className="learner-card-link"
        href={"/learn/skills/" + skill.id + "/verification"}
      >
        Chi tiết xác minh kỹ năng →
      </Link>
      {!skill.archivedAt && (
        <div className="learner-actions">
          <button
            type="button"
            className="btn"
            disabled={disabled}
            onClick={openEditor}
          >
            Chỉnh sửa
          </button>
          <button
            type="button"
            className="btn"
            disabled={disabled}
            onClick={() => act("visibility")}
          >
            {skill.isVisible ? "Ẩn kỹ năng" : "Hiện kỹ năng"}
          </button>
        </div>
      )}
      <details>
        <summary>
          {skill.archivedAt ? "Khôi phục kỹ năng" : "Lưu trữ kỹ năng"}
        </summary>
        <p>
          {skill.archivedAt
            ? "Khôi phục giữ lịch sử và xác minh đã có. Máy chủ kiểm tra danh mục và kỹ năng trùng trước khi khôi phục."
            : "Ẩn hoặc lưu trữ sẽ gỡ kỹ năng khỏi tìm kiếm công khai. Thỏa thuận và lịch sử cũ được giữ lại. Kỹ năng đang chờ xác minh có thể chưa được lưu trữ."}
        </p>
        <button
          type="button"
          className="btn"
          disabled={disabled}
          onClick={() => act(skill.archivedAt ? "restore" : "archive")}
        >
          {skill.archivedAt ? "Xác nhận khôi phục" : "Xác nhận lưu trữ"}
        </button>
      </details>
      {editing && (
        <form
          className="learner-form"
          key={editing.id + ":" + editing.version}
          onSubmit={(event) => {
            event.preventDefault();
            if (disabled || stale || !levels.data || levels.error) return;
            const fields = new FormData(event.currentTarget);
            void send({
              path: "me/skills/" + skill.id,
              method: "PATCH",
              body: {
                expectedVersion: editing.version,
                levelId: formText(fields, "levelId"),
                description: formText(fields, "description").trim(),
                experienceYears:
                  formText(fields, "experienceYears").trim() || null,
                isVisible: fields.get("isVisible") === "on",
              },
            });
          }}
        >
          <h3>Chỉnh sửa kỹ năng</h3>
          <Feedback
            loading={levels.loading}
            error={levels.error}
            reload={levels.reload}
          />
          {stale && (
            <p className="learner-notice">
              Kỹ năng đã đổi trên máy chủ. Bản đang nhập được giữ lại. Đọc nội
              dung mới trước khi tiếp tục.
            </p>
          )}
          <fieldset disabled={disabled || !!stale}>
            <label>
              <span>Trình độ</span>
              <select
                name="levelId"
                value={levelId}
                onChange={(event) => setLevelId(event.target.value)}
                required
              >
                <option value="">Chọn trình độ</option>
                {levels.data
                  ?.filter((level) => level.status === "ACTIVE")
                  .map((level) => (
                    <option key={level.id} value={level.id}>
                      {level.name}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              <span>Mô tả</span>
              <textarea
                name="description"
                rows={4}
                minLength={20}
                maxLength={1500}
                required
                defaultValue={editing.description}
              />
            </label>
            <label>
              <span>Số năm kinh nghiệm (không bắt buộc)</span>
              <input
                name="experienceYears"
                type="number"
                min="0"
                max="60"
                step="0.1"
                defaultValue={editing.experienceYears ?? ""}
              />
            </label>
            <label>
              <input
                type="checkbox"
                name="isVisible"
                defaultChecked={editing.isVisible}
              />
              <span> Hiển thị công khai</span>
            </label>
            <button
              className="btn btn-primary"
              type="submit"
              disabled={!levels.data || !!levels.error}
            >
              Lưu chỉnh sửa
            </button>
          </fieldset>
          {stale && (
            <button
              type="button"
              className="btn"
              disabled={disabled}
              onClick={openEditor}
            >
              Thay bản nhập bằng bản mới trên máy chủ
            </button>
          )}
          <button
            type="button"
            className="btn"
            disabled={command.pending || command.uncertain}
            onClick={() => setEditing(undefined)}
          >
            Đóng chỉnh sửa
          </button>
        </form>
      )}
      <CommandFeedback command={command} />
      {command.canRetry && intent && (
        <button
          type="button"
          className="btn"
          disabled={blocked || command.pending}
          onClick={() => void send(intent)}
        >
          Kiểm tra lại cùng yêu cầu đã gửi
        </button>
      )}
      {notice && (
        <p className="learner-notice">
          <output>{notice}</output>
        </p>
      )}
    </Panel>
  );
}
