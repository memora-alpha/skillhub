import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../components/app_button.dart';
import '../../components/app_icon.dart';
import '../../components/user_avatar.dart';
import '../../components/feature_page.dart';
import '../../components/misc.dart';
import '../../components/tappable.dart';
import '../../core/theme/tokens.dart';
import '../sessions/sessions_data.dart';
import '../shell/app_screen_layout.dart';

abstract final class _C {
  static const surface = Chrome.surface;
  static const ink = Chrome.ink;
  static const body = Color(0xFF534D47);
  static const muted = Color(0xFF97928A);
  static const border = Chrome.border;
  static const orange = Chrome.accent;
  static const orangeSoft = Color(0xFFFFF2EC);
}

const _weekDays = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

class MonthCalendar extends StatelessWidget {
  const MonthCalendar({
    super.key,
    required this.month,
    required this.year,
    required this.sessionDays,
    required this.selectedDay,
    required this.onMonthChange,
    required this.onDayPress,
  });

  /// 1-based month, as in [DateTime.month].
  final int month;
  final int year;
  final Set<int> sessionDays;
  final int? selectedDay;
  final ValueChanged<int> onMonthChange;
  final ValueChanged<int> onDayPress;

  @override
  Widget build(BuildContext context) {
    final firstWeekDay = DateTime(year, month).weekday % 7;
    final dayCount = DateTime(year, month + 1, 0).day;
    final now = DateTime.now();
    final cellCount = ((firstWeekDay + dayCount) / 7).ceil() * 7;
    final days = [
      for (var position = 0; position < cellCount; position++)
        switch (position - firstWeekDay + 1) {
          final day when day > 0 && day <= dayCount => day,
          _ => null,
        },
    ];
    final caption = nunito(TypeScale.caption, color: _C.muted);

    Widget arrow(String label, int target, {bool flip = false}) => Tappable(
      semanticLabel: label,
      onTap: () => onMonthChange(target),
      child: Padding(
        padding: const EdgeInsets.all(5),
        child: Transform.flip(
          flipX: flip,
          child: const AppIcon(AppIcon.chevron, color: _C.muted, size: 18),
        ),
      ),
    );

    Widget dot({required bool filled}) => Container(
      width: 10,
      height: 10,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: filled ? _C.orange : _C.surface,
        border: filled ? null : Border.all(color: _C.orange),
      ),
    );

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: _C.surface,
        borderRadius: BorderRadius.circular(16),
        boxShadow: const [
          BoxShadow(
            color: Color(0x0B352B1F),
            offset: Offset(0, 4),
            blurRadius: 16,
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                arrow('Tháng trước', month - 1, flip: true),
                Semantics(
                  header: true,
                  child: Text(
                    'Tháng $month, $year',
                    style: nunito(
                      TypeScale.heading,
                      weight: FontWeight.w700,
                      color: _C.ink,
                    ),
                  ),
                ),
                arrow('Tháng sau', month + 1),
              ],
            ),
          ),
          Row(
            children: [
              for (final day in _weekDays)
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 3),
                    child: Text(
                      day,
                      textAlign: TextAlign.center,
                      style: nunito(
                        TypeScale.caption,
                        weight: FontWeight.w600,
                        color: _C.muted,
                      ),
                    ),
                  ),
                ),
            ],
          ),
          for (var week = 0; week < days.length ~/ 7; week++)
            Padding(
              padding: const EdgeInsets.only(bottom: 1),
              child: Row(
                children: [
                  for (final day in days.sublist(week * 7, week * 7 + 7))
                    Expanded(
                      child: SizedBox(
                        height: 36,
                        child: day == null
                            ? null
                            : Center(child: _dayCell(day, now)),
                      ),
                    ),
                ],
              ),
            ),
          Container(
            margin: const EdgeInsets.only(top: 10),
            padding: const EdgeInsets.only(top: 10),
            decoration: const BoxDecoration(
              border: Border(top: BorderSide(color: _C.border)),
            ),
            child: Wrap(
              spacing: 14,
              children: [
                Row(
                  mainAxisSize: MainAxisSize.min,
                  spacing: 6,
                  children: [dot(filled: true), Text('Hôm nay', style: caption)],
                ),
                Row(
                  mainAxisSize: MainAxisSize.min,
                  spacing: 6,
                  children: [
                    dot(filled: false),
                    Text('Có buổi học', style: caption),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _dayCell(int day, DateTime now) {
    final today = month == now.month && year == now.year && day == now.day;
    final hasSession = sessionDays.contains(day);
    final selected = selectedDay == day;
    return Semantics(
      selected: selected,
      child: Tappable(
        semanticLabel:
            '$day/$month/$year${hasSession ? ', có buổi học' : ''}${today ? ', hôm nay' : ''}',
        onTap: () => onDayPress(day),
        child: Container(
          width: 32,
          height: 32,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: today
                ? _C.orange
                : selected
                ? _C.orangeSoft
                : hasSession
                ? _C.surface
                : null,
            border: Border.all(
              color: today || selected || hasSession
                  ? _C.orange
                  : const Color(0x00000000),
              width: hasSession && !today && !selected ? 1.5 : 1,
            ),
            boxShadow: selected
                ? const [
                    BoxShadow(color: Color(0x1FEF653D), spreadRadius: 2),
                  ]
                : null,
          ),
          child: Text(
            '$day',
            style: nunito(
              TypeScale.secondary,
              weight: hasSession ? FontWeight.w700 : FontWeight.w500,
              color: today
                  ? _C.surface
                  : hasSession
                  ? _C.orange
                  : _C.body,
            ).copyWith(fontFeatures: const [FontFeature.tabularFigures()]),
          ),
        ),
      ),
    );
  }
}

class CalendarScreen extends ConsumerStatefulWidget {
  const CalendarScreen({super.key});

  @override
  ConsumerState<CalendarScreen> createState() => _CalendarScreenState();
}

class _CalendarScreenState extends ConsumerState<CalendarScreen> {
  DateTime _date = DateTime.now();
  int? _day;
  String _tab = 'Sắp tới';

  @override
  Widget build(BuildContext context) {
    final month = _date.month;
    final year = _date.year;
    final monthSessions = ref.watch(sessionsProvider).where((s) {
      final d = s.startAt.toLocal();
      return d.month == month && d.year == year;
    }).toList();
    final visible = monthSessions
        .where(
          (s) =>
              (_day == null || s.startAt.toLocal().day == _day) &&
              (_tab == 'Sắp tới'
                  ? s.status == 'CONFIRMED'
                  : s.status != 'CONFIRMED'),
        )
        .toList();
    return AppScreenLayout(
      title: 'Lịch học',
      selected: 'Lịch học',
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 36),
        children: [
          Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 860),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                spacing: 16,
                children: [
                  const Copy(
                    'Lịch và buổi học trong bản xem thử. Không có lịch tài khoản thật được tải tại đây.',
                    muted: true,
                  ),
                  MonthCalendar(
                    month: month,
                    year: year,
                    sessionDays: {
                      for (final s in monthSessions) s.startAt.toLocal().day,
                    },
                    selectedDay: _day,
                    onDayPress: (value) =>
                        setState(() => _day = _day == value ? null : value),
                    onMonthChange: (value) => setState(() {
                      _date = DateTime(year, value);
                      _day = null;
                    }),
                  ),
                  ChoiceGroup(
                    label: 'Buổi học',
                    options: const ['Sắp tới', 'Đã kết thúc / lịch sử'],
                    value: _tab,
                    onChange: (value) => setState(() => _tab = value),
                  ),
                  if (_day != null)
                    AppButton(
                      label: 'Xem cả tháng',
                      variant: ButtonVariant.paper,
                      onPressed: () => setState(() => _day = null),
                    ),
                  for (final s in visible)
                    Panel(
                      title: s.title,
                      children: [
                        StatusBadge(s.status),
                        Copy(
                          '${s.partner} · ${viDateTime(s.startAt)} · ${s.duration} phút',
                        ),
                        RouteButton(
                          href: '/learning-sessions/${s.id}',
                          label: 'Mở buổi học',
                        ),
                      ],
                    ),
                  if (visible.isEmpty)
                    const EmptyState(
                      title: 'Không có buổi học phù hợp',
                      description: 'Thử ngày, tháng hoặc nhóm buổi học khác.',
                    ),
                  AppButton(
                    label: 'Lộ trình của tôi',
                    variant: ButtonVariant.craft,
                    onPressed: () => context.push('/paths'),
                  ),
                  const RouteButton(
                    secondary: true,
                    href: '/learning-history',
                    label: 'Toàn bộ lịch sử học',
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

typedef _SessionDetail = ({
  String id,
  String title,
  String date,
  String timeRange,
  int durationMinutes,
  String credit,
  String partner,
  String partnerId,
  String partnerRole,
});

const _legacySessions = [
  (
    id: 'react-router',
    title: 'React Router — Buổi 4/6',
    day: 8,
    time: '08/03, 20:00 – 21:30',
    partner: 'Trần Việt Anh',
    partnerId: 'demo-viet-anh',
    role: 'Học',
    credit: '200 CR',
  ),
  (
    id: 'redux',
    title: 'Redux Toolkit — Buổi 5/6',
    day: 13,
    time: '13/03, 20:00 – 21:30',
    partner: 'Trần Việt Anh',
    partnerId: 'demo-viet-anh',
    role: 'Học',
    credit: '200 CR',
  ),
  (
    id: 'final-project',
    title: 'Dự án cuối — Buổi 6/6',
    day: 15,
    time: '15/03, 20:00 – 21:30',
    partner: 'Trần Việt Anh',
    partnerId: 'demo-viet-anh',
    role: 'Học',
    credit: '200 CR',
  ),
  (
    id: 'ielts',
    title: 'Tiếng Anh IELTS — Buổi 1',
    day: 18,
    time: '18/03, 19:00 – 20:30',
    partner: 'Nguyễn Thị Bích',
    partnerId: 'demo-thi-bich',
    role: 'Dạy',
    credit: '+180 CR',
  ),
];

const _dayNames = [
  'Chủ nhật',
  'Thứ 2',
  'Thứ 3',
  'Thứ 4',
  'Thứ 5',
  'Thứ 6',
  'Thứ 7',
];

_SessionDetail? _sessionDetail(String id) {
  final session = _legacySessions.where((s) => s.id == id).firstOrNull;
  if (session == null) return null;
  final [datePart, timePart] = session.time.split(', ');
  final [start, end] = timePart.split(' – ');
  int minutes(String time) {
    final [hour, minute] = time.split(':').map(int.parse).toList();
    return hour * 60 + minute;
  }

  // The legacy fixture is pinned to February 2025, matching the RN source.
  final weekday = DateTime(2025, 2, session.day).weekday % 7;
  return (
    id: session.id,
    title: session.title,
    date: '${_dayNames[weekday]}, $datePart/2025',
    timeRange: timePart,
    durationMinutes: minutes(end) - minutes(start),
    credit: session.credit,
    partner: session.partner,
    partnerId: session.partnerId,
    partnerRole: session.role == 'Học' ? 'Người hướng dẫn' : 'Người học',
  );
}

class SessionDetailScreen extends StatelessWidget {
  const SessionDetailScreen({super.key, required this.id});

  final String id;

  @override
  Widget build(BuildContext context) {
    final session = _sessionDetail(id);
    final caption = nunito(TypeScale.secondary, color: AppColors.muted);
    final value = nunito(
      TypeScale.body,
      weight: FontWeight.w600,
      color: AppColors.ink,
    );
    void openCalendar() => context.go('/calendar');
    return AppScreenLayout(
      title: 'Chi tiết buổi học',
      selected: 'Lịch học',
      back: (route: '/calendar', label: 'Quay lại lịch học'),
      child: session == null
          ? EmptyState(
              icon: AppIcon.calendar,
              title: 'Không tìm thấy buổi học',
              description: 'Buổi học này không có trên máy chủ.',
              action: 'Quay lại lịch học',
              onAction: openCalendar,
            )
          : ListView(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 20),
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  spacing: 16,
                  children: [
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        spacing: 16,
                        children: [
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            spacing: 12,
                            children: [
                              Expanded(
                                child: Semantics(
                                  header: true,
                                  child: Text(
                                    session.title,
                                    style: nunito(
                                      (16, 26),
                                      weight: FontWeight.w700,
                                      color: AppColors.ink,
                                    ),
                                  ),
                                ),
                              ),
                              const AppBadge(
                                label: 'Mẫu lịch cũ',
                                variant: BadgeVariant.warning,
                              ),
                            ],
                          ),
                          LayoutBuilder(
                            builder: (context, constraints) {
                              final width = (constraints.maxWidth - 12) / 2;
                              return Wrap(
                                spacing: 12,
                                children: [
                                  for (final (label, text) in [
                                    ('Ngày', session.date),
                                    ('Giờ', session.timeRange),
                                    (
                                      'Thời lượng',
                                      '${session.durationMinutes} phút',
                                    ),
                                    ('Credit', session.credit),
                                  ])
                                    SizedBox(
                                      width: width,
                                      child: Padding(
                                        padding: const EdgeInsets.symmetric(
                                          vertical: 12,
                                        ),
                                        child: Column(
                                          crossAxisAlignment:
                                              CrossAxisAlignment.start,
                                          spacing: 2,
                                          children: [
                                            Text(label, style: caption),
                                            Text(text, style: value),
                                          ],
                                        ),
                                      ),
                                    ),
                                ],
                              );
                            },
                          ),
                          Row(
                            spacing: 12,
                            children: [
                              UserAvatar(
                                name: session.partner,
                                userId: session.partnerId,
                                size: AvatarSizes.list,
                              ),
                              Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(session.partner, style: value),
                                  Text(session.partnerRole, style: caption),
                                ],
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                    Text(
                      'Đây là dữ liệu minh họa của lịch cũ. Chọn buổi học trong lịch mới để đổi lịch, vào phòng hoặc báo cáo đúng lộ trình.',
                      style: caption,
                    ),
                    AppButton(label: 'Mở lịch học', onPressed: openCalendar),
                  ],
                ),
              ],
            ),
    );
  }
}
