"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { SearchInput } from "@/components/search-input";
import { Badge, StatusBadge } from "@/components/console/ui";
import { severityTone } from "@/lib/staff/report-presentation";
import { fmtDateTime } from "@/lib/console/format";
import { systemCodeLabel } from "@/lib/system-text";
import {
  workKinds,
  workItemHref,
  type AdminWorkItem,
} from "@/lib/staff/dashboard";
import { useStaffResource } from "./hooks";
import { useStaffSession } from "./session";
import { Pager, QueueState } from "./common";
import { useDashboardList } from "./dashboard-data";
import { DashboardPanel, DashboardPerson } from "./dashboard-widgets";
import styles from "./dashboard.module.css";

function waitingTime(seconds: number) {
  if (seconds < 3600) return `${Math.floor(seconds / 60)} phút`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} giờ`;
  return `${Math.floor(seconds / 86400)} ngày`;
}
export function DashboardWork({ filter = "" }: Readonly<{ filter?: string }>) {
  const { actor } = useStaffSession();
  const [kind, setKind] = useState(
    Object.hasOwn(workKinds, filter) ? filter : "",
  );
  const [severity, setSeverity] = useState(
    filter === "CRITICAL" ? "CRITICAL" : "",
  );
  const [assignee, setAssignee] = useState(
    filter === "UNASSIGNED" ? "unassigned" : "",
  );
  const [age, setAge] = useState(filter === "OLDER_24" ? "24" : "");
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  const [selected, setSelected] = useState<AdminWorkItem>();
  const query = new URLSearchParams({ limit: "5", sort: "oldest" });
  if (kind) query.set("kind", kind);
  if (severity) query.set("severity", severity);
  if (age) query.set("minAgeHours", age);
  if (term) query.set("q", term);
  if (assignee === "unassigned") query.set("waitingOn", "ADMIN");
  if (assignee === "mine" && actor) query.set("assignee", actor.userId);
  const work = useDashboardList<AdminWorkItem>(`dashboard/work-items?${query}`);
  const active = Boolean(kind || severity || assignee || search || age);
  const clear = () => {
    setKind("");
    setSeverity("");
    setAssignee("");
    setSearch("");
    setTerm("");
    setAge("");
  };
  return (
    <div id="priority-list" tabIndex={-1}>
      <DashboardPanel
        title="Ưu tiên xử lý"
        description="Các việc cần chú ý theo mức độ và thời gian chờ."
        className={styles.workPanel}
        actions={
          <span className={styles.scopePill}>
            Toàn hệ thống · {work.items.length}
            {work.page?.hasMore ? "+" : ""} việc đã tải
          </span>
        }
      >
        <form
          className={`${styles.filters} ${styles.queueFilters}`}
          onSubmit={(event) => {
            event.preventDefault();
          }}
        >
          <label>
            <span>Loại việc</span>
            <select
              value={kind}
              onChange={(event) => setKind(event.target.value)}
            >
              <option value="">Tất cả</option>
              {Object.entries(workKinds).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Mức độ</span>
            <select
              value={severity}
              onChange={(event) => setSeverity(event.target.value)}
            >
              <option value="">Tất cả</option>
              <option value="CRITICAL">Khẩn cấp</option>
              <option value="HIGH">Cao</option>
              <option value="MEDIUM">Vừa</option>
              <option value="LOW">Thấp</option>
              <option value="UNCLASSIFIED">Chưa phân loại</option>
            </select>
          </label>
          <label>
            <span>Người phụ trách</span>
            <select
              value={assignee}
              onChange={(event) => setAssignee(event.target.value)}
            >
              <option value="">Tất cả</option>
              <option value="unassigned">Chưa phân công</option>
              <option value="mine">Tôi phụ trách</option>
            </select>
          </label>
          <label className={styles.searchField}>
            <span>Tìm công việc</span>
            <SearchInput
              maxLength={200}
              placeholder="Nội dung hoặc mã"
              value={search}
              onChange={setSearch}
              onSearch={setTerm}
            />
          </label>
          {active && (
            <button className={styles.textLink} type="button" onClick={clear}>
              Bỏ lọc
            </button>
          )}
        </form>
        {age && (
          <p className={styles.caption}>Đang lọc công việc chờ từ 24 giờ.</p>
        )}
        <QueueState
          loading={work.loading}
          error={work.error}
          empty={!work.items.length}
          reload={work.reload}
          emptyTitle="Không tìm thấy công việc phù hợp"
          emptyDescription="Thử thay đổi điều kiện lọc hoặc từ khóa tìm kiếm."
        >
          <div className={styles.tableScroll}>
            <table className={`${styles.table} ${styles.workTable}`}>
              <caption className="sr-only">Công việc cần xử lý</caption>
              <thead>
                <tr>
                  <th scope="col">Mức độ</th>
                  <th scope="col">Vụ việc</th>
                  <th scope="col">Trạng thái / chờ ai</th>
                  <th scope="col">Thời gian chờ</th>
                  <th scope="col">Người phụ trách</th>
                  <th scope="col">
                    <span className="sr-only">Chi tiết</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {work.items.map((item) => (
                  <tr key={`${item.kind}:${item.id}`}>
                    <td>
                      <Badge tone={severityTone(item.severity)}>
                        {systemCodeLabel(item.severity, "Chưa phân loại")}
                      </Badge>
                    </td>
                    <td>
                      <strong>{workKinds[item.kind]}</strong>
                      {item.kind === "TAG_REQUEST" && (
                        <small>{item.title}</small>
                      )}
                      <small>
                        #{item.id.slice(0, 8)} · {fmtDateTime(item.receivedAt)}
                      </small>
                      {item.reason && (
                        <small>
                          {/^[A-Z][A-Z0-9_]+$/.test(item.reason)
                            ? systemCodeLabel(
                                item.reason,
                                "Cần kiểm tra nội dung vụ việc",
                              )
                            : item.reason}
                        </small>
                      )}
                    </td>
                    <td>
                      <StatusBadge status={item.status} />
                      <small>
                        {item.waitingOn === "ASSIGNEE"
                          ? "Chờ người được phân công"
                          : "Chờ quản trị viên"}
                      </small>
                    </td>
                    <td>{waitingTime(item.ageSeconds)}</td>
                    <td>
                      {item.assignee ? (
                        <DashboardPerson id={item.assignee} />
                      ) : (
                        "Chưa phân công"
                      )}
                    </td>
                    <td>
                      <button
                        type="button"
                        className={styles.textLink}
                        onClick={() => setSelected(item)}
                        aria-label={`Xem ${workKinds[item.kind]} #${item.id.slice(0, 8)}`}
                      >
                        Xem chi tiết →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager
            loading={work.loading}
            hasMore={work.page?.hasMore}
            more={work.more}
          />
        </QueueState>
        {selected && (
          <WorkDetail
            key={`${selected.kind}:${selected.id}`}
            item={selected}
            onClose={() => setSelected(undefined)}
          />
        )}
      </DashboardPanel>
    </div>
  );
}

