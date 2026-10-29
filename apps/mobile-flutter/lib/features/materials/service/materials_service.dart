import 'package:dio/dio.dart';

import '../../../core/http/http_client.dart';
import '../../remote/remote_load.dart';
import '../api/materials_api.dart';

class MaterialsService {
  MaterialsService(HttpClient client) : _api = MaterialsApi(client);

  final MaterialsApi _api;

  Future<List<Map<String, dynamic>>> mine() => _api.mine();

  Future<Map<String, dynamic>> upload(FormData body) => _api.upload(body);

  Future<Map<String, dynamic>> fileStatus(String fileId) =>
      _api.fileStatus(fileId);

  Future<Map<String, dynamic>> create(Map<String, Object?> body) =>
      _api.create(body);

  Future<Map<String, dynamic>> update(String id, Map<String, Object?> body) =>
      _api.update(id, body);

  Future<Map<String, dynamic>> submit(String id) => _api.submit(id);

  Future<Map<String, dynamic>> archive(String id) => _api.archive(id);

  Future<List<Map<String, dynamic>>> search({
    String? q,
    String? accessType,
  }) => _api.search(q: q, accessType: accessType);

  Future<Map<String, dynamic>> detail(String id) => _api.detail(id);

  Future<Map<String, dynamic>> download(String id) => _api.download(id);

  Future<Map<String, dynamic>> purchase(
    String id, {
    required int expectedListingVersion,
  }) => _api.purchase(
    id,
    expectedListingVersion: expectedListingVersion,
    idempotencyKey: newUuid(),
  );

  Future<List<Map<String, dynamic>>> orders() => _api.orders();
}
