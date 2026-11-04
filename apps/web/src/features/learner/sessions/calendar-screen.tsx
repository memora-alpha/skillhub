"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  formatVietnamDayMonth,
  formatVietnamTime,
  vietnamDateKey,
} from "@/lib/vietnam-time";
import { groupSessionsByDay } from "./calendar-data";
import { useClock } from "../hooks/use-clock";
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
    vietnamDateKey(Date.now()).slice(0, 7),
  );
  const [year, selectedMonth] = month.split("-").map(Number);
  const last = new Date(Date.UTC(year!, selectedMonth!, 0)).getUTCDate();
  const range = new URLSearchParams({
    from: new Date(month + "-01T00:00:00+07:00").toISOString(),
    to: new Date(month + "-" + last + "T23:59:59.999+07:00").toISOString(),
  });
  const query = useUserResource<LearningSession[]>("sessions/mine?" + range);
  const firstWeekday =
    (new Date(Date.UTC(year!, selectedMonth! - 1, 1)).getUTCDay() + 6) % 7;
  const now = useClock();
  const today = vietnamDateKey(now);
  const sessionsByDay = useMemo(
    () => groupSessionsByDay(query.data ?? []),
    [query.data],
  );
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
      <div className="product-calendar-layout">
        <section aria-label="Lịch tháng" className="product-calendar">
          {["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((day) => (
            <div className="weekday" key={day}>
              {day}
            </div>
          ))}
          {Array.from({ length: firstWeekday }, (_, i) => (
            <div className="outside" key={"outside-" + i} />
          ))}
          {Array.from({ length: last }, (_, i) => {
            const day = i + 1,
              key = month + "-" + String(day).padStart(2, "0");
            return (
              <div key={day} className={key === today ? "today" : ""}>
                <time dateTime={key}>{day}</time>
                {sessionsByDay.get(key)?.map((session) => (
                  <Link
                    key={session.id}
                    href={"/learn/sessions/" + session.id}
                    aria-label={"Buổi học " + formatTime(session.startAt)}
                  >
                    {formatVietnamTime(session.startAt)}
                  </Link>
                ))}
              </div>
            );
          })}
        </section>
        <section
          className="learner-stack"
          aria-labelledby="calendar-sessions-title"
        >
          <h2
            id="calendar-sessions-title"
            className="product-calendar-list-title"
          >
            Các buổi học trong tháng
          </h2>
          {query.data?.map((session) => (
            <Panel key={session.id}>
              <div className="learner-session-row">
                <div className="learner-date-box">
                  {formatVietnamDayMonth(session.startAt)}
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
                    {formatVietnamTime(session.endAt)}
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
        </section>
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
