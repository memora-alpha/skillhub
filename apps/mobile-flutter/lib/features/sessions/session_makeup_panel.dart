import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../components/app_button.dart';
import '../../components/feature_page.dart';
import '../../components/misc.dart';
import '../../core/http/app_error.dart';
import '../auth/session/auth_session.dart';
import '../remote/refresh_signal.dart';

final makeupPathProvider = FutureProvider.family<Map<String, dynamic>, String>((
  ref,
  id,
) async {
  watchRefresh(ref, RefreshScope.study);
  if (ref.watch(sessionSnapshotProvider).phase != SessionPhase.ready)
    return const {};
  return ref.read(authRuntimeProvider).services.study.path(id);
});

Map<String, dynamic>? _schedule(
  Map<String, dynamic> path,
  Map<String, dynamic> session,
  String? userId,
) {
  if (userId == null ||
      ![path['participantAId'], path['participantBId']].contains(userId) ||
      path['id'] != session['pathId'] ||
      path['lockedVersion'] == null ||
      !const {'ACTIVE', 'SCHEDULED'}.contains(path['status']) ||
      path['plans'] is! List)
    return null;
  bool sameTime(Object? a, Object? b) {
    final left = DateTime.tryParse('$a'), right = DateTime.tryParse('$b');
    return left != null && right != null && left.isAtSameMomentAs(right);
  }

  for (final plan in path['plans'] as List) {
    if (plan is! Map ||
        plan['id'] != session['planId'] ||
        plan['version'] != session['planVersion'] ||
        plan['teacherId'] != session['teacherId'] ||
        plan['learnerId'] != session['learnerId'] ||
        plan['sessions'] is! List)
      continue;
    final actuals = (plan['sessions'] as List)
        .whereType<Map>()
        .where((r) => r['id'] == session['id'])
        .toList();
    if (actuals.length != 1) return null;
    final actual = actuals.single;
    if (actual['sessionNo'] != session['outlineSessionNo'] ||
        !sameTime(actual['startAt'], session['startAt']) ||
        !sameTime(actual['endAt'], session['endAt']))
      return null;
    final schedule = plan['schedule'];
    if (schedule is! Map ||
        schedule['id'] is! String ||
        schedule['version'] is! int ||
        schedule['appliedVersion'] is! int ||
        schedule['items'] is! List)
      return null;
    final version = schedule['version'] as int,
        applied = schedule['appliedVersion'] as int;
    if (version < applied || applied < 1) return null;
    final items = (schedule['items'] as List)
        .whereType<Map>()
        .where((r) => r['sessionNo'] == actual['sessionNo'])
        .toList();
    if (items.length != 1) return null;
    final changed =
        !sameTime(items.single['startAt'], actual['startAt']) ||
        !sameTime(items.single['endAt'], actual['endAt']);
    if ((version == applied && changed) ||
        (version > applied &&
            (!changed ||
                !const {
                  'PROPOSED',
                  'NEEDS_REVISION',
                  'PARTIALLY_CONFIRMED',
                }.contains(schedule['status']))))
      return null;
    return Map<String, dynamic>.from(schedule);
  }
  return null;
}

class SessionMakeupPanel extends ConsumerStatefulWidget {
  const SessionMakeupPanel({
    super.key,
    required this.session,
    required this.onRefresh,
    this.disabled = false,
  });
  final Map<String, dynamic> session;
  final Future<void> Function() onRefresh;
  final bool disabled;
  @override
  ConsumerState<SessionMakeupPanel> createState() => _SessionMakeupPanelState();
}

