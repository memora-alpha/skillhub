"use client";
import { LoadingButton } from "@/components/loading-button";
import { ListPagination } from "@/components/pagination/list-pagination";
import { useUserPagedList } from "../hooks/use-user-paged-list";
import Link from "next/link";
import { useRef, useState } from "react";
import { useUserSession } from "../auth/session";

import { useUserCommand } from "../hooks/use-user-command";
import {
  Back,
  CommandFeedback,
  Empty,
  Feedback,
  PageHeading,
  Panel,
  Status,
  formatTime,
} from "../components/common";
import { normalizeTag } from "./tag-policy";
type TagRequest = {
  id: string;
  label: string;
  status: string;
  rejectReason: string | null;
  resultTagId: string | null;
  createdAt: string;
  reviewedAt?: string | null;
};
export function TagRequestsScreen() {
  const { request } = useUserSession();
  const command = useUserCommand(true);
  const [status, setStatus] = useState("");
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const submitted = useRef("");
  const query = useUserPagedList<TagRequest>(
    "me/tag-requests?limit=20" + (status ? "&status=" + status : ""),
  );
  return (
    <>
      <Back href="/learn/explore" />
      <PageHeading
        title="Đề xuất tag của tôi"
        description="Tag mới cần được duyệt trước khi sử dụng."
      />
      <Panel title="Đề xuất một tag mới">
        <form
          className="learner-form"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              const value = command.canRetry
                ? submitted.current
                : normalizeTag(label);
              setError(undefined);
              const result = await command.run(value, (key) => {
                submitted.current = value;
                return request<TagRequest>("tag-requests", {
                  method: "POST",
                  body: { label: value },
                  key,
                });
              });
              if (result) {
                setLabel("");
                setNotice(
                  "Đã ghi nhận yêu cầu. Theo dõi quyết định trong danh sách bên dưới.",
                );
                query.reload();
              }
            } catch (cause) {
              setError(
                cause instanceof Error ? cause.message : "Tag chưa hợp lệ.",
              );
            }
          }}
        >
          <label>
            <span>Tên tag</span>
            <input
              value={label}
              maxLength={80}
              required
              disabled={command.pending || command.uncertain}
              onChange={(e) => setLabel(e.target.value)}
            />
          </label>
          <Feedback error={error} />
          <CommandFeedback command={command} />
          {notice && (
            <p>
              <output>{notice}</output>
            </p>
          )}
          <LoadingButton
            className="btn btn-primary"
            disabled={command.pending}
            type="submit"
            loading={!!command.pending}
          >
            {command.canRetry ? "Kiểm tra lại cùng đề xuất" : "Gửi Admin duyệt"}
          </LoadingButton>
        </form>
      </Panel>
      <label>
        <span>Lọc tình trạng</span>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Tất cả</option>
          <option value="PENDING">Chờ duyệt</option>
          <option value="APPROVED">Đã duyệt</option>
          <option value="REJECTED">Từ chối</option>
        </select>
      </label>
      <Feedback
        loading={query.initialLoading}
        error={query.error}
        reload={query.reload}
        refreshing={!!(query.loading && !query.initialLoading)}
      />
      <LoadingButton
        type="button"
        className="btn"
        onClick={query.reload}
        disabled={query.loading}
        loading={!!query.loading}
      >
        Tải lại trạng thái duyệt
      </LoadingButton>
      <div className="learner-stack">
        {query.items.map((row) => (
          <Panel key={row.id} title={row.label}>
            <Status
              value={row.status}
              label={row.status === "PENDING" ? "Chờ Admin duyệt" : undefined}
            />
            <p>Gửi lúc {formatTime(row.createdAt)}</p>
            {row.reviewedAt && (
              <p>Xét duyệt lúc {formatTime(row.reviewedAt)}</p>
            )}
            {row.resultTagId && (
              <p>
                Mã tag được duyệt: <code>{row.resultTagId}</code>
              </p>
            )}
            {row.rejectReason && <p>Lý do từ chối: {row.rejectReason}</p>}
            {row.status === "APPROVED" && (
              <p>
                Tag đã được duyệt. Tìm và chọn lại tag còn hiệu lực khi soạn
                bài. <Link href="/learn/posts/new">Tạo bài nhu cầu học</Link>
              </p>
            )}
          </Panel>
        ))}
      </div>
      {!query.loading && !query.error && !query.items.length && (
        <Empty>Chưa có yêu cầu trong mục này.</Empty>
      )}
      <ListPagination query={query} />
    </>
  );
}
