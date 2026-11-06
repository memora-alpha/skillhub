import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../components/app_button.dart';
import '../../components/feature_page.dart';
import '../../components/misc.dart';
import '../../core/http/app_error.dart';
import '../../core/http/http_client.dart';
import '../auth/session/auth_session.dart';
import '../remote/refresh_signal.dart';

class LiveReputationHistory extends ConsumerStatefulWidget {
  const LiveReputationHistory({super.key});
  @override
  ConsumerState<LiveReputationHistory> createState() => _HistoryState();
}

class _HistoryState extends ConsumerState<LiveReputationHistory> {
  Map<String, dynamic>? _summary;
  final _items = <Map<String, dynamic>>[], _seen = <String>{};
  String? _cursor, _error;
  bool _busy = false;
  int _ticket = 0;
  int? _owner;
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _load(reset: true);
    });
  }

  Future<void> _load({bool reset = false}) async {
    if (!mounted || (_busy && !reset)) return;
    final ticket = ++_ticket, session = ref.read(sessionSnapshotProvider);
    final cursor = reset ? null : _cursor;
    setState(() {
      _busy = true;
      _error = null;
      _owner = session.generation;
      if (reset) {
        _items.clear();
        _seen.clear();
        _cursor = null;
        _summary = null;
      }
    });
    try {
      if (session.phase != SessionPhase.ready) return;
      final data = await ref
          .read(authRuntimeProvider)
          .services
          .study
          .reputation(cursor: cursor);
      final rows = asList(data['items'], asMap),
          restrictions = asList(data['activeRestrictions'], asMap);
      asInt(data['reputationScore']);
      asString(data['level']);
      for (final row in rows) {
        asString(row['id']);
        asInt(row['delta']);
        asInt(row['scoreBefore']);
        asInt(row['scoreAfter']);
        asString(row['reasonCode']);
        asString(row['createdAt']);
      }
      for (final restriction in restrictions) {
        asString(restriction['scope']);
        asString(restriction['reasonCode']);
        asString(restriction['endsAt']);
      }
      final next = asOptionalString(data['nextCursor']);
      if (!mounted ||
          ticket != _ticket ||
          session != ref.read(sessionSnapshotProvider))
        return;
      if (cursor != null) _seen.add(cursor);
      if (next != null && _seen.contains(next)) throw const AppError.protocol();
      setState(() {
        _summary ??= data;
        _cursor = next;
        final merged = {
          for (final item in [..._items, ...rows]) item['id']: item,
        };
        _items
          ..clear()
          ..addAll(merged.values);
      });
    } catch (cause) {
      if (mounted && ticket == _ticket)
        setState(() {
          _error = errorMessage(cause);
          if (cause is AppError && [401, 403, 404].contains(cause.status)) {
            _summary = null;
            _items.clear();
            _cursor = null;
          }
        });
    } finally {
      if (mounted && ticket == _ticket) setState(() => _busy = false);
    }
  }

  String _date(Object? value) =>
      DateTime.tryParse('$value')?.toLocal().toString() ?? '$value';
  String _reason(Object? value) =>
      const {
        'REVIEW_RATING': 'Đánh giá từ đối tác',
        'SESSION_NO_SHOW': 'Vắng buổi học',
        'NO_SHOW': 'Vắng buổi học',
        'PATH_COMPLETED': 'Hoàn thành lộ trình',
        'ADJUDICATED_VIOLATION': 'Vi phạm theo quyết định xử lý',
        'LOW_REPUTATION': 'Điểm uy tín thấp',
        'REPORT_RESOLUTION': 'Quyết định xử lý báo cáo',
      }['$value'] ??
      '$value';
  String _level(Object? value) =>
      const {
        'EXCELLENT': 'Rất tốt',
        'NORMAL': 'Bình thường',
        'WARNING': 'Cảnh báo',
        'RESTRICTED': 'Bị hạn chế',
        'LOW': 'Thấp',
        'SEVERE': 'Nghiêm trọng',
        'CRITICAL': 'Rất nghiêm trọng',
      }['$value'] ??
      '$value';
  String _scope(Object? value) =>
      const {
        'CREATE_NEW_ACTIVITY': 'Hạn chế tạo hoạt động mới',
        'REQUIRE_STAFF_REVIEW': 'Cần Staff xem xét',
        'REQUIRE_ADMIN_REVIEW': 'Cần Admin xem xét',
      }['$value'] ??
      '$value';
  @override
  Widget build(BuildContext context) {
    final session = ref.watch(sessionSnapshotProvider);
    ref.listen(sessionSnapshotProvider, (previous, next) {
      if (previous != next) _load(reset: true);
    });
    ref.listen(
      refreshTicksProvider.select((ticks) => ticks[RefreshScope.profile]),
      (previous, next) {
        if (previous != next) _load(reset: true);
      },
    );
    final owned =
        _owner == session.generation && session.phase == SessionPhase.ready;
    return FeaturePage(
      title: 'Lịch sử uy tín',
      back: '/reputation',
      onRefresh: () => _load(reset: true),
      children: [
        if (_error != null)
          FormNotice(tone: NoticeTone.error, message: _error!),
        if (owned && _summary != null) ...[
          Panel(
            title: 'Uy tín hiện tại',
            children: [
              Metric(
                label: 'Điểm uy tín',
                value: '${_summary!['reputationScore']}',
              ),
              Copy('Cấp độ: ${_level(_summary!['level'])}'),
            ],
          ),
          Panel(
            title: 'Hạn chế đang áp dụng',
            children: [
              if ((_summary!['activeRestrictions'] as List).isEmpty)
                const Copy('Không có hạn chế đang áp dụng.'),
              for (final restriction in _summary!['activeRestrictions'] as List)
                Copy(
                  '${_scope(restriction['scope'])} · ${_reason(restriction['reasonCode'])}\nĐến ${_date(restriction['endsAt'])}',
                ),
            ],
          ),
          for (final item in _items)
            Panel(
              title: _reason(item['reasonCode']),
              children: [
                Copy(
                  '${(item['delta'] as int) > 0 ? '+' : ''}${item['delta']} điểm · ${item['scoreBefore']} → ${item['scoreAfter']}',
                ),
                Copy(_date(item['createdAt']), muted: true),
                Copy(
                  'Tham chiếu ${item['sourceType']}: ${item['sourceId']}',
                  muted: true,
                ),
              ],
            ),
          if (!_busy && _items.isEmpty) const Copy('Chưa có biến động uy tín.'),
        ],
        if (_busy) const Center(child: CircularProgressIndicator()),
        if (owned && _cursor != null)
          AppButton(
            label: 'Xem lịch sử cũ hơn',
            variant: ButtonVariant.secondary,
            onPressed: _busy ? null : () => _load(),
          ),
        const RouteButton(
          secondary: true,
          href: '/reports',
          label: 'Báo cáo của tôi',
        ),
      ],
    );
  }
}
