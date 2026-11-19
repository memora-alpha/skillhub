"use client";
import { LoadingButton } from "@/components/loading-button";
import { ListPagination } from "@/components/pagination/list-pagination";
import { useStaffListPages } from "./use-staff-list-pages";
import Link from "next/link";
import { useState } from "react";
import {
  Card,
  PageHeader,
  Segmented,
  StatusBadge,
} from "@/components/console/ui";
import { useStaffResource } from "./hooks";
import { useStaffSession } from "./session";
import { DecisionDialog, QueueState } from "./common";
import { Identifier } from "./operation-tools";
import { OperationReference } from "./operation-reference";
import { StaffUserProfile } from "./user-profile";
import { UserProfileReference } from "./user-profile-reference";
import { fmtDateTime } from "@/lib/console/format";
import { hasPermission } from "@/lib/staff/permissions";
import { AdminNotice } from "./admin-ui";
import styles from "./operations.module.css";
import { MaterialReviewModeration } from "./material-review-moderation";

function safeHttpUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:"
      ? parsed.toString()
      : null;
  } catch {
    return null;
  }
}
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
  initialView,
}: Readonly<{ initialUserId?: string; initialView?: "profile" | "reviews" }>) {
  const { actor, portal } = useStaffSession();
  const canReviews = hasPermission(actor, "review:moderate");
  const canMaterialReviews = hasPermission(actor, "material-review:moderate");
  const canProfile = hasPermission(actor, "profile:moderate");
  const staffOptions = [
    ...(canReviews ? [{ id: "reviews", label: "Đánh giá lộ trình" }] : []),
    ...(canMaterialReviews
      ? [{ id: "material-reviews", label: "Đánh giá tài liệu" }]
      : []),
    ...(canProfile ? [{ id: "profile", label: "Hồ sơ người dùng" }] : []),
  ];
  const defaultTab =
    portal === "admin"
      ? (initialView ?? (initialUserId ? "profile" : "reviews"))
      : initialUserId && canProfile
        ? "profile"
        : (staffOptions[0]?.id ?? "");

  const [draft, setDraft] = useState(initialUserId);
  const [userId, setUserId] = useState(initialUserId);
  const [profileRevision, setProfileRevision] = useState(0);
  const [tab, setTab] = useState<string>(defaultTab);
  const activeTab =
    portal === "admin"
      ? tab
      : staffOptions.some((opt) => opt.id === tab)
        ? tab
        : (staffOptions[0]?.id ?? "");
  const adminTitle = activeTab === "profile" ? "Hồ sơ người dùng" : "Đánh giá";
  return (
    <>
      <PageHeader
        title={portal === "admin" ? adminTitle : "Hồ sơ & đánh giá"}
        desc="Xem nội dung vi phạm và ghi rõ lý do kiểm duyệt kèm nhật ký kiểm tra."
      />
      {portal === "admin" ? (
        activeTab !== "profile" && (
          <div className={styles.filters}>
            <label>
              Loại đánh giá{" "}
              <select
                className="select"
                value={activeTab}
                onChange={(event) => setTab(event.target.value)}
              >
                <option value="reviews">Lộ trình</option>
                <option value="material-reviews">Tài liệu</option>
              </select>
            </label>
          </div>
        )
      ) : staffOptions.length > 0 ? (
        <div className="ops-tabbar">
          <Segmented
            label="Nội dung kiểm duyệt"
            value={activeTab}
            onChange={setTab}
            options={staffOptions}
          />
        </div>
      ) : (
        <AdminNotice tone="warn">
          <strong>Chưa được cấp quyền kiểm duyệt hồ sơ hoặc đánh giá.</strong>
          <p>
            Các quyền <code>profile:moderate</code>,{" "}
            <code>review:moderate</code> và{" "}
            <code>material-review:moderate</code> là quyền mở rộng cần quản trị
            viên cấp riêng cho từng nhân viên.
          </p>
        </AdminNotice>
      )}
      {activeTab === "profile" && canProfile && (
        <div className={styles.workspace}>
          <Card title="Tìm hồ sơ người dùng">
            <p className={styles.hint}>
              Tra cứu bằng mã người dùng từ báo cáo hoặc danh sách người dùng.
            </p>
            <div className={styles.filters}>
              <Identifier
                value={draft}
                onChange={setDraft}
                onSearch={setUserId}
              />
            </div>
            {!userId && (
              <div className={styles.lookupEmpty}>
                <strong>Chọn hồ sơ để xem thông tin</strong>Tên, ảnh, kỹ năng và
                đánh giá sẽ hiển thị tại đây.
              </div>
            )}
          </Card>
          {userId && (
            <>
              <StaffUserProfile
                key={`public:${userId}:${profileRevision}`}
                userId={userId}
              />
              <Card title="Kiểm duyệt hồ sơ">
                {userId === actor?.userId ? (
                  <p className={styles.hint}>
                    <output>
                      Bạn có thể xem hồ sơ của mình. Việc kiểm duyệt cần một
                      nhân viên khác xử lý.
                    </output>
                  </p>
                ) : (
                  <>
                    <p className={styles.hint}>
                      Nội dung gốc để kiểm duyệt. Lý do ẩn hoặc yêu cầu sửa sẽ
                      được gửi cho chủ hồ sơ.
                    </p>
                    <ProfileModeration
                      key={userId}
                      userId={userId}
                      onChanged={() => setProfileRevision((value) => value + 1)}
                    />
                  </>
                )}
              </Card>
            </>
          )}
        </div>
      )}
      {activeTab === "material-reviews" && canMaterialReviews && (
        <MaterialReviewModeration />
      )}
      {activeTab === "reviews" && canReviews && <ReviewModeration />}
    </>
  );
}
function ProfileFieldValue({
  field,
  profile,
}: Readonly<{ field: "BIO" | "AVATAR"; profile: Profile }>) {
  if (field === "BIO") return <p>{profile.bio || "Chưa có giới thiệu."}</p>;
  const safeAvatar = safeHttpUrl(profile.avatarUrl);
  if (safeAvatar)
    return (
      <a className="link" href={safeAvatar} target="_blank" rel="noreferrer">
        Mở ảnh đại diện ↗
      </a>
    );
  return <p className={styles.hint}>Chưa có ảnh đại diện để hiển thị.</p>;
}
function ProfileModeration({
  userId,
  onChanged,
}: Readonly<{ userId: string; onChanged: () => void }>) {
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
          <UserProfileReference userId={userId} />
          <div className={styles.profileGrid}>
            {(["BIO", "AVATAR"] as const).map((field) => (
              <section className={styles.profileField} key={field}>
                <h3>{field === "BIO" ? "Giới thiệu" : "Ảnh đại diện"}</h3>
                <ProfileFieldValue field={field} profile={resource.data!} />
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
                          : !resource.data?.avatarUrl ||
                            resource.data.moderation?.avatar?.action === "HIDE")
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
                onChanged();
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
function ReviewModeration() {
  const { api, actor, portal } = useStaffSession();
  const reviews = useStaffListPages<Review>("reviews?limit=20");
  const [selected, setSelected] = useState<Review>();
  return (
    <Card
      title="Đánh giá từ các lộ trình"
      actions={
        <LoadingButton
          type="button"
          className="btn"
          disabled={reviews.loading}
          onClick={() => void reviews.reload()}
          loading={!!reviews.loading}
        >
          Làm mới
        </LoadingButton>
      }
    >
      <p className={styles.hint}>
        Ẩn hoặc khôi phục nội dung kèm lý do cho mỗi quyết định.
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
                      <UserProfileReference
                        userId={r.reviewerId}
                        label="người đánh giá"
                      />
                    </div>
                    <div className={styles.person}>
                      <small>Người nhận</small>
                      <UserProfileReference
                        userId={r.revieweeId}
                        label="người nhận đánh giá"
                      />
                    </div>
                  </td>
                  <td data-label="Nội dung đánh giá">
                    <span className={styles.rating}>★ {r.rating}/5</span>
                    <div className={styles.reviewBody}>
                      {r.comment || "Không có nhận xét bằng chữ."}
                    </div>
                    <small>{fmtDateTime(r.createdAt)}</small>
                    <OperationReference id={r.pathId} label="Lộ trình" />
                    {portal === "admin" && (
                      <Link
                        className="link"
                        href={`/admin/learning-paths/${r.pathId}`}
                      >
                        Xem chi tiết lộ trình →
                      </Link>
                    )}
                  </td>
                  <td data-label="Trạng thái">
                    <StatusBadge status={r.hiddenAt ? "HIDDEN" : "PUBLISHED"} />
                  </td>
                  <td data-label="Thao tác">
                    <button
                      type="button"
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
      <ListPagination query={reviews} />
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
