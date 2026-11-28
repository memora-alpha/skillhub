"use client";
import { LoadingButton } from "@/components/loading-button";
import { useId, useState } from "react";
import { Badge, PageHeader, StatusBadge } from "@/components/console/ui";
import { Icon, type IconName } from "@/components/console/icon";
import { useStaffResource } from "./hooks";
import { useStaffSession } from "./session";
import { hasPermission } from "@/lib/staff/permissions";
import { QueueState } from "./common";
import { useStaffPagedList } from "./use-staff-paged-list";
import { PageNavigation } from "./page-navigation";
import { MaterialFeePolicies } from "./material-fee-policies";
import { fmtDateTime } from "@/lib/console/format";
import {
  creditDirection,
  creditRatioPercent,
  creditToVndEstimate,
  financeLabel,
  financeNumber,
  keyedFinanceItems,
  sumCreditStrings,
} from "@/lib/staff/finance-presentation";
import { systemCodeLabel } from "@/lib/system-text";
import { UserProfileReference } from "./user-profile-reference";
import { AdminLedgerScreen } from "./admin-ledger";
import { AdminDrawer, AdminField, RecordId } from "./admin-ui";
import {
  AdminFilterPanel,
  AdminFilterTrigger,
  filterPanelStyles,
} from "./admin-filter-panel";
import {
  emptyLedgerFilters,
  ledgerHref,
  type LedgerFilters,
} from "@/lib/staff/ledger-query";
import {
  emptyPaymentFilters,
  paymentQuery,
  type PaymentFilters,
} from "@/lib/staff/payment-query";
import styles from "./admin-finance.module.css";

type Payment = {
  id: string;
  userId: string;
  status: string;
  creditAmount: string;
  paymentAmountVnd: string;
  currency?: string;
  gateway?: string;
  externalOrderRef?: string | null;
  createdAt: string;
  conversionRateVndPerCredit?: number;
  gatewayTransactionId: string | null;
  payosCheckout: {
    state?: string;
    orderCode: string;
    paidAt?: string | null;
    expiresAt?: string | null;
    topUpOperationId: string | null;
  } | null;
};

type PaymentReconciliationRecord = {
  paymentId?: string;
  userId?: string;
  status?: string;
  paymentAmountVnd?: string;
  orderCode?: string | null;
  currentChannelMatches?: boolean;
  topUpOperationIds?: string[];
  findings?: unknown[];
  provider?: unknown;
};

type PaymentReconciliationReport = {
  checked?: number;
  summary?: Record<string, unknown>;
  records?: PaymentReconciliationRecord[];
};

type WalletResponse = {
  userId: string;
  availableCredit: string;
  heldCredit: string;
  walletVersion: number;
};

type FeePolicyCode =
  | "ONE_WAY"
  | "ONE_WAY_CREATOR"
  | "ONE_WAY_PRO"
  | "TWO_WAY"
  | "MATERIAL_PAID"
  | "MATERIAL_PAID_CREATOR"
  | "MATERIAL_PAID_PRO";

type CurrentFeePolicy = {
  id: string;
  policyCode: FeePolicyCode;
  versionNo: number;
  calculationRule: { returnedBps?: number; feeBps: number };
  effectiveAt: string;
};

type CurrentCreditPolicy = {
  topUpVndPerCredit: number;
  minCreditPerUser: number;
  withdrawalsSupported: boolean;
  policies: CurrentFeePolicy[];
  readAt: string;
};

type FinanceTab = "ledger" | "payments" | "wallet" | "fees";

const uuidRegex = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

const financeTabs: readonly {
  id: FinanceTab;
  label: string;
  icon: IconName;
}[] = [
  { id: "ledger", label: "Giao dịch Credit", icon: "activity" },
  { id: "payments", label: "Thanh toán nạp", icon: "card" },
  { id: "wallet", label: "Ví người dùng", icon: "wallet" },
  { id: "fees", label: "Phí & doanh thu", icon: "sliders" },
];

const paymentStatuses: Record<string, string> = {
  CREATED: "Mới tạo",
  PENDING: "Chờ thanh toán",
  PAID: "Đã thanh toán",
  REVIEW: "Cần xem xét",
  CANCELLED: "Đã hủy",
  EXPIRED: "Hết hạn",
  FAILED: "Thất bại",
  REFUNDED: "Đã hoàn",
};

const paymentStatusOrder = [
  "PAID",
  "PENDING",
  "REVIEW",
  "FAILED",
  "EXPIRED",
  "CANCELLED",
  "CREATED",
  "REFUNDED",
] as const;

const detailLabels: Record<string, string> = {
  id: "Mã",
  userId: "Người dùng",
  operationId: "Nghiệp vụ",
  type: "Loại",
  status: "Trạng thái",
  amount: "Credit",
  availableDelta: "Thay đổi khả dụng",
  heldDelta: "Thay đổi đang giữ",
  availableAfter: "Khả dụng sau giao dịch",
  heldAfter: "Đang giữ sau giao dịch",
  createdAt: "Ngày tạo",
  operationType: "Loại nghiệp vụ",
  referenceType: "Nguồn",
  referenceId: "Mã tham chiếu",
  entries: "Bút toán",
  availableCredit: "Credit khả dụng",
  heldCredit: "Credit đang giữ",
  walletVersion: "Phiên bản ví",
  records: "Kết quả",
  findings: "Phát hiện",
  paymentId: "Thanh toán",
  paymentAmountVnd: "Số tiền VND",
  creditAmount: "Credit",
  orderCode: "Mã đơn",
  currentChannelMatches: "Khớp kênh hiện tại",
  topUpOperationIds: "Nghiệp vụ nạp",
  provider: "Nhà cung cấp",
  gatewayTransactionId: "Mã giao dịch cổng",
  currency: "Tiền tệ",
  gateway: "Cổng",
  externalOrderRef: "Mã đơn ngoài",
  payosCheckout: "Đơn thanh toán",
  state: "Tình trạng",
  paidAt: "Thanh toán lúc",
  expiresAt: "Hết hạn",
  conversionRateVndPerCredit: "VND/Credit",
  topUpOperationId: "Nghiệp vụ nạp",
  operationIdRecord: "Nguồn nghiệp vụ",
  reversesTransactionId: "Đảo giao dịch",
  checked: "Đã kiểm tra",
  summary: "Tổng hợp",
  consistent: "Khớp",
  count: "Số lượng",
};

function shortId(id: string) {
  return id.length > 16 ? `${id.slice(0, 8)}…${id.slice(-4)}` : id;
}

