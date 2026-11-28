"use client";
import { LoadingButton } from "@/components/loading-button";
import { ListPagination } from "@/components/pagination/list-pagination";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { safeDownloadUrl } from "../account/view-policy";
import { useUserSession } from "../auth/session";
import { Empty, Feedback, Panel, formatTime } from "../components/common";
import { ProductIcon } from "../components/product-icon";
import {
  redemptionLabels,
  redemptionMetadata,
  type Redemption,
  type RewardProduct,
  type VoucherSecret,
} from "./reward-contract";
import {
  computeCreditShortfall,
  computeRemainingCredit,
  formatComputedCredit,
  formatCreditAmount,
  formatVnd,
  redemptionStatusHint,
  redemptionStatusTone,
  type RedemptionTone,
} from "./reward-presentation";
import { BrandArtwork } from "./voucher-artwork";
import styles from "./vouchers-screen.module.css";

const SECRET_TTL_MS = 30_000;

const STATUS_CLASS: Record<RedemptionTone, string | undefined> = {
  success: styles.statusSuccess,
  progress: styles.statusProgress,
  warn: styles.statusWarn,
  refunded: styles.statusRefunded,
  neutral: styles.statusNeutral,
};

export function RedemptionStatusBadge({
  status,
}: Readonly<{ status: string }>) {
  const tone = redemptionStatusTone(status);
  return (
    <span className={`${styles.statusPill} ${STATUS_CLASS[tone] ?? ""}`}>
      <span className={styles.statusDot} aria-hidden="true" />
      {redemptionLabels[status] ?? status}
    </span>
  );
}

