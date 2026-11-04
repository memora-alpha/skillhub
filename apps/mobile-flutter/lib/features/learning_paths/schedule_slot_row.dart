import 'package:flutter/material.dart';

import '../../core/theme/tokens.dart';

const _weekdays = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

/// RN `ScheduleSlotRow` — date tile + time range for schedule overview.
class ScheduleSlotRow extends StatelessWidget {
  const ScheduleSlotRow({
    super.key,
    required this.sessionNo,
    required this.title,
    this.startAt,
    this.endAt,
    this.status,
  });

  final int sessionNo;
  final String title;
  final DateTime? startAt;
  final DateTime? endAt;
  final String? status;

  @override
  Widget build(BuildContext context) {
    final heading = title.trim().isEmpty
        ? 'Buổi $sessionNo'
        : 'Buổi $sessionNo · ${title.trim()}';
    final start = startAt?.toLocal();
    final end = endAt?.toLocal();
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.surfaceLow,
        borderRadius: BorderRadius.circular(AppRadii.control),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        spacing: 10,
        children: [
          Text(
            heading,
            style: nunito(
              TypeScale.body,
              weight: FontWeight.w600,
              color: AppColors.ink,
            ),
          ),
          if (start == null || end == null)
            Text(
              'Chưa có ngày giờ · Cần bổ sung lịch',
              style: nunito(TypeScale.secondary, color: AppColors.muted),
            )
          else
            Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              spacing: 10,
              children: [
                Container(
                  constraints: const BoxConstraints(minWidth: 40),
                  padding: const EdgeInsets.all(6),
                  decoration: BoxDecoration(
                    color: AppColors.surfaceInset,
                    borderRadius: BorderRadius.circular(AppRadii.control),
                  ),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    spacing: 2,
                    children: [
                      Text(
                        _weekdays[start.weekday % 7],
                        style: nunito(
                          TypeScale.caption,
                          weight: FontWeight.w600,
                          color: AppColors.muted,
                        ),
                      ),
                      Text(
                        '${start.day}',
                        style: nunito(
                          TypeScale.heading,
                          weight: FontWeight.w700,
                          color: AppColors.ink,
                        ),
                      ),
                    ],
                  ),
                ),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    spacing: 4,
                    children: [
                      Text(
                        'Tháng ${start.month}, ${start.year}',
                        style: nunito(
                          TypeScale.secondary,
                          weight: FontWeight.w600,
                          color: AppColors.ink,
                        ),
                      ),
                      Text(
                        '${_clock(start)} – ${_endLabel(start, end)}',
                        style: nunito(
                          TypeScale.secondary,
                          color: AppColors.muted,
                        ),
                      ),
                      if (status != null && status!.trim().isNotEmpty)
                        Text(
                          status!,
                          style: nunito(
                            TypeScale.secondary,
                            color: AppColors.muted,
                          ),
                        ),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    color: AppColors.surface,
                    borderRadius: BorderRadius.circular(AppRadii.control),
                  ),
                  child: Text(
                    '${end.difference(start).inMinutes} phút',
                    style: nunito(
                      TypeScale.secondary,
                      weight: FontWeight.w600,
                      color: AppColors.primary,
                    ),
                  ),
                ),
              ],
            ),
        ],
      ),
    );
  }
}

String _two(int value) => value.toString().padLeft(2, '0');

String _clock(DateTime value) => '${_two(value.hour)}:${_two(value.minute)}';

String _endLabel(DateTime start, DateTime end) {
  if (start.year == end.year &&
      start.month == end.month &&
      start.day == end.day) {
    return _clock(end);
  }
  return '${_clock(end)} ${_two(end.day)}/${_two(end.month)}/${end.year}';
}
