bool watchSettlement(Object? status) =>
    const {'WAITING_DISPUTE_WINDOW', 'READY', 'RETRYING'}.contains(status);

String? settlementConsentMessage(Map<String, dynamic> row) {
  if (row['settledAt'] != null || !watchSettlement(row['status'])) return null;
  final approval = row['immediateSettlement'];
  if (approval is! Map) return null;
  final own = approval['ownApprovedAt'] != null;
  final partner = approval['partnerApprovedAt'] != null;
  if (own && partner)
    return 'Hai bên đã đồng ý. Hệ thống đang tự động giải ngân.';
  if (own) return 'Bạn đã đồng ý giải ngân. Đang chờ đối tác đồng ý.';
  if (partner)
    return 'Đối tác đã đồng ý giải ngân. Cần thêm sự đồng ý của bạn.';
  return null;
}
