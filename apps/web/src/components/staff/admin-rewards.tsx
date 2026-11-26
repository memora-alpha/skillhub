"use client";
import { useId, useState } from "react";
import {
  Badge,
  Card,
  PageHeader,
  Segmented,
  type Tone,
} from "@/components/console/ui";
import { Icon } from "@/components/console/icon";
import { LoadingButton } from "@/components/loading-button";
import { LoadingNativeImage } from "@/components/loading-image";
import { LoadingSkeleton } from "@/components/loading-skeleton";
import { ListPagination } from "@/components/pagination/list-pagination";
import { fmtDateTime, fmtNum, fmtVnd } from "@/lib/console/format";
import { hasPermission } from "@/lib/staff/permissions";
import {
  redemptionLabels,
  type RewardProduct,
  type Redemption,
} from "@/features/learner/rewards/reward-contract";
import { AdminDrawer, AdminField, AdminNotice, RecordId } from "./admin-ui";
import { AdminFilterPanel, filterPanelStyles } from "./admin-filter-panel";
import { QueueState } from "./common";
import { useStaffResource, useStaffTask } from "./hooks";
import { useStaffSession } from "./session";
import { useStaffListPages } from "./use-staff-list-pages";
import styles from "./admin-rewards.module.css";

type Budget = {
  dayStart: string;
  issuedCount: number;
  issuedFaceValueVnd: string;
  creditSpent: string;
  platformDailyBudgetVnd: string;
  userDailyLimitCredit: string;
};
type AdminProduct = Omit<RewardProduct, "priceCredit"> & {
  priceCredit: string | null;
};
type AdminRedemption = Redemption & {
  userId: string;
  provider?: string | null;
  attempts?: number;
  lastErrorCode?: string | null;
  debitOperationId?: string | null;
  refundOperationId?: string | null;
};
type RewardsTab = "products" | "redemptions";

const uuidPattern = "[0-9a-fA-F]{8}(-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}";

const PRODUCT_STATUS: Record<string, [string, Tone]> = {
  ACTIVE: ["Đang áp dụng", "ok"],
  INACTIVE: ["Ngừng áp dụng", "neutral"],
  REMOVED: ["Nhà cung cấp đã gỡ", "bad"],
};

const REDEMPTION_TONE: Record<string, Tone> = {
  ISSUED: "ok",
  ISSUING: "info",
  MANUAL_REVIEW: "warn",
  FAILED_REFUNDED: "bad",
  REFUNDED_MANUAL: "neutral",
};

function formatVndValue(raw: string) {
  const numeric = Number(raw);
  return Number.isFinite(numeric) ? fmtVnd(numeric) : `${raw} ₫`;
}

function formatCreditValue(raw: string) {
  const numeric = Number(raw);
  return Number.isFinite(numeric) ? `${fmtNum(numeric)} CR` : `${raw} CR`;
}

function ProductStatusBadge({ status }: Readonly<{ status: string }>) {
  const [label, tone] = PRODUCT_STATUS[status] ?? [status, "neutral" as Tone];
  return <Badge tone={tone}>{label}</Badge>;
}

function RedemptionStatusBadge({ status }: Readonly<{ status: string }>) {
  const label = redemptionLabels[status] ?? status;
  const tone = REDEMPTION_TONE[status] ?? "neutral";
  return <Badge tone={tone}>{label}</Badge>;
}

export function AdminRewards() {
  const { actor } = useStaffSession();
  return hasPermission(actor, "reward:manage") ? (
    <RewardsWorkspace />
  ) : (
    <AdminNotice tone="warn">
      Bạn cần quyền quản lý phần thưởng để truy cập trang này.
    </AdminNotice>
  );
}

