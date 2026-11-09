"use client";
import { useState } from "react";
import { Card, PageHeader, StatusBadge } from "@/components/console/ui";
import { useStaffList, useStaffResource } from "./hooks";
import { useStaffSession } from "./session";
import { DecisionDialog, Pager, QueueState } from "./common";
import { Identifier } from "./operation-tools";
type Review = {
  id: string;
  reviewerId: string;
  revieweeId: string;
  rating: number;
  comment: string | null;
  hiddenAt: string | null;
  moderationVersion: number;
};
type Profile = {
  userId: string;
  updatedAt: string;
  bio: string | null;
  avatarUrl: string | null;
  moderation: Record<string, unknown> | null;
};
export function ContentModerationScreen({
  initialUserId = "",
}: Readonly<{ initialUserId?: string }>) {
  const [draft, setDraft] = useState(initialUserId);
  const [userId, setUserId] = useState(initialUserId);
  return (
    <>
      <PageHeader
        title="Hồ sơ & đánh giá"
        desc="Xem nội dung và ghi rõ lý do kiểm duyệt."
      />
      <Card>
        <form
          className="toolbar"
          onSubmit={(e) => {
            e.preventDefault();
            setUserId(draft);
          }}
        >
          <Identifier value={draft} onChange={setDraft} />
          <button className="btn" type="submit">
            Xem hồ sơ
          </button>
        </form>
        {userId && <ProfileModeration key={userId} userId={userId} />}
      </Card>
      <ReviewModeration />
    </>
  );
}
function ProfileModeration({ userId }: Readonly<{ userId: string }>) {
  const { api } = useStaffSession();
  const resource = useStaffResource<Profile>(
    `users/${userId}/profile-moderation`,
  );
  const [decision, setDecision] = useState<{
    field: "BIO" | "AVATAR";
    action: "HIDE" | "REQUEST_EDIT";
  }>();
  return (
    <QueueState
      loading={resource.loading}
      error={resource.error}
      empty={!resource.data}
      reload={resource.reload}
    >
      {resource.data && (
        <>
          <h3>Nội dung hồ sơ</h3>
          <p>{resource.data.bio || "Chưa có giới thiệu."}</p>
          {resource.data.avatarUrl && (
            <a href={resource.data.avatarUrl} target="_blank" rel="noreferrer">
              Xem ảnh đại diện
            </a>
          )}
          <div className="row">
            {(["BIO", "AVATAR"] as const).map((field) => (
              <div key={field}>
                <strong>
                  {field === "BIO" ? "Giới thiệu" : "Ảnh đại diện"}
                </strong>
                {(["HIDE", "REQUEST_EDIT"] as const).map((action) => (
                  <button
                    type="button"
                    className="btn"
                    key={action}
                    onClick={() => setDecision({ field, action })}
                  >
                    {action === "HIDE" ? "Ẩn" : "Yêu cầu sửa"}
                  </button>
                ))}
              </div>
            ))}
          </div>
          {decision && (
            <DecisionDialog
              title={
                decision.action === "HIDE"
                  ? "Ẩn nội dung hồ sơ"
                  : "Yêu cầu sửa hồ sơ"
              }
              description="Lý do sẽ được hiển thị cho chủ hồ sơ."
              min={3}
              max={1000}
              confirmLabel="Xác nhận"
              onClose={() => setDecision(undefined)}
              onReload={resource.reload}
              onSubmit={async (reason) => {
                await api(`users/${userId}/profile-moderation`, {
                  method: "POST",
                  body: {
                    ...decision,
                    reason,
                    expectedUpdatedAt: resource.data!.updatedAt,
                  },
                });
                setDecision(undefined);
                await resource.reload();
              }}
            />
          )}
        </>
      )}
    </QueueState>
  );
}
function ReviewModeration() {
  const { api } = useStaffSession();
  const reviews = useStaffList<Review>("reviews?limit=20");
  const [selected, setSelected] = useState<Review>();
  return (
    <Card>
      <h2>Đánh giá</h2>
      <QueueState
        loading={reviews.loading}
        error={reviews.error}
        empty={!reviews.items.length}
        reload={reviews.reload}
      >
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Người đánh giá / nhận</th>
                <th>Nội dung</th>
                <th>Trạng thái</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {reviews.items.map((r) => (
                <tr key={r.id}>
                  <td>
                    <small>
                      {r.reviewerId}
                      <br />
                      {r.revieweeId}
                    </small>
                  </td>
                  <td>
                    {r.rating}/5 · {r.comment || "Không có nhận xét"}
                  </td>
                  <td>
                    <StatusBadge status={r.hiddenAt ? "HIDDEN" : "PUBLISHED"} />
                  </td>
                  <td>
                    <button className="btn" onClick={() => setSelected(r)}>
                      {r.hiddenAt ? "Khôi phục" : "Ẩn"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </QueueState>
      <Pager
        loading={reviews.loading}
        hasMore={reviews.page?.hasMore}
        more={reviews.more}
      />
      {selected && (
        <DecisionDialog
          title={selected.hiddenAt ? "Khôi phục đánh giá" : "Ẩn đánh giá"}
          description="Điểm uy tín được giữ theo quy tắc của hệ thống."
          min={3}
          max={1000}
          confirmLabel="Xác nhận"
          onClose={() => setSelected(undefined)}
          onReload={reviews.reload}
          onSubmit={async (reason) => {
            await api(`reviews/${selected.id}/moderation`, {
              method: "POST",
              body: {
                reason,
                hidden: !selected.hiddenAt,
                expectedVersion: selected.moderationVersion,
              },
            });
            setSelected(undefined);
            await reviews.reload();
          }}
        />
      )}
    </Card>
  );
}
