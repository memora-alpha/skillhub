import 'package:flutter/widgets.dart';

/// Public and auth palette.
abstract final class Palette {
  static const brand = Color(0xFFD4622A);
  static const brandHover = Color(0xFFB8521E);
  static const brandLight = Color(0xFFFEF0E8);
  static const brandMuted = Color(0xFFF5D4C0);
  static const brandSurface = Color(0xFFF6D3BA);
  static const sage = Color(0xFF3D6B5A);
  static const cream = Color(0xFFFFFCF8);
  static const white = Color(0xFFFFFFFF);
  static const ink = Color(0xFF1C1410);
  static const inkSoft = Color(0xFF3D2E24);
  static const body = Color(0xFF5C4A3A);
  static const muted = Color(0xFF8A7060);
  static const mutedLight = Color(0xFFBCA99A);
  static const border = Color(0xFFE2D9CE);
  static const borderDark = Color(0xFFC8BDB0);
  static const sand = Color(0xFFF7F1E9);
  static const success = Color(0xFF2E7D53);
  static const warning = Color(0xFFD4901A);
  static const star = Color(0xFFFBBF24);
  static const error = Color(0xFFC03030);
  static const errorLight = Color(0xFFFDEAEA);
  static const successLight = Color(0xFFE6F4ED);
  static const sageLight = Color(0xFFEAF2EE);
  static const warningLight = Color(0xFFFEF3DC);
  static const gold = Color(0xFFB8860B);
}

/// "Crafted Exchange" tokens used by the signed-in product surfaces.
abstract final class AppColors {
  static const primary = Color(0xFFBA4E36);
  static const primaryDark = Color(0xFF9A3721);
  static const primarySoft = Color(0xFFFFF2F0);
  static const primaryMuted = Color(0xFFFFDAD2);
  static const forest = Color(0xFF264E3F);
  static const forestSoft = Color(0xFFE7F2EC);
  static const forestMuted = Color(0xFFBDE9D5);
  static const amber = Color(0xFFD97736);
  static const amberSoft = Color(0xFFFFF1E7);
  static const canvas = Color(0xFFFCF9F3);
  static const surface = Color(0xFFFFFFFF);
  static const surfaceLow = Color(0xFFF6F3ED);
  static const surfaceInset = Color(0xFFEDE8DF);
  static const ink = Color(0xFF1C2520);
  static const body = Color(0xFF57423D);
  static const muted = Color(0xFF8A716C);
  static const mutedLight = Color(0xFFA9958F);
  static const border = Color(0xFFE2DCD2);
  static const success = Color(0xFF2D6A4F);
  static const successSoft = Color(0xFFE7F3EC);
  static const error = Color(0xFFBA1A1A);
  static const errorLight = Color(0xFFFFEFED);
  static const white = Color(0xFFFFFFFF);
  static const brand = primary;
  static const inkSoft = body;
  static const sage = forest;
  static const gold = amber;
}

/// Shared chrome for every signed-in screen: header, logo and bottom navigation.
abstract final class Chrome {
  static const background = Color(0xFFFCFAF7);
  static const surface = Color(0xFFFFFFFF);
  static const ink = Color(0xFF202521);
  static const muted = Color(0xFFAAA69F);
  static const border = Color(0xFFF0ECE6);
  static const accent = Color(0xFFEF653D);
}

abstract final class ProfileColors {
  static const background = Chrome.background;
  static const surface = Chrome.surface;
  static const ink = Chrome.ink;
  static const border = Chrome.border;
  static const accent = Chrome.accent;
  static const body = Color(0xFF5A5550);
  static const muted = Color(0xFF8D8881);
  static const mutedStrong = Color(0xFF77716B);
  static const neutral = Color(0xFFF5F4F2);
  static const verified = Color(0xFF24956C);
  static const verifiedSoft = Color(0xFFE7F8F1);
}

abstract final class Fonts {
  static const nunito = 'Nunito';
  static const fraunces = 'Fraunces';
}

/// Font size and line height pairs.
abstract final class TypeScale {
  static const caption = (11.0, 15.0);
  static const secondary = (13.0, 18.0);
  static const body = (15.0, 22.0);
  static const heading = (17.0, 24.0);
  static const title = (20.0, 28.0);
}

TextStyle nunito(
  (double, double) scale, {
  FontWeight weight = FontWeight.w400,
  Color color = Palette.ink,
  FontStyle style = FontStyle.normal,
}) => TextStyle(
  fontFamily: Fonts.nunito,
  fontSize: scale.$1,
  height: scale.$2 / scale.$1,
  fontWeight: weight,
  fontStyle: style,
  color: color,
);

TextStyle fraunces(
  double size,
  double lineHeight, {
  FontWeight weight = FontWeight.w600,
  Color color = Palette.ink,
}) => TextStyle(
  fontFamily: Fonts.fraunces,
  fontSize: size,
  height: lineHeight / size,
  fontWeight: weight,
  color: color,
);

abstract final class IconSizes {
  static const inline = 14.0;
  static const control = 18.0;
  static const navigation = 22.0;
  static const feature = 24.0;
}

abstract final class AvatarSizes {
  static const inline = 24.0;
  static const compact = 32.0;
  static const list = 40.0;
  static const profile = 64.0;
  static const edit = 96.0;
}

abstract final class Layout {
  static const gutter = 20.0;
  static const maxWidth = 1152.0;
  static const sectionPadding = 64.0;
  static const radius = 6.0;
}

abstract final class Radii {
  static const badge = 4.0;
  static const control = 6.0;
  static const card = 8.0;
}

abstract final class AppRadii {
  static const badge = 8.0;
  static const control = 8.0;
  static const card = 16.0;
  static const feature = 24.0;
}

abstract final class Shadows {
  static const md = [
    BoxShadow(color: Color(0x1A1C1410), offset: Offset(0, 4), blurRadius: 8),
  ];
  static const lg = [
    BoxShadow(color: Color(0x401C1410), offset: Offset(0, 16), blurRadius: 24),
  ];
  static const profileHero = [
    BoxShadow(color: Color(0x0A352B1F), offset: Offset(0, 3), blurRadius: 10),
  ];
  static const profileSection = [
    BoxShadow(color: Color(0x0A352B1F), offset: Offset(0, 2), blurRadius: 8),
  ];
  static const profileAction = [
    BoxShadow(color: Color(0x08352B1F), offset: Offset(0, 2), blurRadius: 6),
  ];
  static const toast = [
    BoxShadow(color: Color(0x1A1C1410), offset: Offset(0, 8), blurRadius: 24),
    BoxShadow(color: Color(0x0A1C1410), offset: Offset(0, 2), blurRadius: 6),
  ];
}
