import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/http/app_error.dart';
import '../../core/http/http_client.dart';
import '../auth/session/auth_session.dart';
import '../remote/refresh_signal.dart';
import '../remote/remote_load.dart';
import '../skills/skills_feature.dart';
import 'schema/learning_request_schema.dart';
import 'service/learning_requests_service.dart';

typedef PreferredSlot = ({DateTime startAt, DateTime endAt});

class OwnRequest {
  const OwnRequest({
    required this.id,
    required this.title,
    required this.skill,
    required this.description,
    required this.goal,
    required this.level,
    required this.status,
    this.skillId,
    this.tagIds = const [],
    this.tags = const [],
    this.preferredSlots = const [],
    this.reason,
    this.version = 1,
    this.teachingOverview,
    this.offeredSharingSkillIds = const [],
    this.verifiedTeacherOnly = false,
    this.desiredCreditPerHour,
    this.preferredAvailability,
    this.expiresAt,
    this.publishedAt,
  });

  final String id;
  final String title;
  final String skill;
  final String? skillId;
  final List<String> tagIds;
  final List<String> tags;
  final List<PreferredSlot> preferredSlots;
  final String description;
  final String goal;
  final String level;
  final String status;
  final String? reason;
  final int version;
  final String? teachingOverview;
  final List<String> offeredSharingSkillIds;
  final bool verifiedTeacherOnly;
  final String? desiredCreditPerHour;
  final PreferredAvailability? preferredAvailability;
  final DateTime? expiresAt;
  final DateTime? publishedAt;
}

OwnRequest ownRequestFromJson(
  Map<String, dynamic> json,
  Map<String, String> names,
) {
  final skillId = asString(json['skillId']);
  final tags = json['tags'];
  final tagIds = json['tagIds'];
  final offerings = json['offeredSharingSkillIds'];
  DateTime? moment(Object? value) {
    final text = asOptionalString(value);
    return text == null ? null : DateTime.tryParse(text)?.toLocal();
  }

  return OwnRequest(
    id: asString(json['id']),
    title: asString(json['title']),
    skill: names[skillId] ?? skillId,
    skillId: skillId,
    description: asText(json['description']),
    goal: asText(json['learningGoal']),
    level: asOptionalString(json['currentLevel']) ?? '',
    status: asString(json['status']),
    reason: asOptionalString(json['moderationRejectReason']),
    version: asInt(json['version']),
    tagIds: [
      if (tagIds is List)
        for (final id in tagIds)
          if (id is String && id.isNotEmpty) id,
    ],
    tags: [
      if (tags is List)
        for (final tag in tags)
          if (tag is Map && tag['label'] is String) tag['label'] as String,
    ],
    preferredSlots: [
      for (final slot in asList(json['preferredSlots'] ?? const [], asMap))
        (
          startAt: DateTime.parse(asString(slot['startAt'])).toLocal(),
          endAt: DateTime.parse(asString(slot['endAt'])).toLocal(),
        ),
    ],
    teachingOverview: asOptionalString(json['teachingOverview']),
    offeredSharingSkillIds: [
      if (offerings is List)
        for (final id in offerings)
          if (id is String && id.isNotEmpty) id,
    ],
    verifiedTeacherOnly: json['verifiedTeacherOnly'] == true,
    desiredCreditPerHour: asOptionalString(json['desiredCreditPerHour']),
    preferredAvailability: PreferredAvailability.tryParse(
      json['preferredAvailability'],
    ),
    expiresAt: moment(json['requestedExpiresAt'] ?? json['expiresAt']),
    publishedAt: moment(json['publishedAt']),
  );
}

class RequestsNotifier extends Notifier<List<OwnRequest>> {
  var _ticket = 0;

  @override
  List<OwnRequest> build() {
    listenForRefresh(ref, RefreshScope.requests, () {
      if (ref.read(sessionSnapshotProvider).phase != SessionPhase.ready) return;
      if (ref.read(accountProvider).value?.userId == null) return;
      reload();
    });
    final phase = ref.watch(sessionSnapshotProvider).phase;
    final userId = ref.watch(accountProvider).value?.userId;
    if (phase == SessionPhase.ready && userId != null) {
      _ticket++;
      _reload(_ticket);
    }
    return const [];
  }

  Future<void> _reload(int ticket) async {
    try {
      final services = ref.read(authRuntimeProvider).services;
      final records = await drainPages(
        (cursor) => services.learningRequests.mine(cursor: cursor, limit: 50),
      );
      final catalog = await ref.read(skillCatalogProvider.future);
      final names = {for (final skill in catalog) skill.id: skill.name};
      if (!ref.mounted || ticket != _ticket) return;
      state = [for (final record in records) ownRequestFromJson(record, names)];
    } catch (_) {
      if (!ref.mounted || ticket != _ticket) return;
      state = const [];
    }
  }

  OwnRequest? find(String? id) => state.where((r) => r.id == id).firstOrNull;

  Future<void> reload() => _reload(++_ticket);

  LearningRequestDraft _draft(OwnRequest request) => LearningRequestDraft(
    title: request.title,
    skillId: request.skillId ?? '',
    description: request.description,
    learningGoal: request.goal,
    currentLevel: request.level.isEmpty ? null : request.level,
    verifiedTeacherOnly: request.verifiedTeacherOnly,
    tagIds: request.tagIds,
    preferredSlots: request.preferredSlots,
    teachingOverview: request.teachingOverview,
    offeredSharingSkillIds: request.offeredSharingSkillIds,
    desiredCreditPerHour: request.desiredCreditPerHour,
    preferredAvailability: request.preferredAvailability,
    expiresAt: request.expiresAt,
  );

  Future<({String? id, String? error})> save(
    OwnRequest request, {
    required bool creating,
  }) async {
    if (request.skillId == null || request.skillId!.isEmpty) {
      return (id: null, error: 'Chọn kỹ năng trong danh mục.');
    }
    try {
      final api = ref.read(authRuntimeProvider).services.learningRequests;
      final saved = creating
          ? await api.create(_draft(request))
          : await api.edit(
              request.id,
              _draft(request),
              expectedVersion: request.version,
            );
      final ticket = ++_ticket;
      await _reload(ticket);
      return (id: asString(saved['id']), error: null);
    } catch (error) {
      return (id: null, error: errorMessage(error));
    }
  }

  Future<String?> publish(OwnRequest request) => _versioned(
    (api) => api.publish(request.id, expectedVersion: request.version),
  );

  Future<String?> cancel(OwnRequest request) => _versioned(
    (api) => api.cancel(request.id, expectedVersion: request.version),
  );

  Future<String?> _versioned(
    Future<Map<String, dynamic>> Function(LearningRequestsService api) run,
  ) async {
    try {
      final api = ref.read(authRuntimeProvider).services.learningRequests;
      await run(api);
      final ticket = ++_ticket;
      await _reload(ticket);
      return null;
    } catch (error) {
      return errorMessage(error);
    }
  }
}

final requestsProvider = NotifierProvider<RequestsNotifier, List<OwnRequest>>(
  RequestsNotifier.new,
);
