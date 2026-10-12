"use client";

import Link from "next/link";
import { useState } from "react";
import { useConsole, type DisputeOutcome } from "./context";
import { Icon } from "./icon";
import { ReasonDialog } from "./reason-dialog";
import {
  Avatar,
  Badge,
  Card,
  Empty,
  GatedButton,
  Notice,
  PageHeader,
  Segmented,
  SearchBox,
  StatusBadge,
} from "./ui";
import { userName, type ChatMessage } from "@/lib/console/data";
import { fmtDateTime, fmtSize, fmtTime } from "@/lib/console/format";

type Base = "/staff" | "/admin";
type Filter = "ACTIVE" | "DONE" | "ALL";

const TARGET_LABEL: Record<string, string> = {
  SESSION: "Phiên học",
  USER: "Người dùng",
  MESSAGE: "Tin nhắn",
  MATERIAL: "Tài liệu",
  CREDIT_TRANSACTION: "Giao dịch",
};
const FINAL = new Set(["RESOLVED", "REJECTED", "CLOSED"]);

export function DisputeList({ base }: { base: Base }) {
  const { disputes } = useConsole();
  const [filter, setFilter] = useState<Filter>("ACTIVE");
  const [query, setQuery] = useState("");

  const active = disputes.filter((d) => !FINAL.has(d.status));
  const q = query.trim().toLowerCase();
  const rows = disputes
    .filter((d) =>
      filter === "ALL"
        ? true
        : filter === "ACTIVE"
          ? !FINAL.has(d.status)
          : FINAL.has(d.status),
    )
    .filter(
      (d) =>
        !q ||
        `${d.id} ${d.reason} ${userName(d.reporterId)} ${userName(d.againstId)}`
          .toLowerCase()
          .includes(q),
    );

  return (
    <>
      <PageHeader
        title="Báo cáo & tranh chấp"
        desc="Xem xét bằng chứng, log chat và metadata phiên học để quyết định xử lý."
      />
      <div className="toolbar">
        <SearchBox
          label="Tìm báo cáo"
          placeholder="Tìm theo mã, lý do, người dùng…"
          value={query}
          onChange={setQuery}
        />
        <Segmented<Filter>
          label="Lọc theo trạng thái"
          value={filter}
          onChange={setFilter}
          options={[
            { id: "ACTIVE", label: "Cần xử lý", count: active.length },
            {
              id: "DONE",
              label: "Đã xử lý",
              count: disputes.length - active.length,
            },
            { id: "ALL", label: "Tất cả" },
          ]}
        />
      </div>
      <Card flush>
        {rows.length === 0 ? (
          <Empty
            title="Không có báo cáo phù hợp"
            desc="Thử đổi bộ lọc hoặc từ khóa."
          />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Mã</th>
                  <th>Đối tượng</th>
                  <th>Người báo cáo</th>
                  <th>Bị báo cáo</th>
                  <th>Lý do</th>
                  <th>Ưu tiên</th>
                  <th>Trạng thái</th>
                  <th>Tạo lúc</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((d) => (
                  <tr key={d.id}>
                    <td>
                      <Link
                        className="link mono"
                        href={`${base}/disputes/${d.id}`}
                      >
                        {d.id}
                      </Link>
                    </td>
                    <td>{TARGET_LABEL[d.target]}</td>
                    <td>{userName(d.reporterId)}</td>
                    <td>{userName(d.againstId)}</td>
                    <td>{d.reason}</td>
                    <td>
                      <StatusBadge status={d.priority} />
                    </td>
                    <td>
                      <div className="row">
                        <StatusBadge status={d.status} />
                        {d.escalated && (
                          <Badge tone="brand">Đã chuyển cấp</Badge>
                        )}
                      </div>
                    </td>
                    <td className="muted">{fmtDateTime(d.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="table-foot">
          Hiển thị {rows.length}/{disputes.length} báo cáo
        </div>
      </Card>
    </>
  );
}

function ChatBubble({ m, reporterId }: { m: ChatMessage; reporterId: string }) {
  if (m.kind !== "text") {
    return (
      <div className="bubble system">
        <Badge tone="brand">
          {m.kind === "plan" ? "Lộ trình đã tạo" : "Xác nhận lịch"}
        </Badge>
        <span className="bubble-meta">
          {userName(m.from)} · {fmtDateTime(m.at)}
        </span>
        {m.text}
      </div>
    );
  }
  return (
    <div className={`bubble ${m.from === reporterId ? "me" : ""}`}>
      <span className="bubble-meta">
        {userName(m.from)} · {fmtDateTime(m.at)}
      </span>
      {m.text}
    </div>
  );
}

const ACTIONS: Record<
  DisputeOutcome,
  { title: string; confirm: string; tone: "primary" | "danger"; help: string }
> = {
  RESOLVE: {
    title: "Giải quyết tranh chấp",
    confirm: "Giải quyết",
    tone: "primary",
    help: "Bắt buộc. Nêu căn cứ quyết định; nội dung được gửi cho hai bên và ghi Audit log.",
  },
  REJECT: {
    title: "Bác bỏ báo cáo",
    confirm: "Bác bỏ",
    tone: "danger",
    help: "Bắt buộc. Giải thích vì sao báo cáo không đủ căn cứ; gửi cho người báo cáo.",
  },
  ESCALATE: {
    title: "Chuyển cấp lên Admin",
    confirm: "Chuyển cấp",
    tone: "primary",
    help: "Bắt buộc. Nêu rõ vì sao vụ việc vượt thẩm quyền Staff.",
  },
};

export function DisputeDetail({ id, base }: { id: string; base: Base }) {
  const { disputes, portal, can, record, decideDispute } = useConsole();
  const [chatOpen, setChatOpen] = useState(false);
  const [acting, setActing] = useState<DisputeOutcome | null>(null);
  const d = disputes.find((x) => x.id === id);

  const back = (
    <Link className="back-link" href={`${base}/disputes`}>
      <Icon name="left" size={14} /> Danh sách báo cáo
    </Link>
  );

  if (!d) {
    return (
      <>
        <PageHeader title="Không tìm thấy báo cáo" back={back} />
        <Card>
          <Empty
            title="Báo cáo không tồn tại"
            desc={`Mã ${id} không có trong hệ thống.`}
          />
        </Card>
      </>
    );
  }

  const final = FINAL.has(d.status);
  const locked = d.escalated && portal === "staff";
  const canDecide = can("dispute.decide") && !locked;
  const s = d.session;
  const parties = [d.reporterId, d.againstId];

  function openChat() {
    setChatOpen(true);
    record({ action: "REPORT_EVIDENCE_READ", target: `REPORT:${id}` });
  }

  return (
    <>
      <PageHeader
        title={`Báo cáo ${d.id}`}
        desc={d.reason}
        back={back}
        actions={
          <>
            <StatusBadge status={d.priority} />
            <StatusBadge status={d.status} />
            {d.escalated && <Badge tone="brand">Đã chuyển cấp Admin</Badge>}
          </>
        }
      />
      <div className="grid grid-main">
        <div className="stack">
          <Card title="Nội dung báo cáo">
            <dl className="kv">
              <dt>Đối tượng</dt>
              <dd>{TARGET_LABEL[d.target]}</dd>
              <dt>Người báo cáo</dt>
              <dd>{userName(d.reporterId)}</dd>
              <dt>Bị báo cáo</dt>
              <dd>{userName(d.againstId)}</dd>
              <dt>Tạo lúc</dt>
              <dd>{fmtDateTime(d.createdAt)}</dd>
              <dt>Mô tả</dt>
              <dd>{d.description}</dd>
            </dl>
          </Card>

          <Card title={`Bằng chứng đính kèm (${d.evidence.length})`}>
            {d.evidence.length === 0 ? (
              <span className="muted">Người báo cáo không đính kèm tệp.</span>
            ) : (
              <div className="stack">
                {d.evidence.map((f) => (
                  <div key={f.name} className="file">
                    <Icon name="clip" />
                    <span className="file-name">{f.name}</span>
                    <span className="muted mono">{fmtSize(f.size)}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {s && (
            <Card title={`Metadata phiên học ${s.id}`}>
              <div className="stack">
                {s.status === "DISPUTED" && (
                  <Notice tone="warn" icon="warn">
                    Tranh chấp này đang chặn settlement của lộ trình. Credit
                    đang giữ: <strong>{s.heldCredit}</strong>.
                  </Notice>
                )}
                <dl className="kv">
                  <dt>Bắt đầu</dt>
                  <dd>{fmtDateTime(s.startAt)}</dd>
                  <dt>Thời lượng</dt>
                  <dd>{s.minutes} phút</dd>
                  <dt>Trạng thái</dt>
                  <dd>
                    <StatusBadge status={s.status} />
                  </dd>
                </dl>
                <div>
                  <h3 className="sub-title">
                    <Icon name="video" size={14} /> Tham gia phòng LiveKit
                  </h3>
                  <div className="stack">
                    {parties.map((uid) => {
                      const j = s.joined.find((x) => x.userId === uid);
                      const mins = j
                        ? Math.round(
                            (Date.parse(j.left) - Date.parse(j.at)) / 60_000,
                          )
                        : 0;
                      return (
                        <div key={uid} className="file">
                          <Avatar name={userName(uid)} />
                          <span className="file-name">{userName(uid)}</span>
                          {j ? (
                            <span className="muted">
                              {fmtTime(j.at)} → {fmtTime(j.left)} · {mins} phút
                            </span>
                          ) : (
                            <Badge tone="bad">Không tham gia</Badge>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <h3 className="sub-title">
                    Xác nhận hoàn thành (cần cả hai bên)
                  </h3>
                  <div className="dual">
                    {parties.map((uid) => {
                      const done = s.confirmedBy.includes(uid);
                      return (
                        <div key={uid} className={done ? "done" : ""}>
                          <Icon name={done ? "check" : "clock"} size={16} />
                          {userName(uid)}:{" "}
                          {done ? "đã xác nhận" : "chưa xác nhận"}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </Card>
          )}

          <Card title="Log chat">
            {chatOpen ? (
              d.chat.length === 0 ? (
                <span className="muted">Không có tin nhắn liên quan.</span>
              ) : (
                <div
                  className="chat"
                  tabIndex={0}
                  aria-label="Nội dung log chat"
                >
                  {d.chat.map((m) => (
                    <ChatBubble key={m.id} m={m} reporterId={d.reporterId} />
                  ))}
                </div>
              )
            ) : (
              <div className="stack">
                <Notice tone="info">
                  Log chat chỉ nên mở khi cần thiết. Việc mở được ghi vào Audit
                  log (<span className="mono">REPORT_EVIDENCE_READ</span>).
                </Notice>
                <div>
                  <GatedButton
                    allowed={can("dispute.chat")}
                    className="btn"
                    onClick={openChat}
                  >
                    <Icon name="eye" size={16} /> Mở log chat
                  </GatedButton>
                </div>
              </div>
            )}
          </Card>
        </div>

        <div className="stack">
          <Card title="Quyết định xử lý">
            {d.decision ? (
              <div className="stack">
                <Notice
                  tone={d.decision.outcome === "REJECT" ? "bad" : "ok"}
                  icon="check"
                >
                  <strong>
                    {d.decision.outcome === "RESOLVE"
                      ? "Đã giải quyết"
                      : d.decision.outcome === "REJECT"
                        ? "Đã bác bỏ"
                        : "Đã chuyển cấp Admin"}
                  </strong>
                </Notice>
                <dl className="kv">
                  <dt>Lý do</dt>
                  <dd>{d.decision.reason}</dd>
                </dl>
              </div>
            ) : (
              <span className="muted">Chưa có quyết định.</span>
            )}
            {locked && !final && (
              <div className="section">
                <Notice tone="brand">
                  Vụ việc đã được chuyển cấp, đang chờ Admin xử lý.
                </Notice>
              </div>
            )}
            {!final && (
              <div className="stack section">
                <GatedButton
                  allowed={canDecide}
                  className="btn btn-primary"
                  onClick={() => setActing("RESOLVE")}
                >
                  <Icon name="check" size={16} /> Giải quyết
                </GatedButton>
                <GatedButton
                  allowed={canDecide}
                  className="btn btn-danger"
                  onClick={() => setActing("REJECT")}
                >
                  <Icon name="x" size={16} /> Bác bỏ báo cáo
                </GatedButton>
                {portal === "staff" && (
                  <GatedButton
                    allowed={canDecide}
                    className="btn"
                    onClick={() => setActing("ESCALATE")}
                  >
                    <Icon name="arrowUp" size={16} /> Chuyển cấp Admin
                  </GatedButton>
                )}
              </div>
            )}
          </Card>
        </div>
      </div>

      {acting && (
        <ReasonDialog
          title={ACTIONS[acting].title}
          description={`${d.id} — ${d.reason}`}
          confirmLabel={ACTIONS[acting].confirm}
          tone={ACTIONS[acting].tone}
          label="Lý do quyết định"
          help={ACTIONS[acting].help}
          onClose={() => setActing(null)}
          onConfirm={(reason) => {
            decideDispute(d.id, acting, reason);
            setActing(null);
          }}
        />
      )}
    </>
  );
}
