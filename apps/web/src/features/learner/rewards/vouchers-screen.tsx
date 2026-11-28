"use client";
import { LoadingButton } from "@/components/loading-button";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Wallet } from "../account/account-types";
import { UserApiError } from "../api/client";
import { useUserSession } from "../auth/session";
import { Feedback, PageHeading } from "../components/common";
import { ProductIcon } from "../components/product-icon";
import { useUserPagedList } from "../hooks/use-user-paged-list";
import { useUserResource } from "../hooks/use-user-resource";
import {
  parseRewardIntent,
  redemptionMetadata,
  type Redemption,
  type RewardIntent,
  type RewardProduct,
} from "./reward-contract";
import { formatCreditAmount, parseCreditValue } from "./reward-presentation";
import { VoucherCatalogSection } from "./voucher-catalog";
import {
  ProductDetailsView,
  RedemptionDetailsPanel,
  RedemptionHistorySection,
} from "./voucher-detail-view";
import styles from "./vouchers-screen.module.css";

type ActiveTab = "catalog" | "history";

export function VouchersScreen({
  productId,
  redemptionId,
}: Readonly<{ productId?: string; redemptionId?: string }>) {
  const { actor } = useUserSession();
  return (
    <VoucherWorkspace
      key={actor.userId}
      productId={productId}
      redemptionId={redemptionId}
    />
  );
}

