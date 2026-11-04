import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../auth/session/auth_session.dart';
import '../remote/refresh_signal.dart';
import 'skills_feature.dart';

const skillDecisionPollInterval = Duration(seconds: 5);

bool hasPendingSkillDecision(Iterable<String> statuses) =>
    statuses.any((status) => status == 'PENDING');

/// Reloads own skills while a verification is waiting, including when the
/// window becomes visible again after staff reviews in another tab.
final skillDecisionPollProvider = Provider<void>((ref) {
  if (ref.watch(sessionSnapshotProvider.select((s) => s.phase)) !=
      SessionPhase.ready) {
    return;
  }
  final pending = hasPendingSkillDecision(
    ref.watch(skillsProvider).map((skill) => skill.status),
  );
  void bump() {
    if (!ref.mounted) return;
    ref.read(refreshTicksProvider.notifier).bump(const {RefreshScope.skills});
  }

  final life = AppLifecycleListener(onResume: pending ? bump : null);
  ref.onDispose(life.dispose);
  if (!pending) return;
  final timer = Timer.periodic(skillDecisionPollInterval, (_) => bump());
  ref.onDispose(timer.cancel);
});
