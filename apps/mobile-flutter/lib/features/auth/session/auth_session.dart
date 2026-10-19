import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/config/env.dart';
import '../../../core/http/app_error.dart';
import '../../../core/http/http_client.dart';
import '../../../core/storage/token_store.dart';
import '../../account/account_api.dart';
import '../api/auth_api.dart';
import 'session_controller.dart';

class AuthRuntime {
  AuthRuntime._(this.api, this.controller, this.accountApi);

  factory AuthRuntime.create() {
    final client = HttpClient(getApiUrl);
    final api = AuthApi(client);
    final controller = SessionController(api, TokenStore.platform());
    client.bindSession(controller);
    return AuthRuntime._(api, controller, AccountApi(client));
  }

  final AuthApi api;
  final SessionController controller;
  final AccountApi accountApi;
}

final authRuntimeProvider = Provider<AuthRuntime>((ref) {
  final runtime = AuthRuntime.create();
  ref.onDispose(runtime.controller.dispose);
  unawaited(runtime.controller.bootstrap());
  return runtime;
});

typedef SessionSnapshot = ({SessionPhase phase, int generation});

class SessionSnapshotNotifier extends Notifier<SessionSnapshot> {
  @override
  SessionSnapshot build() {
    final controller = ref.watch(authRuntimeProvider).controller;
    void listener() =>
        state = (phase: controller.phase, generation: controller.generation);
    controller.addListener(listener);
    ref.onDispose(() => controller.removeListener(listener));
    return (phase: controller.phase, generation: controller.generation);
  }

  @override
  bool updateShouldNotify(SessionSnapshot previous, SessionSnapshot next) =>
      previous != next;
}

final sessionSnapshotProvider =
    NotifierProvider<SessionSnapshotNotifier, SessionSnapshot>(
      SessionSnapshotNotifier.new,
    );

class AccountNotifier extends AsyncNotifier<OwnIdentity?> {
  @override
  Future<OwnIdentity?> build() async {
    final snapshot = ref.watch(sessionSnapshotProvider);
    if (snapshot.phase != SessionPhase.ready) return null;
    final runtime = ref.read(authRuntimeProvider);
    final account = await runtime.accountApi.getMe();
    if (account.accountStatus != 'ACTIVE') {
      await runtime.controller.expire();
      throw const AppError.session();
    }
    if (ref.mounted && account.profile.avatarUrl != null) {
      // The current API signs avatar URLs for 60 seconds.
      final timer = Timer(const Duration(seconds: 45), ref.invalidateSelf);
      ref.onDispose(timer.cancel);
    }
    return account;
  }

  int get generation => ref.read(sessionSnapshotProvider).generation;

  void replaceProfile(OwnProfile profile) {
    final current = state.value;
    if (current == null || current.userId != profile.userId) return;
    state = AsyncData(current.withProfile(profile));
  }

  Future<OwnIdentity?> reload() {
    ref.invalidateSelf();
    return future;
  }
}

final accountProvider = AsyncNotifierProvider<AccountNotifier, OwnIdentity?>(
  AccountNotifier.new,
);

enum AuthStatus { bootstrapping, guest, authenticated, offline, reauth }

final authStatusProvider = Provider<AuthStatus>((ref) {
  final phase = ref.watch(sessionSnapshotProvider.select((s) => s.phase));
  switch (phase) {
    case SessionPhase.bootstrapping:
      return AuthStatus.bootstrapping;
    case SessionPhase.guest:
      return AuthStatus.guest;
    case SessionPhase.offline:
      return AuthStatus.offline;
    case SessionPhase.reauth:
      return AuthStatus.reauth;
    case SessionPhase.ready:
      final account = ref.watch(accountProvider);
      if (account.value != null) return AuthStatus.authenticated;
      if (account.hasError && !account.isLoading) return AuthStatus.offline;
      return AuthStatus.bootstrapping;
  }
});

final authErrorProvider = Provider<Object?>((ref) {
  ref.watch(sessionSnapshotProvider);
  final account = ref.watch(accountProvider);
  return account.error ?? ref.read(authRuntimeProvider).controller.error;
});

class AccountSession {
  const AccountSession(this.account);

  final OwnIdentity account;

  OwnProfile get profile => account.profile;
  String get userId => account.userId;
  String get name => profile.fullName;
  String get email => account.email;
  String get bio => profile.bio;
  String get headline => profile.headline;
  String? get avatarUrl => profile.avatarUrl;
  bool get isNew => profile.completedSessionCount == 0;
}

final accountSessionProvider = Provider<AccountSession?>((ref) {
  final phase = ref.watch(sessionSnapshotProvider.select((s) => s.phase));
  if (phase != SessionPhase.ready) return null;
  final account = ref.watch(accountProvider).value;
  return account == null ? null : AccountSession(account);
});

void retryBootstrap(WidgetRef ref) {
  final controller = ref.read(authRuntimeProvider).controller;
  if (controller.phase == SessionPhase.ready) {
    unawaited(ref.read(accountProvider.notifier).reload().catchError((_) => null));
  } else {
    unawaited(controller.bootstrap());
  }
}
