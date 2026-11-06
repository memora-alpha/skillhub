import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';

import '../../components/feature_page.dart';
import '../../components/misc.dart';
import '../../core/http/app_error.dart';
import '../auth/session/auth_session.dart';
import '../remote/refresh_signal.dart';
import '../materials/materials_feature.dart';
import '../sessions/live_sessions.dart';
import 'report_policy.dart';

class PreviewReport {
  const PreviewReport({
    required this.id,
    required this.target,
    required this.targetId,
    required this.description,
    required this.reason,
    required this.files,
    required this.status,
    this.pathId,
    this.note,
    this.additional,
  });

  final String id;
  final String target;
  final String targetId;
  final String? pathId;
  final String description;
  final String reason;
  final List<String> files;
  final String status;
  final String? note;
  final String? additional;
}

class ReportsNotifier extends Notifier<List<PreviewReport>> {
  var _ticket = 0;

  @override
  List<PreviewReport> build() {
    listenForRefresh(ref, RefreshScope.reports, () {
      if (ref.read(sessionSnapshotProvider).phase != SessionPhase.ready) return;
      if (ref.read(accountProvider).value?.userId == null) return;
      reload();
    });
    final phase = ref.watch(sessionSnapshotProvider).phase;
    final userId = ref.watch(accountProvider).value?.userId;
    if (phase == SessionPhase.ready && userId != null) {
      _ticket++;
      _load(_ticket);
    }
    return const [];
  }

  Future<void> _load(int ticket) async {
    try {
      final rows = await ref.read(authRuntimeProvider).services.study.myReports();
      if (!ref.mounted || ticket != _ticket) return;
      state = [
        for (final row in rows)
          PreviewReport(
            id: row['id']?.toString() ?? '',
            target: row['targetType']?.toString() ?? 'SESSION',
            targetId: row['targetId']?.toString() ?? '',
            pathId: row['relatedPathId']?.toString(),
            description: row['description']?.toString() ?? '',
            reason: row['reasonCode']?.toString() ?? '',
            note: row['resolutionNote']?.toString(),
            files: [for (final file in row['reportEvidenceCaseIdRecords'] is List ? row['reportEvidenceCaseIdRecords'] as List : const []) if (file is Map) '${file['mimeType']} · ${file['fileSizeBytes']} byte'],
            status: row['status']?.toString() ?? '',
          ),
      ];
    } catch (_) {
      if (!ref.mounted || ticket != _ticket) return;
      state = const [];
    }
  }

  PreviewReport? find(String id) => state.where((r) => r.id == id).firstOrNull;

  Future<void> reload() => _load(++_ticket);

  void save(PreviewReport report) =>
      state = [report, ...state.where((r) => r.id != report.id)];
}

final reportsProvider =
    NotifierProvider<ReportsNotifier, List<PreviewReport>>(ReportsNotifier.new);

class ReportsScreen extends ConsumerStatefulWidget {
  const ReportsScreen({super.key});

  @override
  ConsumerState<ReportsScreen> createState() => _ReportsScreenState();
}

class _ReportsScreenState extends ConsumerState<ReportsScreen> {
  String _filter = 'Tất cả';

  @override
  Widget build(BuildContext context) {
    final all = ref.watch(reportsProvider);
    final items = all
        .where((r) => _filter == 'Tất cả' || r.status == _filter)
        .toList();
    return FeaturePage(
      onRefresh: () => pullRefresh(ref, const {RefreshScope.reports}),
      title: 'Báo cáo của tôi',
      back: '/profile',
      children: [
        WaitingRefresh(
          scopes: const {RefreshScope.reports},
          enabled: all.any(
            (report) =>
                report.status != 'RESOLVED' && report.status != 'REJECTED',
          ),
          child: const SizedBox.shrink(),
        ),
        ChoiceGroup(
          label: 'Trạng thái',
          options: const [
            'Tất cả',
            'OPEN',
            'UNDER_REVIEW',
            'NEED_MORE_INFO',
            'RESOLVED',
            'REJECTED',
          ],
          value: _filter,
          onChange: (value) => setState(() => _filter = value),
        ),
        for (final r in items)
          Panel(
            title: 'Báo cáo ${r.id}',
            children: [
              StatusBadge(r.status),
              Copy(r.description),
              RouteButton(
                secondary: true,
                href: '/reports/${r.id}',
                label: 'Theo dõi báo cáo',
              ),
            ],
          ),
        if (items.isEmpty)
          const EmptyState(
            title: 'Không có báo cáo',
            description:
                'Báo cáo được gửi từ buổi học hoặc chi tiết tài liệu liên quan.',
          ),
        const RouteButton(
          secondary: true,
          href: '/learning-history',
          label: 'Chọn buổi học cần báo cáo',
        ),
      ],
    );
  }
}

