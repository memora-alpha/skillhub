"use client";
import { useRef, useState } from "react";
import {
  Badge,
  Card,
  Empty,
  PageHeader,
  SearchBox,
  StatusBadge,
} from "@/components/console/ui";
import { fmtDateTime } from "@/lib/console/format";
import type { CatalogSkill } from "@/lib/staff/admin-types";
import { useStaffList } from "./hooks";
import { useStaffSession } from "./session";
import { DecisionDialog, Pager, QueueState } from "./common";
import { SkillLevelsPanel } from "./skill-levels";
type Editor = {
  skill?: CatalogSkill;
  name: string;
  slug: string;
  description: string;
  categoryId: string;
  status: "ACTIVE" | "INACTIVE";
};
const uuidPattern =
  "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";
export function CatalogScreen() {
  const { api } = useStaffSession();
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [editor, setEditor] = useState<Editor | null>(null);
  const [transition, setTransition] = useState<CatalogSkill | null>(null);
  const [levels, setLevels] = useState<CatalogSkill | null>(null);
  const [restoreStatus, setRestoreStatus] = useState("ACTIVE");
  const [success, setSuccess] = useState<string | null>(null);
  const attempt = useRef<{ digest: string; key: string } | null>(null);
  const params = new URLSearchParams({ limit: "20" });
  if (search) params.set("q", search);
  if (status) params.set("status", status);
  const queue = useStaffList<CatalogSkill>(`skills?${params}`);
  const reload = async () => {
    setLevels(null);
    setEditor(null);
    setTransition(null);
    await queue.reload();
  };
  function commandKey(body: Record<string, unknown>, path: string) {
    const digest = JSON.stringify({ path, body });
    if (attempt.current?.digest !== digest)
      attempt.current = { digest, key: crypto.randomUUID() };
    return attempt.current!.key;
  }
  function edit(skill?: CatalogSkill) {
    attempt.current = null;
    setEditor({
      skill,
      name: skill?.name ?? "",
      slug: skill?.slug ?? "",
      description: skill?.description ?? "",
      categoryId: skill?.categoryId ?? "",
      status: skill?.status === "INACTIVE" ? "INACTIVE" : "ACTIVE",
    });
  }
  return (
    <>
      <PageHeader
        title="Danh mục kỹ năng"
        desc="Thêm, chỉnh sửa, ẩn và khôi phục kỹ năng của cộng đồng."
        actions={
          <div className="row">
            <button
              type="button"
              className="btn"
              disabled={queue.loading}
              onClick={reload}
            >
              Làm mới
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => edit()}
            >
              Thêm kỹ năng
            </button>
          </div>
        }
      />
      <form
        className="toolbar"
        onSubmit={(e) => {
          e.preventDefault();
          setSearch(q.trim());
        }}
      >
        <SearchBox
          label="Tìm kỹ năng"
          placeholder="Tên kỹ năng, ít nhất 2 ký tự…"
          value={q}
          onChange={setQ}
        />
        <button type="submit" className="btn" disabled={q.trim().length === 1}>
          Tìm kiếm
        </button>
        <label>
          <span className="sr-only">Trạng thái kỹ năng</span>
          <select
            className="select"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">Mọi trạng thái</option>
            {["ACTIVE", "INACTIVE", "ARCHIVED"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
      </form>
      {success && <output className="staff-success">{success}</output>}
      <Card flush>
        <QueueState
          loading={queue.loading}
          error={queue.error}
          empty={!queue.items.length}
          reload={queue.reload}
        >
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Kỹ năng</th>
                  <th>Trạng thái</th>
                  <th>Phiên bản</th>
                  <th>Cập nhật</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {queue.items.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <strong>{s.name}</strong>
                      <p className="muted">{s.description || s.slug}</p>
                    </td>
                    <td>
                      <StatusBadge status={s.status} />
                    </td>
                    <td>
                      <Badge>v{s.version}</Badge>
                    </td>
                    <td>{fmtDateTime(s.updatedAt)}</td>
                    <td>
                      <div className="row">
                        <button
                          type="button"
                          className="btn btn-sm"
                          onClick={() => setLevels(s)}
                        >
                          Cấp độ
                        </button>
                        {s.status !== "ARCHIVED" && (
                          <button
                            type="button"
                            className="btn btn-sm"
                            onClick={() => edit(s)}
                          >
                            Sửa
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn btn-sm"
                          onClick={() => {
                            setRestoreStatus("ACTIVE");
                            setTransition(s);
                          }}
                        >
                          {s.status === "ARCHIVED" ? "Khôi phục" : "Ẩn"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </QueueState>
        <div className="table-foot">{queue.items.length} kỹ năng đã tải</div>
        <Pager
          loading={queue.loading}
          more={queue.more}
          hasMore={queue.page?.hasMore}
        />
      </Card>
      {levels && (
        <SkillLevelsPanel
          key={levels.id}
          skill={levels}
          onClose={() => setLevels(null)}
        />
      )}
      {editor && (
        <DecisionDialog
          title={editor.skill ? "Chỉnh sửa kỹ năng" : "Thêm kỹ năng"}
          description={
            editor.skill
              ? `Cập nhật ${editor.skill.name}.`
              : "Tạo kỹ năng mới trong danh mục."
          }
          withReason={false}
          confirmLabel="Lưu kỹ năng"
          idempotent
          onClose={() => setEditor(null)}
          onReload={reload}
          onSubmit={async () => {
            const body: Record<string, unknown> = {
              name: editor.name.trim(),
              description: editor.description.trim() || null,
              categoryId: editor.categoryId.trim() || null,
              status: editor.status,
              ...(editor.slug.trim() ? { slug: editor.slug.trim() } : {}),
              ...(editor.skill
                ? { expectedVersion: editor.skill.version }
                : {}),
            };
            const path = editor.skill ? `skills/${editor.skill.id}` : "skills";
            await api<CatalogSkill>(path, {
              method: editor.skill ? "PATCH" : "POST",
              body,
              key: commandKey(body, path),
            });
            setSuccess("Máy chủ đã lưu kỹ năng.");
            await reload();
          }}
        >
          <div className="stack">
            <label className="staff-field">
              <span>Tên kỹ năng</span>
              <input
                required
                minLength={2}
                maxLength={100}
                value={editor.name}
                onChange={(e) => setEditor({ ...editor, name: e.target.value })}
              />
            </label>
            <label className="staff-field">
              <span>Slug (không bắt buộc)</span>
              <input
                pattern="[a-z0-9][a-z0-9\-]*[a-z0-9]"
                minLength={2}
                maxLength={120}
                value={editor.slug}
                onChange={(e) => setEditor({ ...editor, slug: e.target.value })}
              />
            </label>
            <label className="staff-field">
              <span>Mô tả</span>
              <textarea
                maxLength={500}
                value={editor.description}
                onChange={(e) =>
                  setEditor({ ...editor, description: e.target.value })
                }
              />
            </label>
            <label className="staff-field">
              <span>Mã danh mục (không bắt buộc)</span>
              <input
                pattern={uuidPattern}
                placeholder="UUID danh mục"
                value={editor.categoryId}
                onChange={(e) =>
                  setEditor({ ...editor, categoryId: e.target.value })
                }
              />
            </label>
            <label className="staff-field">
              <span>Trạng thái</span>
              <select
                value={editor.status}
                onChange={(e) =>
                  setEditor({
                    ...editor,
                    status: e.target.value as Editor["status"],
                  })
                }
              >
                <option value="ACTIVE">Hoạt động</option>
                <option value="INACTIVE">Tạm ngưng</option>
              </select>
            </label>
          </div>
        </DecisionDialog>
      )}
      {transition && (
        <DecisionDialog
          title={
            transition.status === "ARCHIVED"
              ? "Khôi phục kỹ năng"
              : "Ẩn kỹ năng"
          }
          description={transition.name}
          min={1}
          max={2000}
          danger={transition.status !== "ARCHIVED"}
          confirmLabel={
            transition.status === "ARCHIVED" ? "Khôi phục" : "Ẩn kỹ năng"
          }
          idempotent
          onClose={() => setTransition(null)}
          onReload={reload}
          onSubmit={async (reason) => {
            const restore = transition.status === "ARCHIVED";
            const body = {
              expectedVersion: transition.version,
              reason,
              ...(restore ? { status: restoreStatus } : {}),
            };
            const path = `skills/${transition.id}/${restore ? "restore" : "archive"}`;
            await api<CatalogSkill>(path, {
              method: "POST",
              body,
              key: commandKey(body, path),
            });
            setSuccess(restore ? "Đã khôi phục kỹ năng." : "Đã ẩn kỹ năng.");
            await reload();
          }}
        >
          {transition.status === "ARCHIVED" ? (
            <label className="staff-field">
              <span>Trạng thái sau khôi phục</span>
              <select
                value={restoreStatus}
                onChange={(e) => setRestoreStatus(e.target.value)}
              >
                <option value="ACTIVE">Hoạt động</option>
                <option value="INACTIVE">Tạm ngưng</option>
              </select>
            </label>
          ) : (
            <Empty
              title="Giữ lịch sử kỹ năng"
              desc="Kỹ năng bị ẩn sẽ không dùng cho lựa chọn mới; các dữ liệu đã tham chiếu được giữ lại."
            />
          )}
        </DecisionDialog>
      )}
    </>
  );
}
