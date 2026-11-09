"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useUserResource } from "../hooks/use-user-resource";
import {
  reputationPathGoals,
  validReputationPathId,
} from "./reputation-path-label";
import styles from "./reputation-path-source.module.css";

export function ReputationPathSource({ pathId }: Readonly<{ pathId: string }>) {
  const anchor = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const valid = validReputationPathId(pathId);
  useEffect(() => {
    if (!valid) return;
    if (typeof IntersectionObserver === "undefined") {
      const timer = window.setTimeout(() => setVisible(true), 0);
      return () => window.clearTimeout(timer);
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "160px" },
    );
    if (anchor.current) observer.observe(anchor.current);
    return () => observer.disconnect();
  }, [valid]);
  const query = useUserResource<unknown>(
    visible && valid ? `learning-paths/${pathId}` : null,
  );
  const goals = !query.error ? reputationPathGoals(query.data, pathId) : [];
  return (
    <div ref={anchor} className={styles.source}>
      <span className={styles.label}>Điểm uy tín từ lộ trình học</span>
      {valid ? (
        <Link className={styles.link} href={`/learn/paths/${pathId}`}>
          {goals.length ? goals.join(" ↔ ") : `Lộ trình #${pathId.slice(0, 8)}`}{" "}
          <span aria-hidden="true">→</span>
        </Link>
      ) : (
        <p>Chưa có tham chiếu lộ trình hợp lệ.</p>
      )}
      {valid && query.loading && (
        <span className={styles.hint}>Đang tải tên lộ trình…</span>
      )}
      {valid && query.error && (
        <div className={styles.retry}>
          <span className={styles.hint}>
            Chưa tải được tên lộ trình. Bạn có thể mở liên kết để kiểm tra quyền
            truy cập.
          </span>
          <button
            type="button"
            className="btn"
            onClick={() => void query.reload()}
          >
            Thử tải lại tên
          </button>
        </div>
      )}
      <details>
        <summary>Mã tham chiếu lộ trình</summary>
        <p className={styles.code}>{pathId}</p>
      </details>
    </div>
  );
}