function VoucherWorkspace({
  productId,
  redemptionId,
}: Readonly<{ productId?: string; redemptionId?: string }>) {
  const { request, actor, refresh } = useUserSession();
  const [category, setCategory] = useState("");
  const [brand, setBrand] = useState("");
  const [activeTab, setActiveTab] = useState<ActiveTab>(
    redemptionId ? "history" : "catalog",
  );
  const wallet = useUserResource<Wallet>("me/wallet");
  const allCatalog = useUserResource<RewardProduct[]>(
    "rewards/products?locale=vi",
  );
  const catalogParams = new URLSearchParams({ locale: "vi" });
  if (brand) catalogParams.set("brandId", brand);
  if (category) catalogParams.set("category", category);
  const filteredCatalog = useUserResource<RewardProduct[]>(
    brand || category ? `rewards/products?${catalogParams}` : null,
  );
  const catalog = brand || category ? filteredCatalog : allCatalog;
  const product = useUserResource<RewardProduct>(
    productId ? `rewards/products/${productId}?locale=vi` : null,
  );
  const history = useUserPagedList<Redemption>("rewards/redemptions?limit=20");

  const [intent, setIntent] = useState<RewardIntent | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState("");
  const [localResult, setLocalResult] = useState<{
    routeId?: string;
    id: string;
  } | null>(null);
  const [created, setCreated] = useState<Redemption>();
  const lock = useRef(false);
  const lifetime = useRef<AbortController | null>(null);
  const storageKey = `skillhub:reward-intent:${actor.userId}`;

  useEffect(() => {
    const controller = new AbortController();
    lifetime.current = controller;
    const restore = () => {
      if (controller.signal.aborted) return;
      try {
        setIntent(
          parseRewardIntent(localStorage.getItem(storageKey), actor.userId),
        );
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : "Không thể đọc yêu cầu đã lưu.",
        );
      }
      setReady(true);
    };
    void Promise.resolve().then(restore);
    window.addEventListener("storage", restore);
    return () => {
      controller.abort();
      window.removeEventListener("storage", restore);
    };
  }, [storageKey, actor.userId]);

  async function execute(recovery: boolean, chosen?: RewardProduct) {
    if (lock.current || !ready) return;
    lock.current = true;
    setBusy(true);
    setError(undefined);
    setNotice("");
    const work = async () => {
      let pending = parseRewardIntent(
        localStorage.getItem(storageKey),
        actor.userId,
      );
      if (recovery) {
        if (!pending) return;
      } else {
        if (pending) {
          setIntent(pending);
          throw new Error(
            "Kiểm tra yêu cầu đã lưu trước khi đổi voucher khác.",
          );
        }
        if (!chosen) return;
        pending = {
          userId: actor.userId,
          key: crypto.randomUUID(),
          productId: chosen.id,
          expectedPriceVersion: chosen.priceVersion,
        };
        localStorage.setItem(storageKey, JSON.stringify(pending));
        setIntent(pending);
      }
      const signal = lifetime.current?.signal;
      try {
        const reply = await request<Redemption>(
          recovery ? "rewards/redemptions/lookup" : "rewards/redemptions",
          {
            method: "POST",
            key: pending!.key,
            signal,
            ...(recovery
              ? {}
              : {
                  body: {
                    productId: pending!.productId,
                    expectedPriceVersion: pending!.expectedPriceVersion,
                  },
                }),
          },
        );
        const metadata = redemptionMetadata(reply.data);
        if (metadata.product.id !== pending!.productId) {
          throw new Error(
            "Kết quả không khớp voucher đã chọn. Giữ yêu cầu đã lưu để kiểm tra.",
          );
        }
        if (signal?.aborted) return;
        localStorage.removeItem(storageKey);
        setIntent(null);
        setCreated(metadata);
        setLocalResult({ routeId: redemptionId, id: metadata.id });
        setNotice(
          "Đã ghi nhận yêu cầu đổi voucher. Bạn có thể xem mã hoặc theo dõi trạng thái ngay bên dưới.",
        );
        history.reload();
        wallet.reload();
        if (productId) product.reload();
        allCatalog.reload();
        if (brand || category) filteredCatalog.reload();
        refresh();
      } catch (cause) {
        if (signal?.aborted) return;
        if (
          recovery &&
          cause instanceof UserApiError &&
          cause.status === 404 &&
          cause.code === "VOUCHER_REDEMPTION_NOT_FOUND"
        ) {
          localStorage.removeItem(storageKey);
          setIntent(null);
          if (productId) product.reload();
          allCatalog.reload();
          if (brand || category) filteredCatalog.reload();
          wallet.reload();
          setNotice(
            "Máy chủ xác nhận yêu cầu cũ không phát sinh đổi thưởng. Bạn có thể chọn lại voucher.",
          );
        } else {
          throw cause;
        }
      }
    };
    try {
      if (navigator.locks) await navigator.locks.request(storageKey, work);
      else await work();
    } catch (cause) {
      if (!lifetime.current?.signal.aborted) {
        setError(
          cause instanceof Error
            ? cause.message
            : "Chưa xác định được kết quả. Kiểm tra lại yêu cầu đã lưu.",
        );
      }
    } finally {
      lock.current = false;
      if (!lifetime.current?.signal.aborted) setBusy(false);
    }
  }

  const allProducts = allCatalog.data ?? [];
  const products = catalog.data ?? [];
  const availableCredit = parseCreditValue(wallet.data?.availableCredit);
  const pendingHistoryCount = history.allItems.filter((row) =>
    ["ISSUING", "MANUAL_REVIEW"].includes(row.status),
  ).length;
  const resultId =
    localResult && localResult.routeId === redemptionId
      ? localResult.id
      : redemptionId;
  const knownRedemption = resultId
    ? (history.allItems.find((row) => row.id === resultId) ??
      (created?.id === resultId ? created : undefined))
    : undefined;

  return (
    <div className={styles.page}>
      <PageHeading
        eyebrow="Quy đổi Credit"
        title="Voucher & phần thưởng"
        description="Dùng Credit khả dụng để đổi voucher từ các thương hiệu đối tác. Giá đổi và hạn mức được máy chủ xác nhận khi đổi."
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
                    ? `${formatCreditAmount(wallet.data.availableCredit)} Credit`
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

      <Feedback error={error} />

      {notice && (
        <output className={`${styles.banner} ${styles.bannerSuccess}`}>
          <span className={styles.bannerBody}>
            <span className={styles.bannerIcon} aria-hidden="true">
              <ProductIcon name="check" size={18} />
            </span>
            <span className={styles.bannerText}>
              <p>{notice}</p>
            </span>
          </span>
          <button
            type="button"
            className={styles.bannerClose}
            onClick={() => setNotice("")}
          >
            Đóng
          </button>
        </output>
      )}

      {intent && (
        <section
          className={`${styles.banner} ${styles.bannerWarn}`}
          aria-label="Yêu cầu đổi voucher đang chờ kiểm tra"
        >
          <div className={styles.bannerBody}>
            <span className={styles.bannerIcon} aria-hidden="true">
              <ProductIcon name="clock" size={18} />
            </span>
            <div className={styles.bannerText}>
              <strong>Có yêu cầu đổi voucher cần kiểm tra</strong>
              <p>
                Yêu cầu đã lưu được giữ qua lần đóng trình duyệt. Kiểm tra kết
                quả trước khi đổi tiếp để tránh gửi trùng giao dịch.
              </p>
            </div>
          </div>
          <div className={styles.bannerActions}>
            <LoadingButton
              type="button"
              className="btn btn-primary"
              loading={busy}
              onClick={() => void execute(true)}
            >
              <ProductIcon name="refresh" size={15} />
              Kiểm tra yêu cầu đã lưu
            </LoadingButton>
          </div>
        </section>
      )}

      {resultId && (
        <div className={styles.detailWrap}>
          {redemptionId && !productId && (
            <Link href="/learn/vouchers" className={styles.backLink}>
              ← Quay lại danh mục voucher
            </Link>
          )}
          <RedemptionDetailsPanel
            key={resultId}
            id={resultId}
            known={knownRedemption}
            reload={history.reload}
            onClose={
              !redemptionId || localResult?.id === resultId
                ? () => setLocalResult(null)
                : undefined
            }
          />
        </div>
      )}

      {productId ? (
        <div className={styles.detailWrap}>
          <Link href="/learn/vouchers" className={styles.backLink}>
            ← Quay lại danh mục voucher
          </Link>
          <Feedback
            loading={product.initialLoading}
            error={product.error}
            reload={product.reload}
          />
          {product.data && (
            <ProductDetailsView
              key={`${product.data.id}:${product.data.priceVersion}`}
              product={product.data}
              availableCredit={availableCredit}
              disabled={!ready || busy || !!intent}
              hasPendingIntent={!!intent}
              busy={busy}
              redeem={() => void execute(false, product.data)}
            />
          )}
        </div>
      ) : (
        <>
          <div className={styles.workspaceBar}>
            <div
              className={styles.viewSwitch}
              role="group"
              aria-label="Chuyển giữa danh mục và lịch sử đổi thưởng"
            >
              <button
                type="button"
                aria-pressed={activeTab === "catalog"}
                className={
                  activeTab === "catalog"
                    ? `${styles.viewTab} ${styles.viewTabActive}`
                    : styles.viewTab
                }
                onClick={() => setActiveTab("catalog")}
              >
                <ProductIcon name="gift" size={16} />
                <span>Danh mục voucher</span>
                {allProducts.length > 0 && (
                  <span className={styles.tabBadge}>{allProducts.length}</span>
                )}
              </button>
              <button
                type="button"
                aria-pressed={activeTab === "history"}
                className={
                  activeTab === "history"
                    ? `${styles.viewTab} ${styles.viewTabActive}`
                    : styles.viewTab
                }
                onClick={() => setActiveTab("history")}
              >
                <ProductIcon name="clock" size={16} />
                <span>Lịch sử đổi thưởng</span>
                {(history.items.length > 0 || pendingHistoryCount > 0) && (
                  <span
                    className={`${styles.tabBadge} ${
                      pendingHistoryCount > 0 ? styles.tabBadgeAlert : ""
                    }`}
                  >
                    {history.allItems.length || history.items.length}
                  </span>
                )}
              </button>
            </div>
            <span className={styles.workspaceHint}>
              <ProductIcon name="shield" size={15} />
              Đổi trực tiếp bằng Credit · Bảo mật mã voucher
            </span>
          </div>

          {activeTab === "catalog" ? (
            <VoucherCatalogSection
              allProducts={allProducts}
              products={products}
              loading={catalog.initialLoading}
              refreshing={!!(catalog.loading && !catalog.initialLoading)}
              error={catalog.error}
              reload={catalog.reload}
              brand={brand}
              category={category}
              availableCredit={availableCredit}
              onBrandChange={setBrand}
              onCategoryChange={setCategory}
            />
          ) : (
            <RedemptionHistorySection
              items={history.items}
              loading={history.initialLoading}
              error={history.error}
              reload={history.reload}
              activeId={resultId}
              pagination={history}
              onExploreCatalog={() => setActiveTab("catalog")}
            />
          )}
        </>
      )}

      {productId && history.items.length > 0 && (
        <RedemptionHistorySection
          items={history.items}
          loading={history.initialLoading}
          error={history.error}
          reload={history.reload}
          activeId={resultId}
          pagination={history}
        />
      )}
    </div>
  );
}
