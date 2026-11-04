import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../auth/session/auth_session.dart';
import '../remote/refresh_signal.dart';
import 'live_materials.dart';

const materialDecisionPollInterval = Duration(seconds: 5);

bool hasPendingMaterialReview(Iterable<String> statuses) =>
    statuses.any((status) => status == 'PENDING_REVIEW');

/// Reloads owned materials while staff review is pending.
final materialDecisionPollProvider = Provider<void>((ref) {
  if (ref.watch(sessionSnapshotProvider.select((s) => s.phase)) !=
      SessionPhase.ready) {
    return;
  }
  final pending = hasPendingMaterialReview(
    (ref.watch(myMaterialsProvider).value ?? const []).map(
      (item) => '${item['status'] ?? ''}',
    ),
  );
  void bump() {
    if (!ref.mounted) return;
    ref.read(refreshTicksProvider.notifier).bump(const {RefreshScope.materials});
  }

  final life = AppLifecycleListener(onResume: pending ? bump : null);
  ref.onDispose(life.dispose);
  if (!pending) return;
  final timer = Timer.periodic(materialDecisionPollInterval, (_) => bump());
  ref.onDispose(timer.cancel);
});
