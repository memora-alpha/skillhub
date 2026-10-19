import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../http/app_error.dart';

class RefreshCredential {
  const RefreshCredential({
    required this.refreshToken,
    required this.refreshExpiresAt,
    this.rotationPending = false,
  });

  final String refreshToken;
  final String refreshExpiresAt;
  final bool rotationPending;

  DateTime? get expiresAt => DateTime.tryParse(refreshExpiresAt);

  RefreshCredential withRotationPending() => RefreshCredential(
    refreshToken: refreshToken,
    refreshExpiresAt: refreshExpiresAt,
    rotationPending: true,
  );

  Map<String, Object> toJson() => {
    'refreshToken': refreshToken,
    'refreshExpiresAt': refreshExpiresAt,
    if (rotationPending) 'rotationPending': true,
  };
}

abstract interface class SecretDriver {
  Future<String?> read();
  Future<void> write(String value);
  Future<void> clear();
}

class TokenStore {
  TokenStore(this._driver);

  factory TokenStore.platform() =>
      TokenStore(kIsWeb ? _MemoryDriver() : _SecureDriver());

  final SecretDriver _driver;

  Future<T> _secure<T>(Future<T> Function() action) async {
    try {
      return await action();
    } catch (_) {
      throw const AppError(AppErrorKind.storage);
    }
  }

  Future<RefreshCredential?> read() async {
    final raw = await _secure(_driver.read);
    if (raw == null || raw.isEmpty) return null;
    Object? value;
    try {
      value = jsonDecode(raw);
    } on FormatException {
      value = null;
    }
    if (value is Map<String, dynamic> &&
        value['refreshToken'] is String &&
        (value['refreshToken'] as String).isNotEmpty &&
        value['refreshExpiresAt'] is String &&
        DateTime.tryParse(value['refreshExpiresAt'] as String) != null &&
        (value['rotationPending'] == null || value['rotationPending'] is bool)) {
      return RefreshCredential(
        refreshToken: value['refreshToken'] as String,
        refreshExpiresAt: value['refreshExpiresAt'] as String,
        rotationPending: value['rotationPending'] == true,
      );
    }
    await _secure(_driver.clear);
    return null;
  }

  Future<void> write(RefreshCredential value) =>
      _secure(() => _driver.write(jsonEncode(value.toJson())));

  Future<void> clear() => _secure(_driver.clear);
}

class _SecureDriver implements SecretDriver {
  static const _key = 'skillhub.auth.refresh.v1';
  static const _storage = FlutterSecureStorage(
    iOptions: IOSOptions(
      accessibility: KeychainAccessibility.unlocked_this_device,
    ),
  );

  @override
  Future<String?> read() => _storage.read(key: _key);

  @override
  Future<void> write(String value) => _storage.write(key: _key, value: value);

  @override
  Future<void> clear() => _storage.delete(key: _key);
}

/// Browser preview is intentionally memory-only; web auth persistence has no contract yet.
class _MemoryDriver implements SecretDriver {
  String? _value;

  @override
  Future<String?> read() async => _value;

  @override
  Future<void> write(String value) async => _value = value;

  @override
  Future<void> clear() async => _value = null;
}