export function ProductDetailsView({
  product,
  availableCredit,
  disabled,
  hasPendingIntent,
  busy,
  redeem,
}: Readonly<{
  product: RewardProduct;
  availableCredit: number | null;
  disabled: boolean;
  hasPendingIntent: boolean;
  busy: boolean;
  redeem: () => void;
}>) {
  const shortfall = computeCreditShortfall(
    product.priceCredit,
    availableCredit,
  );
  const remaining = computeRemainingCredit(
    product.priceCredit,
    availableCredit,
  );

  return (
    <div className={styles.detailLayout}>
      <section className={styles.detailCard} aria-label="Thông tin voucher">
        <div className={styles.detailHero}>
          <BrandArtwork
            src={product.brand.logoUrl}
            fallbackSrc={product.imageUrl}
            name={product.brand.name}
            size="lg"
          />
          <div className={styles.detailHeroCopy}>
            <div className={styles.detailKickerRow}>
              <span className={styles.detailBrandLabel}>
                {product.brand.name}
              </span>
              {product.category && (
                <span className={styles.categoryPill}>{product.category}</span>
              )}
            </div>
            <h2>{product.name}</h2>
          </div>
        </div>

        <div className={styles.detailBody}>
          <div className={styles.factGrid}>
            <div className={styles.factTile}>
              <span>Mệnh giá voucher</span>
              <strong>{formatVnd(product.faceValueVnd)}</strong>
            </div>
            <div className={`${styles.factTile} ${styles.factTileAccent}`}>
              <span>Giá quy đổi</span>
              <strong>{formatCreditAmount(product.priceCredit)} Credit</strong>
            </div>
            <div className={styles.factTile}>
              <span>Thời hạn sử dụng</span>
              <strong>
                {product.validityDays !== null
                  ? `${product.validityDays} ngày`
                  : "Theo nhà cung cấp"}
              </strong>
            </div>
          </div>

          <div className={styles.termsBox}>
            <h3>
              <ProductIcon name="info" size={17} />
              Điều kiện & hướng dẫn sử dụng
            </h3>
            {product.terms ? (
              <p className="learner-prose">{product.terms}</p>
            ) : (
              <p>
                Áp dụng theo điều kiện hiện hành của thương hiệu{" "}
                {product.brand.name}.
              </p>
            )}
            {product.validityDays !== null && (
              <p>
                Thời hạn sử dụng: <strong>{product.validityDays} ngày</strong>{" "}
                theo điều kiện nhà cung cấp.
              </p>
            )}
          </div>

          <ul className={styles.safetyList} aria-label="Lưu ý đổi voucher">
            <li className={styles.safetyItem}>
              <ProductIcon name="shield" size={16} />
              <span>
                Giá đổi và hạn mức được máy chủ kiểm tra trực tiếp tại thời điểm
                xác nhận.
              </span>
            </li>
            <li className={styles.safetyItem}>
              <ProductIcon name="eye" size={16} />
              <span>
                Mã voucher được bảo mật, chỉ hiển thị khi bạn nhấn xem và tự
                động ẩn sau 30 giây.
              </span>
            </li>
            <li className={styles.safetyItem}>
              <ProductIcon name="refresh" size={16} />
              <span>
                Nếu nhà cung cấp không thể phát hành mã, hệ thống sẽ hoàn trả
                đầy đủ Credit về ví của bạn.
              </span>
            </li>
          </ul>
        </div>
      </section>

      <aside className={styles.checkoutCard} aria-label="Xác nhận đổi voucher">
        <div className={styles.checkoutHead}>
          <h3>Xác nhận đổi voucher</h3>
          <p>Kiểm tra số dư và điều kiện trước khi xác nhận giao dịch.</p>
        </div>

        <div className={styles.summaryTable}>
          <div className={styles.summaryRow}>
            <span>Thương hiệu</span>
            <strong>{product.brand.name}</strong>
          </div>
          <div className={styles.summaryRow}>
            <span>Mệnh giá</span>
            <strong>{formatVnd(product.faceValueVnd)}</strong>
          </div>
          {availableCredit !== null && (
            <div className={styles.summaryRow}>
              <span>Số dư khả dụng</span>
              <strong>{formatComputedCredit(availableCredit)} Credit</strong>
            </div>
          )}
          <div className={styles.summaryDivider} />
          <div className={styles.summaryTotal}>
            <span>Cần thanh toán</span>
            <strong>{formatCreditAmount(product.priceCredit)} Credit</strong>
          </div>
          {remaining !== null && (
            <div className={styles.summaryRow}>
              <span>Số dư dự kiến sau đổi</span>
              <strong>
                {remaining >= 0
                  ? `${formatComputedCredit(remaining)} Credit`
                  : "Chưa đủ số dư"}
              </strong>
            </div>
          )}
        </div>

        {shortfall > 0 && (
          <div className={styles.shortfallAlert} role="note">
            <span>
              Bạn cần thêm khoảng{" "}
              <strong>{formatComputedCredit(shortfall)} Credit</strong> để đổi
              voucher này.
            </span>
            <Link href="/learn/wallet/topup">Nạp thêm Credit →</Link>
          </div>
        )}

        <form
          className={styles.redeemForm}
          onSubmit={(event) => {
            event.preventDefault();
            if (!disabled) redeem();
          }}
        >
          <label className={styles.consentBox}>
            <input type="checkbox" required disabled={disabled} />
            <span>
              Tôi đã kiểm tra giá đổi và điều kiện sử dụng của voucher này.
            </span>
          </label>
          <LoadingButton
            type="submit"
            className={`btn btn-primary ${styles.redeemSubmit}`}
            disabled={disabled}
            loading={busy}
          >
            <ProductIcon name="gift" size={17} />
            Xác nhận đổi {formatCreditAmount(product.priceCredit)} Credit
          </LoadingButton>
          {hasPendingIntent && (
            <p className={styles.pendingLockHint}>
              Bạn đang có một yêu cầu đổi thưởng chưa xác nhận ở phía trên. Hãy
              kiểm tra yêu cầu đó trước khi đổi thêm.
            </p>
          )}
        </form>
      </aside>
    </div>
  );
}

