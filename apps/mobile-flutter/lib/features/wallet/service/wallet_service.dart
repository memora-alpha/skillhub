import '../../../core/http/http_client.dart';
import '../../remote/remote_load.dart';
import '../api/wallet_api.dart';

class WalletService {
  WalletService(HttpClient client) : _api = WalletApi(client);

  final WalletApi _api;

  Future<Map<String, dynamic>> wallet() => _api.wallet();

  Future<Page<Map<String, dynamic>>> transactions({String? cursor, int? limit}) =>
      _api.transactions(cursor: cursor, limit: limit);

  Future<Map<String, dynamic>> transaction(String id) => _api.transaction(id);

  Future<Map<String, dynamic>> creationPolicy() => _api.creationPolicy();

  Future<Page<Map<String, dynamic>>> payments({String? cursor, int? limit}) =>
      _api.payments(cursor: cursor, limit: limit);

  Future<Map<String, dynamic>> payment(String id) => _api.payment(id);

  Future<Map<String, dynamic>> createPayment(String amountVnd) =>
      _api.createPayment(amountVnd, idempotencyKey: newUuid());

  Future<Map<String, dynamic>> cancelPayment(String id) =>
      _api.cancelPayment(id, idempotencyKey: newUuid());
}
