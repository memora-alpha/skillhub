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
import 'session_resolution_panel.dart';
import 'session_makeup_panel.dart';

const _upcomingStatuses = {'CONFIRMED', 'READY', 'ONGOING'};

String sessionStatusOf(Map<String, dynamic> session) =>
    session['status']?.toString() ?? '';

/// Sắp tới — CONFIRMED / READY / ONGOING.
bool sessionIsUpcoming(Map<String, dynamic> session) =>
    _upcomingStatuses.contains(sessionStatusOf(session));

/// Đã kết thúc / lịch sử — mọi status không còn sắp tới (kể cả DISPUTED, NO_SHOW).
/// Không whitelist status: whitelist đã làm tab lịch sử trống dù API trả đủ buổi.
bool sessionIsHistory(Map<String, dynamic> session) =>
    !sessionIsUpcoming(session);

/// Trong cửa sổ 5 phút trước giờ bắt đầu đến khi kết thúc buổi.
bool sessionIsImminent(
  Map<String, dynamic> session, [
  DateTime? now,
]) {
  final start = sessionInstant(session['startAt']);
  if (start == null) return false;
  final clock = now ?? DateTime.now();
  final end = sessionInstant(session['endAt']);
  if (end != null && !clock.isBefore(end)) return false;
  return !clock.isBefore(start.subtract(const Duration(minutes: 5)));
}

/// Quá hạn — no-show.
bool sessionMissedJoin(Map<String, dynamic> session) =>
    sessionStatusOf(session) == 'NO_SHOW';

bool sessionAwaitingConfirmation(Map<String, dynamic> session) =>
    sessionStatusOf(session) == 'AWAITING_CONFIRMATION';

const _sessionStatusLabel = {
  'CONFIRMED': 'Đã lên lịch',
  'READY': 'Sẵn sàng',
  'ONGOING': 'Đang diễn ra',
  'AWAITING_CONFIRMATION': 'Chờ xác nhận hoàn thành',
  'COMPLETED': 'Đã hoàn thành',
  'CANCELLED': 'Đã hủy',
  'DISPUTED': 'Đang tranh chấp',
  'NO_SHOW': 'Không vào được · lố giờ / vắng',
  'MAKEUP_REQUIRED': 'Cần thống nhất lịch học bù',
};

String monthSessionKey(int year, int month) =>
    '$year-${month.toString().padLeft(2, '0')}';

String sessionRoleLabel(Map<String, dynamic> session) =>
    session['role'] == 'TEACHER' ? 'Bạn dạy' : 'Bạn học';

String sessionStatusLabel(Object? status) =>
    _sessionStatusLabel[status] ?? '$status';

String sessionHistoryNote(Map<String, dynamic> session) {
  if (!sessionMissedJoin(session)) return '';
  return 'Buổi đã ghi nhận không vào được (lố giờ / vắng mặt).';
}

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

/// RFC3339 with millisecond precision — API rejects 6-digit Dart micros.
String _absolute(DateTime value) {
  final utc = value.toUtc();
  String two(int n) => n.toString().padLeft(2, '0');
  String three(int n) => n.toString().padLeft(3, '0');
  return '${utc.year}-${two(utc.month)}-${two(utc.day)}'
      'T${two(utc.hour)}:${two(utc.minute)}:${two(utc.second)}'
      '.${three(utc.millisecond)}Z';
}

void _sortByStartDesc(List<Map<String, dynamic>> rows) {
  rows.sort((a, b) {
    final left =
        sessionInstant(a['startAt']) ?? DateTime.fromMillisecondsSinceEpoch(0);
    final right =
        sessionInstant(b['startAt']) ?? DateTime.fromMillisecondsSinceEpoch(0);
    return right.compareTo(left);
  });
}

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
      final end = DateTime(
        year,
        month + 1,
      ).subtract(const Duration(milliseconds: 1));
      return ref.read(authRuntimeProvider).services.study.mySessions(
        from: _absolute(start),
        to: _absolute(end),
      );
    });

