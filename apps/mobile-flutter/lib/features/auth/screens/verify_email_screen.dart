import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../components/app_button.dart';
import '../../../components/app_input.dart';
import '../../../components/otp_input.dart';
import '../../../components/tappable.dart';
import '../../../core/toast/toast.dart';
import '../session/auth_session.dart';
import '../utils/auth_validation.dart';
import '../utils/cooldown.dart';
import '../utils/otp_feedback.dart';
import '../widgets/async_action.dart';
import '../widgets/auth_layout.dart';
import '../widgets/cooldown_builder.dart';

class VerifyEmailScreen extends ConsumerStatefulWidget {
  const VerifyEmailScreen({super.key, required this.email, this.sent = false});

  final String email;
  final bool sent;

  @override
  ConsumerState<VerifyEmailScreen> createState() => _VerifyEmailScreenState();
}

class _VerifyEmailScreenState extends ConsumerState<VerifyEmailScreen>
    with AsyncActions {
  late final _emailField = AppField(text: widget.email);
  final _otp = AppField(validator: validateOtp);

  @override
  void initState() {
    super.initState();
    if (widget.sent) {
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

  bool get _busy => isPending('verify') || isPending('resend');

  Future<void> _submit() async {
    if (_busy || !validateFields([_otp])) return;
    FocusScope.of(context).unfocus();
    final ok = await runAction(
      'verify',
      () => ref.read(authRuntimeProvider).api.verify(widget.email, _otp.text),
    );
    if (ok && mounted) {
      context.go(
        Uri(
          path: '/login',
          queryParameters: {'email': widget.email, 'result': 'verified'},
        ).toString(),
      );
    }
  }

  Future<void> _resend() async {
    if (_busy) return;
    final cooldown = ref.read(verificationCooldownProvider.notifier);
    if (!cooldown.reserve(widget.email)) return;
    final ok = await runAction('resend', () async {
      await ref.read(authRuntimeProvider).api.resend(widget.email);
      cooldown.start(widget.email);
      ref
          .read(toastProvider.notifier)
          .show(otpRequestAcknowledgment, ToastTone.success);
    });
    if (ok && mounted) {
      _otp.reset();
      resetAction('verify');
    }
  }

  @override
  Widget build(BuildContext context) {
    final busy = _busy;
    return AuthLayout(
      title: 'Xác minh email',
      subtitle: 'Nhập mã 6 chữ số được gửi đến email của bạn.',
      children: [
        AppInput(field: _emailField, label: 'Email', editable: false),
        OtpInput(
          field: _otp,
          editable: !busy,
          onChanged: (_) => resetAction('verify'),
          onSubmitted: _submit,
        ),
        AppButton(
          label: isPending('verify') ? 'Đang xác minh...' : 'Xác minh email',
          size: ButtonSize.lg,
          loading: isPending('verify'),
          disabled: isPending('resend'),
          onPressed: _submit,
        ),
        CooldownBuilder(
          provider: verificationCooldownProvider,
          email: widget.email,
          initiallySent: widget.sent,
          builder: (context, seconds) => AppButton(
            label: isPending('resend')
                ? 'Đang gửi...'
                : seconds > 0
                ? 'Gửi lại mã sau ${seconds}s'
                : 'Gửi lại mã',
            variant: ButtonVariant.secondary,
            loading: isPending('resend'),
            disabled: seconds > 0 || isPending('verify'),
            onPressed: _resend,
          ),
        ),
        Column(
          children: [
            Tappable(
              link: true,
              disabled: busy,
              pressedOpacity: 0.6,
              onTap: () => context.go(
                Uri(
                  path: '/register',
                  queryParameters: {'email': widget.email},
                ).toString(),
              ),
              child: SizedBox(
                height: 44,
                child: Center(
                  child: Text('Quay lại đăng ký', style: authLinkStyle),
                ),
              ),
            ),
            AuthFooterLink(
              prefix: 'Đã có tài khoản? ',
              link: 'Đăng nhập',
              topPadding: 0,
              onTap: () => context.go('/login'),
            ),
          ],
        ),
      ],
    );
  }
}
