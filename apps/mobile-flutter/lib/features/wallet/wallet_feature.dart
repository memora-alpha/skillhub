import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../../components/app_button.dart';
import '../../components/feature_page.dart';
import '../../components/misc.dart';
import '../../core/http/app_error.dart';
import '../../core/toast/toast.dart';
import '../auth/session/auth_session.dart';
import '../remote/remote_load.dart';

String _text(Object? value) => value?.toString() ?? '';

String _viNumber(int value) => value.toString().replaceAllMapped(
  RegExp(r'\B(?=(\d{3})+(?!\d))'),
  (_) => '.',
);

bool _validAmount(String value) {
  final amount = RegExp(r'^\d+$').hasMatch(value) ? int.tryParse(value) : null;
  return amount != null &&
      amount >= 1000 &&
      amount <= 2000000 &&
      amount % 1000 == 0;
}

final walletProvider = FutureProvider<Map<String, dynamic>>((ref) async {
  final phase = ref.watch(sessionSnapshotProvider).phase;
  if (phase != SessionPhase.ready) return const {};
  return ref.read(authRuntimeProvider).services.wallet.wallet();
});

final ledgerProvider = FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final phase = ref.watch(sessionSnapshotProvider).phase;
  if (phase != SessionPhase.ready) return const [];
  return drainPages(
    (cursor) => ref
        .read(authRuntimeProvider)
        .services
        .wallet
        .transactions(cursor: cursor, limit: 30),
  );
});

final paymentsProvider = FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final phase = ref.watch(sessionSnapshotProvider).phase;
  if (phase != SessionPhase.ready) return const [];
  return drainPages(
    (cursor) => ref
        .read(authRuntimeProvider)
        .services
        .wallet
        .payments(cursor: cursor, limit: 20),
  );
});

final paymentPolicyProvider = FutureProvider<Map<String, dynamic>>((ref) async {
  final phase = ref.watch(sessionSnapshotProvider).phase;
  if (phase != SessionPhase.ready) return const {};
  return ref.read(authRuntimeProvider).services.wallet.creationPolicy();
});

class WalletScreen extends ConsumerWidget {
  const WalletScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final wallet = ref.watch(walletProvider);
    final data = wallet.value ?? const {};
    return FeaturePage(
      title: 'Ví Credit',
      back: '/profile',
      subtitle: 'Credit dùng để học và chia sẻ trên SkillHub.',
      children: [
        Panel(
          title: 'Ví tài khoản',
          accent: true,
          children: [
            if (wallet.isLoading && data.isEmpty)
              const Copy('Đang tải số dư.', muted: true)
            else if (wallet.hasError)
              Copy(errorMessage(wallet.error))
            else
              MetricRow(
                children: [
                  Metric(
                    label: 'Khả dụng',
                    value: '${_text(data['availableCredit'])} CR',
                  ),
                  Metric(
                    label: 'Đang tạm giữ',
                    value: '${_text(data['heldCredit'])} CR',
                  ),
                ],
              ),
            RouteButton(href: '/wallet/topup', label: 'Nạp Credit'),
          ],
        ),
        RouteButton(
          secondary: true,
          href: '/wallet/history',
          label: 'Lịch sử giao dịch và thanh toán',
        ),
        const Copy(
          '1.000 VND = 1 Credit. Credit sử dụng trong SkillHub và không có chức năng rút tiền.',
          muted: true,
        ),
      ],
    );
  }
}

class TopupScreen extends ConsumerStatefulWidget {
  const TopupScreen({super.key});

  @override
  ConsumerState<TopupScreen> createState() => _TopupScreenState();
}

class _TopupScreenState extends ConsumerState<TopupScreen> {
  String _preset = '100000';

  @override
  Widget build(BuildContext context) {
    final policy = ref.watch(paymentPolicyProvider);
    final gate = policy.value ?? const {};
    final blocked = gate['canCreate'] == false;
    return FeaturePage(
      title: 'Nạp Credit',
      back: '/wallet',
      children: [
        if (policy.isLoading)
          const Copy('Đang kiểm tra cổng nạp.', muted: true)
        else if (blocked)
          Panel(
            title: 'Chưa tạo được lệnh nạp',
            children: [
              Copy(
                gate['reasonCode'] == 'PAYMENT_PROVIDER_UNAVAILABLE'
                    ? 'Cổng payOS chưa được bật. API cần PAYMENTS_ENABLED=true và đủ khóa payOS trong cấu hình rồi khởi động lại.'
                    : _text(gate['reasonCode']),
              ),
              if (_text(gate['existingPaymentId']).isNotEmpty)
                RouteButton(
                  href: '/wallet/payment-status?id=${gate['existingPaymentId']}',
                  label: 'Xem lệnh đang mở',
                ),
            ],
          )
        else
          Panel(
            title: 'Chọn số tiền nạp',
            children: [
              ChoiceGroup(
                label: 'Số tiền (VND)',
                options: const ['50000', '100000', '200000', '500000'],
                value: _preset,
                onChange: (value) => setState(() => _preset = value),
              ),
              DataForm(
                key: ValueKey(_preset),
                defaults: {'amount': _preset},
                fields: [
                  DataField(
                    name: 'amount',
                    label: 'Số tiền (VND)',
                    rule: (v) => _validAmount(v.trim())
                        ? null
                        : 'Nhập 1.000–2.000.000 VND, bội số 1.000.',
                    numeric: true,
                  ),
                ],
                submitLabel: 'Tạo mã thanh toán',
                onSubmit: (v) {
                  context.push('/wallet/payment?amount=${v['amount']}');
                  return null;
                },
              ),
              const Copy(
                'Cổng nạp là payOS. Credit chỉ được cộng sau khi thanh toán được xác minh.',
                muted: true,
              ),
            ],
          ),
      ],
    );
  }
}

