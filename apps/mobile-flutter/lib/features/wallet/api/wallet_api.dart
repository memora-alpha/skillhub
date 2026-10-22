import '../../../core/http/http_client.dart';

class WalletApi {
  WalletApi(this._client);

  final HttpClient _client;

  Future<Map<String, dynamic>> wallet() async => asMap(
    await _client.request('/me/wallet', authenticated: true),
  );

  Future<Page<Map<String, dynamic>>> transactions({
    String? cursor,
    int? limit,
  }) async => Page.parse(
    await _client.requestEnvelope(
      withQuery('/me/wallet/transactions', {'cursor': cursor, 'limit': limit}),
      authenticated: true,
    ),
    asMap,
  );

  Future<Map<String, dynamic>> transaction(String id) async => asMap(
    await _client.request(
      '/me/wallet/transactions/$id',
      authenticated: true,
    ),
  );

  Future<Map<String, dynamic>> creationPolicy() async => asMap(
    await _client.request('/payments/creation-policy', authenticated: true),
  );

  Future<Page<Map<String, dynamic>>> payments({
    String? cursor,
    int? limit,
  }) async => Page.parse(
    await _client.requestEnvelope(
      withQuery('/payments', {'cursor': cursor, 'limit': limit}),
      authenticated: true,
    ),
    asMap,
  );

  Future<Map<String, dynamic>> payment(String id) async => asMap(
    await _client.request('/payments/$id', authenticated: true),
  );

  Future<Map<String, dynamic>> createPayment(
    String amountVnd, {
    required String idempotencyKey,
  }) async => asMap(
    await _client.request(
      '/payments',
      method: 'POST',
      body: {'paymentAmountVnd': amountVnd, 'gateway': 'PAYOS'},
      headers: {'Idempotency-Key': idempotencyKey},
      authenticated: true,
    ),
  );

  Future<Map<String, dynamic>> cancelPayment(
    String id, {
    required String idempotencyKey,
  }) async => asMap(
    await _client.request(
      '/payments/$id/cancel',
      method: 'POST',
      headers: {'Idempotency-Key': idempotencyKey},
      authenticated: true,
    ),
  );
}
