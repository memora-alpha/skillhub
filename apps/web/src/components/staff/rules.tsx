"use client";
import { LoadingButton } from "@/components/loading-button";
import Link from "next/link";
import { useId, useState } from "react";
import {
  editableRules,
  ruleValues,
  validateRules,
} from "@/lib/staff/moderation-rules";
import {
  Badge,
  Card,
  DataTable,
  Empty,
  PageHeader,
  SearchBox,
  Segmented,
} from "@/components/console/ui";
import { Icon } from "@/components/console/icon";
import type { ModerationRules } from "@/lib/staff/admin-types";
import { fmtDateTime } from "@/lib/console/format";
import { hasPermission } from "@/lib/staff/permissions";
import { AdminFilterPanel, filterPanelStyles } from "./admin-filter-panel";
import { DecisionDialog, QueueState } from "./common";
import { useStaffResource } from "./hooks";
import { ProfanityRules } from "./profanity-rules";
import { useStaffSession } from "./session";
import styles from "./admin-config.module.css";

type ConfigTab = "moderation" | "profanity" | "standards";

const srsBusinessStandards = [
  {
    tag: "Buổi học 1:1",
    group: "Thời lượng & Đổi lịch Session",
    value: "60–180 phút · Chốt trước 60 phút",
    detail:
      "Mỗi buổi học kéo dài 1–3 giờ. Đổi lịch chỉ có hiệu lực khi cả hai bên xác nhận trước giờ bắt đầu tối thiểu 60 phút.",
  },
  {
    tag: "Bảo mật",
    group: "Giới hạn xác minh OTP",
    value: "Sai 5 lần → Tạm chặn 24 giờ",
    detail:
      "Chặn gửi và xác minh OTP trong 24 giờ theo email chuẩn hóa; không đặt lại khi gửi lại mã và không khóa đăng nhập hợp lệ.",
  },
  {
    tag: "Uy tín",
    group: "Thang điểm & Phục hồi (V1.6)",
    value: "Khởi tạo 50/100 · Hạn chế < 40",
    detail:
      "30–39 khóa tạo mới 24h; 20–29 khóa 3 ngày + xác nhận chính sách; 10–19 khóa 7 ngày; 0–9 khóa 30 ngày. Nhiệm vụ phục hồi tối đa +5/30 ngày.",
  },
];