export function RedemptionDetailsPanel({
  id,
  known,
  reload,
  onClose,
}: Readonly<{
  id: string;
  known?: Redemption;
  reload: () => void;
  onClose?: () => void;
}>) {
  const { request } = useUserSession();
  const [fetched, setFetched] = useState<Redemption>();
  const [revealed, setRevealed] = useState<{
    secret: VoucherSecret;
    expiresAtMs: number;
  } | null>(null);
  const [nowMs, setNowMs] = useState<number>(0);
  const [copiedKey, setCopiedKey] = useState<"code" | "pin" | null>(null);
  const [error, setError] = useState<string>();
  const [revealing, setRevealing] = useState(false);
  const revealLock = useRef(false);
  const active = useRef<AbortController | null>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Metadata lấy từ danh sách để không gọi chi tiết (BE ghi audit VOUCHER_REVEAL mỗi lần GET chi tiết).
  const metadata = known ?? fetched;
  const pending =
    !!metadata && ["ISSUING", "MANUAL_REVIEW"].includes(metadata.status);
  const secret = revealed?.secret;

  useEffect(() => {
    const controller = new AbortController();
    active.current = controller;
    const hide = () => {
      setRevealed(null);
      setCopiedKey(null);
    };
    window.addEventListener("blur", hide);
    document.addEventListener("visibilitychange", hide);
    return () => {
      controller.abort();
      window.removeEventListener("blur", hide);
      document.removeEventListener("visibilitychange", hide);
      if (copyTimer.current) clearTimeout(copyTimer.current);
    };
  }, [request, id]);

  useEffect(() => {
    if (!pending) return;
    const timer = setInterval(reload, 5000);
    return () => clearInterval(timer);
  }, [pending, reload]);

  useEffect(() => {
    if (!revealed) return;
    const remainingMs = Math.max(0, revealed.expiresAtMs - Date.now());
    const hideTimer = setTimeout(() => {
      setRevealed(null);
      setCopiedKey(null);
    }, remainingMs);
    const tickTimer = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => {
      clearTimeout(hideTimer);
      clearInterval(tickTimer);
    };
  }, [revealed]);

  async function reveal() {
    if (revealLock.current || !active.current || document.hidden) return;
    revealLock.current = true;
    setRevealing(true);
    setError(undefined);
    try {
      const reply = await request<Redemption>(`rewards/redemptions/${id}`, {
        signal: active.current.signal,
      });
      if (
        !active.current.signal.aborted &&
        !document.hidden &&
        document.hasFocus()
      ) {
        setFetched(redemptionMetadata(reply.data));
        if (reply.data.voucher) {
          const now = Date.now();
          setNowMs(now);
          setRevealed({
            secret: reply.data.voucher,
            expiresAtMs: now + SECRET_TTL_MS,
          });
        } else {
          setRevealed(null);
        }
      }
    } catch (cause) {
      if (!active.current.signal.aborted) {
        setError(
          cause instanceof Error ? cause.message : "Chưa xem được mã voucher.",
        );
      }
    } finally {
      revealLock.current = false;
      if (!active.current.signal.aborted) setRevealing(false);
    }
  }

  async function handleCopy(field: "code" | "pin", text: string) {
    try {
      if (!navigator.clipboard) return;
      await navigator.clipboard.writeText(text);
      setCopiedKey(field);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      /* Clipboard permission may be restricted; user can still select text directly. */
    }
  }

  const tone = metadata ? redemptionStatusTone(metadata.status) : "neutral";
  const headToneClass =
    tone === "warn"
      ? styles.redemptionHeadWarn
      : tone === "refunded"
        ? styles.redemptionHeadRefunded
        : "";
  const secondsLeft = revealed
    ? Math.max(
        0,
        Math.min(30, Math.ceil((revealed.expiresAtMs - nowMs) / 1000)),
      )
    : 0;
  const countdownPercent = Math.round((secondsLeft / 30) * 100);

  return (
    <section
      className={`${styles.redemptionCard} ${
        tone === "success" ? styles.redemptionCardIssued : ""
      }`}
      aria-label="Chi tiết kết quả đổi thưởng"
    >
      <div className={`${styles.redemptionHead} ${headToneClass}`}>
        <div className={styles.redemptionIdentity}>
          {metadata && (
            <BrandArtwork
              src={metadata.product.imageUrl}
              name={metadata.product.brandName}
              size="md"
            />
          )}
          <div className={styles.redemptionHeadingCopy}>
            <span className="panel-kicker">Kết quả đổi thưởng</span>
            <h2>{metadata?.product.name ?? "Chi tiết mã voucher"}</h2>
            {metadata && (
              <p className={styles.redemptionMetaLine}>
                <span>{metadata.product.brandName}</span>
                <span>·</span>
                <span>Mệnh giá {formatVnd(metadata.faceValueVnd)}</span>
                <span>·</span>
                <strong>
                  {formatCreditAmount(metadata.priceCredit)} Credit
                </strong>
                {metadata.expiresAt && (
                  <>
                    <span>·</span>
                    <span>Hết hạn {formatTime(metadata.expiresAt)}</span>
                  </>
                )}
              </p>
            )}
          </div>
        </div>
        {metadata && <RedemptionStatusBadge status={metadata.status} />}
      </div>

      <div className={styles.redemptionBody}>
        <Feedback error={error} />

        {metadata && (
          <div className={styles.statusHintBox} role="status">
            <ProductIcon
              name={pending ? "clock" : tone === "success" ? "shield" : "info"}
              size={17}
            />
            <span>{redemptionStatusHint(metadata.status)}</span>
          </div>
        )}

        <div className={styles.redemptionActions}>
          {(!metadata || metadata.status === "ISSUED") && (
            <LoadingButton
              type="button"
              className="btn btn-primary"
              loading={revealing}
              onClick={() => {
                if (secret) {
                  setRevealed(null);
                  setCopiedKey(null);
                } else {
                  void reveal();
                }
              }}
            >
              <ProductIcon name={secret ? "eyeOff" : "eye"} size={16} />
              {secret
                ? "Ẩn mã voucher"
                : metadata
                  ? "Xem mã voucher"
                  : "Xem kết quả / mã voucher"}
            </LoadingButton>
          )}
          {pending && (
            <button type="button" className="btn" onClick={reload}>
              <ProductIcon name="refresh" size={15} />
              Cập nhật trạng thái
            </button>
          )}
          {onClose && (
            <button type="button" className="btn" onClick={onClose}>
              Đóng khung xem nhanh
            </button>
          )}
        </div>

        {secret && (
          <div className={styles.secretVault} aria-label="Thông tin voucher">
            <div className={styles.secretVaultTop}>
              <span className={styles.secretVaultTitle}>
                <ProductIcon name="shield" size={16} />
                Thông tin mã voucher bảo mật
              </span>
              <span className={styles.countdownPill} aria-live="polite">
                <ProductIcon name="clock" size={13} />
                Tự ẩn sau {secondsLeft}s
              </span>
            </div>

            <div className={styles.countdownTrack} aria-hidden="true">
              <span
                className={styles.countdownFill}
                style={{ width: `${countdownPercent}%` }}
              />
            </div>

            <div className={styles.secretFields}>
              <div className={styles.secretRow}>
                <div className={styles.secretFieldMeta}>
                  <small>Mã voucher</small>
                  <code className={styles.secretCode}>
                    {secret.code || "Không có"}
                  </code>
                </div>
                {secret.code && (
                  <button
                    type="button"
                    className={`btn ${styles.copyBtn}`}
                    onClick={() => void handleCopy("code", secret.code!)}
                  >
                    <ProductIcon
                      name={copiedKey === "code" ? "check" : "copy"}
                      size={15}
                    />
                    {copiedKey === "code" ? "Đã sao chép" : "Sao chép mã"}
                  </button>
                )}
              </div>

              {secret.pin && (
                <div className={styles.secretRow}>
                  <div className={styles.secretFieldMeta}>
                    <small>Mã PIN</small>
                    <code className={styles.secretCode}>{secret.pin}</code>
                  </div>
                  <button
                    type="button"
                    className={`btn ${styles.copyBtn}`}
                    onClick={() => void handleCopy("pin", secret.pin!)}
                  >
                    <ProductIcon
                      name={copiedKey === "pin" ? "check" : "copy"}
                      size={15}
                    />
                    {copiedKey === "pin" ? "Đã sao chép" : "Sao chép PIN"}
                  </button>
                </div>
              )}
            </div>

            <div className={styles.secretFooter}>
              {safeDownloadUrl(secret.link) && (
                <a
                  className="btn btn-primary"
                  href={secret.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  referrerPolicy="no-referrer"
                >
                  <ProductIcon name="externalLink" size={15} />
                  Mở voucher của nhà cung cấp
                </a>
              )}
              <small className={styles.secretSafetyNote}>
                Mã tự ẩn sau 30 giây hoặc ngay khi bạn chuyển cửa sổ / rời màn
                hình.
              </small>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export function RedemptionHistorySection({
  items,
  loading,
  error,
  reload,
  activeId,
  pagination,
  onExploreCatalog,
}: Readonly<{
  items: readonly Redemption[];
  loading: boolean;
  error?: string;
  reload: () => void;
  activeId?: string;
  pagination: {
    items: readonly unknown[];
    pageNumber: number;
    totalPages?: number;
    hasNext: boolean;
    loading: boolean;
    goToPage: (page: number) => unknown;
  };
  onExploreCatalog?: () => void;
}>) {
  return (
    <Panel>
      <div className="panel-head">
        <div>
          <span className="panel-kicker">Voucher đã đổi</span>
          <h2>Lịch sử đổi thưởng</h2>
        </div>
        <Link href="/learn/wallet">Xem sổ cái ví →</Link>
      </div>

      <Feedback loading={loading} error={error} reload={reload} />

      {!loading && !error && items.length === 0 && (
        <Empty>
          <div>
            Bạn chưa đổi voucher nào. Hãy khám phá danh mục ưu đãi để dùng
            Credit khả dụng đổi quà ngay.
          </div>
          {onExploreCatalog && (
            <div className={styles.emptyActionWrap}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={onExploreCatalog}
              >
                Khám phá danh mục voucher
              </button>
            </div>
          )}
        </Empty>
      )}

      {items.length > 0 && (
        <div className={styles.historyList}>
          {items.map((row) => {
            const isSelected = activeId === row.id;
            return (
              <article
                key={row.id}
                className={`${styles.historyRow} ${
                  isSelected ? styles.historyRowActive : ""
                }`}
              >
                <div className={styles.historyMain}>
                  <BrandArtwork
                    src={row.product.imageUrl}
                    name={row.product.brandName}
                    size="sm"
                  />
                  <div className={styles.historyInfo}>
                    <div className={styles.historyTitleRow}>
                      <h3>{row.product.name}</h3>
                      <RedemptionStatusBadge status={row.status} />
                    </div>
                    <div className={styles.historyMeta}>
                      <span>{row.product.brandName}</span>
                      <span>·</span>
                      <span>{formatTime(row.createdAt)}</span>
                      {row.expiresAt && (
                        <>
                          <span>·</span>
                          <span>HSD đến {formatTime(row.expiresAt)}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className={styles.historyRight}>
                  <div className={styles.historyCost}>
                    <strong>−{formatCreditAmount(row.priceCredit)} CR</strong>
                    <small>{formatVnd(row.faceValueVnd)}</small>
                  </div>
                  <Link
                    className={
                      row.status === "ISSUED"
                        ? "btn btn-sm btn-primary"
                        : "btn btn-sm"
                    }
                    href={`/learn/vouchers/mine/${row.id}`}
                  >
                    <ProductIcon
                      name={row.status === "ISSUED" ? "eye" : "info"}
                      size={14}
                    />
                    {row.status === "ISSUED" ? "Xem mã voucher" : "Xem kết quả"}
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <ListPagination query={pagination} />
    </Panel>
  );
}
