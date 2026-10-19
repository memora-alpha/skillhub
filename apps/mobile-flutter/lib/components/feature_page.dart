import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../core/theme/tokens.dart';
import '../features/shell/app_screen_layout.dart';
import 'app_button.dart';
import 'app_input.dart';
import 'misc.dart';
import 'tappable.dart';

const _labels = {
  'TWO_WAY': 'Trao đổi hai chiều',
  'ONE_WAY': 'Dạy học một chiều',
  'BEGINNER': 'Cơ bản',
  'INTERMEDIATE': 'Trung cấp',
  'ADVANCED': 'Nâng cao',
  'EXPERT': 'Chuyên gia',
  'NONE': 'Chưa có nền tảng',
  'DRAFT': 'Bản nháp',
  'PROPOSED': 'Đang thương lượng',
  'OPEN': 'Đang mở',
  'PENDING': 'Đang chờ',
  'PENDING_MODERATION': 'Chờ kiểm duyệt',
  'PENDING_REVIEW': 'Chờ xét duyệt',
  'NEGOTIATING': 'Đang thương lượng',
  'MATCHED': 'Đã kết nối',
  'CANCELLED': 'Đã hủy',
  'EXPIRED': 'Hết hạn',
  'UNVERIFIED': 'Chưa xác minh',
  'VERIFIED': 'Đã xác minh',
  'REJECTED': 'Bị từ chối',
  'REVOKED': 'Đã thu hồi',
  'PUBLISHED': 'Đã công bố',
  'ARCHIVED': 'Ngừng phân phối',
  'ACTIVE': 'Đang học',
  'COMPLETED': 'Đã hoàn thành',
  'DISPUTED': 'Đang tranh chấp',
  'CONFIRMED': 'Đã chốt lịch',
  'AWAITING_CONFIRMATION': 'Chờ xác nhận đã học',
  'SUCCESS': 'Thành công',
  'FAILED': 'Thất bại',
  'UNDER_REVIEW': 'Đang xem xét',
  'NEED_MORE_INFO': 'Cần bổ sung',
  'RESOLVED': 'Đã giải quyết',
  'FREE': 'Miễn phí',
  'PAID': 'Trả phí bằng Credit',
  'NO_SHOW_LATE': 'Vắng mặt / trễ nghiêm trọng',
  'INAPPROPRIATE_BEHAVIOR': 'Hành vi không phù hợp',
  'HARASSMENT': 'Quấy rối / xúc phạm',
  'SKILL_MISMATCH': 'Nội dung học khác thỏa thuận',
  'FALSE_INFORMATION': 'Thông tin không đúng',
  'TECHNICAL_ISSUE': 'Sự cố kỹ thuật',
  'CREDIT_ISSUE': 'Vấn đề Credit',
  'INAPPROPRIATE_CONTENT': 'Nội dung không phù hợp',
  'SPAM_SCAM': 'Spam / lừa đảo',
  'OTHER': 'Vấn đề khác',
};

String uiLabel(String value) => _labels[value] ?? value;

DateTime? parseLocalDateTime(String value) {
  final match = RegExp(
    r'^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$',
  ).firstMatch(value);
  if (match == null) return null;
  final [year, month, day, hour, minute] = [
    for (var i = 1; i <= 5; i++) int.parse(match.group(i)!),
  ];
  if (year < 1900 || month < 1 || month > 12 || day < 1 || hour > 23 || minute > 59) {
    return null;
  }
  final date = DateTime(year, month, day, hour, minute);
  if (date.year != year ||
      date.month != month ||
      date.day != day ||
      date.hour != hour ||
      date.minute != minute) {
    return null;
  }
  return date;
}

String _two(int value) => value.toString().padLeft(2, '0');

/// Matches `Date.toLocaleString("vi-VN")`, e.g. `19:00:00 20/10/2026`.
String viDateTime(DateTime date) {
  final d = date.toLocal();
  return '${_two(d.hour)}:${_two(d.minute)}:${_two(d.second)} '
      '${d.day}/${d.month}/${d.year}';
}

/// Formats a date for `YYYY-MM-DDTHH:mm` inputs read by [parseLocalDateTime].
String localDateInput(DateTime date) {
  final d = date.toLocal();
  return '${d.year}-${_two(d.month)}-${_two(d.day)}T${_two(d.hour)}:${_two(d.minute)}';
}

/// Status badge whose raw value is translated like the RN `Badge`.
class StatusBadge extends StatelessWidget {
  const StatusBadge(this.value, {super.key, this.variant = BadgeVariant.neutral});

  final String value;
  final BadgeVariant variant;

