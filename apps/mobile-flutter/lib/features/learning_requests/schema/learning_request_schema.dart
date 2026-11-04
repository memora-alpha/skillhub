import '../../../core/http/http_client.dart';

class NamedRef {
  const NamedRef({required this.id, required this.name});

  final String id;
  final String name;

  static NamedRef parse(Object? value) {
    final json = asMap(value);
    return NamedRef(id: asString(json['id']), name: asString(json['name']));
  }
}

class LearningRequestCard {
  const LearningRequestCard({
    required this.id,
    required this.title,
    required this.skill,
    required this.learningGoal,
    required this.status,
    required this.verifiedTeacherOnly,
    this.ownerId = '',
    this.ownerName = '',
    this.tagLabels = const [],
    this.desiredCreditPerHour,
    this.createdAt,
    this.matchScore,
  });

  final String id;
  final String title;
  final NamedRef skill;
  final String learningGoal;
  final String status;
  final bool verifiedTeacherOnly;
  final String ownerId;
  final String ownerName;
  final List<String> tagLabels;
  final String? desiredCreditPerHour;
  final String? createdAt;
  final int? matchScore;

  static LearningRequestCard parse(Object? value) {
    final json = asMap(value);
    final owner = json['owner'];
    final ownerMap = owner is Map<String, dynamic> ? owner : null;
    final tags = json['tags'];
    return LearningRequestCard(
      id: asString(json['id']),
      title: asString(json['title']),
      skill: NamedRef.parse(json['skill']),
      learningGoal: asString(json['learningGoal']),
      status: asString(json['status']),
      verifiedTeacherOnly: asBool(json['verifiedTeacherOnly']),
      ownerId: ownerMap == null ? '' : asText(ownerMap['id']),
      ownerName: ownerMap == null ? '' : asText(ownerMap['displayName']),
      tagLabels: tags is List
          ? [
              for (final tag in tags)
                if (tag is Map && tag['label'] is String) tag['label'] as String,
            ]
          : const [],
      desiredCreditPerHour: asOptionalString(json['desiredCreditPerHour']),
      createdAt: asOptionalString(json['createdAt']),
      matchScore: json['matchScore'] is int ? json['matchScore'] as int : null,
    );
  }
}

const weekdays = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
const weekdayLabels = [
  'Thứ 2',
  'Thứ 3',
  'Thứ 4',
  'Thứ 5',
  'Thứ 6',
  'Thứ 7',
  'Chủ nhật',
];

String weekdayLabel(String weekday) {
  final index = weekdays.indexOf(weekday);
  return index < 0 ? weekday : weekdayLabels[index];
}

class WeeklySlot {
  const WeeklySlot({
    required this.weekday,
    required this.startTime,
    required this.endTime,
  });

  final String weekday;
  final String startTime;
  final String endTime;

  static WeeklySlot? tryParse(Object? value) {
    if (value is! Map) return null;
    final json = Map<String, dynamic>.from(value);
    final weekday = json['weekday']?.toString() ?? '';
    final start = json['startTime']?.toString() ?? '';
    final end = json['endTime']?.toString() ?? '';
    if (weekday.isEmpty || start.isEmpty || end.isEmpty) return null;
    return WeeklySlot(weekday: weekday, startTime: start, endTime: end);
  }

  Map<String, String> toJson() => {
    'weekday': weekday,
    'startTime': startTime,
    'endTime': endTime,
  };
}

class PreferredAvailability {
  const PreferredAvailability({
    required this.timeZone,
    required this.weeklySlots,
  });

  final String timeZone;
  final List<WeeklySlot> weeklySlots;

  static PreferredAvailability? tryParse(Object? value) {
    if (value is! Map) return null;
    final json = Map<String, dynamic>.from(value);
    final zone = json['timeZone']?.toString() ?? '';
    final slots = json['weeklySlots'];
    if (zone.isEmpty) return null;
    return PreferredAvailability(
      timeZone: zone,
      weeklySlots: [
        if (slots is List)
          for (final item in slots) ?WeeklySlot.tryParse(item),
      ],
    );
  }

  Map<String, Object?> toJson() => {
    'timeZone': timeZone,
    'weeklySlots': [for (final slot in weeklySlots) slot.toJson()],
  };
}

class LearningRequestDraft {
  const LearningRequestDraft({
    required this.title,
    required this.skillId,
    required this.description,
    required this.learningGoal,
    this.currentLevel,
    this.verifiedTeacherOnly = false,
    this.tagIds = const [],
    this.preferredSlots = const [],
    this.teachingOverview,
    this.offeredSharingSkillIds = const [],
    this.desiredCreditPerHour,
    this.preferredAvailability,
    this.expiresAt,
  });

  final String title;
  final String skillId;
  final String description;
  final String learningGoal;
  final String? currentLevel;
  final bool verifiedTeacherOnly;
  final List<String> tagIds;
  final List<({DateTime startAt, DateTime endAt})> preferredSlots;
  final String? teachingOverview;
  final List<String> offeredSharingSkillIds;
  final String? desiredCreditPerHour;
  final PreferredAvailability? preferredAvailability;
  final DateTime? expiresAt;

  Map<String, Object?> toJson({int? expectedVersion}) {
    final weekly = preferredAvailability?.weeklySlots ?? const <WeeklySlot>[];
    return {
      'title': title,
      'skillId': skillId,
      'description': description,
      'learningGoal': learningGoal,
      'currentLevel': currentLevel,
      'verifiedTeacherOnly': verifiedTeacherOnly,
      'tagIds': tagIds,
      'teachingOverview': teachingOverview,
      'offeredSharingSkillIds': offeredSharingSkillIds,
      'desiredCreditPerHour': desiredCreditPerHour,
      'preferredAvailability': preferredAvailability?.toJson(),
      'preferredSlots': [
        if (weekly.isEmpty)
          for (final slot in preferredSlots)
            {
              'startAt': slot.startAt.toUtc().toIso8601String(),
              'endAt': slot.endAt.toUtc().toIso8601String(),
            },
      ],
      'expiresAt': expiresAt?.toUtc().toIso8601String(),
      'expectedVersion': ?expectedVersion,
    };
  }
}
