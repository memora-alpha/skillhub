import 'package:flutter/widgets.dart';

/// Pressable surface that dims while pressed or disabled.
class Tappable extends StatefulWidget {
  const Tappable({
    super.key,
    required this.child,
    this.onTap,
    this.disabled = false,
    this.pressedOpacity = 0.75,
    this.disabledOpacity,
    this.semanticLabel,
    this.button = true,
    this.link = false,
  });

  final Widget child;
  final VoidCallback? onTap;
  final bool disabled;
  final double pressedOpacity;
  final double? disabledOpacity;
  final String? semanticLabel;
  final bool button;
  final bool link;

  @override
  State<Tappable> createState() => _TappableState();
}

class _TappableState extends State<Tappable> {
  bool _pressed = false;

  void _set(bool value) {
    if (_pressed != value) setState(() => _pressed = value);
  }

  @override
  Widget build(BuildContext context) {
    final inactive = widget.disabled || widget.onTap == null;
    final opacity = widget.disabled
        ? (widget.disabledOpacity ?? widget.pressedOpacity)
        : _pressed
        ? widget.pressedOpacity
        : 1.0;
    return Semantics(
      button: widget.button && !widget.link,
      link: widget.link,
      enabled: !inactive,
      label: widget.semanticLabel,
      child: MouseRegion(
        cursor: inactive ? MouseCursor.defer : SystemMouseCursors.click,
        child: GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTapDown: inactive ? null : (_) => _set(true),
          onTapUp: inactive ? null : (_) => _set(false),
          onTapCancel: inactive ? null : () => _set(false),
          onTap: inactive ? null : widget.onTap,
          child: Opacity(opacity: opacity, child: widget.child),
        ),
      ),
    );
  }
}
