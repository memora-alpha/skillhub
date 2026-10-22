"use client";
import { useState } from "react";
import { Card, StatusBadge } from "@/components/console/ui";
import type { CatalogSkill, SkillLevel } from "@/lib/staff/admin-types";
import { DecisionDialog, QueueState } from "./common";
import { useStaffCommand, useStaffList } from "./hooks";

type Editor = {
  level?: SkillLevel;
  code: string;
  name: string;
  description: string;
  sortOrder: string;
  status: "ACTIVE" | "INACTIVE";
};
export function SkillLevelsPanel({
  skill,
  onClose,
}: Readonly<{ skill: CatalogSkill; onClose: () => void }>) {
  const path = `skills/${skill.id}/levels`;
  const queue = useStaffList<SkillLevel>(path);
  const command = useStaffCommand();
  const [editor, setEditor] = useState<Editor | null>(null);
  const [success, setSuccess] = useState("");
  const reload = () => {
    setEditor(null);
    return queue.reload();
  };
  function edit(level?: SkillLevel) {
    setEditor({
      level,
      code: level?.code ?? "",
      name: level?.name ?? "",
      description: level?.description ?? "",
      sortOrder: String(level?.sortOrder ?? 0),
      status: level?.status ?? "ACTIVE",
    });
  }
  return (
    <Card
      className="section"
      title={`Cấp độ — ${skill.name}`}
      actions={
        <div className="row">
          <button className="btn" disabled={queue.loading} onClick={reload}>
            Làm mới
          </button>
          {skill.status !== "ARCHIVED" && (
            <button className="btn btn-primary" onClick={() => edit()}>
              Thêm cấp độ
            </button>
          )}
          <button className="btn" onClick={onClose}>
            Đóng
          </button>
        </div>
      }
    >
      {success && <output className="staff-success">{success}</output>}
      <QueueState
        loading={queue.loading}
        error={queue.error}
        empty={!queue.items.length}
        reload={reload}
      >
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Mã</th>
                <th>Cấp độ</th>
                <th>Thứ tự</th>
                <th>Trạng thái</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {queue.items.map((level) => (
                <tr key={level.id}>
                  <td className="mono">{level.code}</td>
                  <td>
                    <strong>{level.name}</strong>
                    <p className="muted">{level.description}</p>
                  </td>
                  <td>{level.sortOrder}</td>
                  <td>
                    <StatusBadge status={level.status} />
                  </td>
                  <td>
                    {skill.status !== "ARCHIVED" && (
                      <button
                        className="btn btn-sm"
                        onClick={() => edit(level)}
                      >
                        Sửa
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </QueueState>
      {editor && (
        <DecisionDialog
          title={editor.level ? "Chỉnh sửa cấp độ" : "Thêm cấp độ"}
          description={skill.name}
          confirmLabel="Lưu cấp độ"
          min={1}
          max={2000}
          idempotent
          onClose={() => setEditor(null)}
          onReload={reload}
          onSubmit={async (reason) => {
            await command(
              editor.level ? `${path}/${editor.level.id}` : path,
              editor.level ? "PATCH" : "POST",
              {
                name: editor.name.trim(),
                description: editor.description.trim() || null,
                sortOrder: Number(editor.sortOrder),
                status: editor.status,
                reason,
                ...(editor.level
                  ? { expectedVersion: editor.level.version }
                  : { code: editor.code.trim() }),
              },
            );
            setSuccess("Đã lưu cấp độ kỹ năng.");
            await reload();
          }}
        >
          <div className="stack">
            <label className="staff-field">
              <span>Mã cấp độ</span>
              <input
                required
                disabled={!!editor.level}
                maxLength={40}
                pattern="[A-Z0-9][A-Z0-9_-]{0,39}"
                placeholder="Ví dụ: B2"
                value={editor.code}
                onChange={(e) => setEditor({ ...editor, code: e.target.value })}
              />
            </label>
            <label className="staff-field">
              <span>Tên cấp độ</span>
              <input
                required
                minLength={2}
                maxLength={100}
                value={editor.name}
                onChange={(e) => setEditor({ ...editor, name: e.target.value })}
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
              <span>Thứ tự hiển thị</span>
              <input
                required
                type="number"
                min={0}
                max={100000}
                step={1}
                value={editor.sortOrder}
                onChange={(e) =>
                  setEditor({ ...editor, sortOrder: e.target.value })
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
    </Card>
  );
}
