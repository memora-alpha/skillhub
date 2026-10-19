import 'package:dio/dio.dart';

import '../../../core/http/http_client.dart';
import '../api/verifications_api.dart';

class VerificationsService {
  VerificationsService(HttpClient client) : _api = VerificationsApi(client);

  final VerificationsApi _api;

  Future<Map<String, dynamic>> uploadEvidence(
    String sharingSkillId,
    FormData body,
  ) => _api.uploadEvidence(sharingSkillId, body);

  Future<Map<String, dynamic>> submit(
    String sharingSkillId,
    Map<String, Object?> body,
  ) => _api.submit(sharingSkillId, body);

  Future<List<Map<String, dynamic>>> list(String sharingSkillId) =>
      _api.list(sharingSkillId);

  Future<Map<String, dynamic>> get(
    String sharingSkillId,
    String verificationId,
  ) => _api.get(sharingSkillId, verificationId);
}
