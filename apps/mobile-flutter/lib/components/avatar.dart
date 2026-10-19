import 'dart:typed_data';

import 'package:flutter/widgets.dart';

import '../core/theme/tokens.dart';

const _palette = [
  (Color(0xFFFFE3D5), Color(0xFF9A3D20)),
  (Color(0xFFDDF3E7), Color(0xFF21634A)),
  (Color(0xFFDDEBFA), Color(0xFF285B8A)),
  (Color(0xFFEDE1FA), Color(0xFF69418A)),
  (Color(0xFFFFF0C7), Color(0xFF785B12)),
];

/// 32-bit multiply that stays exact on the web, where ints are doubles.
int _imul(int a, int b) {
  final aHi = (a >> 16) & 0xffff;
  final aLo = a & 0xffff;
  final bHi = (b >> 16) & 0xffff;
  final bLo = b & 0xffff;
  return (aLo * bLo + (((aHi * bLo + aLo * bHi) & 0xffff) << 16)) &
      0xffffffff;
}

(Color, Color) avatarColors(String key) {
  if (key.startsWith('demo-user:')) return _palette[0];
  var hash = 2166136261;
  for (final rune in key.runes) {
    hash = _imul((hash ^ rune) & 0xffffffff, 16777619);
  }
  return _palette[hash % _palette.length];
}

String initialsOf(String name) => name
    .trim()
    .split(RegExp(r'\s+'))
    .where((word) => word.isNotEmpty)
    .take(2)
    .map((word) => String.fromCharCode(word.runes.first))
    .join()
    .toUpperCase();

class Avatar extends StatelessWidget {
  const Avatar({
    super.key,
    required this.name,
    this.userId,
    this.size = AvatarSizes.list,
    this.imageUrl,
    this.imageBytes,
  });

  final String name;
  final String? userId;
  final double size;
  final String? imageUrl;
  final Uint8List? imageBytes;

  @override
  Widget build(BuildContext context) {
    final (background, foreground) = avatarColors(
      userId ?? name.trim().toLowerCase(),
    );
    final initialSize = (size * 0.35).roundToDouble().clamp(9.0, 24.0);
    final initials = Center(
      child: Text(
        initialsOf(name),
        maxLines: 1,
        textAlign: TextAlign.center,
        style: TextStyle(
          fontFamily: Fonts.nunito,
          fontWeight: FontWeight.w700,
          fontSize: initialSize,
          height: (initialSize * 1.2).ceilToDouble() / initialSize,
          color: foreground,
        ),
      ),
    );
    Widget child = initials;
    if (imageBytes != null) {
      child = Image.memory(imageBytes!, fit: BoxFit.cover);
    } else if (imageUrl != null) {
      child = Image.network(
        imageUrl!,
        fit: BoxFit.cover,
        gaplessPlayback: true,
        errorBuilder: (_, _, _) => initials,
      );
    }
    return ClipOval(
      child: Container(
        width: size,
        height: size,
        color: background,
        child: child,
      ),
    );
  }
}
