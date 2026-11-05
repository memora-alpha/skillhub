import 'package:flutter/material.dart';

import '../../components/app_icon.dart';
import '../../components/app_input.dart';
import '../../components/tappable.dart';
import '../../core/theme/tokens.dart';

/// Colors for the learning-request editor — cloned from RN `requestFormColors`.
abstract final class RequestFormColors {
  static const accent = Chrome.accent;
  static const canvas = AppColors.canvas;
  static const surface = AppColors.surface;
  static const surfaceLow = AppColors.surfaceLow;
  static const surfaceInset = AppColors.surfaceInset;
  static const amberSoft = AppColors.amberSoft;
  static const primary = AppColors.primary;
  static const primaryMuted = AppColors.primaryMuted;
  static const forest = AppColors.forest;
  static const forestSoft = AppColors.forestSoft;
  static const amber = AppColors.amber;
  static const ink = AppColors.ink;
  static const body = AppColors.body;
  static const muted = AppColors.muted;
  static const mutedLight = AppColors.mutedLight;
  static const border = AppColors.border;
  static const error = AppColors.error;
  static const white = AppColors.white;
}

TextStyle get requestLabelStyle => nunito(
  (14, 21),
  weight: FontWeight.w600,
  color: RequestFormColors.ink,
);

TextStyle get requestHintStyle =>
    nunito((12, 18), color: RequestFormColors.muted);

TextStyle get requestSectionTitleStyle => nunito(
  TypeScale.heading,
  weight: FontWeight.w700,
  color: RequestFormColors.ink,
);

/// Section card matching RN `RequestSection` (compact).
class RequestSection extends StatefulWidget {
  const RequestSection({
    super.key,
    required this.title,
    required this.children,
    this.icon,
    this.tone = RequestSectionTone.primary,
    this.subtitle,
    this.compact = true,
    this.collapsible = false,
    this.summary,
    this.hasError = false,
    this.disabled = false,
  });

  final String title;
  final List<Widget> children;
  final String? icon;
  final RequestSectionTone tone;
  final String? subtitle;
  final bool compact;
  final bool collapsible;
  final String? summary;
  final bool hasError;
  final bool disabled;

  @override
  State<RequestSection> createState() => _RequestSectionState();
}

enum RequestSectionTone { primary, forest, amber }

class _RequestSectionState extends State<RequestSection> {
  var _open = false;

  Color get _toneColor => switch (widget.tone) {
    RequestSectionTone.forest => RequestFormColors.forest,
    RequestSectionTone.amber => RequestFormColors.amber,
    RequestSectionTone.primary => RequestFormColors.primary,
  };

  Color get _toneSoft => switch (widget.tone) {
    RequestSectionTone.forest => RequestFormColors.forestSoft,
    RequestSectionTone.amber ||
    RequestSectionTone.primary => RequestFormColors.amberSoft,
  };

  @override
  Widget build(BuildContext context) {
    final expanded = !widget.collapsible || _open || widget.hasError;
    final caption = expanded ? widget.subtitle : widget.summary;
    final padding = widget.compact ? 16.0 : 18.0;
    final gap = widget.compact ? 12.0 : 18.0;

    final header = Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      spacing: 10,
      children: [
        if (widget.icon != null)
          Container(
            width: 32,
            height: 32,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: _toneSoft,
              borderRadius: BorderRadius.circular(12),
            ),
            child: AppIcon(widget.icon!, size: 18, color: _toneColor),
          ),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            spacing: 2,
            children: [
              Semantics(
                header: true,
                child: Text(widget.title, style: requestSectionTitleStyle),
              ),
              if (caption != null && caption.isNotEmpty)
                Text(
                  caption,
                  style: nunito(
                    TypeScale.caption,
                    color: RequestFormColors.muted,
                  ),
                ),
            ],
          ),
        ),
        if (widget.collapsible)
          Transform.rotate(
            angle: expanded ? 1.5708 : 0,
            child: const AppIcon(
              AppIcon.chevron,
              size: 18,
              color: RequestFormColors.muted,
            ),
          ),
      ],
    );

    return Container(
      padding: EdgeInsets.all(padding),
      decoration: BoxDecoration(
        color: RequestFormColors.surface,
        borderRadius: BorderRadius.circular(
          widget.compact ? AppRadii.card : AppRadii.feature,
        ),
        border: Border.all(color: RequestFormColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        spacing: gap,
        children: [
          if (widget.collapsible)
            Tappable(
              onTap: widget.disabled
                  ? null
                  : () => setState(() => _open = !expanded),
              semanticLabel: widget.title,
              child: ConstrainedBox(
                constraints: const BoxConstraints(minHeight: 48),
                child: Padding(
                  padding: EdgeInsets.only(bottom: expanded ? 12 : 0),
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      border: expanded
                          ? const Border(
                              bottom: BorderSide(
                                color: RequestFormColors.surfaceInset,
                              ),
                            )
                          : null,
                    ),
                    child: header,
                  ),
                ),
              ),
            )
          else
            DecoratedBox(
              decoration: const BoxDecoration(
                border: Border(
                  bottom: BorderSide(color: RequestFormColors.surfaceInset),
                ),
              ),
              child: Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: header,
              ),
            ),
          if (expanded)
            Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              spacing: gap,
              children: widget.children,
            ),
        ],
      ),
    );
  }
}

/// Text field chrome matching RN `RequestTextField`.
class RequestTextField extends StatelessWidget {
  const RequestTextField({
    super.key,
    required this.field,
    required this.label,
    this.required = false,
    this.hint,
    this.placeholder,
    this.multiline = false,
    this.editable = true,
    this.keyboardType,
    this.textInputAction,
  });

