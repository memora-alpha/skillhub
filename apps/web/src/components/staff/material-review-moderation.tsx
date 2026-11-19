"use client";
import { LoadingButton } from "@/components/loading-button";
import { ListPagination } from "@/components/pagination/list-pagination";
import { useStaffListPages } from "./use-staff-list-pages";
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
import { UserProfileReference } from "./user-profile-reference";
import { DecisionDialog, QueueState } from "./common";

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
  const { api, actor } = useStaffSession();
  const [status, setStatus] = useState("REPORTED");
  const [selected, setSelected] = useState<Review>();
  const [dismissReports, setDismissReports] = useState(false);
  const list = useStaffListPages<Review>(
    `material-reviews?status=${status}&limit=20`,
  );
  const decision = reviewDecision(dismissReports, selected?.status);

  return (
    <div className="stack">
      <div className="ops-tabbar">
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
      </div>
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
        flush
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
            className="table admin-responsive-table"
          >
            {list.items.map((review) => {
              const isOwnReview = review.reviewer.id === actor?.userId;
              return (
                <tr key={review.id}>
                  <td data-label="Tài liệu / người đánh giá">
                    <strong>{review.material.title}</strong>
                    <small>
                      <UserProfileReference
                        userId={review.reviewer.id}
                        label="người đánh giá"
                      >
                        {review.reviewer.displayName}
                      </UserProfileReference>
                    </small>
                    <small>{fmtDateTime(review.createdAt)}</small>
                  </td>
                  <td data-label="Nội dung">
                    <strong>★ {review.rating}/5</strong>
                    <p className="prose">
                      {review.comment || "Không có nhận xét bằng chữ."}
                    </p>
                    <StatusBadge status={review.status} />
                  </td>
                  <td data-label="Báo cáo">
                    {review.reports.map((report) => (
                      <details key={report.id}>
                        <summary>
                          {systemCodeLabel(
                            report.reasonCode,
                            "Báo cáo nội dung",
                          )}
                        </summary>
                        <p>{report.description}</p>
                        <small>{fmtDateTime(report.createdAt)}</small>
                      </details>
                    ))}
                    {!review.reports.length && (
                      <span className="muted">Không có báo cáo đang mở</span>
                    )}
                  </td>
                  <td data-label="Thao tác">
                    <div className="row">
                      <button
                        type="button"
                        className={`btn btn-sm ${review.status === "HIDDEN" ? "btn-primary" : "admin-danger-outline"}`}
                        disabled={isOwnReview}
                        title={
                          isOwnReview
                            ? "Không thể tự kiểm duyệt đánh giá của chính bạn"
                            : undefined
                        }
                        onClick={() => {
                          setDismissReports(false);
                          setSelected(review);
                        }}
                      >
                        {review.status === "HIDDEN"
                          ? "Khôi phục đánh giá"
                          : "Ẩn đánh giá"}
                      </button>
                      {review.status === "VISIBLE" &&
                        review.reports.length > 0 && (
                          <button
                            type="button"
                            className="btn btn-sm"
                            disabled={isOwnReview}
                            onClick={() => {
                              setDismissReports(true);
                              setSelected(review);
                            }}
                          >
                            Bác báo cáo, giữ đánh giá
                          </button>
                        )}
                    </div>
                    {isOwnReview && (
                      <small>Cần nhân sự khác kiểm duyệt đánh giá này.</small>
                    )}
                  </td>
                </tr>
              );
            })}
          </DataTable>
          <ListPagination query={list} />
        </QueueState>
      </Card>
      {selected && (
        <DecisionDialog
          key={`${selected.id}:${selected.version}`}
          presentation="drawer"
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
