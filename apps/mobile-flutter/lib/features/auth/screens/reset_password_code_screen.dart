import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../components/app_button.dart';
import '../../../components/app_input.dart';
import '../../../components/otp_input.dart';
import '../../../components/tappable.dart';
import '../../../core/http/app_error.dart';
import '../../../core/toast/toast.dart';
import '../session/auth_session.dart';
import '../utils/auth_validation.dart';
import '../utils/cooldown.dart';
import '../utils/otp_feedback.dart';
import '../utils/password_recovery.dart';
import '../widgets/async_action.dart';
import '../widgets/auth_layout.dart';
import '../widgets/cooldown_builder.dart';

class ResetPasswordCodeScreen extends ConsumerStatefulWidget {
  const ResetPasswordCodeScreen({super.key, this.sent = false});

  final bool sent;

  @override
  ConsumerState<ResetPasswordCodeScreen> createState() =>
      _ResetPasswordCodeScreenState();
}

class _ResetPasswordCodeScreenState
    extends ConsumerState<ResetPasswordCodeScreen>
    with AsyncActions {
  late final _emailField = AppField(
    text: ref.read(passwordRecoveryProvider)?.email ?? '',
  );
  final _otp = AppField(validator: validateOtp);

  @override
  void initState() {
    super.initState();
    if (widget.sent && ref.read(passwordRecoveryProvider) != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) {
          ref
              .read(toastProvider.notifier)
              .show(otpRequestAcknowledgment, ToastTone.success);
        }
      });
    }
  }

  @override
  void dispose() {
    _emailField.dispose();
    _otp.dispose();
    super.dispose();
  }

  bool get _busy => isPending('forgot') || isPending('verifyRecovery');

  Future<void> _submit(RecoveryDraft draft) async {
    if (_busy || !validateFields([_otp])) return;
    FocusScope.of(context).unfocus();
    final recovery = ref.read(passwordRecoveryProvider.notifier);
    await runAction('verifyRecovery', () async {
      final proof = await ref
          .read(authRuntimeProvider)
          .api
          .verifyRecovery(draft.email, _otp.text);
      if (!identical(ref.read(passwordRecoveryProvider), draft)) return;
      if (!recovery.authorize(draft.email, proof)) {
        ref
            .read(toastProvider.notifier)
            .show(
              errorMessage(
                const AppError(
                  AppErrorKind.http,
                  status: 400,
                  code: 'RESET_TOKEN_INVALID_OR_EXPIRED',
                ),
              ),
              ToastTone.error,
            );
      }
    });
  }

  Future<void> _resend(RecoveryDraft draft) async {
    if (_busy) return;
    final cooldown = ref.read(recoveryCooldownProvider.notifier);
    if (!cooldown.reserve(draft.email)) return;
    final ok = await runAction('forgot', () async {
      await ref.read(authRuntimeProvider).api.forgot(draft.email);
      cooldown.start(draft.email);
    });
    if (!ok || !mounted) return;
    ref.read(passwordRecoveryProvider.notifier).clearProof();
    resetAction('verifyRecovery');
    _otp.reset();
    ref
        .read(toastProvider.notifier)
        .show(otpRequestAcknowledgment, ToastTone.success);
  }

  @override
  Widget build(BuildContext context) {
    final draft = ref.watch(passwordRecoveryProvider);
    final session = ref.watch(accountSessionProvider);
    if (draft == null) return const SizedBox.shrink();
    final busy = _busy;
    return AuthLayout(
      title: 'Nhập mã xác minh',
      subtitle: 'Nhập mã 6 chữ số trong email để tiếp tục đặt lại mật khẩu.',
      children: [
        AppInput(field: _emailField, label: 'Email', editable: false),
        OtpInput(
          field: _otp,
          editable: !busy,
          onChanged: (_) => resetAction('verifyRecovery'),
          onSubmitted: () => _submit(draft),
        ),
        AppButton(
          label: isPending('verifyRecovery') ? 'Đang xác minh...' : 'Tiếp tục',
          size: ButtonSize.lg,
          disabled: busy,
          onPressed: () => _submit(draft),
        ),
        CooldownBuilder(
          provider: recoveryCooldownProvider,
          email: draft.email,
          builder: (context, seconds) => AppButton(
            label: isPending('forgot')
                ? 'Đang gửi...'
                : seconds > 0
                ? 'Gửi lại mã sau ${seconds}s'
                : 'Gửi lại mã',
            variant: ButtonVariant.secondary,
            disabled: busy || seconds > 0,
            onPressed: () => _resend(draft),
          ),
        ),
        if (session == null)
          AuthFooterLink(
            prefix: 'Nhập nhầm email? ',
            link: 'Đổi email',
            onTap: () {
              if (!busy) ref.read(passwordRecoveryProvider.notifier).clear();
            },
          ),
        Center(
          child: Tappable(
            link: true,
            onTap: () {
              if (!busy) {
                context.go(session != null ? '/account-settings' : '/login');
              }
            },
            child: Text(
              session != null ? 'Quay lại cài đặt' : 'Quay lại đăng nhập',
              textAlign: TextAlign.center,
              style: authLinkStyle,
            ),
          ),
        ),
      ],
    );
  }
}
