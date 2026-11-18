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
      <PageHeading title="Lộ trình học của tôi" />
      <Feedback
        loading={query.loading}
        error={query.error}
        reload={query.reload}
      />
      <div className="learner-post-grid">
        {query.items.map((path) => (
          <Panel key={path.id}>
            <Status
              value={path.status}
              label={learningStageLabel(path.learningStage)}
            />
            <h2>
              {path.title?.trim() || (
                <>
                  Học cùng <ProfileName id={path.counterpartId} />
                </>
              )}
            </h2>
            {path.title?.trim() && (
              <p>
                Học cùng <ProfileName id={path.counterpartId} />
              </p>
            )}
            <p>
              {exchangeLabels[path.exchangeType ?? ""] ??
                "Đang thống nhất hình thức"}
            </p>
            {path.progress && (
              <PathProgress overview={path as PathSummary & PathOverview} />
            )}
            {(path.lastActivityAt || path.updatedAt) && (
              <p className="muted">
                Cập nhật {formatTime((path.lastActivityAt || path.updatedAt)!)}
              </p>
            )}
            <Link className="btn btn-primary" href={"/learn/paths/" + path.id}>
              {pathActionLabel(path.learningStage, path.attentionCount)}
            </Link>
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
