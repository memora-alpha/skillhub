"use client";

import Link from "next/link";
import { useState } from "react";
import { useConsole } from "@/components/console/context";
import { Icon } from "@/components/console/icon";
import { ReasonDialog } from "@/components/console/reason-dialog";
import {
  Badge,
  Card,
  Empty,
  GatedButton,
  PageHeader,
  SearchBox,
  Segmented,
  StatusBadge,
} from "@/components/console/ui";
import { CONTENT, userName, type ContentRow } from "@/lib/console/data";
import { fmtDateTime } from "@/lib/console/format";

type Kind = ContentRow["kind"];
const LABEL: Record<Kind, string> = {
  REQUEST: "Learning Request",
  PATH: "Learning Path",
  SESSION: "Session",
};

export default function AdminContentPage() {
  const { can, record } = useConsole();
  const [rows, setRows] = useState<ContentRow[]>(CONTENT);
  const [kind, setKind] = useState<Kind>("REQUEST");
  const [query, setQuery] = useState("");
  const [target, setTarget] = useState<ContentRow | null>(null);

  const q = query.trim().toLowerCase();
  const visible = rows.filter(
    (r) =>
      r.kind === kind &&
      (!q ||
        `${r.id} ${r.title} ${userName(r.ownerId)}`.toLowerCase().includes(q)),
  );

  function confirm(reason: string) {
    if (!target) return;
    const hide = !target.hidden;
    setRows((p) =>
      p.map((r) => (r.id === target.id ? { ...r, hidden: hide } : r)),
    );
    record({
      action: hide ? "CONTENT_HIDE" : "CONTENT_RESTORE", // not in API AUDIT_ACTIONS yet
      target: `LEARNING_REQUEST:${target.id}`,
      reason,
      before: hide ? "VISIBLE" : "HIDDEN",
      after: hide ? "HIDDEN" : "VISIBLE",
    });
    setTarget(null);
  }

  return (
    <>
      <PageHeader
        title="Nội dung"
        desc="Xem Learning Request, Learning Path và Session. Admin có thể ẩn hoặc khôi phục bài đăng."
      />
      <div className="toolbar">
        <Segmented<Kind>
          label="Loại nội dung"
          value={kind}
          onChange={setKind}
          options={(Object.keys(LABEL) as Kind[]).map((k) => ({
            id: k,
            label: LABEL[k],
            count: rows.filter((r) => r.kind === k).length,
          }))}
        />
        <SearchBox
          label="Tìm nội dung"
          placeholder="Mã, tiêu đề, chủ sở hữu…"
          value={query}
          onChange={setQuery}
        />
      </div>
      <Card flush>
        {visible.length === 0 ? (
          <Empty title="Không có nội dung phù hợp" />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Mã</th>
                  <th>Tiêu đề</th>
                  <th>Chủ sở hữu</th>
                  <th>Trạng thái</th>
                  <th>Thời gian</th>
                  <th>
                    <span className="sr-only">Thao tác</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => (
                  <tr key={r.id}>
                    <td className="mono">{r.id}</td>
                    <td>{r.title}</td>
                    <td>{userName(r.ownerId)}</td>
                    <td>
                      <div className="row">
                        <StatusBadge status={r.status} />
                        {r.hidden && <StatusBadge status="HIDDEN" />}
                      </div>
                    </td>
                    <td className="muted">{fmtDateTime(r.at)}</td>
                    <td>
                      {r.kind === "REQUEST" ? (
                        <GatedButton
                          allowed={can("content.hide")}
                          className="btn btn-sm"
                          aria-label={`${r.hidden ? "Khôi phục" : "Ẩn"} ${r.title}`}
                          onClick={() => setTarget(r)}
                        >
                          <Icon
                            name={r.hidden ? "restore" : "eyeOff"}
                            size={14}
                          />
                          {r.hidden ? "Khôi phục" : "Ẩn"}
                        </GatedButton>
                      ) : r.status === "DISPUTED" ? (
                        <Link className="link" href="/admin/disputes">
                          <Badge tone="bad">Xem tranh chấp</Badge>
                        </Link>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {target && (
        <ReasonDialog
          title={target.hidden ? "Khôi phục bài đăng" : "Ẩn bài đăng"}
          description={target.title}
          confirmLabel={target.hidden ? "Khôi phục" : "Ẩn bài đăng"}
          tone={target.hidden ? "primary" : "danger"}
          onClose={() => setTarget(null)}
          onConfirm={confirm}
        />
      )}
    </>
  );
}
