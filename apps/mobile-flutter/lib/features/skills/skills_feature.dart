import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../components/app_button.dart';
import '../../core/toast/toast.dart';
import '../../components/feature_page.dart';
import '../../components/misc.dart';
import '../../core/http/app_error.dart';
import '../auth/session/auth_session.dart';
import '../remote/remote_load.dart';
import 'schema/skill_schema.dart';

final skillCatalogProvider = FutureProvider<List<SkillRecord>>((ref) async {
  final phase = ref.watch(sessionSnapshotProvider).phase;
  if (phase != SessionPhase.ready) return const [];
  final skills = ref.read(authRuntimeProvider).services.skills;
  return drainPages((cursor) => skills.catalog(cursor: cursor, limit: 100));
});

const _unset = Object();

class SharingSkill {
  const SharingSkill({
    required this.id,
    required this.skillId,
    required this.name,
    required this.level,
    required this.description,
    required this.visible,
    required this.status,
    this.experienceYears,
    this.reason,
    this.evidence,
    this.pendingEvidence,
    this.version = 1,
  });

  final String id;
  final String skillId;
  final String name;
  final String level;
  final String description;
  final String? experienceYears;
  final bool visible;
  final String status;
  final String? reason;
  final List<String>? evidence;
  final List<String>? pendingEvidence;
  final int version;

  SharingSkill copyWith({
    String? level,
    String? description,
    Object? experienceYears = _unset,
    bool? visible,
    String? status,
    Object? reason = _unset,
    List<String>? pendingEvidence,
  }) => SharingSkill(
    id: id,
    skillId: skillId,
    name: name,
    level: level ?? this.level,
    description: description ?? this.description,
    experienceYears: experienceYears == _unset
        ? this.experienceYears
        : experienceYears as String?,
    visible: visible ?? this.visible,
    status: status ?? this.status,
    reason: reason == _unset ? this.reason : reason as String?,
    evidence: evidence,
    pendingEvidence: pendingEvidence ?? this.pendingEvidence,
    version: version,
  );
}

SharingSkill sharingSkillFromRecord(SharingSkillRecord record) => SharingSkill(
  id: record.id,
  skillId: record.skill.id,
  name: record.skill.name,
  level: record.level,
  description: record.description,
  experienceYears: record.experienceYears,
  visible: record.isVisible ?? record.archivedAt == null,
  status: record.verificationStatus,
  version: record.version ?? 1,
);

class SkillsNotifier extends Notifier<List<SharingSkill>> {
  var _ticket = 0;

  @override
  List<SharingSkill> build() {
    final phase = ref.watch(sessionSnapshotProvider).phase;
    final userId = ref.watch(accountProvider).value?.userId;
    if (phase == SessionPhase.ready && userId != null) {
      _ticket++;
      _reload(_ticket);
    }
    return const [];
  }

  Future<void> _reload(int ticket) async {
    try {
      final skills = ref.read(authRuntimeProvider).services.skills;
      final records = await drainPages(
        (cursor) => skills.mine(cursor: cursor, limit: 50),
      );
      if (!ref.mounted || ticket != _ticket) return;
      state = [for (final record in records) sharingSkillFromRecord(record)];
    } catch (_) {
      if (!ref.mounted || ticket != _ticket) return;
      state = const [];
    }
  }

  SharingSkill? find(String? id) => state.where((s) => s.id == id).firstOrNull;

  Future<({String? id, String? error})> save(
    SharingSkill skill, {
    required bool creating,
  }) async {
    try {
      final api = ref.read(authRuntimeProvider).services.skills;
      final record = creating
          ? await api.create(
              SharingSkillInput(
                skillId: skill.skillId,
                level: skill.level,
                description: skill.description,
                experienceYears: skill.experienceYears,
              ),
            )
          : await api.change(
              skill.id,
              expectedVersion: skill.version,
              level: skill.level,
              description: skill.description,
              experienceYears: skill.experienceYears,
              isVisible: skill.visible,
            );
      final ticket = ++_ticket;
      await _reload(ticket);
      return (id: record.id, error: null);
    } catch (error) {
      return (id: null, error: errorMessage(error));
    }
  }
}

final skillsProvider = NotifierProvider<SkillsNotifier, List<SharingSkill>>(
  SkillsNotifier.new,
);

const _missing = EmptyState(
  title: 'Không tìm thấy kỹ năng',
  description: 'Kỹ năng không có trong bản xem thử.',
);