/// Past sessions for history. `/sessions/mine` without `to` only returns
/// `endAt >= now`, so past rows need an explicit range.
final pastSessionsProvider = FutureProvider<List<Map<String, dynamic>>>((
  ref,
) async {
  watchRefresh(ref, RefreshScope.study);
  if (ref.watch(sessionSnapshotProvider).phase != SessionPhase.ready) {
    return const [];
  }
  final now = DateTime.now();
  final from = now.subtract(const Duration(days: 120));
  final rows = await ref.read(authRuntimeProvider).services.study.mySessions(
    from: _absolute(from),
    to: _absolute(now),
  );
  final past = [for (final row in rows) if (sessionIsHistory(row)) row];
  _sortByStartDesc(past);
  return past;
});

final missedJoinSessionsProvider = FutureProvider<List<Map<String, dynamic>>>((
  ref,
) async {
  final past = await ref.watch(pastSessionsProvider.future);
  return [for (final row in past) if (sessionMissedJoin(row)) row];
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
    final allowed = session['allowedActions'] is List ? session['allowedActions'] as List : const [];
    final quota = _record(session['makeupQuota']);
    final ended = end != null && !DateTime.now().isBefore(end);
    final canConfirm =
        session.isNotEmpty &&
        ended &&
        mineStatus != 'CONFIRMED' &&
        allowed.contains('CONFIRM_COMPLETION') && !query.hasError;
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
        !const {
          'COMPLETED',
          'CANCELLED',
          'DISPUTED',
          'NO_SHOW',
        }.contains(status);
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
              Copy(sessionStatusLabel(status)),
              if (start != null)
                Copy('$when${minutes == null ? '' : ' · $minutes phút'}'),
              if (sessionHistoryNote(session) case final String note
                  when note.isNotEmpty)
                Copy(note, muted: true),
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
              Copy('Đổi lịch thường: ${session['rescheduleCount'] ?? 'Chưa có dữ liệu'}/3 lần. Mỗi buổi học bù tối đa một lần.', muted: true),
              if (quota.isNotEmpty) Copy('Lượt học bù của bạn: đã dùng ${quota['used']}/${quota['limit']}, còn ${quota['remaining']}.', muted: true),
              if (quota['requiresReview'] == true) const Copy('Lịch sử học bù cần nhân sự xác minh.'),
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
            FormNotice(
              tone: sessionMissedJoin(session)
                  ? NoticeTone.error
                  : NoticeTone.info,
              message: joinReason!,
            ),
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
                  final sessionId =
                      session['id']?.toString() ?? widget.id;
                  final fresh = await ref.read(authRuntimeProvider).services.study.session(sessionId);
                  if (fresh['allowedActions'] is! List || !(fresh['allowedActions'] as List).contains('CONFIRM_COMPLETION')) throw const AppError.protocol();
                  await ref
                      .read(authRuntimeProvider)
                      .services
                      .study
                      .confirmCompletion(sessionId, note: _note.text);
                  await _reload();
                } catch (error) {
                  if (mounted) setState(() => _error = errorMessage(error));
                } finally {
                  if (mounted) setState(() => _busy = null);
                }
              },
            ),
          ],
          if (status == 'MAKEUP_REQUIRED' && allowed.contains('PROPOSE_MAKEUP'))
            SessionMakeupPanel(
              key: ValueKey('makeup-${widget.id}'),
              session: session,
              onRefresh: _reload,
              disabled: _busy != null || query.isLoading || query.hasError,
            ),
          SessionResolutionPanel(
            key: ValueKey(widget.id),
            session: session,
            onRefresh: _reload,
            disabled: _busy != null || query.isLoading || query.hasError,
          ),
          AppButton(
            label: 'Lịch của lộ trình',
            variant: ButtonVariant.paper,
            onPressed: () => context.go(
              '/paths/${session['pathId']}/schedules',
            ),
          ),
          if (status != 'CANCELLED') AppButton(label: 'Báo sự cố kỹ thuật / vấn đề khác', variant: ButtonVariant.paper, onPressed: () => context.push(Uri(path: '/reports/new', queryParameters: {'sessionId': widget.id, 'pathId': session['pathId'].toString()}).toString())),
        ],
      ],
      ),
    );
  }
}
