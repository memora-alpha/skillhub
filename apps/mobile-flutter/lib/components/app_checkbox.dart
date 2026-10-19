import 'package:flutter/widgets.dart';

import '../core/theme/tokens.dart';
import 'app_icon.dart';

class AppCheckbox extends StatelessWidget {
  const AppCheckbox({
    super.key,
    required this.checked,
    required this.onChanged,
    required this.label,
    required this.child,
    this.error,
  });

  final bool checked;
  final ValueChanged<bool> onChanged;
  final String label;

  /// Usually a [Text] or [Text.rich]; tapping it toggles the box.
  final Widget child;
  final String? error;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      spacing: 4,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          spacing: 10,
          children: [
            Semantics(
              checked: checked,
              label: label,
              child: GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: () => onChanged(!checked),
                child: Padding(
                  padding: const EdgeInsets.only(top: 1),
                  child: Container(
                    width: 20,
                    height: 20,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: checked ? Palette.brand : null,
                      border: Border.all(
                        color: checked ? Palette.brand : Palette.borderDark,
                      ),
                      borderRadius: BorderRadius.circular(Radii.badge),
                    ),
                    child: checked
                        ? const AppIcon(
                            AppIcon.check,
                            size: 10,
                            color: Palette.white,
                          )
                        : null,
                  ),
                ),
              ),
            ),
            Flexible(
              child: GestureDetector(
                onTap: () => onChanged(!checked),
                child: DefaultTextStyle.merge(
                  style: nunito(TypeScale.body, color: Palette.inkSoft),
                  child: child,
                ),
              ),
            ),
          ],
        ),
        if (error != null)
          Padding(
            padding: const EdgeInsets.only(left: 30),
            child: Semantics(
              liveRegion: true,
              child: Text(
                error!,
                style: nunito(TypeScale.secondary, color: Palette.error),
              ),
            ),
          ),
      ],
    );
  }
}
