import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/http/app_error.dart';
import '../auth/session/auth_session.dart';
import '../product_shell/schema/notification_schema.dart';
import '../remote/refresh_signal.dart';
import '../shell/inbox_count.dart';

class NotificationsInbox {
  const NotificationsInbox({
    required this.items,
    required this.nextCursor,
    this.error,
  });

  final List<NotificationRecord> items;
  final String? nextCursor;
  final Object? error;

  bool get hasMore => nextCursor != null && nextCursor!.isNotEmpty;

  NotificationsInbox copyWith({
    List<NotificationRecord>? items,
    String? nextCursor,
    Object? error,
    bool clearError = false,
    bool clearCursor = false,
  }) => NotificationsInbox(
    items: items ?? this.items,
    nextCursor: clearCursor ? null : (nextCursor ?? this.nextCursor),
    error: clearError ? null : (error ?? this.error),
  );
}

class NotificationsInboxNotifier extends AsyncNotifier<NotificationsInbox> {
  var _ticket = 0;

  @override
  Future<NotificationsInbox> build() async {
    watchRefresh(ref, RefreshScope.inbox);
    _ticket++;
    final phase = ref.watch(sessionSnapshotProvider).phase;
    if (phase != SessionPhase.ready) {
      return const NotificationsInbox(items: [], nextCursor: null);
    }
    final page = await ref
        .read(authRuntimeProvider)
        .services
        .notifications
        .list(limit: 20);
    unawaited(_refreshUnreadCount());
    return NotificationsInbox(
      items: page.items,
      nextCursor: page.nextCursor,
    );
  }

  Future<void> reload() async {
    ref.read(refreshTicksProvider.notifier).bump(const {RefreshScope.inbox});
    await future;
  }

  Future<void> loadMore() async {
    final current = state.value;
    if (current == null || !current.hasMore || state.isLoading) return;
    final cursor = current.nextCursor;
    final ticket = _ticket;
    try {
      final page = await ref
          .read(authRuntimeProvider)
          .services
          .notifications
          .list(cursor: cursor, limit: 20);
      if (ticket != _ticket) return;
      final seen = {for (final item in current.items) item.id};
      state = AsyncData(
        current.copyWith(
          items: [
            ...current.items,
            for (final item in page.items)
              if (!seen.contains(item.id)) item,
          ],
          nextCursor: page.nextCursor,
          clearCursor: page.nextCursor == null || page.nextCursor!.isEmpty,
          clearError: true,
        ),
      );
      unawaited(_refreshUnreadCount());
    } catch (error) {
      if (ticket != _ticket) return;
      state = AsyncData(current.copyWith(error: error));
    }
  }

  Future<void> markRead(String id) async {
    final current = state.value;
    if (current == null) return;
    final before = current.items;
    final next = [
      for (final item in before)
        item.id == id && item.unread ? item.markRead() : item,
    ];
    state = AsyncData(current.copyWith(items: next, clearError: true));
    _syncBadge(next);
    try {
      await ref.read(authRuntimeProvider).services.notifications.markRead(id);
      unawaited(_refreshUnreadCount());
    } catch (error) {
      state = AsyncData(
        current.copyWith(items: before, error: error),
      );
      _syncBadge(before);
      rethrow;
    }
  }

  void _syncBadge(List<NotificationRecord> items) {
    final unread = items.where((item) => item.unread).length;
    ref.read(inboxCountProvider.notifier).setCount(unread > 99 ? 100 : unread);
  }

  Future<void> _refreshUnreadCount() async {
    try {
      final count = await _countUnread(ref);
      if (!ref.mounted) return;
      ref.read(inboxCountProvider.notifier).setCount(count);
    } catch (_) {}
  }
}

final notificationsInboxProvider =
    AsyncNotifierProvider<NotificationsInboxNotifier, NotificationsInbox>(
      NotificationsInboxNotifier.new,
    );

final notificationUnreadCountProvider = FutureProvider<int>((ref) async {
  watchRefresh(ref, RefreshScope.inbox);
  final phase = ref.watch(sessionSnapshotProvider).phase;
  if (phase != SessionPhase.ready) return 0;
  final count = await _countUnread(ref);
  ref.read(inboxCountProvider.notifier).setCount(count);
  return count;
});

Future<int> _countUnread(Ref ref) async {
  var cursor = null as String?;
  var count = 0;
  final seen = <String>{};
  final ids = <String>{};
  do {
    final page = await ref
        .read(authRuntimeProvider)
        .services
        .notifications
        .list(cursor: cursor, limit: 50);
    for (final item in page.items) {
      if (!ids.contains(item.id) && item.unread) count++;
      ids.add(item.id);
    }
    if (count > 99) return 100;
    cursor = page.nextCursor;
    if (cursor != null && cursor.isNotEmpty) {
      if (!seen.add(cursor)) throw const AppError.protocol();
    }
  } while (cursor != null && cursor.isNotEmpty);
  return count;
}
