import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../components/app_button.dart';
import '../../../components/app_checkbox.dart';
import '../../../components/app_input.dart';
import '../../../components/tappable.dart';
import '../../../core/http/app_error.dart';
import '../../../core/toast/toast.dart';
import '../schema/auth_schema.dart';
import '../session/auth_session.dart';
import '../utils/auth_validation.dart';
import '../widgets/async_action.dart';
import '../widgets/auth_layout.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key, this.email, this.result});

  final String? email;
  final String? result;

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> with AsyncActions {
  late final _email = AppField(text: widget.email ?? '', validator: validateEmail);
  final _password = AppField(validator: validateLoginPassword);
  bool _rememberMe = false;
  String? _shownFeedback;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _showFeedback());
  }

  @override
  void didUpdateWidget(LoginScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.result != widget.result) _showFeedback();
  }

  void _showFeedback() {
    final message = switch (widget.result) {
      'verified' => 'Email đã được xác minh. Bạn có thể đăng nhập.',
      'reset' => 'Mật khẩu đã được đổi. Đăng nhập bằng mật khẩu mới.',
      _ => null,
    };
    if (message == null || message == _shownFeedback || !mounted) return;
    _shownFeedback = message;
    ref.read(toastProvider.notifier).show(message, ToastTone.success);
  }

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (isPending('login') || !validateFields([_email, _password])) return;
    FocusScope.of(context).unfocus();
    final input = LoginInput(
      email: _email.text.trim().toLowerCase(),
      password: _password.text,
      rememberMe: _rememberMe,
    );
    final ok = await runAction(
      'login',
      () => ref.read(authRuntimeProvider).controller.login(input),
    );
    if (ok && mounted) _password.reset();
  }

  @override
  Widget build(BuildContext context) {
    final pending = isPending('login');
    final error = errorOf('login');
    return AuthLayout(
      title: 'Chào mừng trở lại',
      subtitle: 'Đăng nhập để tiếp tục hành trình của bạn.',
      children: [
        AppInput(
          field: _email,
          label: 'Email',
          required: true,
          placeholder: 'email@gmail.com',
          editable: !pending,
          keyboardType: TextInputType.emailAddress,
          autofillHints: const [AutofillHints.email],
          textInputAction: TextInputAction.next,
          onChanged: (_) => resetAction('login'),
          onSubmitted: _password.focus.requestFocus,
        ),
        AppInput(
          field: _password,
          label: 'Mật khẩu',
          required: true,
          password: true,
          placeholder: 'Mật khẩu của bạn',
          editable: !pending,
          autofillHints: const [AutofillHints.password],
          textInputAction: TextInputAction.go,
          onChanged: (_) => resetAction('login'),
          onSubmitted: _submit,
        ),
        Wrap(
          alignment: WrapAlignment.spaceBetween,
          crossAxisAlignment: WrapCrossAlignment.center,
          spacing: 8,
          runSpacing: 8,
          children: [
            AppCheckbox(
              checked: _rememberMe,
              label: 'Ghi nhớ đăng nhập',
              onChanged: (value) {
                if (!pending) setState(() => _rememberMe = value);
              },
              child: const Text('Ghi nhớ đăng nhập'),
            ),
            Tappable(
              disabled: pending,
              onTap: () => context.push('/forgot-password'),
              child: Text('Quên mật khẩu?', style: authLinkStyle),
            ),
          ],
        ),
        AppButton(
          label: pending ? 'Đang đăng nhập...' : 'Đăng nhập',
          size: ButtonSize.lg,
          loading: pending,
          onPressed: _submit,
        ),
        if (error is AppError && error.code == 'ACCOUNT_NOT_ACTIVE')
          AppButton(
            label: 'Xác minh email',
            variant: ButtonVariant.secondary,
            onPressed: () => context.push(
              Uri(
                path: '/verify-email',
                queryParameters: {'email': _email.text.trim().toLowerCase()},
              ).toString(),
            ),
          ),
        AuthFooterLink(
          prefix: 'Chưa có tài khoản? ',
          link: 'Đăng ký',
          onTap: () {
            if (!pending) context.go('/register');
          },
        ),
      ],
    );
  }
}
