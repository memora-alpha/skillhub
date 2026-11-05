"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useStaffSession } from "./session";
import { StaffApiError } from "@/lib/staff/client";
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
import { PageHeader } from "@/components/console/ui";
const text = (cause: unknown) =>
  cause instanceof Error
    ? cause.message
    : "Không thể đọc kết quả. Vui lòng tải lại.";
export function TerminationsScreen() {
  const { actor } = useStaffSession();
  return actor ? <TerminationQueue key={actor.userId} /> : null;
}
function TerminationQueue() {
  const { api } = useStaffSession();
  const [rows, setRows] = useState<TerminationChange[]>([]),
    [cursor, setCursor] = useState<string | null>(null),
    [selected, setSelected] = useState<TerminationChange | null>(null),
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
          <button
            className="btn"
            disabled={loading}
            onClick={() => startLoad()}
          >
            Làm mới hàng đợi
          </button>
        }
      />
      <QueueState
        loading={loading}
        error={error}
        empty={!rows.length}
        reload={() => startLoad()}
      >
        <div className="staff-termination-grid">
          {rows.map((row) => (
            <section className="card" key={row.id}>
              <h2>Yêu cầu {row.id.slice(0, 8)}</h2>
              <p className="staff-wrap">Lộ trình: {row.pathId}</p>
              <p>{row.reason}</p>
              <p>
                {row.status}
                {row.blockedByDispute ? " · Có tranh chấp" : ""}
                {row.awaitingPolicy ? " · Chờ chính sách" : ""}
              </p>
              <button className="btn" onClick={() => setSelected(row)}>
                Xem phương án & xử lý
              </button>
            </section>
          ))}
        </div>
      </QueueState>
      {cursor && (
        <button
          className="btn"
          disabled={loading}
          onClick={() => startLoad(cursor)}
        >
          Tải thêm yêu cầu
        </button>
      )}
      {selected && (
        <TerminationDetail
          key={selected.id}
          row={selected}
          close={() => {
            setSelected(null);
            void load();
          }}
        />
      )}
    </>
  );
}
function TerminationDetail({
  row,
  close,
}: {
  row: TerminationChange;
  close: () => void;
}) {
  const { api, actor, portal } = useStaffSession();
  const [review, setReview] = useState<TerminationReview>(),
    [amounts, setAmounts] = useState<AllocationDecision[]>([]),
    [reason, setReason] = useState("");
  const [intent, setIntent] = useState<TerminationDecision>(),
    [error, setError] = useState<string>(),
    [busy, setBusy] = useState(true),
    [unknown, setUnknown] = useState(false),
    [success, setSuccess] = useState<string>();
  const flight = useRef(false),
    alive = useRef(true),
    section = useRef<HTMLElement>(null);
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
        setIntent(undefined);
        setUnknown(false);
        setAmounts(
          current.execution.allocations.map((a) => ({
            allocationId: a.allocationId,
            refund: "",
            counterpartyPayment: "",
            platformFee: "",
          })),
        );
        if (current.status === "APPLIED" || current.status === "REJECTED")
          setSuccess("Máy chủ xác nhận: " + current.status);
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
    section.current?.focus();
    section.current?.scrollIntoView({ behavior: "smooth", block: "start" });
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
      await api(base + "/execute", { method: "POST", body: intent });
      if (alive.current) {
        setSuccess("Đã thực thi quyết định theo xác nhận máy chủ.");
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
  const canExecute =
    portal === "admin" &&
    actor?.roles.includes("ADMIN") &&
    review &&
    !review.blockedByDispute &&
    !review.awaitingPolicy &&
    !!review.execution.policyReference &&
    ["ACCEPTED", "STAFF_REVIEW"].includes(review.status);
  return (
    <section
      className="card staff-termination-detail"
      ref={section}
      tabIndex={-1}
      aria-label="Xem xét dừng lộ trình"
    >
      <h2>Xem xét yêu cầu {row.id.slice(0, 8)}</h2>
      <p className="staff-wrap">Lộ trình {row.pathId}</p>
      {busy && <p role="status">Đang kiểm tra máy chủ…</p>}
      {error && (
        <p role="alert" className="staff-error">
          {error}
        </p>
      )}
      {success && <p role="status">{success}</p>}
      {review && !success && (
        <>
          <p>{review.reason}</p>
          <p>
            Tiến độ {review.execution.completed}/{review.execution.total} buổi ·
            Trạng thái {review.status} · Phiên bản {review.version}
          </p>
          <p className="staff-wrap">
            Chính sách: {review.execution.policyReference ?? "Chưa được duyệt"}
          </p>
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
            <fieldset disabled={busy || !!intent || unknown}>
              <legend>Phương án phân bổ Credit</legend>
              {review.execution.allocations.map((held, index) => (
                <div className="staff-held" key={held.allocationId}>
                  <p className="staff-wrap">
                    Người giữ: {held.userId}
                    <br />
                    Khoản: {held.allocationId}
                  </p>
                  <strong>
                    Held còn lại: {held.remainingHeld} CR · {held.status}
                  </strong>
                  {(
                    ["refund", "counterpartyPayment", "platformFee"] as const
                  ).map((field, i) => (
                    <label key={field}>
                      {["Hoàn người giữ", "Trả đối tác", "Phí nền tảng"][i]}
                      <input
                        inputMode="decimal"
                        required
                        pattern="(0|[1-9][0-9]{0,9})(\.[0-9]{1,2})?"
                        value={amounts[index]?.[field] ?? ""}
                        onChange={(e) =>
                          setAmounts((items) =>
                            items.map((a, n) =>
                              n === index
                                ? { ...a, [field]: e.target.value }
                                : a,
                            ),
                          )
                        }
                      />
                    </label>
                  ))}
                </div>
              ))}
              <label>
                Lý do quyết định
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
              <button className="btn btn-primary" disabled={busy || unknown}>
                Kiểm tra phương án
              </button>
            )}
            {!canExecute && (
              <p>
                Chỉ Admin độc lập có đủ quyền mới thực thi được, khi chính sách
                và trạng thái cho phép.
              </p>
            )}
          </form>
          {!intent && (
            <button
              className="btn"
              disabled={
                busy ||
                unknown ||
                reason.trim().length < 3 ||
                !["ACCEPTED", "STAFF_REVIEW"].includes(review.status)
              }
              onClick={() => {
                if (window.confirm("Từ chối yêu cầu với lý do đã nhập?"))
                  void reject();
              }}
            >
              Từ chối yêu cầu
            </button>
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
              <button
                className="btn btn-danger"
                disabled={busy}
                onClick={() => void execute()}
              >
                {unknown
                  ? "Kiểm tra và gửi lại đúng quyết định"
                  : "Thực thi quyết định"}
              </button>
            </div>
          )}
          {unknown && (
            <p role="status">
              Chưa rõ kết quả. Kiểm tra trạng thái máy chủ; không tạo một phương
              án khác khi chưa đối chiếu.
            </p>
          )}
        </>
      )}
      <div className="staff-dialog-actions">
        <button
          className="btn"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            setError(undefined);
            void reload();
          }}
        >
          Tải lại chi tiết
        </button>
        <button className="btn" disabled={busy} onClick={close}>
          Đóng
        </button>
      </div>
    </section>
  );
}
