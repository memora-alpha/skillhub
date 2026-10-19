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
  });

  final String title;
  final String skillId;
  final String description;
  final String learningGoal;
  final String? currentLevel;
  final bool verifiedTeacherOnly;
  final List<String> tagIds;
  final List<({DateTime startAt, DateTime endAt})> preferredSlots;

  Map<String, Object?> toJson({int? expectedVersion}) => {
    'title': title,
    'skillId': skillId,
    'description': description,
    'learningGoal': learningGoal,
    'currentLevel': ?currentLevel,
    'verifiedTeacherOnly': verifiedTeacherOnly,
    if (tagIds.isNotEmpty) 'tagIds': tagIds,
    if (preferredSlots.isNotEmpty)
      'preferredSlots': [
        for (final slot in preferredSlots)
          {
            'startAt': slot.startAt.toUtc().toIso8601String(),
            'endAt': slot.endAt.toUtc().toIso8601String(),
          },
      ],
    'expectedVersion': ?expectedVersion,
  };
}
