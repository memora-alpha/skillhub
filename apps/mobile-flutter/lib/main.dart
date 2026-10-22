import 'package:device_preview/device_preview.dart';
import 'package:device_preview/presets.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app.dart';

/// Phone frame in debug and profile builds. Pass
/// `--dart-define=DEVICE_PREVIEW=false` to turn it off.
const _devicePreview = bool.fromEnvironment(
  'DEVICE_PREVIEW',
  defaultValue: true,
);

Future<void> main() async {
  if (_devicePreview && !kReleaseMode) {
    DevicePreview.enable();
    await DevicePreview.maybeController?.applyPreset(DevicePresets.pixel9);
  }
  WidgetsFlutterBinding.ensureInitialized();
  runApp(ProviderScope(retry: (_, _) => null, child: const SkillHubApp()));
}
