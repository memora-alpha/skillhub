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
  });

  final String id;
  final String title;
  final NamedRef skill;
  final String learningGoal;
  final String status;
  final bool verifiedTeacherOnly;

  static LearningRequestCard parse(Object? value) {
    final json = asMap(value);
    return LearningRequestCard(
      id: asString(json['id']),
      title: asString(json['title']),
      skill: NamedRef.parse(json['skill']),
      learningGoal: asString(json['learningGoal']),
      status: asString(json['status']),
      verifiedTeacherOnly: asBool(json['verifiedTeacherOnly']),
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
  });

  final String title;
  final String skillId;
  final String description;
  final String learningGoal;
  final String? currentLevel;
  final bool verifiedTeacherOnly;
  final List<String> tagIds;

  Map<String, Object?> toJson({int? expectedVersion}) => {
    'title': title,
    'skillId': skillId,
    'description': description,
    'learningGoal': learningGoal,
    'currentLevel': ?currentLevel,
    'verifiedTeacherOnly': verifiedTeacherOnly,
    if (tagIds.isNotEmpty) 'tagIds': tagIds,
    'expectedVersion': ?expectedVersion,
  };
}
