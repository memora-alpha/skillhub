import 'package:dio/dio.dart';

import '../../../core/http/http_client.dart';

class VerificationsApi {
  VerificationsApi(this._client);

  final HttpClient _client;

  Future<Map<String, dynamic>> uploadEvidence(
    String sharingSkillId,
    FormData body,
  ) async => asMap(
    await _client.request(
      '/me/skills/$sharingSkillId/evidence-files',
      method: 'POST',
      body: body,
      authenticated: true,
    ),
  );

  Future<Map<String, dynamic>> submit(
    String sharingSkillId,
    Map<String, Object?> body,
  ) async => asMap(
    await _client.request(
      '/me/skills/$sharingSkillId/verifications',
      method: 'POST',
      body: body,
      authenticated: true,
    ),
  );

  Future<List<Map<String, dynamic>>> list(String sharingSkillId) async =>
      asList(
        await _client.request(
          '/me/skills/$sharingSkillId/verifications',
          authenticated: true,
        ),
        asMap,
      );

  Future<Map<String, dynamic>> get(
    String sharingSkillId,
    String verificationId,
  ) async => asMap(
    await _client.request(
      '/me/skills/$sharingSkillId/verifications/$verificationId',
      authenticated: true,
    ),
  );
}
