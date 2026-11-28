"use client";
import { LoadingButton } from "@/components/loading-button";
import { ListPagination } from "@/components/pagination/list-pagination";
import { SearchInput } from "@/components/search-input";
import Link from "next/link";
import { useId, useMemo, useRef, useState } from "react";
import { UserApiError } from "../api/client";
import { useUserSession } from "../auth/session";
import {
  CommandFeedback,
  Feedback,
  PageHeading,
  Status,
  formatTime,
} from "../components/common";
import { ProductIcon } from "../components/product-icon";
import { useUserCommand } from "../hooks/use-user-command";
import { useUserPagedList } from "../hooks/use-user-paged-list";
import { useUserList } from "../hooks/use-user-resource";
import type { Skill } from "../types";
import type { OwnedMaterial } from "./account-types";
import { MaterialCoverStatus, MaterialThumbnail } from "./material-cover";
import { MaterialEditor } from "./material-editor";
import {
  canEditMaterial,
  canManageMaterial,
  materialEditHint,
  type MaterialAction,
} from "./material-management-policy";
import { MaterialsSubnav } from "./materials-subnav";
import styles from "./my-materials.module.css";

type MaterialStatusFilter =
  | ""
  | "DRAFT"
  | "PENDING_REVIEW"
  | "REJECTED"
  | "PUBLISHED"
  | "HIDDEN"
  | "ARCHIVED";

type PendingIntent = MaterialAction | "edit" | "refresh" | null;

const statusOptions: readonly {
  value: MaterialStatusFilter;
  label: string;
  hint: string;
  dotClass: string;
}[] = [
  {
    value: "",
    label: "Đang quản lý",
    hint: "Gồm tất cả tài liệu của bạn ngoại trừ mục Đã lưu trữ.",
    dotClass: styles.dotAll ?? "",
  },
  {
    value: "DRAFT",
    label: "Bản nháp",
    hint: "Tài liệu đang soạn thảo, sẵn sàng chỉnh sửa hoặc gửi duyệt.",
    dotClass: styles.dotDraft ?? "",
  },
  {
    value: "PENDING_REVIEW",
    label: "Chờ duyệt",
    hint: "Tài liệu đang chờ đội ngũ kiểm duyệt trước khi xuất bản.",
    dotClass: styles.dotPending ?? "",
  },
  {
    value: "REJECTED",
    label: "Cần chỉnh sửa",
    hint: "Xem lý do từ chối, cập nhật lại nội dung và gửi duyệt lại.",
    dotClass: styles.dotRejected ?? "",
  },
  {
    value: "PUBLISHED",
    label: "Đang chia sẻ",
    hint: "Tài liệu đang hiển thị công khai trong kho tài liệu số.",
    dotClass: styles.dotPublished ?? "",
  },
  {
    value: "HIDDEN",
    label: "Đang bị ẩn",
    hint: "Tài liệu tạm thời bị ẩn khỏi danh sách công khai.",
    dotClass: styles.dotHidden ?? "",
  },
  {
    value: "ARCHIVED",
    label: "Đã lưu trữ",
    hint: "Tài liệu đã ngừng chia sẻ. Bạn vẫn có thể gửi duyệt lại khi cần.",
    dotClass: styles.dotArchived ?? "",
  },
];

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

const actionIcons: Record<
  MaterialAction,
  "send" | "undo" | "archive" | "trash"
> = {
  submit: "send",
  withdraw: "undo",
  archive: "archive",
  delete: "trash",
};

