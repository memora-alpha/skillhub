"use client";
import { UserProfileReference } from "./user-profile-reference";
import { LoadingButton } from "@/components/loading-button";
import { LoadingSkeleton } from "@/components/loading-skeleton";
import { systemCodeLabel } from "@/lib/system-text";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useStaffSession } from "./session";
import { StaffApiError } from "@/lib/staff/client";
import { hasPermission } from "@/lib/staff/permissions";
import {
  sameExecution,
  readTerminationChange,
  readTerminationReview,
  terminationDecision,
  type AllocationDecision,
  type TerminationChange,
  type TerminationDecision,
  type TerminationReview,
} from "@/lib/staff/termination";
import { QueueState } from "./common";
import {
  Badge,
  Card,
  DataTable,
  PageHeader,
  StatusBadge,
} from "@/components/console/ui";
import { AdminDrawer, AdminField, AdminNotice, RecordId } from "./admin-ui";
import { financeNumber } from "@/lib/staff/finance-presentation";
import { fmtDateTime } from "@/lib/console/format";
import {
  splitPages,
  useListPages,
} from "@/components/pagination/use-list-pages";
import { ListPagination } from "@/components/pagination/list-pagination";
const text = (cause: unknown) =>
  cause instanceof Error
    ? cause.message
    : "Không thể đọc kết quả. Vui lòng tải lại.";
