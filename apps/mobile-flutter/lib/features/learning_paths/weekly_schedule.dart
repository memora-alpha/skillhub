import 'package:flutter/material.dart';

import '../../components/feature_page.dart';

/// One filled schedule slot in local `YYYY-MM-DDTHH:mm` form (RN schedule draft).
typedef WeeklyScheduleSlot = ({String local, String minutes});

/// Port of RN `generateWeeklySchedule` (JS weekday: Sun=0 … Sat=6).
List<WeeklyScheduleSlot> generateWeeklySchedule({
  required String start,
  required List<int> days,
  required String minutes,
  required int count,
}) {
  final parsed = parseLocalDateTime(start);
  if (parsed == null || start.length < 16) {
    throw StateError('Chọn ngày và giờ bắt đầu.');
  }
  if (count < 1 || count > 100) {
    throw StateError('Lộ trình cần từ 1 đến 100 buổi.');
  }
  if (days.isEmpty || days.any((day) => day < 0 || day > 6)) {
    throw StateError('Chọn ít nhất một thứ trong tuần.');
  }
  final trimmed = minutes.trim();
  if (!RegExp(r'^\d+$').hasMatch(trimmed)) {
    throw StateError('Kiểm tra ngày giờ và thời lượng.');
  }
  final mins = int.parse(trimmed);
  if (mins < 60 || mins > 180) {
    throw StateError('Kiểm tra ngày giờ và thời lượng.');
  }

  final clock = start.substring(11, 16);
  final items = <WeeklyScheduleSlot>[];
  var cursor = DateTime(parsed.year, parsed.month, parsed.day, 12);
  for (var offset = 0; items.length < count && offset < 700; offset++) {
    if (days.contains(_jsWeekday(cursor))) {
      final local =
          '${cursor.year}-${_two(cursor.month)}-${_two(cursor.day)}T$clock';
      items.add((local: local, minutes: trimmed));
    }
    cursor = cursor.add(const Duration(days: 1));
  }
  if (items.length < count) {
    throw StateError('Kiểm tra ngày giờ và thời lượng.');
  }
  for (final item in items) {
    final date = parseLocalDateTime(item.local);
    if (date == null || !date.isAfter(DateTime.now())) {
      throw StateError('Kiểm tra ngày giờ và thời lượng.');
    }
  }
  return items;
}

/// Summary line matching RN `scheduleSlotLabel`.
String scheduleSlotLabel(String local, String minutes) {
  final start = parseLocalDateTime(local);
  if (start == null || !RegExp(r'^\d+$').hasMatch(minutes)) {
    return 'Chưa chọn ngày giờ';
  }
  final end = start.add(Duration(minutes: int.parse(minutes)));
  final weekday = _viWeekdayShort(start);
  return '$weekday, ${_two(start.day)}/${_two(start.month)}/${start.year}, '
      '${_two(start.hour)}:${_two(start.minute)} – '
      '${_two(end.hour)}:${_two(end.minute)}';
}

Future<DateTime?> pickScheduleDateTime(
  BuildContext context,
  DateTime initial, {
  String dateHelp = 'Ngày bắt đầu buổi học',
  String timeHelp = 'Giờ bắt đầu',
}) async {
  final now = DateTime.now();
  final first = DateTime(now.year, now.month, now.day);
  final last = first.add(const Duration(days: 365));
  final initialDay = DateTime(initial.year, initial.month, initial.day);
  final date = await showDatePicker(
    context: context,
    helpText: dateHelp,
    cancelText: 'Hủy',
    confirmText: 'Chọn',
    initialDate: initialDay.isBefore(first)
        ? first
        : (initialDay.isAfter(last) ? last : initialDay),
    firstDate: first,
    lastDate: last,
  );
  if (date == null || !context.mounted) return null;
  final time = await showTimePicker(
    context: context,
    helpText: timeHelp,
    cancelText: 'Hủy',
    confirmText: 'Chọn',
    initialTime: TimeOfDay.fromDateTime(initial),
    builder: (context, child) => MediaQuery(
      data: MediaQuery.of(context).copyWith(alwaysUse24HourFormat: true),
      child: child ?? const SizedBox.shrink(),
    ),
  );
  if (time == null) return null;
  return DateTime(date.year, date.month, date.day, time.hour, time.minute);
}

String _two(int value) => value.toString().padLeft(2, '0');

/// JS `Date#getDay`: Sunday=0 … Saturday=6.
int _jsWeekday(DateTime date) => date.weekday % 7;

String _viWeekdayShort(DateTime date) {
  const labels = {
    1: 'Th 2',
    2: 'Th 3',
    3: 'Th 4',
    4: 'Th 5',
    5: 'Th 6',
    6: 'Th 7',
    7: 'CN',
  };
  return labels[date.weekday] ?? '';
}
