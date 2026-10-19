import 'dart:async';

import 'package:flutter/foundation.dart';

import '../../../core/http/app_error.dart';
import '../../../core/http/http_client.dart';
import '../../../core/storage/token_store.dart';
import '../api/auth_api.dart';
import '../schema/auth_schema.dart';

enum SessionPhase { bootstrapping, guest, ready, offline, reauth }

class SessionController extends ChangeNotifier implements SessionTransport {
  SessionController(this._api, this._store, {DateTime Function()? now})
    : _now = now ?? DateTime.now;

  final AuthApi _api;
  final TokenStore _store;
  final DateTime Function() _now;

  SessionPhase _phase = SessionPhase.bootstrapping;
  RefreshCredential? _credential;
  String? _accessToken;
  DateTime _expiresAt = DateTime.fromMillisecondsSinceEpoch(0);
  int _epoch = 0;
  Future<void>? _rotation;
  Future<void>? _bootstrapTask;
  ({int epoch, Future<void> future})? _logoutAllTask;
  ({int epoch, String token, Future<void> future})? _resetTask;
  Future<void> _writes = Future.value();
  Object? error;

  SessionPhase get phase => _phase;
  bool get signedIn => _credential != null;

  @override
  int get generation => _epoch;

  void _publish(SessionPhase phase, [Object? error]) {
    _phase = phase;
    this.error = error;
    notifyListeners();
  }

  Future<void> _persist(Future<void> Function() action) {
    final next = _writes.then((_) => action(), onError: (_) => action());
    _writes = next.catchError((_) {});
    return next;
  }

  bool _expired(String isoDate) =>
      !(DateTime.tryParse(isoDate)?.isAfter(_now()) ?? false);

  Future<void> _revoke(String refreshToken) async {
    try {
      await _api.logout(refreshToken);
    } catch (_) {}
  }

  Future<void> _accept(TokenPair pair, int epoch) async {
    if (epoch != _epoch) {
      await _revoke(pair.refreshToken);
      throw const AppError.session();
    }
    final credential = RefreshCredential(
      refreshToken: pair.refreshToken,
      refreshExpiresAt: pair.refreshExpiresAt,
    );
    try {
      await _persist(() => _store.write(credential));
    } catch (_) {
      await _revoke(pair.refreshToken);
      rethrow;
    }
    if (epoch != _epoch) {
      await _revoke(pair.refreshToken);
      throw const AppError.session();
    }
    _credential = credential;
    _accessToken = pair.accessToken;
    _expiresAt = _now().add(
      Duration(milliseconds: (pair.expiresIn * 1000).round()),
    );
    _publish(SessionPhase.ready);
  }

  Future<void> bootstrap() {
    return _bootstrapTask ??= _restore().whenComplete(
      () => _bootstrapTask = null,
    );
  }

  Future<void> _restore() async {
    if (_phase == SessionPhase.ready || _phase == SessionPhase.reauth) return;
    final epoch = _epoch;
    _publish(SessionPhase.bootstrapping);
    try {
      final stored = await _store.read();
      if (epoch != _epoch) return;
      if (stored == null || _expired(stored.refreshExpiresAt)) {
        await expire();
        return;
      }
      _credential = stored;
      if (stored.rotationPending) {
        _publish(SessionPhase.reauth, const AppError.session());
        return;
      }
      await renew();
    } catch (error) {
      if (epoch == _epoch && _phase == SessionPhase.bootstrapping) {
        _publish(SessionPhase.offline, error);
      }
    }
  }

  Future<void> login(LoginInput input) async {
    final epoch = ++_epoch;
    final pair = await _api.login(input);
    try {
      await _accept(pair, epoch);
    } catch (_) {
      if (epoch == _epoch) await expire();
      rethrow;
    }
  }

  @override
  Future<String?> getToken() async {
    if (_accessToken != null &&
        !_now().add(const Duration(seconds: 15)).isBefore(_expiresAt)) {
      await renew();
    }
    return _accessToken;
  }

  @override
  Future<void> renew([String? staleToken]) {
    if (staleToken != null &&
        _accessToken != null &&
        staleToken != _accessToken) {
      return Future.value();
    }
    return _rotation ??= _rotate().whenComplete(() => _rotation = null);
  }

  Future<void> _rotate() async {
    final credential = _credential;
    final epoch = _epoch;
    if (credential == null ||
        credential.rotationPending ||
        _expired(credential.refreshExpiresAt)) {
      await expire();
      throw const AppError.session();
    }
    var sent = false;
    try {
      // Persist the in-flight marker before sending. A lost response must never replay a consumed token after restart.
      await _persist(() => _store.write(credential.withRotationPending()));
      if (epoch != _epoch) throw const AppError.session();
      _credential = credential.withRotationPending();
      sent = true;
      final pair = await _api.refresh(credential.refreshToken);
      await _accept(pair, epoch);
    } catch (error) {
      if (epoch != _epoch) rethrow;
      _accessToken = null;
      if (sent && error is AppError && error.kind == AppErrorKind.network) {
        _publish(SessionPhase.reauth, error);
      } else if (!sent ||
          (error is AppError && error.kind == AppErrorKind.config)) {
        _credential = credential;
        try {
          await _persist(() => _store.write(credential));
        } catch (_) {}
        _publish(SessionPhase.offline, error);
      } else {
        await expire();
      }
      rethrow;
    }
  }

  @override
  Future<void> expire() async {
    ++_epoch;
    _accessToken = null;
    _credential = null;
    _publish(SessionPhase.guest);
    try {
      await _persist(_store.clear);
    } catch (error) {
      _publish(SessionPhase.offline, error);
    }
  }

  Future<void> signOut() async {
    final token = _credential?.refreshToken;
    await expire();
    if (token != null) unawaited(_revoke(token));
  }

  Future<void> signOutAll() {
    final epoch = _epoch;
    final current = _logoutAllTask;
    if (current != null && current.epoch == epoch) return current.future;
    late final Future<void> future;
    future = _revokeAll(epoch).whenComplete(() {
      if (identical(_logoutAllTask?.future, future)) _logoutAllTask = null;
    });
    _logoutAllTask = (epoch: epoch, future: future);
    return future;
  }

  Future<void> resetPassword(ResetInput input) {
    final epoch = _epoch;
    final current = _resetTask;
    if (current != null &&
        current.epoch == epoch &&
        current.token == input.resetToken) {
      return current.future;
    }
    late final Future<void> future;
    future = _applyPasswordReset(input, epoch).whenComplete(() {
      if (identical(_resetTask?.future, future)) _resetTask = null;
    });
    _resetTask = (epoch: epoch, token: input.resetToken, future: future);
    return future;
  }

  Future<void> _applyPasswordReset(ResetInput input, int epoch) async {
    final signedIn = _credential != null;
    await _api.reset(input);
    if (epoch != _epoch) throw const AppError.session();
    if (signedIn) await expire();
  }

  Future<void> _revokeAll(int epoch) async {
    await _api.logoutAll();
    if (epoch != _epoch) throw const AppError.session();
    await expire();
  }
}
