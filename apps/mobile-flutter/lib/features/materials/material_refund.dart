import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../components/app_button.dart';
import '../../components/feature_page.dart';
import '../../core/http/app_error.dart';
import '../auth/session/auth_session.dart';
import '../wallet/wallet_feature.dart';

class MaterialRefund extends ConsumerStatefulWidget {
  const MaterialRefund({
    super.key,
    required this.orderId,
    required this.grossCredit,
    required this.onChanged,
  });
  final String orderId, grossCredit;
  final VoidCallback onChanged;
  @override
  ConsumerState<MaterialRefund> createState() => _MaterialRefundState();
}

class _MaterialRefundState extends ConsumerState<MaterialRefund> {
  bool _review = false, _busy = false, _unknown = false, _done = false;
  String? _error;
  Future<void> _refund() async {
    if (_busy) return;
    final session = ref.read(sessionSnapshotProvider);
    setState(() => _busy = true);
    try {
      final service = ref.read(authRuntimeProvider).services.materials;
      final orders = await service.orders();
      final order = orders
          .where((item) => item['id'] == widget.orderId)
          .firstOrNull;
      if (order == null) throw const AppError.protocol();
      Map<String, dynamic> result = order;
      if (order['status'] != 'REFUNDED') {
        if (order['status'] != 'SUCCESS')
          throw const AppError(
            AppErrorKind.http,
            status: 409,
            code: 'MATERIAL_ORDER_NOT_REFUNDABLE',
          );
        result = await service.refund(widget.orderId);
      }
      if (result['id'] != widget.orderId || result['status'] != 'REFUNDED')
        throw const AppError.protocol();
      if (!mounted || session != ref.read(sessionSnapshotProvider)) return;
      setState(() {
        _done = true;
        _review = false;
        _unknown = false;
        _error = null;
      });
      ref.invalidate(walletProvider);
      ref.invalidate(ledgerProvider);
      widget.onChanged();
    } catch (cause) {
      if (mounted && session == ref.read(sessionSnapshotProvider))
        setState(() {
          _error = errorMessage(cause);
          _unknown =
              cause is! AppError ||
              cause.status == 0 ||
              cause.status == 408 ||
              cause.status >= 500;
        });
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    spacing: 10,
    children: [
      if (_error != null) FormNotice(tone: NoticeTone.error, message: _error!),
      if (_done)
        const Text('Máy chủ đã xác nhận hoàn đơn.')
      else if (!_review)
        AppButton(
          label: 'Yêu cầu hoàn đơn',
          variant: ButtonVariant.secondary,
          onPressed: () => setState(() => _review = true),
        )
      else ...[
        Text(
          'Hoàn đơn ${widget.orderId} với ${widget.grossCredit} CR sẽ thu hồi quyền tải. Chỉ được hoàn trong 24 giờ khi chưa từng lấy liên kết tải; máy chủ kiểm tra điều kiện và số dư bên bán.',
        ),
        if (_unknown)
          const Text(
            'Chưa rõ kết quả lần trước. Lần thử lại sẽ kiểm tra và xử lý đúng đơn này.',
          ),
        AppButton(
          label: _unknown
              ? 'Kiểm tra và thử lại đúng đơn'
              : 'Xác nhận hoàn đơn',
          loading: _busy,
          onPressed: _busy ? null : _refund,
        ),
        AppButton(
          label: 'Đóng và làm mới',
          variant: ButtonVariant.secondary,
          onPressed: _busy
              ? null
              : () {
                  setState(() => _review = false);
                  widget.onChanged();
                },
        ),
      ],
    ],
  );
}
