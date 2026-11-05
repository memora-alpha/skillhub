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
  Status,
} from "../components/common";
import type { Post } from "../types";
import Link from "next/link";
import { PostExtras, initialPostExtras } from "./post-extras";
import { postExtraInput } from "./post-input";
export function PostEditor({ id }: Readonly<{ id?: string }>) {
  const query = useUserResource<Post>(id ? "learning-requests/" + id : null, {
    retainOnTemporaryError: true,
  });
  return (
    <>
      <Back href={id ? "/learn/posts/" + id : "/learn/explore"} />
      <PageHeading
        title={id ? "Chỉnh sửa bài đăng" : "Bạn muốn học điều gì?"}
        description="Chia sẻ mục tiêu rõ ràng để gặp người hướng dẫn phù hợp."
      />
      {id && (
        <button
          type="button"
          className="btn"
          disabled={query.loading}
          onClick={query.reload}
        >
          Kiểm tra phiên bản mới trên máy chủ
        </button>
      )}
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
            <PostForm key={id ?? "new"} post={query.data} />
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
  const [baseline, setBaseline] = useState(post);
  const [extras, setExtras] = useState(() => initialPostExtras(post));
  const stale = !!post && post.version !== baseline?.version;
  const blocked =
    command.pending ||
    command.uncertain ||
    stale ||
    !!post?.owner ||
    (!!post &&
      !["DRAFT", "OPEN", "PENDING_MODERATION", "REJECTED"].includes(
        post.status,
      ));
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
          for (const [field, label, minimum, maximum] of [
            ["title", "Tiêu đề", 10, 120],
            ["description", "Mô tả", 20, 3000],
            ["goal", "Mục tiêu học", 10, 1000],
          ] as const) {
            const length = Array.from(formText(fields, field).trim()).length;
            if (length < minimum || length > maximum) {
              setError(
                label +
                  " cần từ " +
                  minimum +
                  " đến " +
                  maximum +
                  " ký tự sau khi bỏ khoảng trắng ở đầu/cuối.",
              );
              return;
            }
          }
          const hourlyCredit = formText(fields, "credit");
          if (
            hourlyCredit &&
            (!/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/.test(hourlyCredit) ||
              Number(hourlyCredit) <= 0)
          ) {
            setError(
              "Credit/giờ phải lớn hơn 0, tối đa 2 chữ số thập phân, hoặc để trống.",
            );
            return;
          }
          let extended: ReturnType<typeof postExtraInput>;
          try {
            extended = postExtraInput(extras);
          } catch (cause) {
            setError(
              cause instanceof Error
                ? cause.message
                : "Thông tin bổ sung chưa hợp lệ.",
            );
            return;
          }
          const body = {
            ...(!baseline?.publishedAt ? { skillId: skill } : {}),
            title: formText(fields, "title").trim(),
            description: formText(fields, "description").trim(),
            learningGoal: formText(fields, "goal").trim(),
            currentLevel: formText(fields, "level"),
            desiredCreditPerHour: fields.get("credit")
              ? formText(fields, "credit")
              : null,
            ...extended,
            ...(baseline ? { expectedVersion: baseline.version } : {}),
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
        {stale && (
          <div className="learner-notice">
            <p>
              Bài trên máy chủ đã thay đổi. Bản đang nhập của bạn vẫn được giữ;
              đối chiếu trước khi lưu tiếp.
            </p>
            <details>
              <summary>Xem nội dung mới từ máy chủ</summary>
              <p>{post?.title}</p>
              <p className="learner-prose">{post?.description}</p>
              <p>{post?.learningGoal}</p>
              {post && (
                <p>
                  Trạng thái: <Status value={post.status} />
                </p>
              )}
            </details>
            <button
              type="button"
              className="btn"
              onClick={() => {
                setBaseline(post);
                if (post?.publishedAt)
                  setSkill(post.skillId ?? post.skill?.id ?? "");
              }}
            >
              Đã đối chiếu, dùng phiên bản mới cho bản đang nhập
            </button>
          </div>
        )}
        <SkillPicker
          value={skill}
          onChange={setSkill}
          disabled={blocked || !!baseline?.publishedAt}
        />
        {baseline?.publishedAt && (
          <p className="muted">
            Kỹ năng chính được giữ sau lần xuất bản đầu tiên.
          </p>
        )}
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
        <PostExtras value={extras} onChange={setExtras} disabled={blocked} />
        {extras.proposedTags.length > 0 && (
          <p className="learner-notice">
            Khi xuất bản, bài này sẽ chờ duyệt cùng các tag mới. Lưu nháp chưa
            gửi bài ra công khai.
          </p>
        )}
        {error && (
          <p className="learner-error" role="alert">
            {error}
          </p>
        )}
        <CommandFeedback command={command} />
        {command.uncertain && (
          <p>
            Bản đang nhập được giữ nguyên.{" "}
            <Link
              href="/learn/explore?mine=true"
              target="_blank"
              rel="noopener noreferrer"
            >
              Kiểm tra bài của tôi trong tab mới
            </Link>{" "}
            trước khi bắt đầu yêu cầu khác.
          </p>
        )}
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