function RewardsWorkspace() {
  const { api } = useStaffSession();
  const task = useStaffTask();
  const [tab, setTab] = useState<RewardsTab>("products");
  const [productStatus, setProductStatus] = useState("");
  const [filters, setFilters] = useState({
    status: "",
    userId: "",
    productId: "",
  });
  const [notice, setNotice] = useState("");
  const [editingProduct, setEditingProduct] = useState<AdminProduct | null>(
    null,
  );
  const [selectedRedemption, setSelectedRedemption] =
    useState<AdminRedemption | null>(null);

  const productParams = new URLSearchParams({ limit: "20" });
  if (productStatus) productParams.set("status", productStatus);
  const redemptionParams = new URLSearchParams({ limit: "20" });
  for (const [key, value] of Object.entries(filters))
    if (value) redemptionParams.set(key, value);

  const products = useStaffListPages<AdminProduct>(
    "rewards/products?" + productParams,
  );
  const redemptions = useStaffListPages<AdminRedemption>(
    "rewards/redemptions?" + redemptionParams,
  );
  const budget = useStaffResource<Budget>("rewards/budget");

  const reload = () => {
    products.reload();
    redemptions.reload();
    void budget.reload();
  };

  const hasRedemptionFilters = Boolean(
    filters.status || filters.userId || filters.productId,
  );

  return (
    <div className={styles.workspace}>
      <PageHeader
        title="Voucher & phần thưởng"
        desc="Quản lý danh mục voucher, theo dõi ngân sách theo ngày Việt Nam và xử lý các đơn đổi thưởng."
        actions={
          <div className="row">
            <LoadingButton
              type="button"
              className="btn"
              loading={
                budget.loading || products.loading || redemptions.loading
              }
              onClick={reload}
            >
              <Icon name="refresh" size={15} />
              Làm mới
            </LoadingButton>
            <LoadingButton
              type="button"
              className="btn btn-primary"
              loading={task.busy}
              onClick={() =>
                void task.run(async () => {
                  await api("rewards/catalog/sync", {
                    method: "POST",
                    body: {},
                  });
                  setNotice("Đã đồng bộ danh mục voucher từ nhà cung cấp.");
                  products.reload();
                })
              }
            >
              <Icon name="tag" size={15} />
              Đồng bộ danh mục
            </LoadingButton>
          </div>
        }
      />

      {notice && (
        <output className={`staff-success ${styles.inlineBanner}`}>
          <span>{notice}</span>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => setNotice("")}
          >
            Đóng
          </button>
        </output>
      )}
      {task.error && (
        <p className="staff-error" role="alert">
          {task.error}
        </p>
      )}

      <BudgetOverview
        data={budget.data}
        loading={budget.loading}
        error={budget.error}
        reload={() => void budget.reload()}
      />

      <div className="ops-tabbar">
        <Segmented<RewardsTab>
          label="Khu vực quản lý voucher"
          value={tab}
          onChange={setTab}
          options={[
            { id: "products", label: "Danh mục voucher" },
            { id: "redemptions", label: "Đơn đổi thưởng" },
          ]}
        />
      </div>

      {tab === "products" ? (
        <Card flush>
          <AdminFilterPanel
            flush
            activeCount={productStatus ? 1 : 0}
            onClear={() => setProductStatus("")}
            actions={
              <span className="muted">
                {products.items.length} voucher trên trang này
              </span>
            }
          >
            <div className={filterPanelStyles.grid}>
              <label className={filterPanelStyles.field}>
                <span>Trạng thái voucher</span>
                <select
                  value={productStatus}
                  onChange={(event) => setProductStatus(event.target.value)}
                >
                  <option value="">Tất cả trạng thái</option>
                  <option value="ACTIVE">Đang áp dụng</option>
                  <option value="INACTIVE">Ngừng áp dụng</option>
                  <option value="REMOVED">Nhà cung cấp đã gỡ</option>
                </select>
              </label>
            </div>
          </AdminFilterPanel>

          <QueueState
            loading={products.loading}
            error={products.error}
            empty={!products.items.length}
            reload={products.reload}
            emptyTitle="Chưa có voucher phù hợp"
            emptyDescription="Thử đổi bộ lọc trạng thái hoặc nhấn Đồng bộ danh mục từ nhà cung cấp."
          >
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Voucher</th>
                    <th scope="col">Mệnh giá</th>
                    <th scope="col">Giá đổi</th>
                    <th scope="col">Thứ tự</th>
                    <th scope="col">Trạng thái</th>
                    <th scope="col" className={styles.actionCell}>
                      Thao tác
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {products.items.map((product) => {
                    const thumb = product.imageUrl || product.brand.logoUrl;
                    return (
                      <tr key={product.id}>
                        <td>
                          <div className={styles.productCell}>
                            <span className={styles.brandMark}>
                              {thumb ? (
                                <LoadingNativeImage
                                  src={thumb}
                                  alt={product.brand.name}
                                />
                              ) : (
                                product.brand.name.slice(0, 1).toUpperCase()
                              )}
                            </span>
                            <div className={styles.productMeta}>
                              <strong>{product.name}</strong>
                              <span className={styles.productSub}>
                                <span>{product.brand.name}</span>
                                <span>·</span>
                                <RecordId id={product.id} label="mã voucher" />
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className={styles.numCell}>
                          {formatVndValue(product.faceValueVnd)}
                        </td>
                        <td className={styles.numCell}>
                          {product.priceCredit === null ? (
                            <Badge tone="warn">Chưa đặt giá</Badge>
                          ) : (
                            <>
                              <span className={styles.creditValue}>
                                {formatCreditValue(product.priceCredit)}
                              </span>
                              <small>
                                Phiên bản giá v{product.priceVersion}
                              </small>
                            </>
                          )}
                        </td>
                        <td className={styles.numCell}>#{product.sortOrder}</td>
                        <td>
                          <ProductStatusBadge status={product.status} />
                        </td>
                        <td className={styles.actionCell}>
                          {product.status === "REMOVED" ? (
                            <span className="muted">Chỉ xem</span>
                          ) : (
                            <button
                              type="button"
                              className="btn btn-sm"
                              onClick={() => setEditingProduct(product)}
                            >
                              <Icon name="edit" size={14} />
                              Chỉnh sửa
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <ListPagination query={products} />
          </QueueState>
        </Card>
      ) : (
        <Card flush>
          <AdminFilterPanel
            flush
            activeCount={
              [filters.status, filters.userId, filters.productId].filter(
                Boolean,
              ).length
            }
            onClear={() =>
              setFilters({ status: "", userId: "", productId: "" })
            }
            actions={
              <span className="muted">
                {redemptions.items.length} đơn trên trang này
              </span>
            }
          >
            <form
              key={`${filters.status}:${filters.userId}:${filters.productId}`}
              className={filterPanelStyles.grid}
              onSubmit={(event) => {
                event.preventDefault();
                const data = new FormData(event.currentTarget);
                setFilters({
                  status: String(data.get("status") ?? ""),
                  userId: String(data.get("userId") ?? "").trim(),
                  productId: String(data.get("productId") ?? "").trim(),
                });
              }}
            >
              <label className={filterPanelStyles.field}>
                <span>Trạng thái đơn</span>
                <select name="status" defaultValue={filters.status}>
                  <option value="">Tất cả trạng thái</option>
                  {[
                    "MANUAL_REVIEW",
                    "ISSUING",
                    "ISSUED",
                    "FAILED_REFUNDED",
                    "REFUNDED_MANUAL",
                  ].map((status) => (
                    <option key={status} value={status}>
                      {redemptionLabels[status]}
                    </option>
                  ))}
                </select>
              </label>

              <label className={filterPanelStyles.field}>
                <span>Mã người dùng (UUID)</span>
                <input
                  name="userId"
                  pattern={uuidPattern}
                  placeholder="Nhập mã UUID người dùng…"
                  defaultValue={filters.userId}
                />
              </label>

              <label className={filterPanelStyles.field}>
                <span>Mã sản phẩm (UUID)</span>
                <input
                  name="productId"
                  pattern={uuidPattern}
                  placeholder="Nhập mã UUID voucher…"
                  defaultValue={filters.productId}
                />
              </label>

              <div className={filterPanelStyles.footer}>
                <span className={filterPanelStyles.note}>
                  Lọc theo trạng thái xử lý, người đổi hoặc loại voucher.
                </span>
                <div className={filterPanelStyles.footerActions}>
                  <button type="submit" className="btn btn-primary btn-sm">
                    Áp dụng
                  </button>
                  {hasRedemptionFilters && (
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() =>
                        setFilters({ status: "", userId: "", productId: "" })
                      }
                    >
                      Xóa lọc
                    </button>
                  )}
                </div>
              </div>
            </form>
          </AdminFilterPanel>

          <QueueState
            loading={redemptions.loading}
            error={redemptions.error}
            empty={!redemptions.items.length}
            reload={redemptions.reload}
            emptyTitle="Chưa có đơn đổi thưởng"
            emptyDescription="Chưa có giao dịch đổi thưởng nào khớp với bộ lọc hiện tại."
          >
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Đơn & Voucher</th>
                    <th scope="col">Người đổi</th>
                    <th scope="col">Giá trị</th>
                    <th scope="col">Trạng thái</th>
                    <th scope="col">Thời gian</th>
                    <th scope="col" className={styles.actionCell}>
                      Thao tác
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {redemptions.items.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <strong>{row.product.name}</strong>
                        <small>
                          <RecordId id={row.id} label="mã đơn đổi thưởng" />
                        </small>
                      </td>
                      <td>
                        <RecordId id={row.userId} label="mã người dùng" />
                      </td>
                      <td className={styles.numCell}>
                        <span className={styles.creditValue}>
                          {formatCreditValue(row.priceCredit)}
                        </span>
                        <small>{formatVndValue(row.faceValueVnd)}</small>
                      </td>
                      <td>
                        <RedemptionStatusBadge status={row.status} />
                        {row.lastErrorCode && (
                          <span className={styles.errorCode}>
                            {row.lastErrorCode}
                          </span>
                        )}
                      </td>
                      <td className={styles.numCell}>
                        {fmtDateTime(row.createdAt)}
                      </td>
                      <td className={styles.actionCell}>
                        <button
                          type="button"
                          className={
                            row.status === "MANUAL_REVIEW"
                              ? "btn btn-sm btn-primary"
                              : "btn btn-sm"
                          }
                          onClick={() => setSelectedRedemption(row)}
                        >
                          {row.status === "MANUAL_REVIEW"
                            ? "Xử lý đơn"
                            : "Chi tiết"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ListPagination query={redemptions} />
          </QueueState>
        </Card>
      )}

      {editingProduct && (
        <ProductEditorDrawer
          key={editingProduct.id}
          product={editingProduct}
          close={() => setEditingProduct(null)}
          saved={() => {
            setEditingProduct(null);
            setNotice(`Đã cập nhật voucher "${editingProduct.name}".`);
            products.reload();
          }}
        />
      )}

      {selectedRedemption && (
        <RedemptionDetailDrawer
          key={selectedRedemption.id}
          redemption={selectedRedemption}
          close={() => setSelectedRedemption(null)}
          resolved={() => {
            setSelectedRedemption(null);
            setNotice("Đã ghi nhận quyết định xử lý đơn đổi thưởng.");
            reload();
          }}
        />
      )}
    </div>
  );
}

function BudgetOverview({
  data,
  loading,
  error,
  reload,
}: Readonly<{
  data: Budget | null | undefined;
  loading: boolean;
  error?: string;
  reload: () => void;
}>) {
  if (error && !data) {
    return (
      <Card title="Ngân sách hôm nay">
        <div className="staff-state">
          <p className="staff-error" role="alert">
            {error}
          </p>
          <button type="button" className="btn" onClick={reload}>
            Thử lại
          </button>
        </div>
      </Card>
    );
  }

  if (loading && !data) {
    return (
      <LoadingSkeleton variant="section" label="Đang tải ngân sách hôm nay" />
    );
  }

  if (!data) return null;

  const spentVnd = Number(data.issuedFaceValueVnd);
  const limitVnd = Number(data.platformDailyBudgetVnd);
  const ratio =
    Number.isFinite(spentVnd) && Number.isFinite(limitVnd) && limitVnd > 0
      ? Math.min(100, Math.round((spentVnd / limitVnd) * 100))
      : 0;
  const fillClass =
    ratio >= 95
      ? `${styles.budgetFill} ${styles.budgetFillDanger}`
      : ratio >= 80
        ? `${styles.budgetFill} ${styles.budgetFillWarn}`
        : styles.budgetFill;

  return (
    <section
      className={styles.kpiGrid}
      aria-label="Tổng quan ngân sách hôm nay"
    >
      <div className={styles.kpiCard}>
        <div className={styles.kpiTop}>
          <span>Ngân sách nền tảng hôm nay</span>
          <span className={styles.kpiIcon}>
            <Icon name="card" size={16} />
          </span>
        </div>
        <div className={styles.kpiValue}>
          {formatVndValue(data.issuedFaceValueVnd)}
        </div>
        <div className={styles.budgetTrack} aria-hidden="true">
          <span className={fillClass} style={{ width: `${ratio}%` }} />
        </div>
        <span className={styles.kpiSub}>
          Đã dùng {ratio}% trên hạn mức{" "}
          {formatVndValue(data.platformDailyBudgetVnd)}
        </span>
      </div>

      <div className={styles.kpiCard}>
        <div className={styles.kpiTop}>
          <span>Credit đã quy đổi</span>
          <span className={styles.kpiIcon}>
            <Icon name="award" size={16} />
          </span>
        </div>
        <div className={styles.kpiValue}>
          {formatCreditValue(data.creditSpent)}
        </div>
        <span className={styles.kpiSub}>
          {fmtNum(data.issuedCount)} đơn phát hành trong ngày
        </span>
      </div>

      <div className={styles.kpiCard}>
        <div className={styles.kpiTop}>
          <span>Hạn mức mỗi người / ngày</span>
          <span className={styles.kpiIcon}>
            <Icon name="shield" size={16} />
          </span>
        </div>
        <div className={styles.kpiValue}>
          {formatCreditValue(data.userDailyLimitCredit)}
        </div>
        <span className={styles.kpiSub}>
          Tính theo múi giờ Việt Nam (GMT+7)
        </span>
      </div>
    </section>
  );
}

function ProductEditorDrawer({
  product,
  close,
  saved,
}: Readonly<{
  product: AdminProduct;
  close: () => void;
  saved: () => void;
}>) {
  const { api } = useStaffSession();
  const task = useStaffTask();
  const formId = useId();

  return (
    <AdminDrawer
      title="Chỉnh sửa voucher"
      subtitle={
        <>
          {product.brand.name} · Mệnh giá {formatVndValue(product.faceValueVnd)}{" "}
          · Phiên bản giá v{product.priceVersion}
        </>
      }
      busy={task.busy}
      close={close}
      footer={
        <>
          <button
            type="button"
            className="btn"
            disabled={task.busy}
            onClick={close}
          >
            Hủy
          </button>
          <LoadingButton
            type="submit"
            form={formId}
            className="btn btn-primary"
            loading={task.busy}
          >
            Lưu thay đổi
          </LoadingButton>
        </>
      }
    >
      <div className="admin-section">
        <div className="admin-field-grid">
          <AdminField label="Mã voucher">
            <RecordId id={product.id} label="mã voucher" />
          </AdminField>
          <AdminField label="Trạng thái hiện tại">
            <ProductStatusBadge status={product.status} />
          </AdminField>
        </div>
      </div>

      <div className="admin-section">
        <h3>Cấu hình hiển thị & giá Credit</h3>
        <form
          id={formId}
          className={styles.drawerForm}
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            const patch: Record<string, unknown> = {
              reason: String(data.get("reason")).trim(),
            };
            for (const [field, previous] of [
              ["priceCredit", product.priceCredit ?? ""],
              ["status", product.status],
              ["sortOrder", String(product.sortOrder)],
              ["displayNameOverride", product.name],
            ] as const) {
              const value = String(data.get(field) ?? "").trim();
              if (value !== previous)
                patch[field] =
                  field === "sortOrder" ? Number(value) : value || null;
            }
            void task.run(async () => {
              await api(`rewards/products/${product.id}`, {
                method: "PATCH",
                body: patch,
              });
              saved();
            });
          }}
        >
          <fieldset className={styles.formGrid} disabled={task.busy}>
            <label className={`${styles.formField} ${styles.formFieldFull}`}>
              <span>Tên hiển thị</span>
              <input
                name="displayNameOverride"
                maxLength={200}
                defaultValue={product.name}
              />
            </label>

            <label className={styles.formField}>
              <span>Giá đổi (Credit)</span>
              <input
                name="priceCredit"
                inputMode="decimal"
                placeholder="Ví dụ: 50"
                pattern="(?!0+(\.0+)?$)(0|[1-9][0-9]{0,9})(\.[0-9]{1,2})?"
                defaultValue={product.priceCredit ?? ""}
              />
            </label>

            <label className={styles.formField}>
              <span>Trạng thái áp dụng</span>
              <select name="status" defaultValue={product.status}>
                {product.status === "REMOVED" ? (
                  <option value="REMOVED">
                    Nhà cung cấp đã gỡ (giữ nguyên)
                  </option>
                ) : (
                  <option value="ACTIVE">Đang áp dụng</option>
                )}
                <option value="INACTIVE">Ngừng áp dụng</option>
              </select>
            </label>

            <label className={styles.formField}>
              <span>Thứ tự hiển thị</span>
              <input
                name="sortOrder"
                type="number"
                step={1}
                defaultValue={product.sortOrder}
                required
              />
            </label>

            <label className={`${styles.formField} ${styles.formFieldFull}`}>
              <span>Lý do thay đổi (ghi nhận nhật ký kiểm tra)</span>
              <textarea
                name="reason"
                required
                minLength={1}
                maxLength={500}
                placeholder="Nhập lý do cập nhật giá, tên hoặc trạng thái…"
              />
            </label>
          </fieldset>

          {task.error && (
            <p className="staff-error" role="alert">
              {task.error}
            </p>
          )}
        </form>
      </div>
    </AdminDrawer>
  );
}

function RedemptionDetailDrawer({
  redemption,
  close,
  resolved,
}: Readonly<{
  redemption: AdminRedemption;
  close: () => void;
  resolved: () => void;
}>) {
  const { api } = useStaffSession();
  const task = useStaffTask();
  const [action, setAction] = useState<"REFUND" | "ISSUED">("REFUND");
  const formId = useId();
  const needsResolution = redemption.status === "MANUAL_REVIEW";

  return (
    <AdminDrawer
      title={
        needsResolution ? "Xử lý đơn đổi thưởng" : "Chi tiết đơn đổi thưởng"
      }
      subtitle={
        <>
          {redemption.product.name} · Tạo lúc{" "}
          {fmtDateTime(redemption.createdAt)}
        </>
      }
      busy={task.busy}
      close={close}
      footer={
        needsResolution ? (
          <>
            <button
              type="button"
              className="btn"
              disabled={task.busy}
              onClick={close}
            >
              Đóng
            </button>
            <LoadingButton
              type="submit"
              form={formId}
              className="btn btn-primary"
              loading={task.busy}
            >
              Xác nhận quyết định
            </LoadingButton>
          </>
        ) : (
          <button type="button" className="btn" onClick={close}>
            Đóng
          </button>
        )
      }
    >
      <div className="admin-section">
        <h3>Thông tin giao dịch</h3>
        <div className="admin-field-grid">
          <AdminField label="Trạng thái">
            <RedemptionStatusBadge status={redemption.status} />
          </AdminField>
          <AdminField label="Giá trị đổi">
            <strong>{formatCreditValue(redemption.priceCredit)}</strong>{" "}
            <span className="muted">
              ({formatVndValue(redemption.faceValueVnd)})
            </span>
          </AdminField>
          <AdminField label="Mã đơn đổi thưởng">
            <RecordId id={redemption.id} label="mã đơn" />
          </AdminField>
          <AdminField label="Người đổi thưởng">
            <RecordId id={redemption.userId} label="mã người dùng" />
          </AdminField>
          {redemption.provider && (
            <AdminField label="Nhà cung cấp">{redemption.provider}</AdminField>
          )}
          {redemption.attempts !== undefined && (
            <AdminField label="Số lần thử phát hành">
              {redemption.attempts} lần
            </AdminField>
          )}
          {redemption.lastErrorCode && (
            <AdminField label="Mã lỗi gần nhất">
              <span className={styles.errorCode}>
                {redemption.lastErrorCode}
              </span>
            </AdminField>
          )}
          {redemption.resolvedAt && (
            <AdminField label="Thời điểm hoàn tất">
              {fmtDateTime(redemption.resolvedAt)}
            </AdminField>
          )}
          {redemption.debitOperationId && (
            <AdminField label="Giao dịch trừ Credit">
              <RecordId
                id={redemption.debitOperationId}
                label="mã giao dịch trừ"
              />
            </AdminField>
          )}
          {redemption.refundOperationId && (
            <AdminField label="Giao dịch hoàn Credit">
              <RecordId
                id={redemption.refundOperationId}
                label="mã giao dịch hoàn"
              />
            </AdminField>
          )}
        </div>
      </div>

      {needsResolution && (
        <div className={styles.drawerSection}>
          <h3>Quyết định đối soát thủ công</h3>
          <AdminNotice tone="warn">
            Chỉ xác nhận quyết định sau khi đã đối chiếu trạng thái phát hành
            trực tiếp trên hệ thống nhà cung cấp.
          </AdminNotice>

          <form
            id={formId}
            className={styles.drawerForm}
            onSubmit={(event) => {
              event.preventDefault();
              const form = event.currentTarget;
              const data = new FormData(form);
              const reason = String(data.get("reason") ?? "").trim();
              const voucher = {
                code: String(data.get("code") ?? "").trim() || undefined,
                pin: String(data.get("pin") ?? "").trim() || undefined,
                link: String(data.get("link") ?? "").trim() || undefined,
                expiresAt:
                  String(data.get("expiresAt") ?? "").trim() || undefined,
              };
              void task.run(async () => {
                if (action === "ISSUED" && !voucher.code && !voucher.link)
                  throw new Error(
                    "Cần nhập mã hoặc liên kết voucher đã đối chiếu.",
                  );
                await api(`rewards/redemptions/${redemption.id}/resolve`, {
                  method: "POST",
                  body: {
                    action,
                    reason,
                    ...(action === "ISSUED" ? { voucher } : {}),
                  },
                });
                form.reset();
                resolved();
              });
            }}
          >
            <div
              className={styles.decisionToggle}
              role="radiogroup"
              aria-label="Chọn hướng xử lý"
            >
              <button
                type="button"
                role="radio"
                aria-checked={action === "REFUND"}
                className={
                  action === "REFUND"
                    ? `${styles.decisionBtn} ${styles.decisionBtnActive}`
                    : styles.decisionBtn
                }
                disabled={task.busy}
                onClick={() => setAction("REFUND")}
              >
                <strong>Hoàn Credit</strong>
                <small>Trả lại Credit cho người đổi</small>
              </button>

              <button
                type="button"
                role="radio"
                aria-checked={action === "ISSUED"}
                className={
                  action === "ISSUED"
                    ? `${styles.decisionBtn} ${styles.decisionBtnActive}`
                    : styles.decisionBtn
                }
                disabled={task.busy}
                onClick={() => setAction("ISSUED")}
              >
                <strong>Xác nhận đã phát hành</strong>
                <small>Cấp mã hoặc liên kết voucher</small>
              </button>
            </div>

            <fieldset className={styles.formGrid} disabled={task.busy}>
              {action === "ISSUED" && (
                <>
                  <label className={styles.formField}>
                    <span>Mã voucher</span>
                    <input
                      name="code"
                      maxLength={500}
                      autoComplete="off"
                      placeholder="Nhập mã voucher…"
                    />
                  </label>

                  <label className={styles.formField}>
                    <span>Mã PIN (nếu có)</span>
                    <input
                      name="pin"
                      maxLength={100}
                      autoComplete="off"
                      type="password"
                    />
                  </label>

                  <label
                    className={`${styles.formField} ${styles.formFieldFull}`}
                  >
                    <span>Liên kết voucher</span>
                    <input
                      name="link"
                      maxLength={2048}
                      type="url"
                      placeholder="https://…"
                    />
                  </label>

                  <label
                    className={`${styles.formField} ${styles.formFieldFull}`}
                  >
                    <span>Hạn sử dụng (ISO 8601 có múi giờ, nếu có)</span>
                    <input
                      name="expiresAt"
                      placeholder="2027-01-31T23:59:59+07:00"
                    />
                  </label>
                </>
              )}

              <label className={`${styles.formField} ${styles.formFieldFull}`}>
                <span>Lý do xử lý</span>
                <textarea
                  name="reason"
                  required
                  minLength={1}
                  maxLength={500}
                  placeholder="Ghi rõ kết quả đối chiếu với nhà cung cấp…"
                />
              </label>

              <label
                className={`${styles.checkboxRow} ${styles.formFieldFull}`}
              >
                <input type="checkbox" required />
                <span>
                  Tôi đã đối chiếu kết quả trực tiếp với nhà cung cấp.
                </span>
              </label>
            </fieldset>

            {task.error && (
              <p className="staff-error" role="alert">
                {task.error}
              </p>
            )}
          </form>
        </div>
      )}
    </AdminDrawer>
  );
}
