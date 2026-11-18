"use client";
import { UserProfileReference } from "./user-profile-reference";
import { LoadingButton } from "@/components/loading-button";
import { ListPagination } from "@/components/pagination/list-pagination";
import { useStaffListPages } from "./use-staff-list-pages";

import { useState } from "react";
import {
  Badge,
  Card,
  DataTable,
  Empty,
  PageHeader,
  SearchBox,
} from "@/components/console/ui";
import { Icon } from "@/components/console/icon";
import { fmtDateTime, fmtSize } from "@/lib/console/format";
import {
  creditText,
  type MaterialState,
  type ModeratedMaterial,
} from "@/lib/staff/account-types";
import { AdminDrawer, AdminField, AdminNotice, RecordId } from "./admin-ui";
import { DecisionDialog, DownloadButton, QueueState } from "./common";

import { useStaffSession } from "./session";

const states: Record<MaterialState, string> = {
  PENDING_REVIEW: "Chờ duyệt",
  PUBLISHED: "Đã công bố",
  REJECTED: "Đã từ chối",
  HIDDEN: "Đang ẩn",
  ARCHIVED: "Đã lưu trữ",
};
type Action = "approve" | "reject" | "hide" | "unhide";
const actions: Record<Action, string> = {
  approve: "Duyệt và công bố",
  reject: "Từ chối tài liệu",
  hide: "Ẩn tài liệu",
  unhide: "Hiện lại tài liệu",
};
function MaterialStatus({ status }: Readonly<{ status: MaterialState }>) {
  function materialTone() {
    if (status === "PUBLISHED") {
      return "ok" as const;
    }
    if (status === "PENDING_REVIEW") {
      return "warn" as const;
    }
    if (status === "REJECTED") {
      return "bad" as const;
    }
    return "neutral" as const;
  }
  return (
    <Badge tone={materialTone()}>{states[status] ?? "Đang cập nhật"}</Badge>
  );
}
function ScanStatus({ status }: Readonly<{ status: string }>) {
  function scanLabel() {
    if (status === "CLEAN") {
      return "An toàn" as const;
    }
    if (status === "PENDING") {
      return "Đang kiểm tra" as const;
    }
    return "Chưa xác nhận an toàn" as const;
  }
  function scanTone() {
    if (status === "CLEAN") {
      return "ok" as const;
    }
    if (status === "PENDING") {
      return "warn" as const;
    }
    return "bad" as const;
  }
  return <Badge tone={scanTone()}>{scanLabel()}</Badge>;
}
function materialActions(item: ModeratedMaterial): Action[] {
  if (item.status === "PENDING_REVIEW") return ["reject", "approve"];
  if (item.status === "PUBLISHED") return ["hide"];
  if (item.status === "HIDDEN") return ["unhide"];
  return [];
}
function fileSize(item: ModeratedMaterial) {
  return item.file?.sizeBytes
    ? fmtSize(Number(item.file.sizeBytes))
    : "Chưa có dung lượng";
}

