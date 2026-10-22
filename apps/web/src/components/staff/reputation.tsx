"use client";

import { useState } from "react";
import { Card, Empty, PageHeader } from "@/components/console/ui";
import { fmtDateTime } from "@/lib/console/format";
import type { ReputationHistory } from "@/lib/staff/account-types";
import { QueueState } from "./common";
import { useStaffResource } from "./hooks";

const levels: Record<string, string> = {
  EXCELLENT: "Rất tốt",
  NORMAL: "Bình thường",
  WARNING: "Cần chú ý",
  RESTRICTED: "Bị hạn chế",
  LOW: "Thấp",
  SEVERE: "Rất thấp",
  CRITICAL: "Mức nghiêm trọng",
};
const reasons: Record<string, string> = {
  REVIEW_RATING: "Đánh giá từ người học",
  NO_SHOW: "Không tham gia buổi học",
  LATE_CANCELLATION: "Hủy buổi học muộn",
  FRAUD: "Gian lận",
  SPAM: "Spam",
  HARASSMENT: "Quấy rối",
  FALSE_INFORMATION: "Thông tin sai lệch",
  COMPLETION: "Hoàn thành buổi học",
};
const scopes: Record<string, string> = {
  CREATE_NEW_ACTIVITY: "Tạo hoạt động mới",
  REQUIRE_STAFF_REVIEW: "Cần nhân viên xem xét",
  REQUIRE_ADMIN_REVIEW: "Cần quản trị viên xem xét",
  ALL: "Mọi hoạt động",
};

export function ReputationScreen() {
  const [cursors, setCursors] = useState<string[]>([]);
  const cursor = cursors.at(-1);
  const resource = useStaffResource<ReputationHistory>(
    `reputation${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`,
  );
  const data = resource.data;
  const next = data?.nextCursor;
  return (
    <>
      <PageHeader
        title="Uy tín của tôi"
        desc="Điểm uy tín, lịch sử thay đổi và các hạn chế của tài khoản đang đăng nhập."
        actions={
          <button
            type="button"
            className="btn"
            disabled={resource.loading}
            onClick={() => {
              if (cursors.length) setCursors([]);
              else void resource.reload();
            }}
          >
            Làm mới
          </button>
        }
      />
      <QueueState
        loading={resource.loading}
        error={resource.error}
        empty={!data}
        reload={resource.reload}
      >
        {data && (
          <>
            <Card title="Uy tín hiện tại">
              <dl className="kv staff-kv">
                <dt>Điểm uy tín</dt>
                <dd className="staff-credit">{data.reputationScore}</dd>
                <dt>Mức uy tín</dt>
                <dd>{levels[data.level] ?? data.level}</dd>
              </dl>
            </Card>
            <section className="section">
              <Card title="Hạn chế đang áp dụng">
                {!data.activeRestrictions.length ? (
                  <p>Không có hạn chế nào đang áp dụng.</p>
                ) : (
                  <ul className="stack">
                    {data.activeRestrictions.map((restriction, index) => (
                      <li key={`${restriction.scope}-${index}`}>
                        <strong>
                          {scopes[restriction.scope] ?? restriction.scope}
                        </strong>
                        <p>
                          {reasons[restriction.reasonCode] ??
                            restriction.reasonCode}{" "}
                          · Đến {fmtDateTime(restriction.endsAt)}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </section>
            <section className="section">
              <Card title="Lịch sử uy tín" flush>
                {!data.items.length ? (
                  <Empty
                    title="Chưa có thay đổi uy tín"
                    desc="Lịch sử sẽ xuất hiện khi điểm uy tín của bạn thay đổi."
                  />
                ) : (
                  <div className="table-wrap">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Thời gian</th>
                          <th>Lý do</th>
                          <th>Thay đổi</th>
                          <th>Điểm trước</th>
                          <th>Điểm sau</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.items.map((item) => (
                          <tr key={item.id}>
                            <td>{fmtDateTime(item.createdAt)}</td>
                            <td>
                              {reasons[item.reasonCode] ?? item.reasonCode}
                            </td>
                            <td>
                              {item.delta > 0 ? "+" : ""}
                              {item.delta}
                            </td>
                            <td>{item.scoreBefore}</td>
                            <td>{item.scoreAfter}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <div className="staff-pager row">
                  <button
                    type="button"
                    className="btn"
                    disabled={resource.loading || !cursors.length}
                    onClick={() => setCursors(cursors.slice(0, -1))}
                  >
                    Trang trước
                  </button>
                  <span className="muted">Trang {cursors.length + 1}</span>
                  <button
                    type="button"
                    className="btn"
                    disabled={
                      resource.loading || !next || cursors.includes(next)
                    }
                    onClick={() => {
                      if (next) setCursors([...cursors, next]);
                    }}
                  >
                    Xem cũ hơn
                  </button>
                </div>
              </Card>
            </section>
          </>
        )}
      </QueueState>
    </>
  );
}
