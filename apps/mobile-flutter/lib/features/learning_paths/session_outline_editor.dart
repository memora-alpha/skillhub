import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../components/app_button.dart';
import '../../components/app_icon.dart';
import '../../components/tappable.dart';
import '../../core/theme/tokens.dart';

({String title, String description}) sessionContentParts(String content) {
  final index = content.indexOf('\n');
  if (index < 0) return (title: content, description: '');
  return (
    title: content.substring(0, index).replaceAll('\r', ''),
    description: content.substring(index + 1),
  );
}

String sessionContentText(String title, String description) {
  final heading = title.replaceAll(RegExp(r'[\r\n]+'), ' ').trim();
  final detail = description.trim();
  return detail.isEmpty ? heading : '$heading\n$detail';
}

class SessionOutlineController extends ChangeNotifier {
  SessionOutlineController({
    List<String>? initial,
    this.minTitleLength = 1,
    this.maxSessions = 100,
    this.maxChars = 2000,
  }) {
    final seed = [
      for (final item in initial ?? const <String>[])
        if (item.trim().isNotEmpty) item.trim(),
    ];
    _sessions = [
      for (final content in seed.isEmpty ? const [''] : seed)
        SessionDraft(content),
    ];
    for (final session in _sessions) {
      session.title.addListener(notifyListeners);
      session.description.addListener(notifyListeners);
    }
    // Match RN: open the only empty session so the first step is obvious.
    if (_sessions.length == 1 && _sessions.first.content.trim().isEmpty) {
      _active = 0;
    }
  }

  final int minTitleLength;
  final int maxSessions;
  final int maxChars;
  late List<SessionDraft> _sessions;
  var _touched = false;
  int? _active;

  List<SessionDraft> get sessions => _sessions;
  int? get active => _active;
  int get count => _sessions.length;

  List<String> get contents => [
    for (final session in _sessions) session.content,
  ];

  String? get error {
    if (!_touched) return null;
    return validate(markTouched: false);
  }

  void setActive(int? index) {
    if (_active == index) return;
    _active = index;
    notifyListeners();
  }

  void add() {
    if (_sessions.length >= maxSessions) return;
    final session = SessionDraft('');
    session.title.addListener(notifyListeners);
    session.description.addListener(notifyListeners);
    _sessions = [..._sessions, session];
    _active = _sessions.length - 1;
    notifyListeners();
  }

  void removeAt(int index) {
    if (_sessions.length <= 1 || index < 0 || index >= _sessions.length) return;
    final removed = _sessions[index];
    removed.title.removeListener(notifyListeners);
    removed.description.removeListener(notifyListeners);
    removed.dispose();
    _sessions = [
      for (var i = 0; i < _sessions.length; i++)
        if (i != index) _sessions[i],
    ];
    if (_active == index) {
      _active = null;
    } else if (_active != null && _active! > index) {
      _active = _active! - 1;
    }
    notifyListeners();
  }

  String? validate({bool markTouched = true}) {
    if (markTouched) _touched = true;
    if (_sessions.isEmpty) {
      notifyListeners();
      return 'Thêm ít nhất một buổi học.';
    }
    if (_sessions.length > maxSessions) {
      notifyListeners();
      return 'Tối đa $maxSessions buổi.';
    }
    for (var i = 0; i < _sessions.length; i++) {
      final content = _sessions[i].content;
      final title = sessionContentParts(content).title.trim();
      if (title.length < minTitleLength) {
        _active ??= i;
        notifyListeners();
        return minTitleLength <= 1
            ? 'Buổi ${i + 1} cần tiêu đề.'
            : 'Buổi ${i + 1} cần tiêu đề từ $minTitleLength ký tự.';
      }
      if (content.length > maxChars) {
        _active ??= i;
        notifyListeners();
        return 'Buổi ${i + 1} tối đa $maxChars ký tự.';
      }
    }
    notifyListeners();
    return null;
  }

  @override
  void dispose() {
    for (final session in _sessions) {
      session.title.removeListener(notifyListeners);
      session.description.removeListener(notifyListeners);
      session.dispose();
    }
    super.dispose();
  }
}

class SessionDraft {
  SessionDraft(String content)
    : title = TextEditingController(text: sessionContentParts(content).title),
      description = TextEditingController(
        text: sessionContentParts(content).description,
      );

  final TextEditingController title;
  final TextEditingController description;

  String get content => sessionContentText(title.text, description.text);

  void dispose() {
    title.dispose();
    description.dispose();
  }
}

class SessionOutlineEditor extends StatelessWidget {
  const SessionOutlineEditor({
    super.key,
    required this.controller,
    this.label = 'Nội dung từng buổi',
    this.enabled = true,
    this.helper,
  });

