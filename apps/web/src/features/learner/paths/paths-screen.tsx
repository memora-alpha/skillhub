"use client";
import Link from "next/link";
import type { PathSummary } from "../types";
import { useUserList } from "../hooks/use-user-resource";
import {
  Empty,
  Feedback,
  More,
  PageHeading,
  Panel,
  Status,
} from "../components/common";
import { ProfileName } from "../components/profile-name";
export function PathsScreen() {
  const query = useUserList<PathSummary>("learning-paths/mine?limit=20");
  return (
    <>
      <PageHeading
        title="Lộ trình học của tôi"
        description="Từ một lời hẹn đến kế hoạch học rõ ràng, có xác nhận của cả hai."
      />
      <Feedback
        loading={query.loading}
        error={query.error}
        reload={query.reload}
      />
      <div className="learner-post-grid">
        {query.items.map((path) => (
          <Panel key={path.id}>
            <Status value={path.status} />
            <h2>
              Học cùng <ProfileName id={path.counterpartId} />
            </h2>
            <p>
              {path.exchangeType === "TWO_WAY"
                ? "Trao đổi kỹ năng hai chiều"
                : path.exchangeType === "ONE_WAY"
                  ? "Hướng dẫn một chiều"
                  : "Đang thống nhất hình thức"}
            </p>
            <Link className="btn btn-primary" href={"/learn/paths/" + path.id}>
              Xem kế hoạch và lịch học
            </Link>
          </Panel>
        ))}
      </div>
      {!query.loading && !query.error && !query.items.length && (
        <Empty>
          Chưa có lộ trình. Mở một cuộc trao đổi để tạo thỏa thuận học.
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
