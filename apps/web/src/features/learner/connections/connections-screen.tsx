"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useUserSession } from "../auth/session";
import { useUserList } from "../hooks/use-user-resource";
import { useUserCommand } from "../hooks/use-user-command";
import type { Proposal, Conversation, Post } from "../types";
import {
  CommandFeedback,
  Empty,
  Feedback,
  More,
  PageHeading,
  Panel,
  Status,
} from "../components/common";
import { ProfileName } from "../components/profile-name";
import { findInPages } from "../api/find-page";
export function ConnectionsScreen() {
  const [direction, setDirection] = useState("received");
  const query = useUserList<Proposal>(
    "proposals?limit=20&direction=" + direction,
  );
  return (
    <>
      <PageHeading
        title="Kết nối của tôi"
        description="Xem đề xuất, chọn người phù hợp rồi trao đổi kế hoạch học."
        action={
          <div className="learner-tabs">
            <button
              aria-pressed={direction === "received"}
              onClick={() => setDirection("received")}
            >
              Đã nhận
            </button>
            <button
              aria-pressed={direction === "sent"}
              onClick={() => setDirection("sent")}
            >
              Đã gửi
            </button>
          </div>
        }
      />
      <Feedback
        loading={query.loading}
        error={query.error}
        reload={query.reload}
      />
      <div className="learner-stack">
        {query.items.map((proposal) => (
          <ProposalCard key={proposal.id} proposal={proposal} />
        ))}
      </div>
      {!query.loading && !query.error && !query.items.length && (
        <Empty>
          Chưa có đề xuất trong mục này. Đăng một bài hoặc khám phá cộng đồng để
          kết nối.
        </Empty>
      )}
      <More
        cursor={query.cursor}
        loading={query.loading}
        onMore={() => {
          void query.more();
        }}
      />
    </>
  );
}
function ProposalCard({ proposal }: Readonly<{ proposal: Proposal }>) {
  const { actor, request } = useUserSession(),
    command = useUserCommand(true),
    router = useRouter();
  const [opening, setOpening] = useState(false),
    [error, setError] = useState<string>();
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
    <Panel>
      <div className="learner-card-top">
        <h2>
          <ProfileName id={other} />
        </h2>
        <Status value={proposal.status} />
      </div>
      <p className="learner-prose">{proposal.message}</p>
      {proposal.candidateSlots && <p>Gợi ý lịch: {proposal.candidateSlots}</p>}
      {proposal.proposedCredit && (
        <p>Credit gợi ý: {proposal.proposedCredit} CR</p>
      )}
      <div className="learner-actions">
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
                  command.pending || (command.uncertain && !command.canRetry)
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
                  void decide("reject");
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
                void decide("withdraw");
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
      <Feedback error={error} />
      <CommandFeedback command={command} />
    </Panel>
  );
}
