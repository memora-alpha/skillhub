"use client";
import Link from "next/link";
import { useState } from "react";
import { useUserSession } from "../auth/session";
import { useUserResource } from "../hooks/use-user-resource";
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
import type { MaterialOrder } from "./account-types";
import { UserApiError } from "../api/client";
import { readRefundedOrder } from "./material-order-policy";

export function MaterialOrders() {
  const query = useUserResource<MaterialOrder[]>("me/material-orders");
  return (
    <>
      <Back href="/learn/materials" />
      <PageHeading
        title="Đơn tài liệu đã mua"
        description="Hoàn đơn trong 24 giờ nếu chưa từng lấy liên kết tải. Máy chủ kiểm tra điều kiện và số dư bên bán khi xử lý."
      />
      <Feedback
        loading={query.loading}
        error={query.error}
        reload={query.reload}
      />
      <p className="muted">
        Hiển thị tối đa 100 đơn gần nhất theo dữ liệu máy chủ.
      </p>
      <div className="learner-stack">
        {query.data?.map((order) => (
          <OrderCard
            key={order.id + ":" + order.status}
            order={order}
            reload={query.reload}
          />
        ))}
      </div>
      {!query.loading && !query.error && query.data?.length === 0 && (
        <Empty>Bạn chưa có đơn tài liệu.</Empty>
      )}
    </>
  );
}
function OrderCard({
  order,
  reload,
}: {
  order: MaterialOrder;
  reload: () => void;
}) {
  const { request } = useUserSession(),
    command = useUserCommand(true);
  const [review, setReview] = useState(false),
    [done, setDone] = useState(false);
  const refundable = order.status === "SUCCESS" && !done;
  async function refund() {
    const result = await command.run("refund:" + order.id, async () => {
      const current = (
        await request<MaterialOrder[]>("me/material-orders")
      ).data.find((item) => item.id === order.id);
      if (!current) throw new UserApiError(404, "MATERIAL_ORDER_NOT_FOUND");
      if (current.status === "REFUNDED")
        return { data: readRefundedOrder(current, order.id) };
      if (current.status !== "SUCCESS")
        throw new UserApiError(409, "MATERIAL_ORDER_NOT_REFUNDABLE");
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
    <Panel title={order.grossCredit + " CR"}>
      <p>
        Mã đơn: <span className="learner-prose">{order.id}</span>
      </p>
      <Status value={done ? "REFUNDED" : order.status} />
      <p>
        {formatTime(order.createdAt)} · Phiên bản {order.listingVersion}
      </p>
      <div className="learner-actions">
        <Link className="btn" href={"/learn/materials/" + order.materialId}>
          Xem tài liệu
        </Link>
        {refundable && !review && (
          <button className="btn" onClick={() => setReview(true)}>
            Yêu cầu hoàn đơn
          </button>
        )}
      </div>
      {review && refundable && (
        <div className="learner-notice">
          <p>
            Hoàn đơn {order.id} với giá {order.grossCredit} CR sẽ thu hồi quyền
            tải. Tài liệu đã lấy liên kết tải hoặc quá 24 giờ không được hoàn tự
            động.
          </p>
          <div className="learner-actions">
            <button
              className="btn btn-primary"
              disabled={command.pending}
              onClick={() => void refund()}
            >
              {command.pending
                ? "Đang kiểm tra…"
                : command.uncertain
                  ? "Kiểm tra và thử lại đúng đơn"
                  : "Xác nhận hoàn đơn"}
            </button>
            <button
              className="btn"
              disabled={command.pending}
              onClick={() => {
                setReview(false);
                reload();
              }}
            >
              Đóng và làm mới
            </button>
          </div>
        </div>
      )}
      <CommandFeedback command={command} />
      {done && <p role="status">Máy chủ đã xác nhận hoàn đơn.</p>}
    </Panel>
  );
}
