import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../components/app_button.dart';
import '../../components/app_icon.dart';
import '../../components/avatar.dart';
import '../../components/tappable.dart';
import '../../core/theme/tokens.dart';
import '../messages/messages_data.dart';

const pathListFilters = <({String value, String label})>[
  (value: 'all', label: 'Tất cả'),
  (value: 'confirmed', label: 'Đã xác nhận'),
  (value: 'negotiating', label: 'Đang trao đổi'),
];

List<Map<String, dynamic>> filterPathSummaries(
  List<Map<String, dynamic>> paths,
  String filter,
) {
  return [
    for (final path in paths)
      if (filter == 'all' ||
          (filter == 'confirmed'
              ? path['status'] == 'CONFIRMED'
              : const {
                  'DRAFT',
                  'PROPOSED',
                  'PARTIALLY_CONFIRMED',
                }.contains(path['status'])))
        path,
  ];
}

/// RN `ApiPathCard` visual clone.
class PathSummaryCard extends ConsumerWidget {
  const PathSummaryCard({
    super.key,
    required this.path,
    required this.statusLabel,
    required this.exchangeLabel,
  });

  final Map<String, dynamic> path;
  final String statusLabel;
  final String exchangeLabel;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final counterpartId = '${path['counterpartId'] ?? ''}';
    final conversation = ref
        .watch(messagesProvider)
        .conversations
        .where((item) => item.userId == counterpartId)
        .firstOrNull;
    final name = conversation?.name ?? 'Lộ trình cùng đối tác';
    final status = '${path['status'] ?? ''}';
    final confirmed = const {
      'CONFIRMED',
      'SCHEDULED',
      'ACTIVE',
      'COMPLETED',
    }.contains(status);
    final closed = const {'CANCELLED', 'DISPUTED'}.contains(status);
    final updated = DateTime.tryParse('${path['updatedAt'] ?? ''}');
    final icon = closed
        ? AppIcon.alert
        : confirmed
        ? AppIcon.checkCircle
        : AppIcon.clock;
    final color = closed
        ? AppColors.error
        : confirmed
        ? AppColors.forest
        : AppColors.warning;
    final badgeBg = closed
        ? AppColors.errorLight
        : confirmed
        ? AppColors.forestSoft
        : AppColors.amberSoft;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppRadii.card),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        spacing: 12,
        children: [
          Container(
            padding: const EdgeInsets.only(bottom: 12),
            decoration: const BoxDecoration(
              border: Border(
                bottom: BorderSide(color: AppColors.border, width: 0.5),
              ),
            ),
            child: Row(
              spacing: 10,
              children: [
                Avatar(
                  name: name,
                  userId: counterpartId.isEmpty ? null : counterpartId,
                  size: 40,
                  imageUrl: conversation?.avatarUrl,
                ),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    spacing: 4,
                    children: [
                      Text(
                        name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: nunito(
                          TypeScale.body,
                          weight: FontWeight.w700,
                          color: AppColors.ink,
                        ),
                      ),
                      Text(
                        updated == null
                            ? 'Cập nhật gần đây'
                            : 'Cập nhật ${_viStamp(updated)}',
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
                    vertical: 5,
                  ),
                  decoration: BoxDecoration(
                    color: AppColors.surfaceLow,
                    borderRadius: BorderRadius.circular(AppRadii.badge),
                  ),
                  child: Text(
                    'Bản ${path['currentVersion'] ?? '?'}',
                    style: nunito(
                      TypeScale.secondary,
                      weight: FontWeight.w600,
                      color: AppColors.muted,
                    ),
                  ),
                ),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            spacing: 9,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                spacing: 2,
                children: [
                  Text(
                    'HÌNH THỨC HỌC',
                    style: nunito(
                      TypeScale.caption,
                      weight: FontWeight.w700,
                      color: AppColors.muted,
                    ).copyWith(letterSpacing: 0.5),
                  ),
                  Text(
                    exchangeLabel,
                    style: nunito(
                      TypeScale.heading,
                      weight: FontWeight.w700,
                      color: AppColors.ink,
                    ),
                  ),
                ],
              ),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 7,
                ),
                decoration: BoxDecoration(
                  color: badgeBg,
                  borderRadius: BorderRadius.circular(AppRadii.badge),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  spacing: 6,
                  children: [
                    AppIcon(icon, size: 15, color: color),
                    Flexible(
                      child: Text(
                        statusLabel,
                        style: nunito(
                          TypeScale.secondary,
                          weight: FontWeight.w600,
                          color: color,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          AppButton(
            label: 'Mở lộ trình',
            variant: ButtonVariant.craft,
            minHeight: 48,
            borderRadius: AppRadii.card,
            onPressed: () => context.go('/paths/${path['id']}'),
          ),
        ],
      ),
    );
  }
}

class PathListFiltersBar extends StatelessWidget {
  const PathListFiltersBar({
    super.key,
    required this.filter,
    required this.paths,
    required this.onChanged,
  });

  final String filter;
  final List<Map<String, dynamic>> paths;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        spacing: 8,
        children: [
          for (final item in pathListFilters)
            Tappable(
              semanticLabel:
                  '${item.label} (${filterPathSummaries(paths, item.value).length})',
              onTap: () => onChanged(item.value),
              child: Container(
                constraints: const BoxConstraints(minHeight: 38),
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 7,
                ),
                decoration: BoxDecoration(
                  color: filter == item.value
                      ? AppColors.primarySoft
                      : AppColors.surface,
                  borderRadius: BorderRadius.circular(AppRadii.full),
                  border: Border.all(
                    color: filter == item.value
                        ? Chrome.accent
                        : Chrome.border,
                  ),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  spacing: 6,
                  children: [
                    Text(
                      item.label,
                      style: nunito(
                        TypeScale.secondary,
                        weight: FontWeight.w600,
                        color: filter == item.value
                            ? Chrome.accent
                            : AppColors.body,
                      ),
                    ),
                    Container(
                      constraints: const BoxConstraints(
                        minWidth: 18,
                        minHeight: 18,
                      ),
                      padding: const EdgeInsets.symmetric(horizontal: 5),
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: filter == item.value
                            ? AppColors.surface
                            : AppColors.surfaceLow,
                        borderRadius: BorderRadius.circular(AppRadii.full),
                      ),
                      child: Text(
                        '${filterPathSummaries(paths, item.value).length}',
                        style: nunito(
                          TypeScale.caption,
                          weight: FontWeight.w600,
                          color: filter == item.value
                              ? Chrome.accent
                              : AppColors.muted,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}

String _viStamp(DateTime value) {
  final local = value.toLocal();
  String two(int n) => n.toString().padLeft(2, '0');
  return '${two(local.day)}/${two(local.month)}/${local.year}, '
      '${two(local.hour)}:${two(local.minute)}';
}
