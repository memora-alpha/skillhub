// Shared schedule conflict helpers — cloned from RN
// `schedule-conflicts.ts` / `schedule-existing-conflicts.ts`.

class ScheduleSlot {
  const ScheduleSlot({
    required this.sessionNo,
    required this.startAt,
    required this.endAt,
  });

  final int sessionNo;
  final DateTime startAt;
  final DateTime endAt;
}

class ExistingScheduleConflict {
  const ExistingScheduleConflict({
    required this.slot,
    required this.session,
  });

  final ScheduleSlot slot;
  final Map<String, dynamic> session;
}

bool scheduleListIsLimited(List<dynamic> items) => items.length >= 100;

bool scheduleOverlap(DateTime aStart, DateTime aEnd, DateTime bStart, DateTime bEnd) =>
    aStart.isBefore(bEnd) && bStart.isBefore(aEnd);

({DateTime from, DateTime to, DateTime dayStart, DateTime dayEnd}) scheduleBusyRange({
  required DateTime startAt,
  required DateTime endAt,
}) {
  final localStart = startAt.toLocal();
  final localEnd = endAt.toLocal();
  final dayStart = DateTime(localStart.year, localStart.month, localStart.day);
  final endInstant = localEnd.subtract(const Duration(milliseconds: 1));
  final dayEnd = DateTime(
    endInstant.year,
    endInstant.month,
    endInstant.day,
  ).add(const Duration(days: 1));
  final from = dayStart.subtract(const Duration(days: 1));
  final to = dayEnd.subtract(const Duration(milliseconds: 1));
  return (from: from, to: to, dayStart: dayStart, dayEnd: dayEnd);
}

({DateTime from, DateTime to})? existingScheduleRange(List<ScheduleSlot> slots) {
  if (slots.isEmpty) return null;
  var start = slots.first.startAt;
  var end = slots.first.endAt;
  for (final slot in slots.skip(1)) {
    if (slot.startAt.isBefore(start)) start = slot.startAt;
    if (slot.endAt.isAfter(end)) end = slot.endAt;
  }
  final range = scheduleBusyRange(startAt: start, endAt: end);
  return (from: range.from, to: range.to);
}

String scheduleWindowLabel(DateTime startAt, DateTime endAt) {
  final start = startAt.toLocal();
  final end = endAt.toLocal();
  String two(int n) => n.toString().padLeft(2, '0');
  String date(DateTime value) =>
      '${two(value.day)}/${two(value.month)}/${value.year}';
  final showSeconds = start.second != 0 || end.second != 0;
  String time(DateTime value) {
    final base = '${two(value.hour)}:${two(value.minute)}';
    return showSeconds ? '$base:${two(value.second)}' : base;
  }

  final endDate = date(start) == date(end) ? '' : '${date(end)} ';
  return '${date(start)} ${time(start)}–$endDate${time(end)}';
}

String existingScheduleConflictMessage(ExistingScheduleConflict conflict) {
  final role = conflict.session['role'] == 'TEACHER' ? 'dạy' : 'học';
  final start = DateTime.tryParse('${conflict.session['startAt']}');
  final end = DateTime.tryParse('${conflict.session['endAt']}');
  if (start == null || end == null) {
    return 'Trùng lịch $role ở lộ trình khác.';
  }
  return 'Trùng lịch $role ở lộ trình khác: ${scheduleWindowLabel(start, end)}.';
}

List<ExistingScheduleConflict> existingScheduleConflicts(
  List<ScheduleSlot> slots,
  List<Map<String, dynamic>> sessions,
  String pathId,
) {
  final conflicts = <ExistingScheduleConflict>[];
  for (final slot in slots) {
    for (final session in sessions) {
      if ('${session['pathId']}' == pathId) continue;
      if (session['status'] == 'CANCELLED') continue;
      final start = DateTime.tryParse('${session['startAt']}');
      final end = DateTime.tryParse('${session['endAt']}');
      if (start == null || end == null) continue;
      if (scheduleOverlap(slot.startAt, slot.endAt, start, end)) {
        conflicts.add(ExistingScheduleConflict(slot: slot, session: session));
      }
    }
  }
  return conflicts;
}

/// RFC3339 with millisecond precision — API rejects 6-digit Dart micros.
String scheduleApiInstant(DateTime value) {
  final utc = value.toUtc();
  String two(int n) => n.toString().padLeft(2, '0');
  String three(int n) => n.toString().padLeft(3, '0');
  return '${utc.year}-${two(utc.month)}-${two(utc.day)}'
      'T${two(utc.hour)}:${two(utc.minute)}:${two(utc.second)}'
      '.${three(utc.millisecond)}Z';
}