class PaymentScreen extends ConsumerStatefulWidget {
  const PaymentScreen({super.key, this.amount = ''});

  final String amount;

  @override
  ConsumerState<PaymentScreen> createState() => _PaymentScreenState();
}

class _PaymentScreenState extends ConsumerState<PaymentScreen> {
  var _busy = false;

  @override
  Widget build(BuildContext context) {
    final amount = widget.amount;
    return FeaturePage(
      title: 'Thanh toán payOS',
      back: '/wallet/topup',
      children: [
        if (!_validAmount(amount))
          const EmptyState(
            title: 'Số tiền không hợp lệ',
            description: 'Quay lại chọn số tiền nạp.',
          )
        else
          Panel(
            title: 'Xác nhận lệnh nạp',
            children: [
              Copy(
                '${_viNumber(int.parse(amount))} VND · ${int.parse(amount) ~/ 1000} CR',
              ),
              AppButton(
                label: _busy ? 'Đang tạo lệnh' : 'Tạo mã QR',
                loading: _busy,
                onPressed: () async {
                        if (_busy) return;
                        setState(() => _busy = true);
                        try {
                          final created = await ref
                              .read(authRuntimeProvider)
                              .services
                              .wallet
                              .createPayment(amount);
                          ref.invalidate(paymentsProvider);
                          if (!context.mounted) return;
                          context.push(
                            '/wallet/payment-status?id=${created['id']}',
                          );
                        } catch (error) {
                          if (!context.mounted) return;
                          ref
                              .read(toastProvider.notifier)
                              .show(errorMessage(error), ToastTone.error);
                        } finally {
                          if (mounted) setState(() => _busy = false);
                        }
                      },
              ),
            ],
          ),
      ],
    );
  }
}

class PaymentStatusScreen extends ConsumerWidget {
  const PaymentStatusScreen({super.key, this.id = ''});

  final String id;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (id.isEmpty) {
      return const FeaturePage(
        title: 'Trạng thái thanh toán',
        back: '/wallet',
        children: [
          EmptyState(
            title: 'Chưa có lệnh thanh toán',
            description: 'Tạo lệnh nạp để nhận mã QR.',
          ),
        ],
      );
    }
    final payment = ref.watch(_paymentProvider(id));
    final data = payment.value ?? const {};
    final checkout = data['checkout'];
    final qr = checkout is Map ? checkout['qrCode']?.toString() ?? '' : '';
    return FeaturePage(
      title: 'Trạng thái thanh toán',
      back: '/wallet',
      children: [
        Panel(
          title: _text(data['status']).isEmpty ? 'Đang tải' : _text(data['status']),
          children: [
            if (payment.isLoading && data.isEmpty)
              const Copy('Đang đọc lệnh thanh toán.', muted: true)
            else if (payment.hasError && data.isEmpty)
              Copy(errorMessage(payment.error))
            else ...[
              Copy('${_text(data['paymentAmountVnd'])} VND'),
              Copy('${_text(data['creditAmount'])} CR'),
              if (qr.isNotEmpty) const Copy('Quét bằng ứng dụng ngân hàng.', muted: true),
              if (qr.isNotEmpty)
                Center(
                  child: ColoredBox(
                    color: const Color(0xFFFFFFFF),
                    child: QrImageView(
                      data: qr,
                      size: 232,
                      padding: const EdgeInsets.all(16),
                      backgroundColor: const Color(0xFFFFFFFF),
                      errorCorrectionLevel: QrErrorCorrectLevel.M,
                      eyeStyle: const QrEyeStyle(
                        eyeShape: QrEyeShape.square,
                        color: Color(0xFF000000),
                      ),
                      dataModuleStyle: const QrDataModuleStyle(
                        dataModuleShape: QrDataModuleShape.square,
                        color: Color(0xFF000000),
                      ),
                      semanticsLabel: 'Mã QR thanh toán',
                    ),
                  ),
                ),
              if (_text(data['recoveryReason']).isNotEmpty)
                Copy(_text(data['recoveryReason'])),
              if (data['status'] == 'PENDING' || data['status'] == 'CREATED')
                const Copy('Đang kiểm tra thanh toán...', muted: true),
              AppButton(
                label: payment.isLoading && data.isEmpty ? 'Đang tải...' : 'Tải lại',
                loading: payment.isLoading && data.isEmpty,
                onPressed: () => ref.invalidate(_paymentProvider(id)),
              ),
              if (data['status'] == 'PENDING' || data['status'] == 'CREATED')
                AsyncAppButton(
                  label: 'Hủy lệnh',
                  busyLabel: 'Đang hủy...',
                  variant: ButtonVariant.paper,
                  onPressed: () async {
                    try {
                      await ref
                          .read(authRuntimeProvider)
                          .services
                          .wallet
                          .cancelPayment(id);
                      ref.invalidate(_paymentProvider(id));
                      ref.invalidate(paymentsProvider);
                    } catch (error) {
                      ref
                          .read(toastProvider.notifier)
                          .show(errorMessage(error), ToastTone.error);
                    }
                  },
                ),
            ],
          ],
        ),
      ],
    );
  }
}

