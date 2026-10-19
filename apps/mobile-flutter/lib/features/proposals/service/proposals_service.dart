import '../../../core/http/http_client.dart';
import '../api/proposals_api.dart';
import '../schema/proposal_schema.dart';

class ProposalsService {
  ProposalsService(HttpClient client) : _api = ProposalsApi(client);

  final ProposalsApi _api;

  Future<Page<ProposalRecord>> list({
    String direction = 'received',
    String? status,
    String? learningRequestId,
    String? cursor,
    int? limit,
  }) => _api.list(
    direction: direction,
    status: status,
    learningRequestId: learningRequestId,
    cursor: cursor,
    limit: limit,
  );

  Future<ProposalRecord> get(String id) => _api.get(id);

  Future<ProposalRecord> create(
    ProposalDraft draft, {
    required String idempotencyKey,
  }) => _api.create(draft, idempotencyKey: idempotencyKey);

  Future<ProposalRecord> change(
    String id, {
    required int expectedVersion,
    required String idempotencyKey,
    String? message,
    String? proposedCredit,
  }) => _api.change(
    id,
    expectedVersion: expectedVersion,
    idempotencyKey: idempotencyKey,
    message: message,
    proposedCredit: proposedCredit,
  );

  Future<AcceptedProposal> accept(
    String id, {
    required int expectedVersion,
    required String idempotencyKey,
    int? expectedRequestVersion,
  }) => _api.accept(
    id,
    expectedVersion: expectedVersion,
    idempotencyKey: idempotencyKey,
    expectedRequestVersion: expectedRequestVersion,
  );

  Future<ProposalRecord> reject(
    String id, {
    required int expectedVersion,
    required String idempotencyKey,
  }) => _api.reject(
    id,
    expectedVersion: expectedVersion,
    idempotencyKey: idempotencyKey,
  );

  Future<ProposalRecord> withdraw(
    String id, {
    required int expectedVersion,
    required String idempotencyKey,
  }) => _api.withdraw(
    id,
    expectedVersion: expectedVersion,
    idempotencyKey: idempotencyKey,
  );
}
