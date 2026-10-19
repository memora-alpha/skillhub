import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../components/feature_page.dart';
import '../../components/misc.dart';

const _transactions = [
  (
    id: 'tx-topup',
    type: 'TOP_UP',
    amount: '+200.00',
    after: '200.00',
    status: 'SUCCESS',
    reference: 'PAY-DEMO-001',
    description:
        'Snapshot nạp Credit đã được backend xác minh trong dữ liệu mẫu.',
  ),
  (
    id: 'tx-hold',
    type: 'HOLD',
    amount: '-100.00',
    after: '100.00',
    status: 'SUCCESS',
    reference: 'path-active',
    description: 'Tạm giữ toàn bộ giá dạy một chiều. Chỉ người học tạm giữ.',
  ),
  (
    id: 'tx-teaching',
    type: 'TEACHING_EARNING',
    amount: '+96.00',
    after: '196.00',
    status: 'SUCCESS',
    reference: 'path-completed',
    description:
        'Thu nhập người dạy ở cuối lộ trình; không phát sinh theo từng buổi.',
  ),
  (
    id: 'tx-fee',
    type: 'PLATFORM_FEE',
    amount: '-4.00',
    after: '196.00',
    status: 'SUCCESS',
    reference: 'path-completed',
    description:
        'Snapshot phí 4% của lộ trình. Giao dịch mẫu minh họa riêng; không dùng để cộng sổ cái của bạn.',
  ),
  (
    id: 'tx-pending',
    type: 'TOP_UP',
    amount: '+100.00',
    after: '—',
    status: 'PENDING',
    reference: 'PAY-DEMO-002',
    description: 'Chờ cổng thanh toán xác minh. Chưa cộng số dư.',
  ),
];

/// Groups thousands with dots, like `Number.toLocaleString("vi-VN")`.
String _viNumber(int value) => value.toString().replaceAllMapped(
  RegExp(r'\B(?=(\d{3})+(?!\d))'),
  (_) => '.',
);

bool _validAmount(String value) {
  final amount = RegExp(r'^\d+$').hasMatch(value) ? int.tryParse(value) : null;
  return amount != null && amount >= 1000 && amount % 1000 == 0;
}

class WalletScreen extends StatelessWidget {
  const WalletScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const FeaturePage(
      title: 'Ví Credit',
      back: '/profile',
      subtitle: 'Credit dùng để học và chia sẻ trên SkillHub.',
      children: [
        Panel(
          title: 'Ví tài khoản mẫu',
          accent: true,
          children: [
            MetricRow(
              children: [
                Metric(label: 'Khả dụng', value: '180.00 CR'),
                Metric(label: 'Đang tạm giữ', value: '100.00 CR'),
              ],
            ),
            Copy(
              'Đây là số dư minh họa của kịch bản UI, không phản ánh tài khoản đang đăng nhập. Ví người mới bắt đầu từ 0.',
              muted: true,
            ),
            RouteButton(href: '/wallet/topup', label: 'Nạp Credit'),
          ],
        ),
        Panel(
          title: 'Credit đang giữ',
          children: [
            Copy('React thực hành · ONE_WAY · 100 CR từ người học'),
            RouteButton(
              secondary: true,
              href: '/paths/path-active',
              label: 'Xem lộ trình',
            ),
          ],
        ),
        RouteButton(
          secondary: true,
          href: '/wallet/history',
          label: 'Lịch sử giao dịch',
        ),
        Copy(
          '1.000 VND = 1 Credit. Credit sử dụng trong SkillHub và không có chức năng rút tiền.',
          muted: true,
        ),
      ],
    );
  }
}

class TopupScreen extends StatefulWidget {
  const TopupScreen({super.key});

  @override
  State<TopupScreen> createState() => _TopupScreenState();
}

class _TopupScreenState extends State<TopupScreen> {
  String _preset = '100000';

  @override
  Widget build(BuildContext context) {
    final minimum = integerRule(1000);
    return FeaturePage(
      title: 'Nạp Credit',
      back: '/wallet',
      children: [
        Panel(
          title: 'Chọn số tiền nạp',
          children: [
            ChoiceGroup(
              label: 'Gói minh họa (VND)',
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
                  rule: (v) =>
                      minimum(v) ??
                      (int.parse(v.trim()) % 1000 == 0
                          ? null
                          : 'Bản xem thử dùng bội số 1.000 VND.'),
                  numeric: true,
                ),
              ],
              submitLabel: 'Chọn phương thức',
              onSubmit: (v) {
                context.push('/wallet/payment?amount=${v['amount']}');
                return null;
              },
            ),
            const Copy(
              'Tỷ lệ hiện hành 1.000 VND/CR. Backend xác định số Credit cuối cùng và giới hạn giao dịch.',
              muted: true,
            ),
          ],
        ),
      ],
    );
  }
}

class PaymentScreen extends StatefulWidget {
  const PaymentScreen({super.key, this.amount = ''});

  final String amount;

  @override
  State<PaymentScreen> createState() => _PaymentScreenState();
}

class _PaymentScreenState extends State<PaymentScreen> {
  bool _confirm = false;