  @override
  Widget build(BuildContext context) => Align(
    alignment: Alignment.centerLeft,
    child: AppBadge(label: uiLabel(value), variant: variant),
  );
}

abstract final class FeatureStyles {
  static final demo = TextStyle(
    fontFamily: Fonts.nunito,
    fontWeight: FontWeight.w700,
    fontSize: 11,
    height: 18 / 11,
    letterSpacing: 1,
    color: AppColors.primary,
  );
  static final subtitle = nunito((15, 24), color: AppColors.body);
  static final heading = fraunces(22, 30, color: AppColors.ink);
  static final copy = nunito((15, 24), color: AppColors.body);
  static final label = nunito(
    (13, 20),
    weight: FontWeight.w700,
    color: AppColors.muted,
  );
  static final number = fraunces(
    32,
    42,
    weight: FontWeight.w700,
    color: AppColors.forest,
  ).copyWith(fontFeatures: const [FontFeature.tabularFigures()]);
  static final strong = nunito(
    TypeScale.body,
    weight: FontWeight.w600,
    color: AppColors.ink,
  );
}

/// Preview page used by every feature that still runs on sample data.
class FeaturePage extends StatelessWidget {
  const FeaturePage({
    super.key,
    required this.title,
    required this.children,
    this.subtitle,
    this.back = '/ui',
    this.demo = true,
    this.selected = 'Hồ sơ',
  });

  final String title;
  final String? subtitle;
  final List<Widget> children;
  final String back;
  final bool demo;
  final String selected;

  @override
  Widget build(BuildContext context) {
    return AppScreenLayout(
      title: title,
      selected: selected,
      back: (route: back, label: 'Quay lại'),
      child: ListView(
        keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 36),
        children: [
          Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 860),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                spacing: 16,
                children: [
                  if (demo)
                    Text('BẢN XEM THỬ · DỮ LIỆU MẪU', style: FeatureStyles.demo),
                  if (subtitle != null)
                    Text(subtitle!, style: FeatureStyles.subtitle),
                  ...children,
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class Panel extends StatelessWidget {
  const Panel({
    super.key,
    this.title,
    required this.children,
    this.accent = false,
  });

  final String? title;
  final List<Widget> children;
  final bool accent;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: accent ? AppColors.forestSoft : AppColors.surface,
        borderRadius: BorderRadius.circular(AppRadii.card),
        border: Border.all(
          color: accent ? AppColors.forestMuted : AppColors.border,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        spacing: 12,
        children: [
          if (title != null)
            Semantics(
              header: true,
              child: Text(title!, style: FeatureStyles.heading),
            ),
          ...children,
        ],
      ),
    );
  }
}

class Copy extends StatelessWidget {
  const Copy(this.text, {super.key, this.muted = false});

  final String text;
  final bool muted;

  @override
  Widget build(BuildContext context) {
    return SelectableText(
      text,
      style: muted
          ? FeatureStyles.copy.copyWith(color: AppColors.muted)
          : FeatureStyles.copy,
    );
  }
}

class Metric extends StatelessWidget {
  const Metric({super.key, required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return ConstrainedBox(
      constraints: const BoxConstraints(minWidth: 110),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        spacing: 4,
        children: [
          Text(label, style: FeatureStyles.label),
          SelectableText(value, style: FeatureStyles.number),
        ],
      ),
    );
  }
}

class MetricRow extends StatelessWidget {
  const MetricRow({super.key, required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Wrap(spacing: 12, runSpacing: 12, children: children);
  }
}

class RouteButton extends StatelessWidget {
  const RouteButton({
    super.key,
    required this.href,
    required this.label,
    this.secondary = false,
  });

  final String href;
  final String label;
  final bool secondary;

  @override
  Widget build(BuildContext context) {
    return AppButton(
      label: label,
      variant: secondary ? ButtonVariant.paper : ButtonVariant.craft,
      onPressed: () => context.push(href),
    );
  }
}

class ChoiceGroup extends StatelessWidget {
  const ChoiceGroup({
    super.key,
    required this.label,
    required this.options,
    required this.value,
    required this.onChange,
  });

  final String label;
  final List<String> options;
  final String value;
  final ValueChanged<String> onChange;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      spacing: 8,
      children: [
        Text(
          label,
          style: nunito(
            TypeScale.body,
            weight: FontWeight.w700,
            color: AppColors.body,
          ),
        ),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            for (final option in options)
              Semantics(
                inMutuallyExclusiveGroup: true,
                checked: value == option,
                child: Tappable(
                  onTap: () => onChange(option),
                  child: Container(
                    constraints: const BoxConstraints(minHeight: 44),
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: value == option
                          ? AppColors.primarySoft
                          : AppColors.surface,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(
                        color: value == option
                            ? AppColors.primary
                            : AppColors.border,
                      ),
                    ),
                    child: Text(
                      uiLabel(option),
                      style: nunito(
                        TypeScale.body,
                        weight: FontWeight.w600,
                        color: value == option
                            ? AppColors.primary
                            : AppColors.body,
                      ),
                    ),
                  ),
                ),
              ),
          ],
        ),
      ],
    );
  }
}

