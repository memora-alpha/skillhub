"use client";
import { ListPagination } from "@/components/pagination/list-pagination";
import {
  splitPages,
  useListPages,
} from "@/components/pagination/use-list-pages";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useUserSession } from "../auth/session";
import { useUserList, useUserResource } from "../hooks/use-user-resource";
import type { Conversation } from "../types";
import { Feedback } from "../components/common";
import { ProductIcon } from "../components/product-icon";
import { ProfileAvatar } from "../components/profile-avatar";
import { formatVietnamTime } from "@/lib/vietnam-time";
import { RequestInbox } from "./request-inbox";
import { inboxGroupSummary, type InboxGroup } from "./inbox-types";
import styles from "./inbox.module.css";

export function InboxLayout({ children }: Readonly<{ children: ReactNode }>) {
  const { actor } = useUserSession();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string>();
  const [scope, setScope] = useState("ALL");
  const [search, setSearch] = useState("");
  const list = useUserList<InboxGroup>("conversations/inbox?limit=20");
  const conversations = useUserList<Conversation>("conversations?limit=20");
  const { cursor, loading, error, more } = list;
  const query = search.trim().toLocaleLowerCase("vi");
  const filtered = scope !== "ALL" || !!query;
  useEffect(() => {
    if (filtered && cursor && !loading && !error) void more();
  }, [filtered, cursor, loading, error, more]);
  const matchedItems = filtered
    ? list.items.filter((row) => {
        if (scope !== "ALL" && row.groupType !== scope) return false;
        if (!query) return true;
        let partnerName: string | undefined;
        if (row.conversationId) {
          const conv = conversations.items.find(
            (item) => item.id === row.conversationId,
          );
          let partnerId: string | undefined;
          if (conv)
            partnerId =
              conv.participantAId === actor.userId
                ? conv.participantBId
                : conv.participantAId;
          if (partnerId) {
            partnerName = queryClient.getQueryData<{
              data?: { fullName?: string };
            }>(["learner", actor.userId, "profiles/" + partnerId])?.data
              ?.fullName;
          }
        }
        const haystack = [partnerName, row.title, row.latestMessage?.preview]
          .filter(Boolean)
          .join(" ")
          .toLocaleLowerCase("vi");
        return haystack.includes(query);
      })
    : list.items;
  const pagination = useListPages({
    ...list,
    scope: `${list.scope}:${scope}:${query}`,
    chunks: filtered ? splitPages(matchedItems) : list.chunks,
    loading: loading || (filtered && !!cursor && !error),
    hasMore: !filtered && !!cursor,
  });
  const groups = { ...list, ...pagination, allItems: list.items };
  const pathname = usePathname();
  const router = useRouter();
  const active = pathname !== "/learn/messages";
  const selected = groups.allItems.find((group) => group.id === selectedId);
  return (
    <div className={styles.page} data-detail={active || !!selected}>
      <div className={styles.workspace}>
        <aside
          className={styles.sidebar}
          aria-label="Danh sách cuộc trò chuyện"
        >
          <div className={styles.sidebarTop}>
            <div className={styles.sidebarHeader}>
              <h1>Đoạn chat</h1>
              <Link
                href="/learn/connections"
                className={styles.connectionsLink}
                title="Xem đề nghị học tập"
              >
                <ProductIcon name="users" size={16} />
                <span>Đề nghị</span>
              </Link>
            </div>
            <label className={styles.searchBox}>
              <ProductIcon name="search" size={16} />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Tìm đoạn chat…"
                aria-label="Tìm đoạn chat"
              />
              {search && (
                <button
                  type="button"
                  className={styles.searchClear}
                  aria-label="Xóa tìm kiếm"
                  onClick={() => setSearch("")}
                >
                  <ProductIcon name="close" size={14} />
                </button>
              )}
            </label>
            <fieldset
              className={styles.filterPills}
              aria-label="Loại cuộc trò chuyện"
            >
              {[
                ["ALL", "Tất cả"],
                ["DIRECT_CONVERSATION", "Trực tiếp"],
                ["LEARNING_REQUEST", "Yêu cầu học"],
              ].map(([value, label]) => (
                <button
                  type="button"
                  key={value}
                  aria-pressed={scope === value}
                  onClick={() => {
                    setScope(value!);
                    setSelectedId(undefined);
                  }}
                >
                  {label}
                </button>
              ))}
            </fieldset>
          </div>
          <div className={styles.sidebarScroll}>
            <Feedback
              loading={groups.initialLoading}
              error={groups.error}
              reload={groups.reload}
              refreshing={!!(groups.loading && !groups.initialLoading)}
            />
            <div className={styles.groupList}>
              {groups.items.map((group) => {
                if (
                  group.groupType === "LEARNING_REQUEST" &&
                  group.learningRequestId
                )
                  return (
                    <button
                      key={group.id}
                      type="button"
                      className={styles.rowItem}
                      data-unread={group.hasUnread}
                      aria-pressed={selectedId === group.id && !active}
                      onClick={() => {
                        setSelectedId(group.id);
                        if (active) router.push("/learn/messages");
                      }}
                    >
                      <span className={styles.groupIcon}>
                        <ProductIcon name="book" size={20} />
                      </span>
                      <span className={styles.rowBody}>
                        <span className={styles.rowTop}>
                          <strong>
                            {group.title?.trim() || "Yêu cầu học"}
                          </strong>
                        </span>
                        <span className={styles.rowBottom}>
                          <span className={styles.previewText}>
                            {inboxGroupSummary(group)}
                          </span>
                        </span>
                      </span>
                      <span className={styles.rowMeta}>
                        {group.hasUnread && (
                          <span
                            className={styles.dot}
                            aria-label="Có tin nhắn chưa đọc"
                          />
                        )}
                        <ProductIcon name="chevron" size={15} />
                      </span>
                    </button>
                  );
                if (group.conversationId)
                  return (
                    <DirectConversation
                      key={group.id}
                      group={group}
                      conversation={conversations.items.find(
                        (item) => item.id === group.conversationId,
                      )}
                      loading={conversations.loading}
                      active={pathname.endsWith("/" + group.conversationId)}
                      onOpen={() => setSelectedId(undefined)}
                    />
                  );
                return null;
              })}
            </div>
            {!groups.loading && !groups.error && !groups.items.length && (
              <div className={styles.empty}>
                <ProductIcon name="chat" size={32} />
                <strong>
                  {query
                    ? "Không tìm thấy đoạn chat phù hợp"
                    : "Chưa có tin nhắn"}
                </strong>
                <p>
                  {query
                    ? "Thử tìm với từ khóa khác hoặc xóa bộ lọc hiện tại."
                    : "Đề nghị nhận được và các cuộc trò chuyện sẽ xuất hiện tại đây."}
                </p>
                {!query && <Link href="/learn/connections">Xem đề nghị</Link>}
              </div>
            )}
            <ListPagination query={groups} />
          </div>
        </aside>
        <div className={styles.main}>
          {!active && selected ? (
            <RequestInbox
              key={selected.id}
              group={selected}
              onBack={() => setSelectedId(undefined)}
            />
          ) : (
            children
          )}
        </div>
      </div>
    </div>
  );
}

