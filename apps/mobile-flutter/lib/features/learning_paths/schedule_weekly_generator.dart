import 'package:flutter/material.dart';

import '../../components/app_button.dart';
import '../../components/app_icon.dart';
import '../../components/app_input.dart';
import '../../components/feature_page.dart';
import '../../components/tappable.dart';
import '../../core/theme/tokens.dart';
import 'weekly_schedule.dart';

const _weekDays = <({int day, String label, String a11y})>[
  (day: 1, label: 'T2', a11y: 'Thứ 2'),
  (day: 2, label: 'T3', a11y: 'Thứ 3'),
  (day: 3, label: 'T4', a11y: 'Thứ 4'),
  (day: 4, label: 'T5', a11y: 'Thứ 5'),
  (day: 5, label: 'T6', a11y: 'Thứ 6'),
  (day: 6, label: 'T7', a11y: 'Thứ 7'),
  (day: 0, label: 'CN', a11y: 'Chủ nhật'),
];

const _presets = [60, 90, 120, 180];

/// RN `ScheduleWeeklyGenerator` — fill every session from a weekly template.
class ScheduleWeeklyGenerator extends StatefulWidget {
  const ScheduleWeeklyGenerator({
    super.key,
    required this.count,
    required this.disabled,
    required this.onApply,
  });

  final int count;
  final bool disabled;
  final void Function(List<WeeklyScheduleSlot> items) onApply;

  @override
  State<ScheduleWeeklyGenerator> createState() =>
      _ScheduleWeeklyGeneratorState();
}

class _ScheduleWeeklyGeneratorState extends State<ScheduleWeeklyGenerator> {
  final _selected = <int>{};
  final _minutes = AppField(text: '60', validator: integerRule(60, 180));
  String _start = '';
  String? _error;

  @override
  void dispose() {
    _minutes.dispose();
    super.dispose();
  }

  Future<void> _pickStart() async {
    if (widget.disabled) return;
    final current = parseLocalDateTime(_start);
    final now = DateTime.now();
    final fallback = DateTime(now.year, now.month, now.day + 1, 19);
    final picked = await pickScheduleDateTime(
      context,
      current ?? fallback,
      dateHelp: 'Ngày và giờ bắt đầu mẫu',
    );
    if (picked == null || !mounted) return;
    setState(() {
      _start = localDateInput(picked);
      _error = null;
    });
  }

