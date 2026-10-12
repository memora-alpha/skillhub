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
  Notice,
  PageHeader,
  Segmented,
  StatusBadge,
} from "@/components/console/ui";
import {
  FLAGGED,
  MATERIALS,
  userName,
  type FlaggedRequest,
  type MaterialItem,
} from "@/lib/console/data";
import { fmtDateTime, fmtSize } from "@/lib/console/format";

type Kind = "REQUEST" | "MATERIAL";
type Filter = "PENDING" | "DONE";

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Wraps every flagged term in <mark> so moderators see what tripped the auto-filter. */
function Highlight({ text, terms }: { text: string; terms: string[] }) {
  if (terms.length === 0) return <>{text}</>;
  const parts = text.split(
    new RegExp(`(${terms.map(escapeRe).join("|")})`, "gi"),
  );
  return (
    <>
      {parts.map((part, i) =>
        i % 2 ? (
          <mark key={i} className="flag">
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </>
  );
}

type Row = {
  id: string;
  title: string;
  by: string;
  at: string;
  pending: boolean;
  status: string;
};

export default function ModerationQueuePage() {
  const { can, record } = useConsole();
  const [requests, setRequests] = useState<FlaggedRequest[]>(FLAGGED);
  const [materials, setMaterials] = useState<MaterialItem[]>(MATERIALS);
  const [kind, setKind] = useState<Kind>("REQUEST");
  const [filter, setFilter] = useState<Filter>("PENDING");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const allowed = can("moderation.review");

  const rows: Row[] =
    kind === "REQUEST"
      ? requests.map((r) => ({
          id: r.id,
          title: r.title,
          by: userName(r.authorId),
          at: r.submittedAt,
          pending: r.status === "PENDING_MODERATION",
          status: r.status,
        }))
      : materials.map((m) => ({
          id: m.id,
          title: m.title,
          by: userName(m.sellerId),
          at: m.submittedAt,
          pending: m.status === "PENDING_REVIEW",
          status: m.status,
        }));
  const pendingCount = rows.filter((r) => r.pending).length;
  const visible = rows.filter((r) =>
    filter === "PENDING" ? r.pending : !r.pending,
  );

  const request =
    kind === "REQUEST" ? requests.find((r) => r.id === selectedId) : undefined;
  const material =
    kind === "MATERIAL"
      ? materials.find((m) => m.id === selectedId)
      : undefined;
  const selected = request ?? material;

  function decide(approve: boolean, reason?: string) {
    if (!selected) return;
    const next = approve ? (request ? "OPEN" : "PUBLISHED") : "REJECTED";
    if (request) {
      setRequests((p) =>
        p.map((r) =>
          r.id === request.id
            ? {
                ...r,
                status: next as FlaggedRequest["status"],
                rejectReason: reason,
              }
            : r,
        ),
      );
    } else {
      setMaterials((p) =>
        p.map((m) =>
          m.id === selected.id
            ? {
                ...m,
                status: next as MaterialItem["status"],
                rejectReason: reason,
              }
            : m,
        ),
      );
    }
    record({
      // MATERIAL_MODERATE is not in the API's AUDIT_ACTIONS yet; add it there before wiring this up.
      action: request ? "LEARNING_REQUEST_MODERATE" : "MATERIAL_MODERATE",
      target: `${request ? "LEARNING_REQUEST" : "MATERIAL"}:${selected.id}`,
      reason,
      before: request ? "PENDING_MODERATION" : "PENDING_REVIEW",
      after: next,
    });
  }

  const isPending = request
    ? request.status === "PENDING_MODERATION"
    : material?.status === "PENDING_REVIEW";

  return (
    <>
      <PageHeader
        title="Kiểm duyệt nội dung"
        desc="Duyệt Learning Request bị bộ lọc tự động gắn cờ và tài liệu số mới đăng. Từ chối bắt buộc có lý do."
      />
      <div className="toolbar">
        <Segmented<Kind>
          label="Loại nội dung"
          value={kind}
          onChange={(k) => {
            setKind(k);
            setSelectedId(null);
          }}
          options={[
            {
              id: "REQUEST",
              label: "Learning Request",
              count: requests.filter((r) => r.status === "PENDING_MODERATION")
                .length,
            },
            {
              id: "MATERIAL",
              label: "Tài liệu số",
              count: materials.filter((m) => m.status === "PENDING_REVIEW")
                .length,
            },
          ]}
        />
        <Segmented<Filter>
          label="Lọc theo trạng thái"
          value={filter}
          onChange={(f) => {
            setFilter(f);
            setSelectedId(null);
          }}
          options={[
            { id: "PENDING", label: "Chờ duyệt", count: pendingCount },
            {
              id: "DONE",
              label: "Đã xử lý",
              count: rows.length - pendingCount,
            },
          ]}
        />
      </div>

      <div className="split" data-selected={selected !== undefined}>
        <Card className="split-list" flush>
          {visible.length === 0 ? (
            <Empty
              title="Hàng đợi trống"
              desc="Không có mục nào ở trạng thái này."
            />
          ) : (
            <ul className="q-list">
              {visible.map((r) => (
                <li key={r.id}>
                  <button
                    className="q-item"
                    aria-current={r.id === selectedId}
                    onClick={() => setSelectedId(r.id)}
                  >
                    <strong>{r.title}</strong>
                    <span className="q-meta">{r.by}</span>
                    <span className="q-meta">
                      <StatusBadge status={r.status} />
                      {fmtDateTime(r.at)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="split-detail">
          {!selected ? (
            <Card>
              <Empty
                title="Chọn một mục để xem xét"
                desc="Nội dung và lý do bị gắn cờ sẽ hiển thị ở đây."
              />
            </Card>
          ) : (
            <Card
              title={request ? request.title : material!.title}
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
                {request && (
                  <>
                    <div className="row">
                      <Avatar name={userName(request.authorId)} />
                      <strong>{userName(request.authorId)}</strong>
                      <Badge tone="neutral">{request.skill}</Badge>
                    </div>
                    {request.flags.length > 0 && (
                      <Notice tone="warn" icon="warn">
                        Bộ lọc tự động gắn cờ:{" "}
                        <strong>{request.categories.join(", ")}</strong> (từ
                        khóa: {request.flags.join(", ")})
                      </Notice>
                    )}
                    <p className="prose">
                      <Highlight text={request.body} terms={request.flags} />
                    </p>
                    {request.rejectReason && (
                      <dl className="kv">
                        <dt>Lý do từ chối</dt>
                        <dd>{request.rejectReason}</dd>
                      </dl>
                    )}
                  </>
                )}
                {material && (
                  <>
                    {material.scan === "SUSPICIOUS" && (
                      <Notice tone="bad" icon="warn">
                        Tệp bị quét đánh dấu <strong>nghi vấn</strong>. Kiểm tra
                        kỹ trước khi cho phép đăng bán.
                      </Notice>
                    )}
                    <dl className="kv">
                      <dt>Người bán</dt>
                      <dd>{userName(material.sellerId)}</dd>
                      <dt>Hình thức</dt>
                      <dd>
                        {material.access === "FREE" ? (
                          <StatusBadge status="FREE" />
                        ) : (
                          <>
                            <StatusBadge status="PAID_MATERIAL" />{" "}
                            {material.priceCredit} Credit
                          </>
                        )}
                      </dd>
                      <dt>Quét tệp</dt>
                      <dd>
                        <StatusBadge status={material.scan} />
                      </dd>
                      <dt>Trạng thái</dt>
                      <dd>
                        <StatusBadge status={material.status} />
                      </dd>
                      {material.rejectReason && (
                        <>
                          <dt>Lý do từ chối</dt>
                          <dd>{material.rejectReason}</dd>
                        </>
                      )}
                    </dl>
                    <div className="file">
                      <Icon name="file" />
                      <span className="file-name mono">{material.mime}</span>
                      <span className="muted mono">
                        {fmtSize(material.size)}
                      </span>
                    </div>
                  </>
                )}
              </div>
              {isPending && (
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
                    onClick={() => decide(true)}
                  >
                    <Icon name="check" size={16} /> Duyệt đăng
                  </GatedButton>
                </div>
              )}
            </Card>
          )}
        </div>
      </div>

      {rejecting && selected && (
        <ReasonDialog
          title={request ? "Từ chối Learning Request" : "Từ chối tài liệu"}
          description={request ? request.title : material!.title}
          confirmLabel="Từ chối & thông báo"
          tone="danger"
          label="Lý do từ chối"
          help="Bắt buộc. Nội dung này được gửi tới tác giả và ghi vào Audit log."
          onClose={() => setRejecting(false)}
          onConfirm={(reason) => {
            decide(false, reason);
            setRejecting(false);
          }}
        />
      )}
    </>
  );
}
