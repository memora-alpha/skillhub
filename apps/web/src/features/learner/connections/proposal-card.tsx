"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useUserSession } from "../auth/session";
import { useUserResource } from "../hooks/use-user-resource";
import { useUserCommand } from "../hooks/use-user-command";
import type { Proposal, Conversation, Post, Skill } from "../types";
import {
  CommandFeedback,
  Feedback,
  Status,
  formatTime,
} from "../components/common";
import { MemberIdentity } from "../components/member-identity";
import { ProductIcon } from "../components/product-icon";
import { findInPages } from "../api/find-page";
import { ProposalSource } from "./proposal-source";
import { ProposalEditor } from "./proposal-editor";
import styles from "./connections.module.css";
export function ProposalCard({
  proposal,
  detail = false,
}: Readonly<{ proposal: Proposal; detail?: boolean }>) {
  const { actor, request } = useUserSession(),
    command = useUserCommand(true),
    router = useRouter();
  const [opening, setOpening] = useState(false),
    [editing, setEditing] = useState(false),
    [error, setError] = useState<string>();
  const skill = useUserResource<Skill>("skills/" + proposal.skillId);
  const sent = proposal.proposerId === actor.userId;
  const [closing, setClosing] = useState<"reject" | "withdraw">();
  const other =
    proposal.proposerId === actor.userId
      ? proposal.recipientId
      : proposal.proposerId;
  async function decide(action: "accept" | "reject" | "withdraw") {
    const result = await command.run(
      action + ":" + proposal.id + ":" + proposal.version,
      async (key) => {
        const source =
          action === "accept" && proposal.learningRequestId
            ? (
                await request<Post>(
                  "learning-requests/" + proposal.learningRequestId,
                )
              ).data
            : undefined;
        return request<{ conversation?: Conversation }>(
          "proposals/" + proposal.id + "/" + action,
          {
            method: "POST",
            key,
            body: {
              expectedVersion: proposal.version,
              ...(source ? { expectedRequestVersion: source.version } : {}),
            },
          },
        );
      },
    );
    if (result?.data.conversation)
      router.push("/learn/messages/" + result.data.conversation.id);
  }
  return (
    <article
      className={styles.card + (!detail && sent ? " " + styles.compact : "")}
    >
      {(detail || !sent) && (
        <>
          <div className={styles.source}>
            <span>
              {proposal.sourceType === "DIRECT_SEARCH"
                ? "Lời mời trực tiếp"
                : "Phản hồi yêu cầu học"}
            </span>
            {proposal.exchangeTypeHint && (
              <span>
                {proposal.exchangeTypeHint === "TWO_WAY"
                  ? "Gợi ý hai chiều"
                  : "Gợi ý một chiều"}
              </span>
            )}
          </div>
          <h2>
            <Link href={"/learn/connections/" + proposal.id}>
              {proposal.learningRequestTitle?.trim() ||
                skill.data?.name ||
                "Đề nghị học tập"}
            </Link>
          </h2>
        </>
      )}
      <div className={styles.personRow}>
        <Link href={"/learn/people/" + other}>
          <MemberIdentity
            id={other}
            description={
              <>
                {sent ? "Bạn đã gửi" : "Gửi cho bạn"} ·{" "}
                {formatTime(proposal.createdAt)}
              </>
            }
          />
        </Link>
        <Status value={proposal.status} />
      </div>
      <p className={styles.message + (!detail ? " " + styles.preview : "")}>
        {proposal.message}
      </p>
      {proposal.proposedCredit !== null && (
        <p className={styles.credit}>
          <ProductIcon name="wallet" size={16} />
          Credit gợi ý: <strong>{proposal.proposedCredit} CR</strong>
        </p>
      )}
      {!detail && (
        <div className={styles.actions}>
          <Link
            className={
              styles.action +
              (proposal.status === "PENDING" && !sent
                ? " " + styles.primary
                : "")
            }
            href={"/learn/connections/" + proposal.id}
          >
            {proposal.status === "PENDING" && !sent
              ? "Xem và phản hồi"
              : "Chi tiết"}
            <ProductIcon name="arrow" size={16} />
          </Link>
          {proposal.status === "ACCEPTED" && (
            <Link
              className={styles.action + " " + styles.primary}
              href={
                proposal.conversationId
                  ? "/learn/messages/" + proposal.conversationId
                  : "/learn/messages"
              }
            >
              <ProductIcon name="chat" size={16} />
              Nhắn tin
            </Link>
          )}
        </div>
      )}
      {detail && (
        <>
          <div className={styles.details}>
            <ProposalSource proposal={proposal} />
            {proposal.candidateSlots && (
              <p>Gợi ý thời gian: {proposal.candidateSlots}</p>
            )}
            {proposal.proposedDurationMinutes != null && (
              <p>
                Thời lượng gợi ý: {proposal.proposedDurationMinutes} phút/buổi
              </p>
            )}
            {proposal.initialSessionCount != null && (
              <p>Số buổi gợi ý: {proposal.initialSessionCount} buổi</p>
            )}
            <p>Credit và lịch học sẽ được hai bên xác nhận trong thỏa thuận.</p>
          </div>
          <div className="learner-actions" inert={editing}>
            <Link className="btn" href={"/learn/people/" + other}>
              Xem hồ sơ đối tác
            </Link>
            {proposal.learningRequestId && (
              <Link
                className="btn"
                href={"/learn/posts/" + proposal.learningRequestId}
              >
                Xem bài học
              </Link>
            )}
            {proposal.status === "PENDING" &&
              (proposal.recipientId === actor.userId ? (
                <>
                  <button
                    className="btn btn-primary"
                    disabled={
                      command.pending ||
                      (command.uncertain && !command.canRetry)
                    }
                    onClick={() => {
                      void decide("accept");
                    }}
                  >
                    Chấp nhận và trao đổi
                  </button>
                  <button
                    className="btn"
                    disabled={command.pending || command.uncertain}
                    onClick={() => {
                      setClosing("reject");
                    }}
                  >
                    Từ chối
                  </button>
                </>
              ) : (
                <button
                  className="btn"
                  disabled={command.pending || command.uncertain}
                  onClick={() => {
                    setClosing("withdraw");
                  }}
                >
                  Rút đề xuất
                </button>
              ))}
            {proposal.status === "ACCEPTED" && (
              <button
                className="btn btn-primary"
                disabled={opening}
                onClick={() => {
                  if (opening) return;
                  setOpening(true);
                  void findInPages<Conversation>(
                    request,
                    "conversations?limit=100",
                    (row) => row.proposalId === proposal.id,
                  )
                    .then((row) => {
                      if (row) router.push("/learn/messages/" + row.id);
                      else
                        setError(
                          "Chưa đọc được cuộc trao đổi. Mở mục Tin nhắn và tải lại.",
                        );
                    })
                    .catch((cause: unknown) =>
                      setError(
                        cause instanceof Error
                          ? cause.message
                          : "Không thể mở cuộc trao đổi.",
                      ),
                    )
                    .finally(() => setOpening(false));
                }}
              >
                Mở tin nhắn
              </button>
            )}
          </div>
          {proposal.status === "PENDING" &&
            proposal.proposerId === actor.userId && (
              <>
                <button
                  type="button"
                  className="btn"
                  disabled={command.pending || command.uncertain || editing}
                  onClick={() => setEditing(true)}
                >
                  Sửa đề xuất
                </button>
                {editing && (
                  <ProposalEditor
                    proposal={proposal}
                    onClose={() => setEditing(false)}
                  />
                )}
              </>
            )}

          {closing && proposal.status === "PENDING" && (
            <section
              className="learner-notice"
              aria-label="Xác nhận phản hồi đề nghị"
            >
              <p>
                {closing === "reject"
                  ? "Bạn muốn từ chối đề nghị này?"
                  : "Rút đề nghị này? Người nhận sẽ không thể chấp nhận sau khi bạn rút."}
              </p>
              <div className="learner-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={command.pending || command.uncertain}
                  onClick={() => {
                    void decide(closing);
                  }}
                >
                  Xác nhận {closing === "reject" ? "từ chối" : "rút đề nghị"}
                </button>
                <button
                  type="button"
                  className="btn"
                  disabled={command.pending}
                  onClick={() => setClosing(undefined)}
                >
                  Giữ đề nghị
                </button>
              </div>
            </section>
          )}
          <Feedback error={error} />
          <CommandFeedback command={command} />
        </>
      )}
    </article>
  );
}
