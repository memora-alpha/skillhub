"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Conversation, Message, PathSummary, Proposal } from "../types";
import { useUserSession } from "../auth/session";
import { useUserList, useUserResource } from "../hooks/use-user-resource";
import {
  Back,
  Empty,
  Feedback,
  More,
  PageHeading,
  Panel,
  formatTime,
} from "../components/common";
import { ProfileName } from "../components/profile-name";
import { findInPages } from "../api/find-page";
import { MessageComposer } from "./message-composer";
import { AgreementCreator } from "../paths/agreement-creator";
export function ChatScreen({ id }: Readonly<{ id: string }>) {
  const conversation = useUserResource<Conversation>("conversations/" + id),
    messages = useUserList<Message>(
      "conversations/" + id + "/messages?limit=30",
    );
  const { actor, request } = useUserSession(),
    router = useRouter();
  const proposal = useUserResource<Proposal>(
    conversation.data ? "proposals/" + conversation.data.proposalId : null,
  );
  const [creating, setCreating] = useState(false),
    [opening, setOpening] = useState(false),
    [error, setError] = useState<string>();
  const rows = [...messages.items].sort((left, right) =>
      BigInt(left.sequence) < BigInt(right.sequence)
        ? -1
        : BigInt(left.sequence) > BigInt(right.sequence)
          ? 1
          : 0,
    ),
    latest = rows.at(-1)?.id;
  useEffect(() => {
    if (!latest || document.visibilityState !== "visible") return;
    void request("conversations/" + id + "/read", {
      method: "POST",
      body: { messageId: latest },
    }).catch(() => undefined);
  }, [id, latest, request]);
  return (
    <>
      <Back href="/learn/messages" />
      <Feedback
        loading={conversation.loading}
        error={conversation.error}
        reload={conversation.reload}
      />
      {conversation.data && (
        <>
          <PageHeading
            title="Cùng thống nhất buổi học"
            action={
              <ProfileName
                id={
                  conversation.data.participantAId === actor.userId
                    ? conversation.data.participantBId
                    : conversation.data.participantAId
                }
              />
            }
          />
          <div className="learner-two-columns">
            <Panel title="Cuộc trò chuyện">
              <More
                cursor={messages.cursor}
                loading={messages.loading}
                onMore={() => {
                  void messages.more();
                }}
              />
              <Feedback
                loading={messages.loading}
                error={messages.error}
                reload={messages.reload}
              />
              <div className="learner-chat">
                {rows.map((message) => (
                  <article
                    key={message.id}
                    className={
                      "learner-message " +
                      (message.messageType === "SYSTEM"
                        ? "system"
                        : message.senderId === actor.userId
                          ? "mine"
                          : "")
                    }
                  >
                    <p>{message.messageText}</p>
                    {message.attachments.map((file) => (
                      <p key={file.attachmentId}>
                        Tệp đính kèm: {file.filename}
                      </p>
                    ))}
                    {message.objectType === "LEARNING_PATH" &&
                      message.objectId && (
                        <Link href={"/learn/paths/" + message.objectId}>
                          Xem lộ trình
                        </Link>
                      )}
                    <time dateTime={message.sentAt}>
                      {formatTime(message.sentAt)}
                    </time>
                  </article>
                ))}
              </div>
              {!messages.loading && !messages.error && !rows.length && (
                <Empty>Bắt đầu bằng lời chào và mục tiêu của bạn.</Empty>
              )}
              <MessageComposer conversationId={id} />
            </Panel>
            <div className="learner-stack">
              <Panel title="Từ trao đổi đến buổi học">
                <p>
                  Tin nhắn giúp hai bên trao đổi. Kế hoạch, Credit và lịch chỉ
                  có hiệu lực sau khi xác nhận trên thỏa thuận.
                </p>
                <button
                  className="btn btn-primary"
                  disabled={opening}
                  onClick={() => {
                    if (opening) return;
                    setOpening(true);
                    setError(undefined);
                    void findInPages<PathSummary>(
                      request,
                      "learning-paths/mine?limit=100",
                      (path) => path.conversationId === id,
                    )
                      .then((path) => {
                        if (path) router.push("/learn/paths/" + path.id);
                        else setCreating(true);
                      })
                      .catch((cause: unknown) =>
                        setError(
                          cause instanceof Error
                            ? cause.message
                            : "Không thể mở lộ trình.",
                        ),
                      )
                      .finally(() => setOpening(false));
                  }}
                >
                  Mở / tạo thỏa thuận học
                </button>
                <Feedback error={error} />
              </Panel>
              {creating && proposal.data && (
                <AgreementCreator
                  conversation={conversation.data}
                  proposal={proposal.data}
                />
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