class SkillsScreen extends ConsumerWidget {
  const SkillsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final skills = ref.watch(skillsProvider);
    return FeaturePage(
      title: 'Kỹ năng chia sẻ',
      subtitle: 'Những điều bạn biết có thể là điều người khác đang cần.',
      back: '/profile',
      children: [
        const RouteButton(href: '/skills/new', label: 'Thêm kỹ năng'),
        for (final skill in skills)
          Panel(
            title: skill.name,
            children: [
              StatusBadge(
                skill.status,
                variant: skill.status == 'VERIFIED'
                    ? BadgeVariant.success
                    : BadgeVariant.warning,
              ),
              Copy(skill.description),
              Copy(
                '${uiLabel(skill.level)} · ${skill.visible ? 'Hiển thị công khai' : 'Đã ẩn khỏi tìm kiếm'}',
                muted: true,
              ),
              RouteButton(
                secondary: true,
                href: '/skills/${skill.id}',
                label: 'Xem kỹ năng',
              ),
            ],
          ),
        if (skills.isEmpty)
          const EmptyState(
            title: 'Chưa có kỹ năng',
            description: 'Thêm kỹ năng đầu tiên để bắt đầu chia sẻ.',
          ),
        const RouteButton(
          secondary: true,
          href: '/skills/history',
          label: 'Lịch sử xác minh',
        ),
      ],
    );
  }
}

class SkillEditorScreen extends ConsumerWidget {
  const SkillEditorScreen({super.key, this.id});

  final String? id;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final skills = ref.watch(skillsProvider);
    final catalog = ref.watch(skillCatalogProvider).value ?? const <SkillRecord>[];
    final catalogNames = [for (final item in catalog) item.name];
    final notifier = ref.read(skillsProvider.notifier);
    final skill = notifier.find(id);
    if (id != null && skill == null) {
      return const FeaturePage(
        title: 'Chỉnh sửa kỹ năng',
        back: '/skills',
        children: [
          EmptyState(
            title: 'Không tìm thấy kỹ năng',
            description: 'Chọn kỹ năng của bạn trong danh sách để chỉnh sửa.',
          ),
        ],
      );
    }
    return FeaturePage(
      title: skill != null ? 'Chỉnh sửa kỹ năng' : 'Thêm kỹ năng',
      back: '/skills',
      children: [
        Panel(
          title: 'Chia sẻ thế mạnh của bạn',
          children: [
            DataForm(
              defaults: skill != null
                  ? {
                      'description': skill.description,
                      'level': skill.level,
                      'experienceYears': skill.experienceYears ?? '',
                    }
                  : const {'level': 'BEGINNER'},
              fields: [
                if (skill == null)
                  DataField(
                    name: 'name',
                    label: 'Danh mục kỹ năng',
                    rule: (v) => catalogNames.contains(v)
                        ? null
                        : 'Chọn kỹ năng trong danh mục.',
                    choices: catalogNames,
                  ),
                DataField(
                  name: 'level',
                  label: 'Trình độ tự khai',
                  rule: textRule(1, 30),
                  choices: const [
                    'BEGINNER',
                    'INTERMEDIATE',
                    'ADVANCED',
                    'EXPERT',
                  ],
                ),
                DataField(
                  name: 'description',
                  label: 'Bạn có thể hướng dẫn điều gì?',
                  rule: textRule(20, 1500),
                  multiline: true,
                ),
                DataField(
                  name: 'experienceYears',
                  label: 'Số năm kinh nghiệm (không bắt buộc)',
                  numeric: true,
                  rule: (value) {
                    final v = value.trim();
                    return v.isEmpty ||
                            (RegExp(r'^\d{1,2}(\.\d)?$').hasMatch(v) &&
                                num.parse(v) <= 60)
                        ? null
                        : 'Nhập từ 0 đến 60 năm, tối đa một chữ số thập phân.';
                  },
                ),
              ],
              onSubmit: (v) async {
                if (skill == null && skills.any((s) => s.name == v['name'])) {
                  return 'Kỹ năng này đã có. Hãy chỉnh sửa kỹ năng hiện tại.';
                }
                final years = v['experienceYears']!;
                final catalogSkill = catalog
                    .where((item) => item.name == v['name'])
                    .firstOrNull;
                if (skill == null && catalogSkill == null) {
                  return 'Chọn kỹ năng trong danh mục.';
                }
                final draft = (skill ??
                        SharingSkill(
                          id: '',
                          skillId: catalogSkill!.id,
                          name: catalogSkill.name,
                          level: v['level']!,
                          description: v['description']!,
                          visible: true,
                          status: 'UNVERIFIED',
                        ))
                    .copyWith(
                      description: v['description'],
                      level: v['level'],
                      experienceYears: years.isEmpty ? null : years,
                    );
                final result = await notifier.save(
                  draft,
                  creating: skill == null,
                );
                if (result.error != null) return result.error;
                if (context.mounted) {
                  context.pushReplacement('/skills/${result.id}');
                }
                return null;
              },
            ),
          ],
        ),
      ],
    );
  }
}

class SkillDetailScreen extends ConsumerWidget {
  const SkillDetailScreen({super.key, required this.id});

