"use client";
import { MaterialFilters } from "@/components/material-filters";
import { LoadingButton } from "@/components/loading-button";
import { ListPagination } from "@/components/pagination/list-pagination";
import { useUserPagedList } from "../hooks/use-user-paged-list";
import Link from "next/link";
import { useRef, useState } from "react";
import { useUserSession } from "../auth/session";
import { UserApiError } from "../api/client";

import { useUserCommand } from "../hooks/use-user-command";
import {
  CommandFeedback,
  Empty,
  Feedback,
  PageHeading,
  Panel,
  Status,
} from "../components/common";
import type { OwnedMaterial } from "./account-types";
import { MaterialsSubnav } from "./materials-subnav";
import { MaterialEditor } from "./material-editor";
import { MaterialCoverStatus } from "./material-cover";
import {
  canEditMaterial,
  canManageMaterial,
  materialEditHint,
  type MaterialAction,
} from "./material-management-policy";

const labels: Record<MaterialAction, string> = {
  submit: "Gửi duyệt",
  withdraw: "Rút khỏi hàng chờ duyệt",
  archive: "Ngừng chia sẻ",
  delete: "Xóa tài liệu",
};
const explanations: Record<MaterialAction, string> = {
  submit: "Tài liệu sẽ được kiểm duyệt trước khi chia sẻ công khai.",
  withdraw:
    "Tài liệu sẽ trở về bản nháp. Nội dung đã từng xuất bản vẫn được giữ nguyên.",
  archive:
    "Tài liệu sẽ chuyển vào mục Đã lưu trữ. Bạn có thể gửi duyệt lại; người đã mua vẫn giữ quyền theo đơn mua.",
  delete:
    "Tài liệu sẽ được gỡ khỏi danh sách quản lý. Tệp và quyền của người đã mua được giữ theo đơn mua.",
};
export function MyMaterials() {
  const { actor } = useUserSession();
  const [status, setStatus] = useState("");
  const [filters, setFilters] = useState("");
  const statusQuery = status ? "&status=" + status : "";
  const query = useUserPagedList<OwnedMaterial>(
    `me/materials?limit=20${statusQuery}&${filters}`,
  );
  return (
    <>
      <MaterialsSubnav current="/learn/materials/mine" />
      <PageHeading
        eyebrow="Kho tài liệu số"
        title="Tài liệu tôi chia sẻ"
        description="Quản lý tài liệu bạn đã đăng tải, gửi duyệt xuất bản và theo dõi trạng thái kiểm duyệt."
        action={
          <Link className="btn btn-primary" href="/learn/materials/new">
            + Chia sẻ tài liệu
          </Link>
        }
      />
      <label className="learner-form">
        <span>Trạng thái tài liệu</span>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Đang quản lý</option>
          <option value="DRAFT">Bản nháp</option>
          <option value="PENDING_REVIEW">Chờ duyệt</option>
          <option value="REJECTED">Cần chỉnh sửa</option>
          <option value="PUBLISHED">Đang chia sẻ</option>
          <option value="HIDDEN">Đang bị ẩn</option>
          <option value="ARCHIVED">Đã lưu trữ</option>
        </select>
      </label>
      <MaterialFilters value={filters} onApply={setFilters} owner={false} />
      <Feedback
        loading={query.initialLoading}
        error={query.error}
        reload={query.reload}
        refreshing={!!(query.loading && !query.initialLoading)}
      />
      <div className="learner-stack">
        {query.items.map((material) => (
          <OwnerCard
            key={`${actor.userId}:${material.id}:${material.listingVersion}`}
            material={material}
            reload={query.reload}
          />
        ))}
      </div>
      {!query.loading && !query.error && !query.items.length && (
        <Empty>Chưa có tài liệu ở trạng thái này.</Empty>
      )}
      <ListPagination query={query} />
    </>
  );
}
function OwnerCard({
  material,
  reload,
}: Readonly<{ material: OwnedMaterial; reload: () => void }>) {
  const { request, actor } = useUserSession();
  const command = useUserCommand();
  const [current, setCurrent] = useState(material);
  const [action, setAction] = useState<MaterialAction>();
  const [editing, setEditing] = useState(false);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string>();
  const [deleted, setDeleted] = useState(false);
  const lock = useRef(false);
  const busy = reading || command.pending || command.uncertain;
  async function read() {
    const result = await request<OwnedMaterial>(`me/materials/${material.id}`);
    if (
      result.data.id !== material.id ||
      result.data.ownerId !== actor.userId ||
      !Number.isSafeInteger(result.data.listingVersion)
    )
      throw new UserApiError(502, "API_RESPONSE_INVALID");
    return result.data;
  }
  function selectMaterialAction(
    fresh: OwnedMaterial,
    next?: MaterialAction | "edit",
  ) {
    if (next === "edit") {
      if (canEditMaterial(fresh)) setEditing(true);
      else setError(materialEditHint(fresh));
    } else if (next) {
      if (canManageMaterial(fresh, next)) setAction(next);
      else setError("Trạng thái đã thay đổi. Hãy chọn thao tác đang có sẵn.");
    }
  }
  async function inspect(next?: MaterialAction | "edit") {
    if (lock.current) return;
    lock.current = true;
    setReading(true);
    setError(undefined);
    try {
      const fresh = await read();
      setCurrent(fresh);
      setEditing(false);
      setAction(undefined);
      command.resetAfterRead();
      selectMaterialAction(fresh, next);
      if (!next) reload();
    } catch (cause) {
      if (
        cause instanceof UserApiError &&
        cause.status === 404 &&
        action === "delete" &&
        command.uncertain
      ) {
        setDeleted(true);
        command.resetAfterRead();
        reload();
      } else
        setError(
          cause instanceof Error
            ? cause.message
            : "Chưa đọc được tài liệu. Hãy thử lại.",
        );
    } finally {
      lock.current = false;
      setReading(false);
    }
  }
  async function confirm() {
    if (!action) return;
    const selectedAction = action;
    const result = await command.run(
      `${selectedAction}:${current.id}:${current.listingVersion}`,
      async () => {
        const fresh = await read();
        if (fresh.listingVersion !== current.listingVersion) {
          setCurrent(fresh);
          setAction(undefined);
          reload();
          throw new UserApiError(409, "MATERIAL_VERSION_CONFLICT");
        }
        if (!canManageMaterial(fresh, selectedAction))
          throw new UserApiError(409, "MATERIAL_ACTION_UNAVAILABLE");
        if (selectedAction === "delete")
          return request(
            `me/materials/${current.id}?expectedListingVersion=${fresh.listingVersion}`,
            { method: "DELETE" },
          );
        return request<OwnedMaterial>(
          `me/materials/${current.id}/${selectedAction}`,
          {
            method: "POST",
            body: { expectedListingVersion: fresh.listingVersion },
          },
        );
      },
    );
    if (result) {
      if (selectedAction === "delete") setDeleted(true);
      else {
        const fresh = result.data as OwnedMaterial;
        setCurrent(fresh);
      }
      setAction(undefined);
      reload();
    }
  }
  if (deleted)
    return (
      <Panel>
        <output>Đã gỡ tài liệu khỏi danh sách của bạn.</output>
      </Panel>
    );
  return (
    <Panel>
      <OwnerMaterialSummary material={current} />
      <Feedback variant="inline" error={error} loading={reading} />
      {editing ? (
        <MaterialEditor
          key={`${current.id}:${current.listingVersion}`}
          material={current}
          close={() => setEditing(false)}
          reload={reload}
        />
      ) : (
        <div className="learner-actions">
          {canEditMaterial(current) && (
            <LoadingButton
              type="button"
              className="btn"
              disabled={busy}
              onClick={() => void inspect("edit")}
              loading={!!busy}
            >
              Sửa tài liệu
            </LoadingButton>
          )}
          {(Object.keys(labels) as MaterialAction[])
            .filter((a) => canManageMaterial(current, a))
            .map((a) => (
              <LoadingButton
                key={a}
                type="button"
                className="btn"
                disabled={busy}
                onClick={() => void inspect(a)}
                loading={!!busy}
              >
                {labels[a]}
              </LoadingButton>
            ))}
          <LoadingButton
            type="button"
            className="btn"
            disabled={reading || command.pending}
            onClick={() => void inspect()}
            loading={!!command.pending}
          >
            Cập nhật trạng thái
          </LoadingButton>
        </div>
      )}
      {action && (
        <section
          className="learner-notice"
          aria-label={`Xác nhận ${labels[action].toLowerCase()}`}
        >
          <h3>
            {labels[action]} “{current.title}”?
          </h3>
          <p>{explanations[action]}</p>
          <div className="learner-actions">
            <LoadingButton
              type="button"
              className="btn btn-primary"
              disabled={busy}
              onClick={() => void confirm()}
              loading={!!busy}
            >
              {labels[action]}
            </LoadingButton>
            <LoadingButton
              type="button"
              className="btn"
              disabled={command.pending}
              onClick={() => setAction(undefined)}
              loading={!!command.pending}
            >
              Hủy
            </LoadingButton>
          </div>
        </section>
      )}
      <CommandFeedback command={command} />
      {command.uncertain && (
        <LoadingButton
          loading={reading}
          type="button"
          className="btn"
          disabled={reading}
          onClick={() => void inspect()}
        >
          Kiểm tra kết quả vừa gửi
        </LoadingButton>
      )}
    </Panel>
  );
}

function OwnerMaterialSummary({
  material,
}: Readonly<{ material: OwnedMaterial }>) {
  return (
    <>
      <div className="learner-card-top">
        <h2>{material.title}</h2>
        <Status value={material.status} />
      </div>
      <p className="learner-prose">{material.description}</p>
      <p>
        {material.accessType === "FREE"
          ? "Miễn phí"
          : `${material.priceCredit} CR`}{" "}
        · Phiên bản {material.listingVersion}
      </p>
      {material.rejectReason && (
        <p className="learner-error">{material.rejectReason}</p>
      )}
      <MaterialCoverStatus cover={material.cover} />
      {!canEditMaterial(material) && (
        <p className="muted">{materialEditHint(material)}</p>
      )}
    </>
  );
}
