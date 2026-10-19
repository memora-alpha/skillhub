import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';

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
  return drainPages((cursor) => skills.catalog(cursor: cursor, limit: 50));
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
    this.archived = false,
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
  final bool archived;
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
    bool? archived,
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
    archived: archived ?? this.archived,
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
  visible: record.isVisible ?? true,
  archived: record.archivedAt != null,
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
        (cursor) => skills.mine(
          cursor: cursor,
          limit: 50,
          includeArchived: true,
        ),
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

  Future<void> reload() => _reload(++_ticket);

  Future<String?> setArchived(SharingSkill skill, {required bool archived}) async {
    try {
      final api = ref.read(authRuntimeProvider).services.skills;
      if (archived) {
        await api.archive(skill.id, expectedVersion: skill.version);
      } else {
        await api.restore(skill.id, expectedVersion: skill.version);
      }
      await _reload(++_ticket);
      return null;
    } catch (error) {
      return errorMessage(error);
    }
  }
}

final skillsProvider = NotifierProvider<SkillsNotifier, List<SharingSkill>>(
  SkillsNotifier.new,
);

class VerificationEntry {
  const VerificationEntry({
    required this.id,
    required this.skillName,
    required this.sharingSkillId,
    required this.status,
    required this.files,
    this.rejectReason,
    this.submittedAt,
  });

  final String id;
  final String skillName;
  final String sharingSkillId;
  final String status;
  final List<String> files;
  final String? rejectReason;
  final String? submittedAt;
}

final verificationHistoryProvider = FutureProvider<List<VerificationEntry>>((
  ref,
) async {
  final skills = ref.watch(skillsProvider);
  final phase = ref.watch(sessionSnapshotProvider).phase;
  if (phase != SessionPhase.ready || skills.isEmpty) return const [];
  final api = ref.read(authRuntimeProvider).services.verifications;
  final entries = <VerificationEntry>[];
  for (final skill in skills) {
    final List<Map<String, dynamic>> rows;
    try {
      rows = await api.list(skill.id);
    } catch (_) {
      continue;
    }
    for (final row in rows) {
      final files = <String>[];
      final rawFiles = row['files'];
      if (rawFiles is List) {
        for (final file in rawFiles) {
          if (file is! Map) continue;
          final title = file['title']?.toString();
          files.add(
            title != null && title.isNotEmpty
                ? title
                : file['mimeType']?.toString() ?? 'Tệp bằng chứng',
          );
        }
      }
      entries.add(
        VerificationEntry(
          id: row['id']?.toString() ?? '',
          skillName: skill.name,
          sharingSkillId: skill.id,
          status: row['status']?.toString() ?? '',
          files: files,
          rejectReason: row['rejectReason']?.toString(),
          submittedAt: row['submittedAt']?.toString(),
        ),
      );
    }
  }
  return entries;
});

final skillSharersProvider =
    FutureProvider.family<List<SharingSkillRecord>, String>((ref, skillId) async {
      final phase = ref.watch(sessionSnapshotProvider).phase;
      if (phase != SessionPhase.ready || skillId.isEmpty) return const [];
      return drainPages(
        (cursor) => ref
            .read(authRuntimeProvider)
            .services
            .skills
            .sharers(skillId, cursor: cursor, limit: 20),
      );
    });

const _missing = EmptyState(
  title: 'Không tìm thấy kỹ năng',
  description: 'Kỹ năng này không còn trong danh sách của bạn.',
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
                '${uiLabel(skill.level)} · ${_visibilityLabel(skill)}',
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
                  if (!skill.archived)
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
                  AppButton(
                    label: skill.archived ? 'Khôi phục kỹ năng' : 'Lưu trữ kỹ năng',
                    variant: ButtonVariant.paper,
                    onPressed: () async {
                      final error = await notifier.setArchived(
                        skill,
                        archived: !skill.archived,
                      );
                      if (error != null) {
                        ref.read(toastProvider.notifier).show(error, ToastTone.error);
                      }
                    },
                  ),
                ],
              ),
              if (!skill.archived)
                RouteButton(
                  href: '/skills/$id/edit',
                  label: 'Chỉnh sửa thông tin',
                ),
              if (!skill.archived)
                RouteButton(
                  secondary: true,
                  href: '/skills/$id/evidence',
                  label: skill.status == 'PENDING'
                      ? 'Xem hồ sơ đang chờ'
                      : 'Gửi bằng chứng xác minh',
                ),
              _SharersPanel(skillId: skill.skillId),
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

class _EvidenceFile {
  const _EvidenceFile({
    required this.bytes,
    required this.name,
    required this.mime,
  });

  final Uint8List bytes;
  final String name;
  final String mime;
}

class _EvidenceScreenState extends ConsumerState<EvidenceScreen> {
  String _error = '';
  _EvidenceFile? _file;

  Future<void> _pick() async {
    try {
      final picked = await ImagePicker().pickImage(
        source: ImageSource.gallery,
        requestFullMetadata: false,
      );
      if (picked == null || !mounted) return;
      final bytes = await picked.readAsBytes();
      if (!mounted) return;
      if (bytes.length > 10000000) {
        setState(() => _error = 'Tệp tối đa 10 MB.');
        return;
      }
      final mime = _imageMime(picked.name);
      setState(() {
        _file = _EvidenceFile(bytes: bytes, name: picked.name, mime: mime);
        _error = '';
      });
    } catch (_) {
      if (mounted) {
        setState(() => _error = 'Không mở được thư viện ảnh. Hãy thử lại.');
      }
    }
  }

