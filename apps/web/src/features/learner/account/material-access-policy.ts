export function materialPurchaseAccess(
  materialId: string,
  orders: readonly { materialId: string; status: string }[],
  state: { loading: boolean; error: string | undefined; cursor: string | null },
) {
  const purchased = orders.some(
    (order) => order.materialId === materialId && order.status === "SUCCESS",
  );
  return {
    purchased,
    canPurchase: !purchased && !state.loading && !state.error && !state.cursor,
  };
}
