"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useUserSession } from "../auth/session";
import { useUserList } from "../hooks/use-user-resource";
import { useUserCommand } from "../hooks/use-user-command";
import { Feedback, More, CommandFeedback } from "../components/common";
import { formText } from "../components/form-data";
import { findInPages } from "../api/find-page";
import type { Post, Proposal, SharingSkill } from "../types";
import { canTeachPost } from "./post-policy";
import {
  ProposalHintsFields,
  readProposalHints,
} from "../connections/proposal-hints";
import styles from "./posts.module.css";
export function PostProposalForm({ post }: Readonly<{ post: Post }>) {
  const skills = useUserList<SharingSkill>("me/skills?limit=50"),
    { request } = useUserSession(),
    router = useRouter(),
    command = useUserCommand(true);
  const eligible = skills.items.some((skill) => canTeachPost(skill, post));
  const [validation, setValidation] = useState<string>();
  const submitted = useRef<Record<string, unknown> | undefined>(undefined);
  return (
    <div className={styles.proposalForm}>
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
            Gửi đề xuất
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
    </div>
  );
}