function RulesEditor({
  snapshot,
  reload,
  onSaved,
}: Readonly<{
  snapshot: ModerationRules;
  reload: () => void;
  onSaved: () => void;
}>) {
  const { api } = useStaffSession();
  const [rules, setRules] = useState(() => editableRules(snapshot.rules));
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [newPattern, setNewPattern] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const categoryListId = useId();

  const changed =
    JSON.stringify(ruleValues(rules)) !== JSON.stringify(snapshot.rules);

  const categories = Array.from(
    new Set(rules.map((r) => r.category.trim()).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b));

  const needle = search.trim().toLocaleLowerCase("vi");
  const visible = rules.filter((rule) => {
    if (categoryFilter && rule.category.trim() !== categoryFilter) return false;
    if (!needle) return true;
    return `${rule.category} ${rule.pattern}`
      .toLocaleLowerCase("vi")
      .includes(needle);
  });

  function requestSave() {
    const issue = validateRules(rules);
    setError(issue);
    if (!issue) setConfirm(true);
  }

  return (
    <div className={styles.workspace}>
      {changed && (
        <div className={styles.dirtyBanner} role="status">
          <div className={styles.dirtyBannerInfo}>
            <Icon name="alert" size={16} />
            <span>
              Bạn có thay đổi chưa lưu ({rules.length} quy tắc kiểm duyệt).
            </span>
          </div>
          <div className={styles.metaActions}>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => {
                setRules(editableRules(snapshot.rules));
                setError(null);
              }}
            >
              Hoàn tác
            </button>
            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={requestSave}
            >
              Lưu thay đổi
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="staff-error" role="alert">
          {error}
        </p>
      )}

      <Card flush>
        <div className={styles.metaBar}>
          <div className={styles.metaLeft}>
            <Badge tone="brand">Phiên bản v{snapshot.version}</Badge>
            <span>
              <strong>{rules.length}</strong>/250 quy tắc ·{" "}
              <strong>{categories.length}</strong> nhóm
            </span>
            <span>· Đọc lúc {fmtDateTime(snapshot.readAt)}</span>
          </div>
          <div className={styles.metaActions}>
            <button
              type="button"
              className="btn btn-sm btn-primary"
              disabled={rules.length >= 250}
              onClick={() => setShowAdd((open) => !open)}
            >
              <Icon name={showAdd ? "x" : "plus"} size={14} />
              {showAdd ? "Đóng thêm nhanh" : "Thêm quy tắc"}
            </button>
          </div>
        </div>

        <div className={styles.inlineHint}>
          Bài yêu cầu học khớp quy tắc sẽ tự chuyển sang{" "}
          <strong>Chờ kiểm duyệt</strong>. Dùng ký tự <code>*</code> để khớp
          đoạn văn bản bất kỳ (tối đa 1 dấu <code>*</code> mỗi mẫu).
        </div>

        {showAdd && (
          <form
            className={styles.quickAdd}
            onSubmit={(event) => {
              event.preventDefault();
              const cat = newCategory.trim();
              const pat = newPattern.trim();
              if (!cat || !pat) return;
              setRules((prev) => [
                ...editableRules([{ category: cat, pattern: pat }]),
                ...prev,
              ]);
              setNewCategory("");
              setNewPattern("");
              setError(null);
            }}
          >
            <label className={styles.quickField}>
              <span>Nhóm quy tắc (chữ, số, _ hoặc -)</span>
              <input
                list={categoryListId}
                required
                maxLength={64}
                pattern="[A-Za-z][A-Za-z0-9_\-]*"
                placeholder="Ví dụ: CONTACT_INFO"
                value={newCategory}
                onChange={(event) => setNewCategory(event.target.value)}
              />
            </label>
            <label className={styles.quickField}>
              <span>Mẫu nội dung</span>
              <input
                required
                maxLength={120}
                placeholder="Ví dụ: zalo* hoặc số điện thoại…"
                value={newPattern}
                onChange={(event) => setNewPattern(event.target.value)}
              />
            </label>
            <button type="submit" className="btn btn-sm btn-primary">
              Thêm vào bảng
            </button>
          </form>
        )}

        <datalist id={categoryListId}>
          {categories.map((cat) => (
            <option key={cat} value={cat} />
          ))}
        </datalist>

        <AdminFilterPanel
          flush
          activeCount={categoryFilter ? 1 : 0}
          onClear={() => setCategoryFilter("")}
          lead={
            <SearchBox
              label="Tìm quy tắc kiểm duyệt"
              placeholder="Tìm theo nhóm quy tắc hoặc mẫu nội dung…"
              value={search}
              onChange={setSearch}
            />
          }
          actions={
            <span className="muted">
              Hiển thị {visible.length}/{rules.length}
            </span>
          }
        >
          <div className={filterPanelStyles.grid}>
            <label className={filterPanelStyles.field}>
              <span>Lọc theo nhóm quy tắc</span>
              <select
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
              >
                <option value="">Tất cả nhóm ({categories.length})</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </AdminFilterPanel>

        {!visible.length ? (
          <Empty
            title="Không tìm thấy quy tắc phù hợp"
            desc="Thử đổi từ khóa tìm kiếm hoặc bỏ lọc nhóm quy tắc."
          />
        ) : (
          <DataTable
            columns={["#", "Nhóm quy tắc", "Mẫu nội dung (*)", "Thao tác"]}
          >
            {visible.map((rule, index) => (
              <tr key={rule.id}>
                <td className={styles.indexCell}>{index + 1}</td>
                <td>
                  <input
                    className={styles.compactInput}
                    aria-label={`Nhóm quy tắc dòng ${index + 1}`}
                    required
                    maxLength={64}
                    pattern="[A-Za-z][A-Za-z0-9_\-]*"
                    list={categoryListId}
                    value={rule.category}
                    disabled={confirm}
                    onChange={(event) => {
                      setError(null);
                      setRules((prev) =>
                        prev.map((r) =>
                          r.id === rule.id
                            ? { ...r, category: event.target.value }
                            : r,
                        ),
                      );
                    }}
                  />
                </td>
                <td>
                  <input
                    className={styles.compactInput}
                    aria-label={`Mẫu nội dung dòng ${index + 1}`}
                    required
                    maxLength={120}
                    value={rule.pattern}
                    disabled={confirm}
                    onChange={(event) => {
                      setError(null);
                      setRules((prev) =>
                        prev.map((r) =>
                          r.id === rule.id
                            ? { ...r, pattern: event.target.value }
                            : r,
                        ),
                      );
                    }}
                  />
                </td>
                <td className={styles.actionCell}>
                  <button
                    type="button"
                    className="btn btn-sm admin-danger-outline"
                    disabled={rules.length <= 1 || confirm}
                    onClick={() => {
                      setError(null);
                      setRules((prev) => prev.filter((r) => r.id !== rule.id));
                    }}
                    aria-label={`Xóa quy tắc ${index + 1}`}
                  >
                    Xóa
                  </button>
                </td>
              </tr>
            ))}
          </DataTable>
        )}

        <div className={styles.tableFoot}>
          <span>Nhấp trực tiếp vào từng ô trong bảng để sửa nhanh.</span>
          {changed && (
            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={requestSave}
            >
              Lưu thay đổi
            </button>
          )}
        </div>
      </Card>

      {confirm && (
        <DecisionDialog
          presentation="drawer"
          title="Lưu quy tắc kiểm duyệt"
          description={`${rules.length} quy tắc sẽ thay thế bộ quy tắc hiện tại và ghi nhận trong nhật ký hoạt động.`}
          min={10}
          max={500}
          confirmLabel="Lưu quy tắc"
          onClose={() => setConfirm(false)}
          onReload={reload}
          onSubmit={async (reason) => {
            await api<ModerationRules>("moderation-rules", {
              method: "PUT",
              body: {
                expectedVersion: snapshot.version,
                rules: ruleValues(rules),
                reason,
              },
            });
            onSaved();
          }}
        />
      )}
    </div>
  );
}