  Future<String?> _waitUntilReady(String skillId, String fileId) async {
    final api = ref.read(authRuntimeProvider).services.verifications;
    for (var attempt = 0; attempt < 8; attempt++) {
      final status = await api.fileStatus(skillId, fileId);
      final state = status['state']?.toString();
      if (state == 'READY') return null;
      if (state == 'REJECTED' || state == 'SCAN_FAILED') {
        return 'Tệp không vượt qua kiểm tra. Hãy chọn tệp khác.';
      }
      await Future<void>.delayed(const Duration(seconds: 2));
    }
    return 'Tệp chưa được kiểm tra xong. Hãy thử gửi lại sau ít phút.';
  }

  @override
  Widget build(BuildContext context) {
    final id = widget.id;
    final skill = ref.watch(skillsProvider).where((item) => item.id == id).firstOrNull;
    final history = ref.watch(verificationHistoryProvider).value ?? const [];
    final pending = history
        .where((item) => item.sharingSkillId == id && item.status == 'PENDING')
        .firstOrNull;
    return FeaturePage(
      title: 'Bằng chứng xác minh',
      back: '/skills/$id',
      children: [
        if (skill == null)
          const EmptyState(
            title: 'Không tìm thấy kỹ năng',
            description: 'Không thể gửi bằng chứng.',
          )
        else if (skill.archived)
          const EmptyState(
            title: 'Kỹ năng đã lưu trữ',
            description: 'Khôi phục kỹ năng trước khi gửi bằng chứng.',
          )
        else if (skill.status == 'PENDING' || pending != null)
          Panel(
            title: 'Đang chờ xét duyệt',
            children: [
              const Copy(
                'Staff sẽ kiểm tra hồ sơ trước khi xác minh kỹ năng. Xác minh đã duyệt trước đó vẫn giữ hiệu lực nếu chưa bị thu hồi.',
              ),
              for (final file in pending?.files ?? const <String>[]) Copy(file),
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
                'Chọn một ảnh làm bằng chứng. Tệp được kiểm tra trước khi gửi hồ sơ xác minh.',
                muted: true,
              ),
              if (_file != null) Copy(_file!.name),
              if (_error.isNotEmpty)
                FormNotice(tone: NoticeTone.error, message: _error),
              AppButton(
                label: _file == null ? 'Chọn ảnh' : 'Chọn ảnh khác',
                variant: ButtonVariant.paper,
                onPressed: _pick,
              ),
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
                onSubmit: (values) async {
                  final file = _file;
                  if (file == null) return 'Chọn ảnh bằng chứng trước khi gửi.';
                  try {
                    final api = ref.read(authRuntimeProvider).services.verifications;
                    final uploaded = await api.uploadEvidence(
                      id,
                      FormData.fromMap({
                        'file': MultipartFile.fromBytes(
                          file.bytes,
                          filename: file.name,
                          contentType: DioMediaType.parse(file.mime),
                        ),
                      }),
                    );
                    final fileId = uploaded['fileId']?.toString() ?? '';
                    if (fileId.isEmpty) return 'Máy chủ không nhận tệp.';
                    final waitError = await _waitUntilReady(id, fileId);
                    if (waitError != null) return waitError;
                    final title = values['title']?.trim() ?? '';
                    final description = values['description']?.trim() ?? '';
                    await api.submit(id, {
                      'fileIds': [fileId],
                      if (title.isNotEmpty) 'title': title,
                      if (description.isNotEmpty) 'description': description,
                    });
                    ref.invalidate(verificationHistoryProvider);
                    await ref.read(skillsProvider.notifier).reload();
                    return null;
                  } catch (error) {
                    return errorMessage(error);
                  }
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
    final history = ref.watch(verificationHistoryProvider);
    final entries = history.value ?? const <VerificationEntry>[];
    return FeaturePage(
      title: 'Lịch sử xác minh',
      back: '/skills',
      children: [
        if (history.isLoading && entries.isEmpty)
          const Copy('Đang tải lịch sử xác minh.', muted: true)
        else if (entries.isEmpty)
          const EmptyState(
            title: 'Chưa có hồ sơ xác minh',
            description: 'Các lần gửi bằng chứng sẽ xuất hiện tại đây.',
          )
        else
          for (final entry in entries)
            Panel(
              title: entry.skillName,
              children: [
                StatusBadge(entry.status),
                if (entry.rejectReason != null && entry.rejectReason!.isNotEmpty)
                  Copy(entry.rejectReason!),
                for (final file in entry.files) Copy(file, muted: true),
                RouteButton(
                  secondary: true,
                  href: '/skills/${entry.sharingSkillId}/evidence',
                  label: 'Xem hồ sơ',
                ),
              ],
            ),
      ],
    );
  }
}

String _imageMime(String name) {
  final lower = name.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
}

String _visibilityLabel(SharingSkill skill) {
  if (skill.archived) return 'Đã lưu trữ';
  if (skill.visible) return 'Hiển thị công khai';
  return 'Đã ẩn khỏi tìm kiếm';
}

class _SharersPanel extends ConsumerWidget {
  const _SharersPanel({required this.skillId});

  final String skillId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final sharers = ref.watch(skillSharersProvider(skillId)).value ?? const [];
    final mine = ref.watch(accountProvider).value?.userId;
    final others = [
      for (final sharer in sharers)
        if (sharer.ownerId != null && sharer.ownerId != mine) sharer,
    ];
    if (others.isEmpty) return const SizedBox.shrink();
    return Panel(
      title: 'Người đang chia sẻ',
      children: [
        for (final sharer in others)
          RouteButton(
            secondary: true,
            href: '/user/${sharer.ownerId}',
            label: '${sharer.ownerName ?? 'Người dùng'} · ${uiLabel(sharer.level)}',
          ),
      ],
    );
  }
}
