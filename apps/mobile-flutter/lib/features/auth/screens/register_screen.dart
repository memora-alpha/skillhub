import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../components/app_button.dart';
import '../../../components/app_checkbox.dart';
import '../../../components/app_input.dart';
import '../../../components/dialogs.dart';
import '../schema/auth_schema.dart';
import '../session/auth_session.dart';
import '../utils/auth_validation.dart';
import '../utils/cooldown.dart';
import '../widgets/async_action.dart';
import '../widgets/auth_layout.dart';

const _notices = {
  'terms': (
    'Điều khoản sử dụng',
    'Nội dung điều khoản chính thức chưa được cung cấp. Vui lòng liên hệ SkillHub để được hỗ trợ trước khi đăng ký.',
  ),
  'privacy': (
    'Chính sách bảo mật',
    'Nội dung chính sách chính thức chưa được cung cấp. Vui lòng liên hệ SkillHub để được hỗ trợ trước khi đăng ký.',
  ),
};

class RegisterScreen extends ConsumerStatefulWidget {
  const RegisterScreen({super.key, this.email});

  final String? email;

  @override
  ConsumerState<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends ConsumerState<RegisterScreen>
    with AsyncActions {
  final _fullName = AppField(validator: validateFullName);
  late final _email = AppField(text: widget.email ?? '', validator: validateEmail);
  final _password = AppField(validator: validatePassword);
  late final _confirm = AppField(
    validator: (value) => validateConfirmPassword(value, _password.text),
  );
  bool _agreeTerms = false;
  bool _termsTouched = false;
  late final _termsTap = TapGestureRecognizer()..onTap = () => _openNotice('terms');
  late final _privacyTap = TapGestureRecognizer()
    ..onTap = () => _openNotice('privacy');

  @override
  void initState() {
    super.initState();
    _password.addListener(() {
      if (_confirm.touched) _confirm.validate();
    });
  }

  @override
  void dispose() {
    for (final field in [_fullName, _email, _password, _confirm]) {
      field.dispose();
    }
    _termsTap.dispose();
    _privacyTap.dispose();
    super.dispose();
  }

  void _openNotice(String key) {
    final (title, body) = _notices[key]!;
    showInfoModal(context, title: title, body: body);
  }

  Future<void> _submit() async {
    if (isPending('register')) return;
    final valid = validateFields([_fullName, _email, _password, _confirm]);
    setState(() => _termsTouched = true);
    if (!valid || !_agreeTerms) return;
    FocusScope.of(context).unfocus();
    final email = _email.text.trim().toLowerCase();
    final ok = await runAction('register', () async {
      await ref
          .read(authRuntimeProvider)
          .api
          .register(
            RegisterInput(
              fullName: _fullName.text.trim(),
              email: email,
              password: _password.text,
              confirmPassword: _confirm.text,
            ),
          );
      ref.read(verificationCooldownProvider.notifier).start(email);
    });
    if (!ok || !mounted) return;
    _password.reset();
    _confirm.reset();
    context.go(
      Uri(
        path: '/verify-email',
        queryParameters: {'email': email, 'sent': 'true'},
      ).toString(),
    );
  }

  @override
  Widget build(BuildContext context) {
    final pending = isPending('register');
    void reset(String _) => resetAction('register');
    return AuthLayout(
      title: 'Tạo tài khoản',
      subtitle: 'Bắt đầu hành trình học và chia sẻ kỹ năng.',
      children: [
        AppInput(
          field: _fullName,
          label: 'Họ và tên',
          required: true,
          placeholder: 'Nguyễn Văn A',
          editable: !pending,
          textCapitalization: TextCapitalization.words,
          autofillHints: const [AutofillHints.name],
          textInputAction: TextInputAction.next,
          onChanged: reset,
          onSubmitted: _email.focus.requestFocus,
        ),
        AppInput(
          field: _email,
          label: 'Email',
          required: true,
          placeholder: 'email@gmail.com',
          editable: !pending,
          keyboardType: TextInputType.emailAddress,
          autofillHints: const [AutofillHints.email],
          textInputAction: TextInputAction.next,
          onChanged: reset,
          onSubmitted: _password.focus.requestFocus,
        ),
        AppInput(
          field: _password,
          label: 'Mật khẩu',
          required: true,
          password: true,
          placeholder: '8–64 ký tự',
          editable: !pending,
          autofillHints: const [AutofillHints.newPassword],
          textInputAction: TextInputAction.next,
          onChanged: reset,
          onSubmitted: _confirm.focus.requestFocus,
        ),
        ListenableBuilder(
          listenable: _password,
          builder: (context, _) => PasswordRequirements(password: _password.text),
        ),
        AppInput(
          field: _confirm,
          label: 'Xác nhận mật khẩu',
          required: true,
          password: true,
          placeholder: 'Nhập lại mật khẩu',
          editable: !pending,
          autofillHints: const [AutofillHints.newPassword],
          textInputAction: TextInputAction.done,
          onChanged: reset,
          onSubmitted: _submit,
        ),
        AppCheckbox(
          checked: _agreeTerms,
          label: 'Đồng ý điều khoản sử dụng và chính sách bảo mật',
          error: _termsTouched && !_agreeTerms
              ? 'Vui lòng đồng ý điều khoản và chính sách bảo mật.'
              : null,
          onChanged: (value) {
            if (pending) return;
            setState(() {
              _agreeTerms = value;
              _termsTouched = true;
            });
          },
          child: Text.rich(
            TextSpan(
              text: 'Tôi đồng ý với ',
              children: [
                TextSpan(
                  text: 'Điều\u00a0khoản\u00a0sử\u00a0dụng',
                  style: authLinkStyle,
                  recognizer: _termsTap,
                ),
                const TextSpan(text: ' và '),
                TextSpan(
                  text: 'Chính\u00a0sách\u00a0bảo\u00a0mật',
                  style: authLinkStyle,
                  recognizer: _privacyTap,
                ),
                const TextSpan(text: '.'),
              ],
            ),
          ),
        ),
        AppButton(
          label: pending ? 'Đang gửi...' : 'Tạo tài khoản',
          size: ButtonSize.lg,
          disabled: pending,
          onPressed: _submit,
        ),
        AuthFooterLink(
          prefix: 'Đã có tài khoản? ',
          link: 'Đăng nhập',
          onTap: () {
            if (!pending) context.go('/login');
          },
        ),
      ],
    );
  }
}
