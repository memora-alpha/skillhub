import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../components/app_button.dart';
import '../../components/app_icon.dart';
import '../../components/feature_page.dart';
import '../../components/misc.dart';
import '../../components/tappable.dart';
import '../../core/http/app_error.dart';
import '../../core/theme/tokens.dart';
import '../auth/session/auth_session.dart';
import '../remote/refresh_signal.dart';
import '../shell/app_screen_layout.dart';
import 'notification_row.dart';
import 'notification_target.dart';
import 'notifications_data.dart';

class NotificationsScreen extends ConsumerStatefulWidget {
  const NotificationsScreen({super.key});

  @override
  ConsumerState<NotificationsScreen> createState() =>
      _NotificationsScreenState();
}

class _NotificationsScreenState extends ConsumerState<NotificationsScreen> {
  var _filter = 'Tất cả';
  String? _busy;
  var _loadingMore = false;

  Future<void> _act(String id) async {
    if (_busy != null) return;
    final inbox = ref.read(notificationsInboxProvider).value;
    final item = inbox?.items.where((row) => row.id == id).firstOrNull;
    if (item == null) return;
    setState(() => _busy = id);
    try {
      if (item.unread) {
        await ref.read(notificationsInboxProvider.notifier).markRead(id);
      }
      if (!mounted) return;
      final target = notificationTarget(item);
      if (target != null) context.push(target);
    } catch (_) {
      // Inline error stays on the list; row remains retryable.
    } finally {
      if (mounted) setState(() => _busy = null);
    }
  }

