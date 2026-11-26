"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { Icon } from "@/components/console/icon";
import { LoadingButton } from "@/components/loading-button";
import { ListPagination } from "@/components/pagination/list-pagination";
import { SearchInput } from "@/components/search-input";
import { fmtDate, fmtDateTime } from "@/lib/console/format";
import { QueueState } from "./common";
import { AdminFilterPanel, filterPanelStyles } from "./admin-filter-panel";
import { useStaffListPages } from "./use-staff-list-pages";
import styles from "./admin-learning-paths.module.css";

type Person = { id: string; fullName: string };
type Path = {
  id: string;
  status: string;
  learningStage: string | null;
  participantA: Person;
  participantB: Person;
  createdAt: string;
  updatedAt: string;
};

const statuses: Record<string, { label: string; tone: string }> = {
  DRAFT: { label: "Bản nháp", tone: "warn" },
  PROPOSED: { label: "Đã đề xuất", tone: "info" },
  PARTIALLY_CONFIRMED: { label: "Chờ bên còn lại xác nhận", tone: "warn" },
  CONFIRMED: { label: "Đã xác nhận", tone: "ok" },
  SCHEDULED: { label: "Đã xếp lịch", tone: "info" },
  ACTIVE: { label: "Đang hoạt động", tone: "ok" },
  COMPLETED: { label: "Hoàn thành", tone: "ok" },
  CANCELLED: { label: "Đã hủy", tone: "neutral" },
  DISPUTED: { label: "Đang tranh chấp", tone: "bad" },
};
const stages: Record<string, { label: string; tone: string }> = {
  PREPARING: { label: "Đang chuẩn bị", tone: "info" },
  WAITING_START: { label: "Chờ bắt đầu", tone: "info" },
  LEARNING: { label: "Đang học", tone: "brand" },
  LEARNING_FINISHED: { label: "Đã học xong, chờ quyết toán", tone: "ok" },
  COMPLETED: { label: "Đã hoàn tất", tone: "ok" },
  STOPPED: { label: "Đã dừng nghĩa vụ học", tone: "neutral" },
};

