import 'package:flutter/widgets.dart';

import '../core/theme/tokens.dart';
import 'app_button.dart';
import 'app_icon.dart';
import 'tappable.dart';

class BrandLogo extends StatelessWidget {
  const BrandLogo({
    super.key,
    this.compact = false,
    this.small = false,
    this.markOnly = false,
    this.home = false,
  });

  final bool compact;
  final bool small;
  final bool markOnly;
  final bool home;

  @override
  Widget build(BuildContext context) {
    final markSize = home ? 36.0 : (compact ? 28.0 : 32.0);
    final mark = Container(
      width: markSize,
      height: markSize,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: home ? Chrome.accent : Palette.brand,
        borderRadius: BorderRadius.circular(home ? 12 : (compact ? 8 : 12)),
      ),
      child: Text(
        'S',
        style: home
            ? fraunces(20, 24, weight: FontWeight.w700, color: Palette.white)
            : const TextStyle(
                fontFamily: Fonts.nunito,
                fontWeight: FontWeight.w900,
                fontSize: 14,
                color: Palette.white,
              ),
      ),
    );
    if (markOnly) return mark;
    final wordSize = compact ? 16.0 : (small || home ? 18.0 : 24.0);
    final wordStyle = home
        ? TextStyle(
            fontFamily: Fonts.nunito,
            fontWeight: FontWeight.w700,
            fontSize: wordSize,
            color: Chrome.ink,
          )
        : TextStyle(
            fontFamily: Fonts.fraunces,
            fontWeight: FontWeight.w700,
            fontSize: wordSize,
            color: Palette.ink,
          );
    final accent = home
        ? Chrome.accent
        : compact
        ? null
        : Palette.brand;
    return Row(
      mainAxisSize: MainAxisSize.min,
      spacing: 8,
      children: [
        mark,
        Text.rich(
          TextSpan(
            text: 'Skill',
            children: [
              TextSpan(
                text: 'Hub',
                style: accent == null ? null : TextStyle(color: accent),
              ),
            ],
          ),
          style: wordStyle,
        ),
      ],
    );
  }
}

enum NoticeTone { error, success, info }

class FormNotice extends StatelessWidget {
  const FormNotice({super.key, required this.tone, required this.message});

  final NoticeTone tone;
  final String message;

  @override
  Widget build(BuildContext context) {
    final (foreground, border, background) = switch (tone) {
      NoticeTone.success => (
        Palette.success,
        const Color(0xFFA3D4B9),
        Palette.successLight,
      ),
      NoticeTone.info => (Palette.inkSoft, Palette.border, Palette.sand),
      NoticeTone.error => (
        Palette.error,
        const Color(0xFFF0A0A0),
        Palette.errorLight,
      ),
    };
    return Semantics(
      liveRegion: true,
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: background,
          border: Border.all(color: border),
          borderRadius: BorderRadius.circular(Radii.control),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          spacing: 10,
          children: [
            Padding(
              padding: const EdgeInsets.only(top: 3),
              child: AppIcon(
                tone == NoticeTone.success
                    ? AppIcon.checkCircle
                    : AppIcon.alert,
                size: 16,
                color: foreground,
              ),
            ),
            Expanded(
              child: Text(
                message,
                style: nunito(TypeScale.body, color: foreground),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

enum BadgeVariant { neutral, success, warning, sage }

class AppBadge extends StatelessWidget {
  const AppBadge({
    super.key,
    required this.label,
    this.variant = BadgeVariant.neutral,
  });

  final String label;
  final BadgeVariant variant;

  @override
  Widget build(BuildContext context) {
    final (background, foreground) = switch (variant) {
      BadgeVariant.neutral => (AppColors.surfaceInset, AppColors.body),
      BadgeVariant.success => (AppColors.successSoft, AppColors.success),
      BadgeVariant.warning => (AppColors.amberSoft, AppColors.amber),
      BadgeVariant.sage => (AppColors.forestSoft, AppColors.forest),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 2),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(AppRadii.badge),
      ),
      child: Text(
        label,
        style: nunito(
          TypeScale.secondary,
          weight: FontWeight.w600,
          color: foreground,
        ),
      ),
    );
  }
}

class EmptyState extends StatelessWidget {
  const EmptyState({
    super.key,
    required this.title,
    required this.description,
    this.icon = AppIcon.search,
    this.action,
    this.onAction,
  });

  final String title;
  final String description;
  final String icon;
  final String? action;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        spacing: 12,
        children: [
          AppIcon(icon, size: 32, color: AppColors.muted),
          Semantics(
            header: true,
            child: Text(
              title,
              textAlign: TextAlign.center,
              style: fraunces(18, 26, color: AppColors.ink),
            ),
          ),
          Text(
            description,
            textAlign: TextAlign.center,
            style: nunito(TypeScale.body, color: AppColors.muted),
          ),
          if (action != null && onAction != null)
            AppButton(
              label: action,
              variant: ButtonVariant.paper,
              onPressed: onAction,
            ),
        ],
      ),
    );
  }
}

class ActionGroup extends StatelessWidget {
  const ActionGroup({super.key, required this.title, required this.children});

  final String title;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: 8,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 4),
          child: Semantics(
            header: true,
            child: Text(
              title,
              style: nunito(
                TypeScale.secondary,
                weight: FontWeight.w600,
                color: AppColors.inkSoft,
              ),
            ),
          ),
        ),
        Container(
          clipBehavior: Clip.antiAlias,
          decoration: BoxDecoration(
            color: AppColors.surface,
            border: Border.all(color: AppColors.border),
            borderRadius: BorderRadius.circular(Radii.card),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              for (var index = 0; index < children.length; index++)
                DecoratedBox(
                  decoration: BoxDecoration(
                    border: index > 0
                        ? const Border(
                            top: BorderSide(color: AppColors.border),
                          )
                        : null,
                  ),
                  child: children[index],
                ),
            ],
          ),
        ),
      ],
    );
  }
}

class ActionRow extends StatelessWidget {
  const ActionRow({
    super.key,
    required this.icon,
    required this.label,
    this.description,
    this.onPressed,
    this.disabled = false,
    this.destructive = false,
  });

  final String icon;
  final String label;
  final String? description;
  final VoidCallback? onPressed;
  final bool disabled;
  final bool destructive;

  @override
  Widget build(BuildContext context) {
    final inactive = disabled || onPressed == null;
    return Tappable(
      onTap: inactive ? null : onPressed,
      disabled: inactive,
      pressedOpacity: 0.85,
      disabledOpacity: 0.5,
      semanticLabel: label,
      child: ConstrainedBox(
        constraints: const BoxConstraints(minHeight: 64),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(
            spacing: 12,
            children: [
              SizedBox(
                width: 32,
                height: 32,
                child: Center(
                  child: AppIcon(
                    icon,
                    size: 20,
                    color: destructive ? AppColors.error : AppColors.inkSoft,
                    filled: false,
                  ),
                ),
              ),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  spacing: 2,
                  children: [
                    Text(
                      label,
                      style: nunito(
                        TypeScale.body,
                        weight: FontWeight.w600,
                        color: destructive ? AppColors.error : AppColors.ink,
                      ),
                    ),
                    if (description != null)
                      Text(
                        description!,
                        style: nunito(
                          TypeScale.secondary,
                          color: AppColors.inkSoft,
                        ),
                      ),
                  ],
                ),
              ),
              if (onPressed != null)
                const AppIcon(AppIcon.chevron, size: 16, color: AppColors.muted),
            ],
          ),
        ),
      ),
    );
  }
}
