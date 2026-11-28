"use client";
import { LoadingButton } from "@/components/loading-button";
import { ListPagination } from "@/components/pagination/list-pagination";
import { financeNumber } from "@/lib/staff/finance-presentation";
import {
  chargeKindLabel,
  computeAnnualSavings,
  formatEntitlementHighlights,
  formatStorageBytes,
  intervalLabel,
  intervalPeriodLabel,
  maxAnnualSavingsPercent,
  planDisplayName,
  planTagline,
  recordingUsagePercent,
  storageUsagePercent,
  subscriptionStatusLabel,
} from "@/lib/subscriptions/presentation";
import Link from "next/link";
import { useState } from "react";
import { useUserSession } from "../auth/session";
import {
  Empty,
  Feedback,
  PageHeading,
  Panel,
  Status,
  formatTime,
} from "../components/common";
import { ProductIcon } from "../components/product-icon";
import { useUserPagedList } from "../hooks/use-user-paged-list";
import { useUserResource } from "../hooks/use-user-resource";
import type {
  MySubscriptionSnapshot,
  PlanEntitlements,
  SubscriptionCharge,
  SubscriptionInterval,
  SubscriptionPlan,
  SubscriptionPlanCode,
  SubscriptionUpgradeQuote,
} from "../types";
import type { Wallet } from "./account-types";
import styles from "./subscription-screen.module.css";

const DEFAULT_ADDON_MINUTES = 60;
const DEFAULT_ADDON_PRICE_CREDIT = 30;
const ADDON_PACK_PRESETS = [1, 2, 3, 5] as const;

const FREE_REFERENCE_ENTITLEMENTS: PlanEntitlements = {
  feeTier: null,
  materialStorageBytes: "1000000000",
  whiteboardRetentionDays: 30,
  recordingMinutesPerPeriod: 0,
  recordingRetentionDays: 30,
  recordingAddonAllowed: false,
};

function formatError(cause: unknown, fallback: string): string {
  return cause instanceof Error ? cause.message : fallback;
}

