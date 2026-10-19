import 'dart:ui';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/tokens.dart';
import '../auth/session/auth_session.dart';
import '../learning_requests/schema/learning_request_schema.dart';

abstract final class DiscoveryColors {
  static const background = Chrome.background;
  static const surface = Chrome.surface;
  static const ink = Chrome.ink;
  static const body = Color(0xFF6E6B66);
  static const muted = Color(0xFF97928A);
  static const border = Chrome.border;
  static const orange = Chrome.accent;
  static const orangeDark = Color(0xFFD95120);
  static const orangeSoft = Color(0xFFFFF4EE);
  static const green = Color(0xFF27977B);
  static const greenSoft = Color(0xFFEAF7F0);
  static const sharing = Color(0xFFF5FCF8);
  static const purple = Color(0xFF9864CB);
  static const purpleSoft = Color(0xFFF3EAFB);
  static const tag = Color(0xFFF6F7F8);
}

const requestFilters = ['Tất cả', 'Lập trình', 'Ngoại ngữ'];

class LearningRequest {
  const LearningRequest({
    required this.id,
    required this.title,
    required this.user,
    required this.userId,
    required this.budget,
    required this.tags,
    required this.sessions,
    required this.created,
    required this.category,
    this.goal = '',
  });

  final String id;
  final String title;
  final String user;
  final String userId;
  final String budget;
  final List<String> tags;
  final int sessions;
  final String created;
  final String category;
  final String goal;

  int get budgetCredit => int.tryParse(budget.split(' ').first) ?? 0;
}

LearningRequest learningRequestFromCard(LearningRequestCard card) => LearningRequest(
  id: card.id,
  title: card.title,
  user: card.ownerName.isEmpty ? 'Người học' : card.ownerName,
  userId: card.ownerId,
  budget: card.desiredCreditPerHour == null
      ? ''
      : '${card.desiredCreditPerHour} CR/giờ',
  tags: [card.skill.name, ...card.tagLabels],
  sessions: 0,
  created: _shortWhen(card.createdAt),
  category: card.skill.name,
  goal: card.learningGoal,
);

String _shortWhen(String? value) {
  final parsed = DateTime.tryParse(value ?? '');
  if (parsed == null) return '';
  final local = parsed.toLocal();
  final month = local.month.toString().padLeft(2, '0');
  final day = local.day.toString().padLeft(2, '0');
  final hour = local.hour.toString().padLeft(2, '0');
  final minute = local.minute.toString().padLeft(2, '0');
  return '$day/$month $hour:$minute';
}

final learningRequestsProvider = FutureProvider<List<LearningRequest>>((
  ref,
) async {
  final phase = ref.watch(sessionSnapshotProvider).phase;
  if (phase != SessionPhase.ready) return const [];
  final page = await ref
      .read(authRuntimeProvider)
      .services
      .learningRequests
      .feed(limit: 50);
  return [for (final card in page.items) learningRequestFromCard(card)];
});

final recommendedRequestsProvider = FutureProvider<List<LearningRequest>>((
  ref,
) async {
  final phase = ref.watch(sessionSnapshotProvider).phase;
  if (phase != SessionPhase.ready) return const [];
  final page = await ref
      .read(authRuntimeProvider)
      .services
      .learningRequests
      .recommended(limit: 20);
  return [for (final card in page.items) learningRequestFromCard(card)];
});

class RequestDetailContent {
  const RequestDetailContent({
    required this.hashtags,
    required this.duration,
    required this.learning,
    required this.learningTags,
    required this.sharing,
    required this.sharingTags,
    required this.schedule,
    required this.scheduleNote,
    required this.reputation,
    required this.memberSince,
  });

  final List<String> hashtags;
  final String duration;
  final String learning;
  final List<String> learningTags;
  final String sharing;
  final List<String> sharingTags;
  final List<({String day, List<String> slots})> schedule;
  final String scheduleNote;
  final int reputation;
  final String memberSince;
}

const requestDetails = <String, RequestDetailContent>{};
