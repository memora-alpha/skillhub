"use client";

import { useState } from "react";
import { useConsole } from "@/components/console/context";
import { Icon } from "@/components/console/icon";
import { ReasonDialog } from "@/components/console/reason-dialog";
import {
  Avatar,
  Badge,
  Card,
  Empty,
  GatedButton,
  PageHeader,
  Segmented,
  StatusBadge,
} from "@/components/console/ui";
import { EVIDENCE, USERS, type Evidence } from "@/lib/console/data";
import { fmtDate, fmtDateTime, fmtSize } from "@/lib/console/format";

type Filter = "PENDING" | "DONE";

export default function EvidenceQueuePage() {
  const { can, record } = useConsole();
  const [items, setItems] = useState<Evidence[]>(EVIDENCE);
  const [filter, setFilter] = useState<Filter>("PENDING");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState(false);

  const pending = items.filter((e) => e.status === "PENDING");
  const visible =
    filter === "PENDING"
      ? pending
      : items.filter((e) => e.status !== "PENDING");
  const selected = items.find((e) => e.id === selectedId) ?? null;
  const user = selected && USERS.find((u) => u.id === selected.userId);
  const allowed = can("evidence.review");

  function decide(
    id: string,
    status: "APPROVED" | "REJECTED",
    reason?: string,
  ) {
    setItems((prev) =>
      prev.map((e) =>
        e.id === id ? { ...e, status, rejectReason: reason } : e,
      ),
    );
    record({
      action:
        status === "APPROVED" ? "VERIFY_SKILL_APPROVE" : "VERIFY_SKILL_REJECT",
      target: `EVIDENCE:${id}`,
      reason,
      before: "PENDING",
      after: status,
    });
  }

  return (
    <>
      <PageHeader
        title="Bằng chứng kỹ năng"
        desc="Kiểm tra thông tin và file đính kèm, sau đó chấp nhận hoặc từ chối. Từ chối bắt buộc có lý do để thông báo cho người dùng."
      />
      <div className="toolbar">
        <Segmented<Filter>
          label="Lọc theo trạng thái"
          value={filter}
          onChange={(f) => {
            setFilter(f);
            setSelectedId(null);
          }}
          options={[
            { id: "PENDING", label: "Chờ duyệt", count: pending.length },
            {
              id: "DONE",
              label: "Đã xử lý",
              count: items.length - pending.length,
            },
          ]}
        />
      </div>

      <div className="split" data-selected={selected !== null}>
        <Card className="split-list" flush>
          {visible.length === 0 ? (
            <Empty title="Không còn bằng chứng nào" desc="Hàng đợi đã trống." />
          ) : (
            <ul className="q-list">
              {visible.map((e) => (
                <li key={e.id}>
                  <button
                    className="q-item"
                    aria-current={e.id === selectedId}
                    onClick={() => setSelectedId(e.id)}
                  >
                    <strong>{e.skill}</strong>
                    <span className="q-meta">
                      {USERS.find((u) => u.id === e.userId)?.name} · {e.level}
                    </span>
                    <span className="q-meta">
                      <StatusBadge status={e.status} />
                      {fmtDateTime(e.submittedAt)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="split-detail">
          {!selected || !user ? (
            <Card>
              <Empty
                title="Chọn một bằng chứng"
                desc="Thông tin chi tiết sẽ hiển thị ở đây."
              />
            </Card>
          ) : (
            <Card
              title={`${selected.skill} · ${selected.level}`}
              actions={
                <button
                  className="btn btn-sm only-mobile"
                  onClick={() => setSelectedId(null)}
                >
                  <Icon name="left" size={16} /> Danh sách
                </button>
              }
              flush
            >
              <div className="card-body stack">
                <div className="row">
                  <Avatar name={user.name} />
                  <div>
                    <strong>{user.name}</strong>
                    <div className="muted">
                      {user.email} · Uy tín {user.reputation} · Tham gia{" "}
                      {fmtDate(user.joinedAt)}
                    </div>
                  </div>
                </div>
                <dl className="kv">
                  <dt>Trạng thái</dt>
                  <dd>
                    <StatusBadge status={selected.status} />
                  </dd>
                  <dt>Gửi lúc</dt>
                  <dd>{fmtDateTime(selected.submittedAt)}</dd>
                  <dt>Mô tả</dt>
                  <dd>{selected.note}</dd>
                  {selected.rejectReason && (
                    <>
                      <dt>Lý do từ chối</dt>
                      <dd>{selected.rejectReason}</dd>
                    </>
                  )}
                </dl>
                <div>
                  <h3 className="sub-title">
                    Tệp đính kèm ({selected.files.length})
                  </h3>
                  <div className="stack">
                    {selected.files.map((f) => (
                      <div key={f.name} className="file">
                        <Icon name="clip" />
                        <span className="file-name">{f.name}</span>
                        <span className="muted mono">{fmtSize(f.size)}</span>
                        <Badge tone="ok">MIME hợp lệ</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              {selected.status === "PENDING" && (
                <div className="detail-actions">
                  <GatedButton
                    allowed={allowed}
                    className="btn btn-danger"
                    onClick={() => setRejecting(true)}
                  >
                    <Icon name="x" size={16} /> Từ chối
                  </GatedButton>
                  <GatedButton
                    allowed={allowed}
                    className="btn btn-primary"
                    onClick={() => decide(selected.id, "APPROVED")}
                  >
                    <Icon name="check" size={16} /> Chấp nhận
                  </GatedButton>
                </div>
              )}
            </Card>
          )}
        </div>
      </div>

      {rejecting && selected && (
        <ReasonDialog
          title="Từ chối bằng chứng"
          description={`${selected.skill} của ${user?.name}`}
          confirmLabel="Từ chối & thông báo"
          tone="danger"
          label="Lý do từ chối"
          help="Bắt buộc. Nội dung này được gửi tới người dùng và ghi vào Audit log."
          onClose={() => setRejecting(false)}
          onConfirm={(reason) => {
            decide(selected.id, "REJECTED", reason);
            setRejecting(false);
          }}
        />
      )}
    </>
  );
}
