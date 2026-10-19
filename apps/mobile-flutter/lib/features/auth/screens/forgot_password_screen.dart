import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../components/app_button.dart';
import '../../../components/app_input.dart';
import '../session/auth_session.dart';
import '../utils/auth_validation.dart';
import '../utils/cooldown.dart';
import '../utils/password_recovery.dart';
import '../widgets/async_action.dart';
import '../widgets/auth_layout.dart';
import '../widgets/cooldown_builder.dart';

class ForgotPasswordScreen extends ConsumerStatefulWidget {
  const ForgotPasswordScreen({super.key});

  @override
  ConsumerState<ForgotPasswordScreen> createState() =>
      _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends ConsumerState<ForgotPasswordScreen>
    with AsyncActions {
  late final _email = AppField(
    text:
        ref.read(accountSessionProvider)?.email ??
        ref.read(passwordRecoveryProvider)?.email ??
        '',
    validator: validateEmail,
  );

  @override
  void dispose() {
    _email.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (isPending('forgot') || !validateFields([_email])) return;
    final email = _email.text.trim().toLowerCase();
    if (!ref.read(recoveryCooldownProvider.notifier).reserve(email)) return;
    FocusScope.of(context).unfocus();
    final runtime = ref.read(authRuntimeProvider);
    final generation = runtime.controller.generation;
    final ok = await runAction('forgot', () async {
      await runtime.api.forgot(email);
      ref.read(recoveryCooldownProvider.notifier).start(email);
    });
    if (!ok || !mounted || generation != runtime.controller.generation) return;
    ref.read(passwordRecoveryProvider.notifier).begin(email);
    context.go('/reset-password-code?sent=true');
  }

  @override
  Widget build(BuildContext context) {
    final session = ref.watch(accountSessionProvider);
    final pending = isPending('forgot');
    return AuthLayout(
      title: session != null ? 'Đặt lại mật khẩu' : 'Quên mật khẩu',
      subtitle: 'Nhập email tài khoản để nhận mã khôi phục mật khẩu.',
      children: [
        AppInput(
          field: _email,
          label: 'Email',
          required: true,
          editable: !pending && session == null,
          placeholder: 'email@gmail.com',
          keyboardType: TextInputType.emailAddress,
          autofillHints: const [AutofillHints.email],
          textInputAction: TextInputAction.go,
          onChanged: (_) {
            resetAction('forgot');
            setState(() {});
          },
          onSubmitted: _submit,
        ),
        CooldownBuilder(
          provider: recoveryCooldownProvider,
          email: _email.text,
          builder: (context, seconds) => AppButton(
            label: pending
                ? 'Đang gửi...'
                : seconds > 0
                ? 'Gửi lại mã sau ${seconds}s'
                : 'Gửi mã xác minh',
            size: ButtonSize.lg,
            disabled: pending || seconds > 0,
            onPressed: _submit,
          ),
        ),
        AuthFooterLink(
          prefix: session != null ? '' : 'Nhớ mật khẩu rồi? ',
          link: session != null ? 'Quay lại cài đặt' : 'Đăng nhập',
          onTap: () {
            if (pending) return;
            context.go(session != null ? '/account-settings' : '/login');
          },
        ),
      ],
    );
  }
}
