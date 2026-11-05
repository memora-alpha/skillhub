"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
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
import { ProposalSource } from "../connections/proposal-source";
import { ChatDownload } from "./chat-download";
function compareMessages(left: Message, right: Message) {
  const leftSequence = BigInt(left.sequence);
  const rightSequence = BigInt(right.sequence);
  if (leftSequence < rightSequence) return -1;
  if (leftSequence > rightSequence) return 1;
  return 0;
}
function messageClassName(message: Message, userId: string) {
  if (message.messageType === "SYSTEM") return "learner-message system";
  return message.senderId === userId
    ? "learner-message mine"
    : "learner-message ";
}
export function ChatScreen({ id }: Readonly<{ id: string }>) {
  const cache = useQueryClient();
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
  const rows = useMemo(
      () => [...messages.items].sort(compareMessages),
      [messages.items],
    ),
    latest = rows.at(-1)?.id;
  useEffect(() => {
    if (!latest) return;
    let marked = false;
    let pending = false;
    const markRead = () => {
      if (document.visibilityState !== "visible" || marked || pending) return;
      pending = true;
      void request("conversations/" + id + "/read", {
        method: "POST",
        body: { messageId: latest },
      })
        .then(() => {
          marked = true;
          void cache.invalidateQueries({
            queryKey: ["learner", actor.userId, "conversations/inbox?limit=20"],
          });
        })
        .catch(() => undefined)
        .finally(() => {
          pending = false;
        });
    };
    markRead();
    document.addEventListener("visibilitychange", markRead);
    return () => document.removeEventListener("visibilitychange", markRead);
  }, [id, latest, request, cache, actor.userId]);
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
              <Link
                className="learner-card-link"
                href={
                  "/learn/people/" +
                  (conversation.data.participantAId === actor.userId
                    ? conversation.data.participantBId
                    : conversation.data.participantAId)
                }
              >
                <ProfileName
                  id={
                    conversation.data.participantAId === actor.userId
                      ? conversation.data.participantBId
                      : conversation.data.participantAId
                  }
                />
              </Link>
            }
          />
          <Feedback error={proposal.error} reload={proposal.reload} />
          {proposal.data && <ProposalSource proposal={proposal.data} />}
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
                    className={messageClassName(message, actor.userId)}
                  >
                    <p>{message.messageText}</p>
                    {message.attachments.map((file) => (
                      <ChatDownload
                        key={file.attachmentId}
                        conversationId={id}
                        messageId={message.id}
                        attachmentId={file.attachmentId}
                        filename={file.filename}
                      />
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
                  type="button"
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
