import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../components/app_button.dart';
import '../../components/feature_page.dart';
import '../../components/misc.dart';
import '../../core/toast/toast.dart';
import '../remote/refresh_signal.dart';
import 'live_request_editor.dart';
import 'requests_state.dart';
import 'schema/learning_request_schema.dart';

export 'requests_state.dart';

const _editable = ['DRAFT', 'OPEN', 'PENDING_MODERATION', 'REJECTED'];

class MyRequestsScreen extends ConsumerStatefulWidget {
  const MyRequestsScreen({super.key});

  @override
  ConsumerState<MyRequestsScreen> createState() => _MyRequestsScreenState();
}

class _MyRequestsScreenState extends ConsumerState<MyRequestsScreen> {
  String _filter = 'Tất cả';

  @override
  Widget build(BuildContext context) {
    final all = ref.watch(requestsProvider);
    final items = all
        .where((r) => _filter == 'Tất cả' || r.status == _filter)
        .toList();
    return FeaturePage(
      onRefresh: () => pullRefresh(ref, const {RefreshScope.requests}),
      title: 'Yêu cầu học của tôi',
      back: '/discover',
      subtitle: 'Quản lý nhu cầu học, bài nháp và phản hồi kiểm duyệt.',
      children: [
        WaitingRefresh(
          scopes: const {RefreshScope.requests},
          enabled: all.any((request) => request.status == 'PENDING_MODERATION'),
          child: const SizedBox.shrink(),
        ),
        const RouteButton(href: '/requests/new', label: 'Đăng yêu cầu học'),
        ChoiceGroup(
          label: 'Trạng thái',
          options: const [
            'Tất cả',
            'DRAFT',
            'PENDING_MODERATION',
            'OPEN',
            'REJECTED',
            'MATCHED',
            'CANCELLED',
          ],
          value: _filter,
          onChange: (value) => setState(() => _filter = value),
        ),
        for (final r in items)
          Panel(
            title: r.title,
            children: [
              StatusBadge(r.status),
              Copy(r.goal),
              RouteButton(
                secondary: true,
                href: '/requests/${r.id}',
                label: 'Xem yêu cầu',
              ),
            ],
          ),
        if (items.isEmpty)
          const EmptyState(
            title: 'Chưa có yêu cầu ở trạng thái này',
            description: 'Thử bộ lọc khác hoặc tạo yêu cầu mới.',
          ),
      ],
    );
  }
}

class RequestEditorScreen extends StatelessWidget {
  const RequestEditorScreen({super.key, this.id});

  final String? id;

  @override
  Widget build(BuildContext context) => LiveRequestEditor(id: id);
}

class OwnRequestScreen extends ConsumerStatefulWidget {
  const OwnRequestScreen({super.key, required this.id});

  final String id;

  @override
  ConsumerState<OwnRequestScreen> createState() => _OwnRequestScreenState();
}

class _OwnRequestScreenState extends ConsumerState<OwnRequestScreen> {
  bool _cancel = false;

