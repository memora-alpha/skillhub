"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { formatVietnamTime, vietnamDateKey } from "@/lib/vietnam-time";
import { groupSessionsByDay, partitionSessionsByDate } from "./calendar-data";
import { CalendarAgenda } from "./calendar-agenda";
import styles from "./calendar-agenda.module.css";
import { useClock } from "../hooks/use-clock";
import type { LearningSession } from "../types";
import { useUserSnapshot } from "../hooks/use-user-snapshot";
import { Empty, Feedback, PageHeading, formatTime } from "../components/common";
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
  const query = useUserSnapshot<LearningSession>(
    "sessions/mine?limit=100&" + range,
  );
  const firstWeekday =
    (new Date(Date.UTC(year!, selectedMonth! - 1, 1)).getUTCDay() + 6) % 7;
  const now = useClock();
  const today = vietnamDateKey(now);
  const sessionsByDay = useMemo(
    () => groupSessionsByDay(query.items),
    [query.items],
  );
  const agenda = useMemo(
    () => partitionSessionsByDate(query.items, today),
    [query.items, today],
  );
  return (
    <>
      <PageHeading
        title="Lịch học của tôi"
        description="Lịch học theo ngày · Giờ Việt Nam (UTC+7)"
        action={
          <div className={styles.monthActions}>
            {month !== today.slice(0, 7) && (
              <button
                type="button"
                className="btn"
                onClick={() => setMonth(today.slice(0, 7))}
              >
                Về tháng hiện tại
              </button>
            )}
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
          </div>
        }
      />
      <Feedback
        loading={query.loading}
        error={query.error}
        reload={query.reload}
      />
      <section className={styles.month} aria-labelledby="calendar-month-title">
        <h2 id="calendar-month-title" className={styles.monthTitle}>
          Tháng {String(selectedMonth).padStart(2, "0")}/{year}
        </h2>
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
      </section>
      <CalendarAgenda groups={agenda} />
      {!query.loading && !query.error && !query.items.length && (
        <Empty>
          Tháng này chưa có buổi học. Lịch sẽ xuất hiện sau khi cả hai xác nhận
          và chốt thỏa thuận.
        </Empty>
      )}
    </>
  );
}
