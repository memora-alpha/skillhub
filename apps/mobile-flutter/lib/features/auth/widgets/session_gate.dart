import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../components/app_button.dart';
import '../../../components/misc.dart';
import '../../../core/http/app_error.dart';
import '../../../core/theme/tokens.dart';
import '../session/auth_session.dart';

/// Covers the app while the session restores or cannot be confirmed.
class SessionGate extends ConsumerWidget {
  const SessionGate({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final status = ref.watch(authStatusProvider);
    final open =
        status == AuthStatus.guest || status == AuthStatus.authenticated;
    return Stack(
      fit: StackFit.expand,
      children: [
        Offstage(
          offstage: !open,
          child: TickerMode(enabled: open, child: child),
        ),
        if (!open) _GateView(status: status),
      ],
    );
  }
}

class _GateView extends ConsumerWidget {
  const _GateView({required this.status});

  final AuthStatus status;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final loading = status == AuthStatus.bootstrapping;
    final reauth = status == AuthStatus.reauth;
    final error = ref.watch(authErrorProvider);
    return Material(
      color: Palette.cream,
      child: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 440),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                mainAxisSize: MainAxisSize.min,
                spacing: 20,
                children: [
                  const Align(
                    alignment: Alignment.centerLeft,
                    child: BrandLogo(),
                  ),
                  if (loading)
                    Semantics(
                      label: 'Đang khôi phục phiên đăng nhập',
                      child: const Center(
                        child: SizedBox(
                          width: 24,
                          height: 24,
                          child: CircularProgressIndicator(
                            strokeWidth: 2.5,
                            color: Palette.brand,
                          ),
                        ),
                      ),
                    )
                  else ...[
                    Semantics(
                      header: true,
                      child: Text(
                        reauth ? 'Cần đăng nhập lại' : 'Chưa thể mở tài khoản',
                        style: nunito(
                          TypeScale.title,
                          weight: FontWeight.w700,
                          color: Palette.ink,
                        ),
                      ),
                    ),
                    Text(
                      reauth
                          ? 'Kết nối bị gián đoạn khi làm mới phiên. Đăng nhập lại để bảo vệ tài khoản.'
                          : errorMessage(error),
                      style: nunito(TypeScale.body, color: Palette.muted),
                    ),
                    if (!reauth)
                      AppButton(
                        label: 'Thử lại',
                        onPressed: () => retryBootstrap(ref),
                      ),
                    AppButton(
                      label: 'Về đăng nhập',
                      variant: ButtonVariant.secondary,
                      onPressed: () =>
                          ref.read(authRuntimeProvider).controller.signOut(),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
