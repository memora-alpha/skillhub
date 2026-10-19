import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../components/app_icon.dart';
import '../../../components/misc.dart';
import '../../../components/tappable.dart';
import '../../../core/theme/tokens.dart';
import '../utils/auth_validation.dart';

const _community = [
  ('NL', Color(0xFFD4622A)),
  ('TV', Color(0xFF3D6B5A)),
  ('MH', Color(0xFF8B6914)),
  ('PD', Color(0xFFC03030)),
];

class AuthLayout extends StatelessWidget {
  const AuthLayout({
    super.key,
    required this.title,
    required this.subtitle,
    required this.children,
  });

  final String title;
  final String subtitle;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final wide = MediaQuery.sizeOf(context).width >= 1024;
    final logo = Tappable(
      semanticLabel: 'SkillHub — về màn chào',
      onTap: () => context.go('/'),
      child: const BrandLogo(),
    );
    return Scaffold(
      backgroundColor: Palette.cream,
      body: SafeArea(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (wide) _Aside(logo: logo),
            Expanded(
              child: LayoutBuilder(
                builder: (context, constraints) => SingleChildScrollView(
                  keyboardDismissBehavior:
                      ScrollViewKeyboardDismissBehavior.onDrag,
                  padding: EdgeInsets.fromLTRB(
                    wide ? 48 : Layout.gutter,
                    wide ? 48 : 32,
                    wide ? 48 : Layout.gutter,
                    wide ? 48 : 32,
                  ),
                  child: ConstrainedBox(
                    constraints: BoxConstraints(
                      minHeight: wide ? constraints.maxHeight - 96 : 0,
                    ),
                    child: Align(
                      alignment: wide ? Alignment.center : Alignment.topCenter,
                      child: ConstrainedBox(
                        constraints: const BoxConstraints(maxWidth: 448),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            if (!wide)
                              Padding(
                                padding: const EdgeInsets.only(bottom: 24),
                                child: Align(
                                  alignment: Alignment.centerLeft,
                                  child: logo,
                                ),
                              ),
                            Semantics(
                              header: true,
                              child: Text(
                                title,
                                style: nunito(
                                  (26, 32),
                                  weight: FontWeight.w700,
                                  color: Palette.ink,
                                ),
                              ),
                            ),
                            const SizedBox(height: 8),
                            Text(
                              subtitle,
                              style: nunito((16, 24), color: Palette.muted),
                            ),
                            const SizedBox(height: 24),
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              spacing: 12,
                              children: children,
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Aside extends StatelessWidget {
  const _Aside({required this.logo});

  final Widget logo;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 360,
      padding: const EdgeInsets.all(40),
      color: Palette.sageLight,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          logo,
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            spacing: 24,
            children: [
              Container(
                width: 64,
                height: 4,
                decoration: BoxDecoration(
                  color: Palette.brand,
                  borderRadius: BorderRadius.circular(4),
                ),
              ),
              Text(
                '"Chia sẻ điều bạn biết.\nHọc điều bạn muốn."',
                style: nunito(
                  (22, 30),
                  weight: FontWeight.w600,
                  color: Palette.ink,
                ),
              ),
              Row(
                spacing: 12,
                children: [
                  Padding(
                    padding: const EdgeInsets.only(left: 8),
                    child: SizedBox(
                      width: 32 + 24.0 * (_community.length - 1),
                      height: 32,
                      child: Stack(
                        children: [
                          for (var i = 0; i < _community.length; i++)
                            Positioned(
                              left: 24.0 * i,
                              child: Container(
                                width: 32,
                                height: 32,
                                alignment: Alignment.center,
                                decoration: BoxDecoration(
                                  color: _community[i].$2,
                                  shape: BoxShape.circle,
                                  border: Border.all(
                                    color: Palette.sageLight,
                                    width: 2,
                                  ),
                                ),
                                child: Text(
                                  _community[i].$1,
                                  style: const TextStyle(
                                    fontFamily: Fonts.nunito,
                                    fontWeight: FontWeight.w700,
                                    fontSize: 12,
                                    color: Palette.white,
                                  ),
                                ),
                              ),
                            ),
                        ],
                      ),
                    ),
                  ),
                  Flexible(
                    child: Text(
                      '+12.000 người dùng đang học',
                      style: nunito(TypeScale.body, color: Palette.muted),
                    ),
                  ),
                ],
              ),
            ],
          ),
          Text(
            '© 2024 SkillHub. Tất cả quyền được bảo lưu.',
            style: nunito(TypeScale.secondary, color: Palette.body),
          ),
        ],
      ),
    );
  }
}

TextStyle get authLinkStyle =>
    nunito(TypeScale.body, weight: FontWeight.w600, color: Palette.brand);

TextStyle get authFooterStyle => nunito(TypeScale.body, color: Palette.muted);

/// Footer line such as "Chưa có tài khoản? Đăng ký".
class AuthFooterLink extends StatelessWidget {
  const AuthFooterLink({
    super.key,
    required this.prefix,
    required this.link,
    required this.onTap,
    this.topPadding = 8,
  });

  final String prefix;
  final String link;
  final VoidCallback onTap;
  final double topPadding;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(top: topPadding),
      child: Wrap(
        alignment: WrapAlignment.center,
        crossAxisAlignment: WrapCrossAlignment.center,
        children: [
          if (prefix.isNotEmpty) Text(prefix, style: authFooterStyle),
          Tappable(
            link: true,
            onTap: onTap,
            child: Text(link, style: authLinkStyle),
          ),
        ],
      ),
    );
  }
}

class PasswordRequirements extends StatelessWidget {
  const PasswordRequirements({super.key, required this.password});

  final String password;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final columns = constraints.maxWidth >= 296 ? 2 : 1;
          final width = (constraints.maxWidth - 8 * (columns - 1)) / columns;
          return Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final rule in passwordRequirements(password))
                SizedBox(
                  width: width,
                  child: Row(
                    spacing: 6,
                    children: [
                      Container(
                        width: 12,
                        height: 12,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color: rule.met ? Palette.success : Palette.border,
                          shape: BoxShape.circle,
                        ),
                        child: rule.met
                            ? const AppIcon(
                                AppIcon.check,
                                size: 8,
                                color: Palette.white,
                              )
                            : null,
                      ),
                      Flexible(
                        child: Text(
                          rule.label,
                          style: nunito(
                            TypeScale.secondary,
                            color: rule.met ? Palette.success : Palette.muted,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
            ],
          );
        },
      ),
    );
  }
}
