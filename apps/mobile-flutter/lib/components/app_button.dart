import 'package:flutter/widgets.dart';

import '../core/theme/tokens.dart';
import 'tappable.dart';

enum ButtonVariant { primary, secondary, ghost, white, craft, forest, paper }

enum ButtonSize { sm, md, lg, xl }

const _foregrounds = {
  ButtonVariant.primary: Palette.white,
  ButtonVariant.secondary: Palette.inkSoft,
  ButtonVariant.ghost: Palette.inkSoft,
  ButtonVariant.white: Palette.brand,
  ButtonVariant.craft: Palette.white,
  ButtonVariant.forest: Palette.white,
  ButtonVariant.paper: AppColors.forest,
};

const _backgrounds = {
  ButtonVariant.primary: Palette.brand,
  ButtonVariant.secondary: Palette.sand,
  ButtonVariant.ghost: Color(0x00000000),
  ButtonVariant.white: Palette.white,
  ButtonVariant.craft: AppColors.primary,
  ButtonVariant.forest: AppColors.forest,
  ButtonVariant.paper: AppColors.surfaceInset,
};

const _labelSizes = {
  ButtonSize.sm: (14.0, 20.0),
  ButtonSize.md: (14.0, 20.0),
  ButtonSize.lg: (16.0, 24.0),
  ButtonSize.xl: (18.0, 28.0),
};

const _paddings = {
  ButtonSize.sm: EdgeInsets.symmetric(horizontal: 12, vertical: 6),
  ButtonSize.md: EdgeInsets.symmetric(horizontal: 20, vertical: 10),
  ButtonSize.lg: EdgeInsets.symmetric(horizontal: 24, vertical: 12),
  ButtonSize.xl: EdgeInsets.symmetric(horizontal: 32, vertical: 16),
};

class AppButton extends StatelessWidget {
  const AppButton({
    super.key,
    this.label,
    this.child,
    required this.onPressed,
    this.variant = ButtonVariant.primary,
    this.size = ButtonSize.md,
    this.disabled = false,
    this.backgroundColor,
    this.border,
    this.minHeight,
    this.semanticLabel,
  }) : assert(label != null || child != null);

  final String? label;
  final Widget? child;
  final VoidCallback? onPressed;
  final ButtonVariant variant;
  final ButtonSize size;
  final bool disabled;
  final Color? backgroundColor;
  final BoxBorder? border;
  final double? minHeight;
  final String? semanticLabel;

  static TextStyle labelStyle(ButtonVariant variant, ButtonSize size) =>
      nunito(
        _labelSizes[size]!,
        weight: FontWeight.w600,
        color: _foregrounds[variant]!,
      );

  @override
  Widget build(BuildContext context) {
    final content = child != null
        ? Row(
            mainAxisSize: MainAxisSize.min,
            mainAxisAlignment: MainAxisAlignment.center,
            spacing: 8,
            children: [child!],
          )
        : Text(
            label!,
            textAlign: TextAlign.center,
            style: labelStyle(variant, size),
          );
    return Tappable(
      onTap: onPressed,
      disabled: disabled,
      semanticLabel: semanticLabel ?? label,
      child: Container(
        constraints: BoxConstraints(minHeight: minHeight ?? 0),
        alignment: minHeight == null ? null : Alignment.center,
        padding: _paddings[size],
        decoration: BoxDecoration(
          color: backgroundColor ?? _backgrounds[variant],
          borderRadius: BorderRadius.circular(Layout.radius),
          border:
              border ??
              (variant == ButtonVariant.paper
                  ? Border.all(color: AppColors.border)
                  : null),
        ),
        child: content,
      ),
    );
  }
}
