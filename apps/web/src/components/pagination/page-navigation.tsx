"use client";
import { LoadingButton } from "@/components/loading-button";
import { LoadingSkeleton } from "@/components/loading-skeleton";
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
  const totalLabel = totalPages === undefined ? "" : ` / ${totalPages}`;
  return (
    <nav
      className={styles.navigation}
      aria-label="Phân trang danh sách"
      aria-busy={loading}
      aria-describedby={statusId}
    >
      <LoadingButton
        type="button"
        className="btn"
        disabled={loading || pageNumber <= 1}
        onClick={() => onPageChange(pageNumber - 1)}
        loading={!!loading}
      >
        Trước
      </LoadingButton>
      <div className={styles.numbers}>
        {pageWindow(pageNumber, totalPages, hasNext).map((page) => (
          <LoadingButton
            key={page}
            type="button"
            className={`btn ${styles.number}`}
            aria-label={`Trang ${page}`}
            aria-current={page === pageNumber ? "page" : undefined}
            disabled={loading || page === pageNumber}
            onClick={() => onPageChange(page)}
            loading={!!loading}
          >
            {page}
          </LoadingButton>
        ))}
      </div>
      <LoadingButton
        type="button"
        className="btn"
        disabled={loading || !hasNext}
        onClick={() => onPageChange(pageNumber + 1)}
        loading={!!loading}
      >
        Sau
      </LoadingButton>
      <span id={statusId} className={styles.status}>
        {loading ? (
          <LoadingSkeleton variant="inline" label="Đang tải trang" />
        ) : (
          <output>{`Trang ${pageNumber}${totalLabel}`}</output>
        )}
      </span>
    </nav>
  );
}
