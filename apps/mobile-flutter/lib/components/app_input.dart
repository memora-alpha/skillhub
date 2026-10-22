import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../core/theme/tokens.dart';
import 'app_icon.dart';

/// Text, focus and "touched" state for one form field.
/// Errors appear after the first blur or submit, then follow every change.
class AppField extends ChangeNotifier {
  AppField({String text = '', this.validator})
    : controller = TextEditingController(text: text),
      focus = FocusNode() {
    controller.addListener(notifyListeners);
    focus.addListener(_onFocus);
  }

  final TextEditingController controller;
  final FocusNode focus;
  String? Function(String value)? validator;
  bool touched = false;

  String get text => controller.text;
  set text(String value) => controller.text = value;

  String? get error => touched ? validator?.call(text) : null;

  void _onFocus() {
    if (!focus.hasFocus) touched = true;
    notifyListeners();
  }

  /// Marks the field touched and returns its current error.
  String? validate() {
    touched = true;
    notifyListeners();
    return validator?.call(text);
  }

  void reset([String value = '']) {
    touched = false;
    controller.text = value;
  }

  @override
  void dispose() {
    controller.dispose();
    focus.dispose();
    super.dispose();
  }
}

/// Validates every field and focuses the first invalid one.
bool validateFields(List<AppField> fields) {
  AppField? firstInvalid;
  for (final field in fields) {
    if (field.validate() != null) firstInvalid ??= field;
  }
  firstInvalid?.focus.requestFocus();
  return firstInvalid == null;
}

class AppInput extends StatefulWidget {
  const AppInput({
    super.key,
    required this.field,
    required this.label,
    this.required = false,
    this.hint,
    this.placeholder,
    this.password = false,
    this.editable = true,
    this.multiline = false,
    this.keyboardType,
    this.textInputAction,
    this.textCapitalization = TextCapitalization.none,
    this.autofillHints,
    this.onChanged,
    this.onSubmitted,
    this.reserveMessageSpace = false,
    this.inputFormatters,
  });

  final AppField field;
  final String label;
  final bool required;
  final String? hint;
  final String? placeholder;
  final bool password;
  final bool editable;
  final bool multiline;
  final TextInputType? keyboardType;
  final TextInputAction? textInputAction;
  final TextCapitalization textCapitalization;
  final Iterable<String>? autofillHints;
  final ValueChanged<String>? onChanged;
  final VoidCallback? onSubmitted;
  final bool reserveMessageSpace;
  final List<TextInputFormatter>? inputFormatters;

  @override
  State<AppInput> createState() => _AppInputState();
}

class _AppInputState extends State<AppInput> {
  bool _visible = false;

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: widget.field,
      builder: (context, _) {
        final error = widget.field.error;
        final focused = widget.field.focus.hasFocus;
        final Color borderColor;
        final Color background;
        if (error != null) {
          borderColor = Palette.error;
          background = widget.editable ? Palette.white : Palette.sand;
        } else if (!widget.editable) {
          borderColor = Palette.border;
          background = Palette.sand;
        } else if (focused) {
          borderColor = Palette.brand;
          background = Palette.brandLight;
        } else {
          borderColor = Palette.border;
          background = Palette.white;
        }
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          spacing: 6,
          children: [
            Text.rich(
              TextSpan(
                text: widget.label,
                children: [
                  if (widget.required)
                    const TextSpan(
                      text: ' *',
                      style: TextStyle(color: Palette.brand),
                    ),
                ],
              ),
              style: nunito(
                TypeScale.body,
                weight: FontWeight.w600,
                color: Palette.inkSoft,
              ),
            ),
            Container(
              constraints: const BoxConstraints(minHeight: 48),
              decoration: BoxDecoration(
                color: background,
                border: Border.all(color: borderColor),
                borderRadius: BorderRadius.circular(Radii.control),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  Expanded(
                    child: TextField(
                      controller: widget.field.controller,
                      focusNode: widget.field.focus,
                      readOnly: !widget.editable,
                      obscureText: widget.password && !_visible,
                      enableSuggestions: !widget.password,
                      autocorrect: !widget.password,
                      keyboardType: widget.multiline
                          ? TextInputType.multiline
                          : widget.keyboardType,
                      textInputAction: widget.textInputAction,
                      textCapitalization: widget.textCapitalization,
                      autofillHints: widget.editable
                          ? widget.autofillHints
                          : null,
                      inputFormatters: widget.inputFormatters,
                      minLines: widget.multiline ? 4 : 1,
                      maxLines: widget.multiline ? null : 1,
                      onChanged: widget.onChanged,
                      onSubmitted: widget.onSubmitted == null
                          ? null
                          : (_) => widget.onSubmitted!(),
                      cursorColor: Palette.brand,
                      style: nunito(TypeScale.body, color: Palette.ink),
                      decoration: InputDecoration(
                        isCollapsed: true,
                        border: InputBorder.none,
                        hintText: widget.placeholder,
                        hintStyle: nunito(
                          TypeScale.body,
                          color: Palette.mutedLight,
                        ),
                        contentPadding: const EdgeInsets.symmetric(
                          horizontal: 16,
                          vertical: 13,
                        ),
                      ),
                    ),
                  ),
                  if (widget.password)
                    Semantics(
                      button: true,
                      label: _visible
                          ? 'Ẩn ${widget.label.toLowerCase()}'
                          : 'Hiện ${widget.label.toLowerCase()}',
                      child: GestureDetector(
                        behavior: HitTestBehavior.opaque,
                        onTap: () => setState(() => _visible = !_visible),
                        child: SizedBox(
                          width: 48,
                          height: 46,
                          child: Center(
                            child: AppIcon(
                              _visible ? AppIcon.eyeOff : AppIcon.eye,
                              size: 16,
                              color: Palette.muted,
                            ),
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ),
            if (widget.reserveMessageSpace || error != null || widget.hint != null)
              ConstrainedBox(
                constraints: BoxConstraints(
                  minHeight: widget.reserveMessageSpace ? 18 : 0,
                ),
                child: error != null
                    ? FieldError(error)
                    : widget.hint != null
                    ? Text(
                        widget.hint!,
                        style: nunito(TypeScale.secondary, color: Palette.muted),
                      )
                    : const SizedBox.shrink(),
              ),
          ],
        );
      },
    );
  }
}

class FieldError extends StatelessWidget {
  const FieldError(this.message, {super.key});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      liveRegion: true,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        spacing: 6,
        children: [
          const Padding(
            padding: EdgeInsets.only(top: 3),
            child: AppIcon(AppIcon.alert, size: 12, color: Palette.error),
          ),
          Expanded(
            child: Text(
              message,
              style: nunito(TypeScale.secondary, color: Palette.error),
            ),
          ),
        ],
      ),
    );
  }
}
