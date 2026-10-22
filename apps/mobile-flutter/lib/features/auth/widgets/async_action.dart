import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/http/app_error.dart';
import '../../../core/toast/toast.dart';

/// Pending/error bookkeeping for screen-level mutations.
mixin AsyncActions<T extends ConsumerStatefulWidget> on ConsumerState<T> {
  final Set<String> _pending = {};
  final Map<String, Object> _errors = {};

  bool isPending(String key) => _pending.contains(key);
  bool get anyPending => _pending.isNotEmpty;
  Object? errorOf(String key) => _errors[key];

  void resetAction(String key) {
    if (_errors.containsKey(key)) setState(() => _errors.remove(key));
  }

  /// Runs [action] once at a time per [key]; resolves to true on success.
  /// Failures show an error toast unless [toastMessage] returns null.
  Future<bool> runAction(
    String key,
    Future<void> Function() action, {
    String? Function(Object error)? toastMessage,
  }) async {
    if (_pending.contains(key)) return false;
    final toast = ref.read(toastProvider.notifier);
    toast.dismiss();
    setState(() {
      _pending.add(key);
      _errors.remove(key);
    });
    try {
      await action();
      return true;
    } catch (error) {
      if (mounted) {
        setState(() => _errors[key] = error);
        final message = toastMessage == null
            ? errorMessage(error)
            : toastMessage(error);
        if (message != null) toast.show(message, ToastTone.error);
      }
      return false;
    } finally {
      if (mounted) setState(() => _pending.remove(key));
    }
  }
}