function formatDayDisplay(isoDay: string): string {
  const parts = isoDay.split("-");
  if (parts.length !== 3) return isoDay;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function formatFileFormat(mimeType?: string, filename?: string | null): string {
  const ext = filename?.split(".").at(-1)?.trim().toUpperCase();
  if (ext && ["PDF", "DOCX", "PPTX", "XLSX", "DOC", "PPT", "XLS"].includes(ext))
    return ext;
  const lower = (mimeType ?? "").toLowerCase();
  if (lower.includes("pdf")) return "PDF";
  if (lower.includes("wordprocessingml") || lower.includes("msword"))
    return "DOCX";
  if (lower.includes("presentationml") || lower.includes("powerpoint"))
    return "PPTX";
  if (lower.includes("spreadsheetml") || lower.includes("excel")) return "XLSX";
  return "TÀI LIỆU";
}

function formatFileSize(rawBytes?: string | null): string | null {
  if (!rawBytes || !/^\d+$/.test(rawBytes)) return null;
  const bytes = Number(rawBytes);
  if (!Number.isFinite(bytes) || bytes <= 0) return null;
  if (bytes >= 1_000_000) {
    const mb = bytes / 1_000_000;
    return `${mb >= 10 ? mb.toFixed(0) : mb.toFixed(1).replace(".", ",")} MB`;
  }
  if (bytes >= 1_000) {
    return `${Math.round(bytes / 1_000)} KB`;
  }
  return `${bytes} B`;
}

function cardToneClass(status: string): string {
  if (status === "REJECTED") return ` ${styles.cardRejected}`;
  if (status === "PENDING_REVIEW") return ` ${styles.cardPending}`;
  if (status === "PUBLISHED") return ` ${styles.cardPublished}`;
  return "";
}

function coverBadgeInfo(
  cover?: OwnedMaterial["cover"],
): { text: string; tone: "warn" | "bad" } | null {
  if (!cover?.attached) return null;
  if (cover.processingStatus === "PENDING")
    return { text: "Đang chờ tạo ảnh bìa", tone: "warn" };
  if (cover.processingStatus === "PROCESSING")
    return { text: "Đang xử lý ảnh bìa", tone: "warn" };
  if (cover.processingStatus === "FAILED")
    return { text: "Lỗi xử lý ảnh bìa", tone: "bad" };
  if (cover.processingStatus === "REJECTED")
    return { text: "Ảnh bìa không đạt", tone: "bad" };
  return null;
}

function emptyStateCopy(
  status: MaterialStatusFilter,
  hasFilters: boolean,
): { title: string; description: string } {
  if (hasFilters) {
    return {
      title: "Không tìm thấy tài liệu phù hợp",
      description:
        "Thử thay đổi từ khóa, khoảng thời gian hoặc xóa bộ lọc đang áp dụng để xem lại các tài liệu của bạn.",
    };
  }
  switch (status) {
    case "DRAFT":
      return {
        title: "Chưa có bản nháp nào",
        description:
          "Bạn có thể tạo bản nháp trước, tải tệp lên và hoàn thiện mô tả bất cứ lúc nào trước khi gửi duyệt.",
      };
    case "PENDING_REVIEW":
      return {
        title: "Không có tài liệu đang chờ duyệt",
        description:
          "Các tài liệu sau khi bạn nhấn Gửi duyệt sẽ xuất hiện tại đây để theo dõi tiến độ kiểm duyệt.",
      };
    case "REJECTED":
      return {
        title: "Không có tài liệu cần chỉnh sửa",
        description:
          "Hiện tại bạn không có tài liệu nào bị từ chối kiểm duyệt.",
      };
    case "PUBLISHED":
      return {
        title: "Chưa có tài liệu đang chia sẻ",
        description:
          "Khi tài liệu được duyệt xuất bản, học viên khác có thể tìm thấy và tải về từ kho tài liệu số.",
      };
    case "HIDDEN":
      return {
        title: "Không có tài liệu nào đang bị ẩn",
        description:
          "Các tài liệu tạm ẩn do kiểm duyệt hoặc xử lý báo cáo sẽ được hiển thị tại đây.",
      };
    case "ARCHIVED":
      return {
        title: "Chưa có tài liệu đã lưu trữ",
        description:
          "Tài liệu bạn ngừng chia sẻ sẽ được lưu tại đây và có thể gửi duyệt lại bất kỳ lúc nào.",
      };
    default:
      return {
        title: "Bạn chưa chia sẻ tài liệu nào",
        description:
          "Chia sẻ giáo trình, slide, bài tập hoặc bộ ghi chú của bạn để cộng đồng học tập và kiếm thêm Credit.",
      };
  }
}

export function MyMaterials() {
  const { actor } = useUserSession();
  const skills = useUserList<Skill>("skills?limit=50");
  const advancedPanelId = useId();
  const skillFilterId = useId();

  const [status, setStatus] = useState<MaterialStatusFilter>("");
  const [searchText, setSearchText] = useState("");
  const [q, setQ] = useState("");
  const [accessType, setAccessType] = useState<"" | "FREE" | "PAID">("");
  const [skillId, setSkillId] = useState("");
  const [fromDay, setFromDay] = useState("");
  const [toDay, setToDay] = useState("");

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draftSkillId, setDraftSkillId] = useState("");
  const [draftFromDay, setDraftFromDay] = useState("");
  const [draftToDay, setDraftToDay] = useState("");
  const [rangeError, setRangeError] = useState<string>();

  const skillNameById = useMemo(
    () => new Map(skills.items.map((item) => [item.id, item.name])),
    [skills.items],
  );

  const queryPath = useMemo(() => {
    const params = new URLSearchParams({ limit: "20" });
    if (status) params.set("status", status);
    if (q) params.set("q", q);
    if (accessType) params.set("accessType", accessType);
    if (skillId) params.set("skillId", skillId);
    if (fromDay)
      params.set("from", new Date(`${fromDay}T00:00:00+07:00`).toISOString());
    if (toDay)
      params.set("to", new Date(`${toDay}T23:59:59.999+07:00`).toISOString());
    return `me/materials?${params.toString()}`;
  }, [status, q, accessType, skillId, fromDay, toDay]);

  const query = useUserPagedList<OwnedMaterial>(queryPath);

  const advancedCount = (skillId ? 1 : 0) + (fromDay ? 1 : 0) + (toDay ? 1 : 0);
  const hasAnyFilter = Boolean(q || accessType || skillId || fromDay || toDay);
  const currentStatusMeta =
    statusOptions.find((option) => option.value === status) ??
    statusOptions[0]!;

  function toggleAdvancedPanel() {
    if (!filtersOpen) {
      setDraftSkillId(skillId);
      setDraftFromDay(fromDay);
      setDraftToDay(toDay);
      setRangeError(undefined);
    }
    setFiltersOpen((open) => !open);
  }

  function applyAdvancedFilters(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (draftFromDay && draftToDay && draftFromDay > draftToDay) {
      setRangeError("Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.");
      return;
    }
    setRangeError(undefined);
    setSkillId(draftSkillId);
    setFromDay(draftFromDay);
    setToDay(draftToDay);
    setFiltersOpen(false);
  }

  function clearAdvancedFilters() {
    setDraftSkillId("");
    setDraftFromDay("");
    setDraftToDay("");
    setSkillId("");
    setFromDay("");
    setToDay("");
    setRangeError(undefined);
  }

  function clearAllFilters() {
    setSearchText("");
    setQ("");
    setAccessType("");
    clearAdvancedFilters();
  }

  const activeChips: { key: string; label: string; onRemove: () => void }[] =
    [];
  if (q) {
    activeChips.push({
      key: "q",
      label: `Từ khóa: “${q}”`,
      onRemove: () => {
        setSearchText("");
        setQ("");
      },
    });
  }
  if (accessType) {
    activeChips.push({
      key: "accessType",
      label:
        accessType === "FREE" ? "Hình thức: Miễn phí" : "Hình thức: Có phí",
      onRemove: () => setAccessType(""),
    });
  }
  if (skillId) {
    activeChips.push({
      key: "skillId",
      label: `Kỹ năng: ${skillNameById.get(skillId) ?? "Đã chọn"}`,
      onRemove: () => {
        setSkillId("");
        setDraftSkillId("");
      },
    });
  }
  if (fromDay) {
    activeChips.push({
      key: "fromDay",
      label: `Từ ${formatDayDisplay(fromDay)}`,
      onRemove: () => {
        setFromDay("");
        setDraftFromDay("");
      },
    });
  }
  if (toDay) {
    activeChips.push({
      key: "toDay",
      label: `Đến ${formatDayDisplay(toDay)}`,
      onRemove: () => {
        setToDay("");
        setDraftToDay("");
      },
    });
  }

  const emptyInfo = emptyStateCopy(status, hasAnyFilter);

  return (
    <div className={styles.page}>
      <MaterialsSubnav current="/learn/materials/mine" />

      <PageHeading
        eyebrow="Kho tài liệu số"
        title="Tài liệu tôi chia sẻ"
        description="Quản lý tài liệu bạn đã đăng tải, gửi duyệt xuất bản và theo dõi trạng thái kiểm duyệt."
        action={
          <Link
            className={`btn btn-primary ${styles.headerCta}`}
            href="/learn/materials/new"
          >
            <ProductIcon name="plus" size={16} />
            Chia sẻ tài liệu
          </Link>
        }
      />

      <section
        className={styles.controlCard}
        aria-label="Lọc và tìm kiếm tài liệu của tôi"
      >
        <div className={styles.statusSection}>
          <div
            className={styles.statusTrack}
            role="group"
            aria-label="Trạng thái tài liệu"
          >
            {statusOptions.map((option) => {
              const active = status === option.value;
              return (
                <button
                  key={option.value || "MANAGING"}
                  type="button"
                  className={
                    styles.statusPill +
                    (active ? ` ${styles.statusPillActive}` : "")
                  }
                  aria-pressed={active}
                  onClick={() => setStatus(option.value)}
                >
                  <span
                    className={`${styles.statusDot} ${option.dotClass}`}
                    aria-hidden="true"
                  />
                  <span>{option.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className={styles.toolbarRow}>
          <div className={styles.searchField}>
            <ProductIcon name="search" size={17} />
            <SearchInput
              name="q"
              className={styles.searchInput}
              aria-label="Tìm theo tên hoặc mô tả tài liệu"
              placeholder="Tìm theo tên hoặc mô tả tài liệu…"
              maxLength={100}
              value={searchText}
              onChange={setSearchText}
              onSearch={setQ}
            />
            {searchText && (
              <button
                type="button"
                className={styles.searchClear}
                aria-label="Xóa từ khóa tìm kiếm"
                onClick={() => {
                  setSearchText("");
                  setQ("");
                }}
              >
                <ProductIcon name="close" size={15} />
              </button>
            )}
          </div>

          <div className={styles.quickControls}>
            <select
              className={styles.quickSelect}
              aria-label="Loại truy cập tài liệu"
              value={accessType}
              onChange={(event) =>
                setAccessType(event.target.value as "" | "FREE" | "PAID")
              }
            >
              <option value="">Tất cả hình thức</option>
              <option value="FREE">Miễn phí</option>
              <option value="PAID">Có phí</option>
            </select>

            <button
              type="button"
              className={
                styles.filterToggle +
                (filtersOpen || advancedCount > 0
                  ? ` ${styles.filterToggleActive}`
                  : "")
              }
              aria-expanded={filtersOpen}
              aria-controls={advancedPanelId}
              onClick={toggleAdvancedPanel}
            >
              <ProductIcon name="sliders" size={15} />
              <span>Bộ lọc nâng cao</span>
              {advancedCount > 0 && (
                <span className={styles.filterCount}>{advancedCount}</span>
              )}
              <span
                className={
                  styles.chevron + (filtersOpen ? ` ${styles.chevronOpen}` : "")
                }
                aria-hidden="true"
              >
                <ProductIcon name="chevron" size={14} />
              </span>
            </button>

            {hasAnyFilter && (
              <button
                type="button"
                className={styles.clearBtn}
                onClick={clearAllFilters}
              >
                Xóa bộ lọc
              </button>
            )}
          </div>
        </div>

        {filtersOpen && (
          <form
            id={advancedPanelId}
            className={styles.advancedPanel}
            onSubmit={applyAdvancedFilters}
          >
            <div className={styles.advancedGrid}>
              <div className={styles.field}>
                <label htmlFor={skillFilterId} className={styles.fieldLabel}>
                  Kỹ năng
                </label>
                <select
                  id={skillFilterId}
                  className={styles.fieldControl}
                  value={draftSkillId}
                  onChange={(event) => setDraftSkillId(event.target.value)}
                >
                  <option value="">Tất cả kỹ năng</option>
                  {skills.items.map((skill) => (
                    <option key={skill.id} value={skill.id}>
                      {skill.name}
                    </option>
                  ))}
                </select>
                {skills.cursor && (
                  <button
                    type="button"
                    className={styles.loadMoreSkills}
                    disabled={skills.loading}
                    onClick={() => {
                      void skills.more();
                    }}
                  >
                    {skills.loading
                      ? "Đang tải thêm kỹ năng…"
                      : "Tải thêm kỹ năng"}
                  </button>
                )}
                {skills.error && (
                  <Feedback
                    variant="inline"
                    error={skills.error}
                    reload={skills.reload}
                  />
                )}
              </div>

              <label className={styles.field}>
                <span className={styles.fieldLabel}>
                  Từ ngày (giờ Việt Nam)
                </span>
                <input
                  type="date"
                  className={styles.fieldControl}
                  value={draftFromDay}
                  onChange={(event) => {
                    setDraftFromDay(event.target.value);
                    setRangeError(undefined);
                  }}
                />
              </label>

              <label className={styles.field}>
                <span className={styles.fieldLabel}>
                  Đến ngày (giờ Việt Nam)
                </span>
                <input
                  type="date"
                  className={styles.fieldControl}
                  value={draftToDay}
                  onChange={(event) => {
                    setDraftToDay(event.target.value);
                    setRangeError(undefined);
                  }}
                />
              </label>
            </div>

            {rangeError && (
              <div className={styles.rangeError} role="alert">
                <ProductIcon name="alert" size={16} />
                <span>{rangeError}</span>
              </div>
            )}

            <div className={styles.advancedFooter}>
              <p className={styles.advancedNote}>
                Lọc theo ngày tạo tài liệu theo múi giờ Việt Nam (UTC+7).
              </p>
              <div className={styles.advancedActions}>
                <button
                  type="button"
                  className="btn"
                  onClick={clearAdvancedFilters}
                >
                  Đặt lại
                </button>
                <button type="submit" className="btn btn-primary">
                  Áp dụng bộ lọc
                </button>
              </div>
            </div>
          </form>
        )}

        {activeChips.length > 0 && (
          <div className={styles.activeBar} aria-label="Bộ lọc đang áp dụng">
            <span className={styles.activeLabel}>Đang lọc:</span>
            {activeChips.map((chip) => (
              <span key={chip.key} className={styles.activeChip}>
                <span className={styles.activeChipText}>{chip.label}</span>
                <button
                  type="button"
                  className={styles.activeChipRemove}
                  aria-label={`Bỏ lọc ${chip.label}`}
                  onClick={chip.onRemove}
                >
                  <ProductIcon name="close" size={12} />
                </button>
              </span>
            ))}
          </div>
        )}
      </section>

      <div className={styles.resultsBar}>
        <span>
          <strong>{currentStatusMeta.label}</strong>
          {!query.initialLoading && !query.error && (
            <>
              {" "}
              ·{" "}
              {query.items.length > 0
                ? `${query.items.length}${query.hasNext ? "+" : ""} tài liệu${query.pageNumber > 1 ? ` (trang ${query.pageNumber})` : ""}`
                : "Chưa có tài liệu"}
            </>
          )}
        </span>
        <span>{currentStatusMeta.hint}</span>
      </div>

      <Feedback
        loading={query.initialLoading}
        error={query.error}
        reload={query.reload}
        refreshing={!!(query.loading && !query.initialLoading)}
      />

      {query.items.length > 0 && (
        <div className={styles.list}>
          {query.items.map((material) => (
            <OwnerCard
              key={`${actor.userId}:${material.id}:${material.listingVersion}`}
              material={material}
              skillName={skillNameById.get(material.skillId)}
              reload={query.reload}
            />
          ))}
        </div>
      )}

      {!query.loading && !query.error && !query.items.length && (
        <div className={styles.emptyState}>
          <span className={styles.emptyEmblem} aria-hidden="true">
            <ProductIcon name={hasAnyFilter ? "search" : "file"} size={24} />
          </span>
          <h2>{emptyInfo.title}</h2>
          <p>{emptyInfo.description}</p>
          <div className={styles.emptyActions}>
            {hasAnyFilter ? (
              <button
                type="button"
                className="btn btn-primary"
                onClick={clearAllFilters}
              >
                Xóa bộ lọc
              </button>
            ) : (
              <Link className="btn btn-primary" href="/learn/materials/new">
                <ProductIcon name="plus" size={16} />
                Chia sẻ tài liệu mới
              </Link>
            )}
            {status !== "" && (
              <button
                type="button"
                className="btn"
                onClick={() => setStatus("")}
              >
                Xem mục Đang quản lý
              </button>
            )}
          </div>
        </div>
      )}

      <ListPagination query={query} />
    </div>
  );
}

function OwnerCard({
  material,
  skillName,
  reload,
}: Readonly<{
  material: OwnedMaterial;
  skillName?: string;
  reload: () => void;
}>) {
  const { request, actor } = useUserSession();
  const command = useUserCommand();
  const [current, setCurrent] = useState(material);
  const [action, setAction] = useState<MaterialAction>();
  const [editing, setEditing] = useState(false);
  const [reading, setReading] = useState(false);
  const [pendingIntent, setPendingIntent] = useState<PendingIntent>(null);
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
    setPendingIntent(next ?? "refresh");
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
      setPendingIntent(null);
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

  if (deleted) {
    return (
      <div className={styles.deletedCard} role="status">
        <ProductIcon name="check" size={18} />
        <output>Đã gỡ tài liệu khỏi danh sách của bạn.</output>
      </div>
    );
  }

  const availableActions = (Object.keys(labels) as MaterialAction[]).filter(
    (item) => canManageMaterial(current, item),
  );
  const canEdit = canEditMaterial(current);

  return (
    <article className={styles.card + cardToneClass(current.status)}>
      <OwnerMaterialSummary material={current} skillName={skillName} />

      <Feedback variant="inline" error={error} loading={reading} />

      {editing ? (
        <MaterialEditor
          key={`${current.id}:${current.listingVersion}`}
          material={current}
          close={() => setEditing(false)}
          reload={reload}
        />
      ) : (
        <div className={styles.cardFooter}>
          <div className={styles.primaryActions}>
            {availableActions.includes("submit") && (
              <LoadingButton
                type="button"
                className={`btn btn-primary ${styles.actionBtn}`}
                disabled={busy}
                onClick={() => void inspect("submit")}
                loading={reading && pendingIntent === "submit"}
              >
                <ProductIcon name="send" size={14} />
                {labels.submit}
              </LoadingButton>
            )}

            {canEdit && (
              <LoadingButton
                type="button"
                className={`btn ${styles.actionBtn}`}
                disabled={busy}
                onClick={() => void inspect("edit")}
                loading={reading && pendingIntent === "edit"}
              >
                <ProductIcon name="edit" size={14} />
                Sửa tài liệu
              </LoadingButton>
            )}

            {availableActions
              .filter((item) => item !== "submit")
              .map((item) => (
                <LoadingButton
                  key={item}
                  type="button"
                  className={`btn ${styles.actionBtn}${
                    item === "delete" ? ` ${styles.dangerOutlineBtn}` : ""
                  }`}
                  disabled={busy}
                  onClick={() => void inspect(item)}
                  loading={reading && pendingIntent === item}
                >
                  <ProductIcon name={actionIcons[item]} size={14} />
                  {labels[item]}
                </LoadingButton>
              ))}
          </div>

          <div className={styles.utilityActions}>
            <Link
              className={`btn ${styles.actionBtn} ${styles.ghostBtn}`}
              href={`/learn/materials/${current.id}`}
            >
              <ProductIcon name="eye" size={14} />
              Xem chi tiết
            </Link>
            <LoadingButton
              type="button"
              className={`btn ${styles.actionBtn} ${styles.ghostBtn}`}
              disabled={reading || command.pending}
              onClick={() => void inspect()}
              loading={reading && pendingIntent === "refresh"}
            >
              <ProductIcon name="refresh" size={14} />
              Làm mới trạng thái
            </LoadingButton>
          </div>
        </div>
      )}

      {action && (
        <section
          className={
            styles.confirmBox +
            (action === "delete" ? ` ${styles.confirmBoxDanger}` : "")
          }
          aria-label={`Xác nhận ${labels[action].toLowerCase()}`}
        >
          <div className={styles.confirmHeader}>
            <span className={styles.confirmIcon} aria-hidden="true">
              <ProductIcon
                name={action === "delete" ? "alert" : actionIcons[action]}
                size={17}
              />
            </span>
            <div className={styles.confirmCopy}>
              <h3>
                {labels[action]} “{current.title}”?
              </h3>
              <p>{explanations[action]}</p>
            </div>
          </div>
          <div className={styles.confirmActions}>
            <LoadingButton
              type="button"
              className={
                action === "delete"
                  ? `btn btn-danger ${styles.confirmDangerBtn}`
                  : "btn btn-primary"
              }
              disabled={busy}
              onClick={() => void confirm()}
              loading={command.pending}
            >
              Xác nhận {labels[action].toLowerCase()}
            </LoadingButton>
            <LoadingButton
              type="button"
              className="btn"
              disabled={command.pending}
              onClick={() => setAction(undefined)}
              loading={false}
            >
              Hủy
            </LoadingButton>
          </div>
        </section>
      )}

      <CommandFeedback command={command} />

      {command.uncertain && (
        <div className={styles.confirmActions}>
          <LoadingButton
            loading={reading}
            type="button"
            className="btn"
            disabled={reading}
            onClick={() => void inspect()}
          >
            <ProductIcon name="refresh" size={14} />
            Kiểm tra kết quả vừa gửi
          </LoadingButton>
        </div>
      )}
    </article>
  );
}

function OwnerMaterialSummary({
  material,
  skillName,
}: Readonly<{ material: OwnedMaterial; skillName?: string }>) {
  const format = formatFileFormat(
    material.file?.mimeType,
    material.file?.originalFilename,
  );
  const fileSize = formatFileSize(material.file?.sizeBytes);
  const coverBadge = coverBadgeInfo(material.cover);
  const isPaid = material.accessType === "PAID";

  return (
    <>
      <div className={styles.cardLayout}>
        <Link
          href={`/learn/materials/${material.id}`}
          className={
            styles.mediaWrap + (isPaid ? ` ${styles.mediaWrapPaid}` : "")
          }
          aria-label={`Xem chi tiết ${material.title}`}
        >
          <MaterialThumbnail
            thumbnail={material.thumbnail ?? material.cover?.preview}
          />
          <span className={styles.mediaFormatBadge}>{format}</span>
          {coverBadge && (
            <span
              className={
                styles.mediaCoverTag +
                (coverBadge.tone === "bad"
                  ? ` ${styles.mediaCoverTagBad}`
                  : ` ${styles.mediaCoverTagWarn}`)
              }
            >
              {coverBadge.text}
            </span>
          )}
        </Link>

        <div className={styles.cardBody}>
          <div className={styles.cardHeader}>
            <div className={styles.cardBadges}>
              <Status value={material.status} />
              {skillName && (
                <span className={styles.skillBadge}>{skillName}</span>
              )}
            </div>
            <span
              className={`${styles.priceBadge} ${
                isPaid ? styles.pricePaid : styles.priceFree
              }`}
            >
              {isPaid ? `${material.priceCredit} CR` : "Miễn phí"}
            </span>
          </div>

          <h2 className={styles.cardTitle}>
            <Link href={`/learn/materials/${material.id}`}>
              {material.title}
            </Link>
          </h2>

          <p className={styles.cardDesc}>{material.description}</p>

          <div className={styles.metaRow}>
            {material.file ? (
              <span className={styles.metaItem}>
                <ProductIcon name="paperclip" size={14} />
                <span
                  className={styles.fileName}
                  title={material.file.originalFilename ?? undefined}
                >
                  {material.file.originalFilename ?? "Tệp đính kèm"}
                </span>
                {fileSize && <span>· {fileSize}</span>}
              </span>
            ) : (
              <span className={`${styles.metaItem} ${styles.metaWarn}`}>
                <ProductIcon name="alert" size={14} />
                <span>Chưa đính kèm tệp tài liệu</span>
              </span>
            )}

            <span className={styles.metaItem}>
              <ProductIcon name="file" size={14} />
              <span>Phiên bản {material.listingVersion}</span>
            </span>

            {material.updatedAt && (
              <span className={styles.metaItem}>
                <ProductIcon name="clock" size={14} />
                <span>Cập nhật {formatTime(material.updatedAt)}</span>
              </span>
            )}
          </div>

          {material.rejectReason && (
            <div className={styles.rejectCallout} role="alert">
              <ProductIcon name="alert" size={17} />
              <div>
                <strong>Lý do cần chỉnh sửa</strong>
                <span>{material.rejectReason}</span>
              </div>
            </div>
          )}

          {!canEditMaterial(material) && (
            <div className={styles.editHint}>
              <ProductIcon
                name={material.hasBeenPublished ? "lock" : "info"}
                size={15}
              />
              <span>{materialEditHint(material)}</span>
            </div>
          )}

          <MaterialCoverStatus cover={material.cover} />
        </div>
      </div>
    </>
  );
}
