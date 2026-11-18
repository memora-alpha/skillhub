"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { Icon } from "@/components/console/icon";
import { StatusBadge } from "@/components/console/ui";
import { LoadingButton } from "@/components/loading-button";
import { SearchInput } from "@/components/search-input";
import { fmtDateTime } from "@/lib/console/format";
import {
  activePathVersion,
  adminPathCredit,
  attendanceDuration,
  attendanceLabel,
  exchangeLabel,
  occurrenceAttendance,
  sessionPlan,
  sessionStatusLabels,
  settlementAttemptText,
  type AdminPathDetail,
  type PathAttendance,
  type PathPerson,
  type PathSession,
} from "@/lib/staff/admin-learning-path";
import { emptyLedgerFilters, ledgerHref } from "@/lib/staff/ledger-query";
import { systemCodeLabel } from "@/lib/system-text";
import { QueueState } from "./common";
import { useStaffResource } from "./hooks";
import styles from "./admin-learning-path-detail.module.css";

function Person({
  person,
  second = false,
}: Readonly<{ person: PathPerson; second?: boolean }>) {
  const words = person.fullName.trim().split(/\s+/);
  const initials =
    `${words[0]?.[0] ?? ""}${words.length > 1 ? (words.at(-1)?.[0] ?? "") : ""}`.toLocaleUpperCase(
      "vi",
    );
  return (
    <Link className={styles.person} href={`/admin/users/${person.id}`}>
      <span className={styles.avatar} data-second={second} aria-hidden="true">
        {initials}
      </span>
      <span>
        <small>Người tham gia</small>
        <strong>{person.fullName}</strong>
      </span>
      <Icon name="right" size={16} />
    </Link>
  );
}

function Outcome({ outcome }: Readonly<{ outcome?: PathAttendance }>) {
  return (
    <div className={styles.outcome}>
      <span>Kết quả điểm danh</span>
      <strong>
        {outcome
          ? `${attendanceLabel(outcome.attendanceCase)} · ${attendanceLabel(outcome.status)}`
          : "Chưa có kết quả cho lịch hiện tại"}
      </strong>
      {outcome?.resolution && (
        <small>{attendanceLabel(outcome.resolution)}</small>
      )}
    </div>
  );
}

function SessionCard({
  session,
  path,
}: Readonly<{ session: PathSession; path: AdminPathDetail }>) {
  const name = (id: string) =>
    path.participants.find((person) => person.id === id)?.fullName ??
    "Người tham gia";
  const plan = sessionPlan(path, session);
  const outcome = occurrenceAttendance(session);
  const previous = session.attendanceOutcomes
    .filter((item) => item !== outcome)
    .sort(
      (a, b) =>
        Date.parse(b.occurrenceStartAt) - Date.parse(a.occurrenceStartAt),
    );
  const status = Object.hasOwn(sessionStatusLabels, session.status)
    ? session.status
    : "UNKNOWN";
  return (
    <article className={styles.session}>
      <div className={styles.sessionMain}>
        <div className={styles.sessionIdentity}>
          <span>Buổi {session.outlineSessionNo}</span>
          <strong>
            {plan?.planVersionRecord.skillIdRecord.name ?? "Buổi học"}
          </strong>
        </div>
        <div className={styles.roles}>
          <div>
            <small>Người dạy</small>
            <strong>{name(session.teacherId)}</strong>
          </div>
          <Icon name="right" size={15} />
          <div>
            <small>Người học</small>
            <strong>{name(session.learnerId)}</strong>
          </div>
        </div>
        <div className={styles.sessionTime}>
          <time dateTime={session.startAt}>{fmtDateTime(session.startAt)}</time>
          <small>Đến {fmtDateTime(session.endAt)}</small>
        </div>
        <span className={styles.sessionBadge} data-status={status}>
          {sessionStatusLabels[status] ?? "Chưa xác định trạng thái"}
        </span>
      </div>
      <details className={styles.attendance}>
        <summary>
          Chi tiết điểm danh
          <Icon name="down" size={15} />
        </summary>
        <div className={styles.attendancePanel}>
          {[
            {
              role: "Người dạy",
              id: session.teacherId,
              joined: session.teacherFirstJoinedAt,
              seconds: session.teacherAttendanceSeconds,
            },
            {
              role: "Người học",
              id: session.learnerId,
              joined: session.learnerFirstJoinedAt,
              seconds: session.learnerAttendanceSeconds,
            },
          ].map((person) => (
            <div className={styles.attendancePerson} key={person.role}>
              <small>{person.role}</small>
              <strong>{name(person.id)}</strong>
              <dl>
                <div>
                  <dt>Vào lần đầu</dt>
                  <dd>
                    {person.joined
                      ? fmtDateTime(person.joined)
                      : "Chưa ghi nhận thời điểm tham gia"}
                  </dd>
                </div>
                <div>
                  <dt>Thời gian tham gia</dt>
                  <dd>{attendanceDuration(person.seconds)}</dd>
                </div>
              </dl>
            </div>
          ))}
          <div className={styles.currentOutcome}>
            <span className={styles.fieldLabel}>Lịch hiện tại</span>
            <Outcome outcome={outcome} />
          </div>
          {previous.length > 0 && (
            <details className={styles.previousOutcomes}>
              <summary>Kết quả các lịch trước ({previous.length})</summary>
              {previous.map((item) => (
                <div key={item.occurrenceStartAt}>
                  <p>{fmtDateTime(item.occurrenceStartAt)}</p>
                  <Outcome outcome={item} />
                </div>
              ))}
            </details>
          )}
        </div>
      </details>
    </article>
  );
}

