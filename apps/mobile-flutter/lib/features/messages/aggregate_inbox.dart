import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../components/app_button.dart';
import '../../components/feature_page.dart';
import '../../components/misc.dart';
import '../../core/http/app_error.dart';
import '../../core/theme/tokens.dart';
import '../auth/session/auth_session.dart';
import '../remote/refresh_signal.dart';
import '../shell/app_screen_layout.dart';
import 'schema/inbox_schema.dart';

class AggregateInboxScreen extends ConsumerStatefulWidget {
  const AggregateInboxScreen({super.key, this.requestId, this.title});
  final String? requestId, title;
  @override
  ConsumerState<AggregateInboxScreen> createState() => _AggregateInboxState();
}

class _AggregateInboxState extends ConsumerState<AggregateInboxScreen> {
  final _groups = <InboxGroup>[];
  final _chats = <MapEntry<String, String>>[];
  final _seen = <String>{};
  String? _cursor, _error;
  var _loading = false;
  var _ticket = 0;
  int? _owner;
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _load(reset: true);
    });
  }

  Future<void> _load({bool reset = false}) async {
    if (!mounted || (_loading && !reset)) return;
    final session = ref.read(sessionSnapshotProvider);
    final ticket = ++_ticket;
    final cursor = reset ? null : _cursor;
    setState(() {
      _loading = true;
      _error = null;
      if (reset) {
        _groups.clear();
        _chats.clear();
        _seen.clear();
        _cursor = null;
      }
      _owner = session.generation;
    });
    try {
      if (session.phase != SessionPhase.ready) return;
      final service = ref.read(authRuntimeProvider).services.conversations;
      String? next;
      List<InboxGroup>? groups;
      List<MapEntry<String, String>>? chats;
      if (widget.requestId == null) {
        final page = await service.inbox(cursor: cursor);
        groups = page.items;
        next = page.nextCursor;
      } else {
        final page = await service.list(
          cursor: cursor,
          limit: 20,
          learningRequestId: widget.requestId,
        );
        chats = page.items
            .map((chat) => MapEntry(chat.id, chat.createdAt))
            .toList();
        next = page.nextCursor;
      }
      if (!mounted ||
          ticket != _ticket ||
          session != ref.read(sessionSnapshotProvider))
        return;
      if (cursor != null) _seen.add(cursor);
      if (next != null && _seen.contains(next)) throw const AppError.protocol();
      setState(() {
        if (groups != null) {
          final merged = {
            for (final group in [..._groups, ...groups]) group.id: group,
          };
          _groups
            ..clear()
            ..addAll(merged.values);
        }
        if (chats != null) {
          final merged = {
            for (final chat in [..._chats, ...chats]) chat.key: chat,
          };
          _chats
            ..clear()
            ..addAll(merged.values);
        }
        _cursor = next;
      });
    } catch (cause) {
      if (mounted && ticket == _ticket)
        setState(() {
          _error = errorMessage(cause);
          if (cause is AppError && [401, 403, 404].contains(cause.status)) {
            _groups.clear();
            _chats.clear();
            _cursor = null;
          }
        });
    } finally {
      if (mounted && ticket == _ticket) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final session = ref.watch(sessionSnapshotProvider);
    ref.listen(sessionSnapshotProvider, (previous, next) {
      if (previous != next) _load(reset: true);
    });
    ref.listen(refreshTicksProvider, (previous, next) {
      if (previous?[RefreshScope.messages] != next[RefreshScope.messages] ||
          previous?[RefreshScope.inbox] != next[RefreshScope.inbox])
        _load(reset: true);
    });
    final owned =
        _owner == session.generation && session.phase == SessionPhase.ready;
    final children = <Widget>[
      WaitingRefresh(
        scopes: const {RefreshScope.inbox},
        enabled: true,
        shellIndex: 3,
        child: const SizedBox.shrink(),
      ),
      const RouteButton(
        secondary: true,
        href: '/proposals',
        label: 'Xem đề xuất đã nhận / đã gửi',
      ),
      if (_error != null) FormNotice(tone: NoticeTone.error, message: _error!),
      if (owned && widget.requestId == null)
        for (final group in _groups)
          Container(
            decoration: BoxDecoration(
              color: group.hasUnread ? const Color(0xFFFFF1E9) : Chrome.surface,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: Chrome.border),
            ),
            child: ListTile(
              isThreeLine: group.latestMessage != null,
              title: Text(
                group.title ??
                    (group.groupType == 'LEARNING_REQUEST'
                        ? 'Yêu cầu học'
                        : 'Kết nối trực tiếp'),
              ),
              leading: group.hasUnread
                  ? const Tooltip(
                      message: 'Có tin nhắn chưa đọc',
                      child: Icon(Icons.circle, color: Chrome.accent, size: 12),
                    )
                  : const Icon(Icons.chat_bubble_outline),
              subtitle: Text(
                '${group.conversationCount} cuộc chat${group.receivedProposalCount != null
                    ? ' · ${group.receivedProposalCount} đề xuất nhận'
                    : group.sentProposalCount != null
                    ? ' · ${group.sentProposalCount} đề xuất đã gửi'
                    : ''}${group.latestMessage != null ? '\n${group.latestMessage!.preview}\n${DateTime.tryParse(group.latestMessage!.sentAt)?.toLocal() ?? group.latestMessage!.sentAt}' : ''}',
                maxLines: 4,
                overflow: TextOverflow.ellipsis,
              ),
              onTap: () => context.push(
                group.learningRequestId != null
                    ? Uri(
                        path: '/messages/request/${group.learningRequestId}',
                        queryParameters: {
                          if (group.title != null) 'title': group.title!,
                        },
                      ).toString()
                    : '/chat/${group.conversationId}',
              ),
            ),
          ),
      if (owned && widget.requestId != null)
        for (final chat in _chats)
          Panel(
            title: 'Cuộc trao đổi ${chat.key.substring(0, 8)}',
            children: [
              Copy(
                'Bắt đầu: ${DateTime.tryParse(chat.value)?.toLocal() ?? chat.value}',
              ),
              RouteButton(
                href: '/chat/${chat.key}',
                label: 'Mở cuộc trò chuyện',
              ),
            ],
          ),
      if (!_loading &&
          _error == null &&
          owned &&
          _groups.isEmpty &&
          _chats.isEmpty)
        const Panel(
          title: 'Chưa có cuộc trò chuyện',
          children: [Copy('Đề xuất đang chờ vẫn xem được ở màn Đề xuất.')],
        ),
      if (_loading) const Center(child: CircularProgressIndicator()),
      if (_cursor != null && owned)
        AppButton(
          label: 'Tải thêm',
          variant: ButtonVariant.secondary,
          onPressed: _loading ? null : () => _load(),
        ),
    ];
    if (widget.requestId != null)
      return FeaturePage(
        title: widget.title ?? 'Chat theo yêu cầu học',
        back: '/messages',
        onRefresh: () => _load(reset: true),
        children: children,
      );
    return AppScreenLayout(
      title: 'Tin nhắn',
      selected: 'Tin nhắn',
      child: RefreshIndicator(
        onRefresh: () => _load(reset: true),
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(16),
          children: [
            Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 720),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  spacing: 12,
                  children: children,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
