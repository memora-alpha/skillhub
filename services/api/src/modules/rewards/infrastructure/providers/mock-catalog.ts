import type {
  ProviderBrand,
  ProviderProduct,
} from "../../application/contracts/voucher-provider";

/** Fictional brands and placeholder images only; never real trademarks. */
export const DEMO_MARKER = "DEMO – không có giá trị sử dụng";

const placeholder = (text: string) =>
  `https://placehold.co/400x400/png?text=${encodeURIComponent(text)}`;

const brand = (id: string, name: string): ProviderBrand => ({
  providerBrandId: id,
  nameVi: name,
  nameEn: name,
  logoUrl: placeholder(name),
});

export const MOCK_BRANDS: ProviderBrand[] = [
  brand("demo-coffee", "Demo Coffee"),
  brand("demo-ride", "Demo Ride"),
  brand("demo-mart", "Demo Mart"),
  brand("demo-books", "Demo Books"),
];

function product(
  providerProductId: string,
  providerBrandId: string,
  category: string,
  nameVi: string,
  nameEn: string,
  faceValueVnd: number,
): ProviderProduct {
  return {
    providerProductId,
    providerBrandId,
    category,
    nameVi,
    nameEn,
    imageUrl: placeholder(nameEn),
    faceValueVnd: BigInt(faceValueVnd),
    termsVi: `${DEMO_MARKER}. Voucher minh họa cho bản demo.`,
    termsEn: `${DEMO_MARKER}. Illustrative voucher for demo only.`,
    validityDays: 30,
    raw: { mock: true, providerProductId },
  };
}

/** Product ID suffix selects the scenario; see specs/018 plan. */
export const MOCK_PRODUCTS: ProviderProduct[] = [
  product(
    "coffee-50k-ok",
    "demo-coffee",
    "Food & Drink",
    "Voucher Demo Coffee 50.000đ",
    "Demo Coffee 50,000 VND voucher",
    50_000,
  ),
  product(
    "coffee-100k-ok",
    "demo-coffee",
    "Food & Drink",
    "Voucher Demo Coffee 100.000đ",
    "Demo Coffee 100,000 VND voucher",
    100_000,
  ),
  product(
    "ride-30k-ok",
    "demo-ride",
    "Transport",
    "Voucher Demo Ride 30.000đ",
    "Demo Ride 30,000 VND voucher",
    30_000,
  ),
  product(
    "mart-200k-ok",
    "demo-mart",
    "Shopping",
    "Voucher Demo Mart 200.000đ",
    "Demo Mart 200,000 VND voucher",
    200_000,
  ),
  product(
    "books-100k-ok",
    "demo-books",
    "Education",
    "Voucher Demo Books 100.000đ",
    "Demo Books 100,000 VND voucher",
    100_000,
  ),
  product(
    "mart-oos",
    "demo-mart",
    "Shopping",
    "Demo Mart (hết hàng)",
    "Demo Mart (out of stock)",
    50_000,
  ),
  product(
    "ride-err",
    "demo-ride",
    "Transport",
    "Demo Ride (lỗi nhà cung cấp)",
    "Demo Ride (provider error)",
    50_000,
  ),
  product(
    "coffee-timeout",
    "demo-coffee",
    "Food & Drink",
    "Demo Coffee (timeout rồi thành công)",
    "Demo Coffee (timeout then success)",
    50_000,
  ),
  product(
    "books-lost",
    "demo-books",
    "Education",
    "Demo Books (mất kết quả)",
    "Demo Books (lost result)",
    50_000,
  ),
  product(
    "coffee-slow",
    "demo-coffee",
    "Food & Drink",
    "Demo Coffee (chậm)",
    "Demo Coffee (slow)",
    50_000,
  ),
];
