"use client";
import { LoadingButton } from "@/components/loading-button";
import { ListPagination } from "@/components/pagination/list-pagination";
import { useStaffListPages } from "./use-staff-list-pages";
import Link from "next/link";
import { useState } from "react";
import {
  DataTable,
  Card,
  Segmented,
  StatusBadge,
} from "@/components/console/ui";
import { fmtDateTime } from "@/lib/console/format";
import { systemCodeLabel } from "@/lib/system-text";
import { useStaffSession } from "./session";

import { DecisionDialog, QueueState } from "./common";
import styles from "./dashboard.module.css";
type Review = {
  id: string;
  rating: number;
  comment: string | null;
  status: string;
  version: number;
  createdAt: string;
  material: { id: string; title: string };
  reviewer: { id: string; displayName: string };
  reports: {
    id: string;
    reasonCode: string;
    description: string;
    createdAt: string;
  }[];
};
export function MaterialReviewModeration() {
  const { api, portal } = useStaffSession();
  const [status, setStatus] = useState("REPORTED");
  const [selected, setSelected] = useState<Review>();
  const [dismissReports, setDismissReports] = useState(false);
  const list = useStaffListPages<Review>(
    `material-reviews?status=${status}&limit=20`,
  );
  const decision = reviewDecision(dismissReports, selected?.status);
  return (
    <div className={styles.dashboard}>
      <Segmented
        label="Trạng thái đánh giá tài liệu"
        value={status}
        onChange={(value) => {
          setStatus(value);
          setSelected(undefined);
        }}
        options={[
          { id: "REPORTED", label: "Bị báo cáo" },
          { id: "HIDDEN", label: "Đã ẩn" },
        ]}
      />
      <Card
        title="Kiểm duyệt đánh giá tài liệu"
        actions={
          <LoadingButton
            type="button"
            className="btn btn-sm"
            disabled={list.loading}
            onClick={list.reload}
            loading={!!list.loading}
          >
            Làm mới
          </LoadingButton>
        }
      >
        <QueueState
          loading={list.loading}
          error={list.error}
          empty={!list.items.length}
          reload={list.reload}
          emptyTitle="Không có đánh giá cần xử lý"
          emptyDescription="Đánh giá phù hợp trạng thái bạn chọn sẽ xuất hiện tại đây."
        >
          <DataTable
            columns={[
              "Tài liệu / người đánh giá",
              "Nội dung",
              "Báo cáo",
              "Thao tác",
            ]}
            className={styles.table}
            containerClassName={styles.tableScroll}
          >
            {list.items.map((review) => (
              <tr key={review.id}>
                <td>
                  <strong>{review.material.title}</strong>
                  <small>
                    {portal === "admin" ? (
                      <Link href={`/admin/users/${review.reviewer.id}`}>
                        {review.reviewer.displayName}
                      </Link>
                    ) : (
                      review.reviewer.displayName
                    )}
                  </small>
                  <small>{fmtDateTime(review.createdAt)}</small>
                </td>
                <td>
                  <strong>★ {review.rating}/5</strong>
                  <p>{review.comment || "Không có nhận xét bằng chữ."}</p>
                  <StatusBadge status={review.status} />
                </td>
                <td>
                  {review.reports.map((report) => (
                    <details key={report.id}>
                      <summary>
                        {systemCodeLabel(report.reasonCode, "Báo cáo nội dung")}
                      </summary>
                      <p>{report.description}</p>
                      <small>{fmtDateTime(report.createdAt)}</small>
                    </details>
                  ))}
                  {!review.reports.length && "Không có báo cáo đang mở"}
                </td>
                <td>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => {
                      setDismissReports(false);
                      setSelected(review);
                    }}
                  >
                    {review.status === "HIDDEN"
                      ? "Khôi phục đánh giá"
                      : "Ẩn đánh giá"}
                  </button>
                  {review.status === "VISIBLE" && review.reports.length > 0 && (
                    <button
                      type="button"
                      className="btn"
                      onClick={() => {
                        setDismissReports(true);
                        setSelected(review);
                      }}
                    >
                      Bác báo cáo, giữ đánh giá
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </DataTable>
          <ListPagination query={list} />
        </QueueState>
      </Card>
      {selected && (
        <DecisionDialog
          key={`${selected.id}:${selected.version}`}
          title={decision.title}
          description={`Tài liệu: ${selected.material.title}. Ghi lý do để lưu quyết định kiểm duyệt.`}
          min={1}
          max={2000}
          confirmLabel={decision.confirmLabel}
          danger={!dismissReports && selected.status !== "HIDDEN"}
          onClose={() => setSelected(undefined)}
          onReload={list.reload}
          onSubmit={async (reason) => {
            await api(`material-reviews/${selected.id}/${decision.action}`, {
              method: "POST",
              body: { expectedVersion: selected.version, reason },
            });
            void list.reload();
          }}
        />
      )}
    </div>
  );
}

function reviewDecision(dismissReports: boolean, status: string | undefined) {
  if (dismissReports)
    return {
      title: "Bác báo cáo, giữ đánh giá",
      confirmLabel: "Xác nhận bác báo cáo",
      action: "dismiss-reports",
    };
  if (status === "HIDDEN")
    return {
      title: "Khôi phục đánh giá",
      confirmLabel: "Xác nhận khôi phục",
      action: "restore",
    };
  return { title: "Ẩn đánh giá", confirmLabel: "Xác nhận ẩn", action: "hide" };
}