  Future<void> _loadMore() async {
    if (_loadingMore) return;
    setState(() => _loadingMore = true);
    try {
      await ref.read(notificationsInboxProvider.notifier).loadMore();
    } finally {
      if (mounted) setState(() => _loadingMore = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    ref.watch(notificationUnreadCountProvider);
    final phase = ref.watch(sessionSnapshotProvider).phase;
    final query = ref.watch(notificationsInboxProvider);
    final inbox = query.value;
    final items = [
      for (final item in inbox?.items ?? const [])
        if (_filter == 'Tất cả' || item.unread) item,
    ];
    final unreadLoaded =
        inbox?.items.where((item) => item.unread).length ?? 0;
    final markError = inbox?.error;

    return WaitingRefresh(
      scopes: const {RefreshScope.inbox},
      enabled: phase == SessionPhase.ready,
      child: AppScreenLayout(
        title: 'Thông báo',
        selected: 'Thông báo',
        back: (route: '/home', label: 'Quay lại'),
        rightAction: _NotificationActions(
          refreshing: query.isLoading && inbox != null,
          disabled:
              phase != SessionPhase.ready ||
              query.isLoading ||
              _busy != null ||
              _loadingMore,
          onRefresh: () {
            ref
                .read(refreshTicksProvider.notifier)
                .bump(const {RefreshScope.inbox});
          },
        ),
        child: RefreshIndicator(
          onRefresh: () => pullRefresh(ref, const {RefreshScope.inbox}),
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
            children: [
              Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 720),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    spacing: 12,
                    children: [
                      _NotificationTabs(
                        value: _filter,
                        unreadCount: unreadLoaded,
                        hasMore: inbox?.hasMore == true,
                        onChange: (value) => setState(() => _filter = value),
                      ),
                      if (query.isLoading && inbox == null)
                        const Padding(
                          padding: EdgeInsets.symmetric(vertical: 24),
                          child: Center(
                            child: CircularProgressIndicator(strokeWidth: 2),
                          ),
                        ),
                      if (query.hasError && inbox == null)
                        FormNotice(
                          tone: NoticeTone.error,
                          message: errorMessage(query.error),
                        ),
                      if (markError != null)
                        FormNotice(
                          tone: NoticeTone.error,
                          message: errorMessage(markError),
                        ),
                      if (phase != SessionPhase.ready)
                        const Copy('Đăng nhập lại để tải thông báo.'),
                      for (final item in items) ...[
                        NotificationRow(
                          item: item,
                          busy: _busy == item.id,
                          disabled: _busy != null || phase != SessionPhase.ready,
                          onPressed: () => _act(item.id),
                        ),
                        const SizedBox(height: 10),
                      ],
                      if (!query.isLoading &&
                          query.error == null &&
                          items.isEmpty)
                        EmptyState(
                          icon: AppIcon.bell,
                          title: _filter == 'Chưa đọc'
                              ? 'Đã đọc hết thông báo đã tải'
                              : 'Chưa có thông báo',
                          description: inbox?.hasMore == true
                              ? 'Tải thêm để xem các thông báo trước đó.'
                              : 'Thông báo mới sẽ xuất hiện tại đây khi có cập nhật.',
                        ),
                      if (inbox?.hasMore == true)
                        AppButton(
                          label: _loadingMore
                              ? 'Đang tải…'
                              : 'Tải thêm thông báo',
                          variant: ButtonVariant.paper,
                          loading: _loadingMore,
                          disabled:
                              _loadingMore ||
                              query.isLoading ||
                              phase != SessionPhase.ready,
                          onPressed: _loadMore,
                        ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _NotificationTabs extends StatelessWidget {
  const _NotificationTabs({
    required this.value,
    required this.unreadCount,
    required this.hasMore,
    required this.onChange,
  });

  final String value;
  final int unreadCount;
  final bool hasMore;
  final ValueChanged<String> onChange;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        for (final option in const ['Tất cả', 'Chưa đọc'])
          Padding(
            padding: const EdgeInsets.only(right: 16),
            child: Tappable(
              semanticLabel: option == 'Chưa đọc'
                  ? 'Chưa đọc, $unreadCount thông báo trong danh sách đã tải'
                  : 'Tất cả thông báo',
              onTap: () => onChange(option),
              child: Container(
                constraints: const BoxConstraints(minHeight: 44),
                padding: const EdgeInsets.symmetric(vertical: 10),
                decoration: BoxDecoration(
                  border: Border(
                    bottom: BorderSide(
                      width: 2,
                      color: value == option
                          ? AppColors.primary
                          : Colors.transparent,
                    ),
                  ),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  spacing: 4,
                  children: [
                    Text(
                      option,
                      style: nunito(
                        TypeScale.secondary,
                        weight: value == option
                            ? FontWeight.w700
                            : FontWeight.w600,
                        color: value == option
                            ? AppColors.ink
                            : AppColors.body,
                      ),
                    ),
                    if (option == 'Chưa đọc' && unreadCount > 0)
                      Container(
                        constraints: const BoxConstraints(
                          minWidth: 20,
                          minHeight: 20,
                        ),
                        padding: const EdgeInsets.symmetric(horizontal: 5),
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color: AppColors.primary,
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Text(
                          unreadCount > 99
                              ? '99+'
                              : '$unreadCount${hasMore ? '+' : ''}',
                          style: nunito(
                            TypeScale.caption,
                            weight: FontWeight.w700,
                            color: AppColors.surface,
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ),
          ),
      ],
    );
  }
}

class _NotificationActions extends StatelessWidget {
  const _NotificationActions({
    required this.refreshing,
    required this.disabled,
    required this.onRefresh,
  });

  final bool refreshing;
  final bool disabled;
  final VoidCallback onRefresh;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      spacing: 4,
      children: [
        Tappable(
          semanticLabel: 'Làm mới thông báo',
          onTap: disabled ? null : onRefresh,
          child: Opacity(
            opacity: disabled ? 0.45 : 1,
            child: Container(
              width: 44,
              height: 44,
              alignment: Alignment.center,
              decoration: const BoxDecoration(
                color: AppColors.primarySoft,
                shape: BoxShape.circle,
              ),
              child: refreshing
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(
                      Icons.refresh,
                      size: 18,
                      color: AppColors.primary,
                    ),
            ),
          ),
        ),
        Opacity(
          opacity: 0.45,
          child: Container(
            width: 44,
            height: 44,
            alignment: Alignment.center,
            decoration: const BoxDecoration(
              color: AppColors.primarySoft,
              shape: BoxShape.circle,
            ),
            child: const Icon(
              Icons.done_all,
              size: 18,
              color: AppColors.primary,
            ),
          ),
        ),
      ],
    );
  }
}
