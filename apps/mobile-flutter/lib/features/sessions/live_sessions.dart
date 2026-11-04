import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../components/app_button.dart';
import '../../components/app_input.dart';
import '../../components/feature_page.dart';
import '../../components/misc.dart';
import '../../core/http/app_error.dart';
import '../auth/session/auth_session.dart';
import '../remote/refresh_signal.dart';

const _upcomingStatuses = {'CONFIRMED', 'READY', 'ONGOING'};

bool sessionIsUpcoming(Map<String, dynamic> session) =>
    _upcomingStatuses.contains(session['status']);

const _sessionStatusLabel = {
  'CONFIRMED': 'Đã lên lịch',
  'READY': 'Sẵn sàng',
  'ONGOING': 'Đang diễn ra',
  'AWAITING_CONFIRMATION': 'Chờ xác nhận hoàn thành',
  'COMPLETED': 'Đã hoàn thành',
  'CANCELLED': 'Đã hủy',
  'DISPUTED': 'Đang tranh chấp',
};

String monthSessionKey(int year, int month) =>
    '$year-${month.toString().padLeft(2, '0')}';

String sessionRoleLabel(Map<String, dynamic> session) =>
    session['role'] == 'TEACHER' ? 'Bạn dạy' : 'Bạn học';

String sessionStatusLabel(Object? status) =>
    _sessionStatusLabel[status] ?? '$status';

int sessionMinutes(Map<String, dynamic> session) {
  final start = sessionInstant(session['startAt']);
  final end = sessionInstant(session['endAt']);
  if (start == null || end == null) return 0;
  return end.difference(start).inMinutes;
}

DateTime? sessionInstant(Object? value) {
  if (value is! String || value.isEmpty) return null;
  return DateTime.tryParse(value);
}

String _absolute(DateTime value) => value.toUtc().toIso8601String();

final monthSessionsProvider =
    FutureProvider.family<List<Map<String, dynamic>>, String>((ref, key) async {
      watchRefresh(ref, RefreshScope.study);
      if (ref.watch(sessionSnapshotProvider).phase != SessionPhase.ready) {
        return const [];
      }
      final parts = key.split('-');
      final year = int.parse(parts[0]);
      final month = int.parse(parts[1]);
      final start = DateTime(year, month);
      final end = DateTime(year, month + 1).subtract(const Duration(milliseconds: 1));
      return ref.read(authRuntimeProvider).services.study.mySessions(
        from: _absolute(start),
        to: _absolute(end),
      );
    });

final upcomingSessionProvider = FutureProvider<Map<String, dynamic>?>((ref) async {
  watchRefresh(ref, RefreshScope.study);
  if (ref.watch(sessionSnapshotProvider).phase != SessionPhase.ready) return null;
  final from = DateTime.now().subtract(const Duration(hours: 6));
  final rows = await ref.read(authRuntimeProvider).services.study.mySessions(
    from: _absolute(from),
  );
  final now = DateTime.now();
  final upcoming = [
    for (final row in rows)
      if (sessionInstant(row['endAt'])?.isAfter(now) ?? false) row,
  ]..sort((a, b) {
    final left = sessionInstant(a['startAt']) ?? DateTime.fromMillisecondsSinceEpoch(0);
    final right = sessionInstant(b['startAt']) ?? DateTime.fromMillisecondsSinceEpoch(0);
    return left.compareTo(right);
  });
  return upcoming.isEmpty ? null : upcoming.first;
});

final liveSessionProvider = FutureProvider.family<Map<String, dynamic>, String>((
  ref,
  id,
) async {
  watchRefresh(ref, RefreshScope.study);
  if (ref.watch(sessionSnapshotProvider).phase != SessionPhase.ready) {
    return const {};
  }
  return ref.read(authRuntimeProvider).services.study.session(id);
});

Map<String, dynamic> _record(Object? value) =>
    value is Map ? Map<String, dynamic>.from(value) : const {};

String? _noteRule(String value) =>
    value.trim().length > 1000 ? 'Ghi chú tối đa 1000 ký tự.' : null;

class LiveSessionPage extends ConsumerStatefulWidget {
  const LiveSessionPage({super.key, required this.id});

  final String id;

  @override
  ConsumerState<LiveSessionPage> createState() => _LiveSessionPageState();
}

class _LiveSessionPageState extends ConsumerState<LiveSessionPage> {
  final _note = AppField(validator: _noteRule);
  String? _busy;
  String? _error;

  @override
  void dispose() {
    _note.dispose();
    super.dispose();
  }

  Future<void> _reload() async {
    ref.read(refreshTicksProvider.notifier).bump(const {RefreshScope.study});
    await ref.read(liveSessionProvider(widget.id).future);
  }

