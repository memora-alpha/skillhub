import 'package:flutter/painting.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/tokens.dart';
import '../auth/session/auth_session.dart';
import '../remote/remote_load.dart';
import 'schema/conversation_schema.dart';

abstract final class MessageColors {
  static const background = Chrome.background;
  static const canvas = Chrome.background;
  static const surface = Chrome.surface;
  static const ink = Chrome.ink;
  static const inkSoft = Color(0xFF5A5550);
  static const body = Color(0xFF5A5550);
  static const muted = Color(0xFF8D8881);
  static const mutedLight = Color(0xFFB4AFA8);
  static const border = Chrome.border;
  static const orange = Chrome.accent;
  static const brand = Chrome.accent;
  static const sage = Color(0xFF179B69);
  static const sageLight = Color(0xFFECFFF5);
  static const orangeSoft = Color(0xFFFFF1E9);
  static const orangePale = Color(0xFFFFF8F4);
  static const tag = Color(0xFFF5F6F7);
  static const white = Color(0xFFFFFFFF);
}

const messageCardShadow = [
  BoxShadow(color: Color(0x0A352B1F), offset: Offset(0, 3), blurRadius: 12),
];

class Conversation {
  const Conversation({
    required this.id,
    required this.proposal,
    required this.name,
    required this.userId,
    required this.skill,
    required this.request,
    required this.last,
    required this.messages,
    required this.unread,
    required this.time,
  });

  final String id;
  final String proposal;
  final String name;
  final String userId;
  final String skill;
  final String request;
  final String last;
  final int messages;
  final int unread;
  final String time;

  Conversation copyWith({String? last, String? time, int? messages}) =>
      Conversation(
        id: id,
        proposal: proposal,
        name: name,
        userId: userId,
        skill: skill,
        request: request,
        last: last ?? this.last,
        messages: messages ?? this.messages,
        unread: unread,
        time: time ?? this.time,
      );
}

typedef SampleFile = ({String name, int bytes});

class ChatMessage {
  const ChatMessage({
    required this.id,
    required this.mine,
    required this.text,
    required this.time,
    this.file,
  });

  final String id;
  final bool mine;
  final String text;
  final String time;
  final SampleFile? file;
}

const conversationHint =
    'Mỗi Proposal được chấp nhận mở một cuộc trò chuyện riêng. Một cuộc trò chuyện có thể chứa nhiều tin nhắn và các thẻ xác nhận nghiệp vụ.';

abstract final class ChatCopy {
  static const acceptedTitle = 'ĐỀ XUẤT ĐÃ ĐƯỢC CHẤP NHẬN';
  static const acceptedBody =
      'Hai bạn có thể trao đổi và chọn hình thức học. Chưa có Credit hay lịch nào bị khóa.';
  static const nextStepTitle = 'Chọn cách hai bạn sẽ học cùng nhau';
  static const nextStepBody =
      'Trao đổi hai chiều hoặc học một chiều. Xác nhận phải thực hiện trên thẻ này.';
  static const footer =
      'Tệp tối đa 15 MB · Xác nhận nghiệp vụ chỉ có hiệu lực qua thẻ hành động';
}

String clockTime([DateTime? at]) {
  final now = at ?? DateTime.now();
  return '${now.hour.toString().padLeft(2, '0')}:${now.minute.toString().padLeft(2, '0')}';
}

class MessagesState {
  const MessagesState({
    required this.conversations,
    required this.threads,
    required this.read,
  });

  final List<Conversation> conversations;
  final Map<String, List<ChatMessage>> threads;
  final Set<String> read;

  Conversation? find(String? proposal) {
    for (final item in conversations) {
      if (item.proposal == proposal) return item;
    }
    return null;
  }

  /// Conversation rows with the latest local message folded in.
  List<Conversation> get previews => [
    for (final item in conversations)
      () {
        final thread = threads[item.proposal] ?? const [];
        return thread.isEmpty
            ? item
            : item.copyWith(
                last: thread.last.text,
                time: thread.last.time,
                messages: thread.length,
              );
      }(),
  ];

  MessagesState copyWith({
    List<Conversation>? conversations,
    Map<String, List<ChatMessage>>? threads,
    Set<String>? read,
  }) => MessagesState(
    conversations: conversations ?? this.conversations,
    threads: threads ?? this.threads,
    read: read ?? this.read,
  );
}