function StandardsReferencePanel() {
  return (
    <div className={styles.workspace}>
      <div className={styles.standardsGrid}>
        {srsBusinessStandards.map((item) => (
          <article className={styles.standardCard} key={item.group}>
            <span className={styles.standardTag}>{item.tag}</span>
            <strong>{item.value}</strong>
            <p>{item.detail}</p>
          </article>
        ))}
      </div>
      <Card title="Chính sách Credit & phí nền tảng">
        <div
          className="row"
          style={{ justifyContent: "space-between", flexWrap: "wrap" }}
        >
          <p className="muted" style={{ margin: 0 }}>
            Cấu hình tỷ lệ phí nền tảng (TWO_WAY, ONE_WAY, tài liệu trả phí)
            được quản lý tập trung tại phân hệ Tài chính &amp; Credit.
          </p>
          <Link className="btn btn-primary" href="/admin/credits?tab=fees">
            Mở chính sách phí &amp; Credit →
          </Link>
        </div>
      </Card>
    </div>
  );
}

export function AdminConfigScreen() {
  const { actor } = useStaffSession();
  const canProfanity = hasPermission(actor, "content-moderation:configure");
  const [tab, setTab] = useState<ConfigTab>("moderation");
  const [success, setSuccess] = useState(false);
  const resource = useStaffResource<ModerationRules>("moderation-rules");

  const activeTab: ConfigTab =
    tab === "profanity" && !canProfanity ? "moderation" : tab;

  const tabOptions: { id: ConfigTab; label: string }[] = [
    { id: "moderation", label: "Bộ lọc yêu cầu học" },
    ...(canProfanity
      ? [{ id: "profanity" as const, label: "Bộ lọc từ ngữ hệ thống" }]
      : []),
    { id: "standards", label: "Quy chuẩn vận hành" },
  ];

  return (
    <div className={styles.workspace}>
      <PageHeader
        title="Quy tắc & Cài đặt"
        desc="Quản lý quy tắc kiểm duyệt nội dung, bộ lọc từ ngữ toàn hệ thống và quy chuẩn vận hành."
        actions={
          <div className="row">
            <Link className="btn" href="/admin/credits?tab=fees">
              Chính sách phí &amp; Credit →
            </Link>
            {activeTab === "moderation" && (
              <LoadingButton
                type="button"
                className="btn"
                disabled={resource.loading}
                onClick={resource.reload}
                loading={!!resource.loading}
              >
                <Icon name="refresh" size={15} />
                Làm mới
              </LoadingButton>
            )}
          </div>
        }
      />

      <div className="ops-tabbar">
        <Segmented<ConfigTab>
          label="Nhóm cấu hình nghiệp vụ"
          value={activeTab}
          onChange={(next) => {
            setTab(next);
            setSuccess(false);
          }}
          options={tabOptions}
        />
      </div>

      {success && (
        <output className="staff-success">
          Đã lưu quy tắc kiểm duyệt thành công.
        </output>
      )}

      {activeTab === "moderation" && (
        <QueueState
          loading={resource.loading}
          error={resource.error}
          empty={!resource.data}
          reload={resource.reload}
        >
          {resource.data && (
            <RulesEditor
              key={resource.data.version}
              snapshot={resource.data}
              reload={resource.reload}
              onSaved={() => {
                setSuccess(true);
                void resource.reload();
              }}
            />
          )}
        </QueueState>
      )}

      {activeTab === "profanity" && canProfanity && <ProfanityRules />}

      {activeTab === "standards" && <StandardsReferencePanel />}
    </div>
  );
}

export const RulesScreen = AdminConfigScreen;
