"use client";
import { useState } from "react";
import {
  Card,
  PageHeader,
  Segmented,
  StatusBadge,
} from "@/components/console/ui";
import { useStaffList, useStaffResource } from "./hooks";
import { useStaffSession } from "./session";
import { DecisionDialog, Pager, QueueState } from "./common";
import { Identifier } from "./operation-tools";
import { OperationReference } from "./operation-reference";
import { fmtDateTime } from "@/lib/console/format";
import styles from "./operations.module.css";
type Review = {
  id: string;
  reviewerId: string;
  revieweeId: string;
  rating: number;
  comment: string | null;
  hiddenAt: string | null;
  moderationVersion: number;
  pathId: string;
  createdAt: string;
};
type Profile = {
  userId: string;
  updatedAt: string;
  bio: string | null;
  avatarUrl: string | null;
  moderation: { bio?: ModerationRecord; avatar?: ModerationRecord } | null;
};
type ModerationRecord = { action: string; reason: string; at: string };
export function ContentModerationScreen({
  initialUserId = "",
}: Readonly<{ initialUserId?: string }>) {
  const [draft, setDraft] = useState(initialUserId);
  const [userId, setUserId] = useState(initialUserId);
  const [tab, setTab] = useState(initialUserId ? "profile" : "reviews");
  const { actor } = useStaffSession();
  const openProfile = (id: string) => {
    setDraft(id);
    setUserId(id);
    setTab("profile");
  };
  return (
    <>
      <PageHeader
        title="Hồ sơ & đánh giá"
        desc="Xem nội dung và ghi rõ lý do kiểm duyệt."
      />
      <div className={styles.tabs}>
        <Segmented
          label="Nội dung kiểm duyệt"
          value={tab}
          onChange={setTab}
          options={[
            { id: "reviews", label: "Đánh giá" },
            { id: "profile", label: "Hồ sơ người dùng" },
          ]}
        />
      </div>
      {tab === "profile" ? (
        <Card title="Kiểm tra hồ sơ người dùng">
          <p className={styles.hint}>
            Tra cứu bằng mã người dùng từ báo cáo hoặc danh sách người dùng.
          </p>
          <form
            className={styles.filters}
            onSubmit={(e) => {
              e.preventDefault();
              setUserId(draft);
            }}
          >
            <Identifier value={draft} onChange={setDraft} />
            <button className="btn btn-primary" type="submit">
              Xem hồ sơ
            </button>
          </form>
          {userId === actor?.userId ? (
            <p role="status" className={styles.hint}>
              Hồ sơ của bạn cần một nhân viên khác kiểm duyệt.
            </p>
          ) : userId ? (
            <ProfileModeration key={userId} userId={userId} />
          ) : (
            <div className={styles.lookupEmpty}>
              <strong>Chọn hồ sơ cần xem xét</strong>Giới thiệu và ảnh đại diện
              sẽ hiển thị tại đây.
            </div>
          )}
        </Card>
      ) : (
        <ReviewModeration onProfile={openProfile} />
      )}
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
          <OperationReference id={userId} label="Người dùng" />
          <div className={styles.profileGrid}>
            {(["BIO", "AVATAR"] as const).map((field) => (
              <section className={styles.profileField} key={field}>
                <h3>{field === "BIO" ? "Giới thiệu" : "Ảnh đại diện"}</h3>
                {field === "BIO" ? (
                  <p>{resource.data!.bio || "Chưa có giới thiệu."}</p>
                ) : resource.data!.avatarUrl ? (
                  <a
                    className="link"
                    href={resource.data!.avatarUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Mở ảnh đại diện ↗
                  </a>
                ) : (
                  <p className={styles.hint}>
                    Chưa có ảnh đại diện để hiển thị.
                  </p>
                )}
                <ProfileDecision
                  value={
                    field === "BIO"
                      ? resource.data!.moderation?.bio
                      : resource.data!.moderation?.avatar
                  }
                />
                <div className={styles.actions}>
                  {(["HIDE", "REQUEST_EDIT"] as const).map((action) => (
                    <button
                      type="button"
                      className="btn"
                      key={action}
                      disabled={
                        action === "HIDE" &&
                        (field === "BIO"
                          ? !resource.data?.bio ||
                            resource.data.moderation?.bio?.action === "HIDE"
                          : !resource.data?.avatarUrl)
                      }
                      onClick={() => setDecision({ field, action })}
                    >
                      {action === "HIDE" ? "Ẩn" : "Yêu cầu sửa"}
                    </button>
                  ))}
                </div>
              </section>
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
              confirmLabel={
                decision.action === "HIDE" ? "Ẩn nội dung" : "Gửi yêu cầu sửa"
              }
              danger={decision.action === "HIDE"}
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
function ProfileDecision({ value }: Readonly<{ value?: ModerationRecord }>) {
  return value ? (
    <div className={styles.technical}>
      <span
        className={`badge badge-${value.action === "HIDE" ? "warn" : "info"}`}
      >
        {value.action === "HIDE" ? "Đã ẩn" : "Đã yêu cầu sửa"}
      </span>
      <p>{value.reason}</p>
      <small className="muted">{fmtDateTime(value.at)}</small>
    </div>
  ) : null;
}
function ReviewModeration({
  onProfile,
}: Readonly<{ onProfile: (id: string) => void }>) {
  const { api, actor } = useStaffSession();
  const reviews = useStaffList<Review>("reviews?limit=20");
  const [selected, setSelected] = useState<Review>();
  return (
    <Card
      title="Đánh giá từ các lộ trình"
      actions={
        <button
          className="btn"
          disabled={reviews.loading}
          onClick={() => void reviews.reload()}
        >
          Làm mới
        </button>
      }
    >
      <p className={styles.hint}>
        {reviews.items.length}
        {reviews.page?.hasMore ? "+" : ""} đánh giá đã tải · Ẩn hoặc khôi phục
        nội dung kèm lý do cho mỗi quyết định.
      </p>
      <QueueState
        loading={reviews.loading}
        error={reviews.error}
        empty={!reviews.items.length}
        emptyTitle="Chưa có đánh giá"
        emptyDescription="Đánh giá mới từ các lộ trình sẽ xuất hiện tại đây."
        reload={reviews.reload}
      >
        <div className="table-wrap">
          <table className={`table ${styles.table}`}>
            <thead>
              <tr>
                <th scope="col">Người tham gia</th>
                <th scope="col">Nội dung đánh giá</th>
                <th scope="col">Trạng thái</th>
                <th scope="col">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {reviews.items.map((r) => (
                <tr key={r.id}>
                  <td data-label="Người tham gia">
                    <div className={styles.person}>
                      <small>Người đánh giá</small>
                      <button onClick={() => onProfile(r.reviewerId)}>
                        Xem hồ sơ #{r.reviewerId.slice(0, 8)}
                      </button>
                    </div>
                    <div className={styles.person}>
                      <small>Người nhận</small>
                      <button onClick={() => onProfile(r.revieweeId)}>
                        Xem hồ sơ #{r.revieweeId.slice(0, 8)}
                      </button>
                    </div>
                  </td>
                  <td data-label="Nội dung đánh giá">
                    <span className={styles.rating}>★ {r.rating}/5</span>
                    <div className={styles.reviewBody}>
                      {r.comment || "Không có nhận xét bằng chữ."}
                    </div>
                    <small>{fmtDateTime(r.createdAt)}</small>
                    <OperationReference id={r.pathId} label="Lộ trình" />
                  </td>
                  <td data-label="Trạng thái">
                    <StatusBadge status={r.hiddenAt ? "HIDDEN" : "PUBLISHED"} />
                  </td>
                  <td data-label="Thao tác">
                    <button
                      className="btn"
                      disabled={[r.reviewerId, r.revieweeId].includes(
                        actor?.userId ?? "",
                      )}
                      onClick={() => setSelected(r)}
                    >
                      {r.hiddenAt ? "Khôi phục" : "Ẩn đánh giá"}
                    </button>
                    {[r.reviewerId, r.revieweeId].includes(
                      actor?.userId ?? "",
                    ) && <small>Cần nhân viên khác kiểm duyệt.</small>}
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
          confirmLabel={
            selected.hiddenAt ? "Khôi phục đánh giá" : "Ẩn đánh giá"
          }
          danger={!selected.hiddenAt}
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
