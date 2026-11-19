"use client";
import { ListPagination } from "@/components/pagination/list-pagination";
import { useUserPagedList } from "../hooks/use-user-paged-list";
import Link from "next/link";
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
export function PathsScreen() {
  const query = useUserPagedList<PathSummary & Partial<PathOverview>>(
    "learning-paths/mine?limit=20",
  );
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
