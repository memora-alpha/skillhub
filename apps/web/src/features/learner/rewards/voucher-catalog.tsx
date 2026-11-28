"use client";
import Link from "next/link";
import { useId, useMemo, useState } from "react";
import { Empty, Feedback, Panel } from "../components/common";
import { ProductIcon } from "../components/product-icon";
import type { RewardProduct } from "./reward-contract";
import {
  brandToneIndex,
  computeCreditShortfall,
  extractBrands,
  extractCategories,
  filterAndSortProducts,
  formatComputedCredit,
  formatCreditAmount,
  formatVnd,
  type VoucherSortOption,
} from "./reward-presentation";
import { BrandArtwork } from "./voucher-artwork";
import styles from "./vouchers-screen.module.css";

const PAGE_SIZE = 12;

const BANNER_TONES = [
  styles.voucherBannerTone0,
  styles.voucherBannerTone1,
  styles.voucherBannerTone2,
  styles.voucherBannerTone3,
] as const;

function VoucherCard({
  product,
  availableCredit,
}: Readonly<{
  product: RewardProduct;
  availableCredit: number | null;
}>) {
  const shortfall = computeCreditShortfall(
    product.priceCredit,
    availableCredit,
  );
  const canAfford = availableCredit !== null && shortfall === 0;
  const bannerTone = BANNER_TONES[brandToneIndex(product.brand.name)];

  return (
    <article className={styles.voucherCard}>
      <div className={`${styles.voucherBanner} ${bannerTone}`}>
        <BrandArtwork
          src={product.brand.logoUrl}
          fallbackSrc={product.imageUrl}
          name={product.brand.name}
          size="md"
        />
        <div className={styles.voucherBannerRight}>
          {product.category && (
            <span className={styles.categoryPill} title={product.category}>
              {product.category}
            </span>
          )}
          <div className={styles.faceValueBlock}>
            <small>Mệnh giá</small>
            <strong>{formatVnd(product.faceValueVnd)}</strong>
          </div>
        </div>
      </div>

      <div className={styles.voucherBody}>
        <span className={styles.voucherBrand}>{product.brand.name}</span>
        <h3 className={styles.voucherTitle}>{product.name}</h3>
        {product.terms && (
          <p className={styles.voucherTermsPreview}>{product.terms}</p>
        )}
        {product.validityDays !== null && (
          <div className={styles.voucherMetaTags}>
            <span className={styles.metaTag}>
              <ProductIcon name="clock" size={12} />
              HSD {product.validityDays} ngày
            </span>
          </div>
        )}
      </div>

      <div className={styles.voucherFoot}>
        <div className={styles.priceStack}>
          <span className={styles.creditCost}>
            {formatCreditAmount(product.priceCredit)} Credit
          </span>
          {canAfford && (
            <span className={styles.affordOk}>
              <ProductIcon name="check" size={12} />
              Đủ số dư để đổi
            </span>
          )}
          {shortfall > 0 && (
            <span className={styles.affordShort}>
              Thiếu {formatComputedCredit(shortfall)} CR
            </span>
          )}
        </div>
        <Link
          className={`btn btn-primary ${styles.cardCta}`}
          href={`/learn/vouchers/${product.id}`}
        >
          Xem & đổi
          <ProductIcon name="arrow" size={14} />
        </Link>
      </div>
    </article>
  );
}

