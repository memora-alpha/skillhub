"use client";
import Link from "next/link";
import { useState } from "react";
import type { LearningSession } from "../types";
import { useUserResource } from "../hooks/use-user-resource";
import {
  Empty,
  Feedback,
  PageHeading,
  Panel,
  Status,
  formatTime,
} from "../components/common";
export function CalendarScreen() {
  const [month, setMonth] = useState(() =>
    new Intl.DateTimeFormat("sv-SE", {
      timeZone: "Asia/Ho_Chi_Minh",
      year: "numeric",
      month: "2-digit",
    })
      .format(new Date())
      .slice(0, 7),
  );
  const [year, selectedMonth] = month.split("-").map(Number);
  const last = new Date(Date.UTC(year!, selectedMonth!, 0)).getUTCDate();
  const range = new URLSearchParams({
    from: new Date(month + "-01T00:00:00+07:00").toISOString(),
    to: new Date(month + "-" + last + "T23:59:59.999+07:00").toISOString(),
  });
  const query = useUserResource<LearningSession[]>("sessions/mine?" + range);
  return (
    <>
      <PageHeading
        eyebrow="THỜI GIAN DÀNH CHO BẠN"
        title="Lịch học của tôi"
        description="Lịch hiển thị theo giờ Việt Nam. Chọn một buổi để xem chi tiết hoặc vào phòng."
        action={
          <input
            className="learner-month"
            aria-label="Tháng học"
            type="month"
            value={month}
            onChange={(event) => {
              if (/^\d{4}-\d{2}$/.test(event.target.value))
                setMonth(event.target.value);
            }}
          />
        }
      />
      <Feedback
        loading={query.loading}
        error={query.error}
        reload={query.reload}
      />
      <div className="learner-stack">
        {query.data?.map((session) => (
          <Panel key={session.id}>
            <div className="learner-session-row">
              <div className="learner-date-box">
                {new Intl.DateTimeFormat("vi-VN", {
                  timeZone: "Asia/Ho_Chi_Minh",
                  day: "2-digit",
                  month: "2-digit",
                }).format(new Date(session.startAt))}
              </div>
              <div>
                <Status value={session.status} />
                <h2>
                  Buổi học ·{" "}
                  {session.role === "TEACHER"
                    ? "Bạn hướng dẫn"
                    : "Bạn là người học"}
                </h2>
                <p>
                  {formatTime(session.startAt)} –{" "}
                  {new Intl.DateTimeFormat("vi-VN", {
                    timeZone: "Asia/Ho_Chi_Minh",
                    timeStyle: "short",
                  }).format(new Date(session.endAt))}
                </p>
              </div>
              <Link
                className="btn btn-primary"
                href={"/learn/sessions/" + session.id}
              >
                Chi tiết / vào học
              </Link>
            </div>
          </Panel>
        ))}
      </div>
      {!query.loading && !query.error && !query.data?.length && (
        <Empty>
          Tháng này chưa có buổi học. Lịch sẽ xuất hiện sau khi cả hai xác nhận
          và chốt thỏa thuận.
        </Empty>
      )}
      {query.data?.length === 100 && (
        <p className="learner-notice">
          API đang trả tối đa 100 buổi trong khoảng thời gian này.
        </p>
      )}
    </>
  );
}