function Content({ path }: Readonly<{ path: AdminPathDetail }>) {
  const active = activePathVersion(path);
  const activeNo = path.lockedVersion ?? path.currentVersion;
  const [chosenVersion, setChosenVersion] = useState<number | null>(null);
  const selectedNo =
    chosenVersion !== null &&
    path.versions.some((version) => version.versionNo === chosenVersion)
      ? chosenVersion
      : activeNo;
  const selected = path.versions.find(
    (version) => version.versionNo === selectedNo,
  );
  const [draft, setDraft] = useState("");
  const [term, setTerm] = useState("");
  const [status, setStatus] = useState("");
  const inputId = useId();
  const skills = [
    ...new Set(
      active?.pathVersionPlanPathVersionRecords.map(
        (plan) => plan.planVersionRecord.skillIdRecord.name,
      ) ?? [],
    ),
  ];
  const normalized = term.toLocaleLowerCase("vi");
  const sessions = [...path.sessions]
    .sort(
      (a, b) =>
        Date.parse(a.startAt) - Date.parse(b.startAt) ||
        a.id.localeCompare(b.id),
    )
    .filter((session) => {
      const skill =
        sessionPlan(path, session)?.planVersionRecord.skillIdRecord.name ?? "";
      const names = [session.teacherId, session.learnerId].map(
        (id) =>
          path.participants.find((person) => person.id === id)?.fullName ?? "",
      );
      return (
        (!status || session.status === status) &&
        (!normalized ||
          [skill, ...names].some((value) =>
            value.toLocaleLowerCase("vi").includes(normalized),
          ))
      );
    });
  function reset() {
    setDraft("");
    setTerm("");
    setStatus("");
  }
  return (
    <>
      <nav
        className={styles.sectionNav}
        aria-label="Điều hướng chi tiết lộ trình"
      >
        <a href="#path-agreement">Thỏa thuận</a>
        <a href="#path-sessions">Buổi học</a>
        <a href="#path-settlement">Quyết toán</a>
        <a href="#path-cases">Vụ việc</a>
      </nav>
      <section
        className={styles.overview}
        id="path-agreement"
        aria-labelledby={`${inputId}-agreement`}
      >
        <div className={styles.overviewTitle}>
          <span className={styles.sectionIcon}>
            <Icon name="book" size={22} />
          </span>
          <div>
            <span className={styles.fieldLabel}>Thỏa thuận học tập</span>
            <h2 id={`${inputId}-agreement`}>
              {skills.join(" · ") || "Thỏa thuận học tập"}
            </h2>
          </div>
          <StatusBadge status={path.status} />
        </div>
        <div className={styles.overviewGrid}>
          <div>
            <span className={styles.fieldLabel}>Người tham gia</span>
            <div className={styles.participants}>
              {path.participants.map((person, index) => (
                <Person key={person.id} person={person} second={index > 0} />
              ))}
            </div>
          </div>
          <dl className={styles.facts}>
            <div>
              <dt>Kiểu trao đổi đang dùng</dt>
              <dd>{exchangeLabel(active?.exchangeType)}</dd>
            </div>
            <div>
              <dt>Phiên bản hiện tại</dt>
              <dd>Phiên bản {path.currentVersion}</dd>
            </div>
            <div>
              <dt>Phiên bản đã chốt</dt>
              <dd>
                {path.lockedVersion === null
                  ? "Chưa chốt"
                  : `Phiên bản ${path.lockedVersion}`}
              </dd>
            </div>
            <div>
              <dt>Ngày tạo</dt>
              <dd>{fmtDateTime(path.createdAt)}</dd>
            </div>
            {path.completedAt && (
              <div>
                <dt>Hoàn thành</dt>
                <dd>{fmtDateTime(path.completedAt)}</dd>
              </div>
            )}
          </dl>
        </div>
        <div className={styles.plansHeading}>
          <h3>Nội dung thỏa thuận</h3>
          {path.versions.length > 0 && (
            <div className={styles.versionPicker}>
              <label htmlFor={`${inputId}-version`}>Phiên bản</label>
              <select
                id={`${inputId}-version`}
                value={selectedNo}
                onChange={(event) =>
                  setChosenVersion(Number(event.target.value))
                }
              >
                {!active && (
                  <option value={activeNo}>
                    Phiên bản {activeNo} · Chưa có dữ liệu
                  </option>
                )}
                {[...path.versions]
                  .sort((a, b) => b.versionNo - a.versionNo)
                  .map((version) => (
                    <option key={version.versionNo} value={version.versionNo}>
                      Phiên bản {version.versionNo} ·{" "}
                      {version.versionNo === activeNo ? "Đang dùng" : "Lịch sử"}
                    </option>
                  ))}
              </select>
            </div>
          )}
        </div>
        {selectedNo !== activeNo && (
          <p className={styles.historyNote}>
            <Icon name="info" size={18} />
            Đang xem thỏa thuận phiên bản {selectedNo}. Buổi học và quyết toán
            bên dưới vẫn là dữ liệu hiện tại.
          </p>
        )}
        {selected && (
          <p className={styles.versionMeta}>
            {exchangeLabel(selected.exchangeType)} · Tạo{" "}
            {fmtDateTime(selected.createdAt)}
          </p>
        )}
        {selected?.pathVersionPlanPathVersionRecords.length ? (
          <div className={styles.plans}>
            {selected.pathVersionPlanPathVersionRecords.map((plan, index) => (
              <article key={`${plan.planId}:${plan.planVersion}`}>
                <div>
                  <span className={styles.planNumber}>
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className={styles.fieldLabel}>Kỹ năng</span>
                </div>
                <h4>{plan.planVersionRecord.skillIdRecord.name}</h4>
                <p>{plan.planVersionRecord.learningGoal}</p>
                <strong>
                  {plan.planVersionRecord.totalSessions} buổi theo kế hoạch
                </strong>
              </article>
            ))}
          </div>
        ) : (
          <p className={styles.empty}>
            {selected
              ? "Phiên bản này chưa có kế hoạch học tập."
              : "Chưa có dữ liệu phiên bản thỏa thuận đang dùng."}
          </p>
        )}
      </section>
      <div className={styles.columns}>
        <section
          className={styles.sessionsCard}
          id="path-sessions"
          aria-labelledby={`${inputId}-sessions`}
        >
          <header className={styles.cardHead}>
            <h2 id={`${inputId}-sessions`}>Buổi học</h2>
            <p>
              {sessions.length} buổi đang hiển thị
              {draft || status
                ? ` / ${path.sessions.length} buổi đã tải`
                : " trong dữ liệu đã tải"}
            </p>
          </header>
          <div className={styles.sessionToolbar}>
            <div className={styles.search}>
              <Icon name="search" size={17} />
              <SearchInput
                value={draft}
                onChange={setDraft}
                onSearch={setTerm}
                maxLength={200}
                placeholder="Tìm người hoặc kỹ năng"
                aria-label="Tìm buổi học theo người hoặc kỹ năng"
              />
              {draft && (
                <button
                  type="button"
                  aria-label="Xóa tìm kiếm buổi học"
                  onClick={() => {
                    setDraft("");
                    setTerm("");
                  }}
                >
                  <Icon name="x" size={16} />
                </button>
              )}
            </div>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              aria-label="Lọc trạng thái buổi học"
            >
              <option value="">Tất cả trạng thái</option>
              {Object.entries(sessionStatusLabels).map(([code, label]) => (
                <option key={code} value={code}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.sessionList}>
            {sessions.length ? (
              sessions.map((session) => (
                <SessionCard key={session.id} path={path} session={session} />
              ))
            ) : (
              <div className={styles.empty}>
                <Icon name="calendar" size={25} />
                <strong>
                  {path.sessions.length
                    ? "Không có buổi học phù hợp"
                    : "Lộ trình chưa có buổi học đã chốt"}
                </strong>
                {(draft || status) && (
                  <button type="button" className="btn" onClick={reset}>
                    Xóa bộ lọc buổi học
                  </button>
                )}
              </div>
            )}
          </div>
        </section>
        <aside className={styles.side}>
          <section
            className={styles.sideCard}
            id="path-settlement"
            aria-labelledby={`${inputId}-settlement`}
          >
            <div className={styles.sideTitle}>
              <span className={styles.sectionIcon}>
                <Icon name="card" size={20} />
              </span>
              <div>
                <h2 id={`${inputId}-settlement`}>Quyết toán Credit</h2>
                <p>Thông tin tài chính của lộ trình</p>
              </div>
            </div>
            <div
              className={styles.settlementState}
              data-settled={!!path.settlement.settledAt}
            >
              <strong>
                {path.settlement.settledAt
                  ? "Đã quyết toán"
                  : "Chưa ghi nhận quyết toán"}
              </strong>
              {path.settlement.settledAt && (
                <small>{fmtDateTime(path.settlement.settledAt)}</small>
              )}
            </div>
            <dl className={styles.money}>
              <div>
                <dt>Credit mỗi người theo thỏa thuận</dt>
                <dd>{adminPathCredit(active?.totalCreditPerUser ?? null)}</dd>
              </div>
              {active?.negotiatedCredit !== null &&
                active?.negotiatedCredit !== undefined && (
                  <div>
                    <dt>Credit thương lượng</dt>
                    <dd>{adminPathCredit(active.negotiatedCredit)}</dd>
                  </div>
                )}
              <div>
                <dt>Credit gốc quyết toán</dt>
                <dd>{adminPathCredit(path.settlement.grossCredit)}</dd>
              </div>
              <div>
                <dt>Phí nền tảng</dt>
                <dd>{adminPathCredit(path.settlement.feeCredit)}</dd>
              </div>
              {path.settlement.settledPathVersion !== null && (
                <div>
                  <dt>Phiên bản quyết toán</dt>
                  <dd>{path.settlement.settledPathVersion}</dd>
                </div>
              )}
            </dl>
            {path.settlement.attempt ? (
              <div
                className={styles.attempt}
                data-settled={path.settlement.attempt.outcome === "SETTLED"}
              >
                <span>
                  Lần kiểm tra thứ {path.settlement.attempt.attemptCount} ·{" "}
                  {fmtDateTime(path.settlement.attempt.checkedAt)}
                </span>
                <strong>
                  {settlementAttemptText(path.settlement.attempt)}
                </strong>
              </div>
            ) : (
              <p className={styles.muted}>
                Chưa ghi nhận lần kiểm tra quyết toán.
              </p>
            )}
            <Link
              className={styles.outlineAction}
              href={ledgerHref({
                ...emptyLedgerFilters,
                referenceType: "LEARNING_PATH",
                referenceId: path.id,
              })}
            >
              Xem giao dịch của lộ trình
              <Icon name="right" size={16} />
            </Link>
          </section>
          <section
            className={styles.sideCard}
            id="path-cases"
            aria-labelledby={`${inputId}-cases`}
          >
            <div className={styles.sideTitle}>
              <span className={styles.sectionIcon}>
                <Icon name="flag" size={20} />
              </span>
              <div>
                <h2 id={`${inputId}-cases`}>Vụ việc liên quan</h2>
                <p>Báo cáo và yêu cầu dừng</p>
              </div>
            </div>
            <div className={styles.caseGroup}>
              <h3>
                Báo cáo & tranh chấp<span>{path.reports.length}</span>
              </h3>
              {path.reports.map((report) => (
                <article className={styles.caseItem} key={report.id}>
                  <div>
                    <code>#{report.id.slice(0, 8)}</code>
                    <StatusBadge status={report.status} />
                  </div>
                  <strong>
                    {systemCodeLabel(report.reasonCode, "Báo cáo cần xem xét")}
                  </strong>
                  {report.severity && (
                    <small>
                      Mức độ:{" "}
                      {report.severity === "LOW"
                        ? "Thấp"
                        : report.severity === "MEDIUM"
                          ? "Trung bình"
                          : report.severity === "HIGH"
                            ? "Cao"
                            : report.severity === "CRITICAL"
                              ? "Khẩn cấp"
                              : "Chưa phân loại"}
                    </small>
                  )}
                  {report.createdAt && (
                    <small>{fmtDateTime(report.createdAt)}</small>
                  )}
                  <Link href={`/admin/disputes/${report.id}`}>
                    Mở báo cáo
                    <Icon name="right" size={15} />
                  </Link>
                </article>
              ))}
              {!path.reports.length && (
                <p className={styles.muted}>Không có báo cáo liên quan.</p>
              )}
            </div>
            <div className={styles.caseGroup}>
              <h3>
                Yêu cầu dừng lộ trình<span>{path.terminations.length}</span>
              </h3>
              {path.terminations.map((request) => (
                <article className={styles.caseItem} key={request.id}>
                  <div>
                    <code>#{request.id.slice(0, 8)}</code>
                    <StatusBadge status={request.status} />
                  </div>
                  <strong>Yêu cầu dừng lộ trình</strong>
                  <small>
                    Tạo {fmtDateTime(request.createdAt)} · Bản ghi{" "}
                    {request.version}
                  </small>
                  {request.closedAt && (
                    <small>Đóng {fmtDateTime(request.closedAt)}</small>
                  )}
                  <Link
                    href={`/admin/learning-changes?pathId=${encodeURIComponent(path.id)}&requestId=${encodeURIComponent(request.id)}`}
                  >
                    Xem yêu cầu
                    <Icon name="right" size={15} />
                  </Link>
                </article>
              ))}
              {!path.terminations.length && (
                <p className={styles.muted}>Không có yêu cầu dừng lộ trình.</p>
              )}
            </div>
          </section>
        </aside>
      </div>
    </>
  );
}

function ErrorModal({
  message,
  retry,
}: Readonly<{ message: string; retry?: () => void }>) {
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
      className={`dialog ${styles.errorDialog}`}
      role="alertdialog"
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-message`}
      onCancel={() => setDismissed(true)}
    >
      <div className="staff-dialog">
        <h2 id={`${id}-title`}>Chưa thể hoàn tất thao tác</h2>
        <p id={`${id}-message`}>{message}</p>
        <div className="staff-dialog-actions">
          <button
            type="button"
            className="btn"
            onClick={() => setDismissed(true)}
          >
            Đóng
          </button>
          {retry && (
            <button type="button" className="btn btn-primary" onClick={retry}>
              Thử lại
            </button>
          )}
        </div>
      </div>
    </dialog>
  );
}

export function AdminLearningPathDetail({ id }: Readonly<{ id: string }>) {
  const query = useStaffResource<AdminPathDetail>(`learning-paths/${id}`, {
    retainOnReload: true,
  });
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(0);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);
  return (
    <div className={styles.page}>
      <title>Chi tiết lộ trình · SkillHub</title>
      <nav className={styles.breadcrumb} aria-label="Đường dẫn chi tiết">
        <Link href="/admin/learning-paths">Lộ trình học</Link>
        <Icon name="right" size={14} />
        <strong>Chi tiết</strong>
      </nav>
      <header className={styles.heading}>
        <div>
          <h1>Chi tiết lộ trình</h1>
          <div className={styles.identifier}>
            <code title={id}>#{id.slice(0, 8).toUpperCase()}</code>
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(id);
                  setCopied(true);
                } catch {
                  setCopyError((value) => value + 1);
                }
              }}
            >
              <Icon name={copied ? "check" : "clip"} size={15} />
              Sao chép mã
            </button>
            <span role="status">{copied ? "Đã sao chép" : ""}</span>
            {query.data && (
              <small>Cập nhật {fmtDateTime(query.data.updatedAt)}</small>
            )}
          </div>
        </div>
        <LoadingButton
          type="button"
          className={`btn ${styles.refresh}`}
          loading={query.loading}
          disabled={query.loading}
          onClick={query.reload}
        >
          <Icon name="refresh" size={18} />
          Làm mới
        </LoadingButton>
      </header>
      <QueueState
        loading={query.loading}
        error={query.error}
        reload={query.reload}
        empty={!query.data}
        emptyTitle="Chưa có dữ liệu lộ trình"
        emptyDescription="Quay lại danh sách hoặc tải lại để kiểm tra."
      >
        {query.data && <Content key={query.data.id} path={query.data} />}
      </QueueState>
      <Link className={styles.backLink} href="/admin/learning-paths">
        ← Danh sách lộ trình
      </Link>
      {query.error && (
        <ErrorModal
          key={`${id}:${query.error}`}
          message={query.error}
          retry={() => {
            void query.reload();
          }}
        />
      )}
      {copyError > 0 && (
        <ErrorModal
          key={`copy-${copyError}`}
          message="Trình duyệt chưa cho phép sao chép. Mở mã đầy đủ bên dưới để chọn và sao chép thủ công."
        />
      )}
      <details className={styles.fullId}>
        <summary>Mã lộ trình đầy đủ</summary>
        <code>{id}</code>
      </details>
    </div>
  );
}
