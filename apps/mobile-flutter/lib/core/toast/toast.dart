import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../components/app_icon.dart';
import '../theme/tokens.dart';

enum ToastTone { success, error, info }

class ToastMessage {
  const ToastMessage(this.id, this.message, this.tone);

  final int id;
  final String message;
  final ToastTone tone;
}

class ToastNotifier extends Notifier<ToastMessage?> {
  Timer? _timer;
  int _nextId = 0;

  @override
  ToastMessage? build() {
    ref.onDispose(() => _timer?.cancel());
    return null;
  }

  void show(String message, [ToastTone tone = ToastTone.info]) {
    if (message.trim().isEmpty) return;
    _timer?.cancel();
    state = ToastMessage(++_nextId, message, tone);
    _timer = Timer(
      Duration(seconds: tone == ToastTone.error ? 7 : 5),
      dismiss,
    );
  }

  void dismiss() {
    _timer?.cancel();
    state = null;
  }
}

final toastProvider = NotifierProvider<ToastNotifier, ToastMessage?>(
  ToastNotifier.new,
);

const _toneColors = {
  ToastTone.success: (Palette.success, Palette.successLight, AppIcon.check),
  ToastTone.error: (Palette.error, Palette.errorLight, AppIcon.alert),
  ToastTone.info: (Palette.brand, Palette.brandLight, AppIcon.bell),
};

class ToastHost extends ConsumerWidget {
  const ToastHost({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final toast = ref.watch(toastProvider);
    return Positioned(
      top: 0,
      left: 0,
      right: 0,
      child: SafeArea(
        bottom: false,
        child: Padding(
          padding: const EdgeInsets.only(top: 12),
          child: AnimatedSwitcher(
            duration: MediaQuery.disableAnimationsOf(context)
                ? Duration.zero
                : const Duration(milliseconds: 200),
            child: toast == null
                ? const SizedBox.shrink()
                : _ToastCard(
                    key: ValueKey(toast.id),
                    toast: toast,
                    onDismiss: ref.read(toastProvider.notifier).dismiss,
                  ),
          ),
        ),
      ),
    );
  }
}

class _ToastCard extends StatelessWidget {
  const _ToastCard({super.key, required this.toast, required this.onDismiss});

  final ToastMessage toast;
  final VoidCallback onDismiss;

  @override
  Widget build(BuildContext context) {
    final (foreground, background, icon) = _toneColors[toast.tone]!;
    final width = MediaQuery.sizeOf(context).width;
    return Center(
      child: Semantics(
        liveRegion: true,
        child: Container(
          width: (width - 32).clamp(0, 448).toDouble(),
          constraints: const BoxConstraints(minHeight: 64),
          padding: const EdgeInsets.only(left: 12, top: 12, bottom: 12),
          decoration: BoxDecoration(
            color: Palette.white,
            borderRadius: BorderRadius.circular(AppRadii.card),
            border: Border.all(color: Palette.border),
            boxShadow: Shadows.toast,
          ),
          child: Row(
            children: [
              Container(
                width: AvatarSizes.compact,
                height: AvatarSizes.compact,
                decoration: BoxDecoration(
                  color: background,
                  shape: BoxShape.circle,
                ),
                alignment: Alignment.center,
                child: AppIcon(icon, size: IconSizes.control, color: foreground),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  toast.message,
                  style: nunito(
                    TypeScale.body,
                    weight: FontWeight.w600,
                    color: Palette.inkSoft,
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.only(right: 8, left: 4),
                child: Semantics(
                  button: true,
                  label: 'Đóng thông báo',
                  child: InkResponse(
                    onTap: onDismiss,
                    radius: 22,
                    highlightColor: Palette.sand,
                    child: const SizedBox(
                      width: 44,
                      height: 44,
                      child: Center(
                        child: AppIcon(
                          AppIcon.close,
                          size: IconSizes.inline,
                          color: Palette.muted,
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
