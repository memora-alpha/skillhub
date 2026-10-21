import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../components/app_button.dart';
import '../../components/feature_page.dart';
import '../../components/misc.dart';
import '../../core/http/app_error.dart';
import '../../core/toast/toast.dart';
import '../auth/session/auth_session.dart';
import '../remote/remote_load.dart';
import 'schema/skill_schema.dart';

class TagsScreen extends ConsumerWidget {
  const TagsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tags = ref.watch(_tagsProvider);
    final requests = ref.watch(_tagRequestsProvider);
    return FeaturePage(
      title: 'Thẻ kỹ năng',
      back: '/skills',
      children: [
        DataForm(
          fields: [
            DataField(
              name: 'label',
              label: 'Tên thẻ muốn đề xuất',
              rule: (value) {
                final label = value.trim();
                if (label.isEmpty || label.length > 80) {
                  return 'Tên thẻ từ 1 đến 80 ký tự.';
                }
                return null;
              },
            ),
          ],
          submitLabel: 'Gửi đề xuất',
          onSubmit: (values) async {
            try {
              await ref
                  .read(authRuntimeProvider)
                  .services
                  .skills
                  .requestTag(values['label']!.trim());
              ref.invalidate(_tagRequestsProvider);
              return null;
            } catch (error) {
              return errorMessage(error);
            }
          },
        ),
        for (final tag in tags.value ?? const <TagRecord>[])
          Panel(title: tag.label, children: [Copy(tag.id, muted: true)]),
        if ((tags.value ?? const []).isEmpty)
          const EmptyState(
            title: 'Chưa có thẻ',
            description: 'Danh mục thẻ đang hoạt động sẽ hiện tại đây.',
          ),
        for (final request in requests.value ?? const <Map<String, dynamic>>[])
          Panel(
            title: request['label']?.toString() ?? 'Đề xuất',
            children: [
              StatusBadge(request['status']?.toString() ?? ''),
              Copy(request['rejectReason']?.toString() ?? '', muted: true),
              AppButton(
                label: 'Xem chi tiết đề xuất',
                variant: ButtonVariant.paper,
                onPressed: () async {
                  try {
                    final detail = await ref
                        .read(authRuntimeProvider)
                        .services
                        .skills
                        .tagRequest(request['id'].toString());
                    ref.read(toastProvider.notifier).show(
                      '${detail['status']} · ${detail['label']}',
                      ToastTone.success,
                    );
                  } catch (error) {
                    ref
                        .read(toastProvider.notifier)
                        .show(errorMessage(error), ToastTone.error);
                  }
                },
              ),
            ],
          ),
      ],
    );
  }
}

final _tagsProvider = FutureProvider<List<TagRecord>>((ref) async {
  final phase = ref.watch(sessionSnapshotProvider).phase;
  if (phase != SessionPhase.ready) return const [];
  return drainPages(
    (cursor) => ref
        .read(authRuntimeProvider)
        .services
        .skills
        .tags(cursor: cursor, limit: 50),
  );
});

final _tagRequestsProvider = FutureProvider<List<Map<String, dynamic>>>((
  ref,
) async {
  final phase = ref.watch(sessionSnapshotProvider).phase;
  if (phase != SessionPhase.ready) return const [];
  return drainPages(
    (cursor) => ref
        .read(authRuntimeProvider)
        .services
        .skills
        .myTagRequests(cursor: cursor, limit: 20),
  );
});

class CatalogSkillScreen extends ConsumerWidget {
  const CatalogSkillScreen({super.key, required this.skillId});

  final String skillId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final skill = ref.watch(_catalogSkillProvider(skillId));
    final levels = ref.watch(_levelsProvider(skillId));
    final record = skill.value;
    return FeaturePage(
      title: record?.name ?? 'Kỹ năng trong danh mục',
      back: '/skills',
      children: [
        if (skill.isLoading)
          const Copy('Đang tải danh mục.', muted: true)
        else if (skill.hasError)
          Copy(errorMessage(skill.error))
        else if (record != null)
          Panel(
            title: record.name,
            children: [
              StatusBadge(record.status),
              if (record.description != null) Copy(record.description!),
              Copy(record.slug, muted: true),
            ],
          ),
        for (final level in levels.value ?? const <Map<String, dynamic>>[])
          Panel(
            title: level['name']?.toString() ?? '',
            children: [
              Copy(level['code']?.toString() ?? '', muted: true),
              if (level['description'] != null)
                Copy(level['description'].toString()),
            ],
          ),
      ],
    );
  }
}

final _catalogSkillProvider = FutureProvider.family<SkillRecord?, String>((
  ref,
  skillId,
) async {
  final phase = ref.watch(sessionSnapshotProvider).phase;
  if (phase != SessionPhase.ready || skillId.isEmpty) return null;
  return ref.read(authRuntimeProvider).services.skills.skill(skillId);
});

final _levelsProvider = FutureProvider.family<List<Map<String, dynamic>>, String>((
  ref,
  skillId,
) async {
  final phase = ref.watch(sessionSnapshotProvider).phase;
  if (phase != SessionPhase.ready || skillId.isEmpty) return const [];
  return ref.read(authRuntimeProvider).services.skills.levels(skillId);
});

class VerificationDetailScreen extends ConsumerWidget {
  const VerificationDetailScreen({
    super.key,
    required this.sharingSkillId,
    required this.verificationId,
  });

  final String sharingSkillId;
  final String verificationId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final detail = ref.watch(
      _verificationProvider((sharingSkillId, verificationId)),
    );
    final data = detail.value ?? const {};
    final files = data['evidence'] ?? data['files'];
    return FeaturePage(
      title: 'Hồ sơ xác minh',
      back: '/skills/history',
      children: [
        if (detail.isLoading && data.isEmpty)
          const Copy('Đang tải hồ sơ.', muted: true)
        else if (detail.hasError)
          Copy(errorMessage(detail.error))
        else
          Panel(
            title: data['status']?.toString() ?? 'Hồ sơ',
            children: [
              if (data['title'] != null) Copy(data['title'].toString()),
              if (data['description'] != null) Copy(data['description'].toString()),
              if (files is List)
                for (final file in files)
                  if (file is Map && file['id'] != null)
                    _DownloadLink(
                      sharingSkillId: sharingSkillId,
                      evidenceId: file['id'].toString(),
                      label: file['fileName']?.toString() ?? 'Tải bằng chứng',
                    ),
            ],
          ),
      ],
    );
  }
}

class _DownloadLink extends ConsumerWidget {
  const _DownloadLink({
    required this.sharingSkillId,
    required this.evidenceId,
    required this.label,
  });

  final String sharingSkillId;
  final String evidenceId;
  final String label;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return AppButton(
      label: label,
      variant: ButtonVariant.paper,
      onPressed: () async {
        try {
          final link = await ref
              .read(authRuntimeProvider)
              .services
              .verifications
              .download(sharingSkillId, evidenceId);
          ref
              .read(toastProvider.notifier)
              .show(link['url']?.toString() ?? 'Đã lấy liên kết tải.', ToastTone.success);
        } catch (error) {
          ref.read(toastProvider.notifier).show(errorMessage(error), ToastTone.error);
        }
      },
    );
  }
}

final _verificationProvider = FutureProvider.family<
  Map<String, dynamic>,
  (String, String)
>((ref, ids) async {
  final phase = ref.watch(sessionSnapshotProvider).phase;
  if (phase != SessionPhase.ready) return const {};
  return ref
      .read(authRuntimeProvider)
      .services
      .verifications
      .get(ids.$1, ids.$2);
});
