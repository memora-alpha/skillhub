"use client";
import Link from "next/link";
import { useState } from "react";
import { useUserSession } from "../auth/session";
import { useUserList } from "../hooks/use-user-resource";
import { useUserCommand } from "../hooks/use-user-command";
import {
  Back,
  CommandFeedback,
  Empty,
  Feedback,
  PageHeading,
  Panel,
  More,
  Status,
  formatTime,
} from "../components/common";
import type { MaterialOrder } from "./account-types";
import { readRefundedOrder } from "./material-order-policy";

export function MaterialOrders() {
  const query = useUserList<MaterialOrder>("me/material-orders?limit=20");
  return (
    <>
      <Back href="/learn/materials" />
      <PageHeading
        title="Đơn tài liệu đã mua"
        description="Có thể hoàn trong 24 giờ nếu chưa lấy liên kết tải."
      />
      <Feedback
        loading={query.loading}
        error={query.error}
        reload={query.reload}
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
      <More
        cursor={query.cursor}
        loading={query.loading}
        onMore={() => {
          void query.more();
        }}
      />
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
  const refundable = order.status === "SUCCESS" && !done;
  const confirmLabel = command.uncertain
    ? "Kiểm tra và thử lại đúng đơn"
    : "Xác nhận hoàn đơn";
  async function refund() {
    const result = await command.run("refund:" + order.id, async () => {
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
          <button type="button" className="btn" onClick={() => setReview(true)}>
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
              type="button"
              className="btn btn-primary"
              disabled={command.pending}
              onClick={() => void refund()}
            >
              {command.pending ? "Đang kiểm tra…" : confirmLabel}
            </button>
            <button
              type="button"
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
      {done && (
        <p>
          <output>Máy chủ đã xác nhận hoàn đơn.</output>
        </p>
      )}
    </Panel>
  );
}
