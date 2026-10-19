import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../core/theme/tokens.dart';
import 'app_input.dart';

class OtpInput extends StatelessWidget {
  const OtpInput({
    super.key,
    required this.field,
    this.editable = true,
    this.onChanged,
    this.onSubmitted,
  });

  final AppField field;
  final bool editable;
  final ValueChanged<String>? onChanged;
  final VoidCallback? onSubmitted;

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: field,
      builder: (context, _) {
        final value = field.text;
        final error = field.error;
        final focused = field.focus.hasFocus;
        final active = math.min(value.length, 5);
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          spacing: 8,
          children: [
            Text.rich(
              const TextSpan(
                text: 'Mã xác minh ',
                children: [
                  TextSpan(
                    text: '*',
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
            Stack(
              children: [
                // One native input keeps paste, deletion and OS autofill intact.
                Positioned.fill(
                  child: Semantics(
                    label: 'Mã xác minh',
                    hint: error ?? 'Mã gồm 6 chữ số.',
                    child: TextField(
                      controller: field.controller,
                      focusNode: field.focus,
                      readOnly: !editable,
                      keyboardType: TextInputType.number,
                      textInputAction: TextInputAction.go,
                      autofillHints: const [AutofillHints.oneTimeCode],
                      autocorrect: false,
                      enableSuggestions: false,
                      showCursor: false,
                      enableInteractiveSelection: false,
                      inputFormatters: [
                        FilteringTextInputFormatter.digitsOnly,
                        LengthLimitingTextInputFormatter(6),
                      ],
                      onChanged: onChanged,
                      onSubmitted: onSubmitted == null
                          ? null
                          : (_) => onSubmitted!(),
                      style: const TextStyle(
                        color: Color(0x00000000),
                        fontSize: 20,
                      ),
                      decoration: const InputDecoration(
                        border: InputBorder.none,
                        isCollapsed: true,
                        contentPadding: EdgeInsets.symmetric(vertical: 16),
                      ),
                    ),
                  ),
                ),
                IgnorePointer(
                  child: ExcludeSemantics(
                    child: Row(
                      spacing: 8,
                      children: [
                        for (var index = 0; index < 6; index++)
                          Expanded(
                            child: _Cell(
                              digit: index < value.length ? value[index] : null,
                              editable: editable,
                              invalid: error != null,
                              active:
                                  focused &&
                                  editable &&
                                  error == null &&
                                  index == active,
                            ),
                          ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
            ConstrainedBox(
              constraints: const BoxConstraints(minHeight: 18),
              child: error == null ? const SizedBox.shrink() : FieldError(error),
            ),
          ],
        );
      },
    );
  }
}

class _Cell extends StatelessWidget {
  const _Cell({
    required this.digit,
    required this.editable,
    required this.invalid,
    required this.active,
  });

  final String? digit;
  final bool editable;
  final bool invalid;
  final bool active;

  @override
  Widget build(BuildContext context) {
    var border = digit != null ? Palette.borderDark : Palette.border;
    var background = editable ? Palette.white : Palette.sand;
    if (invalid) border = Palette.error;
    if (active) {
      border = Palette.brand;
      background = Palette.brandLight;
    }
    return Container(
      height: 56,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: background,
        border: Border.all(color: border),
        borderRadius: BorderRadius.circular(Radii.control),
      ),
      child: digit != null
          ? Text(
              digit!,
              style: nunito(
                TypeScale.title,
                weight: FontWeight.w700,
                color: Palette.ink,
              ).copyWith(fontFeatures: const [FontFeature.tabularFigures()]),
            )
          : Container(width: 12, height: 2, color: Palette.borderDark),
    );
  }
}
