import '../../../core/http/http_client.dart';
import '../api/skills_api.dart';
import '../schema/skill_schema.dart';

class SkillsService {
  SkillsService(HttpClient client) : _api = SkillsApi(client);

  final SkillsApi _api;

  Future<Page<TagRecord>> tags({String? cursor, int? limit}) =>
      _api.listTags(cursor: cursor, limit: limit);

  Future<Page<SkillRecord>> catalog({String? cursor, int? limit, String? q}) =>
      _api.listSkills(cursor: cursor, limit: limit, q: q);

  Future<SkillRecord> skill(String skillId) => _api.getSkill(skillId);

  Future<Page<SharingSkillRecord>> mine({String? cursor, int? limit}) =>
      _api.listMine(cursor: cursor, limit: limit);

  Future<SharingSkillRecord> create(SharingSkillInput input) =>
      _api.create(input);

  Future<SharingSkillRecord> change(
    String sharingSkillId, {
    required int expectedVersion,
    String? level,
    String? description,
    String? experienceYears,
    bool? isVisible,
  }) => _api.change(
    sharingSkillId,
    expectedVersion: expectedVersion,
    level: level,
    description: description,
    experienceYears: experienceYears,
    isVisible: isVisible,
  );

  Future<SharingSkillRecord> archive(
    String sharingSkillId, {
    required int expectedVersion,
  }) => _api.archive(sharingSkillId, expectedVersion: expectedVersion);

  Future<SharingSkillRecord> restore(
    String sharingSkillId, {
    required int expectedVersion,
  }) => _api.restore(sharingSkillId, expectedVersion: expectedVersion);

  Future<Page<SharingSkillRecord>> sharers(
    String skillId, {
    String? cursor,
    int? limit,
  }) => _api.listSharers(skillId, cursor: cursor, limit: limit);

  Future<Page<SharingSkillRecord>> profileSkills(
    String userId, {
    String? cursor,
    int? limit,
  }) => _api.listForProfile(userId, cursor: cursor, limit: limit);
}