class ReportEditorScreen extends ConsumerStatefulWidget {
  const ReportEditorScreen({
    super.key,
    this.pathId,
    this.sessionId,
    this.materialId,
  });

  final String? pathId;
  final String? sessionId;
  final String? materialId;

  @override
  ConsumerState<ReportEditorScreen> createState() => _ReportEditorScreenState();
}

class _ReportEditorScreenState extends ConsumerState<ReportEditorScreen> {
  List<String> _files = const [];

  @override
  Widget build(BuildContext context) {
    final ReportEditorScreen(:pathId, :sessionId, :materialId) = widget;
    final detail = sessionId == null ? null : ref.watch(liveSessionProvider(sessionId));
    final session = detail?.value;
    final userId = ref.watch(accountProvider).value?.userId;
    final materials = ref.watch(materialsProvider).materials;
    final valid =
        (materialId != null &&
            materials.any(
              (m) =>
                  m.id == materialId &&
                  m.status == 'PUBLISHED' &&
                  m.owner == 'partner',
            )) ||
        (sessionId != null &&
            pathId != null &&
            detail != null && !detail.isLoading && !detail.hasError &&
            session?['id'] == sessionId && session?['pathId'] == pathId &&
            session?['status'] != 'CANCELLED' && userId != null &&
            [session?['teacherId'], session?['learnerId']].contains(userId));
    return FeaturePage(
      onRefresh: () => pullRefresh(ref, const {RefreshScope.reports, RefreshScope.study}),
      title: materialId != null ? 'Báo cáo tài liệu' : 'Báo cáo buổi học',
      back: materialId != null
          ? '/materials/$materialId'
          : sessionId != null
          ? '/learning-sessions/$sessionId'
          : '/reports',
      children: [
        if (detail?.isLoading == true) const Center(child: CircularProgressIndicator())
        else if (detail?.hasError == true) FormNotice(tone: NoticeTone.error, message: errorMessage(detail?.error))
        else if (!valid)
          const EmptyState(
            title: 'Chưa chọn đối tượng hợp lệ',
            description: 'Mở báo cáo từ buổi học hoặc tài liệu liên quan.',
          )
        else
          Panel(
            title: 'Mô tả điều đã xảy ra',
            children: [
              Copy(
                'Đối tượng: ${materialId ?? sessionId}${pathId != null ? ' · lộ trình $pathId' : ''}',
              ),
              if (sessionId != null) ...[
                const Copy('Báo cáo dành cho sự cố kỹ thuật hoặc vấn đề khác. Vắng học, hủy buổi và học bù có luồng xử lý riêng, không cần tạo báo cáo.'),
                RouteButton(href: '/learning-sessions/$sessionId', label: 'Xử lý vắng học / hủy buổi', secondary: true),
              ],
              SampleFiles(
                value: _files,
                onChange: (files) => setState(() => _files = files),
              ),
              DataForm(
                defaults: const {'reason': 'TECHNICAL_ISSUE'},
                fields: [
                  DataField(
                    name: 'reason',
                    label: 'Loại vấn đề',
                    rule: (v) =>
                        reportReasons.contains(v) ? null : 'Chọn loại vấn đề.',
                    choices: reportReasons,
                  ),
                  DataField(
                    name: 'description',
                    label: 'Nội dung báo cáo',
                    rule: textRule(20, 2000),
                    multiline: true,
                  ),
                ],
                submitLabel: sessionId == null ? 'Gửi báo cáo mẫu' : 'Gửi báo cáo',
                onSubmit: (v) async {
                  if (sessionId == null) {
                    final id = 'report-${DateTime.now().millisecondsSinceEpoch}';
                    ref.read(reportsProvider.notifier).save(
                      PreviewReport(
                        id: id,
                        target: 'MATERIAL',
                        targetId: materialId!,
                        description: v['description']!,
                        reason: v['reason']!,
                        files: _files,
                        status: 'OPEN',
                      ),
                    );
                    context.pushReplacement('/reports/$id');
                    return null;
                  }
                  try {
                    final study = ref.read(authRuntimeProvider).services.study;
                    final fileIds = <String>[];
                    final picked = await ImagePicker().pickImage(
                      source: ImageSource.gallery,
                      requestFullMetadata: false,
                    );
                    if (picked != null) {
                      final bytes = await picked.readAsBytes();
                      final uploaded = await study.uploadReportEvidence(
                        FormData.fromMap({
                          'file': MultipartFile.fromBytes(
                            bytes,
                            filename: picked.name,
                          ),
                        }),
                      );
                      final fileId = uploaded['fileId']?.toString() ?? '';
                      if (fileId.isNotEmpty) {
                        await study.reportEvidenceStatus(fileId);
                        fileIds.add(fileId);
                      }
                    }
                    final fresh = await study.session(sessionId);
                    if (!context.mounted) return null;
                    if (fresh['id'] != sessionId || fresh['pathId'] != pathId || fresh['status'] == 'CANCELLED') throw const AppError.protocol();
                    final created = await study.reportSession(sessionId, {
                      'reasonCode': v['reason'],
                      'description': v['description'],
                      'evidenceFileIds': fileIds,
                    });
                    if (context.mounted) {
                      context.pushReplacement('/reports/${created['id']}');
                    }
                    return null;
                  } catch (error) {
                    return errorMessage(error);
                  }
                },
              ),
              const Copy(
                'Báo cáo tài liệu không cần lộ trình hoặc buổi học. Thời hạn tranh chấp và giới hạn tệp phụ thuộc chính sách được cấu hình.',
                muted: true,
              ),
            ],
          ),
      ],
    );
  }
}

