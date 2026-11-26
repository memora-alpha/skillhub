"use client";
import { ListPagination } from "@/components/pagination/list-pagination";
import {
  splitPages,
  useListPages,
} from "@/components/pagination/use-list-pages";
import { useUserList } from "../hooks/use-user-resource";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { PathSummary } from "../types";

import {
  Empty,
  Feedback,
  PageHeading,
  Panel,
  Status,
  formatTime,
} from "../components/common";
import { ProfileName } from "../components/profile-name";
import { PathProgress, type PathOverview } from "./path-overview";
import { learningStageLabel, pathActionLabel } from "./path-navigation";

const statusOptions: readonly [string, string][] = [
  ["PROPOSED", "Đang đề xuất"],
  ["PARTIALLY_CONFIRMED", "Chờ bên còn lại xác nhận"],
  ["CONFIRMED", "Đã xác nhận thỏa thuận"],
  ["SCHEDULED", "Đã chốt lịch học"],
  ["ACTIVE", "Đang diễn ra"],
  ["DISPUTED", "Đang tranh chấp"],
  ["COMPLETED", "Đã hoàn thành"],
  ["CANCELLED", "Đã hủy / dừng"],
];

export function PathsScreen() {
  const [status, setStatus] = useState("");
  const list = useUserList<PathSummary & Partial<PathOverview>>(
    "learning-paths/mine?limit=20",
  );
  const { cursor, loading, error, more } = list;
  const filtered = !!status;
  useEffect(() => {
    if (filtered && cursor && !loading && !error) void more();
  }, [filtered, cursor, loading, error, more]);
  const pagination = useListPages({
    ...list,
    scope: `${list.scope}:${status}`,
    chunks: filtered
      ? splitPages(list.items.filter((row) => row.status === status))
      : list.chunks,
    loading: loading || (filtered && !!cursor && !error),
    hasMore: !filtered && !!cursor,
  });
  const query = { ...list, ...pagination, allItems: list.items };
  return (
    <>
      <PageHeading
        eyebrow="Học & Dạy 1:1"
        title="Lộ trình học của tôi"
        description="Quản lý thỏa thuận trao đổi 2 chiều (hai kế hoạch đối ứng) và dạy & học 1 chiều, tiến độ buổi học và trạng thái quyết toán 96% / 4%."
        action={
          <Link className="btn" href="/learn/messages">
            Mở tin nhắn thương lượng →
          </Link>
        }
      />
      <label>
        Trạng thái lộ trình
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          <option value="">Tất cả</option>
          {statusOptions.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <Feedback
        loading={query.initialLoading}
        error={query.error}
        reload={query.reload}
        refreshing={!!(query.loading && !query.initialLoading)}
      />
      <div className="learner-post-grid">
        {query.items.map((path) => (
          <Panel key={path.id}>
            <div className="learner-card-top">
              <Status
                value={path.status}
                label={learningStageLabel(path.learningStage)}
              />
              <span
                className="exchange-pill"
                data-type={path.exchangeType ?? undefined}
              >
                {exchangeLabels[path.exchangeType ?? ""] ?? "Đang thống nhất"}
              </span>
            </div>
            <h2 style={{ marginTop: 12 }}>
              {path.title?.trim() || (
                <>
                  Học cùng <ProfileName id={path.counterpartId} />
                </>
              )}
            </h2>
            {path.title?.trim() && (
              <p>
                Đối tác: <ProfileName id={path.counterpartId} />
              </p>
            )}
            {path.progress && (
              <PathProgress overview={path as PathSummary & PathOverview} />
            )}
            {(path.lastActivityAt || path.updatedAt) && (
              <p className="muted">
                Cập nhật {formatTime((path.lastActivityAt || path.updatedAt)!)}
              </p>
            )}
            <div className="learner-actions">
              <Link
                className="btn btn-primary"
                href={"/learn/paths/" + path.id}
              >
                {pathActionLabel(path.learningStage, path.attentionCount)}
              </Link>
            </div>
          </Panel>
        ))}
      </div>
      {!query.loading && !query.error && !query.items.length && (
        <Empty>
          Chưa có lộ trình. Mở một cuộc trao đổi để tạo thỏa thuận học.
        </Empty>
      )}
      <ListPagination query={query} />
    </>
  );
}

const exchangeLabels: Record<string, string> = {
  TWO_WAY: "Trao đổi kỹ năng hai chiều",
  ONE_WAY: "Hướng dẫn một chiều",
};
