import '../../../core/http/app_error.dart';
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
    final name = asString(json['name']);
    return SkillRecord(
      id: asString(json['id']),
      name: name,
      nameKey: asOptionalString(json['nameKey']) ?? name,
      slug: asOptionalString(json['slug']) ?? '',
      categoryId: asOptionalString(json['categoryId']),
      description: asOptionalString(json['description']),
      status: asOptionalString(json['status']) ?? 'ACTIVE',
      version: json['version'] == null ? 1 : asInt(json['version']),
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
    this.ownerId,
    this.ownerName,
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
  final String? ownerId;
  final String? ownerName;

  static SharingSkillRecord parse(Object? value) {
    final json = asMap(value);
    final version = json['version'];
    final visible = json['isVisible'];
    final user = json['user'];
    final skillLevel = json['skillLevel'];
    final levelFromCatalog = skillLevel is Map
        ? asOptionalString(skillLevel['code'])
        : null;
    final years = json['experienceYears'];
    return SharingSkillRecord(
      id: asString(json['id']),
      skill: SkillRecord.parse(json['skill']),
      level: asOptionalString(json['level']) ??
          levelFromCatalog ??
          (throw const AppError.protocol()),
      description: asString(json['description']),
      experienceYears: years == null
          ? null
          : years is num
          ? years.toString()
          : asOptionalString(years),
      verificationStatus: asString(json['verificationStatus']),
      isVisible: visible == null ? null : asBool(visible),
      archivedAt: asOptionalString(json['archivedAt']),
      version: version == null ? null : asInt(version),
      ownerId: user is Map ? asOptionalString(user['userId']) : null,
      ownerName: user is Map ? asOptionalString(user['fullName']) : null,
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
