"use client";
import { useState } from "react";
import Link from "next/link";
import { useUserList } from "../hooks/use-user-resource";
import { useUserSession } from "../auth/session";
import type { Conversation, Proposal } from "../types";
import { Feedback, More, statusText } from "../components/common";
import { MemberIdentity } from "../components/member-identity";
import { ProductIcon } from "../components/product-icon";
import { ProposalCard } from "../connections/proposal-card";
import type { InboxGroup } from "./inbox-types";
import styles from "./inbox.module.css";

export function RequestInbox({
  group,
  onBack,
}: Readonly<{ group: InboxGroup; onBack: () => void }>) {
  const [view, setView] = useState(
    group.conversationCount ? "chats" : "proposals",
  );
  const direction = group.viewerRole === "OWNER" ? "received" : "sent";
  return (
    <section className={styles.request}>
      <header className={styles.requestHeader}>
        <button
          type="button"
          className={styles.iconButton}
          aria-label="Quay lại tin nhắn"
          onClick={onBack}
        >
          <span className={styles.backIcon}>
            <ProductIcon name="arrow" />
          </span>
        </button>
        <div>
          <small>YÊU CẦU HỌC</small>
          <h2>{group.title?.trim() || "Yêu cầu học"}</h2>
        </div>
        <Link
          className={styles.sourceLink}
          href={"/learn/posts/" + group.learningRequestId}
        >
          Xem bài
        </Link>
      </header>
      <div
        className={styles.tabs}
        role="group"
        aria-label="Nội dung yêu cầu học"
      >
        <button
          type="button"
          aria-pressed={view === "proposals"}
          onClick={() => setView("proposals")}
        >
          {group.viewerRole === "OWNER"
            ? "Đề nghị nhận được"
            : "Đề nghị đã gửi"}
        </button>
        <button
          type="button"
          aria-pressed={view === "chats"}
          onClick={() => setView("chats")}
        >
          Đoạn chat
        </button>
      </div>
      {view === "chats" ? (
        <RequestChats id={group.learningRequestId!} />
      ) : group.viewerRole === "PARTICIPANT" ? (
        <p className={styles.empty}>
          Bạn có thể xem các cuộc trò chuyện của mình trong mục Đoạn chat.
        </p>
      ) : (
        <RequestProposals id={group.learningRequestId!} direction={direction} />
      )}
    </section>
  );
}

function RequestChats({ id }: Readonly<{ id: string }>) {
  const { actor } = useUserSession();
  const query = useUserList<Conversation>(
    "conversations?limit=20&learningRequestId=" + id,
  );
  return (
    <div className={styles.requestBody}>
      <Feedback
        loading={query.loading}
        error={query.error}
        reload={query.reload}
      />
      {query.items.map((conversation) => (
        <Link
          className={styles.conversation}
          href={"/learn/messages/" + conversation.id}
          key={conversation.id}
        >
          <MemberIdentity
            id={
              conversation.participantAId === actor.userId
                ? conversation.participantBId
                : conversation.participantAId
            }
            description="Mở cuộc trò chuyện"
          />
          <ProductIcon name="chevron" size={16} />
        </Link>
      ))}
      {!query.loading && !query.error && !query.items.length && (
        <p className={styles.empty}>
          Chưa có đoạn chat. Cuộc trò chuyện sẽ xuất hiện khi đề nghị được chấp
          nhận.
        </p>
      )}
      <More
        cursor={query.cursor}
        loading={query.loading}
        onMore={() => {
          void query.more();
        }}
      />
    </div>
  );
}

function RequestProposals({
  id,
  direction,
}: Readonly<{ id: string; direction: string }>) {
  const [status, setStatus] = useState("all");
  const params = new URLSearchParams({
    limit: "20",
    learningRequestId: id,
    direction,
  });
  if (status !== "all") params.set("status", status);
  const query = useUserList<Proposal>("proposals?" + params);
  return (
    <div className={styles.requestBody}>
      <label className={styles.statusFilter}>
        Trạng thái
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          {[
            "all",
            "PENDING",
            "ACCEPTED",
            "REJECTED",
            "WITHDRAWN",
            "EXPIRED",
          ].map((value) => (
            <option value={value} key={value}>
              {value === "all" ? "Tất cả trạng thái" : statusText(value)}
            </option>
          ))}
        </select>
      </label>
      <Feedback
        loading={query.loading}
        error={query.error}
        reload={query.reload}
      />
      {query.items.map((proposal) => (
        <ProposalCard key={proposal.id} proposal={proposal} />
      ))}
      {!query.loading && !query.error && !query.items.length && (
        <p className={styles.empty}>Chưa có đề nghị ở trạng thái này.</p>
      )}
      <More
        cursor={query.cursor}
        loading={query.loading}
        onMore={() => {
          void query.more();
        }}
      />
    </div>
  );
}