function FinancePolicyBanner({
  policy,
  allPolicies,
  canReadFeePolicies,
  loading,
  error,
  feesLoading,
  feesError,
}: Readonly<{
  policy?: CurrentCreditPolicy;
  allPolicies: readonly CurrentFeePolicy[];
  canReadFeePolicies: boolean;
  loading: boolean;
  error?: string;
  feesLoading: boolean;
  feesError?: string;
}>) {
  const [expanded, setExpanded] = useState(true);
  const gridId = useId();

  const findPolicy = (code: FeePolicyCode) =>
    allPolicies.find((item) => item.policyCode === code);

  const twoWay = findPolicy("TWO_WAY");
  const oneWay = findPolicy("ONE_WAY");
  const materialPaid = findPolicy("MATERIAL_PAID");

  const oneWayTiers = (["ONE_WAY_CREATOR", "ONE_WAY_PRO"] as const).flatMap(
    (code) => {
      const row = findPolicy(code);
      return row ? [{ code, row }] : [];
    },
  );

  const materialTiers = (
    ["MATERIAL_PAID_CREATOR", "MATERIAL_PAID_PRO"] as const
  ).flatMap((code) => {
    const row = findPolicy(code);
    return row ? [{ code, row }] : [];
  });

  const showMaterialCard = canReadFeePolicies && !feesLoading && !feesError;

  const formatFee = (row?: CurrentFeePolicy) =>
    row ? `${row.calculationRule.feeBps / 100}%` : "—";
  const formatReturn = (row?: CurrentFeePolicy) => {
    if (!row) return "Chưa áp dụng";
    const returned =
      (row.calculationRule.returnedBps ?? 10000 - row.calculationRule.feeBps) /
      100;
    return `${returned}%`;
  };

  const summaryRate = () => {
    if (loading) return "Đang tải chính sách từ máy chủ…";
    if (error || !policy) return "Không tải được chính sách Credit hiện hành.";
    return `${policy.topUpVndPerCredit.toLocaleString("vi-VN")} VND = 1 Credit`;
  };

  return (
    <section
      className={styles.policyCard}
      aria-label="Chính sách Credit và biểu phí hiện hành"
    >
      <div
        className={
          expanded || !policy
            ? styles.policyHead
            : `${styles.policyHead} ${styles.policyHeadCollapsed}`
        }
      >
        <div className={styles.policyTitleGroup}>
          <span className={styles.policyIcon} aria-hidden="true">
            <Icon name="shield" size={17} />
          </span>
          <div className={styles.policyTitleCopy}>
            <strong>Chính sách Credit hiện hành</strong>
            <div className={styles.policyRateLine}>
              <span>{summaryRate()}</span>
              {policy && (
                <>
                  <span>·</span>
                  <span>
                    Cam kết trao đổi tối thiểu{" "}
                    <strong>{policy.minCreditPerUser} CR/người</strong>
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className={styles.policyHeadRight}>
          {policy && (
            <Badge tone={policy.withdrawalsSupported ? "ok" : "neutral"}>
              {policy.withdrawalsSupported
                ? "Có hỗ trợ rút Credit"
                : "Không hỗ trợ rút Credit"}
            </Badge>
          )}
          {policy && (
            <button
              type="button"
              className={styles.policyToggle}
              aria-expanded={expanded}
              aria-controls={gridId}
              onClick={() => setExpanded((prev) => !prev)}
            >
              <span>{expanded ? "Thu gọn mức phí" : "Xem mức phí"}</span>
              <Icon
                name="down"
                size={14}
                className={
                  expanded
                    ? `${styles.policyToggleChevron} ${styles.policyToggleChevronOpen}`
                    : styles.policyToggleChevron
                }
              />
            </button>
          )}
        </div>
      </div>

      {policy && expanded && (
        <div id={gridId} className={styles.policyGrid}>
          <div className={styles.policyScope}>
            <div className={styles.policyScopeTop}>
              <span className={styles.policyScopeName}>Trao đổi hai chiều</span>
              {twoWay && (
                <span className={styles.policyVersion}>
                  v{twoWay.versionNo}
                </span>
              )}
            </div>
            <div className={styles.policyMetricRow}>
              <span className={styles.policyFeeRate}>
                Phí {formatFee(twoWay)}
              </span>
              <span className={styles.policySplit}>
                Hoàn/trả {formatReturn(twoWay)}
              </span>
            </div>
            <div className={styles.policySubMeta}>
              <span className={styles.policyTierChip}>
                Cam kết ≥ {policy.minCreditPerUser} CR/người
              </span>
            </div>
          </div>

          <div className={styles.policyScope}>
            <div className={styles.policyScopeTop}>
              <span className={styles.policyScopeName}>Học một chiều</span>
              {oneWay && (
                <span className={styles.policyVersion}>
                  v{oneWay.versionNo}
                </span>
              )}
            </div>
            <div className={styles.policyMetricRow}>
              <span className={styles.policyFeeRate}>
                Phí {formatFee(oneWay)}
              </span>
              <span className={styles.policySplit}>
                Hoàn/trả {formatReturn(oneWay)}
              </span>
            </div>
            {showMaterialCard && oneWayTiers.length > 0 && (
              <div className={styles.policySubMeta}>
                {oneWayTiers.map(({ code, row }) => (
                  <span key={code} className={styles.policyTierChip}>
                    {code.endsWith("PRO") ? "Pro" : "Creator"}:{" "}
                    {row.calculationRule.feeBps / 100}% · v{row.versionNo}
                  </span>
                ))}
              </div>
            )}
          </div>

          {showMaterialCard && (
            <div className={styles.policyScope}>
              <div className={styles.policyScopeTop}>
                <span className={styles.policyScopeName}>Tài liệu trả phí</span>
                {materialPaid && (
                  <span className={styles.policyVersion}>
                    v{materialPaid.versionNo}
                  </span>
                )}
              </div>
              <div className={styles.policyMetricRow}>
                <span className={styles.policyFeeRate}>
                  Phí {formatFee(materialPaid)}
                </span>
                <span className={styles.policySplit}>
                  Tác giả nhận {formatReturn(materialPaid)}
                </span>
              </div>
              {materialTiers.length > 0 && (
                <div className={styles.policySubMeta}>
                  {materialTiers.map(({ code, row }) => (
                    <span key={code} className={styles.policyTierChip}>
                      {code.endsWith("PRO") ? "Pro" : "Creator"}:{" "}
                      {row.calculationRule.feeBps / 100}% · v{row.versionNo}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

export function FinanceScreen({
  initialTab = "ledger",
  initialPaymentId,
  initialLedgerFilters,
  initialWalletId,
  initialPaymentFilters,
  initialPaymentStatus,
}: Readonly<{
  initialTab?: string;
  initialPaymentId?: string;
  initialLedgerFilters?: LedgerFilters;
  initialWalletId?: string;
  initialPaymentFilters?: PaymentFilters;
  initialPaymentStatus?: string;
}>) {
  const { actor } = useStaffSession();
  const canReadFeePolicies = hasPermission(actor, "fee-policy:manage");
  const policyResource = useStaffResource<CurrentCreditPolicy>("credit-policy");
  const currentFees = useStaffResource<CurrentFeePolicy[]>(
    "fee-policies/current",
    { enabled: canReadFeePolicies },
  );

  const [tab, setTab] = useState<FinanceTab>(
    ["ledger", "payments", "wallet", "fees"].includes(initialTab)
      ? (initialTab as FinanceTab)
      : "ledger",
  );
  const [ledgerFilters, setLedgerFilters] = useState<LedgerFilters>(
    initialLedgerFilters ?? emptyLedgerFilters,
  );
  const [ledgerSeed, setLedgerSeed] = useState(0);
  const [paymentFilters, setPaymentFilters] = useState<PaymentFilters>(
    initialPaymentFilters ?? emptyPaymentFilters,
  );
  const [paymentStatus, setPaymentStatus] = useState(
    initialPaymentStatus ?? "",
  );
  const [paymentSeed, setPaymentSeed] = useState(0);
  const [walletUserId, setWalletUserId] = useState(initialWalletId ?? "");
  const [walletSeed, setWalletSeed] = useState(0);

  const policy = policyResource.data;
  const allPolicies = currentFees.data ?? policy?.policies ?? [];
  const vndPerCredit = policy?.topUpVndPerCredit;

  function switchTab(next: FinanceTab) {
    setTab(next);
    window.history.replaceState(null, "", `/admin/credits?tab=${next}`);
  }

  function openWallet(userId: string) {
    setWalletUserId(userId);
    setWalletSeed((value) => value + 1);
    setTab("wallet");
    window.history.replaceState(
      null,
      "",
      `/admin/credits?tab=wallet&userId=${encodeURIComponent(userId)}`,
    );
  }

  function openLedgerWith(partial: Partial<LedgerFilters>) {
    const next: LedgerFilters = { ...emptyLedgerFilters, ...partial };
    setLedgerFilters(next);
    setLedgerSeed((value) => value + 1);
    setTab("ledger");
    try {
      window.history.replaceState(null, "", ledgerHref(next));
    } catch {
      window.history.replaceState(null, "", "/admin/credits?tab=ledger");
    }
  }

  function openPaymentsForUser(userId: string) {
    const next: PaymentFilters = { ...emptyPaymentFilters, userId };
    setPaymentFilters(next);
    setPaymentStatus("");
    setPaymentSeed((value) => value + 1);
    setTab("payments");
    window.history.replaceState(
      null,
      "",
      `/admin/credits?tab=payments&userId=${encodeURIComponent(userId)}`,
    );
  }

  return (
    <div className={styles.workspace}>
      <PageHeader
        title="Tài chính & Credit"
        desc="Tra cứu sổ cái Credit bất biến, đối soát nạp tiền payOS, ví người dùng và chính sách phí nền tảng."
      />

      <FinancePolicyBanner
        policy={policy}
        allPolicies={allPolicies}
        canReadFeePolicies={canReadFeePolicies}
        loading={policyResource.loading}
        error={policyResource.error}
        feesLoading={currentFees.loading}
        feesError={currentFees.error}
      />

      <div className={styles.tabNavWrap}>
        <div
          className={styles.tabList}
          role="tablist"
          aria-label="Mục tài chính"
        >
          {financeTabs.map((item) => {
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                className={
                  active
                    ? `${styles.tabBtn} ${styles.tabBtnActive}`
                    : styles.tabBtn
                }
                onClick={() => switchTab(item.id)}
              >
                <Icon name={item.icon} size={16} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {tab === "ledger" && (
        <AdminLedgerScreen
          key={`ledger-${ledgerSeed}`}
          initialFilters={ledgerFilters}
          onOpenWallet={openWallet}
        />
      )}

      {tab === "payments" && (
        <PaymentsScreen
          key={`payments-${paymentSeed}`}
          initialPaymentId={paymentSeed === 0 ? initialPaymentId : undefined}
          initialFilters={paymentFilters}
          initialStatus={paymentStatus}
          onOpenWallet={openWallet}
          onOpenOperation={(operationId) => openLedgerWith({ operationId })}
        />
      )}

      {tab === "wallet" && (
        <WalletLookup
          key={`wallet-${walletSeed}`}
          initialUserId={walletUserId}
          vndPerCredit={vndPerCredit}
          onOpenLedger={(userId) => openLedgerWith({ userId })}
          onOpenPayments={openPaymentsForUser}
          onBrowseLedger={() => switchTab("ledger")}
        />
      )}

      {tab === "fees" && (
        <MaterialFeePolicies
          vndPerCredit={vndPerCredit}
          onPolicyChanged={() => {
            void policyResource.reload();
            if (canReadFeePolicies) void currentFees.reload();
          }}
        />
      )}
    </div>
  );
}

/* ==========================================================================
   Tab 2: Payments (Thanh toán nạp payOS)
   ========================================================================== */

type PaymentSelection = {
  id: string;
  mode: "detail" | "reconciliation";
};

function PaymentsScreen({
  initialPaymentId,
  initialFilters = emptyPaymentFilters,
  initialStatus = "",
  onOpenWallet,
  onOpenOperation,
}: Readonly<{
  initialPaymentId?: string;
  initialFilters?: PaymentFilters;
  initialStatus?: string;
  onOpenWallet: (userId: string) => void;
  onOpenOperation: (operationId: string) => void;
}>) {
  const [status, setStatus] = useState(
    Object.hasOwn(paymentStatuses, initialStatus) ? initialStatus : "",
  );
  const [draftFilters, setDraftFilters] = useState(initialFilters);
  const [filters, setFilters] = useState(() => {
    try {
      paymentQuery(initialFilters);
      return initialFilters;
    } catch {
      return emptyPaymentFilters;
    }
  });
  const [filterError, setFilterError] = useState(() => {
    try {
      paymentQuery(initialFilters);
      return "";
    } catch (cause) {
      return cause instanceof Error ? cause.message : "Bộ lọc chưa hợp lệ.";
    }
  });
  const [selected, setSelected] = useState<PaymentSelection | undefined>(() =>
    initialPaymentId && uuidRegex.test(initialPaymentId)
      ? { id: initialPaymentId, mode: "detail" }
      : undefined,
  );
  const [filtersOpen, setFiltersOpen] = useState(() =>
    Object.values(initialFilters).some((v) => v.trim()),
  );
  const filterPanelId = useId();

  const params = paymentQuery(filters);
  if (status) params.set("status", status);
  const list = useStaffPagedList<Payment>("payments?" + params);

  const advancedCount = Object.values(filters).filter((value) =>
    value.trim(),
  ).length;

  function syncUrl(nextFilters: PaymentFilters, nextStatus: string) {
    const query = paymentQuery(nextFilters);
    query.delete("limit");
    query.delete("includeTotal");
    query.set("tab", "payments");
    if (nextStatus) query.set("status", nextStatus);
    window.history.replaceState(null, "", "/admin/credits?" + query);
  }

  function applyStatus(nextStatus: string) {
    setStatus(nextStatus);
    setSelected(undefined);
    try {
      syncUrl(filters, nextStatus);
    } catch {
      // Ignore if filters invalid
    }
  }

  function applyFilters(nextDraft: PaymentFilters) {
    try {
      const next = Object.fromEntries(
        Object.entries(nextDraft).map(([key, value]) => [key, value.trim()]),
      ) as PaymentFilters;
      paymentQuery(next);
      setDraftFilters(next);
      setFilters(next);
      setFilterError("");
      setSelected(undefined);
      syncUrl(next, status);
    } catch (cause) {
      setFilterError(
        cause instanceof Error ? cause.message : "Bộ lọc chưa hợp lệ.",
      );
    }
  }

  function clearFilters() {
    setDraftFilters(emptyPaymentFilters);
    setFilters(emptyPaymentFilters);
    setFilterError("");
    setStatus("");
    setSelected(undefined);
    window.history.replaceState(null, "", "/admin/credits?tab=payments");
  }

  const activeTags: { id: string; label: string; remove: () => void }[] = [];
  if (status) {
    activeTags.push({
      id: "status",
      label: `Trạng thái: ${paymentStatuses[status] ?? status}`,
      remove: () => applyStatus(""),
    });
  }
  const filterMeta: readonly [keyof PaymentFilters, string][] = [
    ["userId", "Người dùng"],
    ["orderCode", "Đơn payOS"],
    ["gatewayTransactionId", "Mã GD cổng"],
    ["from", "Tạo từ"],
    ["before", "Tạo trước"],
    ["paidFrom", "TT từ"],
    ["paidBefore", "TT trước"],
  ];
  for (const [key, label] of filterMeta) {
    if (filters[key]) {
      const displayVal =
        key === "userId" || key === "gatewayTransactionId"
          ? shortId(filters[key])
          : filters[key];
      activeTags.push({
        id: key,
        label: `${label}: ${displayVal}`,
        remove: () => {
          const next = { ...filters, [key]: "" };
          if (key === "paidFrom") next.paidBefore = "";
          if (key === "paidBefore") next.paidFrom = "";
          applyFilters(next);
        },
      });
    }
  }

  return (
    <section className={styles.sectionCard} aria-label="Thanh toán nạp Credit">
      <div className={styles.cardHeader}>
        <div className={styles.cardTitleBlock}>
          <h2>Thanh toán nạp Credit</h2>
          <p>
            Tra cứu đơn thanh toán payOS, lọc nhanh theo trạng thái và đối soát
            khớp dữ liệu với sổ cái Credit.
          </p>
        </div>
        <div className={styles.cardHeaderActions}>
          <AdminFilterTrigger
            label="Bộ lọc"
            activeCount={advancedCount}
            open={filtersOpen}
            onToggle={() => setFiltersOpen((previous) => !previous)}
            onClear={activeTags.length > 0 ? clearFilters : undefined}
            panelId={filterPanelId}
          />
          <LoadingButton
            type="button"
            className="btn"
            disabled={list.loading}
            onClick={() => void list.reload()}
            loading={!!list.loading}
          >
            <Icon name="refresh" size={15} />
            Làm mới
          </LoadingButton>
        </div>
      </div>

      {/* Quick status chips */}
      <div
        className={styles.chipStrip}
        role="group"
        aria-label="Lọc nhanh trạng thái thanh toán"
      >
        <button
          type="button"
          className={
            status === ""
              ? `${styles.filterChip} ${styles.filterChipActive}`
              : styles.filterChip
          }
          aria-pressed={status === ""}
          onClick={() => applyStatus("")}
        >
          Tất cả
        </button>
        {paymentStatusOrder.map((code) => {
          const active = status === code;
          return (
            <button
              key={code}
              type="button"
              className={
                active
                  ? `${styles.filterChip} ${styles.filterChipActive}`
                  : styles.filterChip
              }
              aria-pressed={active}
              onClick={() => applyStatus(active ? "" : code)}
            >
              {paymentStatuses[code]}
            </button>
          );
        })}
      </div>

      {filtersOpen && (
        <div className={styles.advancedDrawer}>
          <AdminFilterPanel
            hideBar
            open={filtersOpen}
            onOpenChange={setFiltersOpen}
            panelId={filterPanelId}
          >
            <form
              className={filterPanelStyles.grid}
              onSubmit={(event) => {
                event.preventDefault();
                applyFilters(draftFilters);
              }}
            >
              {(
                [
                  ["userId", "Mã người dùng (UUID)", "text", "xxxxxxxx-xxxx-…"],
                  ["orderCode", "Mã đơn payOS", "text", "Ví dụ: 1000000039"],
                  [
                    "gatewayTransactionId",
                    "Mã giao dịch cổng thanh toán",
                    "text",
                    "Nhập mã từ payOS…",
                  ],
                  ["from", "Tạo từ (UTC)", "datetime-local", ""],
                  ["before", "Tạo trước (UTC)", "datetime-local", ""],
                  ["paidFrom", "Thanh toán từ (UTC)", "datetime-local", ""],
                  [
                    "paidBefore",
                    "Thanh toán trước (UTC)",
                    "datetime-local",
                    "",
                  ],
                ] as const
              ).map(([key, label, type, placeholder]) => (
                <label key={key} className={filterPanelStyles.field}>
                  <span>{label}</span>
                  <input
                    type={type}
                    value={draftFilters[key]}
                    placeholder={placeholder || undefined}
                    maxLength={key === "userId" ? 36 : 255}
                    onChange={(event) =>
                      setDraftFilters((previous) => ({
                        ...previous,
                        [key]: event.target.value,
                      }))
                    }
                  />
                </label>
              ))}
              <div className={filterPanelStyles.footer}>
                <p className={filterPanelStyles.note}>
                  Nếu lọc theo thời điểm thanh toán, hãy chọn đủ cả hai mốc Từ
                  và Trước.
                </p>
                <div className={filterPanelStyles.footerActions}>
                  <button type="submit" className="btn btn-primary btn-sm">
                    Áp dụng tra cứu
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={clearFilters}
                  >
                    Xóa lọc
                  </button>
                </div>
              </div>
            </form>
          </AdminFilterPanel>
        </div>
      )}

      {activeTags.length > 0 && (
        <div className={styles.activeFiltersBar} aria-label="Bộ lọc đang bật">
          <span className={styles.activeFilterLabel}>Đang lọc:</span>
          {activeTags.map((tag) => (
            <span key={tag.id} className={styles.activeFilterTag}>
              <span>{tag.label}</span>
              <button
                type="button"
                className={styles.activeFilterRemove}
                aria-label={`Bỏ bộ lọc ${tag.label}`}
                onClick={tag.remove}
              >
                <Icon name="x" size={12} />
              </button>
            </span>
          ))}
          <button
            type="button"
            className={styles.clearAllLink}
            onClick={clearFilters}
          >
            Xóa tất cả
          </button>
        </div>
      )}

      {filterError && (
        <p className={`staff-error ${styles.inlineError}`} role="alert">
          {filterError}
        </p>
      )}

      <QueueState
        loading={list.loading}
        error={list.error}
        empty={!list.items.length}
        emptyTitle="Chưa có thanh toán phù hợp"
        emptyDescription="Không có đơn nạp nào khớp với trạng thái hoặc tiêu chí đang chọn."
        reload={list.reload}
      >
        {/* Desktop Table */}
        <div className={styles.desktopTableWrap}>
          <table className={styles.dataTable}>
            <thead>
              <tr>
                <th scope="col">Đơn / Thời gian</th>
                <th scope="col">Người dùng</th>
                <th scope="col" className={styles.numHead}>
                  Số tiền / Credit
                </th>
                <th scope="col">Trạng thái</th>
                <th scope="col" className={styles.actionHead}>
                  Tra cứu
                </th>
              </tr>
            </thead>
            <tbody>
              {list.items.map((p) => {
                const orderTitle = p.payosCheckout?.orderCode
                  ? `Đơn #${p.payosCheckout.orderCode}`
                  : `Thanh toán #${p.id.slice(0, 8)}`;
                return (
                  <tr key={p.id}>
                    <td>
                      <div className={styles.primaryStack}>
                        <strong>{orderTitle}</strong>
                        <span className={styles.metaText}>
                          {fmtDateTime(p.createdAt)}
                        </span>
                      </div>
                    </td>
                    <td>
                      <UserProfileReference userId={p.userId} />
                    </td>
                    <td className={styles.numCell}>
                      <span className={styles.vndPrimary}>
                        {financeNumber(p.paymentAmountVnd)} ₫
                      </span>
                      <span className={styles.creditSub}>
                        +{financeNumber(p.creditAmount)} CR
                      </span>
                    </td>
                    <td>
                      <PaymentStatus status={p.status} />
                    </td>
                    <td className={styles.actionCell}>
                      <div className={styles.rowActions}>
                        <button
                          type="button"
                          className="btn btn-sm"
                          onClick={() =>
                            setSelected({ id: p.id, mode: "detail" })
                          }
                        >
                          Chi tiết
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() =>
                            setSelected({ id: p.id, mode: "reconciliation" })
                          }
                        >
                          Đối soát
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Tablet & Mobile Payment Cards */}
        <div className={styles.mobileCards}>
          {list.items.map((p) => {
            const orderTitle = p.payosCheckout?.orderCode
              ? `Đơn #${p.payosCheckout.orderCode}`
              : `Thanh toán #${p.id.slice(0, 8)}`;
            return (
              <article key={p.id} className={styles.itemCard}>
                <div className={styles.itemCardHead}>
                  <div className={styles.itemCardTitle}>
                    <strong>{orderTitle}</strong>
                    <div>
                      <PaymentStatus status={p.status} />
                    </div>
                  </div>
                  <div className={styles.itemCardAmount}>
                    <span className={styles.vndPrimary}>
                      {financeNumber(p.paymentAmountVnd)} ₫
                    </span>
                    <span className={styles.creditSub}>
                      +{financeNumber(p.creditAmount)} CR
                    </span>
                  </div>
                </div>

                <div className={styles.itemCardMetaRow}>
                  <span>{fmtDateTime(p.createdAt)}</span>
                  <UserProfileReference userId={p.userId} />
                </div>

                <div className={styles.itemCardFoot}>
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => setSelected({ id: p.id, mode: "detail" })}
                  >
                    Chi tiết
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() =>
                      setSelected({ id: p.id, mode: "reconciliation" })
                    }
                  >
                    Đối soát
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </QueueState>

      <div className={styles.footerWrap}>
        <PageNavigation
          loading={list.loading}
          pageNumber={list.pageNumber}
          totalPages={list.totalPages}
          hasNext={list.page?.hasMore ?? false}
          onPageChange={(page) => {
            setSelected(undefined);
            void list.goToPage(page);
          }}
        />
      </div>

      {selected && (
        <PaymentDrawer
          key={`${selected.mode}:${selected.id}`}
          selection={selected}
          onSwitchMode={(mode) => setSelected({ id: selected.id, mode })}
          onOpenWallet={(userId) => {
            setSelected(undefined);
            onOpenWallet(userId);
          }}
          onOpenOperation={(operationId) => {
            setSelected(undefined);
            onOpenOperation(operationId);
          }}
          close={() => setSelected(undefined)}
        />
      )}
    </section>
  );
}

function PaymentDrawer({
  selection,
  onSwitchMode,
  onOpenWallet,
  onOpenOperation,
  close,
}: Readonly<{
  selection: PaymentSelection;
  onSwitchMode: (mode: "detail" | "reconciliation") => void;
  onOpenWallet: (userId: string) => void;
  onOpenOperation: (operationId: string) => void;
  close: () => void;
}>) {
  const path =
    selection.mode === "reconciliation"
      ? `payments/${selection.id}/reconciliation`
      : `payments/${selection.id}`;
  const resource = useStaffResource<unknown>(path);

  const isReconcile = selection.mode === "reconciliation";
  const payment =
    !isReconcile && resource.data && typeof resource.data === "object"
      ? (resource.data as Payment)
      : undefined;
  const report =
    isReconcile && resource.data && typeof resource.data === "object"
      ? (resource.data as PaymentReconciliationReport)
      : undefined;

  return (
    <AdminDrawer
      title={isReconcile ? "Đối soát thanh toán" : "Chi tiết thanh toán"}
      subtitle={<RecordId id={selection.id} label="thanh toán" />}
      close={close}
      footer={
        <>
          <button
            type="button"
            className="btn"
            onClick={() =>
              onSwitchMode(isReconcile ? "detail" : "reconciliation")
            }
          >
            {isReconcile ? "Xem chi tiết đơn" : "Đối soát đơn này"}
          </button>
          <button type="button" className="btn btn-primary" onClick={close}>
            Đóng
          </button>
        </>
      }
    >
      <QueueState
        loading={resource.loading}
        error={resource.error}
        empty={!resource.data}
        reload={resource.reload}
      >
        {payment && (
          <PaymentDetailContent
            payment={payment}
            onOpenWallet={onOpenWallet}
            onOpenOperation={onOpenOperation}
          />
        )}
        {report && (
          <PaymentReconciliationContent
            report={report}
            onOpenWallet={onOpenWallet}
            onOpenOperation={onOpenOperation}
          />
        )}
        {resource.data !== undefined && (
          <details className={styles.technicalDetails}>
            <summary>Thông tin đối chiếu & mã tham chiếu đầy đủ</summary>
            <FinanceDetails value={resource.data} />
          </details>
        )}
      </QueueState>
    </AdminDrawer>
  );
}

function PaymentDetailContent({
  payment,
  onOpenWallet,
  onOpenOperation,
}: Readonly<{
  payment: Payment;
  onOpenWallet: (userId: string) => void;
  onOpenOperation: (operationId: string) => void;
}>) {
  const orderCode = payment.payosCheckout?.orderCode;
  const topUpOpId = payment.payosCheckout?.topUpOperationId;

  return (
    <>
      <div className={styles.drawerHero}>
        <div className={styles.drawerHeroTop}>
          <span className={styles.drawerHeroEyebrow}>
            {orderCode ? `Đơn payOS #${orderCode}` : "Đơn nạp Credit"}
          </span>
          <PaymentStatus status={payment.status} />
        </div>
        <strong className={styles.drawerHeroValue}>
          {financeNumber(payment.paymentAmountVnd)} ₫
        </strong>
        <div className={styles.drawerHeroSub}>
          <span className={styles.creditSub} style={{ marginTop: 0 }}>
            Quy đổi: +{financeNumber(payment.creditAmount)} CR
          </span>
          {payment.conversionRateVndPerCredit && (
            <>
              <span>·</span>
              <span>
                {payment.conversionRateVndPerCredit.toLocaleString("vi-VN")}{" "}
                VND/CR
              </span>
            </>
          )}
        </div>
      </div>

      <section className="admin-section">
        <h3>Thông tin giao dịch</h3>
        <div className="admin-field-grid">
          <AdminField label="Người dùng">
            <UserProfileReference userId={payment.userId} />
          </AdminField>
          <AdminField label="Cổng thanh toán">
            {payment.gateway || "payOS"}
          </AdminField>
          <AdminField label="Thời gian tạo">
            {fmtDateTime(payment.createdAt)}
          </AdminField>
          <AdminField label="Thanh toán lúc">
            {payment.payosCheckout?.paidAt
              ? fmtDateTime(payment.payosCheckout.paidAt)
              : "Chưa thanh toán"}
          </AdminField>
          <AdminField label="Hết hạn đơn">
            {payment.payosCheckout?.expiresAt
              ? fmtDateTime(payment.payosCheckout.expiresAt)
              : "—"}
          </AdminField>
          <AdminField label="Tình trạng cổng">
            {payment.payosCheckout?.state
              ? systemCodeLabel(
                  payment.payosCheckout.state,
                  payment.payosCheckout.state,
                )
              : "—"}
          </AdminField>
          {payment.gatewayTransactionId && (
            <AdminField label="Mã giao dịch cổng">
              <RecordId
                id={payment.gatewayTransactionId}
                label="giao dịch cổng"
              />
            </AdminField>
          )}
          {topUpOpId && (
            <AdminField label="Nghiệp vụ nạp Credit">
              <RecordId id={topUpOpId} label="nghiệp vụ nạp" />
            </AdminField>
          )}
        </div>
      </section>

      <section className="admin-section">
        <div className={styles.quickNavRow}>
          <UserProfileReference userId={payment.userId} className="btn btn-sm">
            Hồ sơ người dùng
          </UserProfileReference>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => onOpenWallet(payment.userId)}
          >
            Xem ví người dùng
          </button>
          {topUpOpId && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => onOpenOperation(topUpOpId)}
            >
              Xem bút toán nạp Credit
            </button>
          )}
        </div>
      </section>
    </>
  );
}

function PaymentReconciliationContent({
  report,
  onOpenWallet,
  onOpenOperation,
}: Readonly<{
  report: PaymentReconciliationReport;
  onOpenWallet: (userId: string) => void;
  onOpenOperation: (operationId: string) => void;
}>) {
  const records = Array.isArray(report.records) ? report.records : [];
  const totalFindings = records.reduce(
    (sum, rec) => sum + (Array.isArray(rec.findings) ? rec.findings.length : 0),
    0,
  );
  const clean = totalFindings === 0;

  return (
    <>
      <div
        className={`${styles.reconcileBanner} ${clean ? styles.reconcileOk : styles.reconcileWarn}`}
        role="status"
      >
        <Icon name={clean ? "check" : "warn"} size={20} />
        <div>
          <strong>
            {clean
              ? "Đối soát khớp — Không ghi nhận sai lệch"
              : `Phát hiện ${totalFindings} điểm sai lệch cần kiểm tra`}
          </strong>
          <p>
            {clean
              ? "Dữ liệu thanh toán, đơn payOS và sổ cái Credit hiện khớp nhau trong cơ sở dữ liệu."
              : "Kiểm tra các phát hiện bên dưới trước khi thực hiện đối chiếu thủ công với nhà cung cấp."}
          </p>
        </div>
      </div>

      {records.map((rec, idx) => {
        const findings = Array.isArray(rec.findings) ? rec.findings : [];
        const opIds = Array.isArray(rec.topUpOperationIds)
          ? rec.topUpOperationIds
          : [];
        return (
          <section key={rec.paymentId ?? idx} className="admin-section">
            <h3>
              {rec.orderCode
                ? `Kết quả đối soát · Đơn #${rec.orderCode}`
                : "Kết quả đối soát"}
            </h3>
            <div className="admin-field-grid">
              {rec.status && (
                <AdminField label="Trạng thái thanh toán">
                  <PaymentStatus status={rec.status} />
                </AdminField>
              )}
              {rec.paymentAmountVnd && (
                <AdminField label="Số tiền thanh toán">
                  <span className={styles.vndPrimary}>
                    {financeNumber(rec.paymentAmountVnd)} ₫
                  </span>
                </AdminField>
              )}
              {typeof rec.currentChannelMatches === "boolean" && (
                <AdminField label="Khớp kênh hiện tại">
                  <Badge tone={rec.currentChannelMatches ? "ok" : "warn"}>
                    {rec.currentChannelMatches ? "Khớp" : "Không khớp"}
                  </Badge>
                </AdminField>
              )}
              {rec.userId && (
                <AdminField label="Người dùng">
                  <UserProfileReference userId={rec.userId} />
                </AdminField>
              )}
            </div>

            {findings.length > 0 && (
              <div style={{ marginTop: 14 }}>
                <strong style={{ fontSize: 13 }}>Chi tiết phát hiện:</strong>
                <ul className={styles.findingList}>
                  {keyedFinanceItems(findings).map(({ value: f, key }) => (
                    <li key={key}>
                      {typeof f === "string"
                        ? systemCodeLabel(f, "Có sai lệch cần kiểm tra thêm.")
                        : "Có sai lệch cần kiểm tra thêm."}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className={styles.quickNavRow} style={{ marginTop: 14 }}>
              {rec.userId && (
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => onOpenWallet(rec.userId!)}
                >
                  Xem ví người dùng
                </button>
              )}
              {opIds.map((opId) => (
                <button
                  key={opId}
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => onOpenOperation(opId)}
                >
                  Xem nghiệp vụ nạp ({shortId(opId)})
                </button>
              ))}
            </div>
          </section>
        );
      })}
    </>
  );
}

/* ==========================================================================
   Tab 3: Inline Wallet Lookup (Ví người dùng)
   ========================================================================== */

function WalletLookup({
  initialUserId = "",
  vndPerCredit,
  onOpenLedger,
  onOpenPayments,
  onBrowseLedger,
}: Readonly<{
  initialUserId?: string;
  vndPerCredit?: number;
  onOpenLedger: (userId: string) => void;
  onOpenPayments: (userId: string) => void;
  onBrowseLedger: () => void;
}>) {
  const initial = uuidRegex.test(initialUserId) ? initialUserId : "";
  const [draft, setDraft] = useState(initial);
  const [activeId, setActiveId] = useState(initial);
  const [validationError, setValidationError] = useState("");
  const [recentIds, setRecentIds] = useState<string[]>(() =>
    initial ? [initial] : [],
  );

  function submitLookup(raw: string) {
    const trimmed = raw.trim();
    if (!trimmed) {
      setValidationError("Nhập mã người dùng (UUID) để tra cứu số dư ví.");
      return;
    }
    if (!uuidRegex.test(trimmed)) {
      setValidationError(
        "Mã người dùng chưa đúng định dạng UUID 36 ký tự (ví dụ: de51e7c1-xxxx-xxxx-xxxx-xxxxxxxx8ec9).",
      );
      return;
    }
    setValidationError("");
    setDraft(trimmed);
    setActiveId(trimmed);
    setRecentIds((prev) =>
      [trimmed, ...prev.filter((item) => item !== trimmed)].slice(0, 5),
    );
    window.history.replaceState(
      null,
      "",
      `/admin/credits?tab=wallet&userId=${encodeURIComponent(trimmed)}`,
    );
  }

  function clearLookup() {
    setDraft("");
    setActiveId("");
    setValidationError("");
    window.history.replaceState(null, "", "/admin/credits?tab=wallet");
  }

  return (
    <section className={styles.sectionCard} aria-label="Tra cứu ví người dùng">
      <div className={styles.cardHeader}>
        <div className={styles.cardTitleBlock}>
          <h2>Tra cứu ví người dùng</h2>
          <p>
            Kiểm tra nhanh số dư Credit khả dụng, Credit đang tạm giữ và đi
            thẳng tới lịch sử giao dịch hoặc đơn nạp của người dùng.
          </p>
        </div>
      </div>

      <div className={styles.walletSearchBox}>
        <form
          className={styles.walletForm}
          onSubmit={(event) => {
            event.preventDefault();
            submitLookup(draft);
          }}
        >
          <div className={styles.walletInputWrap}>
            <Icon name="search" size={16} />
            <input
              type="text"
              aria-label="Mã người dùng (UUID)"
              value={draft}
              maxLength={40}
              spellCheck={false}
              autoCapitalize="none"
              placeholder="Dán mã UUID người dùng (36 ký tự)…"
              onChange={(event) => {
                setDraft(event.target.value);
                if (validationError) setValidationError("");
              }}
            />
          </div>
          <div className={styles.walletFormActions}>
            <button type="submit" className="btn btn-primary">
              Tra cứu ví
            </button>
            {(draft || activeId) && (
              <button type="button" className="btn" onClick={clearLookup}>
                Xóa
              </button>
            )}
          </div>
        </form>

        {validationError && (
          <p role="alert" className="staff-error" style={{ margin: 0 }}>
            {validationError}
          </p>
        )}

        {recentIds.length > 0 && (
          <div className={styles.recentRow}>
            <span>Tra cứu gần đây:</span>
            {recentIds.map((uid) => (
              <button
                key={uid}
                type="button"
                className={styles.recentPill}
                onClick={() => submitLookup(uid)}
              >
                {shortId(uid)}
              </button>
            ))}
          </div>
        )}
      </div>

      {activeId ? (
        <InlineWalletResult
          key={activeId}
          userId={activeId}
          vndPerCredit={vndPerCredit}
          onOpenLedger={onOpenLedger}
          onOpenPayments={onOpenPayments}
        />
      ) : (
        <div className={styles.walletEmpty}>
          <span className={styles.walletEmptyIcon} aria-hidden="true">
            <Icon name="wallet" size={22} />
          </span>
          <strong>Nhập mã người dùng để xem số dư ví</strong>
          <p>
            Bạn có thể sao chép mã người dùng từ tab Giao dịch Credit, Thanh
            toán nạp hoặc danh sách Người dùng rồi dán vào ô tra cứu ở trên.
          </p>
          <button
            type="button"
            className="btn btn-sm"
            style={{ marginTop: 6 }}
            onClick={onBrowseLedger}
          >
            Mở sổ cái Giao dịch Credit
          </button>
        </div>
      )}
    </section>
  );
}

function InlineWalletResult({
  userId,
  vndPerCredit,
  onOpenLedger,
  onOpenPayments,
}: Readonly<{
  userId: string;
  vndPerCredit?: number;
  onOpenLedger: (userId: string) => void;
  onOpenPayments: (userId: string) => void;
}>) {
  const resource = useStaffResource<WalletResponse>(`users/${userId}/wallet`);
  const wallet = resource.data;

  const totalCredit = wallet
    ? sumCreditStrings([wallet.availableCredit, wallet.heldCredit])
    : "0.00";
  const availablePct = wallet
    ? creditRatioPercent(wallet.availableCredit, totalCredit)
    : 0;
  const heldPct =
    wallet && creditDirection(wallet.heldCredit) === "positive"
      ? Math.max(0, 100 - availablePct)
      : 0;
  const hasHeld = wallet
    ? creditDirection(wallet.heldCredit) === "positive"
    : false;

  const totalVnd =
    wallet && vndPerCredit
      ? creditToVndEstimate(totalCredit, vndPerCredit)
      : null;
  const availVnd =
    wallet && vndPerCredit
      ? creditToVndEstimate(wallet.availableCredit, vndPerCredit)
      : null;
  const heldVnd =
    wallet && vndPerCredit
      ? creditToVndEstimate(wallet.heldCredit, vndPerCredit)
      : null;

  return (
    <QueueState
      loading={resource.loading}
      error={resource.error}
      empty={!wallet}
      reload={resource.reload}
      emptyTitle="Không tìm thấy ví người dùng"
      emptyDescription="Kiểm tra lại mã người dùng hoặc tải lại dữ liệu."
    >
      {wallet && (
        <div className={styles.walletBody}>
          <div className={styles.walletHeader}>
            <div className={styles.walletIdentity}>
              <span className={styles.walletAvatar} aria-hidden="true">
                <Icon name="wallet" size={20} />
              </span>
              <div className={styles.primaryStack}>
                <strong>Ví Credit người dùng</strong>
                <UserProfileReference userId={wallet.userId} />
              </div>
            </div>
            <div className={styles.cardHeaderActions}>
              <Badge tone="neutral">Phiên bản ví #{wallet.walletVersion}</Badge>
              <LoadingButton
                type="button"
                className="btn btn-sm"
                loading={resource.loading}
                onClick={() => void resource.reload()}
              >
                <Icon name="refresh" size={14} />
                Cập nhật
              </LoadingButton>
            </div>
          </div>

          <div className={styles.walletKpiGrid}>
            <div className={styles.kpiCard}>
              <span className={styles.kpiLabel}>Tổng số dư trong ví</span>
              <strong className={styles.kpiValue}>
                {financeNumber(totalCredit)} CR
              </strong>
              <span className={styles.kpiSub}>
                {totalVnd ? `≈ ${totalVnd}` : "Khả dụng + Đang tạm giữ"}
              </span>
            </div>

            <div className={`${styles.kpiCard} ${styles.kpiCardBrand}`}>
              <span className={styles.kpiLabel}>Credit khả dụng</span>
              <strong className={`${styles.kpiValue} ${styles.kpiValueBrand}`}>
                {financeNumber(wallet.availableCredit)} CR
              </strong>
              <span className={styles.kpiSub}>
                {availVnd ? `≈ ${availVnd}` : "Có thể sử dụng ngay"}
              </span>
            </div>

            <div
              className={
                hasHeld
                  ? `${styles.kpiCard} ${styles.kpiCardWarn}`
                  : styles.kpiCard
              }
            >
              <span className={styles.kpiLabel}>Credit đang tạm giữ</span>
              <strong
                className={
                  hasHeld
                    ? `${styles.kpiValue} ${styles.kpiValueWarn}`
                    : styles.kpiValue
                }
              >
                {financeNumber(wallet.heldCredit)} CR
              </strong>
              <span className={styles.kpiSub}>
                {heldVnd ? `≈ ${heldVnd}` : "Đang khóa cho lộ trình/giao dịch"}
              </span>
            </div>
          </div>

          <div className={styles.ratioBarWrap}>
            <div className={styles.ratioLabels}>
              <span className={styles.ratioLegend}>
                <span className={styles.legendDotBrand} aria-hidden="true" />
                Khả dụng: {availablePct}%
              </span>
              <span className={styles.ratioLegend}>
                <span className={styles.legendDotWarn} aria-hidden="true" />
                Đang tạm giữ: {heldPct}%
              </span>
            </div>
            <div className={styles.ratioTrack} aria-hidden="true">
              <div
                className={styles.ratioFillBrand}
                style={{ width: `${availablePct}%` }}
              />
              <div
                className={styles.ratioFillWarn}
                style={{ width: `${heldPct}%` }}
              />
            </div>
          </div>

          <div className={styles.quickNavRow}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => onOpenLedger(wallet.userId)}
            >
              <Icon name="activity" size={15} />
              Xem giao dịch Credit
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => onOpenPayments(wallet.userId)}
            >
              <Icon name="card" size={15} />
              Xem thanh toán nạp
            </button>
            <UserProfileReference userId={wallet.userId} className="btn">
              <Icon name="users" size={15} />
              Mở hồ sơ người dùng
            </UserProfileReference>
          </div>
        </div>
      )}
    </QueueState>
  );
}

/* ==========================================================================
   Shared Helpers for Technical Details & Status Badges
   ========================================================================== */

function FinanceDetails({ value }: Readonly<{ value: unknown }>) {
  if (value === null || value === undefined) return <span>—</span>;
  if (typeof value === "boolean") return <span>{value ? "Có" : "Không"}</span>;
  if (Array.isArray(value))
    return value.length ? (
      <ul className={styles.findingList}>
        {keyedFinanceItems(value).map(({ value: item, key }) => (
          <li key={key}>
            <FinanceDetails value={item} />
          </li>
        ))}
      </ul>
    ) : (
      <span>Không có</span>
    );
  if (typeof value === "object")
    return (
      <dl className={styles.technicalGrid}>
        {Object.entries(value).map(([key, v]) => (
          <div key={key} className={styles.technicalRow}>
            <dt>{detailLabels[key] || "Thông tin bổ sung"}</dt>
            <dd>
              {typeof v === "string" ? (
                <FinanceValue
                  name={key}
                  value={v}
                  payment={"paymentAmountVnd" in value}
                />
              ) : (
                <FinanceDetails value={v} />
              )}
            </dd>
          </div>
        ))}
      </dl>
    );
  if (typeof value === "string")
    return (
      <span>
        {/^[A-Z][A-Z0-9_]+$/.test(value)
          ? systemCodeLabel(value, "Thông tin bổ sung")
          : value}
      </span>
    );
  if (typeof value === "number" || typeof value === "bigint")
    return <span>{value.toString()}</span>;
  return <span>—</span>;
}

function FinanceValue({
  name,
  value,
  payment = false,
}: Readonly<{ name: string; value: string; payment?: boolean }>) {
  if (name === "userId") return <UserProfileReference userId={value} />;
  if (name === "status")
    return payment ? (
      <PaymentStatus status={value} />
    ) : (
      <StatusBadge status={value} />
    );
  if (["createdAt", "paidAt", "expiresAt"].includes(name))
    return (
      <>
        {Number.isFinite(Date.parse(value))
          ? fmtDateTime(value)
          : "Chưa có thời gian"}
      </>
    );
  if (["type", "operationType", "referenceType"].includes(name))
    return <>{financeLabel(value)}</>;
  if (
    [
      "amount",
      "creditAmount",
      "availableCredit",
      "heldCredit",
      "availableDelta",
      "heldDelta",
      "availableAfter",
      "heldAfter",
    ].includes(name)
  )
    return (
      <span className={styles.amountPrimary}>{financeNumber(value)} CR</span>
    );
  if (name === "paymentAmountVnd")
    return <span className={styles.vndPrimary}>{financeNumber(value)} ₫</span>;
  if (
    [
      "id",
      "paymentId",
      "operationId",
      "topUpOperationId",
      "gatewayTransactionId",
    ].includes(name)
  )
    return <RecordId id={value} label={detailLabels[name] ?? "mã"} />;
  return (
    <>
      {["state", "providerStatus", "basis"].includes(name)
        ? systemCodeLabel(value, "Thông tin bổ sung")
        : value}
    </>
  );
}

function PaymentStatus({ status }: Readonly<{ status: string }>) {
  function paymentTone() {
    if (status === "PAID") return "ok";
    if (status === "FAILED") return "bad";
    if (["PENDING", "REVIEW"].includes(status)) return "warn";
    if (status === "REFUNDED") return "info";
    return "neutral";
  }
  const tone = paymentTone();
  return (
    <span className={`badge badge-${tone}`}>
      {paymentStatuses[status] ?? "Chưa xác định"}
    </span>
  );
}
