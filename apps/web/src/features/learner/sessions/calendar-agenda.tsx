"use client";
import { useId, useRef, useState } from "react";
import Link from "next/link";
import type { LearningSession } from "../types";
import { Status, formatTime } from "../components/common";
import { ProductIcon } from "../components/product-icon";
import { formatVietnamDayMonth, formatVietnamTime } from "@/lib/vietnam-time";
import type { partitionSessionsByDate } from "./calendar-data";
import styles from "./calendar-agenda.module.css";

const tabs = [
  {
    key: "today",
    label: "Hôm nay",
    empty: "Bạn không có buổi học hôm nay trong tháng đang xem.",
  },
  {
    key: "upcoming",
    label: "Sắp tới",
    empty: "Không có buổi học sắp tới trong tháng này.",
  },
  {
    key: "past",
    label: "Đã qua",
    empty: "Không có buổi học trước hôm nay trong tháng này.",
  },
] as const;
type AgendaTab = (typeof tabs)[number]["key"];

export function CalendarAgenda({
  groups,
}: Readonly<{
  groups: ReturnType<typeof partitionSessionsByDate<LearningSession>>;
}>) {
  const [selected, setSelected] = useState<AgendaTab>("today");
  const id = useId();
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);
  return (
    <div className={styles.agenda}>
      <div
        className={styles.tabs}
        role="tablist"
        aria-label="Buổi học theo thời gian"
      >
        {tabs.map((tab, index) => (
          <button
            key={tab.key}
            ref={(element) => {
              buttons.current[index] = element;
            }}
            type="button"
            role="tab"
            id={`${id}-tab-${tab.key}`}
            aria-controls={`${id}-panel-${tab.key}`}
            aria-selected={selected === tab.key}
            tabIndex={selected === tab.key ? 0 : -1}
            onClick={() => setSelected(tab.key)}
            onKeyDown={(event) => {
              let next: number;
              if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
              else if (event.key === "ArrowLeft")
                next = (index + tabs.length - 1) % tabs.length;
              else if (event.key === "Home") next = 0;
              else if (event.key === "End") next = tabs.length - 1;
              else return;
              event.preventDefault();
              setSelected(tabs[next]!.key);
              buttons.current[next]?.focus();
            }}
          >
            {tab.label}
            <span>{groups[tab.key].length}</span>
          </button>
        ))}
      </div>
      {tabs.map((tab) => (
        <section
          className={styles.panel}
          key={tab.key}
          id={`${id}-panel-${tab.key}`}
          role="tabpanel"
          aria-labelledby={`${id}-tab-${tab.key}`}
          hidden={selected !== tab.key}
          tabIndex={0}
        >
          {selected === tab.key &&
            (groups[tab.key].length ? (
              <SessionCards
                sessions={groups[tab.key]}
                past={tab.key === "past"}
              />
            ) : (
              <p className={styles.empty}>{tab.empty}</p>
            ))}
        </section>
      ))}
    </div>
  );
}

function SessionCards({
  sessions,
  past = false,
}: Readonly<{ sessions: LearningSession[]; past?: boolean }>) {
  return (
    <div className={styles.cards}>
      {sessions.map((session) => (
        <article className={styles.card} key={session.id}>
          <div className={styles.date}>
            <strong>{formatVietnamTime(session.startAt)}</strong>
            <span>{formatVietnamDayMonth(session.startAt)}</span>
          </div>
          <div className={styles.content}>
            <Status value={session.status} />
            <h3>
              {session.role === "TEACHER"
                ? "Buổi học bạn hướng dẫn"
                : "Buổi học của bạn"}
            </h3>
            <p>
              <time dateTime={session.startAt}>
                {formatTime(session.startAt)}
              </time>{" "}
              – {formatVietnamTime(session.endAt)}
            </p>
          </div>
          <Link
            className={styles.action}
            href={"/learn/sessions/" + session.id}
          >
            {past ? "Xem chi tiết" : "Chi tiết / vào học"}
            <ProductIcon name="arrow" size={17} />
          </Link>
        </article>
      ))}
    </div>
  );
}