function PathStatus({ value }: Readonly<{ value: string }>) {
  const status = statuses[value];
  return (
    <span className={styles.badge} data-tone={status?.tone ?? "neutral"}>
      <i aria-hidden="true" />
      {status?.label ?? "Chưa xác định trạng thái"}
    </span>
  );
}
function PathStage({ value }: Readonly<{ value: string | null }>) {
  const stage = value ? stages[value] : undefined;
  return (
    <span className={styles.stage} data-tone={stage?.tone ?? "unknown"}>
      {stage?.label ?? "Chưa xác định"}
    </span>
  );
}
function Participant({
  person,
  second = false,
}: Readonly<{ person: Person; second?: boolean }>) {
  const parts = person.fullName.trim().split(/\s+/);
  const initials =
    `${parts[0]?.[0] ?? ""}${parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : ""}`.toLocaleUpperCase(
      "vi",
    );
  return (
    <Link
      className={styles.person}
      href={`/admin/users/${person.id}`}
      title={person.fullName}
    >
      <span className={styles.avatar} data-second={second} aria-hidden="true">
        {initials}
      </span>
      <span>{person.fullName}</span>
    </Link>
  );
}
function PathCode({
  id,
  onFailure,
}: Readonly<{ id: string; onFailure: () => void }>) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(timer);
  }, [copied]);
  return (
    <div className={styles.pathCode}>
      <span title={id}>#{id.slice(0, 8).toUpperCase()}</span>
      <button
        type="button"
        className={styles.copy}
        aria-label={`Sao chép mã lộ trình ${id}`}
        title="Sao chép mã đầy đủ"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(id);
            setCopied(true);
          } catch {
            onFailure();
          }
        }}
      >
        {copied ? (
          <Icon name="check" size={16} />
        ) : (
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            aria-hidden="true"
          >
            <rect x="9" y="9" width="11" height="11" rx="2" />
            <path d="M15 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h3" />
          </svg>
        )}
      </button>
      <span className={styles.copied} role="status">
        {copied ? "Đã sao chép" : ""}
      </span>
    </div>
  );
}
function PathError({
  message,
  onRetry,
}: Readonly<{ message: string; onRetry?: () => void }>) {
  const dialog = useRef<HTMLDialogElement>(null);
  const id = useId();
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    const element = dialog.current;
    if (!element?.open) element?.showModal();
    return () => element?.close();
  }, []);
  if (dismissed) return null;
  return (
    <dialog
      ref={dialog}
      role="alertdialog"
      className={`dialog ${styles.errorDialog}`}
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-message`}
      onCancel={() => setDismissed(true)}
    >
      <div className="staff-dialog">
        <div className={styles.errorHeading}>
          <Icon name="warn" size={24} />
          <h2 id={`${id}-title`}>Chưa thể hoàn tất thao tác</h2>
        </div>
        <p id={`${id}-message`}>{message}</p>
        <div className="staff-dialog-actions">
          <button
            type="button"
            className="btn"
            onClick={() => setDismissed(true)}
          >
            Đóng
          </button>
          {onRetry && (
            <button type="button" className="btn btn-primary" onClick={onRetry}>
              Tải lại danh sách
            </button>
          )}
        </div>
      </div>
    </dialog>
  );
}

export function AdminLearningPaths({
  initialStatus = "",
  initialParticipantId = "",
}: Readonly<{ initialStatus?: string; initialParticipantId?: string }>) {
  const router = useRouter();
  const statusId = useId();
  const [status, setStatus] = useState(
    Object.hasOwn(statuses, initialStatus) ? initialStatus : "",
  );
  const [participantId, setParticipantId] = useState(initialParticipantId);
  const [draft, setDraft] = useState("");
  const [term, setTerm] = useState("");
  const [copyFailure, setCopyFailure] = useState(0);
  const params = new URLSearchParams({ limit: "20" });
  if (status) params.set("status", status);
  if (term) params.set("q", term);
  if (participantId) params.set("participantId", participantId);
  const list = useStaffListPages<Path>(`learning-paths?${params}`);
  const activeFilterCount = [status, participantId].filter(Boolean).length;
  function clearFilters() {
    setDraft("");
    setTerm("");
    setStatus("");
    setParticipantId("");
  }
  const failedCopy = () => setCopyFailure((value) => value + 1);

  return (
    <div className={styles.page}>
      <title>Lộ trình học · SkillHub</title>
      <header className={styles.heading}>
        <div>
          <h1>Lộ trình học</h1>
          <p>Tra cứu và theo dõi các thỏa thuận học tập trên hệ thống.</p>
        </div>
        <LoadingButton
          type="button"
          className={`btn ${styles.refresh}`}
          onClick={list.reload}
          disabled={list.loading}
          loading={list.loading}
        >
          <Icon name="refresh" size={18} />
          Làm mới
        </LoadingButton>
      </header>
      <section className={styles.panel} aria-label="Tra cứu lộ trình học">
        <AdminFilterPanel
          flush
          activeCount={activeFilterCount}
          onClear={clearFilters}
          lead={
            <div className={styles.search}>
              <Icon name="search" size={19} />
              <SearchInput
                value={draft}
                onChange={setDraft}
                maxLength={200}
                aria-label="Tìm kiếm lộ trình"
                aria-describedby={`${statusId}-hint`}
                placeholder="Tìm theo tên người tham gia hoặc mã lộ trình đầy đủ…"
                onSearch={(value) => {
                  if (
                    /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value)
                  )
                    router.push(`/admin/learning-paths/${value}`);
                  else setTerm(value);
                }}
              />
              {draft && (
                <button
                  type="button"
                  className={styles.clearSearch}
                  aria-label="Xóa từ khóa"
                  onClick={() => {
                    setDraft("");
                    setTerm("");
                  }}
                >
                  <Icon name="x" size={17} />
                </button>
              )}
            </div>
          }
        >
          <form
            className={filterPanelStyles.grid}
            onSubmit={(event) => {
              event.preventDefault();
              setParticipantId(
                String(
                  new FormData(event.currentTarget).get("participantId") ?? "",
                ).trim(),
              );
            }}
          >
            <label className={filterPanelStyles.field} htmlFor={statusId}>
              <span>Trạng thái lộ trình</span>
              <select
                id={statusId}
                value={status}
                onChange={(event) => setStatus(event.target.value)}
              >
                <option value="">Tất cả trạng thái</option>
                {Object.entries(statuses).map(([value, item]) => (
                  <option key={value} value={value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label className={filterPanelStyles.field}>
              <span>Mã người tham gia (UUID)</span>
              <input
                key={participantId}
                name="participantId"
                defaultValue={participantId}
                placeholder="Nhập mã UUID người tham gia…"
                pattern="[0-9a-fA-F]{8}(-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}"
              />
            </label>
            <div className={filterPanelStyles.footer}>
              <p className={filterPanelStyles.note} id={`${statusId}-hint`}>
                Dán mã UUID lộ trình vào ô tìm kiếm để mở chi tiết ngay.
              </p>
              <div className={filterPanelStyles.footerActions}>
                <button type="submit" className="btn btn-primary btn-sm">
                  Áp dụng
                </button>
                {activeFilterCount > 0 && (
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={clearFilters}
                  >
                    Xóa lọc
                  </button>
                )}
              </div>
            </div>
          </form>
        </AdminFilterPanel>
        <QueueState
          loading={list.loading}
          error={list.error}
          reload={list.reload}
          empty={!list.items.length}
          emptyTitle={
            draft || activeFilterCount > 0
              ? "Không tìm thấy lộ trình"
              : "Chưa có lộ trình học"
          }
          emptyDescription={
            draft || activeFilterCount > 0
              ? "Thử đổi tên người tham gia hoặc xóa bộ lọc trạng thái."
              : "Các thỏa thuận học tập sẽ xuất hiện tại đây khi được tạo."
          }
        >
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <caption className="sr-only">
                Danh sách lộ trình học và tình trạng hiện tại
              </caption>
              <thead>
                <tr>
                  <th scope="col">Lộ trình</th>
                  <th scope="col">Người tham gia</th>
                  <th scope="col">Trạng thái</th>
                  <th scope="col">Giai đoạn học</th>
                  <th scope="col">Cập nhật gần nhất</th>
                  <th scope="col">
                    <span className="sr-only">Thao tác</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {list.items.map((path) => (
                  <tr key={path.id}>
                    <td>
                      <PathCode id={path.id} onFailure={failedCopy} />
                      <small>Tạo ngày {fmtDate(path.createdAt)}</small>
                    </td>
                    <td>
                      <div className={styles.people}>
                        <Participant person={path.participantA} />
                        <Participant person={path.participantB} second />
                      </div>
                    </td>
                    <td>
                      <PathStatus value={path.status} />
                    </td>
                    <td>
                      <PathStage value={path.learningStage} />
                    </td>
                    <td>
                      <time
                        className={styles.updated}
                        dateTime={path.updatedAt}
                      >
                        {fmtDateTime(path.updatedAt)}
                      </time>
                    </td>
                    <td>
                      <Link
                        className={styles.view}
                        href={`/admin/learning-paths/${path.id}`}
                      >
                        Xem lộ trình
                        <Icon name="right" size={16} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className={styles.cards}>
            {list.items.map((path) => (
              <article className={styles.pathCard} key={path.id}>
                <div className={styles.cardTop}>
                  <PathCode id={path.id} onFailure={failedCopy} />
                  <PathStatus value={path.status} />
                </div>
                <div className={styles.people}>
                  <Participant person={path.participantA} />
                  <Participant person={path.participantB} second />
                </div>
                <dl className={styles.cardMeta}>
                  <div>
                    <dt>Giai đoạn học</dt>
                    <dd>
                      <PathStage value={path.learningStage} />
                    </dd>
                  </div>
                  <div>
                    <dt>Cập nhật gần nhất</dt>
                    <dd>
                      <time dateTime={path.updatedAt}>
                        {fmtDateTime(path.updatedAt)}
                      </time>
                    </dd>
                  </div>
                  <div>
                    <dt>Ngày tạo</dt>
                    <dd>{fmtDate(path.createdAt)}</dd>
                  </div>
                </dl>
                <Link
                  className={styles.cardAction}
                  href={`/admin/learning-paths/${path.id}`}
                >
                  Xem lộ trình
                  <Icon name="right" size={16} />
                </Link>
              </article>
            ))}
          </div>
        </QueueState>
        {(!list.loading || list.items.length > 0) && (
          <div className={styles.footer}>
            {list.items.length > 0 && (
              <span>{list.items.length} lộ trình trên trang này</span>
            )}
            <ListPagination query={list} />
          </div>
        )}
      </section>
      {(draft || activeFilterCount > 0) &&
        !list.loading &&
        !list.items.length &&
        !list.error && (
          <button
            type="button"
            className={`btn ${styles.emptyReset}`}
            onClick={clearFilters}
          >
            Xóa bộ lọc
          </button>
        )}
      {list.error && (
        <PathError
          key={`${list.scope}:${list.error}`}
          message={list.error}
          onRetry={() => {
            void list.reload();
          }}
        />
      )}
      {copyFailure > 0 && (
        <PathError
          key={`copy-${copyFailure}`}
          message="Không thể sao chép mã. Trình duyệt chưa cho phép truy cập bộ nhớ tạm. Bạn có thể chọn và sao chép mã đầy đủ trong trang chi tiết."
        />
      )}
    </div>
  );
}