type WorkDetailData = {
  status?: string;
  resolutionNote?: string | null;
  resolvedAt?: string | null;
};
function WorkDetail({
  item,
  onClose,
}: Readonly<{ item: AdminWorkItem; onClose: () => void }>) {
  const dialog = useRef<HTMLDialogElement>(null);
  const detail = useStaffResource<WorkDetailData>(
    `dashboard/work-items/${item.kind}/${item.id}`,
  );
  useEffect(() => {
    const node = dialog.current;
    node?.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      node?.close();
      document.body.style.overflow = overflow;
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className={styles.drawer}
      aria-label="Chi tiết công việc"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <header className={styles.drawerHeader}>
        <div>
          <p className={styles.eyebrow}>Công việc cần xử lý</p>
          <h2>{workKinds[item.kind]}</h2>
        </div>
        <button
          type="button"
          className="btn"
          onClick={onClose}
          aria-label="Đóng chi tiết"
        >
          Đóng
        </button>
      </header>
      <div className={styles.drawerBody}>
        <QueueState
          loading={detail.loading}
          error={detail.error}
          reload={detail.reload}
          empty={!detail.data}
        >
          <StatusBadge status={detail.data?.status ?? item.status} />
          <dl className={styles.facts}>
            <dt>Tiếp nhận</dt>
            <dd>{fmtDateTime(item.receivedAt)}</dd>
            <dt>Thời gian chờ</dt>
            <dd>{waitingTime(item.ageSeconds)} tại lúc tải hàng đợi</dd>
            <dt>Phụ trách</dt>
            <dd>
              {item.assignee ? (
                <Link href={`/admin/users/${item.assignee}`}>
                  Xem người phụ trách
                </Link>
              ) : (
                "Chưa được phân công"
              )}
            </dd>
            <dt>Đang chờ</dt>
            <dd>
              {item.waitingOn === "ASSIGNEE"
                ? "Nhân sự phụ trách"
                : "Quản trị viên"}
            </dd>
            {item.reason && (
              <>
                <dt>Lý do</dt>
                <dd>{systemCodeLabel(item.reason, "Cần kiểm tra vụ việc")}</dd>
              </>
            )}
            {detail.data?.resolvedAt && (
              <>
                <dt>Đã xử lý lúc</dt>
                <dd>{fmtDateTime(detail.data.resolvedAt)}</dd>
              </>
            )}
          </dl>
          {detail.data?.resolutionNote && <p>{detail.data.resolutionNote}</p>}
          {item.related.pathId && (
            <Link href={`/admin/learning-paths/${item.related.pathId}`}>
              Xem lộ trình liên quan →
            </Link>
          )}
          <p className={styles.notice}>
            Mở màn hình nghiệp vụ để xem đầy đủ nội dung, bằng chứng và thực
            hiện thao tác theo quyền của bạn.
          </p>
          <Link className="btn btn-primary" href={workItemHref(item)}>
            Mở màn hình xử lý →
          </Link>
          <details>
            <summary>Mã tham chiếu</summary>
            <code>{item.id}</code>
          </details>
        </QueueState>
      </div>
    </dialog>
  );
}
