export type RewardProduct = {
  id: string;
  name: string;
  category: string | null;
  brand: { id: string; name: string; logoUrl: string | null };
  imageUrl: string | null;
  faceValueVnd: string;
  priceCredit: string;
  priceVersion: number;
  terms: string | null;
  validityDays: number | null;
  status: string;
  sortOrder: number;
};
export type VoucherSecret = {
  code: string | null;
  pin: string | null;
  link: string | null;
  expiresAt?: string | null;
};
export type Redemption = {
  id: string;
  status: string;
  priceCredit: string;
  faceValueVnd: string;
  product: {
    id: string;
    name: string;
    brandName: string;
    imageUrl: string | null;
  };
  createdAt: string;
  resolvedAt: string | null;
  expiresAt: string | null;
  voucher?: VoucherSecret | null;
};
export type RewardIntent = {
  userId: string;
  key: string;
  productId: string;
  expectedPriceVersion: number;
};
const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
export function parseRewardIntent(
  raw: string | null,
  userId: string,
): RewardIntent | null {
  if (!raw) return null;
  const value = JSON.parse(raw) as RewardIntent;
  if (
    value.userId !== userId ||
    !uuid.test(value.productId) ||
    !uuid.test(value.key) ||
    !Number.isSafeInteger(value.expectedPriceVersion) ||
    value.expectedPriceVersion < 1
  )
    throw new Error(
      "Yêu cầu đổi thưởng đã lưu không hợp lệ. Kiểm tra lịch sử trước khi tiếp tục.",
    );
  return value;
}
export function redemptionMetadata(value: Redemption): Redemption {
  if (
    !value ||
    !uuid.test(value.id) ||
    typeof value.status !== "string" ||
    !value.product
  )
    throw new Error(
      "Chưa nhận được kết quả đổi thưởng hợp lệ. Hãy kiểm tra lại yêu cầu đã lưu.",
    );
  return {
    id: value.id,
    status: value.status,
    priceCredit: value.priceCredit,
    faceValueVnd: value.faceValueVnd,
    product: {
      id: value.product.id,
      name: value.product.name,
      brandName: value.product.brandName,
      imageUrl: value.product.imageUrl,
    },
    createdAt: value.createdAt,
    resolvedAt: value.resolvedAt,
    expiresAt: value.expiresAt,
  };
}
export const redemptionLabels: Record<string, string> = {
  ISSUING: "Đang phát hành",
  ISSUED: "Đã phát hành",
  MANUAL_REVIEW: "Đang được hỗ trợ kiểm tra",
  FAILED_REFUNDED: "Không phát hành được · đã hoàn Credit",
  REFUNDED_MANUAL: "Đã hoàn Credit sau kiểm tra",
};
