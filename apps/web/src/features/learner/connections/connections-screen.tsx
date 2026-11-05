"use client";
import { useState } from "react";
import Link from "next/link";
import { useUserList } from "../hooks/use-user-resource";
import type { Proposal } from "../types";
import { Feedback, More, statusText } from "../components/common";
import { ProductIcon } from "../components/product-icon";
import { ProposalCard } from "./proposal-card";
import styles from "./connections.module.css";
export { ProposalCard } from "./proposal-card";

const directions = [
  { value: "received", label: "Nhận được" },
  { value: "sent", label: "Đã gửi" },
  { value: "all", label: "Tất cả" },
];
const statuses = [
  "all",
  "PENDING",
  "ACCEPTED",
  "REJECTED",
  "WITHDRAWN",
  "EXPIRED",
];

export function ConnectionsScreen({
  requestId,
  initialDirection = "received",
}: Readonly<{ requestId?: string; initialDirection?: string }>) {
  const [direction, setDirection] = useState(initialDirection);
  const [status, setStatus] = useState("all");
  const [keyword, setKeyword] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const params = new URLSearchParams({ limit: "20", direction });
  if (requestId) params.set("learningRequestId", requestId);
  if (status !== "all") params.set("status", status);
  const query = useUserList<Proposal>("proposals?" + params);
  const term = keyword.trim().toLocaleLowerCase("vi");
  const items = query.items.filter((proposal) =>
    [
      proposal.message,
      proposal.learningRequestTitle,
      proposal.candidateSlots,
    ].some((value) => value?.toLocaleLowerCase("vi").includes(term)),
  );
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1>Đề nghị học tập</h1>
          <p>Kết nối, trao đổi và tìm người cùng học.</p>
        </div>
        <div className={styles.headerActions}>
          <Link
            className={styles.action}
            href="/learn/messages"
            aria-label="Tin nhắn"
            title="Tin nhắn"
          >
            <ProductIcon name="chat" size={17} />
            <span>Tin nhắn</span>
          </Link>
          <button
            type="button"
            className={styles.iconButton}
            aria-label="Tìm đề nghị"
            aria-expanded={searchOpen}
            onClick={() => {
              setSearchOpen(!searchOpen);
              setKeyword("");
            }}
          >
            <ProductIcon name={searchOpen ? "close" : "search"} />
          </button>
        </div>
      </header>
      <div className={styles.toolbar}>
        {searchOpen && (
          <label className={styles.search}>
            <ProductIcon name="search" size={18} />
            <input
              autoFocus
              aria-label="Tìm trong các đề nghị đã tải"
              placeholder="Tìm nội dung đề nghị…"
              maxLength={100}
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
            />
          </label>
        )}
        <p>Đề nghị của bạn</p>
        <div className={styles.filterRow}>
          <div className={styles.tabs} role="group" aria-label="Chiều đề nghị">
            {directions.map((item) => (
              <button
                type="button"
                key={item.value}
                aria-pressed={direction === item.value}
                onClick={() => {
                  setDirection(item.value);
                  setKeyword("");
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className={styles.filterButton}
            aria-label="Lọc theo trạng thái"
            aria-expanded={filterOpen}
            onClick={() => setFilterOpen(!filterOpen)}
          >
            <ProductIcon name="filter" />
            {status !== "all" && <span />}
          </button>
        </div>
        {filterOpen && (
          <div
            className={styles.options}
            role="group"
            aria-label="Trạng thái đề nghị"
          >
            {statuses.map((value) => (
              <button
                type="button"
                key={value}
                aria-pressed={status === value}
                onClick={() => {
                  setStatus(value);
                  setFilterOpen(false);
                }}
              >
                {value === "all" ? "Tất cả trạng thái" : statusText(value)}
              </button>
            ))}
          </div>
        )}
        {status !== "all" && <p>Trạng thái: {statusText(status)}</p>}
      </div>
      {requestId && (
        <p className="learner-notice">
          Đề nghị của yêu cầu học đã chọn.{" "}
          <Link href={"/learn/posts/" + requestId}>Xem yêu cầu học</Link> ·{" "}
          <Link href="/learn/connections">Bỏ lọc yêu cầu học</Link>
        </p>
      )}
      <Feedback
        loading={query.loading}
        error={query.error}
        reload={query.reload}
      />
      <div className={styles.cards}>
        {items.map((proposal) => (
          <ProposalCard key={proposal.id} proposal={proposal} />
        ))}
      </div>
      {!query.loading && !query.error && !items.length && (
        <section className={styles.empty}>
          <ProductIcon name="users" size={36} />
          <h2>{term ? "Chưa thấy đề nghị phù hợp" : "Chưa có đề nghị"}</h2>
          <p>
            {term
              ? "Thử từ khóa khác hoặc tải thêm đề nghị bên dưới."
              : "Đề nghị ở trạng thái này sẽ xuất hiện tại đây."}
          </p>
          {term ? (
            <button
              type="button"
              className="btn"
              onClick={() => setKeyword("")}
            >
              Xóa tìm kiếm
            </button>
          ) : (
            <Link
              className="btn btn-primary"
              href="/learn/explore?view=sharers"
            >
              Khám phá người chia sẻ
            </Link>
          )}
        </section>
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
