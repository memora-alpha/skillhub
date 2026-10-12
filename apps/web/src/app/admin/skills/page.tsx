"use client";

import { useState } from "react";
import { useConsole } from "@/components/console/context";
import { Icon } from "@/components/console/icon";
import { ReasonDialog } from "@/components/console/reason-dialog";
import {
  Card,
  Empty,
  GatedButton,
  Notice,
  PageHeader,
  SearchBox,
  StatusBadge,
} from "@/components/console/ui";
import { CATEGORIES, SKILLS, type SkillItem } from "@/lib/console/data";
import { fmtNum } from "@/lib/console/format";

type Form = {
  id: string | null;
  name: string;
  category: string;
  error?: string;
};

export default function AdminSkillsPage() {
  const { can, record } = useConsole();
  const [skills, setSkills] = useState<SkillItem[]>(SKILLS);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState<Form | null>(null);
  const [toggle, setToggle] = useState<SkillItem | null>(null);
  const allowed = can("skill.manage");

  const q = query.trim().toLowerCase();
  const rows = skills.filter(
    (s) => !q || `${s.name} ${s.category}`.toLowerCase().includes(q),
  );

  function save() {
    if (!form) return;
    const name = form.name.trim();
    const category = form.category.trim();
    if (name.length < 2 || name.length > 60) {
      setForm({ ...form, error: "Tên kỹ năng cần từ 2 đến 60 ký tự." });
      return;
    }
    if (!category) {
      setForm({ ...form, error: "Vui lòng nhập danh mục." });
      return;
    }
    if (
      skills.some(
        (s) => s.id !== form.id && s.name.toLowerCase() === name.toLowerCase(),
      )
    ) {
      setForm({ ...form, error: "Kỹ năng này đã tồn tại." });
      return;
    }
    if (form.id) {
      const before = skills.find((s) => s.id === form.id);
      setSkills((p) =>
        p.map((s) => (s.id === form.id ? { ...s, name, category } : s)),
      );
      record({
        action: "SKILL_CATALOG_UPDATE",
        target: `SKILL:${form.id}`,
        before: before?.name,
        after: name,
      });
    } else {
      const id = `sk_${String(skills.length + 1).padStart(2, "0")}`;
      setSkills((p) => [
        ...p,
        { id, name, category, status: "ACTIVE", refs: 0, verifiedUsers: 0 },
      ]);
      record({
        action: "SKILL_CATALOG_CREATE",
        target: `SKILL:${id}`,
        after: name,
      });
    }
    setForm(null);
  }

  function flip(reason: string) {
    if (!toggle) return;
    const archive = toggle.status === "ACTIVE";
    const next = archive ? "ARCHIVED" : "ACTIVE";
    setSkills((p) =>
      p.map((s) => (s.id === toggle.id ? { ...s, status: next } : s)),
    );
    record({
      action: archive ? "SKILL_CATALOG_ARCHIVE" : "SKILL_CATALOG_RESTORE",
      target: `SKILL:${toggle.id}`,
      reason,
      before: toggle.status,
      after: next,
    });
    setToggle(null);
  }

  return (
    <>
      <PageHeader
        title="Danh mục kỹ năng"
        desc="Thêm, sửa hoặc ẩn kỹ năng và tag. Hệ thống không xóa cứng kỹ năng đang có dữ liệu tham chiếu."
        actions={
          <GatedButton
            allowed={allowed}
            className="btn btn-primary"
            onClick={() => setForm({ id: null, name: "", category: "" })}
          >
            <Icon name="plus" size={16} /> Thêm kỹ năng
          </GatedButton>
        }
      />
      <div className="toolbar">
        <SearchBox
          label="Tìm kỹ năng"
          placeholder="Tên hoặc danh mục…"
          value={query}
          onChange={setQuery}
        />
      </div>
      <Card flush>
        {rows.length === 0 ? (
          <Empty title="Không có kỹ năng phù hợp" />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Kỹ năng</th>
                  <th>Danh mục</th>
                  <th>Trạng thái</th>
                  <th className="num">Tham chiếu</th>
                  <th className="num">Người đã xác minh</th>
                  <th>
                    <span className="sr-only">Thao tác</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <strong>{s.name}</strong>
                    </td>
                    <td>{s.category}</td>
                    <td>
                      <StatusBadge status={s.status} />
                    </td>
                    <td className="num">{fmtNum(s.refs)}</td>
                    <td className="num">{fmtNum(s.verifiedUsers)}</td>
                    <td>
                      <div className="row">
                        <GatedButton
                          allowed={allowed}
                          className="btn btn-sm"
                          aria-label={`Sửa ${s.name}`}
                          onClick={() =>
                            setForm({
                              id: s.id,
                              name: s.name,
                              category: s.category,
                            })
                          }
                        >
                          <Icon name="edit" size={14} /> Sửa
                        </GatedButton>
                        <GatedButton
                          allowed={allowed}
                          className="btn btn-sm"
                          aria-label={`${s.status === "ACTIVE" ? "Ẩn" : "Khôi phục"} ${s.name}`}
                          onClick={() => setToggle(s)}
                        >
                          <Icon
                            name={s.status === "ACTIVE" ? "eyeOff" : "restore"}
                            size={14}
                          />
                          {s.status === "ACTIVE" ? "Ẩn" : "Khôi phục"}
                        </GatedButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="table-foot">
          Hiển thị {rows.length}/{skills.length} kỹ năng · Không có thao tác
          xóa: ẩn kỹ năng để giữ lịch sử và các tham chiếu.
        </div>
      </Card>

      {form && (
        <ReasonDialog
          withReason={false}
          title={form.id ? "Sửa kỹ năng" : "Thêm kỹ năng"}
          confirmLabel={form.id ? "Lưu thay đổi" : "Thêm kỹ năng"}
          onClose={() => setForm(null)}
          onConfirm={save}
        >
          <div className="field">
            <label htmlFor="skill-name">Tên kỹ năng</label>
            <input
              id="skill-name"
              className="input"
              value={form.name}
              maxLength={60}
              autoComplete="off"
              aria-invalid={!!form.error}
              onChange={(e) =>
                setForm({ ...form, name: e.target.value, error: undefined })
              }
            />
          </div>
          <div className="field">
            <label htmlFor="skill-category">Danh mục</label>
            <input
              id="skill-category"
              className="input"
              list="skill-categories"
              value={form.category}
              autoComplete="off"
              aria-invalid={!!form.error}
              onChange={(e) =>
                setForm({ ...form, category: e.target.value, error: undefined })
              }
            />
            <datalist id="skill-categories">
              {CATEGORIES.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          {form.error && (
            <p className="field-error" role="alert">
              {form.error}
            </p>
          )}
        </ReasonDialog>
      )}

      {toggle && (
        <ReasonDialog
          title={
            toggle.status === "ACTIVE" ? "Ẩn kỹ năng" : "Khôi phục kỹ năng"
          }
          description={toggle.name}
          confirmLabel={toggle.status === "ACTIVE" ? "Ẩn kỹ năng" : "Khôi phục"}
          tone={toggle.status === "ACTIVE" ? "danger" : "primary"}
          onClose={() => setToggle(null)}
          onConfirm={flip}
        >
          {toggle.status === "ACTIVE" && toggle.refs > 0 && (
            <div className="section">
              <Notice tone="warn" icon="warn">
                {fmtNum(toggle.refs)} bản ghi đang tham chiếu kỹ năng này. Ẩn sẽ
                không cho chọn mới nhưng giữ nguyên dữ liệu cũ.
              </Notice>
            </div>
          )}
        </ReasonDialog>
      )}
    </>
  );
}