export function AdminMaterialsScreen() {
  const { api, actor } = useStaffSession();
  const [status, setStatus] = useState<MaterialState>("PENDING_REVIEW");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string>();
  const [decision, setDecision] = useState<{
    item: ModeratedMaterial;
    action: Action;
  }>();
  const [success, setSuccess] = useState("");
  const queue = useStaffListPages<ModeratedMaterial>(
    `materials?status=${status}&limit=20`,
  );
  const visible = queue.items.filter((item) =>
    `${item.title} ${item.description}`
      .toLocaleLowerCase("vi")
      .includes(search.trim().toLocaleLowerCase("vi")),
  );
  const selected = queue.items.find((item) => item.id === selectedId);
  function reload() {
    setDecision(undefined);
    setSelectedId(undefined);
    void queue.reload();
  }
  return (
    <>
      <PageHeader
        title="Duyệt tài liệu"
        desc="Kiểm tra nội dung, tệp và quyền phân phối trước khi xử lý."
        actions={
          <LoadingButton
            type="button"
            className="btn"
            disabled={queue.loading}
            onClick={reload}
            loading={!!queue.loading}
          >
            <Icon name="refresh" size={16} />
            Làm mới
          </LoadingButton>
        }
      />
      <div className="toolbar">
        <SearchBox
          label="Tìm trong tài liệu trên trang này"
          placeholder="Tìm tiêu đề hoặc mô tả"
          value={search}
          onChange={setSearch}
        />
        <select
          className="select"
          aria-label="Trạng thái tài liệu"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value as MaterialState);
            setSelectedId(undefined);
            setDecision(undefined);
            setSuccess("");
          }}
        >
          {Object.entries(states).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <p className="admin-scope-note">
        Tìm kiếm trong các tài liệu trên trang này. Chuyển trang để xem các tài
        liệu tiếp theo.
      </p>
      {success && (
        <p className="staff-success">
          <output>{success}</output>
        </p>
      )}
      <Card flush>
        <QueueState
          loading={queue.loading}
          error={queue.error}
          empty={!queue.items.length}
          reload={reload}
          emptyTitle="Chưa có tài liệu ở trạng thái này"
          emptyDescription="Thử đổi trạng thái hoặc làm mới danh sách."
        >
          {!visible.length ? (
            <Empty
              title="Không tìm thấy tài liệu phù hợp"
              desc="Thử từ khóa khác hoặc tải thêm tài liệu."
            />
          ) : (
            <DataTable
              columns={[
                "Tài liệu",
                "Trạng thái / Giá",
                "Người đăng",
                "Tệp",
                "An toàn",
                "Cập nhật",
                "Thao tác",
              ]}
              className="table admin-responsive-table admin-material-table"
            >
              {visible.map((item) => (
                <tr key={item.id}>
                  <td data-label="Tài liệu">
                    <div className="admin-document-cell">
                      <span className="admin-file-icon">
                        {item.file?.mimeType === "application/pdf"
                          ? "PDF"
                          : "TỆP"}
                      </span>
                      <div>
                        <strong>{item.title}</strong>
                        <small className="admin-clamp">
                          {item.description}
                        </small>
                      </div>
                    </div>
                  </td>
                  <td data-label="Trạng thái / Giá">
                    <MaterialStatus status={item.status} />
                    <small>
                      {item.accessType === "FREE"
                        ? "Miễn phí"
                        : creditText(item.priceCredit)}
                    </small>
                  </td>
                  <td data-label="Người đăng">
                    <UserProfileReference
                      userId={item.ownerId}
                      label="người đăng"
                    />
                  </td>
                  <td data-label="Tệp">
                    <span>{item.file?.originalFilename ?? "Chưa có tệp"}</span>
                    {item.file && <small>{fileSize(item)}</small>}
                  </td>
                  <td data-label="An toàn">
                    <ScanStatus status={item.scanStatus} />
                  </td>
                  <td data-label="Cập nhật">{fmtDateTime(item.updatedAt)}</td>
                  <td data-label="Thao tác">
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() => setSelectedId(item.id)}
                    >
                      Xem xét
                    </button>
                  </td>
                </tr>
              ))}
            </DataTable>
          )}
        </QueueState>
        <ListPagination query={queue} />
      </Card>
      {selected && (
        <AdminDrawer
          wide
          title={selected.title}
          subtitle={<RecordId id={selected.id} label="tài liệu" />}
          close={() => setSelectedId(undefined)}
          footer={
            <>
              <button
                type="button"
                className="btn"
                onClick={() => setSelectedId(undefined)}
              >
                Đóng
              </button>
              {materialActions(selected).map((action) => {
                const publishing = action === "approve" || action === "unhide";
                const blocked =
                  publishing &&
                  (selected.ownerId === actor?.userId ||
                    selected.scanStatus !== "CLEAN" ||
                    !selected.file ||
                    !selected.distributionRightsConfirmedAt);
                return (
                  <LoadingButton
                    key={action}
                    type="button"
                    className={`btn ${publishing ? "btn-primary" : "admin-danger-outline"}`}
                    disabled={blocked || queue.loading}
                    onClick={() => setDecision({ item: selected, action })}
                    loading={!!queue.loading}
                  >
                    {actions[action]}
                  </LoadingButton>
                );
              })}
            </>
          }
        >
          <div className="admin-file-summary">
            <Icon name="file" size={44} />
            <strong>
              {selected.file?.originalFilename ?? "Tài liệu chưa có tệp"}
            </strong>
            <p>
              {selected.file
                ? `${selected.file.mimeType} · ${fileSize(selected)}`
                : "Chưa thể xem tệp của tài liệu này."}
            </p>
            {selected.file && (
              <DownloadButton
                path={`materials/${selected.id}/download`}
                name={selected.file.originalFilename ?? selected.title}
              />
            )}
          </div>
          <section className="admin-section">
            <div className="row">
              <h3>Thông tin kiểm duyệt</h3>
              <MaterialStatus status={selected.status} />
              <ScanStatus status={selected.scanStatus} />
            </div>
            <p className="prose">{selected.description}</p>
            <div className="admin-field-grid">
              <AdminField label="Người đăng">
                <UserProfileReference
                  userId={selected.ownerId}
                  label="người đăng"
                />
              </AdminField>
              <AdminField label="Giá">
                {selected.accessType === "FREE"
                  ? "Miễn phí"
                  : creditText(selected.priceCredit)}
              </AdminField>
              <AdminField label="Quyền phân phối">
                {selected.distributionRightsConfirmedAt
                  ? "Đã xác nhận · " +
                    fmtDateTime(selected.distributionRightsConfirmedAt)
                  : "Chưa xác nhận"}
              </AdminField>
              <AdminField label="Cập nhật">
                {fmtDateTime(selected.updatedAt)}
              </AdminField>
              <AdminField label="Phiên bản đang duyệt">
                {selected.listingVersion}
              </AdminField>
              <AdminField label="Lần kiểm duyệt gần nhất">
                {selected.reviewedAt
                  ? fmtDateTime(selected.reviewedAt)
                  : "Chưa được kiểm duyệt"}
              </AdminField>
            </div>
          </section>
          {selected.rejectReason && (
            <AdminNotice tone="bad">
              <strong>Lý do từ chối</strong>
              <p>{selected.rejectReason}</p>
            </AdminNotice>
          )}
          {selected.ownerId === actor?.userId &&
            ["PENDING_REVIEW", "HIDDEN"].includes(selected.status) && (
              <AdminNotice tone="warn">
                Tài liệu của bạn cần một nhân viên khác duyệt hoặc hiện lại.
              </AdminNotice>
            )}
          {(selected.scanStatus !== "CLEAN" ||
            !selected.file ||
            !selected.distributionRightsConfirmedAt) && (
            <AdminNotice tone="warn">
              <strong>Chưa đủ điều kiện công bố</strong>
              <p>
                Cần có tệp được xác nhận an toàn và quyền phân phối trước khi
                duyệt hoặc hiện lại.
              </p>
            </AdminNotice>
          )}
        </AdminDrawer>
      )}
      {decision && selected && (
        <DecisionDialog
          presentation="drawer"
          title={actions[decision.action]}
          description={`Tài liệu: ${decision.item.title}`}
          confirmLabel={actions[decision.action]}
          danger={decision.action === "hide" || decision.action === "reject"}
          min={decision.action === "approve" ? 0 : 1}
          max={2000}
          onClose={() => setDecision(undefined)}
          onReload={reload}
          onSubmit={async (reason) => {
            await api(`materials/${decision.item.id}/${decision.action}`, {
              method: "POST",
              body: {
                expectedListingVersion: decision.item.listingVersion,
                ...(reason ? { reason } : {}),
              },
            });
            setSuccess("Đã lưu quyết định xử lý tài liệu.");
            setSelectedId(undefined);
            await queue.reload();
          }}
        />
      )}
    </>
  );
}
