import '../../../core/http/http_client.dart';

class TagRecord {
  const TagRecord({required this.id, required this.label});

  final String id;
  final String label;

  static TagRecord parse(Object? value) {
    final json = asMap(value);
    return TagRecord(id: asString(json['id']), label: asString(json['label']));
  }
}

class SkillRecord {
  const SkillRecord({
    required this.id,
    required this.name,
    required this.nameKey,
    required this.slug,
    required this.categoryId,
    required this.description,
    required this.status,
    required this.version,
  });

  final String id;
  final String name;
  final String nameKey;
  final String slug;
  final String? categoryId;
  final String? description;
  final String status;
  final int version;

  static SkillRecord parse(Object? value) {
    final json = asMap(value);
    return SkillRecord(
      id: asString(json['id']),
      name: asString(json['name']),
      nameKey: asString(json['nameKey']),
      slug: asString(json['slug']),
      categoryId: asOptionalString(json['categoryId']),
      description: asOptionalString(json['description']),
      status: asString(json['status']),
      version: asInt(json['version']),
    );
  }
}

class SharingSkillRecord {
  const SharingSkillRecord({
    required this.id,
    required this.skill,
    required this.level,
    required this.description,
    required this.experienceYears,
    required this.verificationStatus,
    this.isVisible,
    this.archivedAt,
    this.version,
  });

  final String id;
  final SkillRecord skill;
  final String level;
  final String description;
  final String? experienceYears;
  final String verificationStatus;
  final bool? isVisible;
  final String? archivedAt;
  final int? version;

  static SharingSkillRecord parse(Object? value) {
    final json = asMap(value);
    final version = json['version'];
    final visible = json['isVisible'];
    return SharingSkillRecord(
      id: asString(json['id']),
      skill: SkillRecord.parse(json['skill']),
      level: asString(json['level']),
      description: asString(json['description']),
      experienceYears: asOptionalString(json['experienceYears']),
      verificationStatus: asString(json['verificationStatus']),
      isVisible: visible == null ? null : asBool(visible),
      archivedAt: asOptionalString(json['archivedAt']),
      version: version == null ? null : asInt(version),
    );
  }
}

class SharingSkillInput {
  const SharingSkillInput({
    required this.skillId,
    required this.level,
    required this.description,
    this.experienceYears,
  });

  final String skillId;
  final String level;
  final String description;
  final String? experienceYears;

  Map<String, Object?> toJson() => {
    'skillId': skillId,
    'level': level,
    'description': description,
    'experienceYears': ?experienceYears,
  };
}
