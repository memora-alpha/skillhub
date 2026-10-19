import 'package:flutter/painting.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/tokens.dart';
import '../auth/session/auth_session.dart';

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

/// Only accepted proposals appear in the conversation list.
const conversations = [
  Conversation(
    proposal: 'DX-2402',
    name: 'Trần Việt Anh',
    userId: 'demo-viet-anh',
    skill: 'React',
    request: 'Muốn học React từ cơ bản đến nâng cao',
    last: '2 tháng là hoàn toàn khả thi!',
    messages: 12,
    unread: 2,
    time: '14:26',
  ),
  Conversation(
    proposal: 'DX-2388',
    name: 'Nguyễn Minh Hà',
    userId: 'demo-minh-ha',
    skill: 'Tiếng Anh / IELTS',
    request: 'Luyện IELTS Speaking lên 7.0',
    last: 'Mình đã cập nhật lịch rồi nhé.',
    messages: 28,
    unread: 0,
    time: '11:02',
  ),
  Conversation(
    proposal: 'DX-2314',
    name: 'Đỗ Quang Huy',
    userId: 'demo-quang-huy',
    skill: 'Python',
    request: 'Python cho Data Science',
    last: 'Bạn xem lộ trình Python giúp mình.',
    messages: 9,
    unread: 0,
    time: 'Thứ 2',
  ),
];

const conversationHint =
    'Mỗi Proposal được chấp nhận mở một cuộc trò chuyện riêng. Một cuộc trò chuyện có thể chứa nhiều tin nhắn và các thẻ xác nhận nghiệp vụ.';

const _reactMessages = [
  ChatMessage(
    id: 'seed-1',
    mine: false,
    text: 'Chào bạn! Mình thấy yêu cầu học React của bạn rất thú vị.',
    time: '14:20',
  ),
  ChatMessage(
    id: 'seed-2',
    mine: true,
    text: 'Chào anh! Mình là người mới bắt đầu, chỉ biết HTML/CSS cơ bản.',
    time: '14:22',
  ),
  ChatMessage(
    id: 'seed-3',
    mine: false,
    text: 'Không sao, mình sẽ dạy từ đầu. Bạn có mục tiêu cụ thể không?',
    time: '14:23',
  ),
  ChatMessage(
    id: 'seed-4',
    mine: true,
    text:
        'Mình muốn xây dựng được một ứng dụng web hoàn chỉnh bằng React trong 2 tháng.',
    time: '14:25',
  ),
  ChatMessage(
    id: 'seed-5',
    mine: false,
    text:
        '2 tháng là hoàn toàn khả thi! Mình đề xuất 6 buổi, mỗi buổi 90 phút, tập trung vào dự án thực tế.',
    time: '14:26',
  ),
];

final Map<String, List<ChatMessage>> initialThreads = {
  for (final item in conversations)
    item.proposal: item.proposal == 'DX-2402'
        ? _reactMessages
        : [
            ChatMessage(
              id: 'seed-${item.proposal}',
              mine: false,
              text: item.last,
              time: item.time,
            ),
          ],
};

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
        final added = thread.length - (initialThreads[item.proposal]?.length ?? 0);
        return added > 0 && thread.isNotEmpty
            ? item.copyWith(
                last: thread.last.text,
                time: thread.last.time,
                messages: item.messages + added,
              )
            : item;
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

/// Local sample conversations; reset whenever the signed-in session changes.
class MessagesNotifier extends Notifier<MessagesState> {
  @override
  MessagesState build() {
    ref.watch(sessionSnapshotProvider.select((s) => s.generation));
    return MessagesState(
      conversations: conversations,
      threads: initialThreads,
      read: const {},
    );
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
  }

  void _append(String proposal, ChatMessage message) {
    final previous = state.threads[proposal] ?? const [];
    state = state.copyWith(
      threads: {...state.threads, proposal: [...previous, message]},
      read: {...state.read, proposal},
    );
  }

  void send(String proposal, String text) {
    if (text.trim().isEmpty || state.find(proposal) == null) return;
    final count = state.threads[proposal]?.length ?? 0;
    _append(
      proposal,
      ChatMessage(
        id: 'local-${DateTime.now().millisecondsSinceEpoch}-$count',
        mine: true,
        text: text.trim(),
        time: clockTime(),
      ),
    );
  }

  bool sendFile(String proposal, SampleFile file) {
    if (file.bytes > 15 * 1024 * 1024 ||
        file.bytes <= 0 ||
        state.find(proposal) == null) {
      return false;
    }
    final count = state.threads[proposal]?.length ?? 0;
    _append(
      proposal,
      ChatMessage(
        id: 'file-${DateTime.now().millisecondsSinceEpoch}-$count',
        mine: true,
        text: 'Tệp mẫu: ${file.name}',
        file: file,
        time: clockTime(),
      ),
    );
    return true;
  }
}

final messagesProvider = NotifierProvider<MessagesNotifier, MessagesState>(
  MessagesNotifier.new,
);