  @override
  Widget build(BuildContext context) {
    final query = ref.watch(liveSessionProvider(widget.id));
    final session = query.value ?? const <String, dynamic>{};
    final start = sessionInstant(session['startAt']);
    final end = sessionInstant(session['endAt']);
    final join = _record(session['join']);
    final progress = _record(_record(session['progress'])['agreement']);
    final role = session['role']?.toString();
    final mineStatus = role == 'TEACHER'
        ? session['teacherConfirmationStatus']
        : session['learnerConfirmationStatus'];
    final partnerStatus = role == 'TEACHER'
        ? session['learnerConfirmationStatus']
        : session['teacherConfirmationStatus'];
    final status = session['status']?.toString() ?? '';
    final ended = end != null && !DateTime.now().isBefore(end);
    final canConfirm =
        session.isNotEmpty &&
        ended &&
        mineStatus != 'CONFIRMED' &&
        !const {'CANCELLED', 'DISPUTED', 'COMPLETED'}.contains(status);
    final canJoin = join['canJoin'] == true;
    final joinReason = canJoin
        ? null
        : knownMessage(join['reason']?.toString(), 'Chưa vào phòng được.');
    final minutes = start != null && end != null
        ? end.difference(start).inMinutes
        : null;
    final opens = sessionInstant(join['opensAt']);
    final closes = sessionInstant(join['closesAt']);
    final when = [
      if (start != null) viDateTime(start),
      if (end != null) viDateTime(end),
    ].join(' – ');
    final window = opens == null
        ? null
        : closes == null
        ? 'Phòng mở ${viDateTime(opens)}.'
        : 'Phòng mở ${viDateTime(opens)}, đóng ${viDateTime(closes)}.';
    final waiting = session.isNotEmpty &&
        !const {'COMPLETED', 'CANCELLED', 'DISPUTED'}.contains(status);
    return WaitingRefresh(
      enabled: waiting,
      scopes: const {RefreshScope.study},
      child: FeaturePage(
      onRefresh: () => pullRefresh(ref, const {RefreshScope.study}),
      title: 'Chi tiết buổi học',
      back: '/calendar',
      selected: 'Lịch học',
      children: [
        if (query.isLoading && session.isEmpty)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 12),
            child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
          ),
        if (query.hasError && session.isEmpty)
          FormNotice(tone: NoticeTone.error, message: errorMessage(query.error)),
        if (query.hasValue && session.isEmpty)
          const EmptyState(
            title: 'Không tìm thấy buổi học',
            description: 'Buổi học không còn trên máy chủ hoặc bạn không tham gia.',
          ),
        if (session.isNotEmpty) ...[
          Panel(
            title: sessionRoleLabel(session),
            children: [
              Copy(_sessionStatusLabel[status] ?? status),
              if (start != null)
                Copy('$when${minutes == null ? '' : ' · $minutes phút'}'),
              if (ended ||
                  status == 'AWAITING_CONFIRMATION' ||
                  mineStatus == 'CONFIRMED' ||
                  partnerStatus == 'CONFIRMED')
                Copy(
                  'Đã học: bạn ${mineStatus == 'CONFIRMED' ? 'đã xác nhận' : 'chưa xác nhận'} · đối tác ${partnerStatus == 'CONFIRMED' ? 'đã xác nhận' : 'chưa xác nhận'}',
                ),
              if (progress.isNotEmpty)
                Copy(
                  'Tiến độ lộ trình: ${progress['completed'] ?? 0}/${progress['total'] ?? 0} buổi hoàn thành.',
                  muted: true,
                ),
              if (window != null) Copy(window, muted: true),
            ],
          ),
          if (_error != null)
            FormNotice(tone: NoticeTone.error, message: _error!),
          if (canJoin)
            AppButton(
              label: 'Vào phòng',
              onPressed: () => context.push('/learning-sessions/${widget.id}/room'),
            )
          else if (join.isNotEmpty)
            FormNotice(tone: NoticeTone.info, message: joinReason!),
          if (canConfirm) ...[
            AppInput(
              field: _note,
              label: 'Ghi chú',
              hint: 'Có thể để trống. Tối đa 1000 ký tự.',
              multiline: true,
              editable: _busy == null,
            ),
            AppButton(
              label: _busy == 'complete'
                  ? 'Đang xác nhận...'
                  : 'Xác nhận đã hoàn thành',
              variant: ButtonVariant.craft,
              loading: _busy == 'complete',
              disabled: _busy != null,
              onPressed: () async {
                if (_note.validate() != null) return;
                setState(() {
                  _busy = 'complete';
                  _error = null;
                });
                try {
                  await ref
                      .read(authRuntimeProvider)
                      .services
                      .study
                      .confirmCompletion(widget.id, {'note': _note.text.trim()});
                  await _reload();
                } catch (error) {
                  if (mounted) setState(() => _error = errorMessage(error));
                } finally {
                  if (mounted) setState(() => _busy = null);
                }
              },
            ),
          ],
          AppButton(
            label: 'Lịch của lộ trình',
            variant: ButtonVariant.paper,
            onPressed: () => context.go(
              '/paths/${session['pathId']}/schedules',
            ),
          ),
        ],
      ],
      ),
    );
  }
}
