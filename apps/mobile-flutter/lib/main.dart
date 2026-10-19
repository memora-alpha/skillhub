import 'package:device_preview/device_preview.dart';
import 'package:device_preview/presets.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app.dart';

/// Draws the app inside a phone frame; enable with
/// `--dart-define=DEVICE_PREVIEW=true` (never active in release builds).
const _devicePreview = bool.fromEnvironment('DEVICE_PREVIEW');

Future<void> main() async {
  if (_devicePreview) {
    DevicePreview.enable();
    await DevicePreview.maybeController?.applyPreset(DevicePresets.pixel9);
  }
  WidgetsFlutterBinding.ensureInitialized();
  runApp(ProviderScope(retry: (_, _) => null, child: const SkillHubApp()));
}