type TerminationTarget = Pick<TerminationChange, "id" | "pathId">;
type InitialTermination = Readonly<{
  initialRequestId?: string;
  initialPathId?: string;
}>;
const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
export function TerminationsScreen(props: InitialTermination) {
  const { actor } = useStaffSession();
  return actor ? (
    <TerminationQueue
      key={`${actor.userId}:${props.initialRequestId ?? ""}:${props.initialPathId ?? ""}`}
      {...props}
    />
  ) : null;
}
function TerminationQueue({
  initialRequestId,
  initialPathId,
}: InitialTermination) {
  const { api, portal } = useStaffSession();
  const [rows, setRows] = useState<TerminationChange[]>([]),
    [cursor, setCursor] = useState<string | null>(null),
    [selected, setSelected] = useState<TerminationTarget | null>(() =>
      initialRequestId &&
      initialPathId &&
      uuid.test(initialRequestId) &&
      uuid.test(initialPathId)
        ? { id: initialRequestId, pathId: initialPathId }
        : null,
    ),
    [loading, setLoading] = useState(true),
    [error, setError] = useState<string>();
  const flight = useRef(false),
    seen = useRef(new Set<string>()),
    alive = useRef(true);
  const load = useCallback(
    (after?: string) => {
      if (flight.current) return;
      flight.current = true;
      return api<{
        items: TerminationChange[];
        nextCursor: string | null;
      }>(
        "learning-changes/review-queue?limit=20" +
          (after ? "&after=" + encodeURIComponent(after) : ""),
      )
        .then(({ data }) => {
          if (!alive.current) return;
          if (
            !Array.isArray(data.items) ||
            (data.nextCursor !== null && typeof data.nextCursor !== "string") ||
            data.items.some((item) => item.kind !== "PATH_TERMINATION")
          )
            throw new Error("Hàng đợi chưa hợp lệ.");
          const items = data.items.map(readTerminationChange);
          if (!after) seen.current.clear();
          if (after) seen.current.add(after);
          setRows((old) => [
            ...new Map(
              [...(after ? old : []), ...items].map((row) => [row.id, row]),
            ).values(),
          ]);
          setCursor(
            data.nextCursor && !seen.current.has(data.nextCursor)
              ? data.nextCursor
              : null,
          );
        })
        .catch((cause: unknown) => {
          if (alive.current) {
            setError(text(cause));
            if (
              cause instanceof StaffApiError &&
              [401, 403, 404].includes(cause.status)
            ) {
              setRows([]);
              setSelected(null);
            }
          }
        })
        .finally(() => {
          flight.current = false;
          if (alive.current) setLoading(false);
        });
    },
    [api],
  );
  function startLoad(after?: string) {
    setLoading(true);
    setError(undefined);
    void load(after);
  }
  const pagination = useListPages({
    scope: `terminations:${portal}`,
    chunks: splitPages(rows),
    loading,
    error,
    hasMore: !!cursor,
    more: () => startLoad(cursor ?? undefined),
    reload: () => startLoad(),
  });
  useEffect(() => {
    alive.current = true;
    void load();
    return () => {
      alive.current = false;
    };
  }, [load]);
  return (
    <>
      <PageHeader
        title="Dừng lộ trình"
        desc="Xem yêu cầu, Held và chính sách trước khi quyết định. Không tự chia Credit theo số buổi."
        actions={
          <LoadingButton
            type="button"
            className="btn"
            disabled={loading}
            onClick={() => void pagination.reload()}
            loading={!!loading}
          >
            Làm mới hàng đợi
          </LoadingButton>
        }
      />
      {(initialRequestId || initialPathId) &&
        (!initialRequestId ||
          !initialPathId ||
          !uuid.test(initialRequestId) ||
          !uuid.test(initialPathId)) && (
          <p role="alert" className="staff-error">
            Liên kết cần mã yêu cầu và mã lộ trình hợp lệ. Chọn yêu cầu trong
            hàng đợi để xem xét.
          </p>
        )}
      <AdminNotice tone="warn">
        <strong>Phương án phân bổ Credit là dữ liệu chỉ đọc.</strong>
        <p>
          Số tiền hoàn lại, trả đối tác và phí nền tảng được máy chủ tính tự
          động từ các kết quả điểm danh đã ghi nhận.
        </p>
      </AdminNotice>
      <QueueState
        loading={loading}
        error={error}
        empty={!rows.length}
        reload={() => void pagination.reload()}
      >
        <Card title="Hàng đợi yêu cầu dừng lộ trình" flush>
          <DataTable
            columns={[
              "Yêu cầu",
              "Lộ trình / Người yêu cầu",
              "Lý do",
              "Trạng thái",
              "Thao tác",
            ]}
            className="table admin-responsive-table admin-termination-table"
          >
            {pagination.items.map((row) => (
              <tr key={row.id}>
                <td data-label="Yêu cầu">
                  <RecordId id={row.id} label="yêu cầu" />
                  <small>{fmtDateTime(row.createdAt)}</small>
                </td>
                <td data-label="Lộ trình / Người yêu cầu">
                  <RecordId id={row.pathId} label="lộ trình" />
                  <small>
                    Người yêu cầu:{" "}
                    <UserProfileReference
                      userId={row.requesterId}
                      label="người yêu cầu"
                    />
                  </small>
                </td>
                <td data-label="Lý do">
                  <p className="admin-clamp">{row.reason}</p>
                </td>
                <td data-label="Trạng thái">
                  <StatusBadge status={row.status} />
                  <div className="admin-termination-flags">
                    {row.blockedByDispute && (
                      <Badge tone="bad">Có tranh chấp</Badge>
                    )}
                    {row.awaitingPolicy && (
                      <Badge tone="warn">Chờ chính sách</Badge>
                    )}
                  </div>
                </td>
                <td data-label="Thao tác">
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => setSelected(row)}
                  >
                    Xem xét yêu cầu
                  </button>
                </td>
              </tr>
            ))}
          </DataTable>
        </Card>
      </QueueState>
      <ListPagination query={pagination} />
      {selected && (
        <TerminationDetail
          key={selected.id}
          row={selected}
          close={() => {
            setSelected(null);
            void pagination.reload();
          }}
        />
      )}
    </>
  );
}
function TerminationDetail({
  row,
  close,
}: Readonly<{
  row: TerminationTarget;
  close: () => void;
}>) {
  const { api, actor } = useStaffSession();
  const [review, setReview] = useState<TerminationReview>(),
    [amounts, setAmounts] = useState<AllocationDecision[]>([]),
    [reason, setReason] = useState("");
  const [intent, setIntent] = useState<TerminationDecision>(),
    [error, setError] = useState<string>(),
    [busy, setBusy] = useState(true),
    [unknown, setUnknown] = useState(false),
    [success, setSuccess] = useState<string>();
  const [rejecting, setRejecting] = useState(false);
  const flight = useRef(false),
    alive = useRef(true);
  const base =
    "learning-paths/" + row.pathId + "/termination-requests/" + row.id;
  const read = useCallback(async () => {
    const result = await api<unknown>(base + "/review");
    const data = readTerminationReview(result.data);
    if (
      data.id !== row.id ||
      data.pathId !== row.pathId ||
      !data.execution ||
      !Array.isArray(data.execution.allocations)
    )
      throw new Error("Chi tiết xem xét chưa hợp lệ.");
    return data;
  }, [api, base, row.id, row.pathId]);
  const reload = useCallback(() => {
    if (flight.current) return;
    flight.current = true;
    return read()
      .then((current) => {
        if (!alive.current) return;
        setReview(current);
        setRejecting(false);
        setIntent(undefined);
        setUnknown(false);
        setAmounts(
          current.execution.quote.allocations.map((a) => ({
            allocationId: a.allocationId,
            refund: a.refund,
            counterpartyPayment: a.counterpartyPayment,
            platformFee: a.platformFee,
          })),
        );
        if (current.status === "APPLIED" || current.status === "REJECTED")
          setSuccess("Máy chủ xác nhận: " + systemCodeLabel(current.status));
      })
      .catch((cause: unknown) => {
        if (alive.current) {
          setReview(undefined);
          setError(text(cause));
        }
      })
      .finally(() => {
        flight.current = false;
        if (alive.current) setBusy(false);
      });
  }, [read]);
  useEffect(() => {
    alive.current = true;
    void reload();
    return () => {
      alive.current = false;
    };
  }, [reload]);
  async function execute() {
    if (!intent || !review || flight.current) return;
    flight.current = true;
    setBusy(true);
    setError(undefined);
    try {
      const current = await read();
      // A lost response may have committed; replay exactly the reviewed body only.
      if (
        !(unknown && current.status === "APPLIED") &&
        !sameExecution(review, current)
      )
        throw new Error(
          "Dữ liệu hoặc tranh chấp đã thay đổi. Tải lại chi tiết và lập phương án mới.",
        );
      const response = await api<unknown>(base + "/execute", {
        method: "POST",
        body: intent,
      });
      const result = readTerminationChange(response.data);
      if (
        result.id !== row.id ||
        result.pathId !== row.pathId ||
        !["ACCEPTED", "APPLIED"].includes(result.status)
      )
        throw new Error(
          "Chưa xác nhận được kết quả dừng lộ trình. Hãy tải lại chi tiết để kiểm tra.",
        );
      if (alive.current) {
        setSuccess(
          result.status === "APPLIED"
            ? "Đã dừng lộ trình và ghi nhận phân bổ Credit."
            : "Đã chấp thuận dừng lộ trình. Phân bổ Credit đang chờ các kết quả học còn lại.",
        );
        setUnknown(false);
        setIntent(undefined);
      }
    } catch (cause) {
      if (alive.current) {
        setError(text(cause));
        setUnknown(
          !(cause instanceof StaffApiError) ||
            cause.status === 0 ||
            cause.status === 408 ||
            cause.status >= 500,
        );
      }
    } finally {
      flight.current = false;
      if (alive.current) setBusy(false);
    }
  }
  async function reject() {
    if (!review || flight.current) return;
    flight.current = true;
    setBusy(true);
    setError(undefined);
    try {
      const current = await read();
      if (!sameExecution(review, current))
        throw new Error("Yêu cầu đã thay đổi. Tải lại trước khi từ chối.");
      await api(base + "/reject", {
        method: "POST",
        body: { expectedVersion: review.version, reason: reason.trim() },
      });
      if (alive.current) setSuccess("Máy chủ đã xác nhận từ chối yêu cầu.");
    } catch (cause) {
      if (alive.current) {
        setError(text(cause));
        setUnknown(true);
      }
    } finally {
      flight.current = false;
      if (alive.current) setBusy(false);
    }
  }
  const hasTerminatePermission =
    hasPermission(actor, "report:moderate") &&
    hasPermission(actor, "learning-path:terminate");
  const canExecute =
    hasTerminatePermission &&
    review &&
    !review.blockedByDispute &&
    !review.awaitingPolicy &&
    !!review.execution.policyReference &&
    review.execution.quote.status === "READY" &&
    ["ACCEPTED", "STAFF_REVIEW"].includes(review.status);
  return (
    <TerminationFrame
      row={row}
      busy={busy}
      close={close}
      reload={() => {
        setBusy(true);
        setError(undefined);
        void reload();
      }}
    >
      {busy && !error && (
        <LoadingSkeleton
          variant={review ? "inline" : "section"}
          label="Đang kiểm tra dữ liệu"
        />
      )}
      {error && (
        <p role="alert" className="staff-error">
          {error}
        </p>
      )}
      {success && (
        <p>
          <output>{success}</output>
        </p>
      )}
      {review && !success && (
        <>
          <div className="admin-summary-strip">
            <AdminField label="Trạng thái dừng">
              <StatusBadge status={review.status} />
            </AdminField>
            <AdminField label="Phân bổ Credit">
              <Badge
                tone={review.execution.quote.status === "READY" ? "ok" : "warn"}
              >
                {review.execution.quote.status === "READY"
                  ? "Sẵn sàng xem xét"
                  : "Cần kiểm tra thêm"}
              </Badge>
            </AdminField>
            <AdminField label="Buổi hoàn tất">
              <strong>
                {review.execution.completed}/{review.execution.total}
              </strong>
            </AdminField>
          </div>
          <section className="admin-section">
            <h3>Thông tin yêu cầu</h3>
            <div className="admin-field-grid">
              <AdminField label="Lộ trình">
                <RecordId id={review.pathId} label="lộ trình" />
              </AdminField>
              <AdminField label="Người yêu cầu">
                <UserProfileReference
                  userId={review.requesterId}
                  label="người yêu cầu"
                />
              </AdminField>
              <AdminField label="Thời điểm gửi">
                {fmtDateTime(review.createdAt)}
              </AdminField>
              <AdminField label="Chính sách">
                {review.execution.policyReference
                  ? "Đã có chính sách được duyệt"
                  : "Chưa được duyệt"}
              </AdminField>
            </div>
            <p className="admin-reason">{review.reason}</p>
          </section>
          {review.approvedAt && (
            <AdminNotice tone="info">
              Yêu cầu đã được chấp thuận dừng. Việc phân bổ Credit có thể vẫn
              đang chờ các kết quả học còn lại.
            </AdminNotice>
          )}
          {review.blockedByDispute && (
            <p className="staff-error">Tranh chấp đang chặn thực thi.</p>
          )}
          <form
            className="staff-termination-form"
            onSubmit={(event) => {
              event.preventDefault();
              try {
                setIntent(terminationDecision(review, reason, amounts));
                setError(undefined);
              } catch (cause) {
                setError(text(cause));
              }
            }}
          >
            <fieldset disabled={busy || !!intent || unknown || rejecting}>
              <legend>Phương án phân bổ Credit</legend>
              {review.execution.quote.status === "BLOCKED" && (
                <output>
                  Cần xử lý các buổi học hoặc vụ việc còn mở trước khi thực thi.
                </output>
              )}
              {review.execution.quote.reasonCodes.length > 0 && (
                <ul>
                  {review.execution.quote.reasonCodes.map((code) => (
                    <li key={code}>
                      {systemCodeLabel(
                        code,
                        "Cần kiểm tra điều kiện tất toán.",
                      )}
                    </li>
                  ))}
                </ul>
              )}
              <div className="admin-held-table">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Khoản giữ / Chủ sở hữu</th>
                      <th>Còn giữ</th>
                      <th>Hoàn lại</th>
                      <th>Trả đối tác</th>
                      <th>Phí</th>
                    </tr>
                  </thead>
                  <tbody>
                    {review.execution.allocations.map((held) => {
                      const amount =
                        review.execution.quote.status === "READY"
                          ? amounts.find(
                              (entry) =>
                                entry.allocationId === held.allocationId,
                            )
                          : undefined;
                      return (
                        <tr key={held.allocationId}>
                          <td>
                            <RecordId
                              id={held.allocationId}
                              label="khoản giữ"
                            />
                            <small>
                              Chủ sở hữu:{" "}
                              <UserProfileReference
                                userId={held.userId}
                                label="chủ sở hữu"
                              />
                            </small>
                          </td>
                          <td className="admin-money">
                            {financeNumber(held.remainingHeld)} CR
                          </td>
                          <td className="admin-money">
                            {amount
                              ? financeNumber(amount.refund) + " CR"
                              : "Chưa xác nhận"}
                          </td>
                          <td className="admin-money">
                            {amount
                              ? financeNumber(amount.counterpartyPayment) +
                                " CR"
                              : "Chưa xác nhận"}
                          </td>
                          <td className="admin-money">
                            {amount
                              ? financeNumber(amount.platformFee) + " CR"
                              : "Chưa xác nhận"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <label>
                <span>Lý do quyết định</span>
                <textarea
                  required
                  minLength={3}
                  maxLength={1000}
                  rows={4}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>
            </fieldset>
            {canExecute && !intent && (
              <LoadingButton
                type="submit"
                className="btn btn-primary"
                disabled={busy || unknown}
                loading={!!busy}
              >
                Kiểm tra phương án
              </LoadingButton>
            )}
            {!canExecute && (
              <AdminNotice tone="info">
                {!hasTerminatePermission ? (
                  <>
                    Tài khoản của bạn chưa được cấp quyền duyệt dừng lộ trình (
                    <code>learning-path:terminate</code>). Bạn vẫn có thể xem
                    xét hoặc từ chối yêu cầu không hợp lệ.
                  </>
                ) : (
                  <>
                    Chưa thể thực thi dừng lộ trình vì chính sách, trạng thái
                    yêu cầu hoặc tranh chấp hiện tại chưa đáp ứng điều kiện.
                  </>
                )}
              </AdminNotice>
            )}
          </form>
          {!intent && (
            <LoadingButton
              type="button"
              className="btn"
              disabled={
                busy ||
                unknown ||
                rejecting ||
                !!review.approvedAt ||
                reason.trim().length < 3 ||
                !["ACCEPTED", "STAFF_REVIEW"].includes(review.status)
              }
              onClick={() => setRejecting(true)}
              loading={!!busy}
            >
              Từ chối yêu cầu
            </LoadingButton>
          )}
          {rejecting && !intent && (
            <AdminNotice tone="warn">
              <strong>Xác nhận từ chối yêu cầu?</strong>
              <p>Lý do: {reason.trim()}</p>
              <div className="staff-dialog-actions">
                <LoadingButton
                  type="button"
                  className="btn"
                  disabled={busy}
                  onClick={() => setRejecting(false)}
                  loading={!!busy}
                >
                  Quay lại
                </LoadingButton>
                <LoadingButton
                  type="button"
                  className="btn btn-danger"
                  disabled={busy || unknown}
                  onClick={() => void reject()}
                  loading={!!busy}
                >
                  Xác nhận từ chối
                </LoadingButton>
              </div>
            </AdminNotice>
          )}
          {intent && (
            <div className="staff-held">
              <h3>Xác nhận phương án đã kiểm tra</h3>
              {intent.allocations.map((a) => (
                <p className="staff-wrap" key={a.allocationId}>
                  {a.allocationId}: hoàn {a.refund} · trả{" "}
                  {a.counterpartyPayment} · phí {a.platformFee} CR
                </p>
              ))}
              <p>Lý do: {intent.reason}</p>
              <p>
                Quyết định sẽ cập nhật lộ trình và Credit. Máy chủ kiểm tra lại
                quyền, chính sách, Held và tranh chấp.
              </p>
              <LoadingButton
                type="button"
                className="btn btn-danger"
                disabled={busy}
                onClick={() => void execute()}
                loading={!!busy}
              >
                {unknown
                  ? "Kiểm tra và gửi lại đúng quyết định"
                  : "Thực thi quyết định"}
              </LoadingButton>
            </div>
          )}
          {unknown && (
            <p>
              <output>
                Chưa rõ kết quả. Tải lại để kiểm tra; không tạo một phương án
                khác khi chưa đối chiếu.
              </output>
            </p>
          )}
        </>
      )}
    </TerminationFrame>
  );
}

function TerminationFrame({
  row,
  busy,
  close,
  reload,
  children,
}: Readonly<{
  row: TerminationTarget;
  busy: boolean;
  close: () => void;
  reload: () => void;
  children: ReactNode;
}>) {
  const controls = (
    <>
      <LoadingButton
        type="button"
        className="btn"
        disabled={busy}
        onClick={reload}
        loading={!!busy}
      >
        Tải lại chi tiết
      </LoadingButton>
      <LoadingButton
        type="button"
        className="btn"
        disabled={busy}
        onClick={close}
        loading={!!busy}
      >
        Đóng
      </LoadingButton>
    </>
  );
  return (
    <AdminDrawer
      wide
      title="Xem xét yêu cầu dừng lộ trình"
      subtitle={
        <>
          Yêu cầu <RecordId id={row.id} label="yêu cầu" />
        </>
      }
      busy={busy}
      close={close}
      footer={controls}
    >
      <div className="staff-termination-detail">{children}</div>
    </AdminDrawer>
  );
}
