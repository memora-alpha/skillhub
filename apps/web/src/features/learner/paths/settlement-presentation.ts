type SettlementView = {
  status: string;
  settledAt: string | null;
  immediateSettlement: {
    ownApprovedAt: string | null;
    partnerApprovedAt: string | null;
  };
};
export function watchSettlement(status: string) {
  return ["WAITING_DISPUTE_WINDOW", "READY", "RETRYING"].includes(status);
}
export function settlementConsentMessage(view: SettlementView) {
  if (view.settledAt || !watchSettlement(view.status)) return null;
  const { ownApprovedAt, partnerApprovedAt } = view.immediateSettlement;
  if (ownApprovedAt && partnerApprovedAt)
    return "Hai bên đã đồng ý. Hệ thống đang tự động giải ngân.";
  if (ownApprovedAt) return "Bạn đã đồng ý giải ngân. Đang chờ đối tác đồng ý.";
  if (partnerApprovedAt)
    return "Đối tác đã đồng ý giải ngân. Bạn có thể xem và xác nhận ý kiến của mình.";
  return null;
}
