"use client";
import { formText } from "../components/form-data";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUserSession } from "../auth/session";
import { useUserResource } from "../hooks/use-user-resource";
import { useUserCommand } from "../hooks/use-user-command";
import { SkillPicker } from "../components/skill-picker";
import {
  Back,
  CommandFeedback,
  Feedback,
  PageHeading,
  Panel,
} from "../components/common";
import type { Post } from "../types";
export function PostEditor({ id }: Readonly<{ id?: string }>) {
  const query = useUserResource<Post>(id ? "learning-requests/" + id : null);
  return (
    <>
      <Back href={id ? "/learn/posts/" + id : "/learn/explore"} />
      <PageHeading
        title={id ? "Chỉnh sửa bài đăng" : "Bạn muốn học điều gì?"}
        description="Chia sẻ mục tiêu rõ ràng để gặp người hướng dẫn phù hợp."
      />
      {id && (
        <Feedback
          loading={query.loading}
          error={query.error}
          reload={query.reload}
        />
      )}
      <div className="product-form-layout">
        <aside className="learner-card product-form-note">
          <h2>Nhu cầu học của bạn</h2>
          <ol>
            <li>Kỹ năng muốn học</li>
            <li>Mục tiêu và trình độ</li>
            <li>Credit mong muốn</li>
            <li>Lưu nháp và xem lại</li>
          </ol>
          <p>Thông tin rõ ràng giúp bạn gặp người hướng dẫn phù hợp.</p>
        </aside>
        <div>
          {(!id || query.data) && (
            <PostForm
              key={id ? id + ":" + query.data?.version : "new"}
              post={query.data}
            />
          )}
        </div>
      </div>
    </>
  );
}
function PostForm({ post }: Readonly<{ post?: Post }>) {
  const { request } = useUserSession(),
    router = useRouter(),
    command = useUserCommand();
  const [skill, setSkill] = useState(post?.skillId ?? post?.skill?.id ?? ""),
    [error, setError] = useState<string>();
  const blocked =
    command.pending ||
    command.uncertain ||
    !!post?.owner ||
    (!!post && !["DRAFT", "OPEN", "REJECTED"].includes(post.status));
  const saveLabel = post ? "Lưu thay đổi" : "Lưu bài đăng";
  return (
    <Panel>
      <form
        className="learner-form"
        onSubmit={async (event) => {
          event.preventDefault();
          if (blocked) return;
          setError(undefined);
          if (!skill) {
            setError("Chọn kỹ năng bạn muốn học.");
            return;
          }
          const fields = new FormData(event.currentTarget);
          const body = {
            skillId: skill,
            title: formText(fields, "title").trim(),
            description: formText(fields, "description").trim(),
            learningGoal: formText(fields, "goal").trim(),
            currentLevel: formText(fields, "level"),
            desiredCreditPerHour: fields.get("credit")
              ? formText(fields, "credit")
              : null,
            ...(!post
              ? {
                  verifiedTeacherOnly: false,
                  tagIds: [],
                  preferredSlots: [],
                  expiresAt: null,
                }
              : { expectedVersion: post.version }),
          };
          const result = await command.run(
            JSON.stringify({ id: post?.id, body }),
            () =>
              request<Post>("learning-requests" + (post ? "/" + post.id : ""), {
                method: post ? "PATCH" : "POST",
                body,
              }),
          );
          if (result) router.replace("/learn/posts/" + result.data.id);
        }}
      >
        <SkillPicker value={skill} onChange={setSkill} disabled={blocked} />
        <label>
          <span>Tiêu đề</span>
          <input
            name="title"
            defaultValue={post?.title}
            minLength={10}
            maxLength={120}
            required
            disabled={blocked}
            placeholder="Ví dụ: Mình muốn học Node.js qua một dự án nhỏ"
          />
        </label>
        <label>
          <span>Mô tả</span>
          <textarea
            name="description"
            defaultValue={post?.description}
            rows={5}
            minLength={20}
            maxLength={3000}
            required
            disabled={blocked}
            placeholder="Bạn đã biết gì, cần hỗ trợ gì và mong muốn học như thế nào?"
          />
        </label>
        <label>
          <span>Mục tiêu sau khi học</span>
          <textarea
            name="goal"
            defaultValue={post?.learningGoal}
            rows={3}
            minLength={10}
            maxLength={1000}
            required
            disabled={blocked}
          />
        </label>
        <div className="learner-form-grid">
          <label>
            <span>Trình độ hiện tại</span>
            <select
              name="level"
              defaultValue={post?.currentLevel ?? "BEGINNER"}
              disabled={blocked}
            >
              <option value="NONE">Chưa biết</option>
              <option value="BEGINNER">Cơ bản</option>
              <option value="INTERMEDIATE">Trung cấp</option>
              <option value="ADVANCED">Nâng cao</option>
            </select>
          </label>
          <label>
            <span>Credit mong muốn / giờ</span>
            <input
              name="credit"
              type="number"
              min="0.01"
              step="0.01"
              max="9999999999.99"
              defaultValue={post?.desiredCreditPerHour ?? "20"}
              disabled={blocked}
            />
            <small>Mức gợi ý; giá cuối cùng do hai bên xác nhận.</small>
          </label>
        </div>
        {error && (
          <p className="learner-error" role="alert">
            {error}
          </p>
        )}
        <CommandFeedback command={command} />
        <button type="submit" className="btn btn-primary" disabled={blocked}>
          {command.pending ? "Đang lưu…" : saveLabel}
        </button>
        <p className="muted">
          Bài mới được lưu nháp trước để bạn xem lại và xuất bản.
        </p>
      </form>
    </Panel>
  );
}