  @override
  Widget build(BuildContext context) {
    final id = widget.id;
    ref.watch(requestsProvider);
    final notifier = ref.read(requestsProvider.notifier);
    final request = notifier.find(id);
    return WaitingRefresh(
      enabled: request?.status == 'PENDING_MODERATION',
      scopes: const {RefreshScope.requests},
      child: FeaturePage(
      onRefresh: () => pullRefresh(ref, const {RefreshScope.requests}),
      title: 'Chi tiết yêu cầu của tôi',
      back: '/requests',
      children: request == null
          ? const [
              EmptyState(
                title: 'Không tìm thấy yêu cầu',
                description: 'Yêu cầu không còn trên máy chủ hoặc không thuộc về bạn.',
              ),
            ]
          : [
              Panel(
                title: request.title,
                children: [
                  StatusBadge(request.status),
                  Copy(
                    request.level.isEmpty
                        ? request.skill
                        : '${request.skill} · ${uiLabel(request.level)}',
                  ),
                  Copy(request.description),
                  Copy('Mục tiêu: ${request.goal}'),
                  if ((request.teachingOverview ?? '').isNotEmpty)
                    Copy('Có thể dạy: ${request.teachingOverview}'),
                  if (request.verifiedTeacherOnly)
                    const Copy('Chỉ nhận người dạy có kỹ năng đã xác minh.'),
                  if ((request.desiredCreditPerHour ?? '').isNotEmpty)
                    Copy('Mong muốn: ${request.desiredCreditPerHour} CR/giờ'),
                  if (request.tags.isNotEmpty)
                    Copy('Tag: ${request.tags.join(', ')}'),
                  if (request.expiresAt != null)
                    Copy('Hạn yêu cầu: ${viDateTime(request.expiresAt!)}'),
                  for (final slot
                      in request.preferredAvailability?.weeklySlots ??
                          const <WeeklySlot>[])
                    Copy(
                      'Ưu tiên: ${weekdayLabel(slot.weekday)} ${slot.startTime}–${slot.endTime} (lặp hằng tuần, chưa chốt lịch)',
                    ),
                  for (final slot in request.preferredSlots)
                    Copy(
                      'Ưu tiên: ${viDateTime(slot.startAt)} → ${viDateTime(slot.endAt)} (chưa chốt lịch)',
                    ),
                  if (request.reason != null)
                    FormNotice(
                      tone: NoticeTone.error,
                      message: 'Lý do từ chối: ${request.reason}',
                    ),
                  if (request.status == 'PENDING_MODERATION')
                    const FormNotice(
                      tone: NoticeTone.info,
                      message: 'Bài đang chờ duyệt và chưa nhận đề xuất mới.',
                    ),
                  if (request.status == 'MATCHED')
                    const FormNotice(
                      tone: NoticeTone.info,
                      message:
                          'Lịch đã khóa. Hãy sử dụng đổi lịch hoặc báo cáo trong lộ trình.',
                    ),
                ],
              ),
              if (_editable.contains(request.status))
                RouteButton(
                  secondary: true,
                  href: '/requests/$id/edit',
                  label: 'Chỉnh sửa yêu cầu',
                ),
              if (request.status == 'DRAFT')
                AsyncAppButton(
                  label: 'Đăng yêu cầu',
                  busyLabel: 'Đang đăng...',
                  variant: ButtonVariant.craft,
                  onPressed: () async {
                    final error = await notifier.publish(request);
                    if (error != null) {
                      ref
                          .read(toastProvider.notifier)
                          .show(error, ToastTone.error);
                    }
                  },
                ),
              if (request.status == 'OPEN')
                const RouteButton(
                  href: '/proposals',
                  label: 'Xem đề xuất nhận được',
                ),
              if (!const ['MATCHED', 'CANCELLED', 'EXPIRED'].contains(request.status))
                AppButton(
                  label: 'Hủy yêu cầu',
                  variant: ButtonVariant.paper,
                  onPressed: () => setState(() => _cancel = true),
                ),
              if (_cancel)
                Panel(
                  title: 'Hủy yêu cầu này?',
                  children: [
                    const Copy(
                      'Lịch sử đề xuất được giữ lại. Bài sẽ không nhận đề xuất mới.',
                    ),
                    AsyncAppButton(
                      label: 'Xác nhận hủy',
                      busyLabel: 'Đang hủy...',
                      onPressed: () async {
                        final error = await notifier.cancel(request);
                        if (!mounted) return;
                        if (error != null) {
                          ref
                              .read(toastProvider.notifier)
                              .show(error, ToastTone.error);
                          return;
                        }
                        setState(() => _cancel = false);
                      },
                    ),
                    AppButton(
                      label: 'Giữ yêu cầu',
                      variant: ButtonVariant.paper,
                      onPressed: () => setState(() => _cancel = false),
                    ),
                  ],
                ),
            ],
      ),
    );
  }
}