class ReportDetailScreen extends ConsumerStatefulWidget {
  const ReportDetailScreen({super.key, required this.id});

  final String id;

  @override
  ConsumerState<ReportDetailScreen> createState() => _ReportDetailScreenState();
}

class _ReportDetailScreenState extends ConsumerState<ReportDetailScreen> {

  @override
  Widget build(BuildContext context) {
    ref.watch(reportsProvider);
    final notifier = ref.read(reportsProvider.notifier);
    final r = notifier.find(widget.id);
    final open = r != null && r.status != 'RESOLVED' && r.status != 'REJECTED';
    return WaitingRefresh(
      scopes: const {RefreshScope.reports},
      enabled: open,
      child: FeaturePage(
      onRefresh: () => pullRefresh(ref, const {RefreshScope.reports}),
      title: 'Theo dõi báo cáo',
      back: '/reports',
      children: r == null
          ? const [
              EmptyState(
                title: 'Không tìm thấy báo cáo',
                description: 'Chưa tải được báo cáo hoặc bạn không có quyền xem. Kéo xuống để thử lại.',
              ),
            ]
          : [
              Panel(
                title: 'Báo cáo ${r.id}',
                children: [
                  StatusBadge(r.status),
                  Copy('${reportReasonLabel(r.reason)} · ${r.targetId}'),
                  Copy(r.description),
                  for (final f in r.files) Copy('Bằng chứng riêng tư: $f'),
                  if (r.note != null) Copy('Phản hồi xử lý: ${r.note}'),
                  if (r.additional != null) Copy('Bổ sung: ${r.additional}'),
                ],
              ),
              if (r.status == 'NEED_MORE_INFO')
                const Panel(
                  title: 'Bổ sung thông tin',
                  children: [
                    Copy('Nhân sự yêu cầu bổ sung. API gửi bổ sung trực tiếp vào vụ việc hiện chưa có; nội dung chưa được gửi không thể chuyển trạng thái xử lý trên máy chủ.'),
                  ],
                ),
              if (r.pathId != null)
                RouteButton(
                  secondary: true,
                  href: '/paths/${r.pathId}',
                  label: 'Xem lộ trình liên quan',
                ),
            ],
      ),
    );
  }
}
