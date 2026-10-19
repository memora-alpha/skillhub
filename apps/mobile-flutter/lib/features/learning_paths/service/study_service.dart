import '../../../core/http/http_client.dart';
import '../api/study_api.dart';

class StudyService {
  StudyService(HttpClient client) : _api = StudyApi(client);

  final StudyApi _api;

  Future<Map<String, dynamic>> createPath(Map<String, Object?> body) =>
      _api.createPath(body);

  Future<Map<String, dynamic>> revisePath(
    String pathId,
    Map<String, Object?> body,
  ) => _api.revisePath(pathId, body);

  Future<Map<String, dynamic>> validatePath(String pathId) =>
      _api.validatePath(pathId);

  Future<Map<String, dynamic>> finalizePath(
    String pathId, {
    required int expectedVersion,
  }) => _api.finalizePath(pathId, expectedVersion: expectedVersion);

  Future<Map<String, dynamic>> addPlan(
    String pathId,
    Map<String, Object?> body,
  ) => _api.addPlan(pathId, body);

  Future<Map<String, dynamic>> confirmPath(
    String pathId, {
    required int expectedVersion,
  }) => _api.confirmPath(pathId, expectedVersion: expectedVersion);

  Future<Map<String, dynamic>> confirmPlan(
    String planId, {
    required int expectedVersion,
  }) => _api.confirmPlan(planId, expectedVersion: expectedVersion);

  Future<Map<String, dynamic>> revisePlan(
    String planId,
    Map<String, Object?> body,
  ) => _api.revisePlan(planId, body);

  Future<Map<String, dynamic>> proposeSchedule(
    String planId,
    Map<String, Object?> body,
  ) => _api.proposeSchedule(planId, body);

  Future<Map<String, dynamic>> confirmSchedule(
    String scheduleId,
    Map<String, Object?> body,
  ) => _api.confirmSchedule(scheduleId, body);

  Future<Map<String, dynamic>> reschedule(
    String sessionId,
    Map<String, Object?> body,
  ) => _api.reschedule(sessionId, body);

  Future<List<Map<String, dynamic>>> mySessions({String? from, String? to}) =>
      _api.mySessions(from: from, to: to);

  Future<Map<String, dynamic>> session(String sessionId) =>
      _api.session(sessionId);

  Future<Map<String, dynamic>> settle(String pathId) => _api.settle(pathId);

  Future<Map<String, dynamic>> confirmCompletion(
    String sessionId,
    Map<String, Object?> body,
  ) => _api.confirmCompletion(sessionId, body);

  Future<Map<String, dynamic>> createReview(
    String pathId,
    Map<String, Object?> body,
  ) => _api.createReview(pathId, body);

  Future<List<Map<String, dynamic>>> reviews(String pathId) =>
      _api.reviews(pathId);

  Future<Map<String, dynamic>> reputation({String? cursor}) =>
      _api.reputation(cursor: cursor);

  Future<Object?> achievements() => _api.achievements();

  Future<Map<String, dynamic>> selectTitle(String? code) =>
      _api.selectTitle(code);

  Future<List<Map<String, dynamic>>> myReports() => _api.myReports();

  Future<Map<String, dynamic>> reportSession(
    String sessionId,
    Map<String, Object?> body,
  ) => _api.reportSession(sessionId, body);
}