const _openPaymentStatuses = {'PENDING', 'CREATED'};

final _paymentProvider = FutureProvider.family<Map<String, dynamic>, String>((
  ref,
  id,
) async {
  final phase = ref.watch(sessionSnapshotProvider).phase;
  if (phase != SessionPhase.ready || id.isEmpty) return const {};
  final payment = await ref.read(authRuntimeProvider).services.wallet.payment(id);
  final status = payment['status']?.toString() ?? '';
  if (_openPaymentStatuses.contains(status)) {
    // Temporary until payOS webhook or SSE updates this screen.
    final timer = Timer(const Duration(seconds: 5), ref.invalidateSelf);
    ref.onDispose(timer.cancel);
  } else if (status == 'PAID') {
    ref.invalidate(walletProvider);
    ref.invalidate(paymentsProvider);
  }
  return payment;
});

class TransactionsScreen extends ConsumerWidget {
  const TransactionsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ledger = ref.watch(ledgerProvider);
    final payments = ref.watch(paymentsProvider);
    final entries = ledger.value ?? const <Map<String, dynamic>>[];
    final orders = payments.value ?? const <Map<String, dynamic>>[];
    return FeaturePage(
      title: 'Lịch sử giao dịch',
      back: '/wallet',
      children: [
        const Panel(title: 'Sổ Credit', children: []),
        for (final item in entries)
          Panel(
            title: '${_text(item['type'])} · ${_text(item['amount'])} CR',
            children: [
              StatusBadge(_text(item['status'])),
              RouteButton(
                secondary: true,
                href: '/wallet/transactions/${item['id']}',
                label: 'Xem giao dịch',
              ),
            ],
          ),
        if (entries.isEmpty)
          const EmptyState(
            title: 'Chưa có bút toán',
            description: 'Các thay đổi số dư sẽ xuất hiện tại đây.',
          ),
        for (final order in orders)
          Panel(
            title: 'Nạp ${_text(order['paymentAmountVnd'])} VND',
            children: [
              StatusBadge(_text(order['status'])),
              RouteButton(
                secondary: true,
                href: '/wallet/payment-status?id=${order['id']}',
                label: 'Xem lệnh nạp',
              ),
            ],
          ),
      ],
    );
  }
}

class TransactionDetailScreen extends ConsumerWidget {
  const TransactionDetailScreen({super.key, required this.id});

  final String id;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final entry = ref.watch(_ledgerEntryProvider(id));
    final data = entry.value ?? const {};
    return FeaturePage(
      title: 'Chi tiết giao dịch',
      back: '/wallet/history',
      children: [
        if (entry.isLoading && data.isEmpty)
          const Copy('Đang tải giao dịch.', muted: true)
        else if (entry.hasError || data.isEmpty)
          EmptyState(
            title: 'Không tìm thấy giao dịch',
            description: entry.hasError
                ? errorMessage(entry.error)
                : 'Máy chủ không trả mục này.',
          )
        else
          Panel(
            title: _text(data['type']),
            children: [
              StatusBadge(_text(data['status'])),
              Metric(label: 'Số Credit', value: _text(data['amount'])),
              Copy('Khả dụng sau giao dịch: ${_text(data['availableAfter'])}'),
              Copy('Đang giữ sau giao dịch: ${_text(data['heldAfter'])}'),
              Copy('Tham chiếu: ${_text(data['referenceType'])} ${_text(data['referenceId'])}'),
            ],
          ),
      ],
    );
  }
}

final _ledgerEntryProvider = FutureProvider.family<Map<String, dynamic>, String>((
  ref,
  id,
) async {
  final phase = ref.watch(sessionSnapshotProvider).phase;
  if (phase != SessionPhase.ready) return const {};
  return ref.read(authRuntimeProvider).services.wallet.transaction(id);
});
