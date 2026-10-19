import 'package:flutter/material.dart';

import '../core/theme/tokens.dart';
import 'app_button.dart';
import 'app_icon.dart';

Future<T?> showAppDialog<T>(
  BuildContext context, {
  required WidgetBuilder builder,
  Color barrierColor = const Color(0x661C1410),
  bool dismissible = true,
}) {
  return showGeneralDialog<T>(
    context: context,
    barrierDismissible: dismissible,
    barrierLabel: 'Đóng hộp thoại',
    barrierColor: barrierColor,
    transitionDuration: Duration.zero,
    pageBuilder: (context, _, _) => SafeArea(
      child: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Material(type: MaterialType.transparency, child: builder(context)),
        ),
      ),
    ),
  );
}

class InfoModalCard extends StatelessWidget {
  const InfoModalCard({
    super.key,
    required this.title,
    required this.onClose,
    this.body,
    this.content,
    this.confirmLabel = 'Đã hiểu',
    this.onConfirm,
    this.confirmDisabled = false,
  });

  final String title;
  final VoidCallback onClose;
  final String? body;
  final Widget? content;
  final String confirmLabel;
  final VoidCallback? onConfirm;
  final bool confirmDisabled;

  @override
  Widget build(BuildContext context) {
    final maxHeight = MediaQuery.sizeOf(context).height * 0.9;
    return Semantics(
      scopesRoute: true,
      explicitChildNodes: true,
      namesRoute: true,
      label: title,
      child: Container(
        width: double.infinity,
        constraints: BoxConstraints(maxWidth: 448, maxHeight: maxHeight),
        padding: const EdgeInsets.all(24),
        decoration: BoxDecoration(
          color: Palette.white,
          borderRadius: BorderRadius.circular(Radii.card),
          border: Border.all(color: Palette.border),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          spacing: 20,
          children: [
            Row(
              spacing: 12,
              children: [
                Expanded(
                  child: Semantics(
                    header: true,
                    child: Text(
                      title,
                      style: nunito(
                        TypeScale.title,
                        weight: FontWeight.w700,
                        color: Palette.ink,
                      ),
                    ),
                  ),
                ),
                Semantics(
                  button: true,
                  label: 'Đóng',
                  child: GestureDetector(
                    behavior: HitTestBehavior.opaque,
                    onTap: onClose,
                    child: const Padding(
                      padding: EdgeInsets.all(4),
                      child: AppIcon(AppIcon.close, size: 20, color: Palette.muted),
                    ),
                  ),
                ),
              ],
            ),
            Flexible(
              child: SingleChildScrollView(
                child:
                    content ??
                    Text(
                      body ?? '',
                      style: nunito(TypeScale.body, color: Palette.muted),
                    ),
              ),
            ),
            AppButton(
              label: confirmLabel,
              onPressed: onConfirm ?? onClose,
              disabled: confirmDisabled,
            ),
          ],
        ),
      ),
    );
  }
}

Future<void> showInfoModal(
  BuildContext context, {
  required String title,
  String? body,
  Widget? content,
  String confirmLabel = 'Đã hiểu',
}) {
  return showAppDialog<void>(
    context,
    builder: (dialogContext) => InfoModalCard(
      title: title,
      body: body,
      content: content,
      confirmLabel: confirmLabel,
      onClose: () => Navigator.of(dialogContext).pop(),
    ),
  );
}

/// Resolves to true when the user confirms.
Future<bool> showLogoutDialog(BuildContext context) async {
  final result = await showAppDialog<bool>(
    context,
    barrierColor: const Color(0x6B1C1410),
    builder: (dialogContext) => Semantics(
      scopesRoute: true,
      explicitChildNodes: true,
      namesRoute: true,
      label: 'Đăng xuất khỏi SkillHub?',
      child: Container(
        width: double.infinity,
        constraints: const BoxConstraints(maxWidth: 384),
        padding: const EdgeInsets.all(24),
        decoration: BoxDecoration(
          color: Palette.white,
          borderRadius: BorderRadius.circular(Radii.card),
          border: Border.all(color: Palette.border),
          boxShadow: Shadows.lg,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          spacing: 20,
          children: [
            Container(
              width: 48,
              height: 48,
              alignment: Alignment.center,
              decoration: const BoxDecoration(
                color: Color(0xFFFCE8E4),
                shape: BoxShape.circle,
              ),
              child: const AppIcon(AppIcon.logout, size: 24, color: Palette.error),
            ),
            Column(
              spacing: 4,
              children: [
                Text(
                  'Đăng xuất?',
                  textAlign: TextAlign.center,
                  style: nunito(
                    (18, 24),
                    weight: FontWeight.w700,
                    color: Palette.ink,
                  ),
                ),
                Text(
                  'Bạn có muốn đăng xuất khỏi tài khoản này không?',
                  textAlign: TextAlign.center,
                  style: nunito(TypeScale.body, color: Palette.muted),
                ),
              ],
            ),
            Row(
              spacing: 8,
              children: [
                Expanded(
                  child: AppButton(
                    label: 'Ở lại',
                    variant: ButtonVariant.ghost,
                    onPressed: () => Navigator.of(dialogContext).pop(false),
                  ),
                ),
                Expanded(
                  child: AppButton(
                    label: 'Đăng xuất',
                    backgroundColor: Palette.error,
                    onPressed: () => Navigator.of(dialogContext).pop(true),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    ),
  );
  return result ?? false;
}
