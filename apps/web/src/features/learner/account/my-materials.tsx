"use client";
import { ListPagination } from "@/components/pagination/list-pagination";
import { useUserPagedList } from "../hooks/use-user-paged-list";
import Link from "next/link";
import { useRef, useState } from "react";
import { useUserSession } from "../auth/session";
import { UserApiError } from "../api/client";

import { useUserCommand } from "../hooks/use-user-command";
import {
  Back,
  CommandFeedback,
  Empty,
  Feedback,
  PageHeading,
  Panel,
  Status,
} from "../components/common";
import type { OwnedMaterial } from "./account-types";
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
  const query = useUserPagedList<OwnedMaterial>(
    `me/materials?limit=20${status ? `&status=${status}` : ""}`,
  );
  return (
    <>
      <Back href="/learn/materials" />
      <PageHeading
        title="Tài liệu của tôi"
        action={
          <Link className="btn btn-primary" href="/learn/materials/new">
            Chia sẻ tài liệu
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
          <option value="ARCHIVED">Đã lưu trữ</option>
        </select>
      </label>
      <Feedback
        loading={query.loading}
        error={query.error}
        reload={query.reload}
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
      if (next === "edit") {
        if (canEditMaterial(fresh)) setEditing(true);
        else setError(materialEditHint(fresh));
      } else if (next) {
        if (canManageMaterial(fresh, next)) setAction(next);
        else setError("Trạng thái đã thay đổi. Hãy chọn thao tác đang có sẵn.");
      }
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
      <div className="learner-card-top">
        <h2>{current.title}</h2>
        <Status value={current.status} />
      </div>
      <p className="learner-prose">{current.description}</p>
      <p>
        {current.accessType === "FREE"
          ? "Miễn phí"
          : `${current.priceCredit} CR`}{" "}
        · Phiên bản {current.listingVersion}
      </p>
      {current.rejectReason && (
        <p className="learner-error">{current.rejectReason}</p>
      )}
      <MaterialCoverStatus cover={current.cover} />
      {!canEditMaterial(current) && (
        <p className="muted">{materialEditHint(current)}</p>
      )}
      <Feedback error={error} loading={reading} />
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
            <button
              type="button"
              className="btn"
              disabled={busy}
              onClick={() => void inspect("edit")}
            >
              Sửa tài liệu
            </button>
          )}
          {(Object.keys(labels) as MaterialAction[])
            .filter((a) => canManageMaterial(current, a))
            .map((a) => (
              <button
                key={a}
                type="button"
                className="btn"
                disabled={busy}
                onClick={() => void inspect(a)}
              >
                {labels[a]}
              </button>
            ))}
          <button
            type="button"
            className="btn"
            disabled={reading || command.pending}
            onClick={() => void inspect()}
          >
            Cập nhật trạng thái
          </button>
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
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy}
              onClick={() => void confirm()}
            >
              {labels[action]}
            </button>
            <button
              type="button"
              className="btn"
              disabled={command.pending}
              onClick={() => setAction(undefined)}
            >
              Hủy
            </button>
          </div>
        </section>
      )}
      <CommandFeedback command={command} />
      {command.uncertain && (
        <button
          type="button"
          className="btn"
          disabled={reading}
          onClick={() => void inspect()}
        >
          Kiểm tra kết quả vừa gửi
        </button>
      )}
    </Panel>
  );
}
