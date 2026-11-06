import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../components/app_button.dart';
import '../../components/feature_page.dart';
import '../../components/misc.dart';
import '../../core/http/app_error.dart';
import '../auth/session/auth_session.dart';
import '../remote/refresh_signal.dart';
import 'settlement_presentation.dart';

final settlementReadProvider =
    FutureProvider.family<Map<String, dynamic>, String>((ref, id) async {
      watchRefresh(ref, RefreshScope.study);
      final snapshot = ref.watch(sessionSnapshotProvider);
      if (snapshot.phase != SessionPhase.ready) return const {};
      return ref.read(authRuntimeProvider).services.study.settlementStatus(id);
    });

class LiveSettlementScreen extends ConsumerStatefulWidget {
  const LiveSettlementScreen({super.key, required this.id});
  final String id;
  @override
  ConsumerState<LiveSettlementScreen> createState() =>
      _LiveSettlementScreenState();
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
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Đồng ý giải ngân ngay?'),
        content: const Text(
          'Ý kiến này riêng với xác nhận học xong. Sau khi toàn bộ buổi học hoàn thành và cả hai đồng ý, máy chủ tự động giải ngân nếu không có vụ việc chặn. Báo cáo sau quyết toán không tự đảo giao dịch Credit.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Tiếp tục chờ'),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Tôi đồng ý giải ngân ngay'),
          ),
        ],
      ),
    );
    if (!mounted ||
        confirmed != true ||
        ref.read(sessionSnapshotProvider).generation != generation)
      return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final service = ref.read(authRuntimeProvider).services.study;
      final fresh = await service.settlementStatus(widget.id);
      if (!mounted ||
          ref.read(sessionSnapshotProvider).generation != generation)
        return;
      final approval = fresh['immediateSettlement'] as Map;
      if (approval['canApprove'] != true || fresh['pathVersion'] != version)
        throw const AppError.protocol();
      await service.settlementConsent(widget.id, version);
      if (!mounted ||
          ref.read(sessionSnapshotProvider).generation != generation)
        return;
      await _read();
      await ref.read(accountProvider.notifier).reload();
    } catch (error) {
      if (mounted && ref.read(sessionSnapshotProvider).generation == generation)
        setState(() => _error = errorMessage(error));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final query = ref.watch(settlementReadProvider(widget.id));
    final row = query.isLoading || query.hasError
        ? const <String, dynamic>{}
        : query.value ?? const <String, dynamic>{};
    final approval = row['immediateSettlement'] is Map
        ? row['immediateSettlement'] as Map
        : const {};
    const labels = {
      'SETTLED': 'Đã giải ngân',
      'TERMINATED': 'Lộ trình đã dừng',
      'NOT_LOCKED': 'Chưa chốt lộ trình',
      'WAITING_SESSIONS': 'Chờ hoàn thành các buổi',
      'WAITING_DISPUTE': 'Chờ xử lý tranh chấp',
      'WAITING_TERMINATION': 'Chờ xử lý yêu cầu dừng',
      'WAITING_DISPUTE_WINDOW': 'Đang trong hạn khiếu nại',
      'NEEDS_REVIEW': 'Cần nhân sự đối soát',
      'RETRYING': 'Hệ thống đang thử lại',
      'READY': 'Đủ điều kiện kiểm tra quyết toán',
    };
    final consentMessage = settlementConsentMessage(row);
    return WaitingRefresh(
      enabled:
          !_busy &&
          !query.hasError &&
          (query.isLoading || watchSettlement(row['status'])),
      scopes: const {RefreshScope.study},
      child: FeaturePage(
        title: 'Credit & giải ngân',
        back: '/paths/${widget.id}',
        onRefresh: _read,
        children: [
          const Copy(
            'Sau khi hoàn thành toàn bộ thỏa thuận, hai bên đồng ý giải ngân thì hệ thống xử lý tự động. Xác nhận học xong từng buổi là bước riêng.',
          ),
          const Copy(
            'Hai chiều: mỗi người nhận lại 96% Credit đã giữ của mình. Một chiều: người dạy nhận 96% Credit thỏa thuận. Phần còn lại là phí nền tảng.',
          ),
          if (query.isLoading) const Center(child: CircularProgressIndicator()),
          if (query.hasError)
            FormNotice(
              tone: NoticeTone.error,
              message: errorMessage(query.error),
            ),
          if (_error != null)
            FormNotice(tone: NoticeTone.error, message: _error!),
          if (row.isNotEmpty)
            Panel(
              title: labels[row['status']] ?? 'Trạng thái quyết toán',
              children: [
                if (row['autoSettlementAt'] is String &&
                    row['settledAt'] == null &&
                    row['status'] != 'SETTLED')
                  Copy(
                    'Hạn chờ tự quyết toán: ${DateTime.parse(row['autoSettlementAt'] as String).toLocal()}',
                  ),
                if (consentMessage != null) Copy(consentMessage),
                if (row['settledAt'] != null)
                  Copy('Đã giải ngân: ${row['settledAt']}'),
                if (row['lastCheckedAt'] != null)
                  Copy('Kiểm tra lần cuối: ${row['lastCheckedAt']}'),
                if (approval['canApprove'] == true && row['pathVersion'] is int)
                  AppButton(
                    label: 'Đồng ý giải ngân',
                    disabled: _busy || query.hasError || query.isLoading,
                    onPressed: () => _approve(row['pathVersion'] as int),
                  ),
              ],
            ),
          AppButton(
            label: 'Tải lại trạng thái',
            disabled: _busy || query.isLoading,
            variant: ButtonVariant.paper,
            onPressed: _read,
          ),
          const RouteButton(
            href: '/wallet/history',
            label: 'Xem ví & lịch sử Credit',
          ),
        ],
      ),
    );
  }
}
