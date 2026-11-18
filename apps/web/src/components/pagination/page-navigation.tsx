"use client";
import { useId } from "react";
import { pageWindow } from "@/lib/pagination/page-window";
import styles from "./page-navigation.module.css";

export type PageNavigationProps = {
  pageNumber: number;
  totalPages?: number;
  hasNext: boolean;
  loading: boolean;
  onPageChange: (page: number) => void;
};
export function PageNavigation({
  pageNumber,
  totalPages,
  hasNext,
  loading,
  onPageChange,
}: Readonly<PageNavigationProps>) {
  const statusId = useId();
  return (
    <nav
      className={styles.navigation}
      aria-label="Phân trang danh sách"
      aria-busy={loading}
      aria-describedby={statusId}
    >
      <button
        type="button"
        className="btn"
        disabled={loading || pageNumber <= 1}
        onClick={() => onPageChange(pageNumber - 1)}
      >
        Trước
      </button>
      <div className={styles.numbers}>
        {pageWindow(pageNumber, totalPages, hasNext).map((page) => (
          <button
            key={page}
            type="button"
            className={`btn ${styles.number}`}
            aria-label={`Trang ${page}`}
            aria-current={page === pageNumber ? "page" : undefined}
            disabled={loading || page === pageNumber}
            onClick={() => onPageChange(page)}
          >
            {page}
          </button>
        ))}
      </div>
      <button
        type="button"
        className="btn"
        disabled={loading || !hasNext}
        onClick={() => onPageChange(pageNumber + 1)}
      >
        Sau
      </button>
      <span id={statusId} className={styles.status} role="status">
        {loading
          ? "Đang tải trang…"
          : `Trang ${pageNumber}${totalPages === undefined ? "" : ` / ${totalPages}`}`}
      </span>
    </nav>
  );
}
