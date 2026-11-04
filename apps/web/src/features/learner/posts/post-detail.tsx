"use client";
import { formText } from "../components/form-data";

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
} from "../components/common";
export function PostDetail({ id }: Readonly<{ id: string }>) {
  const query = useUserResource<Post>("learning-requests/" + id),
    { request } = useUserSession(),
    command = useUserCommand();
  const post = query.data,
    owner = post && !post.owner;
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
          <div className="learner-two-columns">
            <Panel title="Điều mình muốn học">
              <p className="learner-prose">{post.description}</p>
              <h3>Mục tiêu</h3>
              <p className="learner-prose">{post.learningGoal}</p>
              <p>
                {post.skill?.name ?? "Kỹ năng đã chọn"} ·{" "}
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
                  {["DRAFT", "OPEN", "REJECTED"].includes(post.status) && (
                    <Link className="btn" href={"/learn/posts/" + id + "/edit"}>
                      Chỉnh sửa bài
                    </Link>
                  )}
                  {["DRAFT", "REJECTED"].includes(post.status) && (
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
                  <Link className="btn" href="/learn/connections">
                    Xem đề xuất kết nối
                  </Link>
                </div>
              )}
              <CommandFeedback command={command} />
            </Panel>
            {!owner && post.status === "OPEN" ? (
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
  const skillId = post.skill?.id ?? post.skillId,
    eligible = skills.items.some(
      (skill) =>
        skill.skill.id === skillId && skill.isVisible && !skill.archivedAt,
    );
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
            const body = {
              sourceType: "LEARNING_REQUEST",
              learningRequestId: post.id,
              message: formText(data, "message").trim(),
              exchangeTypeHint: "ONE_WAY",
              candidateSlots: formText(data, "schedule").trim() || null,
            };
            const result = await command.run(JSON.stringify(body), (key) =>
              request<Proposal>("proposals", { method: "POST", body, key }),
            );
            if (result) router.push("/learn/connections");
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
              disabled={command.pending}
            />
          </label>
          <label>
            <span>Gợi ý thời gian</span>
            <input
              name="schedule"
              maxLength={1000}
              disabled={command.pending}
              placeholder="Ví dụ: Chiều thứ Ba, khoảng 15 giờ"
            />
          </label>
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
