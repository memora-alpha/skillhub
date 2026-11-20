"use client";
import { LoadingButton } from "@/components/loading-button";
import { systemCodeLabel } from "@/lib/system-text";

import Link from "next/link";
import { useState } from "react";
import { Card, Empty, PageHeader } from "@/components/console/ui";
import { fmtDateTime } from "@/lib/console/format";
import type { ReputationHistory } from "@/lib/staff/account-types";
import { AdminNotice } from "./admin-ui";
import { QueueState } from "./common";
import { useStaffResource } from "./hooks";
import { useStaffSession } from "./session";
import { PageNavigation } from "@/components/pagination/page-navigation";

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
  LIGHT_VIOLATION: "Vi phạm nội dung mức nhẹ",
  HARASSMENT: "Quấy rối",
  MEDIUM_HARASSMENT: "Quấy rối / hành vi không phù hợp mức vừa",
  FALSE_INFORMATION: "Thông tin sai lệch",
  COMPLETION: "Hoàn thành lộ trình học",
  RECOVERY_MISSION: "Nhiệm vụ phục hồi uy tín",
  REPUTATION_REVERSAL: "Hoàn tác biến động điểm uy tín",
};
const scopes: Record<string, string> = {
  CREATE_NEW_ACTIVITY: "Tạo hoạt động mới",
  REQUIRE_STAFF_REVIEW: "Cần nhân viên xem xét",
  REQUIRE_ADMIN_REVIEW: "Cần quản trị viên xem xét",
  ALL: "Mọi hoạt động",
};

export function ReputationScreen() {
  const { portal } = useStaffSession();
  const [cursors, setCursors] = useState<string[]>([]);
  const cursor = cursors.at(-1);
  const resource = useStaffResource<ReputationHistory>(
    "reputation" + (cursor ? "?cursor=" + encodeURIComponent(cursor) : ""),
  );
  const data = resource.data;
  const next = data?.nextCursor;
  return (
    <>
      <PageHeader
        title="Uy tín của tôi"
        desc="Điểm uy tín, lịch sử thay đổi và các hạn chế của tài khoản đang đăng nhập."
        actions={
          <div className="row">
            {portal === "staff" ? (
              <Link href="/learn/reputation" className="btn btn-primary">
                Mở Uy tín &amp; Phục hồi tại Không gian học →
              </Link>
            ) : (
              <Link href="/admin" className="btn btn-primary">
                Về Tổng quan quản trị →
              </Link>
            )}
            <LoadingButton
              type="button"
              className="btn"
              disabled={resource.loading}
              onClick={() => {
                if (cursors.length) setCursors([]);
                else void resource.reload();
              }}
              loading={!!resource.loading}
            >
              Làm mới
            </LoadingButton>
          </div>
        }
      />
      <AdminNotice tone="info">
        {portal === "staff"
          ? "Chức năng xem điểm uy tín cá nhân, xác nhận chính sách và làm Nhiệm vụ phục hồi (SRS V1.7) đã được chuyển sang Không gian học."
          : "Đây là dữ liệu uy tín cá nhân của tài khoản đang đăng nhập, tách biệt khỏi các công cụ quản trị hệ thống."}
      </AdminNotice>
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
                <dd>{levels[data.level] ?? "Chưa xác định"}</dd>
              </dl>
            </Card>
            <section className="section">
              <Card title="Hạn chế đang áp dụng">
                {!data.activeRestrictions.length ? (
                  <p>Không có hạn chế nào đang áp dụng.</p>
                ) : (
                  <ul className="stack">
                    {data.activeRestrictions.map((restriction) => (
                      <li
                        key={`${restriction.scope}:${restriction.reasonCode}:${restriction.endsAt}`}
                      >
                        <strong>
                          {scopes[restriction.scope] ??
                            systemCodeLabel(restriction.scope)}
                        </strong>
                        <p>
                          {reasons[restriction.reasonCode] ??
                            systemCodeLabel(restriction.reasonCode)}{" "}
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
                              {reasons[item.reasonCode] ??
                                systemCodeLabel(item.reasonCode)}
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
                <PageNavigation
                  pageNumber={cursors.length + 1}
                  totalPages={!next ? cursors.length + 1 : undefined}
                  loading={resource.loading}
                  hasNext={!!next && !cursors.includes(next)}
                  onPageChange={(target) => {
                    if (target <= cursors.length + 1)
                      setCursors(cursors.slice(0, target - 1));
                    else if (
                      target === cursors.length + 2 &&
                      next &&
                      !cursors.includes(next)
                    )
                      setCursors([...cursors, next]);
                  }}
                />
              </Card>
            </section>
          </>
        )}
      </QueueState>
    </>
  );
}
