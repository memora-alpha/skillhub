import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../components/app_button.dart';
import '../../components/app_input.dart';
import '../../components/feature_page.dart';
import '../../components/misc.dart';
import '../../core/http/app_error.dart';
import '../auth/session/auth_session.dart';
import '../remote/refresh_signal.dart';
import '../remote/remote_load.dart';

final sessionCancellationsProvider =
    FutureProvider.family<List<Map<String, dynamic>>, String>((ref, id) async {
      watchRefresh(ref, RefreshScope.study);
      if (ref.watch(sessionSnapshotProvider).phase != SessionPhase.ready)
        return const [];
      return ref
          .read(authRuntimeProvider)
          .services
          .study
          .resolution
          .cancellations(id);
    });

class SessionResolutionPanel extends ConsumerStatefulWidget {
  const SessionResolutionPanel({
    super.key,
    required this.session,
    required this.onRefresh,
    this.disabled = false,
  });
  final Map<String, dynamic> session;
  final Future<void> Function() onRefresh;
  final bool disabled;
  @override
  ConsumerState<SessionResolutionPanel> createState() =>
      _SessionResolutionPanelState();
}

class _SessionResolutionPanelState
    extends ConsumerState<SessionResolutionPanel> {
  final _excuse = AppField(
    validator: (s) => s.trim().length < 10 || s.trim().length > 1000
        ? 'Nhập lý do từ 10 đến 1000 ký tự.'
        : null,
  );
  final _reason = AppField(
    validator: (s) => s.trim().length < 3 || s.trim().length > 1000
        ? 'Nhập lý do từ 3 đến 1000 ký tự.'
        : null,
  );
  bool _busy = false;
  String? _error;
  String? _message;
  // An uncertain request keeps exactly the same key and payload on retry.
  String? _cancelKey;
  String? _cancelReason;
  String? _cancelStart;
  String get _id => widget.session['id'] as String;

  @override
  void dispose() {
    _excuse.dispose();
    _reason.dispose();
    super.dispose();
  }

  Future<void> _run(Future<void> Function(bool Function() current) work) async {
    if (_busy || widget.disabled) return;
    final generation = ref.read(sessionSnapshotProvider).generation;
    bool current() =>
        mounted && ref.read(sessionSnapshotProvider).generation == generation;
    setState(() {
      _busy = true;
      _error = null;
      _message = null;
    });
    try {
      await work(current);
      if (!current()) return;
      setState(
        () => _message = 'Máy chủ đã ghi nhận. Đang tải lại trạng thái.',
      );
    } catch (error) {
      if (current()) setState(() => _error = errorMessage(error));
    } finally {
      if (current()) {
        // Re-read even after a timeout; never assume that a command failed.
        ref.invalidate(sessionCancellationsProvider(_id));
        try {
          await widget.onRefresh();
        } catch (_) {
          /* Read UI shows its error. */
        }
        if (current()) setState(() => _busy = false);
      }
    }
  }

  Future<void> _absence({bool? accept}) async {
    if (accept == null && _excuse.validate() != null) return;
    await _run((current) async {
      final service = ref.read(authRuntimeProvider).services.study;
      final fresh = await service.session(_id);
      if (!current()) return;
      final action = accept == null ? 'SUBMIT_EXCUSE' : 'DECIDE_EXCUSE';
      if (fresh['allowedActions'] is! List ||
          !(fresh['allowedActions'] as List).contains(action))
        throw const AppError.protocol();
      if (accept == null) {
        await service.resolution.excuse(_id, _excuse.text);
      } else {
        await service.resolution.decideExcuse(_id, accept);
      }
    });
  }

  bool _canCancel(Map<String, dynamic> session) {
    final quota = session['makeupQuota'];
    return (session['makeupCount'] ?? 0) == 0 &&
        (quota is! Map ||
            (quota['requiresReview'] != true &&
                quota['remaining'] is num &&
                (quota['remaining'] as num) > 0)) &&
        const {'CONFIRMED', 'READY'}.contains(session['status']) &&
        (DateTime.tryParse('${session['startAt']}')?.isAfter(DateTime.now()) ??
            false);
  }

  Future<void> _cancel() async {
    if (_cancelKey == null && _reason.validate() != null) return;
    await _run((current) async {
      final service = ref.read(authRuntimeProvider).services.study;
      final fresh = await service.session(_id);
      if (!current()) return;
      if (!_canCancel(fresh) ||
          (_cancelStart != null && fresh['startAt'] != _cancelStart))
        throw const AppError.protocol();
      _cancelKey ??= newUuid();
      _cancelReason ??= _reason.text.trim();
      _cancelStart ??= fresh['startAt'] as String;
      try {
        await service.resolution.cancel(
          _id,
          _cancelReason!,
          _cancelStart!,
          _cancelKey!,
        );
      } on AppError catch (error) {
        if (current() &&
            error.kind == AppErrorKind.http &&
            error.status >= 400 &&
            error.status < 500) {
          _cancelKey = null;
          _cancelReason = null;
          _cancelStart = null;
        }
        rethrow;
      }
      if (!current()) return;
      _cancelKey = null;
      _cancelReason = null;
      _cancelStart = null;
      _reason.reset();
    });
  }

  Future<void> _respond(Map<String, dynamic> row, {bool? accept}) =>
      _run((current) async {
        final api = ref.read(authRuntimeProvider).services.study.resolution;
        final fresh = await api.cancellations(_id);
        if (!current()) return;
        if (!fresh.any(
          (r) =>
              r['id'] == row['id'] &&
              r['version'] == row['version'] &&
              r['status'] == row['status'],
        ))
          throw const AppError.protocol();
        await api.respond(
          _id,
          row['id'] as String,
          row['version'] as int,
          accept: accept,
        );
        if (current() && accept == null) {
          _cancelKey = null;
          _cancelReason = null;
          _cancelStart = null;
          _reason.reset();
        }
      });

  @override
  Widget build(BuildContext context) {
    final session = widget.session;
    final actions = session['allowedActions'] is List
        ? session['allowedActions'] as List
        : const [];
    final excuse = session['excuse'];
    final query = ref.watch(sessionCancellationsProvider(_id));
    final rows = query.value ?? const <Map<String, dynamic>>[];
    final open = rows.any(
      (r) =>
          const {'PENDING', 'ACCEPTED', 'STAFF_REVIEW'}.contains(r['status']),
    );
    final userId = ref.watch(accountProvider).value?.userId;
    final disabled =
        userId == null ||
        _busy ||
        widget.disabled ||
        query.isLoading ||
        query.hasError;
    const labels = {
      'PENDING': 'Chờ đối tác phản hồi',
      'ACCEPTED': 'Đã đồng ý',
      'REJECTED': 'Đã từ chối',
      'WITHDRAWN': 'Đã rút yêu cầu',
      'EXPIRED': 'Đã hết hạn',
      'APPLIED': 'Đã xử lý',
      'STAFF_REVIEW': 'Chờ nhân sự xem xét',
    };
    return Panel(
      title: 'Vắng học & hủy buổi',
      children: [
        const Copy(
          'Vắng học hoặc hủy buổi không cần tạo báo cáo sự cố. Giải trình và lịch học bù được xử lý riêng; Credit chỉ thay đổi theo kết quả máy chủ.',
        ),
        if (excuse is Map)
          Copy(
            'Giải trình: ${excuse['reason']} · ${labels[excuse['status']] ?? excuse['status']}',
          ),
        if (_message != null)
          FormNotice(tone: NoticeTone.info, message: _message!),
        if (_error != null)
          FormNotice(tone: NoticeTone.error, message: _error!),
        if (actions.contains('SUBMIT_EXCUSE')) ...[
          AppInput(
            field: _excuse,
            label: 'Lý do vắng học',
            multiline: true,
            editable: !_busy && !widget.disabled,
          ),
          AppButton(
            label: 'Gửi giải trình',
            disabled: _busy || widget.disabled,
            onPressed: () => _absence(),
          ),
        ],
        if (actions.contains('DECIDE_EXCUSE')) ...[
          AppButton(
            label: 'Chấp nhận lý do và học bù',
            disabled: _busy || widget.disabled,
            onPressed: () => _absence(accept: true),
          ),
          AppButton(
            label: 'Không chấp nhận lý do',
            disabled: _busy || widget.disabled,
            variant: ButtonVariant.paper,
            onPressed: () => _absence(accept: false),
          ),
        ],
        if (query.isLoading) const LinearProgressIndicator(),
        if (query.hasError)
          FormNotice(
            tone: NoticeTone.error,
            message: errorMessage(query.error),
          ),
        if (_canCancel(session) && !open) ...[
          const Copy(
            'Hai bên cần đồng ý trước giờ học. Người yêu cầu dùng một lượt học bù; Credit giữ nguyên. Sau đó cần chốt lịch bù.',
          ),
          AppInput(
            field: _reason,
            label: 'Lý do hủy buổi',
            multiline: true,
            editable: !disabled && _cancelKey == null,
          ),
          AppButton(
            label: _cancelKey == null
                ? 'Yêu cầu hủy buổi để học bù'
                : 'Kiểm tra lại cùng yêu cầu đã gửi',
            disabled: disabled,
            onPressed: _cancel,
          ),
        ],
        for (final row in rows) ...[
          Copy('${labels[row['status']] ?? row['status']}: ${row['reason']}'),
          if (row['blockedByDispute'] == true)
            const Copy(
              'Đang có tranh chấp. Chờ xử lý trước khi áp dụng quyết định.',
            ),
          if (row['requesterId'] == userId &&
              const {
                'PENDING',
                'ACCEPTED',
                'STAFF_REVIEW',
              }.contains(row['status']))
            AppButton(
              label: 'Rút yêu cầu hủy',
              variant: ButtonVariant.paper,
              disabled: disabled,
              onPressed: () => _respond(row),
            ),
          if (row['requesterId'] != userId && row['status'] == 'PENDING') ...[
            AppButton(
              label: 'Đồng ý hủy và học bù',
              disabled: disabled,
              onPressed: () => _respond(row, accept: true),
            ),
            AppButton(
              label: 'Từ chối yêu cầu hủy',
              variant: ButtonVariant.paper,
              disabled: disabled,
              onPressed: () => _respond(row, accept: false),
            ),
          ],
        ],
        AppButton(
          label: 'Tải lại xử lý buổi học',
          variant: ButtonVariant.paper,
          disabled: _busy,
          onPressed: () async {
            ref.invalidate(sessionCancellationsProvider(_id));
            await widget.onRefresh();
          },
        ),
      ],
    );
  }
}
