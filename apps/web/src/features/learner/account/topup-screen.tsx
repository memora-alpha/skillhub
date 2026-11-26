"use client";
import { LoadingButton } from "@/components/loading-button";
import { LoadingSkeleton } from "@/components/loading-skeleton";
import { ListPagination } from "@/components/pagination/list-pagination";
import { useUserPagedList } from "../hooks/use-user-paged-list";
import Link from "next/link";
import { LoadingImage as Image } from "@/components/loading-image";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useUserSession } from "../auth/session";
import { useUserResource } from "../hooks/use-user-resource";
import { useUserCommand } from "../hooks/use-user-command";
import { ProductIcon } from "../components/product-icon";
import { useClock } from "../hooks/use-clock";
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
import { canShowPaymentQr } from "./view-policy";
import styles from "./topup-screen.module.css";
import type { Payment, PaymentPolicy } from "./account-types";
import {
  paymentPolicyText,
  recoverOrCreatePayment,
  validPaymentAmount,
  type PaymentIntent,
} from "./payment-recovery";
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
function PaymentQr({ payload }: Readonly<{ payload: string }>) {
  const [source, setSource] = useState<string>();
  const [error, setError] = useState<string>();
  useEffect(() => {
    let active = true;
    void import("qrcode")
      .then((qr) =>
        qr.toDataURL(payload, {
          width: 260,
          margin: 4,
          errorCorrectionLevel: "M",
        }),
      )
      .then((value) => {
        if (active) setSource(value);
      })
      .catch(() => {
        if (active) setError("Chưa tạo được ảnh QR. Hãy tải lại trạng thái.");
      });
    return () => {
      active = false;
    };
  }, [payload]);
  if (error) return <p className="learner-error">{error}</p>;
  if (!source)
    return (
      <div className={styles.qr}>
        <LoadingSkeleton variant="image" label="Đang tạo mã QR" />
      </div>
    );
  return (
    <div className={styles.qr}>
      <Image
        src={source}
        width={260}
        height={260}
        unoptimized
        alt="Mã QR thanh toán do payOS cung cấp"
        style={{ maxWidth: "100%", height: "auto", background: "white" }}
      />
    </div>
  );
}
export function TopupScreen({ paymentId }: Readonly<{ paymentId?: string }>) {
  const { request, actor } = useUserSession(),
    router = useRouter(),
    command = useUserCommand(true),
    cancel = useUserCommand(true);
  const cache = useQueryClient();
  const [historyStatus, setHistoryStatus] = useState("");
  const policy = useUserResource<PaymentPolicy>("payments/creation-policy"),
    current = useUserResource<Payment>(
      paymentId ? "payments/" + paymentId : null,
      {
        refetchInterval: (value) =>
          !value || ["CREATED", "PENDING", "REVIEW"].includes(value.status)
            ? 5000
            : false,
        retainOnTemporaryError: true,
        pollOnTemporaryError: true,
      },
    ),
    history = useUserPagedList<Payment>(
      "payments?limit=10" + (historyStatus ? "&status=" + historyStatus : ""),
    );
  const storageKey = "skillhub-user-draft:" + actor.userId + ":payment-intent";
  const [savedIntent, setSavedIntent] = useState<PaymentIntent | null>(() => {
    try {
      const value = JSON.parse(
        localStorage.getItem(storageKey) ?? "null",
      ) as PaymentIntent | null;
      return value &&
        /^[0-9a-f-]{36}$/i.test(value.key) &&
        validPaymentAmount(value.amount)
        ? value
        : null;
    } catch {
      return null;
    }
  });
  const intent = useRef(savedIntent);
  const [amount, setAmount] = useState(savedIntent?.amount ?? "100000");
  const [checking, setChecking] = useState(false);
  const [recoveryError, setRecoveryError] = useState<string>();
  const [recoveryNotice, setRecoveryNotice] = useState<string>();
  const payment = current.data;
  const pending = isPendingPayment(payment);
  const unresolved = pending || payment?.status === "REVIEW";
  const currentAmount = unresolved ? payment?.paymentAmountVnd : amount;
  const amountLocked =
    command.pending || command.uncertain || !!savedIntent || !!unresolved;
  useEffect(() => {
    if (!payment?.id || !payment.status) return;
    // A verified receipt refreshes the shared wallet, history and creation gate.
    // Never infer payment success from a return URL or a browser countdown.
    void cache.invalidateQueries({
      predicate: (query) => {
        const [area, userId, path] = query.queryKey;
        return (
          area === "learner" &&
          userId === actor.userId &&
          typeof path === "string" &&
          (path === "payments/creation-policy" ||
            path.startsWith("payments?") ||
            path.startsWith("me/wallet"))
        );
      },
    });
  }, [cache, actor.userId, payment?.id, payment?.status]);
  const createLabel = paymentCreateLabel(
    command.pending,
    !!savedIntent || command.canRetry,
  );
  function paymentPanelTitle() {
    if (unresolved) {
      return "Thông tin đơn nạp" as const;
    }
    if (payment?.status === "PAID") {
      return "Nạp thêm Credit" as const;
    }
    return "Chọn số tiền nạp" as const;
  }
  return (
    <>
      <Back href="/learn/wallet" />
      <PageHeading title="Nạp Credit" />
      <div className={styles.layout}>
        <Panel title={paymentPanelTitle()}>
          <Feedback
            loading={policy.initialLoading}
            error={policy.error}
            reload={policy.reload}
            refreshing={!!(policy.loading && !policy.initialLoading)}
          />
          {unresolved && (
            <p className="learner-notice">
              Bạn đang có đơn cần hoàn tất. Kiểm tra trạng thái đơn này trước
              khi tạo yêu cầu nạp mới.
            </p>
          )}
          <PaymentCreationNotice policy={policy.data} paymentId={paymentId} />
          <form
            className="learner-form"
            onSubmit={async (e) => {
              e.preventDefault();
              setRecoveryNotice(undefined);
              const fingerprint = "topup:" + (intent.current?.amount ?? amount);
              const result = await command.run(fingerprint, (key) => {
                const isRecovery = !!intent.current;
                const value = intent.current ?? { key, amount };
                intent.current = value;
                setSavedIntent(value);
                try {
                  localStorage.setItem(storageKey, JSON.stringify(value));
                } catch {
                  setRecoveryError(
                    "Trình duyệt không lưu được yêu cầu. Giữ màn hình này để khôi phục cùng lệnh.",
                  );
                }
                return recoverOrCreatePayment(request, value, isRecovery);
              });
              if (result) {
                intent.current = null;
                setSavedIntent(null);
                try {
                  localStorage.removeItem(storageKey);
                } catch {
                  /* Preserve confirmed payment navigation. */
                }
                router.replace("/learn/wallet/topup?paymentId=" + result.id);
              }
            }}
          >
            <div className="learner-actions">
              {[50000, 100000, 200000, 500000].map((value) => (
                <LoadingButton
                  type="button"
                  className={
                    currentAmount === String(value) ? "btn btn-primary" : "btn"
                  }
                  aria-pressed={amount === String(value)}
                  key={value}
                  disabled={amountLocked}
                  onClick={() => setAmount(String(value))}
                  loading={!!(command.pending || !!unresolved)}
                >
                  {value.toLocaleString("vi-VN")} ₫
                </LoadingButton>
              ))}
            </div>
            <label>
              <span>Số tiền (VND)</span>
              <input
                type="number"
                min={1000}
                max={2000000}
                step={1000}
                value={currentAmount}
                required
                disabled={amountLocked}
                onChange={(e) => setAmount(e.target.value)}
              />
              <small>Từ 1.000 đến 2.000.000 VND, bội số của 1.000.</small>
            </label>
            <div className="payment-create-actions">
              <LoadingButton
                type="submit"
                className="btn btn-primary"
                disabled={
                  command.pending ||
                  checking ||
                  !!unresolved ||
                  (!savedIntent && !command.canRetry && !policy.data?.canCreate)
                }
                loading={!!(command.pending || checking || !!unresolved)}
              >
                {createLabel}
              </LoadingButton>
              <LoadingButton
                type="button"
                className="btn payment-refresh"
                aria-label="Kiểm tra lại lệnh nạp và lịch sử"
                title="Kiểm tra lại lệnh nạp và lịch sử"
                aria-busy={checking}
                disabled={checking || command.pending}
                onClick={async () => {
                  setChecking(true);
                  setRecoveryError(undefined);
                  setRecoveryNotice(undefined);
                  try {
                    const decision = (
                      await request<PaymentPolicy>("payments/creation-policy")
                    ).data;
                    policy.reload();
                    history.reload();
                    if (paymentId) current.reload();
                    if (decision.existingPaymentId)
                      router.replace(
                        "/learn/wallet/topup?paymentId=" +
                          decision.existingPaymentId,
                      );
                    else
                      setRecoveryNotice(
                        savedIntent
                          ? "Chưa xác định được kết quả yêu cầu trước. Chọn Kiểm tra yêu cầu nạp trước để tiếp tục, tránh tạo đơn trùng."
                          : "Bạn không có đơn đang chờ. Xem các đơn đã tạo trong lịch sử bên dưới.",
                      );
                  } catch (cause) {
                    setRecoveryError(
                      cause instanceof Error
                        ? cause.message
                        : "Chưa đọc được lệnh hiện tại.",
                    );
                  } finally {
                    setChecking(false);
                  }
                }}
                loading={!!(checking || command.pending)}
              >
                <ProductIcon name="refresh" size={19} />
              </LoadingButton>
            </div>
          </form>
          <CommandFeedback command={command} />
          {savedIntent && (
            <p className="learner-notice">
              {(checking || command.pending) && (
                <LoadingSkeleton
                  variant="inline"
                  label="Đang kiểm tra yêu cầu nạp"
                />
              )}
              Yêu cầu nạp {Number(savedIntent.amount).toLocaleString("vi-VN")}{" "}
              VND. Chưa đổi số tiền cho đến khi có kết quả để tránh tạo đơn
              trùng.
            </p>
          )}
          <Feedback error={recoveryError} />
          {recoveryNotice && (
            <p className="learner-notice">
              <output>{recoveryNotice}</output>
            </p>
          )}
          <p className="muted">
            1.000 ₫ = 1 Credit. Credit được cộng khi thanh toán được xác nhận và
            dùng trong SkillHub.
          </p>
        </Panel>
        <Panel
          title={
            payment?.status === "PAID" ? "Đã nạp Credit" : "Hoàn tất thanh toán"
          }
          className={paymentId ? styles.checkout : ""}
        >
          {paymentId && (
            <Feedback
              loading={current.initialLoading}
              error={current.error}
              reload={current.reload}
              refreshing={!!(current.loading && !current.initialLoading)}
            />
          )}
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
              <PaymentCheckout payment={payment} />
              {unresolved && (
                <p className={styles.sync}>
                  Đang tự động kiểm tra thanh toán. Nếu bạn đã chuyển tiền, hãy
                  chờ xác nhận và không chuyển thêm cho đơn này.
                </p>
              )}
              <div className="learner-actions">
                <LoadingButton
                  type="button"
                  className="btn"
                  aria-label="Làm mới trạng thái thanh toán"
                  title="Làm mới trạng thái thanh toán"
                  onClick={() => {
                    current.reload();
                    history.reload();
                    policy.reload();
                  }}
                  disabled={current.loading}
                  loading={!!current.loading}
                >
                  <ProductIcon name="refresh" size={19} />{" "}
                  {current.loading ? "Đang kiểm tra…" : "Kiểm tra thanh toán"}
                </LoadingButton>
                {pending && !payment.recoveryRequired && (
                  <LoadingButton
                    type="button"
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
                    loading={!!cancel.pending}
                  >
                    {cancel.pending ? "Đang gửi…" : "Hủy lệnh chưa thanh toán"}
                  </LoadingButton>
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
        <Panel title="Lịch sử nạp Credit">
          <label>
            Trạng thái
            <select
              value={historyStatus}
              onChange={(event) => setHistoryStatus(event.target.value)}
            >
              <option value="">Tất cả</option>
              {Object.entries(paymentLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <Feedback
            loading={history.initialLoading}
            error={history.error}
            reload={history.reload}
            refreshing={!!(history.loading && !history.initialLoading)}
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
          <ListPagination query={history} />
        </Panel>
      </div>
    </>
  );
}

function PaymentCheckout({ payment }: Readonly<{ payment: Payment }>) {
  const now = useClock();
  const pending = isPendingPayment(payment);
  const expired = !!payment.expiresAt && Date.parse(payment.expiresAt) <= now;
  let unavailable = "Lệnh này hiện không có mã QR để thanh toán.";
  if (expired)
    unavailable =
      "Mã QR đã hết thời gian thanh toán. Kiểm tra lại trạng thái lệnh.";
  if (payment.status === "PAID")
    return (
      <section className={styles.success}>
        <h3>
          <output>Thanh toán thành công</output>
        </h3>
        <p>Đã ghi nhận {payment.creditAmount} Credit vào ví của bạn.</p>
        <Link className="btn btn-primary" href="/learn/wallet">
          Xem ví Credit
        </Link>
      </section>
    );
  if (payment.recoveryRequired)
    return (
      <p className="learner-notice">
        Lệnh nạp đang cần đối soát. Vui lòng kiểm tra lại trạng thái, tránh
        chuyển khoản thêm.
      </p>
    );
  if (canShowPaymentQr(payment, now) && payment.checkout)
    return (
      <>
        <PaymentQr
          key={payment.checkout.qrCode}
          payload={payment.checkout.qrCode}
        />
        <p>Mã lệnh: {payment.checkout.orderCode}</p>
        {payment.expiresAt && <p>Hết hạn: {formatTime(payment.expiresAt)}</p>}
      </>
    );
  if (pending && !expired)
    return (
      <LoadingSkeleton
        variant="image"
        label="Đang chuẩn bị thông tin thanh toán"
      />
    );
  return <p className="learner-notice">{unavailable}</p>;
}

function paymentCreateLabel(pending: boolean, recovery: boolean) {
  if (pending) return "Đang tạo mã QR…";
  if (recovery) return "Kiểm tra yêu cầu nạp trước";
  return "Tạo mã QR thanh toán";
}

function PaymentCreationNotice({
  policy,
  paymentId,
}: Readonly<{ policy: PaymentPolicy | undefined; paymentId?: string }>) {
  if (!policy || policy.canCreate || policy.existingPaymentId === paymentId)
    return null;
  return (
    <p className="learner-notice">
      {policy.existingPaymentId ? (
        <>
          {paymentPolicyText(policy.reasonCode)}{" "}
          <Link
            href={"/learn/wallet/topup?paymentId=" + policy.existingPaymentId}
          >
            Xem lệnh nạp hiện tại
          </Link>
        </>
      ) : (
        paymentPolicyText(policy.reasonCode)
      )}
    </p>
  );
}

function isPendingPayment(payment: Payment | undefined) {
  return !!payment && ["CREATED", "PENDING"].includes(payment.status);
}