export function VoucherCatalogSection({
  allProducts,
  products,
  loading,
  refreshing,
  error,
  reload,
  brand,
  category,
  availableCredit,
  onBrandChange,
  onCategoryChange,
}: Readonly<{
  allProducts: readonly RewardProduct[];
  products: readonly RewardProduct[];
  loading: boolean;
  refreshing: boolean;
  error?: string;
  reload: () => void;
  brand: string;
  category: string;
  availableCredit: number | null;
  onBrandChange: (next: string) => void;
  onCategoryChange: (next: string) => void;
}>) {
  const searchId = useId();
  const brandId = useId();
  const sortId = useId();

  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<VoucherSortOption>("default");
  const [affordableOnly, setAffordableOnly] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const categories = useMemo(
    () => extractCategories(allProducts),
    [allProducts],
  );
  const brands = useMemo(
    () => extractBrands(allProducts, category),
    [allProducts, category],
  );
  const filtered = useMemo(
    () =>
      filterAndSortProducts(products, {
        query,
        sort,
        affordableOnly,
        availableCredit,
      }),
    [products, query, sort, affordableOnly, availableCredit],
  );

  const visibleProducts = filtered.slice(0, visibleCount);
  const remaining = Math.max(0, filtered.length - visibleProducts.length);
  const hasActiveFilter = Boolean(
    brand || category || query.trim() || affordableOnly || sort !== "default",
  );

  function handleSelectCategory(nextCategory: string) {
    onCategoryChange(nextCategory);
    if (brand) {
      const brandStillMatches = allProducts.some(
        (item) =>
          item.brand.id === brand &&
          (!nextCategory || item.category === nextCategory),
      );
      if (!brandStillMatches) onBrandChange("");
    }
    setVisibleCount(PAGE_SIZE);
  }

  function handleResetFilters() {
    onBrandChange("");
    onCategoryChange("");
    setQuery("");
    setSort("default");
    setAffordableOnly(false);
    setVisibleCount(PAGE_SIZE);
  }

  return (
    <Panel>
      <div className={styles.catalogPanel}>
        <div className={styles.catalogHead}>
          <div className={styles.catalogHeadText}>
            <span className="panel-kicker">Kho ưu đãi đối tác</span>
            <h2>Danh mục voucher</h2>
            <p>
              Tìm nhanh theo thương hiệu, danh mục hoặc lọc các voucher phù hợp
              với số dư Credit hiện có.
            </p>
          </div>
          {!loading && allProducts.length > 0 && (
            <span className={styles.resultCount}>
              Hiển thị {filtered.length} / {allProducts.length} voucher
            </span>
          )}
        </div>

        <div className={styles.filterToolbar}>
          <div className={styles.searchBox}>
            <label className={styles.filterLabel} htmlFor={searchId}>
              Tìm kiếm voucher hoặc thương hiệu
            </label>
            <div className={styles.searchInputWrap}>
              <ProductIcon name="search" size={17} />
              <input
                id={searchId}
                type="search"
                className={styles.searchInput}
                placeholder="Ví dụ: Pharmacity, Cafe, 100.000..."
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setVisibleCount(PAGE_SIZE);
                }}
              />
              {query && (
                <button
                  type="button"
                  className={styles.searchClear}
                  aria-label="Xóa từ khóa tìm kiếm"
                  onClick={() => {
                    setQuery("");
                    setVisibleCount(PAGE_SIZE);
                  }}
                >
                  <ProductIcon name="close" size={15} />
                </button>
              )}
            </div>
          </div>

          <div className={styles.selectField}>
            <label className={styles.filterLabel} htmlFor={brandId}>
              Thương hiệu
            </label>
            <select
              id={brandId}
              className={styles.selectControl}
              value={brand}
              onChange={(event) => {
                onBrandChange(event.target.value);
                setVisibleCount(PAGE_SIZE);
              }}
            >
              <option value="">Tất cả thương hiệu ({brands.length})</option>
              {brands.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} ({item.count})
                </option>
              ))}
            </select>
          </div>

          <div className={styles.selectField}>
            <label className={styles.filterLabel} htmlFor={sortId}>
              Sắp xếp
            </label>
            <select
              id={sortId}
              className={styles.selectControl}
              value={sort}
              onChange={(event) => {
                setSort(event.target.value as VoucherSortOption);
                setVisibleCount(PAGE_SIZE);
              }}
            >
              <option value="default">Đề xuất mặc định</option>
              <option value="price-asc">Credit: Thấp đến cao</option>
              <option value="price-desc">Credit: Cao đến thấp</option>
              <option value="value-desc">Mệnh giá: Cao đến thấp</option>
            </select>
          </div>
        </div>

        {categories.length > 0 && (
          <div className={styles.categoryRailWrap}>
            <div
              className={styles.categoryRail}
              role="group"
              aria-label="Lọc theo danh mục voucher"
            >
              <button
                type="button"
                aria-pressed={category === ""}
                className={
                  category === ""
                    ? `${styles.categoryChip} ${styles.categoryChipActive}`
                    : styles.categoryChip
                }
                onClick={() => handleSelectCategory("")}
              >
                <span>Tất cả</span>
                <span className={styles.chipCount}>{allProducts.length}</span>
              </button>
              {categories.map((item) => {
                const active = category === item.name;
                return (
                  <button
                    key={item.name}
                    type="button"
                    aria-pressed={active}
                    className={
                      active
                        ? `${styles.categoryChip} ${styles.categoryChipActive}`
                        : styles.categoryChip
                    }
                    onClick={() =>
                      handleSelectCategory(active ? "" : item.name)
                    }
                  >
                    <span>{item.name}</span>
                    <span className={styles.chipCount}>{item.count}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {(availableCredit !== null || hasActiveFilter) && (
          <div className={styles.quickRow}>
            <div className={styles.quickChips}>
              {availableCredit !== null && (
                <button
                  type="button"
                  aria-pressed={affordableOnly}
                  className={
                    affordableOnly
                      ? `${styles.affordableToggle} ${styles.affordableToggleActive}`
                      : styles.affordableToggle
                  }
                  onClick={() => {
                    setAffordableOnly((prev) => !prev);
                    setVisibleCount(PAGE_SIZE);
                  }}
                >
                  <ProductIcon
                    name={affordableOnly ? "check" : "wallet"}
                    size={15}
                  />
                  Chỉ hiện voucher đủ Credit (≤{" "}
                  {formatComputedCredit(availableCredit)} CR)
                </button>
              )}
            </div>
            {hasActiveFilter && (
              <button
                type="button"
                className={styles.resetFiltersBtn}
                onClick={handleResetFilters}
              >
                <ProductIcon name="close" size={14} />
                Đặt lại bộ lọc
              </button>
            )}
          </div>
        )}

        <Feedback
          loading={loading}
          refreshing={refreshing}
          error={error}
          reload={reload}
        />

        {visibleProducts.length > 0 && (
          <>
            <div className={styles.voucherGrid}>
              {visibleProducts.map((row) => (
                <VoucherCard
                  key={row.id}
                  product={row}
                  availableCredit={availableCredit}
                />
              ))}
            </div>
            {remaining > 0 && (
              <div className={styles.loadMoreWrap}>
                <button
                  type="button"
                  className="btn"
                  onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
                >
                  Xem thêm {Math.min(PAGE_SIZE, remaining)} voucher
                </button>
                <span className={styles.loadMoreHint}>
                  Đã hiển thị {visibleProducts.length} / {filtered.length}{" "}
                  voucher phù hợp
                </span>
              </div>
            )}
          </>
        )}

        {!loading && !error && filtered.length === 0 && (
          <Empty>
            <div>
              Chưa tìm thấy voucher phù hợp với bộ lọc hiện tại.
              {affordableOnly &&
                " Bạn có thể tắt lọc theo số dư hoặc nạp thêm Credit để xem thêm ưu đãi."}
            </div>
            {hasActiveFilter && (
              <div className={styles.emptyActionWrap}>
                <button
                  type="button"
                  className="btn"
                  onClick={handleResetFilters}
                >
                  Xem tất cả voucher
                </button>
              </div>
            )}
          </Empty>
        )}
      </div>
    </Panel>
  );
}