class MessagesNotifier extends Notifier<MessagesState> {
  var _ticket = 0;

  @override
  MessagesState build() {
    final phase = ref.watch(sessionSnapshotProvider).phase;
    final userId = ref.watch(accountProvider).value?.userId;
    if (phase == SessionPhase.ready && userId != null) {
      _ticket++;
      _reload(_ticket, userId);
    }
    return MessagesState(
      conversations: const [],
      threads: const {},
      read: const {},
    );
  }

  Future<void> _reload(int ticket, String me) async {
    try {
      final api = ref.read(authRuntimeProvider).services.conversations;
      final records = await drainPages(
        (cursor) => api.list(cursor: cursor, limit: 30),
      );
      final conversations = <Conversation>[];
      final threads = <String, List<ChatMessage>>{};
      for (final record in records) {
        final other = record.participantAId == me
            ? record.participantBId
            : record.participantAId;
        var name = other;
        try {
          final profile = await ref
              .read(authRuntimeProvider)
              .account
              .publicProfile(other);
          final fullName = profile['fullName'];
          if (fullName is String && fullName.isNotEmpty) name = fullName;
        } catch (_) {}
        final page = await api.messages(record.id, limit: 50);
        final thread = [
          for (final message in page.items) _chatMessage(message, me),
        ];
        threads[record.proposalId] = thread;
        final unread = thread.where((message) => !message.mine).length;
        conversations.add(
          Conversation(
            id: record.id,
            proposal: record.proposalId,
            name: name,
            userId: other,
            skill: '',
            request: record.learningRequestId ?? '',
            last: thread.isEmpty ? '' : thread.last.text,
            messages: thread.length,
            unread: unread,
            time: thread.isEmpty ? '' : thread.last.time,
          ),
        );
      }
      if (!ref.mounted || ticket != _ticket) return;
      state = MessagesState(
        conversations: conversations,
        threads: threads,
        read: const {},
      );
    } catch (_) {
      if (!ref.mounted || ticket != _ticket) return;
    }
  }

  void openConversation(Conversation conversation) {
    state = state.copyWith(
      conversations: state.find(conversation.proposal) != null
          ? null
          : [conversation, ...state.conversations],
      threads: state.threads.containsKey(conversation.proposal)
          ? null
          : {...state.threads, conversation.proposal: const []},
    );
  }

  void markRead(String proposal) {
    if (state.read.contains(proposal)) return;
    state = state.copyWith(read: {...state.read, proposal});
    final conversation = state.find(proposal);
    final thread = state.threads[proposal];
    final incoming = thread?.where((message) => !message.mine).lastOrNull;
    if (conversation == null || incoming == null) return;
    ref
        .read(authRuntimeProvider)
        .services
        .conversations
        .markRead(conversation.id, messageId: incoming.id)
        .then((_) {}, onError: (_, _) {});
  }

  void _append(String proposal, ChatMessage message) {
    final previous = state.threads[proposal] ?? const [];
    state = state.copyWith(
      threads: {...state.threads, proposal: [...previous, message]},
      read: {...state.read, proposal},
    );
  }

  Future<void> send(String proposal, String text) async {
    final conversation = state.find(proposal);
    final body = text.trim();
    if (body.isEmpty || conversation == null) return;
    final clientMessageId = newUuid();
    try {
      final message = await ref
          .read(authRuntimeProvider)
          .services
          .conversations
          .send(
            conversation.id,
            clientMessageId: clientMessageId,
            messageText: body,
            idempotencyKey: clientMessageId,
          );
      final me = ref.read(accountProvider).value?.userId ?? '';
      _append(proposal, _chatMessage(message, me));
      await ref
          .read(authRuntimeProvider)
          .services
          .conversations
          .delivery(conversation.id, clientMessageId);
    } catch (_) {}
  }

  bool sendFile(String proposal, SampleFile file) => false;
}

ChatMessage _chatMessage(MessageRecord message, String me) => ChatMessage(
  id: message.id,
  mine: message.senderId == me,
  text: message.messageText,
  time: clockTime(DateTime.tryParse(message.sentAt)?.toLocal()),
);

final messagesProvider = NotifierProvider<MessagesNotifier, MessagesState>(
  MessagesNotifier.new,
);
