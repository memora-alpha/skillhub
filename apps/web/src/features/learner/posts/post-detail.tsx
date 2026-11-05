"use client";
import { formText } from "../components/form-data";
import { useRef, useState } from "react";
import { postActions, postGuidance, canTeachPost } from "./post-policy";
import {
  ProposalHintsFields,
  readProposalHints,
} from "../connections/proposal-hints";
import { findInPages } from "../api/find-page";
import { PostSkillName, PostSelectedTags } from "./post-catalog";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useUserSession } from "../auth/session";
import { useUserResource, useUserList } from "../hooks/use-user-resource";
import { useUserCommand } from "../hooks/use-user-command";
import type { Post, Proposal, SharingSkill } from "../types";
import {
  Back,
  CommandFeedback,
  Feedback,
  PageHeading,
  Panel,
  More,
  Status,
  formatTime,
} from "../components/common";
export function PostDetail({ id }: Readonly<{ id: string }>) {
  const query = useUserResource<Post>("learning-requests/" + id),
    { request } = useUserSession(),
    command = useUserCommand();
  const post = query.data,
    owner = post && !post.owner;
  const [cancelling, setCancelling] = useState(false);
  const actions = post ? postActions(post) : undefined;
  return (
    <>
      <Back href="/learn" />
      <Feedback
        loading={query.loading}
        error={query.error}
        reload={query.reload}
      />
      {post && (
        <>
          <PageHeading
            title={post.title}
            description={post.owner?.displayName ?? "Bài đăng của bạn"}
            action={<Status value={post.status} />}
          />
          {postGuidance(post.status) && (
            <p className="learner-notice">{postGuidance(post.status)}</p>
          )}
          {post.expiresAt && (
            <p>
              Hết hạn: {formatTime(post.expiresAt)}
              {actions?.expired ? " · Đã hết thời gian nhận đề nghị" : ""}
            </p>
          )}
          <div className="learner-two-columns">
            <Panel title="Điều mình muốn học">
              <p className="learner-prose">{post.description}</p>
              <h3>Mục tiêu</h3>
              <p className="learner-prose">{post.learningGoal}</p>
              {post.verifiedTeacherOnly && (
                <p>Chỉ nhận người hướng dẫn có kỹ năng đã được xác minh.</p>
              )}
              {post.tags?.length ? (
                <p>Tag: {post.tags.map((tag) => tag.label).join(", ")}</p>
              ) : null}
              {owner && !post.tags?.length && !!post.tagIds?.length && (
                <PostSelectedTags ids={post.tagIds} />
              )}
              {owner && !!post.proposedTags?.length && (
                <p>
                  Tag đề xuất đang chờ duyệt: {post.proposedTags.join(", ")}
                </p>
              )}
              {post.teachingOverview && (
                <>
                  <h3>Điều có thể trao đổi</h3>
                  <p className="learner-prose">{post.teachingOverview}</p>
                </>
              )}
              {post.offeredSharingSkills?.map((skill) => (
                <p key={skill.id}>
                  {skill.skill.name} · {skill.level} ·{" "}
                  <Status value={skill.verificationStatus} />
                </p>
              ))}
              {post.preferredAvailability && (
                <>
                  <h3>
                    Lịch rảnh mong muốn · {post.preferredAvailability.timeZone}
                  </h3>
                  {post.preferredAvailability.weeklySlots.map((slot) => (
                    <p
                      key={JSON.stringify([
                        slot.weekday,
                        slot.startTime,
                        slot.endTime,
                      ])}
                    >
                      {
                        (
                          {
                            MON: "Thứ Hai",
                            TUE: "Thứ Ba",
                            WED: "Thứ Tư",
                            THU: "Thứ Năm",
                            FRI: "Thứ Sáu",
                            SAT: "Thứ Bảy",
                            SUN: "Chủ nhật",
                          } as Record<string, string>
                        )[slot.weekday]
                      }
                      : {slot.startTime}–{slot.endTime}
                    </p>
                  ))}
                </>
              )}
              {post.preferredSlots?.map((slot) => (
                <p key={JSON.stringify([slot.startAt, slot.endAt])}>
                  Gợi ý: {formatTime(slot.startAt)} – {formatTime(slot.endAt)}
                </p>
              ))}
              <p className="muted">
                Credit/giờ và lịch trên bài là mong muốn; chưa giữ Credit hay
                tạo Session.
              </p>
              <p>
                {post.skill?.name ?? <PostSkillName id={post.skillId} />} ·{" "}
                {post.desiredCreditPerHour
                  ? post.desiredCreditPerHour + " CR/giờ mong muốn"
                  : "Credit theo thỏa thuận"}
              </p>
              {post.moderationRejectReason && (
                <p className="learner-error">
                  Lý do chưa duyệt: {post.moderationRejectReason}
                </p>
              )}
              {owner && (
                <div className="learner-actions">
                  {actions?.edit && (
                    <Link className="btn" href={"/learn/posts/" + id + "/edit"}>
                      {post.status === "REJECTED"
                        ? "Chỉnh sửa và gửi duyệt lại"
                        : "Chỉnh sửa bài"}
                    </Link>
                  )}
                  {actions?.publish && (
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={command.pending || command.uncertain}
                      onClick={() => {
                        void command.run(
                          "publish:" + id + ":" + post.version,
                          () =>
                            request("learning-requests/" + id + "/publish", {
                              method: "POST",
                              body: { expectedVersion: post.version },
                            }),
                        );
                      }}
                    >
                      Xuất bản bài đăng
                    </button>
                  )}
                  {actions?.cancel && (
                    <button
                      type="button"
                      className="btn"
                      disabled={command.pending || command.uncertain}
                      onClick={() => setCancelling(true)}
                    >
                      Hủy bài đăng
                    </button>
                  )}
                  <Link className="btn" href="/learn/connections">
                    Xem đề xuất kết nối
                  </Link>
                </div>
              )}
              {cancelling && actions?.cancel && (
                <div className="learner-notice">
                  <p>
                    Hủy bài sẽ dừng nhận đề nghị mới. Máy chủ kiểm tra thỏa
                    thuận chưa khóa trước khi hủy.
                  </p>
                  <button
                    type="button"
                    className="btn"
                    disabled={command.pending || command.uncertain}
                    onClick={() => {
                      void command
                        .run("cancel:" + id + ":" + post.version, () =>
                          request("learning-requests/" + id + "/cancel", {
                            method: "POST",
                            body: { expectedVersion: post.version },
                          }),
                        )
                        .then((result) => {
                          if (result) setCancelling(false);
                        });
                    }}
                  >
                    Xác nhận hủy bài
                  </button>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => setCancelling(false)}
                  >
                    Giữ bài
                  </button>
                </div>
              )}
              <CommandFeedback command={command} />
            </Panel>
            {actions?.propose ? (
              <ProposalForm post={post} />
            ) : (
              <Panel title="Bước tiếp theo">
                <p>
                  Trao đổi với đối tác và xác nhận kế hoạch, lịch học trong mục
                  Kết nối.
                </p>
                <Link className="btn btn-primary" href="/learn/connections">
                  Đến kết nối của tôi
                </Link>
              </Panel>
            )}
          </div>
        </>
      )}
    </>
  );
}
function ProposalForm({ post }: Readonly<{ post: Post }>) {
  const skills = useUserList<SharingSkill>("me/skills?limit=50"),
    { request } = useUserSession(),
    router = useRouter(),
    command = useUserCommand(true);
  const eligible = skills.items.some((skill) => canTeachPost(skill, post));
  const [validation, setValidation] = useState<string>();
  const submitted = useRef<Record<string, unknown> | undefined>(undefined);
  return (
    <Panel title="Cùng học với mình nhé">
      <Feedback
        loading={skills.loading}
        error={skills.error}
        reload={skills.reload}
      />
      <More
        cursor={skills.cursor}
        loading={skills.loading}
        onMore={() => {
          void skills.more();
        }}
      />
      {eligible ? (
        <form
          className="learner-form"
          onSubmit={async (event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            let hints: ReturnType<typeof readProposalHints>;
            try {
              hints = readProposalHints(data);
            } catch (cause) {
              setValidation(
                cause instanceof Error ? cause.message : "Gợi ý chưa hợp lệ.",
              );
              return;
            }
            const body =
              command.canRetry && submitted.current
                ? submitted.current
                : {
                    sourceType: "LEARNING_REQUEST",
                    learningRequestId: post.id,
                    message: formText(data, "message").trim(),
                    ...hints,
                  };
            if (Array.from(String(body.message).trim()).length < 10) {
              setValidation(
                "Lời nhắn cần ít nhất 10 ký tự sau khi bỏ khoảng trắng thừa.",
              );
              return;
            }
            setValidation(undefined);
            const result = await command.run(
              JSON.stringify(body),
              async (key) => {
                submitted.current = body;
                const existing = await findInPages<Proposal>(
                  request,
                  "proposals?direction=sent&status=PENDING&learningRequestId=" +
                    post.id +
                    "&limit=100",
                  (row) =>
                    row.sourceType === "LEARNING_REQUEST" &&
                    row.learningRequestId === post.id &&
                    row.status === "PENDING",
                );
                return existing
                  ? { data: existing }
                  : request<Proposal>("proposals", {
                      method: "POST",
                      body,
                      key,
                    });
              },
            );
            if (result) router.push("/learn/connections/" + result.data.id);
          }}
        >
          <p>
            Bạn đã khai báo kỹ năng phù hợp. Giới thiệu cách bạn có thể hướng
            dẫn nhé.
          </p>
          <label>
            <span>Lời nhắn</span>
            <textarea
              name="message"
              rows={5}
              minLength={10}
              maxLength={1000}
              required
              disabled={command.pending || command.uncertain}
            />
          </label>
          <ProposalHintsFields
            disabled={command.pending || command.uncertain}
          />
          <Feedback error={validation} />
          <CommandFeedback command={command} />
          <button
            type="submit"
            className="btn btn-primary"
            disabled={
              command.pending || (command.uncertain && !command.canRetry)
            }
          >
            Gửi đề xuất hướng dẫn
          </button>
        </form>
      ) : (
        !skills.loading && (
          <>
            <p>
              Khai báo kỹ năng phù hợp để giới thiệu bản thân với người muốn
              học.
              {post.verifiedTeacherOnly
                ? " Bài này yêu cầu kỹ năng đã được xác minh."
                : ""}
            </p>
            <Link className="btn" href="/learn/skills">
              Khai báo kỹ năng
            </Link>
          </>
        )
      )}
    </Panel>
  );
}
