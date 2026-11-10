"use client";

import Link from "next/link";
import { useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { useUserSession } from "../auth/session";
import { useUserList } from "../hooks/use-user-resource";
import { Feedback, More, PageHeading } from "../components/common";
import { ProductIcon } from "../components/product-icon";
import { PathCard, PathsLoading } from "./paths-card";
import {
  matchesPath,
  pathFilters,
  type PathFilter,
  type PathListItem,
} from "./paths-list-model";
import styles from "./paths-screen.module.css";

export function PathsScreen() {
  const query = useUserList<PathListItem>("learning-paths/mine?limit=20");
  const { actor, request } = useUserSession();
  const [filter, setFilter] = useState<PathFilter>("all");
  const [keyword, setKeyword] = useState("");
  const counterpartIds = [...new Set(query.items.map((p) => p.counterpartId))];
  // Reuse the same owner-scoped profile cache as ProfileName elsewhere.
  const profiles = useQueries({
    queries: counterpartIds.map((id) => ({
      queryKey: ["learner", actor.userId, "profiles/" + id],
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        request<{ fullName: string }>("profiles/" + id, { signal }),
    })),
  });
  const names = new Map(
    counterpartIds.map((id, index) => [
      id,
      profiles[index]?.error ? undefined : profiles[index]?.data?.data.fullName,
    ]),
  );
  const visible = query.items.filter((path) =>
    matchesPath(path, filter, keyword, names.get(path.counterpartId)),
  );
  const filtered = filter !== "all" || !!keyword.trim();
  function clearFilters() {
    setFilter("all");
    setKeyword("");
  }

  return (
    <>
      <PageHeading
        eyebrow="HỌC TẬP"
        title="Lộ trình của tôi"
        description="Theo dõi buổi học, tiến độ và những việc cần chú ý."
      />
      <section aria-label="Tìm kiếm và lọc lộ trình" className={styles.toolbar}>
        <label className={`learner-search ${styles.search}`}>
          <ProductIcon name="search" size={19} />
          <input
            aria-label="Tìm theo tên lộ trình hoặc tên đối tác"
            type="search"
            placeholder="Tìm tên lộ trình hoặc đối tác"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
          />
        </label>
        <fieldset className={`learner-tabs ${styles.filters}`}>
          <legend className="sr-only">Lọc lộ trình</legend>
          {pathFilters.map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
            >
              {label}
            </button>
          ))}
        </fieldset>
      </section>
      <output className={styles.context}>
        Hiển thị {visible.length}/{query.items.length} lộ trình đã tải.
        {query.cursor && " Có thể tải thêm lộ trình bên dưới."}
        {keyword.trim() &&
          profiles.some((profile) => profile.isPending) &&
          " Đang tải tên đối tác để tìm kiếm."}
      </output>
      <Feedback
        loading={query.loading && !query.initialLoading}
        error={query.error}
        reload={query.reload}
      />
      <PathsContent
        loading={query.initialLoading}
        paths={visible}
        names={names}
        error={!!query.error}
        filtered={filtered}
        clearFilters={clearFilters}
      />
      <div className={styles.more}>
        <More
          cursor={query.cursor}
          loading={query.loading}
          onMore={() => void query.more()}
        />
      </div>
    </>
  );
}

function PathsContent({
  loading,
  paths,
  names,
  error,
  filtered,
  clearFilters,
}: Readonly<{
  loading: boolean;
  paths: PathListItem[];
  names: Map<string, string | undefined>;
  error: boolean;
  filtered: boolean;
  clearFilters: () => void;
}>) {
  if (loading) return <PathsLoading />;
  if (paths.length)
    return (
      <section aria-label="Danh sách lộ trình" className={styles.grid}>
        {paths.map((path) => (
          <PathCard
            key={path.id}
            path={path}
            counterpartName={names.get(path.counterpartId)}
          />
        ))}
      </section>
    );
  if (error) return null;
  return (
    <div className={`learner-empty ${styles.empty}`}>
      <ProductIcon name="book" size={30} />
      <h2>
        {filtered
          ? "Không tìm thấy lộ trình phù hợp"
          : "Bạn chưa có lộ trình nào"}
      </h2>
      <p>
        {filtered
          ? "Thử từ khóa khác hoặc bỏ bộ lọc để xem các lộ trình đã tải."
          : "Bắt đầu một đề nghị học hoặc trao đổi kỹ năng để tạo lộ trình đầu tiên."}
      </p>
      {filtered ? (
        <button type="button" className="btn" onClick={clearFilters}>
          Bỏ lọc
        </button>
      ) : (
        <Link className="btn btn-primary" href="/learn/explore">
          Khám phá kỹ năng
        </Link>
      )}
    </div>
  );
}