  void _apply() {
    if (widget.disabled) return;
    setState(() => _error = null);
    try {
      widget.onApply(
        generateWeeklySchedule(
          start: _start,
          days: _selected.toList()..sort(),
          minutes: _minutes.text.trim().isEmpty ? '60' : _minutes.text.trim(),
          count: widget.count,
        ),
      );
    } catch (error) {
      setState(() {
        _error = error is StateError
            ? error.message
            : 'Chưa thể điền lịch.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final selectedLabels = _weekDays
        .where((d) => _selected.contains(d.day))
        .map((d) => d.a11y)
        .join(', ');
    return Panel(
      children: [
        Container(
          padding: const EdgeInsets.only(bottom: 8),
          decoration: const BoxDecoration(
            border: Border(
              bottom: BorderSide(color: AppColors.border, width: 0.5),
            ),
          ),
          child: Row(
            spacing: 8,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: AppColors.surfaceInset,
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  '1',
                  style: nunito(
                    TypeScale.secondary,
                    weight: FontWeight.w700,
                    color: AppColors.ink,
                  ),
                ),
              ),
              Expanded(
                child: Text(
                  'Lên lịch theo tuần',
                  style: nunito(
                    TypeScale.heading,
                    weight: FontWeight.w700,
                    color: AppColors.ink,
                  ),
                ),
              ),
            ],
          ),
        ),
        Copy(
          'Điền lịch cho ${widget.count} buổi, sau đó xem lại và chỉnh riêng từng buổi.',
          muted: true,
        ),
        Text(
          'Chọn thứ trong tuần',
          style: nunito(
            TypeScale.body,
            weight: FontWeight.w600,
            color: AppColors.ink,
          ),
        ),
        Row(
          spacing: 4,
          children: [
            for (final day in _weekDays)
              Expanded(
                child: Tappable(
                  semanticLabel: day.a11y,
                  disabled: widget.disabled,
                  onTap: () => setState(() {
                    if (_selected.contains(day.day)) {
                      _selected.remove(day.day);
                    } else {
                      _selected.add(day.day);
                    }
                    _error = null;
                  }),
                  child: Container(
                    constraints: const BoxConstraints(minHeight: 44),
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: _selected.contains(day.day)
                          ? AppColors.primarySoft
                          : AppColors.surfaceLow,
                      borderRadius: BorderRadius.circular(AppRadii.control),
                      border: Border.all(
                        color: _selected.contains(day.day)
                            ? AppColors.primaryMuted
                            : AppColors.border,
                      ),
                    ),
                    child: Text(
                      day.label,
                      style: nunito(
                        TypeScale.secondary,
                        weight: FontWeight.w600,
                        color: _selected.contains(day.day)
                            ? AppColors.primary
                            : AppColors.body,
                      ),
                    ),
                  ),
                ),
              ),
          ],
        ),
        if (_selected.isNotEmpty)
          Row(
            spacing: 6,
            children: [
              const AppIcon(
                AppIcon.checkCircle,
                size: 14,
                color: AppColors.primary,
              ),
              Expanded(
                child: Text(
                  'Đã chọn $selectedLabels',
                  style: nunito(TypeScale.secondary, color: AppColors.muted),
                ),
              ),
            ],
          ),
        Text('Ngày và giờ bắt đầu', style: FeatureStyles.label),
        AppButton(
          label: _start.isEmpty
              ? 'Chọn ngày và giờ'
              : scheduleSlotLabel(_start, _minutes.text.trim().isEmpty
                    ? '60'
                    : _minutes.text.trim()).split(' – ').first,
          variant: ButtonVariant.paper,
          disabled: widget.disabled,
          onPressed: _pickStart,
        ),
        if (_error == 'Chọn ngày và giờ bắt đầu.') FieldError(_error!),
        AppInput(
          field: _minutes,
          label: 'Thời lượng mỗi buổi (phút)',
          editable: !widget.disabled,
          keyboardType: TextInputType.number,
          onChanged: (_) => setState(() => _error = null),
        ),
        Wrap(
          spacing: 6,
          runSpacing: 6,
          children: [
            for (final value in _presets)
              Tappable(
                semanticLabel: '$value phút',
                disabled: widget.disabled,
                onTap: () => setState(() {
                  _minutes.text = '$value';
                  _error = null;
                }),
                child: Container(
                  constraints: const BoxConstraints(minHeight: 44, minWidth: 54),
                  padding: const EdgeInsets.symmetric(horizontal: 10),
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: _minutes.text.trim() == '$value'
                        ? AppColors.surfaceInset
                        : AppColors.surfaceLow,
                    borderRadius: BorderRadius.circular(AppRadii.control),
                    border: Border.all(
                      color: _minutes.text.trim() == '$value'
                          ? AppColors.border
                          : AppColors.border,
                      width: _minutes.text.trim() == '$value' ? 1.5 : 1,
                    ),
                  ),
                  child: Text(
                    '$value phút',
                    style: nunito(
                      TypeScale.secondary,
                      weight: _minutes.text.trim() == '$value'
                          ? FontWeight.w700
                          : FontWeight.w600,
                      color: AppColors.body,
                    ),
                  ),
                ),
              ),
          ],
        ),
        Copy(
          'Nhấn Áp dụng sẽ điền lại toàn bộ ${widget.count} buổi, thay cả các buổi đã sửa riêng.',
          muted: true,
        ),
        if (_error != null && _error != 'Chọn ngày và giờ bắt đầu.')
          FieldError(_error!),
        AppButton(
          label: 'Áp dụng cho ${widget.count} buổi',
          variant: ButtonVariant.paper,
          disabled: widget.disabled,
          onPressed: _apply,
        ),
      ],
    );
  }
}