class _SessionMakeupPanelState extends ConsumerState<SessionMakeupPanel> {
  bool _busy = false;
  String? _error;
  Future<String?> _write(
    Map<String, dynamic> snapshot, {
    Map<String, String>? values,
  }) async {
    if (_busy || widget.disabled) return 'Đang tải lại trạng thái.';
    final generation = ref.read(sessionSnapshotProvider).generation;
    bool current() =>
        mounted && ref.read(sessionSnapshotProvider).generation == generation;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final service = ref.read(authRuntimeProvider).services.study;
      final session = await service.session(widget.session['id'] as String);
      if (!current()) return null;
      final path = await service.path(session['pathId'] as String);
      if (!current()) return null;
      final fresh = _schedule(
        path,
        session,
        ref.read(accountProvider).value?.userId,
      );
      if (fresh == null ||
          fresh['id'] != snapshot['id'] ||
          fresh['version'] != snapshot['version'] ||
          session['allowedActions'] is! List ||
          !(session['allowedActions'] as List).contains('PROPOSE_MAKEUP'))
        throw const AppError.protocol();
      if (values == null) {
        await service.confirmSchedule(fresh['id'] as String, {
          'expectedVersion': fresh['version'],
        });
      } else {
        if (fresh['version'] != fresh['appliedVersion'])
          throw const AppError.protocol();
        final start = parseLocalDateTime(values['start']!.trim())!;
        final end = start.add(
          Duration(minutes: int.parse(values['duration']!)),
        );
        await service.reschedule(session['id'] as String, {
          'expectedVersion': fresh['version'],
          'startAt': start.toUtc().toIso8601String(),
          'endAt': end.toUtc().toIso8601String(),
        });
      }
      return null;
    } catch (error) {
      if (current()) setState(() => _error = errorMessage(error));
      return errorMessage(error);
    } finally {
      if (current()) {
        ref.invalidate(makeupPathProvider(widget.session['pathId'] as String));
        try {
          await widget.onRefresh();
        } catch (_) {
          /* Read UI reports failures. */
        }
        if (current()) setState(() => _busy = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final query = ref.watch(
      makeupPathProvider(widget.session['pathId'] as String),
    );
    final path = query.value;
    final userId = ref.watch(accountProvider).value?.userId;
    final schedule = path == null
        ? null
        : _schedule(path, widget.session, userId);
    final disabled =
        widget.disabled || _busy || query.isLoading || query.hasError;
    final ownKey = userId == path?['participantAId']
        ? 'participantAConfirmedAt'
        : 'participantBConfirmedAt';
    final pending =
        schedule != null &&
        (schedule['version'] as int) > (schedule['appliedVersion'] as int);
    final ownConfirmed = schedule?[ownKey] != null;
    return Panel(
      title: 'Thống nhất lịch học bù',
      children: [
        const Copy(
          'Mỗi buổi chỉ học bù một lần. Hai bên cần xác nhận cùng phiên bản lịch; thời hạn chốt lịch bù theo dữ liệu buổi học. Credit tiếp tục được giữ.',
        ),
        if (widget.session['deadlines'] is Map &&
            (widget.session['deadlines'] as Map)['makeupBy'] != null)
          Copy(
            'Hạn chốt học bù: ${(widget.session['deadlines'] as Map)['makeupBy']}',
          ),
        if (query.isLoading) const LinearProgressIndicator(),
        if (query.hasError)
          FormNotice(
            tone: NoticeTone.error,
            message: errorMessage(query.error),
          ),
        if (_error != null)
          FormNotice(tone: NoticeTone.error, message: _error!),
        if (schedule == null && !query.isLoading)
          const Copy(
            'Chưa đọc được phiên bản lịch hiện tại. Tải lại trước khi thao tác.',
          ),
        if (schedule != null && pending) ...[
          for (final item in schedule['items'] as List)
            if (item is Map &&
                item['sessionNo'] == widget.session['outlineSessionNo'])
              Copy('Lịch đề xuất: ${item['startAt']} – ${item['endAt']}'),
          Copy(
            ownConfirmed
                ? 'Bạn đã xác nhận. Đang chờ đối tác.'
                : 'Cần bạn xác nhận phiên bản lịch học bù này.',
          ),
          if (!ownConfirmed)
            AppButton(
              label: 'Xác nhận lịch học bù',
              disabled: disabled || userId == null,
              onPressed: () => _write(schedule),
            ),
        ],
        if (schedule != null && !pending)
          IgnorePointer(
            ignoring: disabled,
            child: DataForm(
              fields: [
                DataField(
                  name: 'start',
                  label: 'Giờ học bù (YYYY-MM-DDTHH:mm)',
                  hint: 'Giờ địa phương trên thiết bị.',
                  rule: (v) =>
                      parseLocalDateTime(v.trim())?.isAfter(DateTime.now()) ==
                          true
                      ? null
                      : 'Nhập thời gian tương lai hợp lệ.',
                ),
                DataField(
                  name: 'duration',
                  label: 'Thời lượng (phút)',
                  numeric: true,
                  rule: integerRule(60, 180),
                ),
              ],
              defaults: const {'duration': '60'},
              submitLabel: 'Gửi đề xuất học bù',
              onSubmit: (values) => _write(schedule, values: values),
            ),
          ),
        AppButton(
          label: 'Tải lại lịch học bù',
          disabled: _busy,
          variant: ButtonVariant.paper,
          onPressed: () async {
            ref.invalidate(
              makeupPathProvider(widget.session['pathId'] as String),
            );
            await widget.onRefresh();
          },
        ),
      ],
    );
  }
}
