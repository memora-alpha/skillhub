import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/auth_api.dart';
import 'auth_validation.dart';

class RecoveryDraft {
  const RecoveryDraft(this.email, [this.proof]);

  final String email;
  final PasswordResetProof? proof;
}

/// Reset credentials stay in memory, never in route params or persistent storage.
class PasswordRecoveryNotifier extends Notifier<RecoveryDraft?> {
  @override
  RecoveryDraft? build() => null;

  bool begin(String email) {
    if (validateEmail(email) != null) {
      state = null;
      return false;
    }
    state = RecoveryDraft(email.trim().toLowerCase());
    return true;
  }

  bool authorize(String email, PasswordResetProof proof) {
    final draft = state;
    if (draft == null || draft.email != email.trim().toLowerCase()) {
      return false;
    }
    if (proof.expired) return false;
    state = RecoveryDraft(draft.email, proof);
    return true;
  }

  void clearProof() {
    final draft = state;
    if (draft != null) state = RecoveryDraft(draft.email);
  }

  void clear() => state = null;
}

final passwordRecoveryProvider =
    NotifierProvider<PasswordRecoveryNotifier, RecoveryDraft?>(
      PasswordRecoveryNotifier.new,
    );