class AppTag extends StatelessWidget {
  const AppTag({super.key, required this.label, this.active = false, this.onTap});

  final String label;
  final bool active;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final tag = Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: active ? AppColors.forest : AppColors.surfaceInset,
        borderRadius: BorderRadius.circular(AppRadii.badge),
      ),
      child: Text(
        label,
        style: nunito(
          TypeScale.secondary,
          weight: FontWeight.w600,
          color: active ? AppColors.white : AppColors.body,
        ),
      ),
    );
    if (onTap == null) return tag;
    return Semantics(
      selected: active,
      child: Tappable(onTap: onTap, semanticLabel: label, child: tag),
    );
  }
}

class AppProgressBar extends StatelessWidget {
  const AppProgressBar({
    super.key,
    required this.value,
    required this.max,
    required this.label,
    this.color = AppColors.primary,
    this.trackColor = AppColors.surfaceInset,
    this.height = 8,
  });

  final num value;
  final num max;
  final String label;
  final Color color;
  final Color trackColor;
  final double height;

  @override
  Widget build(BuildContext context) {
    final fraction = max > 0 ? (value / max).clamp(0, 1).toDouble() : 0.0;
    return Semantics(
      label: label,
      value: '$value/$max',
      child: ClipRRect(
        borderRadius: BorderRadius.circular(4),
        child: SizedBox(
          height: height,
          child: ColoredBox(
            color: trackColor,
            child: FractionallySizedBox(
              alignment: Alignment.centerLeft,
              widthFactor: fraction,
              child: DecoratedBox(
                decoration: BoxDecoration(
                  color: color,
                  borderRadius: BorderRadius.circular(4),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

typedef FieldRule = String? Function(String value);

FieldRule textRule(int min, int max) => (value) {
  final text = value.trim();
  if (text.runes.length < min) return 'Nhập ít nhất $min ký tự.';
  if (text.runes.length > max) return 'Tối đa $max ký tự.';
  return null;
};

FieldRule integerRule(int min, [int? max]) => (value) {
  final text = value.trim();
  final number = RegExp(r'^\d+$').hasMatch(text) ? int.tryParse(text) : null;
  if (number == null || number < min || (max != null && number > max)) {
    return 'Nhập số nguyên từ $min${max != null ? ' đến $max' : ''}.';
  }
  return null;
};

FieldRule creditRule([num min = 0, bool inclusive = false]) => (value) {
  final text = value.trim();
  final valid =
      RegExp(r'^\d{1,10}(\.\d{1,2})?$').hasMatch(text) &&
      (inclusive ? num.parse(text) >= min : num.parse(text) > min);
  return valid
      ? null
      : 'Credit ${inclusive ? 'từ' : 'lớn hơn'} $min, tối đa 2 số thập phân.';
};

FieldRule anyOf(List<String> choices) =>
    (value) => choices.contains(value) ? null : 'Chọn một lựa chọn.';

class DataField {
  const DataField({
    required this.name,
    required this.label,
    required this.rule,
    this.multiline = false,
    this.hint,
    this.numeric = false,
    this.choices,
  });

  final String name;
  final String label;
  final FieldRule rule;
  final bool multiline;
  final String? hint;
  final bool numeric;
  final List<String>? choices;
}

/// Validated sample-data form; [onSubmit] may return an error message.
class DataForm extends StatefulWidget {
  const DataForm({
    super.key,
    required this.fields,
    required this.onSubmit,
    this.defaults = const {},
    this.submitLabel = 'Lưu bản xem thử',
  });

  final List<DataField> fields;
  final Map<String, String> defaults;
  final String submitLabel;
  final String? Function(Map<String, String> values) onSubmit;

  @override
  State<DataForm> createState() => _DataFormState();
}

class _DataFormState extends State<DataForm> {
  late final Map<String, AppField> _inputs = {
    for (final f in widget.fields)
      if (f.choices == null)
        f.name: AppField(text: widget.defaults[f.name] ?? '', validator: f.rule),
  };
  late final Map<String, String> _choices = {
    for (final f in widget.fields)
      if (f.choices != null) f.name: widget.defaults[f.name] ?? '',
  };
  final Map<String, String?> _choiceErrors = {};
  String? _error;

  @override
  void dispose() {
    for (final field in _inputs.values) {
      field.dispose();
    }
    super.dispose();
  }

  void _submit() {
    var valid = validateFields(_inputs.values.toList());
    setState(() {
      for (final f in widget.fields.where((f) => f.choices != null)) {
        _choiceErrors[f.name] = f.rule(_choices[f.name]!);
        if (_choiceErrors[f.name] != null) valid = false;
      }
    });
    if (!valid) return;
    final values = {
      for (final entry in _inputs.entries) entry.key: entry.value.text.trim(),
      ..._choices,
    };
    setState(() => _error = widget.onSubmit(values));
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: 14,
      children: [
        for (final f in widget.fields)
          if (f.choices != null)
            Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              spacing: 6,
              children: [
                ChoiceGroup(
                  label: f.label,
                  options: f.choices!,
                  value: _choices[f.name]!,
                  onChange: (value) => setState(() {
                    _choices[f.name] = value;
                    _choiceErrors[f.name] = f.rule(value);
                  }),
                ),
                if (_choiceErrors[f.name] != null)
                  FormNotice(
                    tone: NoticeTone.error,
                    message: _choiceErrors[f.name]!,
                  ),
              ],
            )
          else
            AppInput(
              field: _inputs[f.name]!,
              label: f.label,
              hint: f.hint,
              multiline: f.multiline,
              keyboardType: f.numeric
                  ? const TextInputType.numberWithOptions(decimal: true)
                  : null,
            ),
        if (_error != null) FormNotice(tone: NoticeTone.error, message: _error!),
        AppButton(
          label: widget.submitLabel,
          variant: ButtonVariant.craft,
          onPressed: _submit,
        ),
      ],
    );
  }
}

const sampleFiles = [
  (name: 'chung-chi.pdf', bytes: 2 * 1024 * 1024),
  (name: 'du-an.docx', bytes: 4 * 1024 * 1024),
  (name: 'minh-chung.png', bytes: 1024 * 1024),
  (name: 'tep-lon.pdf', bytes: 16 * 1024 * 1024),
];

class SampleFiles extends StatelessWidget {
  const SampleFiles({
    super.key,
    required this.value,
    required this.onChange,
    this.maxCount = 5,
    this.maxBytes,
  });

  final List<String> value;
  final ValueChanged<List<String>> onChange;
  final int maxCount;
  final int? maxBytes;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: 10,
      children: [
        const Copy(
          'Chọn tệp mẫu để xem giao diện. Không truy cập hoặc tải tệp cá nhân lên máy chủ.',
          muted: true,
        ),
        for (final file in sampleFiles)
          Builder(
            builder: (context) {
              final selected = value.contains(file.name);
              final tooLarge = maxBytes != null && file.bytes > maxBytes!;
              return Row(
                spacing: 8,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(file.name, style: FeatureStyles.strong),
                        Copy(
                          '${file.bytes ~/ 1024 ~/ 1024} MB'
                          '${tooLarge ? ' · Vượt giới hạn' : ''}',
                          muted: true,
                        ),
                      ],
                    ),
                  ),
                  AppButton(
                    label: selected ? 'Bỏ chọn' : 'Chọn',
                    variant: ButtonVariant.paper,
                    disabled:
                        tooLarge || (!selected && value.length >= maxCount),
                    onPressed: () => onChange(
                      selected
                          ? value.where((f) => f != file.name).toList()
                          : [...value, file.name],
                    ),
                  ),
                ],
              );
            },
          ),
      ],
    );
  }
}

/// Plain text input bound to local state, for search boxes and filters.
class SimpleInput extends StatefulWidget {
  const SimpleInput({
    super.key,
    required this.label,
    required this.onChanged,
    this.value = '',
    this.placeholder,
    this.multiline = false,
    this.numeric = false,
  });

  final String label;
  final String value;
  final String? placeholder;
  final bool multiline;
  final bool numeric;
  final ValueChanged<String> onChanged;

  @override
  State<SimpleInput> createState() => _SimpleInputState();
}

class _SimpleInputState extends State<SimpleInput> {
  late final _field = AppField(text: widget.value);

  @override
  void dispose() {
    _field.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AppInput(
      field: _field,
      label: widget.label,
      placeholder: widget.placeholder,
      multiline: widget.multiline,
      keyboardType: widget.numeric ? TextInputType.number : null,
      onChanged: widget.onChanged,
    );
  }
}