  final SessionOutlineController controller;
  final String label;
  final bool enabled;
  final String? helper;

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: controller,
      builder: (context, _) {
        final error = controller.error;
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          spacing: 14,
          children: [
            Row(
              children: [
                Container(
                  width: 8,
                  height: 8,
                  margin: const EdgeInsets.only(right: 8),
                  decoration: const BoxDecoration(
                    color: AppColors.primary,
                    shape: BoxShape.circle,
                  ),
                ),
                Expanded(
                  child: Text.rich(
                    TextSpan(
                      text: label,
                      style: nunito(
                        TypeScale.heading,
                        weight: FontWeight.w700,
                        color: AppColors.ink,
                      ),
                      children: [
                        TextSpan(
                          text: ' *',
                          style: nunito(
                            TypeScale.heading,
                            weight: FontWeight.w700,
                            color: AppColors.primary,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    color: AppColors.primarySoft,
                    borderRadius: BorderRadius.circular(AppRadii.badge),
                  ),
                  child: Text(
                    '${controller.count} buổi học',
                    style: nunito(
                      TypeScale.secondary,
                      weight: FontWeight.w600,
                      color: AppColors.primary,
                    ),
                  ),
                ),
              ],
            ),
            if (helper != null)
              Text(
                helper!,
                style: nunito(TypeScale.secondary, color: AppColors.muted),
              ),
            for (var i = 0; i < controller.sessions.length; i++)
              _TimelineSession(
                index: i,
                last: i == controller.sessions.length - 1,
                session: controller.sessions[i],
                active: controller.active == i,
                canRemove: controller.count > 1,
                enabled: enabled,
                maxChars: controller.maxChars,
                onToggle: () => controller.setActive(
                  controller.active == i ? null : i,
                ),
                onRemove: () => controller.removeAt(i),
                onDone: () => controller.setActive(null),
              ),
            if (error != null)
              Text(
                error,
                style: nunito(TypeScale.secondary, color: AppColors.error),
              ),
            Align(
              alignment: Alignment.centerLeft,
              child: Tappable(
                semanticLabel: 'Thêm buổi học',
                disabled: !enabled || controller.count >= controller.maxSessions,
                onTap: controller.add,
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 10,
                  ),
                  decoration: BoxDecoration(
                    color: AppColors.surface,
                    borderRadius: BorderRadius.circular(AppRadii.control),
                    border: Border.all(color: AppColors.primaryMuted),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    spacing: 6,
                    children: [
                      const AppIcon(
                        AppIcon.plus,
                        size: IconSizes.control,
                        color: AppColors.primary,
                      ),
                      Text(
                        'Thêm buổi học',
                        style: nunito(
                          TypeScale.secondary,
                          weight: FontWeight.w700,
                          color: AppColors.primary,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        );
      },
    );
  }
}

class _TimelineSession extends StatelessWidget {
  const _TimelineSession({
    required this.index,
    required this.last,
    required this.session,
    required this.active,
    required this.canRemove,
    required this.enabled,
    required this.maxChars,
    required this.onToggle,
    required this.onRemove,
    required this.onDone,
  });

  final int index;
  final bool last;
  final SessionDraft session;
  final bool active;
  final bool canRemove;
  final bool enabled;
  final int maxChars;
  final VoidCallback onToggle;
  final VoidCallback onRemove;
  final VoidCallback onDone;

  @override
  Widget build(BuildContext context) {
    final title = session.title.text.trim();
    final description = session.description.text.trim();
    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        spacing: 10,
        children: [
          SizedBox(
            width: 18,
            child: Stack(
              alignment: Alignment.topCenter,
              children: [
                if (!last)
                  Positioned(
                    top: 17,
                    bottom: -18,
                    child: CustomPaint(
                      painter: _DashedLinePainter(
                        color: AppColors.primary.withValues(alpha: 0.45),
                      ),
                      child: const SizedBox(width: 2),
                    ),
                  ),
                Container(
                  margin: const EdgeInsets.only(top: 10),
                  width: 14,
                  height: 14,
                  decoration: BoxDecoration(
                    color: AppColors.primary,
                    shape: BoxShape.circle,
                    border: Border.all(color: AppColors.primarySoft, width: 3),
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            child: Container(
              margin: EdgeInsets.only(bottom: last ? 0 : 8),
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(AppRadii.card),
                border: Border.all(
                  color: active ? AppColors.primaryMuted : AppColors.border,
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                spacing: 10,
                children: [
                  Row(
                    spacing: 6,
                    children: [
                      Expanded(
                        child: Tappable(
                          semanticLabel: 'Sửa buổi ${index + 1}',
                          disabled: !enabled,
                          onTap: onToggle,
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            spacing: 2,
                            children: [
                              Text(
                                'BUỔI ${index + 1}',
                                style: nunito(
                                  TypeScale.caption,
                                  weight: FontWeight.w700,
                                  color: AppColors.primary,
                                ),
                              ),
                              Text(
                                title.isEmpty
                                    ? 'Nhập tiêu đề buổi học'
                                    : title,
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                                style: nunito(
                                  TypeScale.body,
                                  weight: FontWeight.w600,
                                  color: title.isEmpty
                                      ? AppColors.muted
                                      : AppColors.ink,
                                ),
                              ),
                              if (!active && description.isNotEmpty)
                                Text(
                                  description,
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                  style: nunito(
                                    TypeScale.secondary,
                                    color: AppColors.muted,
                                  ),
                                ),
                            ],
                          ),
                        ),
                      ),
                      Tappable(
                        semanticLabel: 'Sửa nội dung buổi ${index + 1}',
                        disabled: !enabled,
                        onTap: onToggle,
                        child: const SizedBox(
                          width: 36,
                          height: 44,
                          child: Center(
                            child: AppIcon(
                              AppIcon.edit,
                              size: IconSizes.control,
                              color: AppColors.muted,
                            ),
                          ),
                        ),
                      ),
                      if (canRemove)
                        Tappable(
                          semanticLabel: 'Xóa buổi ${index + 1}',
                          disabled: !enabled,
                          onTap: onRemove,
                          child: const SizedBox(
                            width: 36,
                            height: 44,
                            child: Center(
                              child: AppIcon(
                                AppIcon.close,
                                size: IconSizes.control,
                                color: AppColors.muted,
                              ),
                            ),
                          ),
                        ),
                    ],
                  ),
                  if (active) ...[
                    const Divider(height: 1, color: AppColors.border),
                    _SessionField(
                      controller: session.title,
                      label: 'Tiêu đề buổi ${index + 1}',
                      placeholder: 'Ví dụ: Nền tảng React và JSX',
                      enabled: enabled,
                      maxLength: maxChars,
                      required: true,
                    ),
                    _SessionField(
                      controller: session.description,
                      label: 'Mô tả buổi ${index + 1} (tùy chọn)',
                      placeholder:
                          'Nội dung thực hành, kiến thức hoặc điều cần chuẩn bị…',
                      enabled: enabled,
                      maxLength: maxChars,
                      multiline: true,
                    ),
                    Align(
                      alignment: Alignment.centerRight,
                      child: Text(
                        '${session.content.length}/$maxChars ký tự',
                        style: nunito(
                          TypeScale.secondary,
                          color: AppColors.muted,
                        ),
                      ),
                    ),
                    Align(
                      alignment: Alignment.centerLeft,
                      child: AppButton(
                        label: 'Xong',
                        variant: ButtonVariant.secondary,
                        size: ButtonSize.sm,
                        disabled: !enabled,
                        onPressed: onDone,
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _DashedLinePainter extends CustomPainter {
  const _DashedLinePainter({required this.color});

  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..strokeWidth = 2
      ..strokeCap = StrokeCap.round;
    const dash = 3.0;
    const gap = 5.0;
    var y = 0.0;
    while (y < size.height) {
      canvas.drawLine(Offset(1, y), Offset(1, (y + dash).clamp(0, size.height)), paint);
      y += dash + gap;
    }
  }

  @override
  bool shouldRepaint(covariant _DashedLinePainter oldDelegate) =>
      oldDelegate.color != color;
}

class _SessionField extends StatelessWidget {
  const _SessionField({
    required this.controller,
    required this.label,
    required this.placeholder,
    required this.enabled,
    required this.maxLength,
    this.required = false,
    this.multiline = false,
  });

  final TextEditingController controller;
  final String label;
  final String placeholder;
  final bool enabled;
  final int maxLength;
  final bool required;
  final bool multiline;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: 6,
      children: [
        Text.rich(
          TextSpan(
            text: label,
            style: nunito(
              TypeScale.secondary,
              weight: FontWeight.w600,
              color: AppColors.ink,
            ),
            children: [
              if (required)
                TextSpan(
                  text: ' *',
                  style: nunito(
                    TypeScale.secondary,
                    weight: FontWeight.w600,
                    color: AppColors.primary,
                  ),
                ),
            ],
          ),
        ),
        TextField(
          controller: controller,
          enabled: enabled,
          maxLength: maxLength,
          maxLengthEnforcement: MaxLengthEnforcement.enforced,
          minLines: multiline ? 3 : 1,
          maxLines: multiline ? null : 1,
          style: nunito(TypeScale.body, color: AppColors.ink),
          decoration: InputDecoration(
            hintText: placeholder,
            hintStyle: nunito(TypeScale.body, color: AppColors.mutedLight),
            counterText: '',
            filled: true,
            fillColor: enabled ? AppColors.surface : AppColors.surfaceLow,
            contentPadding: const EdgeInsets.symmetric(
              horizontal: 12,
              vertical: 12,
            ),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(AppRadii.control),
              borderSide: const BorderSide(color: AppColors.border),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(AppRadii.control),
              borderSide: const BorderSide(color: AppColors.border),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(AppRadii.control),
              borderSide: const BorderSide(color: AppColors.primary),
            ),
          ),
        ),
      ],
    );
  }
}
