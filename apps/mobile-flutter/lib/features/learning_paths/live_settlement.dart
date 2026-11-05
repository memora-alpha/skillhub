import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../components/app_button.dart';
import '../../components/feature_page.dart';
import '../../components/misc.dart';
import '../../core/http/app_error.dart';
import '../auth/session/auth_session.dart';
import '../remote/refresh_signal.dart';

final settlementReadProvider = FutureProvider.family<Map<String, dynamic>, String>((ref, id) async {
  watchRefresh(ref, RefreshScope.study);
  final snapshot = ref.watch(sessionSnapshotProvider);
  if (snapshot.phase != SessionPhase.ready) return const {};
  return ref.read(authRuntimeProvider).services.study.settlementStatus(id);
});

class LiveSettlementScreen extends ConsumerStatefulWidget {
  const LiveSettlementScreen({super.key, required this.id});
  final String id;
  @override
  ConsumerState<LiveSettlementScreen> createState() => _LiveSettlementScreenState();
}
class _LiveSettlementScreenState extends ConsumerState<LiveSettlementScreen> {
  bool _busy = false;
  String? _error;
  Future<void> _read() async {
    ref.invalidate(settlementReadProvider(widget.id));
    await ref.read(settlementReadProvider(widget.id).future);
  }
  Future<void> _approve(int version) async {
    if (_busy) return;
    final generation = ref.read(sessionSnapshotProvider).generation;
    final confirmed = await showDialog<bool>(context: context, builder: (context) => AlertDialog(
      title: const Text('Đồng ý quyết toán ngay?'),
      content: const Text('Ý kiến này riêng với xác nhận học xong. Khi cả hai đồng ý, máy chủ có thể quyết toán trước hạn khiếu nại. Báo cáo sau quyết toán không tự đảo giao dịch Credit.'),
      actions: [TextButton(onPressed: () => Navigator.of(context).pop(false), child: const Text('Tiếp tục chờ')),TextButton(onPressed: () => Navigator.of(context).pop(true), child: const Text('Tôi đồng ý'))],
    ));
    if (!mounted || confirmed != true || ref.read(sessionSnapshotProvider).generation != generation) return;
    setState(() { _busy = true; _error = null; });
    try {
      final service = ref.read(authRuntimeProvider).services.study;
      final fresh = await service.settlementStatus(widget.id);
      if (!mounted || ref.read(sessionSnapshotProvider).generation != generation) return;
      final approval = fresh['immediateSettlement'] as Map;
      if (approval['canApprove'] != true || fresh['pathVersion'] != version) throw const AppError.protocol();
      await service.settlementConsent(widget.id, version);
      if (!mounted || ref.read(sessionSnapshotProvider).generation != generation) return;
      await _read();
      await ref.read(accountProvider.notifier).reload();
    } catch (error) {
      if (mounted && ref.read(sessionSnapshotProvider).generation == generation) setState(() => _error = errorMessage(error));
    } finally { if (mounted) setState(() => _busy = false); }
  }
  @override
  Widget build(BuildContext context) {
    final query = ref.watch(settlementReadProvider(widget.id));
    final row = query.isLoading || query.hasError ? const <String, dynamic>{} : query.value ?? const <String, dynamic>{};
    final approval = row['immediateSettlement'] is Map ? row['immediateSettlement'] as Map : const {};
    const labels = {'SETTLED':'Đã quyết toán','TERMINATED':'Lộ trình đã dừng','NOT_LOCKED':'Chưa chốt lộ trình','WAITING_SESSIONS':'Chờ hoàn thành các buổi','WAITING_DISPUTE':'Chờ xử lý tranh chấp','WAITING_TERMINATION':'Chờ xử lý yêu cầu dừng','WAITING_DISPUTE_WINDOW':'Đang trong hạn khiếu nại','NEEDS_REVIEW':'Cần nhân sự đối soát','RETRYING':'Hệ thống đang thử lại','READY':'Đủ điều kiện kiểm tra quyết toán'};
    return FeaturePage(title: 'Credit & quyết toán', back: '/paths/${widget.id}', onRefresh: _read, children: [
      const Copy('Hai chiều: mỗi người nhận lại 96% Credit đã giữ của mình. Một chiều: người dạy nhận 96% Credit thỏa thuận. Phần còn lại là phí nền tảng.'),
      if (query.isLoading) const Center(child: CircularProgressIndicator()),
      if (query.hasError) FormNotice(tone: NoticeTone.error, message: errorMessage(query.error)),
      if (_error != null) FormNotice(tone: NoticeTone.error, message: _error!),
      if (row.isNotEmpty) Panel(title: labels[row['status']] ?? 'Trạng thái quyết toán', children: [
        if (row['autoSettlementAt'] is String) Copy('Hạn chờ tự quyết toán: ${DateTime.parse(row['autoSettlementAt'] as String).toLocal()}'),
        if (approval['ownApprovedAt'] != null) const Copy('Bạn đã đồng ý quyết toán sớm. Theo dõi ý kiến đối tác và kết quả máy chủ.'),
        if (row['settledAt'] != null) Copy('Đã quyết toán: ${row['settledAt']}'),
        if (row['lastCheckedAt'] != null) Copy('Kiểm tra lần cuối: ${row['lastCheckedAt']}'),
        if (approval['canApprove'] == true && row['pathVersion'] is int) AppButton(label: 'Xem và đồng ý quyết toán sớm', disabled: _busy || query.hasError || query.isLoading, onPressed: () => _approve(row['pathVersion'] as int)),
      ]),
      AppButton(label: 'Tải lại trạng thái', disabled: _busy || query.isLoading, variant: ButtonVariant.paper, onPressed: _read),
      const RouteButton(href: '/wallet/history', label: 'Xem ví & lịch sử Credit'),
    ]);
  }
}
