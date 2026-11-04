import 'package:flutter/widgets.dart';
import 'package:web/web.dart' as web;

/// Round avatar via CSS on an HTML &lt;img&gt; — avoids Flutter [ClipOval] which
/// hides HtmlPlatformViews under CanvasKit / DevicePreview clips.
class AvatarWebImage extends StatelessWidget {
  const AvatarWebImage({
    super.key,
    required this.url,
    required this.viewKey,
    this.onError,
  });

  final String url;
  final String viewKey;
  final VoidCallback? onError;

  @override
  Widget build(BuildContext context) {
    return HtmlElementView.fromTagName(
      key: ValueKey('avatar-img:$viewKey|$url'),
      tagName: 'img',
      isVisible: true,
      onElementCreated: (Object element) {
        final img = element as web.HTMLImageElement;
        img
          ..src = url
          ..alt = ''
          ..draggable = false;
        img.style
          ..setProperty('width', '100%')
          ..setProperty('height', '100%')
          ..setProperty('object-fit', 'cover')
          ..setProperty('border-radius', '50%')
          ..setProperty('display', 'block')
          ..setProperty('pointer-events', 'none');
        img.onError.listen((_) {
          final callback = onError;
          if (callback == null) return;
          WidgetsBinding.instance.addPostFrameCallback((_) => callback());
        });
      },
    );
  }
}
