"use client";
import { useState } from "react";
import { Card, Empty, PageHeader } from "@/components/console/ui";
import { useStaffList, useStaffResource } from "./hooks";
import { useStaffSession } from "./session";
import { QueueState } from "./common";

type Tag = {
  id: string;
  label: string;
  status: string;
  version: number;
};
type TagRequest = {
  id: string;
  label: string;
  status: string;
  version: number;
  rejectReason: string | null;
};

export function TagsScreen() {
  const { api } = useStaffSession();
  const queue = useStaffList<Tag>("tags?limit=50");
  const [label, setLabel] = useState("");
  const [message, setMessage] = useState("");
  return (
    <>
      <PageHeader
        title="Thẻ"
        desc="Tạo và cập nhật thẻ dùng chung trong danh mục."
      />
      <Card className="section" title="Thẻ mới">
        <form
          className="stack"
          onSubmit={async (event) => {
            event.preventDefault();
            setMessage("");
            try {
              await api("tags", {
                method: "POST",
                body: { label },
                key: crypto.randomUUID(),
              });
              setLabel("");
              setMessage("Đã tạo thẻ.");
              void queue.reload();
            } catch (error) {
              setMessage(error instanceof Error ? error.message : "Không tạo được thẻ.");
            }
          }}
        >
          <label className="staff-field">
            Tên thẻ
            <input
              className="input"
              value={label}
              maxLength={80}
              onChange={(event) => setLabel(event.target.value)}
              required
            />
          </label>
          <button className="btn btn-primary" type="submit">
            Tạo thẻ
          </button>
        </form>
        {message && <output className="staff-success">{message}</output>}
      </Card>
      <QueueState
        loading={queue.loading}
        error={queue.error}
        empty={queue.items.length === 0}
        reload={() => void queue.reload()}
      >
        {queue.items.length === 0 ? (
          <Empty title="Chưa có thẻ" />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <tbody>
                {queue.items.map((tag) => (
                  <TagRow key={tag.id} tag={tag} onChanged={() => void queue.reload()} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </QueueState>
    </>
  );
}

function TagRow({
  tag,
  onChanged,
}: Readonly<{ tag: Tag; onChanged: () => void }>) {
  const { api } = useStaffSession();
  const [reason, setReason] = useState("Cập nhật nhãn thẻ");
  const [label, setLabel] = useState(tag.label);
  return (
    <tr>
      <td>
        <input
          className="input"
          value={label}
          onChange={(event) => setLabel(event.target.value)}
        />
      </td>
      <td>{tag.status}</td>
      <td>
        <input
          className="input"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </td>
      <td>
        <button
          type="button"
          className="btn btn-sm"
          onClick={async () => {
            await api(`tags/${tag.id}`, {
              method: "PATCH",
              key: crypto.randomUUID(),
              body: {
                label,
                status: tag.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
                expectedVersion: tag.version,
                reason,
              },
            });
            onChanged();
          }}
        >
          {tag.status === "ACTIVE" ? "Tắt" : "Bật"}
        </button>
      </td>
    </tr>
  );
}

export function TagRequestsScreen() {
  const { api } = useStaffSession();
  const queue = useStaffList<TagRequest>("tag-requests?status=PENDING&limit=20");
  const [selected, setSelected] = useState<string | null>(null);
  const detail = useStaffResource<TagRequest>(
    selected ? `tag-requests/${selected}` : "tag-requests?limit=1",
  );
  return (
    <>
      <PageHeader
        title="Đề xuất thẻ"
        desc="Duyệt hoặc từ chối thẻ do người dùng đề xuất."
      />
      <QueueState
        loading={queue.loading}
        error={queue.error}
        empty={queue.items.length === 0}
        reload={() => void queue.reload()}
      >
        {queue.items.length === 0 ? (
          <Empty title="Không có đề xuất đang chờ" />
        ) : (
          <ul className="q-list">
            {queue.items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className="q-item"
                  onClick={() => setSelected(item.id)}
                >
                  {item.label}
                </button>
                <div className="row">
                  <button
                    type="button"
                    className="btn btn-sm btn-primary"
                    onClick={async () => {
                      await api(`tag-requests/${item.id}/approve`, {
                        method: "POST",
                        key: crypto.randomUUID(),
                        body: { expectedVersion: item.version },
                      });
                      void queue.reload();
                    }}
                  >
                    Duyệt
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={async () => {
                      await api(`tag-requests/${item.id}/reject`, {
                        method: "POST",
                        key: crypto.randomUUID(),
                        body: {
                          expectedVersion: item.version,
                          reason: "Nhãn chưa phù hợp danh mục.",
                        },
                      });
                      void queue.reload();
                    }}
                  >
                    Từ chối
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </QueueState>
      {selected && detail.data && !Array.isArray(detail.data) && (
        <Card className="section" title="Chi tiết đề xuất">
          <p>
            {detail.data.label} · {detail.data.status}
          </p>
        </Card>
      )}
    </>
  );
}
