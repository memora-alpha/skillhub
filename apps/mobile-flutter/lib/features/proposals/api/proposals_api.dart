import '../../../core/http/http_client.dart';
import '../../messages/schema/conversation_schema.dart';
import '../schema/proposal_schema.dart';

class AcceptedProposal {
  const AcceptedProposal({required this.proposal, required this.conversation});

  final ProposalRecord proposal;
  final ConversationRecord conversation;

  static AcceptedProposal parse(Object? value) {
    final json = asMap(value);
    return AcceptedProposal(
      proposal: ProposalRecord.parse(json['proposal']),
      conversation: ConversationRecord.parse(json['conversation']),
    );
  }
}

class ProposalsApi {
  ProposalsApi(this._client);

  final HttpClient _client;

  Future<Page<ProposalRecord>> list({
    String direction = 'received',
    String? status,
    String? learningRequestId,
    String? cursor,
    int? limit,
  }) async => Page.parse(
    await _client.requestEnvelope(
      withQuery('/proposals', {
        'direction': direction,
        'status': status,
        'learningRequestId': learningRequestId,
        'cursor': cursor,
        'limit': limit,
      }),
      authenticated: true,
    ),
    ProposalRecord.parse,
  );

  Future<ProposalRecord> get(String id) async => ProposalRecord.parse(
    await _client.request('/proposals/$id', authenticated: true),
  );

  Future<ProposalRecord> create(
    ProposalDraft draft, {
    required String idempotencyKey,
  }) async => ProposalRecord.parse(
    await _client.request(
      '/proposals',
      method: 'POST',
      body: draft.toJson(),
      headers: _idempotency(idempotencyKey),
      authenticated: true,
    ),
  );

  Future<ProposalRecord> change(
    String id, {
    required int expectedVersion,
    required String idempotencyKey,
    String? message,
    String? proposedCredit,
  }) async => ProposalRecord.parse(
    await _client.request(
      '/proposals/$id',
      method: 'PATCH',
      body: {
        'expectedVersion': expectedVersion,
        'message': ?message,
        'proposedCredit': ?proposedCredit,
      },
      headers: _idempotency(idempotencyKey),
      authenticated: true,
    ),
  );

  Future<AcceptedProposal> accept(
    String id, {
    required int expectedVersion,
    required String idempotencyKey,
    int? expectedRequestVersion,
  }) async => AcceptedProposal.parse(
    await _client.request(
      '/proposals/$id/accept',
      method: 'POST',
      body: {
        'expectedVersion': expectedVersion,
        'expectedRequestVersion': ?expectedRequestVersion,
      },
      headers: _idempotency(idempotencyKey),
      authenticated: true,
    ),
  );

  Future<ProposalRecord> reject(
    String id, {
    required int expectedVersion,
    required String idempotencyKey,
  }) async => ProposalRecord.parse(
    await _client.request(
      '/proposals/$id/reject',
      method: 'POST',
      body: {'expectedVersion': expectedVersion},
      headers: _idempotency(idempotencyKey),
      authenticated: true,
    ),
  );

  Future<ProposalRecord> withdraw(
    String id, {
    required int expectedVersion,
    required String idempotencyKey,
  }) async => ProposalRecord.parse(
    await _client.request(
      '/proposals/$id/withdraw',
      method: 'POST',
      body: {'expectedVersion': expectedVersion},
      headers: _idempotency(idempotencyKey),
      authenticated: true,
    ),
  );
}

Map<String, String> _idempotency(String key) => {'Idempotency-Key': key};
