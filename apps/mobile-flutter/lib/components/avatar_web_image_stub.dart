import 'package:flutter/widgets.dart';

/// Non-web fallback (IO / tests). Prefer [Avatar]'s ClipOval path instead.
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
    return Image.network(
      url,
      key: ValueKey('$viewKey|$url'),
      fit: BoxFit.cover,
      gaplessPlayback: true,
      errorBuilder: (_, _, _) {
        if (onError != null) {
          WidgetsBinding.instance.addPostFrameCallback((_) => onError!());
        }
        return const SizedBox.shrink();
      },
    );
  }
}
