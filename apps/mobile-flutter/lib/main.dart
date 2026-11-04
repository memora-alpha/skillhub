import 'package:device_preview/device_preview.dart';
import 'package:device_preview/presets.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app.dart';

/// Phone frame in debug and profile builds.
/// `--dart-define=MOBILEPREVIEW=true` (alias: `DEVICE_PREVIEW`).
const _devicePreview = bool.hasEnvironment('MOBILEPREVIEW')
    ? bool.fromEnvironment('MOBILEPREVIEW')
    : bool.fromEnvironment('DEVICE_PREVIEW', defaultValue: true);

Future<void> main() async {
  if (_devicePreview && !kReleaseMode) {
    // Replaces WidgetsFlutterBinding. Do not call ensureInitialized after this.
    DevicePreview.enable();
    await DevicePreview.maybeController?.applyPreset(DevicePresets.pixel9);
  } else {
    WidgetsFlutterBinding.ensureInitialized();
  }
  runApp(ProviderScope(retry: (_, _) => null, child: const SkillHubApp()));
}
