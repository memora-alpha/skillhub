"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useUserSession } from "../auth/session";
import { useUserResource, useUserList } from "../hooks/use-user-resource";
import { useUserCommand } from "../hooks/use-user-command";
import { useClock } from "../hooks/use-clock";
import {
  Back,
  CommandFeedback,
  Empty,
  Feedback,
  More,
  PageHeading,
  Panel,
  Status,
  formatTime,
} from "../components/common";
import { canShowPaymentQr } from "./view-policy";
import type { Payment, PaymentPolicy } from "./account-types";
const paymentLabels: Record<string, string> = {
  CREATED: "Đang chuẩn bị mã QR",
  PENDING: "Đang chờ thanh toán",
  PAID: "Thanh toán thành công",
  REVIEW: "Thanh toán đang được kiểm tra",
  FAILED: "Thanh toán không thành công",
  EXPIRED: "Yêu cầu đã hết hạn",
  CANCELLED: "Yêu cầu nạp đã hủy",
  REFUNDED: "Đã ghi nhận hoàn tiền",
};
function PaymentQr({ payload }: { payload: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string>();
  useEffect(() => {
    let active = true;
    void import("qrcode")
      .then((qr) => {
        if (active && canvas.current)
          return qr.toCanvas(canvas.current, payload, {
            width: 260,
            margin: 4,
            errorCorrectionLevel: "M",
          });
      })
      .catch(() => {
        if (active) setError("Chưa tạo được ảnh QR. Hãy tải lại trạng thái.");
      });
    return () => {
      active = false;
    };
  }, [payload]);
  return (
    <>
      {error ? (
        <p className="learner-error">{error}</p>
      ) : (
        <canvas
          ref={canvas}
          role="img"
          aria-label="Mã QR thanh toán do payOS cung cấp"
          style={{ maxWidth: "100%", height: "auto", background: "white" }}
        />
      )}
    </>
  );
}
export function TopupScreen({ paymentId }: { paymentId?: string }) {
  const { request } = useUserSession(),
    router = useRouter(),
    command = useUserCommand(true),
    cancel = useUserCommand(true),
    now = useClock();
  const policy = useUserResource<PaymentPolicy>("payments/creation-policy"),
    current = useUserResource<Payment>(
      paymentId ? "payments/" + paymentId : null,
    ),
    history = useUserList<Payment>("payments?limit=10");
  const [amount, setAmount] = useState("100000");
  const payment = current.data;
  const pending = payment && ["CREATED", "PENDING"].includes(payment.status),
    expired = !!payment?.expiresAt && Date.parse(payment.expiresAt) <= now;
  return (
    <>
      <Back href="/learn/wallet" />
      <PageHeading
        eyebrow="TIẾP TỤC HÀNH TRÌNH HỌC"
        title="Nạp Credit"
        description="Tạo lệnh nạp và quét QR. Số dư cập nhật khi máy chủ xác nhận thanh toán."
      />
      <div className="learner-two-columns">
        <Panel title="Chọn số tiền nạp">
          <Feedback
            loading={policy.loading}
            error={policy.error}
            reload={policy.reload}
          />
          {policy.data && !policy.data.canCreate && (
            <p className="learner-notice">
              {policy.data.existingPaymentId ? (
                <>
                  Bạn có lệnh nạp cần xử lý.{" "}
                  <Link
                    href={
                      "/learn/wallet/topup?paymentId=" +
                      policy.data.existingPaymentId
                    }
                  >
                    Xem lệnh nạp hiện tại
                  </Link>
                </>
              ) : (
                "Kênh nạp Credit hiện chưa sẵn sàng. Vui lòng thử lại sau."
              )}
            </p>
          )}
          <form
            className="learner-form"
            onSubmit={async (e) => {
              e.preventDefault();
              const result = await command.run("topup:" + amount, (key) =>
                request<Payment>("payments", {
                  method: "POST",
                  key,
                  body: { paymentAmountVnd: amount, gateway: "PAYOS" },
                }),
              );
              if (result)
                router.replace(
                  "/learn/wallet/topup?paymentId=" + result.data.id,
                );
            }}
          >
            <div className="learner-actions">
              {[50000, 100000, 200000, 500000].map((value) => (
                <button
                  type="button"
                  className={
                    amount === String(value) ? "btn btn-primary" : "btn"
                  }
                  aria-pressed={amount === String(value)}
                  key={value}
                  disabled={command.pending || command.uncertain}
                  onClick={() => setAmount(String(value))}
                >
                  {value.toLocaleString("vi-VN")} ₫
                </button>
              ))}
            </div>
            <label>
              Số tiền (VND)
              <input
                type="number"
                min={1000}
                max={2000000}
                step={1000}
                value={amount}
                required
                disabled={command.pending || command.uncertain}
                onChange={(e) => setAmount(e.target.value)}
              />
              <small>Từ 1.000 đến 2.000.000 VND, bội số của 1.000.</small>
            </label>
            <button
              className="btn btn-primary"
              disabled={
                command.pending ||
                (!command.canRetry && !policy.data?.canCreate)
              }
            >
              {command.pending
                ? "Đang tạo lệnh…"
                : command.canRetry
                  ? "Kiểm tra lại cùng yêu cầu"
                  : "Tạo mã QR thanh toán"}
            </button>
          </form>
          <CommandFeedback command={command} />
        </Panel>
        <Panel title="Thanh toán bằng QR">
          <Feedback
            loading={current.loading}
            error={current.error}
            reload={current.reload}
          />
          {payment ? (
            <>
              <Status
                value={payment.status}
                label={paymentLabels[payment.status]}
              />
              <h3>
                {Number(payment.paymentAmountVnd).toLocaleString("vi-VN")} VND ·{" "}
                {payment.creditAmount} CR
              </h3>
              {payment.status === "PAID" ? (
                <p className="learner-notice">
                  Máy chủ đã xác nhận thanh toán.{" "}
                  <Link href="/learn/wallet">Xem số dư ví</Link>
                </p>
              ) : payment.recoveryRequired ? (
                <p className="learner-notice">
                  Lệnh nạp đang cần đối soát. Vui lòng kiểm tra lại trạng thái,
                  tránh chuyển khoản thêm.
                </p>
              ) : canShowPaymentQr(payment, now) && payment.checkout ? (
                <>
                  <PaymentQr
                    key={payment.checkout.qrCode}
                    payload={payment.checkout.qrCode}
                  />
                  <p>Mã lệnh: {payment.checkout.orderCode}</p>
                  {payment.expiresAt && (
                    <p>Hết hạn: {formatTime(payment.expiresAt)}</p>
                  )}
                </>
              ) : (
                <p className="learner-notice">
                  {expired
                    ? "Mã QR đã hết thời gian thanh toán. Kiểm tra lại trạng thái lệnh."
                    : pending
                      ? "Đang chuẩn bị thông tin thanh toán. Kiểm tra lại sau ít giây."
                      : "Lệnh này hiện không có mã QR để thanh toán."}
                </p>
              )}
              <div className="learner-actions">
                <button
                  className="btn"
                  onClick={() => {
                    current.reload();
                    history.reload();
                    policy.reload();
                  }}
                  disabled={current.loading}
                >
                  Kiểm tra trạng thái
                </button>
                {pending && !payment.recoveryRequired && (
                  <button
                    className="btn"
                    disabled={cancel.pending}
                    onClick={() => {
                      void cancel
                        .run("cancel:" + payment.id, (key) =>
                          request("payments/" + payment.id + "/cancel", {
                            method: "POST",
                            key,
                          }),
                        )
                        .then((result) => {
                          if (result) current.reload();
                        });
                    }}
                  >
                    {cancel.pending ? "Đang gửi…" : "Hủy lệnh chưa thanh toán"}
                  </button>
                )}
              </div>
              <CommandFeedback command={cancel} />
            </>
          ) : (
            !current.error && (
              <Empty>Chọn số tiền và tạo lệnh để nhận mã QR.</Empty>
            )
          )}
        </Panel>
      </div>
      <div style={{ marginTop: 24 }}>
        <Panel title="Các lệnh nạp gần đây">
          <Feedback
            loading={history.loading}
            error={history.error}
            reload={history.reload}
          />
          {history.items.map((row) => (
            <Link
              className="product-pending"
              key={row.id}
              href={"/learn/wallet/topup?paymentId=" + row.id}
            >
              <strong>
                {Number(row.paymentAmountVnd).toLocaleString("vi-VN")} VND ·{" "}
                <Status value={row.status} label={paymentLabels[row.status]} />
              </strong>
              <small>{formatTime(row.createdAt)}</small>
            </Link>
          ))}
          {!history.loading && !history.error && !history.items.length && (
            <Empty>Bạn chưa tạo lệnh nạp Credit.</Empty>
          )}
          <More
            cursor={history.cursor}
            loading={history.loading}
            onMore={() => {
              void history.more();
            }}
          />
        </Panel>
      </div>
    </>
  );
}
