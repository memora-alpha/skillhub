import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/theme/tokens.dart';
import 'core/toast/toast.dart';
import 'features/auth/session/avatar_monitor.dart';
import 'features/auth/widgets/session_gate.dart';
import 'router.dart';

class SkillHubApp extends ConsumerWidget {
  const SkillHubApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(routerProvider);
    ref.listen(avatarMonitorProvider, (_, _) {});
    return MaterialApp.router(
      title: 'SkillHub',
      debugShowCheckedModeBanner: false,
      routerConfig: router,
      theme: ThemeData(
        fontFamily: Fonts.nunito,
        scaffoldBackgroundColor: Palette.cream,
        colorScheme: ColorScheme.fromSeed(
          seedColor: Palette.brand,
          primary: Palette.brand,
          surface: Palette.white,
        ),
        textSelectionTheme: TextSelectionThemeData(
          cursorColor: Palette.brand,
          selectionColor: Palette.brandMuted,
          selectionHandleColor: Palette.brand,
        ),
        splashFactory: NoSplash.splashFactory,
      ),
      builder: (context, child) => Material(
        type: MaterialType.transparency,
        child: Stack(
          fit: StackFit.expand,
          children: [
            SessionGate(child: child ?? const SizedBox.shrink()),
            const ToastHost(),
          ],
        ),
      ),
    );
  }
}
