import 'dart:math' as math;

import 'package:flutter_riverpod/flutter_riverpod.dart';

const verificationResendSeconds = 60;

int remainingCooldownSeconds(int deadline, int now) =>
    math.max(0, ((deadline - now) / 1000).ceil());

/// Client-only timestamps survive navigation; the API remains the spam guard.
class CooldownNotifier extends Notifier<Map<String, int>> {
  @override
  Map<String, int> build() => const {};

  static String _key(String email) => email.trim().toLowerCase();

  void start(String email, [int? now]) {
    final key = _key(email);
    final deadline = (now ?? DateTime.now().millisecondsSinceEpoch) +
        verificationResendSeconds * 1000;
    final current = state[key] ?? 0;
    state = {...state, key: deadline > current ? deadline : current};
  }

  bool reserve(String email) {
    final key = _key(email);
    final now = DateTime.now().millisecondsSinceEpoch;
    if (remainingCooldownSeconds(state[key] ?? 0, now) > 0) return false;
    start(key, now);
    return true;
  }

  int deadline(String email) => state[_key(email)] ?? 0;
}

final verificationCooldownProvider =
    NotifierProvider<CooldownNotifier, Map<String, int>>(CooldownNotifier.new);
final recoveryCooldownProvider =
    NotifierProvider<CooldownNotifier, Map<String, int>>(CooldownNotifier.new);