function DirectConversation({
  group,
  conversation,
  loading,
  active,
  onOpen,
}: Readonly<{
  group: InboxGroup;
  conversation?: Conversation;
  loading: boolean;
  active: boolean;
  onOpen: () => void;
}>) {
  const { actor } = useUserSession();
  const detail = useUserResource<Conversation>(
    !conversation && !loading ? "conversations/" + group.conversationId : null,
  );
  const row = conversation ?? detail.data;
  let partnerId: string | null = null;
  if (row)
    partnerId =
      row.participantAId === actor.userId
        ? row.participantBId
        : row.participantAId;
  const profile = useUserResource<{
    fullName: string;
    avatarUrl: string | null;
  }>(partnerId ? "profiles/" + partnerId : null);
  const name =
    profile.data?.fullName ?? (group.title?.trim() || "Cuộc trò chuyện");
  const topic = group.title?.trim();
  const last = group.latestMessage;
  const senderPrefix = last?.senderId === actor.userId ? "Bạn: " : "";
  const lastContent =
    last?.preview ||
    (last?.messageType === "FILE"
      ? "Đã gửi một tệp đính kèm"
      : "Cập nhật cuộc trò chuyện");
  const preview = last
    ? senderPrefix + lastContent
    : topic || "Trao đổi trực tiếp";
  return (
    <Link
      className={styles.rowItem}
      href={"/learn/messages/" + group.conversationId}
      aria-current={active ? "page" : undefined}
      data-unread={group.hasUnread}
      onClick={onOpen}
    >
      <ProfileAvatar
        fullName={name}
        avatarUrl={profile.data?.avatarUrl ?? null}
        className={styles.rowAvatar}
      />
      <span className={styles.rowBody}>
        <span className={styles.rowTop}>
          <strong>{name}</strong>
          {topic && topic !== name && (
            <span className={styles.topicTag}>{topic}</span>
          )}
        </span>
        <span className={styles.rowBottom}>
          <span className={styles.previewText}>{preview}</span>
          {last && (
            <>
              <span className={styles.sep} aria-hidden="true">
                ·
              </span>
              <time dateTime={last.sentAt}>
                {formatVietnamTime(last.sentAt)}
              </time>
            </>
          )}
        </span>
      </span>
      {group.hasUnread && (
        <span className={styles.rowMeta}>
          <span className={styles.dot} aria-label="Có tin nhắn chưa đọc" />
        </span>
      )}
    </Link>
  );
}
