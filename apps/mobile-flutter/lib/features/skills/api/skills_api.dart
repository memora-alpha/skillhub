import '../../../core/http/http_client.dart';
import '../schema/skill_schema.dart';

class SkillsApi {
  SkillsApi(this._client);

  final HttpClient _client;

  Future<Page<TagRecord>> listTags({String? cursor, int? limit}) async =>
      Page.parse(
        await _client.requestEnvelope(
          withQuery('/tags', {'cursor': cursor, 'limit': limit}),
          authenticated: true,
        ),
        TagRecord.parse,
      );

  Future<Page<SkillRecord>> listSkills({
    String? cursor,
    int? limit,
    String? q,
  }) async => Page.parse(
    await _client.requestEnvelope(
      withQuery('/skills', {'cursor': cursor, 'limit': limit, 'q': q}),
      authenticated: true,
    ),
    SkillRecord.parse,
  );

  Future<SkillRecord> getSkill(String skillId) async => SkillRecord.parse(
    await _client.request('/skills/$skillId', authenticated: true),
  );

  Future<Page<SharingSkillRecord>> listMine({
    String? cursor,
    int? limit,
  }) async => Page.parse(
    await _client.requestEnvelope(
      withQuery('/me/skills', {'cursor': cursor, 'limit': limit}),
      authenticated: true,
    ),
    SharingSkillRecord.parse,
  );

  Future<SharingSkillRecord> create(SharingSkillInput input) async =>
      SharingSkillRecord.parse(
        await _client.request(
          '/me/skills',
          method: 'POST',
          body: input.toJson(),
          authenticated: true,
        ),
      );

  Future<SharingSkillRecord> change(
    String sharingSkillId, {
    required int expectedVersion,
    String? level,
    String? description,
    String? experienceYears,
  }) async => SharingSkillRecord.parse(
    await _client.request(
      '/me/skills/$sharingSkillId',
      method: 'PATCH',
      body: {
        'expectedVersion': expectedVersion,
        'level': ?level,
        'description': ?description,
        'experienceYears': ?experienceYears,
      },
      authenticated: true,
    ),
  );

  Future<SharingSkillRecord> archive(
    String sharingSkillId, {
    required int expectedVersion,
  }) async => SharingSkillRecord.parse(
    await _client.request(
      '/me/skills/$sharingSkillId/archive',
      method: 'POST',
      body: {'expectedVersion': expectedVersion},
      authenticated: true,
    ),
  );

  Future<SharingSkillRecord> restore(
    String sharingSkillId, {
    required int expectedVersion,
  }) async => SharingSkillRecord.parse(
    await _client.request(
      '/me/skills/$sharingSkillId/restore',
      method: 'POST',
      body: {'expectedVersion': expectedVersion},
      authenticated: true,
    ),
  );

  Future<Page<SharingSkillRecord>> listSharers(
    String skillId, {
    String? cursor,
    int? limit,
  }) async => Page.parse(
    await _client.requestEnvelope(
      withQuery('/skills/$skillId/sharers', {
        'cursor': cursor,
        'limit': limit,
      }),
      authenticated: true,
    ),
    SharingSkillRecord.parse,
  );

  Future<Page<SharingSkillRecord>> listForProfile(
    String userId, {
    String? cursor,
    int? limit,
  }) async => Page.parse(
    await _client.requestEnvelope(
      withQuery('/profiles/$userId/skills', {
        'cursor': cursor,
        'limit': limit,
      }),
      authenticated: true,
    ),
    SharingSkillRecord.parse,
  );
}
