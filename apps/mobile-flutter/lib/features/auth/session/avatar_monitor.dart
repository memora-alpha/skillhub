import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/toast/toast.dart';
import '../../account/account_api.dart';
import 'auth_session.dart';

class AvatarMonitorState {
  const AvatarMonitorState({
    required this.upload,
    this.error,
    this.checking = false,
    this.waitingTooLong = false,
  });

  final AvatarUpload upload;
  final Object? error;
  final bool checking;
  final bool waitingTooLong;

  bool get settled =>
      upload.status == AvatarStatus.clean ||
      upload.status == AvatarStatus.deleted;

  AvatarMonitorState copyWith({
    AvatarUpload? upload,
    Object? error,
    bool clearError = false,
    bool? checking,
    bool? waitingTooLong,
  }) => AvatarMonitorState(
    upload: upload ?? this.upload,
    error: clearError ? null : (error ?? this.error),
    checking: checking ?? this.checking,
    waitingTooLong: waitingTooLong ?? this.waitingTooLong,
  );
}

const _pollInterval = Duration(seconds: 2);
const _maxWait = Duration(seconds: 120);

class AvatarMonitor extends Notifier<AvatarMonitorState?> {
  Timer? _poll;
  Timer? _deadline;
  DateTime _startedAt = DateTime.now();
  String _lastToastKey = '';

  @override
  AvatarMonitorState? build() {
    ref.watch(sessionSnapshotProvider.select((s) => s.generation));
    ref.onDispose(_stopTimers);
    if (_lastToastKey.isNotEmpty) {
      _lastToastKey = '';
      Future.microtask(() => ref.read(toastProvider.notifier).dismiss());
    }
    return null;
  }

  void _stopTimers() {
    _poll?.cancel();
    _deadline?.cancel();
  }

  void track(AvatarUpload? upload) {
    _stopTimers();
    _lastToastKey = '';
    if (upload == null) {
      state = null;
      return;
    }
    _startedAt = DateTime.now();
    state = AvatarMonitorState(upload: upload);
    _deadline = Timer(_maxWait, () {
      final current = state;
      if (current != null) _update(current.copyWith(waitingTooLong: true));
    });
    unawaited(_check());
  }

  Future<void> _check() async {
    final current = state;
    if (current == null) return;
    final runtime = ref.read(authRuntimeProvider);
    final generation = runtime.controller.generation;
    final assetId = current.upload.assetId;
    _update(current.copyWith(checking: true, clearError: true));
    try {
      final upload = await runtime.accountApi.getAvatarUpload(assetId);
      if (!_isCurrent(generation, assetId)) return;
      _update(state!.copyWith(upload: upload, checking: false));
      if (state!.settled) {
        await _refreshProfile();
      } else if (upload.status == AvatarStatus.quarantined &&
          DateTime.now().difference(_startedAt) < _maxWait) {
        _poll = Timer(_pollInterval, () => unawaited(_check()));
      }
    } catch (error) {
      if (!_isCurrent(generation, assetId)) return;
      _update(state!.copyWith(error: error, checking: false));
    }
  }

  Future<void> _refreshProfile() async {
    final current = state;
    if (current == null) return;
    final generation = ref.read(authRuntimeProvider).controller.generation;
    final assetId = current.upload.assetId;
    _update(current.copyWith(checking: true, clearError: true));
    try {
      await ref.read(accountProvider.notifier).reload();
      if (!_isCurrent(generation, assetId)) return;
      _update(state!.copyWith(checking: false));
    } catch (error) {
      if (!_isCurrent(generation, assetId)) return;
      _update(state!.copyWith(error: error, checking: false));
    }
  }

  bool _isCurrent(int generation, String assetId) =>
      ref.mounted &&
      state?.upload.assetId == assetId &&
      ref.read(authRuntimeProvider).controller.generation == generation;

  Future<void> retry() {
    _poll?.cancel();
    return state?.settled == true ? _refreshProfile() : _check();
  }

  void _update(AvatarMonitorState next) {
    state = next;
    if (next.checking) return;
    final status = next.upload.status;
    final settled = next.settled;
    final String? message;
    if (next.error != null) {
      message = settled
          ? 'Chưa cập nhật được ảnh. Hãy kiểm tra lại.'
          : 'Chưa kiểm tra được ảnh. Hãy thử lại.';
    } else if (status == AvatarStatus.rejected) {
      message = 'Ảnh không vượt qua kiểm tra. Hãy chọn ảnh khác.';
    } else if (status == AvatarStatus.quarantined && next.waitingTooLong) {
      message = 'Kiểm tra ảnh lâu hơn dự kiến.';
    } else {
      message = null;
    }
    final key = message == null ? '' : '${next.upload.assetId}:$message';
    if (key.isNotEmpty && key != _lastToastKey) {
      ref
          .read(toastProvider.notifier)
          .show(
            message!,
            next.error != null || status == AvatarStatus.rejected
                ? ToastTone.error
                : ToastTone.info,
          );
    }
    _lastToastKey = key;
  }
}

final avatarMonitorProvider =
    NotifierProvider<AvatarMonitor, AvatarMonitorState?>(AvatarMonitor.new);