  @override
  Widget build(BuildContext context) {
    final amount = widget.amount;
    return FeaturePage(
      title: _confirm ? 'Xác nhận nạp Credit' : 'Phương thức thanh toán',
      back: '/wallet/topup',
      children: [
        if (!_validAmount(amount))
          const EmptyState(
            title: 'Số tiền không hợp lệ',
            description: 'Quay lại chọn số tiền nạp.',
          )
        else
          Panel(
            title: _confirm ? 'Kiểm tra giao dịch' : 'Cổng thanh toán mẫu',
            children: [
              Copy(
                '${_viNumber(int.parse(amount))} VND · ${int.parse(amount) ~/ 1000} CR ước tính',
              ),
              if (_confirm) ...[
                const Copy(
                  'Phương thức: cổng sandbox minh họa. Không thu tiền thật và không điều hướng ra cổng thanh toán.',
                ),
                RouteButton(
                  href: '/wallet/payment-status?state=pending&amount=$amount',
                  label: 'Mở trạng thái chờ xác minh mẫu',
                ),
                const RouteButton(
                  secondary: true,
                  href: '/wallet/topup',
                  label: 'Thay đổi số tiền',
                ),
              ] else
                DataForm(
                  fields: [
                    DataField(
                      name: 'gateway',
                      label: 'Phương thức xem thử',
                      rule: (v) => v.isEmpty ? 'Chọn phương thức.' : null,
                      choices: const ['Cổng sandbox minh họa'],
                    ),
                  ],
                  submitLabel: 'Tiếp tục',
                  onSubmit: (_) {
                    setState(() => _confirm = true);
                    return null;
                  },
                ),
            ],
          ),
        const Copy(
          'Chỉ callback/webhook đã xác minh mới tạo TOP_UP. Quay về từ cổng thanh toán không phải bằng chứng đã trả tiền.',
          muted: true,
        ),
      ],
    );
  }
}

const _paymentStates = {
  'pending': (
    'Đang chờ xác minh',
    'Chưa nhận kết quả xác minh từ cổng thanh toán. Credit chưa được cộng.',
  ),
  'success': (
    'Thanh toán mẫu thành công',
    'Snapshot minh họa đã được xác minh. Bản xem thử không thay đổi ví thật.',
  ),
  'failed': (
    'Thanh toán thất bại',
    'Snapshot mẫu không hoàn tất thanh toán. Bạn có thể chọn lại số tiền và thử lại.',
  ),
  'expired': (
    'Thanh toán đã hết hạn',
    'Snapshot mẫu quá hạn. Kiểm tra lịch sử trước khi tạo giao dịch mới.',
  ),
};

class PaymentStatusScreen extends StatelessWidget {
  const PaymentStatusScreen({super.key, this.state = 'pending'});

  final String state;

  @override
  Widget build(BuildContext context) {
    final item = _paymentStates[state];
    return FeaturePage(
      title: 'Trạng thái thanh toán',
      back: '/wallet',
      children: [
        Panel(
          title: item?.$1 ?? 'Không tìm thấy giao dịch',
          children: [
            Copy(item?.$2 ?? 'Mã trạng thái không hợp lệ.'),
            const RouteButton(
              secondary: true,
              href: '/wallet/history',
              label: 'Kiểm tra lịch sử',
            ),
            const RouteButton(
              href: '/wallet/topup',
              label: 'Tạo giao dịch mẫu mới',
            ),
          ],
        ),
      ],
    );
  }
}

class TransactionsScreen extends StatefulWidget {
  const TransactionsScreen({super.key});

  @override
  State<TransactionsScreen> createState() => _TransactionsScreenState();
}

class _TransactionsScreenState extends State<TransactionsScreen> {
  String _filter = 'Tất cả';

  @override
  Widget build(BuildContext context) {
    final items = _transactions
        .where((t) => _filter == 'Tất cả' || t.status == _filter)
        .toList();
    return FeaturePage(
      title: 'Lịch sử giao dịch',
      back: '/wallet',
      children: [
        ChoiceGroup(
          label: 'Trạng thái',
          options: const ['Tất cả', 'SUCCESS', 'PENDING', 'FAILED'],
          value: _filter,
          onChange: (value) => setState(() => _filter = value),
        ),
        for (final t in items)
          Panel(
            title: '${t.type} · ${t.amount} CR',
            children: [
              StatusBadge(t.status),
              Copy(t.reference, muted: true),
              RouteButton(
                secondary: true,
                href: '/wallet/transactions/${t.id}',
                label: 'Xem giao dịch',
              ),
            ],
          ),
        if (items.isEmpty)
          const EmptyState(
            title: 'Không có giao dịch',
            description: 'Thử trạng thái khác.',
          ),
      ],
    );
  }
}

class TransactionDetailScreen extends StatelessWidget {
  const TransactionDetailScreen({super.key, required this.id});

  final String id;

  @override
  Widget build(BuildContext context) {
    final t = _transactions.where((i) => i.id == id).firstOrNull;
    return FeaturePage(
      title: 'Chi tiết giao dịch',
      back: '/wallet/history',
      children: [
        if (t == null)
          const EmptyState(
            title: 'Không tìm thấy giao dịch',
            description: 'Không có trong dữ liệu mẫu.',
          )
        else
          Panel(
            title: t.type,
            children: [
              StatusBadge(t.status),
              Metric(label: 'Số Credit', value: t.amount),
              Copy('Mã giao dịch: ${t.id}'),
              Copy('Tham chiếu: ${t.reference}'),
              Copy(t.description),
              if (t.reference.startsWith('path-'))
                RouteButton(
                  secondary: true,
                  href: '/paths/${t.reference}',
                  label: 'Xem lộ trình liên quan',
                ),
            ],
          ),
      ],
    );
  }
}