  final String id;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    ref.watch(skillsProvider);
    final notifier = ref.read(skillsProvider.notifier);
    final skill = notifier.find(id);
    return FeaturePage(
      title: 'Chi tiết kỹ năng',
      back: '/skills',
      children: skill == null
          ? const [_missing]
          : [
              Panel(
                title: skill.name,
                children: [
                  StatusBadge(skill.status),
                  Copy(skill.description),
                  Copy(
                    '${uiLabel(skill.level)}${skill.experienceYears != null ? ' · ${skill.experienceYears} năm kinh nghiệm tự khai' : ''}',
                  ),
                  if (skill.reason != null)
                    FormNotice(tone: NoticeTone.error, message: skill.reason!),
                  AppButton(
                    label: skill.visible
                        ? 'Ẩn khỏi tìm kiếm'
                        : 'Hiển thị công khai',
                    variant: ButtonVariant.paper,
                    onPressed: () async {
                      final result = await notifier.save(
                        skill.copyWith(visible: !skill.visible),
                        creating: false,
                      );
                      if (result.error != null) {
                        ref
                            .read(toastProvider.notifier)
                            .show(result.error!, ToastTone.error);
                      }
                    },
                  ),
                ],
              ),
              RouteButton(
                href: '/skills/$id/edit',
                label: 'Chỉnh sửa thông tin',
              ),
              RouteButton(
                secondary: true,
                href: '/skills/$id/evidence',
                label: skill.status == 'PENDING'
                    ? 'Xem hồ sơ đang chờ'
                    : 'Gửi bằng chứng xác minh',
              ),
              const Copy(
                'Bằng chứng chỉ dành cho chủ sở hữu và người duyệt có quyền. Xác minh không tự hết hạn.',
                muted: true,
              ),
            ],
    );
  }
}

class EvidenceScreen extends ConsumerStatefulWidget {
  const EvidenceScreen({super.key, required this.id});

  final String id;

  @override
  ConsumerState<EvidenceScreen> createState() => _EvidenceScreenState();
}

class _EvidenceScreenState extends ConsumerState<EvidenceScreen> {
  String _error = '';

  @override
  Widget build(BuildContext context) {
    final id = widget.id;
    final skill = ref.watch(skillsProvider).where((item) => item.id == id).firstOrNull;
    return FeaturePage(
      title: 'Bằng chứng xác minh',
      back: '/skills/$id',
      children: [
        if (skill == null)
          const EmptyState(
            title: 'Không tìm thấy kỹ năng',
            description: 'Không thể gửi bằng chứng.',
          )
        else if (skill.status == 'PENDING' || skill.pendingEvidence != null)
          Panel(
            title: 'Đang chờ xét duyệt',
            children: [
              const Copy(
                'Staff sẽ kiểm tra hồ sơ trước khi xác minh kỹ năng. Xác minh đã duyệt trước đó vẫn giữ hiệu lực nếu chưa bị thu hồi.',
              ),
              for (final f in skill.pendingEvidence ?? skill.evidence ?? const <String>[])
                Copy(f),
              const RouteButton(
                secondary: true,
                href: '/skills/history',
                label: 'Xem lịch sử',
              ),
            ],
          )
        else
          Panel(
            title: skill.name,
            children: [
              if (skill.reason != null)
                FormNotice(
                  tone: NoticeTone.error,
                  message: 'Lần gửi trước: ${skill.reason}',
                ),
              const Copy(
                'Gửi bằng chứng cần tệp từ máy. Màn này chưa mở bộ chọn tệp, nên chưa gọi API tải lên.',
                muted: true,
              ),
              if (_error.isNotEmpty)
                FormNotice(tone: NoticeTone.error, message: _error),
              DataForm(
                fields: [
                  DataField(
                    name: 'title',
                    label: 'Tiêu đề bằng chứng',
                    rule: textRule(0, 120),
                  ),
                  DataField(
                    name: 'description',
                    label: 'Mô tả',
                    rule: textRule(0, 500),
                    multiline: true,
                  ),
                ],
                submitLabel: 'Gửi hồ sơ',
                onSubmit: (_) {
                  setState(
                    () => _error =
                        'Chọn tệp từ máy để gửi bằng chứng. Danh sách tệp mẫu đã được bỏ.',
                  );
                  return null;
                },
              ),
            ],
          ),
      ],
    );
  }
}

class VerificationHistoryScreen extends ConsumerWidget {
  const VerificationHistoryScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final skills = ref.watch(skillsProvider);
    return FeaturePage(
      title: 'Lịch sử xác minh',
      back: '/skills',
      children: [
        for (final s in skills.where((s) => s.status != 'UNVERIFIED'))
          Panel(
            title: s.name,
            children: [
              StatusBadge(s.status),
              Copy(s.reason ?? 'Trạng thái xác minh hiện tại.'),
              RouteButton(
                secondary: true,
                href: '/skills/${s.id}/evidence',
                label: 'Xem hồ sơ',
              ),
            ],
          ),
      ],
    );
  }
}
