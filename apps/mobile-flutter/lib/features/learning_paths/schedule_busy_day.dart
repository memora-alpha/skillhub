import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../components/app_button.dart';
import '../../components/misc.dart';
import '../../core/http/app_error.dart';
import '../../core/theme/tokens.dart';
import '../auth/session/auth_session.dart';
import 'schedule_conflicts.dart';

/// RN `ScheduleBusyDay` — confirmed sessions for the open slot's calendar day.
class ScheduleBusyDay extends ConsumerStatefulWidget {
  const ScheduleBusyDay({
    super.key,
    required this.startAt,
    required this.endAt,
    required this.allowed,
    this.warnedSessionIds = const [],
  });

  final DateTime startAt;
  final DateTime endAt;
  final bool allowed;
  final List<String> warnedSessionIds;

  @override
  ConsumerState<ScheduleBusyDay> createState() => _ScheduleBusyDayState();
}

class _ScheduleBusyDayState extends ConsumerState<ScheduleBusyDay> {
  List<Map<String, dynamic>>? _sessions;
  Object? _error;
  var _loading = false;
  var _epoch = 0;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void didUpdateWidget(covariant ScheduleBusyDay oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.startAt != widget.startAt ||
        oldWidget.endAt != widget.endAt ||
        oldWidget.allowed != widget.allowed) {
      _load();
    }
  }

  Future<void> _load() async {
    if (!widget.allowed) {
      setState(() {
        _sessions = null;
        _error = null;
        _loading = false;
      });
      return;
    }
    final epoch = ++_epoch;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final range = scheduleBusyRange(
        startAt: widget.startAt,
        endAt: widget.endAt,
      );
      final rows = await ref.read(authRuntimeProvider).services.study.mySessions(
        from: scheduleApiInstant(range.from),
        to: scheduleApiInstant(range.to),
      );
      if (!mounted || epoch != _epoch) return;
      setState(() {
        _sessions = rows;
        _loading = false;
      });
    } catch (error) {
      if (!mounted || epoch != _epoch) return;
      setState(() {
        _error = error;
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final range = scheduleBusyRange(
      startAt: widget.startAt,
      endAt: widget.endAt,
    );
    final dateLabel =
        '${widget.startAt.toLocal().day.toString().padLeft(2, '0')}/'
        '${widget.startAt.toLocal().month.toString().padLeft(2, '0')}/'
        '${widget.startAt.toLocal().year}';
    final sessions = (_sessions ?? const <Map<String, dynamic>>[]).where((
      session,
    ) {
      if (session['status'] == 'CANCELLED') return false;
      final start = DateTime.tryParse('${session['startAt']}');
      final end = DateTime.tryParse('${session['endAt']}');
      if (start == null || end == null) return false;
      return start.isBefore(range.dayEnd) && end.isAfter(range.dayStart);
    }).toList();
    final available = widget.allowed && _error == null && _sessions != null;
    final visible = sessions.where((session) {
      final id = '${session['id']}';
      if (!widget.warnedSessionIds.contains(id)) return true;
      final start = DateTime.tryParse('${session['startAt']}');
      final end = DateTime.tryParse('${session['endAt']}');
      if (start == null || end == null) return true;
      return !scheduleOverlap(widget.startAt, widget.endAt, start, end);
    }).toList();

    if (available &&
        !_loading &&
        !scheduleListIsLimited(_sessions!) &&
        sessions.isNotEmpty &&
        visible.isEmpty) {
      return const SizedBox.shrink();
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: 8,
      children: [
        Text(
          'Lịch đã chốt của bạn · $dateLabel',
          style: nunito(
            TypeScale.secondary,
            weight: FontWeight.w700,
            color: AppColors.ink,
          ),
        ),
        if (!widget.allowed)
          Text(
            'Chưa đối chiếu lịch đã chốt.',
            style: nunito(TypeScale.secondary, color: AppColors.muted),
          )
        else if (_error != null) ...[
          const FormNotice(
            tone: NoticeTone.info,
            message:
                'Chưa đối chiếu được lịch đã chốt của bạn. Lịch đang nhập vẫn được giữ.',
          ),
          AppButton(
            label: 'Thử lại',
            variant: ButtonVariant.paper,
            size: ButtonSize.sm,
            onPressed: _load,
          ),
          FormNotice(
            tone: NoticeTone.error,
            message: errorMessage(_error),
          ),
        ] else if (_loading)
          Text(
            'Đang đối chiếu lịch đã chốt…',
            style: nunito(TypeScale.secondary, color: AppColors.muted),
          ),
        if (available) ...[
          if (scheduleListIsLimited(_sessions!))
            const FormNotice(
              tone: NoticeTone.info,
              message:
                  'Danh sách đã đạt giới hạn 100 buổi; có thể còn lịch chưa được tải.',
            ),
          for (final session in visible) ...[
            Builder(
              builder: (context) {
                final start = DateTime.parse('${session['startAt']}');
                final end = DateTime.parse('${session['endAt']}');
                final role = session['role'] == 'TEACHER' ? 'dạy' : 'học';
                final label =
                    'Lịch $role: ${scheduleWindowLabel(start, end)}.';
                final overlap = scheduleOverlap(
                  widget.startAt,
                  widget.endAt,
                  start,
                  end,
                );
                if (!overlap) {
                  return Text(
                    label,
                    style: nunito(TypeScale.secondary, color: AppColors.muted),
                  );
                }
                return FormNotice(
                  tone: NoticeTone.error,
                  message:
                      'Trùng ${label.toLowerCase()} Hãy chọn giờ khác.',
                );
              },
            ),
          ],
          if (sessions.isEmpty)
            Text(
              'Chưa thấy buổi học đã chốt của bạn trong ngày này.',
              style: nunito(TypeScale.secondary, color: AppColors.muted),
            ),
        ],
        Text(
          'Lịch riêng của người còn lại chưa hiển thị ở đây. Hệ thống kiểm tra lại lịch của cả hai khi chốt.',
          style: nunito(TypeScale.secondary, color: AppColors.muted),
        ),
      ],
    );
  }
}
