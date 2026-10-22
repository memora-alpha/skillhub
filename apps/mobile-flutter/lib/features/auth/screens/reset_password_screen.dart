import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../components/app_button.dart';
import '../../../components/app_input.dart';
import '../../../core/http/app_error.dart';
import '../../../core/toast/toast.dart';
import '../schema/auth_schema.dart';
import '../session/auth_session.dart';
import '../utils/auth_validation.dart';
import '../utils/otp_feedback.dart';
import '../utils/password_recovery.dart';
import '../widgets/async_action.dart';
import '../widgets/auth_layout.dart';

class ResetPasswordScreen extends ConsumerStatefulWidget {
  const ResetPasswordScreen({super.key});

  @override
  ConsumerState<ResetPasswordScreen> createState() =>
      _ResetPasswordScreenState();
}

class _ResetPasswordScreenState extends ConsumerState<ResetPasswordScreen>
    with AsyncActions {
  final _password = AppField(validator: validatePassword);
  late final _confirm = AppField(
    validator: (value) => validateConfirmPassword(value, _password.text),
  );

  @override
  void initState() {
    super.initState();
    _password.addListener(() {
      if (_confirm.touched) _confirm.validate();
    });
  }

  @override
  void dispose() {
    _password.dispose();
    _confirm.dispose();
    super.dispose();
  }

  Future<void> _submit(RecoveryDraft draft) async {
    final proof = draft.proof;
    if (isPending('reset') || proof == null) return;
    if (!validateFields([_password, _confirm])) return;
    final recovery = ref.read(passwordRecoveryProvider.notifier);
    if (proof.expired) {
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
      recovery.clearProof();
      return;
    }
    FocusScope.of(context).unfocus();
    final ok = await runAction(
      'reset',
      () => ref
          .read(authRuntimeProvider)
          .controller
          .resetPassword(
            ResetInput(
              email: draft.email,
              resetToken: proof.resetToken,
              newPassword: _password.text,
              confirmNewPassword: _confirm.text,
            ),
          ),
      toastMessage: (error) => isResetOutcomeUncertain(error)
          ? resetUncertainGuidance
          : errorMessage(error),
    );
    if (ok) {
      if (mounted) {
        context.go(
          Uri(
            path: '/login',
            queryParameters: {'email': draft.email, 'result': 'reset'},
          ).toString(),
        );
      }
      recovery.clear();
    } else if (isResetTokenRejected(errorOf('reset'))) {
      recovery.clearProof();
    }
  }

  @override
  Widget build(BuildContext context) {
    final draft = ref.watch(passwordRecoveryProvider);
    final session = ref.watch(accountSessionProvider);
    if (draft == null || draft.proof == null) return const SizedBox.shrink();
    final pending = isPending('reset');
    return AuthLayout(
      title: 'Đặt mật khẩu mới',
      subtitle: 'Chọn mật khẩu mới cho tài khoản của bạn.',
      children: [
        AppInput(
          field: _password,
          label: 'Mật khẩu mới',
          required: true,
          password: true,
          editable: !pending,
          autofillHints: const [AutofillHints.newPassword],
          textInputAction: TextInputAction.next,
          onChanged: (_) => resetAction('reset'),
          onSubmitted: _confirm.focus.requestFocus,
        ),
        ListenableBuilder(
          listenable: _password,
          builder: (context, _) => PasswordRequirements(password: _password.text),
        ),
        AppInput(
          field: _confirm,
          label: 'Xác nhận mật khẩu mới',
          required: true,
          password: true,
          editable: !pending,
          autofillHints: const [AutofillHints.newPassword],
          textInputAction: TextInputAction.go,
          onChanged: (_) => resetAction('reset'),
          onSubmitted: () => _submit(draft),
        ),
        AppButton(
          label: pending ? 'Đang đặt lại...' : 'Đặt lại mật khẩu',
          size: ButtonSize.lg,
          loading: pending,
          onPressed: () => _submit(draft),
        ),
        AuthFooterLink(
          prefix: 'Quay lại ',
          link: session != null ? 'cài đặt' : 'đăng nhập',
          onTap: () {
            if (pending) return;
            context.go(
              session != null
                  ? '/account-settings'
                  : Uri(
                      path: '/login',
                      queryParameters: {'email': draft.email},
                    ).toString(),
            );
          },
        ),
      ],
    );
  }
}