function parseCreditNumber(raw: string | undefined): number | null {
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function meterToneClass(percent: number): { fill: string; badge: string } {
  if (percent >= 95) {
    return {
      fill: `${styles.meterFill ?? ""} ${styles.meterFillDanger ?? ""}`,
      badge: `${styles.meterPercent ?? ""} ${styles.meterPercentDanger ?? ""}`,
    };
  }
  if (percent >= 80) {
    return {
      fill: `${styles.meterFill ?? ""} ${styles.meterFillWarn ?? ""}`,
      badge: `${styles.meterPercent ?? ""} ${styles.meterPercentWarn ?? ""}`,
    };
  }
  return {
    fill: styles.meterFill ?? "",
    badge: styles.meterPercent ?? "",
  };
}

function planSortOrder(code: SubscriptionPlanCode): number {
  return code === "CREATOR" ? 1 : 2;
}

function CurrentSubscriptionSection({
  snapshot,
  busyAction,
  onToggleAutoRenew,
  onScheduleChange,
}: Readonly<{
  snapshot: MySubscriptionSnapshot;
  busyAction: string | null;
  onToggleAutoRenew: (next: boolean) => void;
  onScheduleChange: (
    actionKey: string,
    patch: {
      scheduledPlanCode?: SubscriptionPlanCode | null;
      scheduledInterval?: SubscriptionInterval | null;
    },
  ) => void;
}>) {
  const { subscription, entitlements, usage, materialStorage } = snapshot;
  const activeCode = subscription ? subscription.planCode : "FREE";
  const highlights = formatEntitlementHighlights(entitlements);
  const nextInterval: SubscriptionInterval =
    subscription?.interval === "MONTH" ? "YEAR" : "MONTH";
  const anyBusy = busyAction !== null;

  const storagePct = storageUsagePercent(
    materialStorage.usedBytes,
    materialStorage.allowedBytes,
  );
  const storageTone = meterToneClass(storagePct);

  const recordingPct = usage
    ? recordingUsagePercent(
        usage.recordingMinutesUsed,
        usage.recordingMinutesAllowed,
      )
    : 0;
  const recordingTone = meterToneClass(recordingPct);
  const recordingRemaining = usage
    ? Math.max(0, usage.recordingMinutesAllowed - usage.recordingMinutesUsed)
    : 0;

  const headerClass =
    activeCode === "PRO"
      ? `${styles.heroHeader} ${styles.heroHeaderPro}`
      : activeCode === "CREATOR"
        ? `${styles.heroHeader} ${styles.heroHeaderCreator}`
        : styles.heroHeader;

  const scheduledParts: string[] = [];
  if (subscription?.scheduledPlanCode) {
    scheduledParts.push(
      `chuyển sang gói ${planDisplayName(subscription.scheduledPlanCode)}`,
    );
  }
  if (subscription?.scheduledInterval) {
    scheduledParts.push(
      `đổi chu kỳ sang ${intervalLabel(subscription.scheduledInterval)}`,
    );
  }

  return (
    <section className={styles.heroCard} aria-label="Thông tin gói hiện tại">
      <div className={headerClass}>
        <div className={styles.heroIdentity}>
          <span className={styles.heroEmblem} aria-hidden="true">
            <ProductIcon
              name={
                activeCode === "PRO"
                  ? "award"
                  : activeCode === "CREATOR"
                    ? "star"
                    : "user"
              }
              size={22}
            />
          </span>
          <div className={styles.heroCopy}>
            <span className={styles.heroKicker}>Gói đang áp dụng</span>
            <div className={styles.heroTitleRow}>
              <h2>{planDisplayName(activeCode)}</h2>
              {subscription ? (
                <Status
                  value={subscription.status}
                  label={subscriptionStatusLabel(subscription.status)}
                />
              ) : (
                <Status value="FREE" label="Mặc định" />
              )}
            </div>
            <p className={styles.heroMeta}>
              {subscription
                ? `Chu kỳ ${intervalLabel(subscription.interval)} (${intervalPeriodLabel(subscription.interval)}) · Hiệu lực đến ${formatTime(subscription.termEnd)}`
                : "Tài khoản đang sử dụng quyền lợi cơ bản miễn phí. Nâng cấp bất cứ lúc nào bằng Credit."}
            </p>
          </div>
        </div>

        {subscription && (
          <div className={styles.heroBadges}>
            <span className={styles.heroRenewPill}>
              <ProductIcon
                name={subscription.autoRenew ? "refresh" : "clock"}
                size={14}
              />
              {subscription.autoRenew
                ? "Tự động gia hạn: Đang bật"
                : "Tự động gia hạn: Đang tắt"}
            </span>
          </div>
        )}
      </div>

      <div className={styles.heroBody}>
        {subscription?.graceUntil && (
          <div className={`${styles.banner} ${styles.bannerWarn}`} role="alert">
            <div className={styles.bannerBody}>
              <span className={styles.bannerIcon}>
                <ProductIcon name="clock" size={18} />
              </span>
              <div>
                <strong>Gói đang trong thời gian chờ gia hạn</strong> — Quyền
                lợi vẫn được giữ đến{" "}
                <strong>{formatTime(subscription.graceUntil)}</strong>. Vui lòng
                nạp thêm Credit để hệ thống gia hạn tự động và tránh gián đoạn.
              </div>
            </div>
            <Link className="btn btn-sm btn-primary" href="/learn/wallet/topup">
              Nạp Credit ngay
            </Link>
          </div>
        )}

        {scheduledParts.length > 0 && subscription && (
          <div
            className={`${styles.banner} ${styles.bannerInfo}`}
            role="status"
          >
            <div className={styles.bannerBody}>
              <span className={styles.bannerIcon}>
                <ProductIcon name="calendar" size={18} />
              </span>
              <div>
                <strong>Đã lên lịch cho kỳ tiếp theo:</strong> Sau ngày{" "}
                <strong>{formatTime(subscription.termEnd)}</strong>, gói sẽ{" "}
                {scheduledParts.join(" và ")}.
              </div>
            </div>
          </div>
        )}

        <div className={styles.meterGrid}>
          <div className={styles.meterCard}>
            <div className={styles.meterHead}>
              <div className={styles.meterLabelWrap}>
                <span className={styles.meterIcon} aria-hidden="true">
                  <ProductIcon name="file" size={16} />
                </span>
                <span className={styles.meterTitle}>Dung lượng tài liệu</span>
              </div>
              <span className={storageTone.badge}>{storagePct}%</span>
            </div>
            <div className={styles.meterValue}>
              {formatStorageBytes(materialStorage.usedBytes)}{" "}
              <span>/ {formatStorageBytes(materialStorage.allowedBytes)}</span>
            </div>
            <div className={styles.meterTrack} aria-hidden="true">
              <span
                className={storageTone.fill}
                style={{ width: `${storagePct}%` }}
              />
            </div>
            <div className={styles.meterFoot}>
              <span>
                {materialStorage.enforced
                  ? "Đang áp dụng giới hạn theo gói"
                  : "Đang theo dõi mức sử dụng"}
              </span>
            </div>
          </div>

          <div className={styles.meterCard}>
            <div className={styles.meterHead}>
              <div className={styles.meterLabelWrap}>
                <span className={styles.meterIcon} aria-hidden="true">
                  <ProductIcon name="video" size={16} />
                </span>
                <span className={styles.meterTitle}>Phút ghi hình kỳ này</span>
              </div>
              {usage ? (
                <span className={recordingTone.badge}>{recordingPct}%</span>
              ) : (
                <span className={styles.meterPercent}>Chưa mở khóa</span>
              )}
            </div>
            {usage ? (
              <>
                <div className={styles.meterValue}>
                  {usage.recordingMinutesUsed}{" "}
                  <span>/ {usage.recordingMinutesAllowed} phút</span>
                </div>
                <div className={styles.meterTrack} aria-hidden="true">
                  <span
                    className={recordingTone.fill}
                    style={{ width: `${recordingPct}%` }}
                  />
                </div>
                <div className={styles.meterFoot}>
                  <span>
                    Còn {recordingRemaining} phút trong kỳ · Làm mới{" "}
                    {formatTime(usage.periodEnd)}
                  </span>
                  {usage.addonMinutesRemaining > 0 && (
                    <span className={styles.addonTag}>
                      +{usage.addonMinutesRemaining} phút add-on
                    </span>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className={styles.meterValue}>
                  0 <span>phút / kỳ</span>
                </div>
                <div className={styles.meterTrack} aria-hidden="true">
                  <span className={styles.meterFill} style={{ width: "0%" }} />
                </div>
                <div className={styles.meterFoot}>
                  <span>
                    Nâng cấp lên Creator hoặc Creator Pro để ghi hình buổi học
                    1:1.
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        <div className={styles.entitlementStrip}>
          {highlights.map((item) => (
            <div key={item.label} className={styles.entitlementTile}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </div>
          ))}
        </div>

        {subscription && (
          <div className={styles.manageBar}>
            <div className={styles.manageHeader}>
              <h3>Thiết lập gia hạn & kỳ tiếp theo</h3>
              <span>
                Thay đổi chu kỳ hoặc hạ gói sẽ có hiệu lực từ kỳ thanh toán kế
                tiếp.
              </span>
            </div>
            <div className={styles.manageActions}>
              <LoadingButton
                type="button"
                className="btn"
                disabled={anyBusy}
                loading={busyAction === "auto-renew"}
                onClick={() => onToggleAutoRenew(!subscription.autoRenew)}
              >
                <ProductIcon name="refresh" size={15} />
                {subscription.autoRenew
                  ? "Tắt tự động gia hạn"
                  : "Bật tự động gia hạn"}
              </LoadingButton>
              <LoadingButton
                type="button"
                className="btn"
                disabled={anyBusy}
                loading={busyAction === "schedule-interval"}
                onClick={() =>
                  onScheduleChange("schedule-interval", {
                    scheduledInterval:
                      subscription.scheduledInterval === nextInterval
                        ? null
                        : nextInterval,
                  })
                }
              >
                <ProductIcon name="calendar" size={15} />
                {subscription.scheduledInterval
                  ? `Hủy đổi chu kỳ (${intervalLabel(subscription.scheduledInterval)})`
                  : `Đổi sang ${intervalLabel(nextInterval)} kỳ tới`}
              </LoadingButton>
              {subscription.planCode === "PRO" && (
                <LoadingButton
                  type="button"
                  className="btn"
                  disabled={anyBusy}
                  loading={busyAction === "schedule-plan"}
                  onClick={() =>
                    onScheduleChange("schedule-plan", {
                      scheduledPlanCode:
                        subscription.scheduledPlanCode === "CREATOR"
                          ? null
                          : "CREATOR",
                    })
                  }
                >
                  {subscription.scheduledPlanCode === "CREATOR"
                    ? "Hủy lịch hạ xuống Creator"
                    : "Hẹn hạ xuống Creator kỳ tới"}
                </LoadingButton>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function FreeReferenceCard({
  isCurrent,
  entitlements,
}: Readonly<{
  isCurrent: boolean;
  entitlements: PlanEntitlements;
}>) {
  const highlights = formatEntitlementHighlights(entitlements);
  return (
    <article
      className={`${styles.planCard} ${styles.planCardFree} ${
        isCurrent ? styles.planCardCurrent : ""
      }`}
    >
      <div className={styles.planCardTop}>
        <h3>{planDisplayName("FREE")}</h3>
        <span
          className={`${styles.planTag} ${
            isCurrent ? styles.planTagCurrent : styles.planTagNeutral
          }`}
        >
          {isCurrent ? "Đang sử dụng" : "Cơ bản"}
        </span>
      </div>
      <p className={styles.planTagline}>{planTagline("FREE")}</p>

      <div className={styles.planPriceBlock}>
        <div className={styles.planPriceRow}>
          <span className={styles.planPriceAmount}>0 Credit</span>
          <span className={styles.planPriceUnit}>/ mãi mãi</span>
        </div>
        <span className={styles.planSubMeta}>
          Không cần thanh toán · Tự động áp dụng mặc định
        </span>
      </div>

      <ul className={styles.featureList}>
        {highlights.map((item) => {
          const muted =
            item.value.startsWith("Chưa") || item.value.startsWith("Không");
          return (
            <li key={item.label} className={styles.featureItem}>
              <span
                className={
                  muted
                    ? `${styles.featureCheck} ${styles.featureCheckMuted}`
                    : styles.featureCheck
                }
                aria-hidden="true"
              >
                <ProductIcon name={muted ? "close" : "check"} size={12} />
              </span>
              <span>
                {item.label}: <strong>{item.value}</strong>
              </span>
            </li>
          );
        })}
      </ul>

      <div className={styles.planFooter}>
        <button type="button" className="btn" disabled>
          {isCurrent ? "Gói hiện tại của bạn" : "Mặc định khi hết gói trả phí"}
        </button>
      </div>
    </article>
  );
}

function PlanCard({
  plan,
  interval,
  currentCode,
  currentStatus,
  scheduledPlanCode,
  availableCredit,
  busyAction,
  confirmingPlanId,
  quote,
  onStartConfirm,
  onCancelConfirm,
  onPurchase,
  onRequestQuote,
  onConfirmUpgrade,
  onClearQuote,
  onScheduleDowngrade,
}: Readonly<{
  plan: SubscriptionPlan;
  interval: SubscriptionInterval;
  currentCode: string;
  currentStatus: string | null;
  scheduledPlanCode: SubscriptionPlanCode | null;
  availableCredit: number | null;
  busyAction: string | null;
  confirmingPlanId: string | null;
  quote: SubscriptionUpgradeQuote | null;
  onStartConfirm: (planVersionId: string) => void;
  onCancelConfirm: () => void;
  onPurchase: (plan: SubscriptionPlan) => void;
  onRequestQuote: (planCode: SubscriptionPlanCode) => void;
  onConfirmUpgrade: (quote: SubscriptionUpgradeQuote) => void;
  onClearQuote: () => void;
  onScheduleDowngrade: (next: SubscriptionPlanCode | null) => void;
}>) {
  const price = interval === "MONTH" ? plan.monthPrice : plan.yearPrice;
  const numericPrice = parseCreditNumber(price);
  const savings = computeAnnualSavings(plan.monthPrice, plan.yearPrice);
  const isCurrent = currentCode === plan.planCode;
  const isFeatured = plan.planCode === "PRO" && !isCurrent;
  const canUpgrade =
    currentStatus === "ACTIVE" &&
    currentCode === "CREATOR" &&
    plan.planCode === "PRO";
  const isDowngradeTarget =
    currentCode === "PRO" && plan.planCode === "CREATOR";
  const isGraceCreatorViewingPro =
    currentStatus === "GRACE" &&
    currentCode === "CREATOR" &&
    plan.planCode === "PRO";
  const matchingQuote = quote?.planCode === plan.planCode ? quote : null;
  const isConfirmingPurchase = confirmingPlanId === plan.planVersionId;
  const anyBusy = busyAction !== null;

  const shortfall =
    availableCredit !== null &&
    numericPrice !== null &&
    availableCredit < numericPrice
      ? Math.ceil((numericPrice - availableCredit) * 100) / 100
      : 0;

  const cardClass = [
    styles.planCard,
    isCurrent
      ? styles.planCardCurrent
      : isFeatured
        ? styles.planCardFeatured
        : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <article className={cardClass}>
      <div className={styles.planCardTop}>
        <h3>{planDisplayName(plan.planCode)}</h3>
        {isCurrent ? (
          <span className={`${styles.planTag} ${styles.planTagCurrent}`}>
            Đang sử dụng
          </span>
        ) : plan.planCode === "PRO" ? (
          <span className={`${styles.planTag} ${styles.planTagFeatured}`}>
            Tối ưu nhất
          </span>
        ) : (
          <span className={`${styles.planTag} ${styles.planTagNeutral}`}>
            Phổ biến
          </span>
        )}
      </div>

      <p className={styles.planTagline}>{planTagline(plan.planCode)}</p>

      <div className={styles.planPriceBlock}>
        <div className={styles.planPriceRow}>
          <span className={styles.planPriceAmount}>
            {financeNumber(price)} Credit
          </span>
          <span className={styles.planPriceUnit}>
            / {interval === "MONTH" ? "tháng" : "năm"}
          </span>
        </div>
        {interval === "YEAR" && savings && savings.percent > 0 ? (
          <span className={styles.planSavings}>
            ≈ {financeNumber(String(savings.monthlyEquivalent))} Credit/tháng ·
            Tiết kiệm {financeNumber(String(savings.savedCredit))} Credit (
            {savings.percent}%)
          </span>
        ) : (
          <span className={styles.planSubMeta}>
            Chu kỳ {intervalPeriodLabel(interval)} · Phiên bản v{plan.versionNo}
          </span>
        )}
      </div>

      <ul className={styles.featureList}>
        {formatEntitlementHighlights(plan.entitlements).map((item) => {
          const muted =
            item.value.startsWith("Chưa") || item.value.startsWith("Không");
          return (
            <li key={item.label} className={styles.featureItem}>
              <span
                className={
                  muted
                    ? `${styles.featureCheck} ${styles.featureCheckMuted}`
                    : styles.featureCheck
                }
                aria-hidden="true"
              >
                <ProductIcon name={muted ? "close" : "check"} size={12} />
              </span>
              <span>
                {item.label}: <strong>{item.value}</strong>
              </span>
            </li>
          );
        })}
      </ul>

      <div className={styles.planFooter}>
        {!isCurrent && currentCode === "FREE" && shortfall > 0 && (
          <div className={styles.shortfallNote}>
            <span>
              Cần thêm khoảng {financeNumber(String(shortfall))} Credit
            </span>
            <Link href="/learn/wallet/topup">Nạp thêm →</Link>
          </div>
        )}

        {isConfirmingPurchase && currentCode === "FREE" && (
          <div
            className={styles.confirmBox}
            role="region"
            aria-label="Xác nhận đăng ký gói"
          >
            <span className={styles.confirmBoxTitle}>
              Xác nhận kích hoạt {planDisplayName(plan.planCode)}
            </span>
            <div className={styles.confirmSummary}>
              <div className={styles.confirmRow}>
                <span>Chu kỳ</span>
                <strong>
                  {intervalLabel(interval)} ({intervalPeriodLabel(interval)})
                </strong>
              </div>
              <div className={styles.confirmRow}>
                <span>Thanh toán ngay</span>
                <strong>{financeNumber(price)} Credit</strong>
              </div>
              {availableCredit !== null && numericPrice !== null && (
                <div className={styles.confirmRow}>
                  <span>Số dư dự kiến sau khi trừ</span>
                  <strong>
                    {availableCredit >= numericPrice
                      ? `${financeNumber(String(Math.round((availableCredit - numericPrice) * 100) / 100))} Credit`
                      : "Không đủ số dư"}
                  </strong>
                </div>
              )}
            </div>
            <div className={styles.confirmActions}>
              <LoadingButton
                type="button"
                className="btn btn-primary"
                loading={busyAction === `purchase:${plan.planVersionId}`}
                disabled={anyBusy}
                onClick={() => onPurchase(plan)}
              >
                Xác nhận thanh toán
              </LoadingButton>
              <button
                type="button"
                className="btn"
                disabled={anyBusy}
                onClick={onCancelConfirm}
              >
                Hủy
              </button>
            </div>
          </div>
        )}

        {matchingQuote && (
          <div
            className={styles.confirmBox}
            role="region"
            aria-label="Báo giá nâng cấp gói"
          >
            <span className={styles.confirmBoxTitle}>
              Báo giá nâng cấp lên {planDisplayName(matchingQuote.planCode)}
            </span>
            <div className={styles.confirmSummary}>
              <div className={styles.confirmRow}>
                <span>Phí chênh lệch phần kỳ còn lại</span>
                <strong>{financeNumber(matchingQuote.amount)} Credit</strong>
              </div>
              <div className={styles.confirmRow}>
                <span>Áp dụng đến hết kỳ</span>
                <strong>{formatTime(matchingQuote.termEnd)}</strong>
              </div>
            </div>
            <div className={styles.confirmActions}>
              <LoadingButton
                type="button"
                className="btn btn-primary"
                loading={busyAction === "confirm-upgrade"}
                disabled={anyBusy}
                onClick={() => onConfirmUpgrade(matchingQuote)}
              >
                Xác nhận nâng cấp ngay
              </LoadingButton>
              <button
                type="button"
                className="btn"
                disabled={anyBusy}
                onClick={onClearQuote}
              >
                Đóng
              </button>
            </div>
          </div>
        )}

        {isCurrent && (
          <button type="button" className="btn" disabled>
            <ProductIcon name="check" size={15} />
            Gói đang sử dụng
          </button>
        )}

        {!isCurrent && currentCode === "FREE" && !isConfirmingPurchase && (
          <button
            type="button"
            className="btn btn-primary"
            disabled={anyBusy}
            onClick={() => onStartConfirm(plan.planVersionId)}
          >
            Đăng ký {planDisplayName(plan.planCode)}
          </button>
        )}

        {canUpgrade && !matchingQuote && (
          <LoadingButton
            type="button"
            className="btn btn-primary"
            loading={busyAction === `quote:${plan.planCode}`}
            disabled={anyBusy}
            onClick={() => onRequestQuote(plan.planCode)}
          >
            Xem báo giá nâng cấp
          </LoadingButton>
        )}

        {isGraceCreatorViewingPro && (
          <Link className="btn" href="/learn/wallet/topup">
            Nạp Credit để gia hạn trước khi nâng cấp
          </Link>
        )}

        {isDowngradeTarget && (
          <LoadingButton
            type="button"
            className="btn"
            loading={busyAction === "schedule-plan"}
            disabled={anyBusy}
            onClick={() =>
              onScheduleDowngrade(
                scheduledPlanCode === "CREATOR" ? null : "CREATOR",
              )
            }
          >
            {scheduledPlanCode === "CREATOR"
              ? "Đã hẹn chuyển kỳ tới (Nhấn để hủy)"
              : "Chuyển sang Creator vào kỳ tới"}
          </LoadingButton>
        )}
      </div>
    </article>
  );
}

function RecordingAddonPanel({
  busy,
  availableCredit,
  forceOpenOverride,
  onBuy,
}: Readonly<{
  busy: boolean;
  availableCredit: number | null;
  forceOpenOverride: boolean;
  onBuy: (packs: number, expectedPriceCredit: number) => void;
}>) {
  const [packs, setPacks] = useState(1);
  const [priceCredit, setPriceCredit] = useState(DEFAULT_ADDON_PRICE_CREDIT);

  const totalMinutes = packs * DEFAULT_ADDON_MINUTES;
  const totalCost = packs * priceCredit;
  const validTotal =
    Number.isFinite(totalCost) && packs >= 1 && packs <= 10 && priceCredit >= 1;
  const insufficient =
    validTotal && availableCredit !== null && availableCredit < totalCost;

  return (
    <Panel>
      <form
        className={styles.addonLayout}
        onSubmit={(event) => {
          event.preventDefault();
          if (validTotal) onBuy(packs, priceCredit);
        }}
      >
        <div className={styles.addonInfo}>
          <div className={styles.addonHeading}>
            <span className={styles.addonBadgeIcon} aria-hidden="true">
              <ProductIcon name="video" size={20} />
            </span>
            <div>
              <h2>Mua thêm phút ghi hình (Add-on)</h2>
              <p>
                Mỗi gói cộng thêm {DEFAULT_ADDON_MINUTES} phút ghi hình vào kỳ
                gói hiện tại, tự động cộng dồn sau khi dùng hết hạn mức kỳ.
              </p>
            </div>
          </div>

          <div
            className={styles.packPresets}
            role="group"
            aria-label="Chọn nhanh số gói phút ghi hình"
          >
            {ADDON_PACK_PRESETS.map((count) => (
              <button
                key={count}
                type="button"
                className={
                  packs === count
                    ? `${styles.presetChip} ${styles.presetChipActive}`
                    : styles.presetChip
                }
                disabled={busy}
                onClick={() => setPacks(count)}
              >
                {count} gói · +{count * DEFAULT_ADDON_MINUTES} phút
              </button>
            ))}
          </div>

          <div className={styles.stepperRow}>
            <div
              className={styles.stepper}
              role="group"
              aria-label="Số gói (1 đến 10)"
            >
              <button
                type="button"
                className={styles.stepperBtn}
                aria-label="Giảm 1 gói"
                disabled={busy || packs <= 1}
                onClick={() => setPacks((p) => Math.max(1, p - 1))}
              >
                −
              </button>
              <span className={styles.stepperValue} aria-live="polite">
                {packs}
              </span>
              <button
                type="button"
                className={styles.stepperBtn}
                aria-label="Tăng 1 gói"
                disabled={busy || packs >= 10}
                onClick={() => setPacks((p) => Math.min(10, p + 1))}
              >
                +
              </button>
            </div>
            <span className={styles.stepperHint}>
              Tối đa 10 gói mỗi lần mua (600 phút)
            </span>
          </div>
        </div>

        <div className={styles.addonSummaryCard}>
          <div className={styles.addonSummaryRow}>
            <span>Số phút cộng thêm</span>
            <strong>+{totalMinutes} phút</strong>
          </div>
          <div className={styles.addonSummaryRow}>
            <span>Đơn giá mỗi gói</span>
            <strong>{financeNumber(String(priceCredit))} Credit</strong>
          </div>
          <div className={styles.addonTotalRow}>
            <span>Tổng thanh toán</span>
            <strong>
              {validTotal ? `${financeNumber(String(totalCost))} Credit` : "—"}
            </strong>
          </div>

          {insufficient && (
            <div className={styles.shortfallNote}>
              <span>Số dư ví hiện chưa đủ</span>
              <Link href="/learn/wallet/topup">Nạp Credit →</Link>
            </div>
          )}

          <LoadingButton
            type="submit"
            className="btn btn-primary"
            loading={busy}
            disabled={busy || !validTotal}
          >
            Mua thêm +{totalMinutes} phút
          </LoadingButton>

          <details
            className={styles.priceOverride}
            open={forceOpenOverride || undefined}
          >
            <summary>Điều chỉnh đơn giá xác nhận</summary>
            <label className={styles.priceOverrideField}>
              <span>Đơn giá mỗi gói (Credit)</span>
              <input
                type="number"
                min={1}
                step={1}
                required
                value={priceCredit}
                onChange={(e) => setPriceCredit(Number(e.target.value))}
              />
            </label>
          </details>
        </div>
      </form>
    </Panel>
  );
}

function chargeIconName(
  kind: SubscriptionCharge["kind"],
): "star" | "refresh" | "award" | "video" {
  if (kind === "RENEWAL") return "refresh";
  if (kind === "UPGRADE") return "award";
  if (kind === "RECORDING_ADDON") return "video";
  return "star";
}

function chargeIconClass(kind: SubscriptionCharge["kind"]): string {
  if (kind === "RENEWAL")
    return `${styles.chargeIcon ?? ""} ${styles.chargeIconRenewal ?? ""}`;
  if (kind === "UPGRADE")
    return `${styles.chargeIcon ?? ""} ${styles.chargeIconUpgrade ?? ""}`;
  return styles.chargeIcon ?? "";
}

export function SubscriptionScreen() {
  const { request } = useUserSession();
  const [interval, setInterval] = useState<SubscriptionInterval>("MONTH");
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [confirmingPlanId, setConfirmingPlanId] = useState<string | null>(null);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [addonPriceMismatch, setAddonPriceMismatch] = useState(false);
  const [quote, setQuote] = useState<SubscriptionUpgradeQuote | null>(null);

  const me = useUserResource<MySubscriptionSnapshot>("me/subscription");
  const plans = useUserResource<SubscriptionPlan[]>("subscriptions/plans");
  const wallet = useUserResource<Wallet>("me/wallet");
  const charges = useUserPagedList<SubscriptionCharge>(
    "me/subscription/charges?limit=20",
  );

  function reloadAll() {
    me.reload();
    plans.reload();
    wallet.reload();
    charges.reload();
  }

  async function runAction(
    actionKey: string,
    work: () => Promise<void>,
    successMessage: string,
    fallbackError: string,
  ) {
    if (busyAction !== null) return;
    setBusyAction(actionKey);
    setError(undefined);
    setNotice(undefined);
    try {
      await work();
      setNotice(successMessage);
      setAddonPriceMismatch(false);
      reloadAll();
    } catch (cause) {
      const message = formatError(cause, fallbackError);
      setError(message);
      if (
        actionKey === "buy-addon" &&
        /giá|price|RECORDING_ADDON_PRICE_CHANGED/i.test(message)
      ) {
        setAddonPriceMismatch(true);
      }
    } finally {
      setBusyAction(null);
    }
  }

  function handlePurchase(plan: SubscriptionPlan) {
    void runAction(
      `purchase:${plan.planVersionId}`,
      async () => {
        await request("me/subscription", {
          method: "POST",
          key: crypto.randomUUID(),
          body: {
            planCode: plan.planCode,
            interval,
            expectedPlanVersionId: plan.planVersionId,
          },
        });
        setQuote(null);
        setConfirmingPlanId(null);
      },
      `Đã kích hoạt gói ${planDisplayName(plan.planCode)} thành công.`,
      "Chưa thể đăng ký gói thành viên.",
    );
  }

  async function handleRequestQuote(planCode: SubscriptionPlanCode) {
    if (busyAction !== null) return;
    setBusyAction(`quote:${planCode}`);
    setError(undefined);
    setNotice(undefined);
    try {
      const res = await request<SubscriptionUpgradeQuote>(
        `me/subscription/upgrade-quote?planCode=${planCode}`,
      );
      setQuote(res.data);
    } catch (cause) {
      setError(formatError(cause, "Chưa lấy được báo giá nâng cấp."));
    } finally {
      setBusyAction(null);
    }
  }

  function handleConfirmUpgrade(target: SubscriptionUpgradeQuote) {
    void runAction(
      "confirm-upgrade",
      async () => {
        await request("me/subscription/upgrade", {
          method: "POST",
          key: crypto.randomUUID(),
          body: {
            planCode: target.planCode,
            expectedPlanVersionId: target.planVersionId,
            expectedAmount: target.amount,
            expectedVersion: target.version,
          },
        });
        setQuote(null);
      },
      `Đã nâng cấp lên gói ${planDisplayName(target.planCode)} thành công.`,
      "Chưa thể hoàn tất nâng cấp gói.",
    );
  }

  function handlePatchSubscription(
    actionKey: string,
    patch: {
      autoRenew?: boolean;
      scheduledPlanCode?: SubscriptionPlanCode | null;
      scheduledInterval?: SubscriptionInterval | null;
    },
  ) {
    const currentVersion = me.data?.subscription?.version;
    if (!currentVersion) return;
    void runAction(
      actionKey,
      async () => {
        await request("me/subscription", {
          method: "PATCH",
          body: { expectedVersion: currentVersion, ...patch },
        });
      },
      "Đã cập nhật thiết lập gia hạn gói thành viên.",
      "Chưa thể cập nhật gói thành viên.",
    );
  }

  function handleBuyAddon(packs: number, expectedPriceCredit: number) {
    void runAction(
      "buy-addon",
      async () => {
        await request("me/subscription/recording-minutes", {
          method: "POST",
          key: crypto.randomUUID(),
          body: { packs, expectedPriceCredit },
        });
      },
      `Đã cộng thêm ${packs * DEFAULT_ADDON_MINUTES} phút ghi hình vào kỳ hiện tại.`,
      "Chưa thể mua thêm phút ghi hình.",
    );
  }

  const currentCode = me.data?.subscription?.planCode ?? "FREE";
  const currentStatus = me.data?.subscription?.status ?? null;
  const scheduledPlanCode = me.data?.subscription?.scheduledPlanCode ?? null;
  const availableCredit = parseCreditNumber(wallet.data?.availableCredit);

  const sortedPlans = plans.data
    ? [...plans.data].sort(
        (a, b) => planSortOrder(a.planCode) - planSortOrder(b.planCode),
      )
    : [];
  const bestSavingsPercent = maxAnnualSavingsPercent(sortedPlans);
  const freeCardEntitlements =
    currentCode === "FREE" && me.data
      ? me.data.entitlements
      : FREE_REFERENCE_ENTITLEMENTS;

  return (
    <div className={styles.page}>
      <PageHeading
        eyebrow="Quyền lợi & hạn mức"
        title="Gói thành viên"
        description="Nâng cấp gói bằng Credit để mở khóa ghi hình buổi học, tăng dung lượng tài liệu, kéo dài lưu trữ bảng trắng và hưởng bậc phí ưu đãi."
        action={
          <div className={styles.walletBar}>
            <Link className={styles.walletPill} href="/learn/wallet">
              <span className={styles.walletPillIcon} aria-hidden="true">
                <ProductIcon name="wallet" size={16} />
              </span>
              <span className={styles.walletPillText}>
                <small>Số dư khả dụng</small>
                <strong>
                  {wallet.data
                    ? `${financeNumber(wallet.data.availableCredit)} Credit`
                    : "Ví Credit"}
                </strong>
              </span>
            </Link>
            <Link className="btn btn-primary" href="/learn/wallet/topup">
              <ProductIcon name="plus" size={15} />
              Nạp Credit
            </Link>
          </div>
        }
      />

      <Feedback
        loading={me.initialLoading || plans.initialLoading}
        error={error ?? me.error ?? plans.error}
        reload={reloadAll}
      />

      {notice && (
        <output className={`${styles.banner} ${styles.bannerSuccess}`}>
          <span className={styles.bannerBody}>
            <span className={styles.bannerIcon} aria-hidden="true">
              <ProductIcon name="check" size={18} />
            </span>
            <span>{notice}</span>
          </span>
          <button
            type="button"
            className={styles.bannerClose}
            onClick={() => setNotice(undefined)}
          >
            Đóng
          </button>
        </output>
      )}

      {me.data && (
        <CurrentSubscriptionSection
          snapshot={me.data}
          busyAction={busyAction}
          onToggleAutoRenew={(autoRenew) =>
            handlePatchSubscription("auto-renew", { autoRenew })
          }
          onScheduleChange={handlePatchSubscription}
        />
      )}

      <Panel>
        <div className={styles.sectionHead}>
          <div className={styles.sectionHeadText}>
            <span className="panel-kicker">So sánh quyền lợi</span>
            <h2>Chọn gói phù hợp với bạn</h2>
            <p>
              Thanh toán trực tiếp bằng Credit trong ví. Bạn có thể nâng cấp bất
              kỳ lúc nào và chỉ trả phần chênh lệch cho thời gian còn lại.
            </p>
          </div>
          <div
            className={styles.intervalSwitch}
            role="group"
            aria-label="Chọn chu kỳ thanh toán"
          >
            <button
              type="button"
              aria-pressed={interval === "MONTH"}
              className={
                interval === "MONTH"
                  ? `${styles.intervalBtn} ${styles.intervalBtnActive}`
                  : styles.intervalBtn
              }
              onClick={() => {
                setInterval("MONTH");
                setConfirmingPlanId(null);
              }}
            >
              Theo tháng
            </button>
            <button
              type="button"
              aria-pressed={interval === "YEAR"}
              className={
                interval === "YEAR"
                  ? `${styles.intervalBtn} ${styles.intervalBtnActive}`
                  : styles.intervalBtn
              }
              onClick={() => {
                setInterval("YEAR");
                setConfirmingPlanId(null);
              }}
            >
              <span>Theo năm</span>
              {bestSavingsPercent > 0 && (
                <span className={styles.savePill}>-{bestSavingsPercent}%</span>
              )}
            </button>
          </div>
        </div>

        {sortedPlans.length > 0 ? (
          <div
            className={
              sortedPlans.length === 1
                ? `${styles.plansGrid} ${styles.plansGridTwo}`
                : styles.plansGrid
            }
          >
            <FreeReferenceCard
              isCurrent={currentCode === "FREE"}
              entitlements={freeCardEntitlements}
            />
            {sortedPlans.map((plan) => (
              <PlanCard
                key={plan.planVersionId}
                plan={plan}
                interval={interval}
                currentCode={currentCode}
                currentStatus={currentStatus}
                scheduledPlanCode={scheduledPlanCode}
                availableCredit={availableCredit}
                busyAction={busyAction}
                confirmingPlanId={confirmingPlanId}
                quote={quote}
                onStartConfirm={(id) => {
                  setConfirmingPlanId(id);
                  setError(undefined);
                }}
                onCancelConfirm={() => setConfirmingPlanId(null)}
                onPurchase={handlePurchase}
                onRequestQuote={(code) => void handleRequestQuote(code)}
                onConfirmUpgrade={handleConfirmUpgrade}
                onClearQuote={() => setQuote(null)}
                onScheduleDowngrade={(next) =>
                  handlePatchSubscription("schedule-plan", {
                    scheduledPlanCode: next,
                  })
                }
              />
            ))}
          </div>
        ) : (
          !plans.initialLoading && (
            <Empty>
              Chưa có gói thành viên đang mở bán. Khi quản trị viên phê duyệt và
              mở bán gói thành viên, bảng gói sẽ hiển thị tại đây.
            </Empty>
          )
        )}
      </Panel>

      {me.data?.entitlements.recordingAddonAllowed && (
        <RecordingAddonPanel
          busy={busyAction === "buy-addon"}
          availableCredit={availableCredit}
          forceOpenOverride={addonPriceMismatch}
          onBuy={handleBuyAddon}
        />
      )}

      <Panel>
        <div className="panel-head">
          <div>
            <span className="panel-kicker">Biên lai Credit</span>
            <h2>Lịch sử thanh toán gói</h2>
          </div>
          <Link href="/learn/wallet">Xem toàn bộ sổ cái ví →</Link>
        </div>
        <Feedback
          loading={charges.initialLoading}
          error={charges.error}
          reload={charges.reload}
        />
        {!charges.initialLoading && charges.items.length === 0 && (
          <Empty>
            Chưa có giao dịch gói thành viên. Các lần đăng ký, gia hạn, nâng cấp
            gói hoặc mua thêm phút ghi hình sẽ hiển thị tại đây.
          </Empty>
        )}
        {charges.items.length > 0 && (
          <div className={styles.chargeList}>
            {charges.items.map((row) => (
              <div key={row.id} className={styles.chargeRow}>
                <div className={styles.chargeMain}>
                  <span
                    className={chargeIconClass(row.kind)}
                    aria-hidden="true"
                  >
                    <ProductIcon name={chargeIconName(row.kind)} size={18} />
                  </span>
                  <div className={styles.chargeInfo}>
                    <div className={styles.chargeTitleRow}>
                      <strong>{chargeKindLabel(row.kind)}</strong>
                      <span className={styles.chargePlanChip}>
                        {planDisplayName(row.planCode)}
                      </span>
                      {row.quantity > 1 && (
                        <span className={styles.chargePlanChip}>
                          ×{row.quantity}
                        </span>
                      )}
                    </div>
                    <span className={styles.chargeDate}>
                      {formatTime(row.createdAt)}
                    </span>
                  </div>
                </div>
                <strong className={styles.chargeAmount}>
                  −{financeNumber(row.amount)} Credit
                </strong>
              </div>
            ))}
          </div>
        )}
        <ListPagination query={charges} />
      </Panel>
    </div>
  );
}
