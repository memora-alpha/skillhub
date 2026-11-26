"use client";
import { MaterialFilters } from "@/components/material-filters";
import { LoadingButton } from "@/components/loading-button";
import { ListPagination } from "@/components/pagination/list-pagination";
import { useUserPagedList } from "../hooks/use-user-paged-list";
import Link from "next/link";
import { useState } from "react";
import { useUserSession } from "../auth/session";

import { useUserCommand } from "../hooks/use-user-command";
import {
  CommandFeedback,
  Empty,
  Feedback,
  PageHeading,
  Panel,
  Status,
  formatTime,
} from "../components/common";
import type { MaterialOrder } from "./account-types";
import { MaterialsSubnav } from "./materials-subnav";
import { readRefundedOrder } from "./material-order-policy";
import { readCursorSnapshot } from "../api/cursor-snapshot";
import { UserApiError, userErrorText } from "../api/client";
import { MaterialOrderDownload } from "./material-order-download";

export function MaterialOrders() {
  const [filters, setFilters] = useState("");
  const query = useUserPagedList<MaterialOrder>(
    "me/material-orders?limit=20&" + filters,
  );
  return (
    <>
      <MaterialsSubnav current="/learn/materials/orders" />
      <PageHeading
        eyebrow="Kho tài liệu số"
        title="Đơn tài liệu đã mua"
        description="Xem bản ghi tài liệu tại thời điểm mua, quyền tải tệp và điều kiện hoàn Credit của từng đơn."
      />
      <MaterialFilters value={filters} onApply={setFilters} />
      <Feedback
        loading={query.initialLoading}
        error={query.error}
        reload={query.reload}
        refreshing={!!(query.loading && !query.initialLoading)}
      />
      <div className="learner-stack">
        {query.items.map((order) => (
          <OrderCard
            key={order.id + ":" + order.status}
            order={order}
            reload={query.reload}
          />
        ))}
      </div>
      <ListPagination query={query} />
      {!query.loading && !query.error && query.items.length === 0 && (
        <Empty>Bạn chưa có đơn tài liệu.</Empty>
      )}
    </>
  );
}
function OrderCard({
  order,
  reload,
}: Readonly<{
  order: MaterialOrder;
  reload: () => void;
}>) {
  const { request } = useUserSession(),
    command = useUserCommand(true);
  const [review, setReview] = useState(false),
    [done, setDone] = useState(false);
  const [inspectedOrder, setInspectedOrder] = useState(order);
  const freshOrder =
    Date.parse(order.refundEligibility?.evaluatedAt ?? "") >
    Date.parse(inspectedOrder.refundEligibility?.evaluatedAt ?? "")
      ? order
      : inspectedOrder;
  const [checking, setChecking] = useState(false);
  const [downloadConfirming, setDownloadConfirming] = useState(false);
  const [inspectionError, setInspectionError] = useState<string>();
  const refundable = freshOrder.refundEligibility?.canRefund === true && !done;
  async function readOrder() {
    const rows = await readCursorSnapshot<MaterialOrder>(
      (path, signal) => request<MaterialOrder[]>(path, { signal }),
      "me/material-orders?limit=100",
      undefined,
      (item) => item.id === order.id,
    );
    const fresh = rows.find((item) => item.id === order.id);
    if (!fresh) throw new UserApiError(404, "MATERIAL_ORDER_NOT_FOUND");
    setInspectedOrder(fresh);
    return fresh;
  }
  async function inspect() {
    if (checking) return;
    setChecking(true);
    setInspectionError(undefined);
    try {
      const fresh = await readOrder();
      if (fresh.status === "REFUNDED") {
        setDone(true);
        setReview(false);
        command.resetAfterRead();
        reload();
      } else setReview(fresh.refundEligibility?.canRefund === true);
    } catch (cause) {
      setInspectionError(
        cause instanceof Error ? cause.message : "Chưa kiểm tra được đơn mua.",
      );
    } finally {
      setChecking(false);
    }
  }
  const confirmLabel = command.uncertain
    ? "Kiểm tra và thử lại đúng đơn"
    : "Xác nhận hoàn đơn";
  async function refund() {
    const result = await command.run("refund:" + order.id, async () => {
      const fresh = await readOrder();
      if (fresh.status === "REFUNDED") return { data: fresh };
      if (!fresh.refundEligibility?.canRefund)
        throw new UserApiError(
          409,
          fresh.refundEligibility?.reasonCode ??
            "MATERIAL_ORDER_NOT_REFUNDABLE",
        );
      const result = await request<unknown>(
        "me/material-orders/" + order.id + "/refund",
        { method: "POST" },
      );
      return { data: readRefundedOrder(result.data, order.id) };
    });
    if (result) {
      setDone(result.data.status === "REFUNDED");
      setReview(false);
      reload();
    }
  }
  return (
    <Panel title={order.purchasedMaterial?.title ?? "Tài liệu đã mua"}>
      <p>
        <strong>{order.grossCredit} CR</strong> ·{" "}
        {order.purchasedMaterial?.originalFilename ??
          "Thông tin tệp theo đơn mua"}
      </p>
      <details>
        <summary>Mã đơn mua</summary>
        <p className="learner-prose">{order.id}</p>
      </details>
      <Status value={done ? "REFUNDED" : order.status} />
      <p>
        {formatTime(order.createdAt)} · Phiên bản {order.listingVersion}
      </p>
      <div className="learner-actions">
        <Link className="btn" href={"/learn/materials/" + order.materialId}>
          Xem tài liệu
        </Link>
        {(order.review?.canReview || order.review?.hasReview) && (
          <Link
            className="btn"
            href={"/learn/materials/" + order.materialId + "#material-reviews"}
          >
            {order.review.hasReview
              ? "Xem đánh giá của tôi"
              : "Đánh giá tài liệu"}
          </Link>
        )}
        {refundable && !review && (
          <LoadingButton
            type="button"
            className="btn"
            disabled={checking || command.pending || downloadConfirming}
            onClick={() => void inspect()}
            loading={!!(checking || command.pending)}
          >
            {checking ? "Đang kiểm tra…" : "Yêu cầu hoàn đơn"}
          </LoadingButton>
        )}
      </div>
      {!done &&
        freshOrder.status === "SUCCESS" &&
        freshOrder.refundEligibility?.reasonCode !==
          "MATERIAL_ENTITLEMENT_NOT_ACTIVE" && (
          <MaterialOrderDownload
            materialId={order.materialId}
            onAccessed={reload}
            disabled={
              (review && refundable) ||
              checking ||
              command.pending ||
              command.uncertain
            }
            onConfirmingChange={setDownloadConfirming}
          />
        )}
      {!done && freshOrder.refundEligibility && (
        <p className="muted">
          {refundable
            ? `Có thể hoàn đến ${formatTime(freshOrder.refundEligibility.deadline)}. Điều kiện sẽ được kiểm tra lại khi xác nhận.`
            : userErrorText(
                409,
                freshOrder.refundEligibility.reasonCode ??
                  "MATERIAL_ORDER_NOT_REFUNDABLE",
              )}
        </p>
      )}
      <Feedback error={inspectionError} />
      {review && refundable && (
        <div className="learner-notice">
          <p>
            Hoàn đơn {order.id} với giá {order.grossCredit} CR sẽ thu hồi quyền
            tải. Tài liệu đã lấy liên kết tải hoặc quá 24 giờ không được hoàn tự
            động.
          </p>
          <div className="learner-actions">
            <LoadingButton
              type="button"
              className="btn btn-primary"
              disabled={command.pending}
              onClick={() => void refund()}
              loading={!!command.pending}
            >
              {command.pending ? "Đang kiểm tra…" : confirmLabel}
            </LoadingButton>
            <LoadingButton
              type="button"
              className="btn"
              disabled={command.pending}
              onClick={() => {
                setReview(false);
                reload();
              }}
              loading={!!command.pending}
            >
              Đóng và làm mới
            </LoadingButton>
          </div>
        </div>
      )}
      <CommandFeedback command={command} />
      {command.uncertain && (
        <LoadingButton
          type="button"
          className="btn"
          disabled={checking || command.pending}
          onClick={() => void inspect()}
          loading={!!(checking || command.pending)}
        >
          Kiểm tra kết quả hoàn đơn
        </LoadingButton>
      )}
      {done && (
        <p>
          <output>Máy chủ đã xác nhận hoàn đơn.</output>
        </p>
      )}
    </Panel>
  );
}
