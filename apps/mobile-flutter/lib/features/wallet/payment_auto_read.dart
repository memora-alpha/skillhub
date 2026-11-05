import 'dart:async';
import 'dart:math' as math;

import '../../core/http/app_error.dart';

const terminalPaymentStatuses = {
  'PAID',
  'FAILED',
  'EXPIRED',
  'REFUNDED',
  'CANCELLED',
};

bool isTerminalPaymentStatus(String status) =>
    terminalPaymentStatuses.contains(status);

bool isDeniedPaymentRead(Object? error) {
  if (error is! AppError) return false;
  return error.kind == AppErrorKind.session ||
      error.status == 403 ||
      error.status == 404;
}

class PaymentReadSnapshot {
  const PaymentReadSnapshot({
    this.id,
    this.status,
    this.denied = false,
    this.stale = false,
  });

  final String? id;
  final String? status;
  final bool denied;
  final bool stale;
}

typedef PaymentReadCancel = void Function();
typedef PaymentReadSchedule =
    PaymentReadCancel Function(void Function() work, Duration delay);

Duration paymentReadDelay({
  required int errors,
  required bool slow,
  required bool realtime,
}) {
  if (errors > 0) {
    final exp = math.min(errors, 3);
    return Duration(milliseconds: math.min(30000, 5000 * math.pow(2, exp).toInt()));
  }
  if (slow || realtime) return const Duration(seconds: 30);
  return const Duration(seconds: 2);
}

int paymentReadLimit({required bool slow, required bool realtime}) {
  if (slow) return 120;
  if (realtime) return 20;
  return 300;
}

/// UI observation cadence only: no provider SLA, expiry decision or mutation.
/// Active checkout: 2s / 300 reads, or 30s / 20 reads with SSE connected.
/// REVIEW/UNKNOWN: 30s / 120 reads.
PaymentReadCancel startPaymentReadLoop({
  required bool Function() current,
  required PaymentReadSnapshot Function() snapshot,
  required Future<void> Function() read,
  bool Function()? realtime,
  int? maxReads,
  void Function()? onStop,
  PaymentReadSchedule? schedule,
}) {
  final run =
      schedule ??
      (work, delay) {
        final timer = Timer(delay, work);
        return timer.cancel;
      };
  final identity = snapshot().id;
  var active = true;
  var reads = 0;
  var errors = 0;
  PaymentReadCancel? cancel;

  void stop() {
    if (!active) return;
    active = false;
    cancel?.call();
    cancel = null;
    onStop?.call();
  }

  bool slowStatus() {
    final status = snapshot().status ?? '';
    return status == 'REVIEW' || status == 'UNKNOWN';
  }

  bool eligible() {
    final next = snapshot();
    return current() &&
        next.id != null &&
        next.id == identity &&
        !next.denied &&
        !isTerminalPaymentStatus(next.status ?? '');
  }

  late void Function() plan;

  Future<void> tick() async {
    if (!active) return;
    if (!eligible()) {
      stop();
      return;
    }
    reads++;
    try {
      await read();
      errors = snapshot().stale ? errors + 1 : 0;
    } catch (_) {
      errors++;
    } finally {
      plan();
    }
  }

  plan = () {
    if (!active) return;
    final slow = slowStatus();
    final live = realtime?.call() ?? false;
    final limit = maxReads ?? paymentReadLimit(slow: slow, realtime: live);
    if (!eligible() || reads >= limit) {
      stop();
      return;
    }
    cancel = run(() {
      cancel?.call();
      cancel = null;
      unawaited(tick());
    }, paymentReadDelay(errors: errors, slow: slow, realtime: live));
  };

  plan();
  return stop;
}