  final AppField field;
  final String label;
  final bool required;
  final String? hint;
  final String? placeholder;
  final bool multiline;
  final bool editable;
  final TextInputType? keyboardType;
  final TextInputAction? textInputAction;

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: field,
      builder: (context, _) {
        final error = field.error;
        final focused = field.focus.hasFocus;
        final borderColor = error != null
            ? RequestFormColors.error
            : focused
            ? RequestFormColors.accent
            : RequestFormColors.border;
        final background = focused
            ? RequestFormColors.surface
            : RequestFormColors.canvas;
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          spacing: 6,
          children: [
            Text.rich(
              TextSpan(
                text: label,
                style: requestLabelStyle,
                children: [
                  if (required)
                    const TextSpan(
                      text: ' *',
                      style: TextStyle(color: RequestFormColors.accent),
                    ),
                ],
              ),
            ),
            AnimatedContainer(
              duration: const Duration(milliseconds: 120),
              constraints: BoxConstraints(minHeight: multiline ? 80 : 48),
              decoration: BoxDecoration(
                color: background,
                borderRadius: BorderRadius.circular(AppRadii.card),
                border: Border.all(color: borderColor),
              ),
              child: Opacity(
                opacity: editable ? 1 : 0.6,
                child: TextField(
                  controller: field.controller,
                  focusNode: field.focus,
                  readOnly: !editable,
                  keyboardType: multiline
                      ? TextInputType.multiline
                      : keyboardType,
                  textInputAction: textInputAction,
                  minLines: multiline ? 4 : 1,
                  maxLines: multiline ? null : 1,
                  cursorColor: RequestFormColors.accent,
                  style: nunito((14, 21), color: RequestFormColors.ink),
                  textAlignVertical: TextAlignVertical.top,
                  decoration: InputDecoration(
                    isCollapsed: true,
                    border: InputBorder.none,
                    hintText: placeholder,
                    hintStyle: nunito(
                      (14, 21),
                      color: RequestFormColors.mutedLight,
                    ),
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: 14,
                      vertical: 12,
                    ),
                  ),
                ),
              ),
            ),
            if (error != null)
              Text(
                error,
                style: requestHintStyle.copyWith(color: RequestFormColors.error),
              )
            else if (hint != null && focused)
              Text(
                hint!,
                textAlign: multiline ? TextAlign.right : TextAlign.left,
                style: requestHintStyle,
              ),
          ],
        );
      },
    );
  }
}

/// Paper trigger matching RN skill/offering picker buttons.
class RequestPaperButton extends StatelessWidget {
  const RequestPaperButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.disabled = false,
    this.trailingChevron = false,
    this.expanded = false,
  });

  final String label;
  final VoidCallback? onPressed;
  final bool disabled;
  final bool trailingChevron;
  final bool expanded;

  @override
  Widget build(BuildContext context) {
    return Tappable(
      onTap: disabled ? null : onPressed,
      semanticLabel: label,
      child: Container(
        constraints: const BoxConstraints(minHeight: 48),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: RequestFormColors.surfaceInset,
          borderRadius: BorderRadius.circular(AppRadii.card),
          border: Border.all(color: RequestFormColors.border),
        ),
        child: Row(
          children: [
            Expanded(
              child: Text(
                label,
                style: nunito(
                  (14, 20),
                  weight: FontWeight.w600,
                  color: RequestFormColors.forest,
                ),
              ),
            ),
            if (trailingChevron)
              Transform.rotate(
                angle: expanded ? 1.5708 : 0,
                child: const AppIcon(
                  AppIcon.chevron,
                  size: 18,
                  color: RequestFormColors.muted,
                ),
              ),
          ],
        ),
      ),
    );
  }
}

/// Sticky editor footer matching RN `requestFormStyles.footer`.
class RequestEditorFooter extends StatelessWidget {
  const RequestEditorFooter({
    super.key,
    required this.label,
    required this.onPressed,
    this.loading = false,
    this.hint,
  });

  final String label;
  final VoidCallback? onPressed;
  final bool loading;
  final String? hint;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: RequestFormColors.surface,
      child: DecoratedBox(
        decoration: const BoxDecoration(
          border: Border(top: BorderSide(color: RequestFormColors.border)),
        ),
        child: SafeArea(
          top: false,
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 640),
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  spacing: 8,
                  children: [
                    Tappable(
                      onTap: loading ? null : onPressed,
                      disabled: loading,
                      disabledOpacity: 1,
                      semanticLabel: label,
                      child: Container(
                        constraints: const BoxConstraints(minHeight: 48),
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color: RequestFormColors.accent,
                          borderRadius: BorderRadius.circular(AppRadii.card),
                        ),
                        child: loading
                            ? Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                spacing: 8,
                                children: [
                                  const SizedBox(
                                    width: 16,
                                    height: 16,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                      color: RequestFormColors.white,
                                    ),
                                  ),
                                  Text(
                                    label,
                                    style: nunito(
                                      (14, 20),
                                      weight: FontWeight.w600,
                                      color: RequestFormColors.white,
                                    ),
                                  ),
                                ],
                              )
                            : Text(
                                label,
                                style: nunito(
                                  (14, 20),
                                  weight: FontWeight.w600,
                                  color: RequestFormColors.white,
                                ),
                              ),
                      ),
                    ),
                    if (hint != null)
                      Text(
                        hint!,
                        textAlign: TextAlign.center,
                        style: requestHintStyle,
                      ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
