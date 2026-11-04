import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'negotiation_message.dart';

/// Draft carried from a Chat negotiation card into plan / agreement screens.
class PlanSuggestionDraft {
  const PlanSuggestionDraft({
    required this.conversationId,
    required this.skill,
    required this.goal,
    required this.sessions,
    required this.twoWay,
    required this.teach,
    required this.credit,
  });

  final String conversationId;
  final String skill;
  final String goal;
  final List<String> sessions;
  final bool twoWay;
  final bool teach;
  final String credit;

  factory PlanSuggestionDraft.fromSuggestion({
    required String conversationId,
    required PathNegotiationSuggestion suggestion,
  }) => PlanSuggestionDraft(
    conversationId: conversationId,
    skill: suggestion.skill.trim(),
    goal: suggestion.goal.trim(),
    sessions: [
      for (final session in suggestion.sessions)
        if (session.trim().isNotEmpty) session.trim(),
    ],
    twoWay: suggestion.twoWay,
    teach: suggestion.teach,
    credit: suggestion.credit.trim().isEmpty ? '20' : suggestion.credit.trim(),
  );
}

class PlanSuggestionDraftNotifier extends Notifier<PlanSuggestionDraft?> {
  @override
  PlanSuggestionDraft? build() => null;

  void setDraft(PlanSuggestionDraft? draft) => state = draft;

  void clear() => state = null;
}

final planSuggestionDraftProvider =
    NotifierProvider<PlanSuggestionDraftNotifier, PlanSuggestionDraft?>(
      PlanSuggestionDraftNotifier.new,
    );
