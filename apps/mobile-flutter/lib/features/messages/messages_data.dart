import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/tokens.dart';
import '../auth/session/auth_session.dart';
import '../learning_paths/negotiation_message.dart';
import '../proposals/proposals_data.dart';
import '../remote/refresh_signal.dart';
import '../remote/remote_load.dart';
import '../skills/skills_feature.dart';
import 'schema/conversation_schema.dart';
import 'service/conversations_service.dart';

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
    required this.createdAt,
    this.lastActivityAt,
    this.topic = '',
    this.avatarUrl,
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
  final DateTime? createdAt;

  /// Latest message time used for inbox ordering.
  final DateTime? lastActivityAt;

  /// Learning-request title (or skill / fallback) shown as the block title.
  final String topic;
  final String? avatarUrl;

  DateTime get sortAt {
    final activity = lastActivityAt;
    final created = createdAt;
    if (activity != null && created != null) {
      return activity.isAfter(created) ? activity : created;
    }
    return activity ?? created ?? DateTime.fromMillisecondsSinceEpoch(0);
  }

  /// Title for list rows: prefer learning-request topic over partner name.
  String get inboxTitle {
    final heading = topic.trim();
    if (heading.isNotEmpty) return heading;
    if (name.isNotEmpty && name != userId) return name;
    return 'Đề xuất học';
  }

  Conversation copyWith({
    String? last,
    String? time,
    int? messages,
    DateTime? lastActivityAt,
    String? topic,
    String? avatarUrl,
  }) => Conversation(
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
    createdAt: createdAt,
    lastActivityAt: lastActivityAt ?? this.lastActivityAt,
    topic: topic ?? this.topic,
    avatarUrl: avatarUrl ?? this.avatarUrl,
  );

  String get createdLabel {
    final date = createdAt?.toLocal();
    if (date == null) return '';
    final day = date.day.toString().padLeft(2, '0');
    final month = date.month.toString().padLeft(2, '0');
    return '$day/$month/${date.year}';
  }
}

typedef SampleFile = ({String name, int bytes});

class ChatAttachmentView {
  const ChatAttachmentView({
    required this.attachmentId,
    required this.filename,
    required this.bytes,
    required this.mimeType,
  });

  final String attachmentId;
  final String filename;
  final int bytes;
  final String mimeType;
}

class ChatMessage {
  const ChatMessage({
    required this.id,
    required this.mine,
    required this.text,
    required this.time,
    this.sentAt,
    this.sequence,
    this.file,
    this.attachments = const [],
  });

  final String id;
  final bool mine;
  final String text;
  final String time;
  final DateTime? sentAt;
  final String? sequence;
  final SampleFile? file;
  final List<ChatAttachmentView> attachments;
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

/// Resolves a chat route keyed by conversation id (preferred) or proposal id.
Conversation? conversationByKey(Iterable<Conversation> items, String? key) {
  if (key == null || key.isEmpty) return null;
  for (final item in items) {
    if (item.id == key) return item;
  }
  for (final item in items) {
    if (item.proposal == key) return item;
  }
  return null;
}

class MessagesState {
  const MessagesState({
    required this.conversations,
    required this.threads,
    required this.read,
    this.olderCursors = const {},
    this.settled = false,
  });

  final List<Conversation> conversations;
  final Map<String, List<ChatMessage>> threads;
  final Set<String> read;
  final Map<String, String?> olderCursors;
  final bool settled;

  Conversation? find(String? key) => conversationByKey(conversations, key);

  /// Conversation rows with the latest local message folded in, newest first.
  List<Conversation> get previews {
    final rows = [
      for (final item in conversations)
        () {
          final thread = threads[item.id] ?? const [];
          if (thread.isEmpty) return item;
          final latest = thread.last;
          return item.copyWith(
            last: latest.text,
            time: latest.time,
            messages: thread.length,
            lastActivityAt: latest.sentAt ?? item.lastActivityAt,
          );
        }(),
    ]..sort((a, b) => b.sortAt.compareTo(a.sortAt));
    return rows;
  }

  /// People with at least one conversation, newest activity first.
  List<MessagePartner> partners({String query = ''}) {
    final needle = _searchKey(query);
    final byUser = <String, List<Conversation>>{};
    for (final item in previews) {
      final key = item.userId.isEmpty ? item.id : item.userId;
      (byUser[key] ??= []).add(item);
    }
    final rows = [
      for (final entry in byUser.entries)
        MessagePartner(
          userId: entry.key,
          name: entry.value.first.name,
          avatarUrl: entry.value.first.avatarUrl,
          conversations: entry.value,
        ),
    ]..sort((a, b) => b.sortAt.compareTo(a.sortAt));
    if (needle.isEmpty) return rows;
    return [
      for (final row in rows)
        if (_searchKey(row.name).contains(needle) ||
            _searchKey(row.userId).contains(needle) ||
            row.conversations.any(
              (item) =>
                  _searchKey(item.skill).contains(needle) ||
                  _searchKey(item.inboxTitle).contains(needle) ||
                  _searchKey(item.last).contains(needle),
            ))
          row,
    ];
  }

  /// Conversations with one partner, newest first, optionally filtered.
  List<Conversation> partnerThreads(
    String userId, {
    String query = '',
    String? skillKey,
    Map<String, String> skillByProposal = const {},
  }) {
    final needle = _searchKey(query);
    final rows = [
      for (final item in previews)
        if ((item.userId == userId ||
                (item.userId.isEmpty && item.id == userId)) &&
            (skillKey == null ||
                messageSkillKey(item, skillByProposal: skillByProposal) ==
                    skillKey))
          item,
    ];
    if (needle.isEmpty) return rows;
    return [
      for (final item in rows)
        if (_searchKey(
              messageSkillLabel(item, skillByProposal: skillByProposal),
            ).contains(needle) ||
            _searchKey(item.inboxTitle).contains(needle) ||
            _searchKey(item.last).contains(needle) ||
            _searchKey(item.topic).contains(needle))
          item,
    ];
  }

  /// Skills shared with one partner, newest activity first.
  ///
  /// [skillByProposal] overrides stale conversation.skill when proposals
  /// already know the catalog skill name (avoids grouping by request title).
  List<MessageSkillGroup> partnerSkills(
    String userId, {
    String query = '',
    Map<String, String> skillByProposal = const {},
  }) {
    final needle = _searchKey(query);
    final bySkill = <String, List<Conversation>>{};
    for (final item in partnerThreads(
      userId,
      skillByProposal: skillByProposal,
    )) {
      final key = messageSkillKey(item, skillByProposal: skillByProposal);
      (bySkill[key] ??= []).add(item);
    }
    final rows = [
      for (final entry in bySkill.entries)
        MessageSkillGroup(
          key: entry.key,
          label: messageSkillLabel(
            entry.value.first,
            skillByProposal: skillByProposal,
          ),
          conversations: entry.value,
        ),
    ]..sort((a, b) => b.sortAt.compareTo(a.sortAt));
    if (needle.isEmpty) return rows;
    return [
      for (final row in rows)
        if (_searchKey(row.label).contains(needle) ||
            row.conversations.any(
              (item) =>
                  _searchKey(item.inboxTitle).contains(needle) ||
                  _searchKey(item.last).contains(needle) ||
                  _searchKey(item.topic).contains(needle),
            ))
          row,
    ];
  }

  MessagesState copyWith({
    List<Conversation>? conversations,
    Map<String, List<ChatMessage>>? threads,
    Set<String>? read,
    Map<String, String?>? olderCursors,
    bool? settled,
  }) => MessagesState(
    conversations: conversations ?? this.conversations,
    threads: threads ?? this.threads,
    read: read ?? this.read,
    olderCursors: olderCursors ?? this.olderCursors,
    settled: settled ?? this.settled,
  );
}

/// One inbox person: all skill/conversation threads with them.
class MessagePartner {
  const MessagePartner({
    required this.userId,
    required this.name,
    required this.conversations,
    this.avatarUrl,
  });

  final String userId;
  final String name;
  final String? avatarUrl;
  final List<Conversation> conversations;

  DateTime get sortAt {
    DateTime latest = DateTime.fromMillisecondsSinceEpoch(0);
    for (final item in conversations) {
      if (item.sortAt.isAfter(latest)) latest = item.sortAt;
    }
    return latest;
  }

  Conversation get latest => conversations.first;

  int get unread {
    var total = 0;
    for (final item in conversations) {
      total += item.unread;
    }
    return total;
  }

  String get preview {
    final text = latest.last.trim();
    if (text.isNotEmpty) return conversationMessagePreview(text);
    if (latest.createdLabel.isNotEmpty) {
      return 'Đề xuất đã chấp nhận · ${latest.createdLabel}';
    }
    return 'Đề xuất đã chấp nhận';
  }

  String skillSummary({Map<String, String> skillByProposal = const {}}) {
    final labels = <String>{
      for (final item in conversations)
        messageSkillKey(item, skillByProposal: skillByProposal),
    };
    if (labels.isEmpty) return '${conversations.length} cuộc trao đổi';
    if (labels.length == 1) {
      return messageSkillLabel(
        conversations.first,
        skillByProposal: skillByProposal,
      );
    }
    return '${labels.length} kỹ năng · ${conversations.length} cuộc trao đổi';
  }
}

/// Conversations with one partner under one skill.
class MessageSkillGroup {
  const MessageSkillGroup({
    required this.key,
    required this.label,
    required this.conversations,
  });

  final String key;
  final String label;
  final List<Conversation> conversations;

  DateTime get sortAt {
    DateTime latest = DateTime.fromMillisecondsSinceEpoch(0);
    for (final item in conversations) {
      if (item.sortAt.isAfter(latest)) latest = item.sortAt;
    }
    return latest;
  }

  Conversation get latest => conversations.first;

  int get unread {
    var total = 0;
    for (final item in conversations) {
      total += item.unread;
    }
    return total;
  }

  String get preview {
    final text = latest.last.trim();
    if (text.isNotEmpty) return conversationMessagePreview(text);
    if (latest.createdLabel.isNotEmpty) {
      return 'Đề xuất đã chấp nhận · ${latest.createdLabel}';
    }
    return 'Đề xuất đã chấp nhận';
  }

  String get threadSummary {
    final count = conversations.length;
    return count == 1 ? '1 cuộc trao đổi' : '$count cuộc trao đổi';
  }
}

String messageSkillLabel(
  Conversation item, {
  Map<String, String> skillByProposal = const {},
}) {
  final fromProposal = skillByProposal[item.proposal]?.trim() ?? '';
  if (fromProposal.isNotEmpty) return fromProposal;
  final skill = item.skill.trim();
  final topic = item.topic.trim();
  // Guard: never treat the learning-request title as a skill group.
  if (skill.isNotEmpty && (topic.isEmpty || skill != topic)) return skill;
  return 'Khác';
}

String messageSkillKey(
  Conversation item, {
  Map<String, String> skillByProposal = const {},
}) => _searchKey(messageSkillLabel(item, skillByProposal: skillByProposal));

String _searchKey(String value) =>
    value.toLowerCase().replaceAll(RegExp(r'\s+'), ' ').trim();

String _skillNameFromJson(Object? value) {
  if (value is String && value.trim().isNotEmpty) return value.trim();
  if (value is Map) {
    final name = value['name'];
    if (name is String && name.trim().isNotEmpty) return name.trim();
  }
  return '';
}

String _skillIdFromJson(Map<String, dynamic> json) {
  final skillId = json['skillId'];
  if (skillId is String && skillId.isNotEmpty) return skillId;
  final nested = json['skill'];
  if (nested is Map) {
    final id = nested['id'];
    if (id is String && id.isNotEmpty) return id;
  }
  return '';
}

class MessagesNotifier extends Notifier<MessagesState> {
  final _markingRead = <String>{};
  final _acknowledgedRead = <String, String>{};
  var _ticket = 0;
  String? _userId;

  @override
  MessagesState build() {
    listenForRefresh(ref, RefreshScope.messages, () {
      final me = ref.read(accountProvider).value?.userId;
      if (ref.read(sessionSnapshotProvider).phase != SessionPhase.ready) return;
      if (me == null) return;
      _reload(++_ticket, me);
    });
    final phase = ref.watch(sessionSnapshotProvider.select((s) => s.phase));
    if (phase != SessionPhase.ready) {
      _userId = null;
      return const MessagesState(conversations: [], threads: {}, read: {});
    }
    ref.listen(accountProvider, (previous, next) {
      final id = next.value?.userId;
      if (id == null || id == _userId) return;
      _userId = id;
      _reload(++_ticket, id);
    }, fireImmediately: true);
    return const MessagesState(conversations: [], threads: {}, read: {});
  }

  Future<
    ({
      Conversation conversation,
      String proposal,
      List<ChatMessage> thread,
      String? olderCursor,
    })
  >
  _loadConversation(
    ConversationsService api,
    ConversationRecord record,
    String me,
    Map<String, String> knownNames,
  ) async {
    final other = record.participantAId == me
        ? record.participantBId
        : record.participantAId;
    var name = knownNames[other] ?? other;
    String? avatarUrl;
    // One profile read when the display name is unknown; avatar widgets share
    // userAvatarUrlProvider so we do not stampede /profiles on every reload.
    if (!knownNames.containsKey(other)) {
      try {
        final profile = await ref
            .read(authRuntimeProvider)
            .account
            .publicProfile(other);
        final fullName = profile['fullName'];
        if (fullName is String && fullName.isNotEmpty) name = fullName;
        final avatar = profile['avatarUrl'];
        if (avatar is String && avatar.isNotEmpty) avatarUrl = avatar;
      } catch (_) {}
    }
    final previous = state.threads[record.id];
    final lastSequence = previous?.lastOrNull?.sequence;
    final List<ChatMessage> thread;
    final String? olderCursor;
    if (lastSequence != null && lastSequence.isNotEmpty) {
      final knownIds = {for (final message in previous!) message.id};
      final fetched = <MessageRecord>[];
      var after = lastSequence;
      final seen = <String>{};
      while (seen.add(after)) {
        final page = await api.messages(
          record.id,
          afterSequence: after,
          limit: 50,
        );
        if (page.items.isEmpty) break;
        fetched.addAll(page.items);
        final next = page.items.last.sequence;
        if (next == after || page.items.length < 50) break;
        after = next;
      }
      thread = [
        ...previous,
        for (final message in fetched)
          if (!knownIds.contains(message.id)) _chatMessage(message, me),
      ];
      olderCursor = state.olderCursors[record.id];
    } else {
      final page = await api.messages(record.id, limit: 50);
      thread = [for (final message in page.items) _chatMessage(message, me)];
      olderCursor = page.nextCursor;
    }
    final labels = await _conversationLabels(
      proposalId: record.proposalId,
      learningRequestId: record.learningRequestId,
    );
    final lastMessage = thread.isEmpty ? null : thread.last;
    final createdAt = DateTime.tryParse(record.createdAt);
    return (
      proposal: record.proposalId,
      thread: thread,
      olderCursor: olderCursor,
      conversation: Conversation(
        id: record.id,
        proposal: record.proposalId,
        name: name,
        userId: other,
        skill: labels.skill,
        request: record.learningRequestId ?? '',
        last: lastMessage?.text ?? '',
        messages: thread.length,
        unread: thread.where((message) => !message.mine).length,
        time: lastMessage?.time ?? '',
        createdAt: createdAt,
        lastActivityAt: lastMessage?.sentAt ?? createdAt,
        topic: labels.topic,
        avatarUrl: avatarUrl,
      ),
    );
  }

  /// Skill name for grouping; request/proposal title for conversation cards.
  Future<({String skill, String topic})> _conversationLabels({
    required String proposalId,
    required String? learningRequestId,
  }) async {
    final runtime = ref.read(authRuntimeProvider);
    final catalog = await ref.read(skillCatalogProvider.future);
    final skillNames = {for (final item in catalog) item.id: item.name};
    var skill = '';
    var topic = '';
    var sourceType = '';

    for (final item in ref.read(proposalsProvider)) {
      if (item.id != proposalId) continue;
      if (item.skill.trim().isNotEmpty) skill = item.skill.trim();
      sourceType = item.sourceType;
      break;
    }

    try {
      final proposal = await runtime.services.proposals.get(proposalId);
      sourceType = proposal.sourceType;
      final named = skillNames[proposal.skillId]?.trim() ?? '';
      if (named.isNotEmpty) {
        skill = named;
      } else if (skill.isEmpty && proposal.skillId.isNotEmpty) {
        skill = proposal.skillId;
      }
    } catch (_) {}

    if (learningRequestId != null && learningRequestId.isNotEmpty) {
      try {
        final request = await runtime.services.learningRequests.get(
          learningRequestId,
        );
        final title = request['title'];
        if (title is String && title.trim().isNotEmpty) {
          topic = title.trim();
        }
        if (skill.isEmpty) {
          final named = _skillNameFromJson(request['skill']);
          if (named.isNotEmpty) {
            skill = named;
          } else {
            final skillId = _skillIdFromJson(request);
            final fromCatalog = skillNames[skillId]?.trim() ?? '';
            if (fromCatalog.isNotEmpty) skill = fromCatalog;
          }
        }
      } catch (_) {}
    }

    if (topic.isEmpty && sourceType == 'DIRECT_SEARCH') {
      topic = skill.isEmpty
          ? 'Lời mời trực tiếp'
          : '$skill · Lời mời trực tiếp';
    }
    if (topic.isEmpty) {
      topic = 'Đề xuất học';
    }
    // Never let the request title leak into the skill group label.
    if (skill.isNotEmpty && skill == topic) {
      skill = '';
    }
    return (skill: skill, topic: topic);
  }

  Future<void> _reload(int ticket, String me) async {
    try {
      final api = ref.read(authRuntimeProvider).services.conversations;
      final records = await drainPages(
        (cursor) => api.list(cursor: cursor, limit: 30),
      );
      final knownNames = _knownNames();
      final loaded = [
        for (final item in await Future.wait([
          for (final record in records)
            () async {
              try {
                return await _loadConversation(api, record, me, knownNames);
              } catch (_) {
                return _keptConversation(record, me, knownNames);
              }
            }(),
        ]))
          item,
      ];
      final conversations = <Conversation>[];
      final threads = <String, List<ChatMessage>>{};
      final olderCursors = <String, String?>{};
      for (final item in loaded) {
        final id = item.conversation.id;
        conversations.removeWhere((conversation) => conversation.id == id);
        conversations.add(item.conversation);
        threads[id] = item.thread;
        olderCursors[id] = item.olderCursor;
      }
      if (!ref.mounted || ticket != _ticket) return;
      state = MessagesState(
        conversations: conversations,
        threads: threads,
        read: state.read,
        olderCursors: olderCursors,
        settled: true,
      );
    } catch (_) {
      if (!ref.mounted || ticket != _ticket) return;
      state = state.copyWith(settled: true);
    }
  }

  ({
    Conversation conversation,
    String proposal,
    List<ChatMessage> thread,
    String? olderCursor,
  })
  _keptConversation(
    ConversationRecord record,
    String me,
    Map<String, String> knownNames,
  ) {
    final previous = state.conversations
        .where((item) => item.id == record.id)
        .firstOrNull;
    if (previous != null) {
      return (
        proposal: previous.proposal,
        thread: state.threads[record.id] ?? const [],
        olderCursor: state.olderCursors[record.id],
        conversation: previous,
      );
    }
    final other = record.participantAId == me
        ? record.participantBId
        : record.participantAId;
    return (
      proposal: record.proposalId,
      thread: const <ChatMessage>[],
      olderCursor: null,
      conversation: Conversation(
        id: record.id,
        proposal: record.proposalId,
        name: knownNames[other] ?? other,
        userId: other,
        skill: '',
        request: record.learningRequestId ?? '',
        last: '',
        messages: 0,
        unread: 0,
        time: '',
        createdAt: DateTime.tryParse(record.createdAt),
        lastActivityAt: DateTime.tryParse(record.createdAt),
      ),
    );
  }

  Map<String, String> _knownNames() => {
    for (final conversation in state.conversations)
      if (conversation.name.isNotEmpty &&
          conversation.name != conversation.userId)
        conversation.userId: conversation.name,
  };

  void _merge(
    ({
      Conversation conversation,
      String proposal,
      List<ChatMessage> thread,
      String? olderCursor,
    })
    loaded,
  ) {
    final conversation = loaded.conversation;
    final threads = Map<String, List<ChatMessage>>.of(state.threads);
    if (conversation.proposal.isNotEmpty &&
        conversation.proposal != conversation.id) {
      threads.remove(conversation.proposal);
    }
    threads[conversation.id] = loaded.thread;
    final olderCursors = Map<String, String?>.of(state.olderCursors);
    if (conversation.proposal.isNotEmpty &&
        conversation.proposal != conversation.id) {
      olderCursors.remove(conversation.proposal);
    }
    olderCursors[conversation.id] = loaded.olderCursor;
    state = state.copyWith(
      conversations: [
        conversation,
        for (final item in state.conversations)
          if (item.id != conversation.id) item,
      ],
      threads: threads,
      olderCursors: olderCursors,
      settled: true,
    );
  }

  /// Loads `/chat/:id` from the conversation resource, never from a sibling thread.
  Future<void> ensureOpen(String routeId) async {
    if (routeId.isEmpty) return;
    final me = ref.read(accountProvider).value?.userId;
    if (me == null) return;
    final api = ref.read(authRuntimeProvider).services.conversations;
    try {
      late final ConversationRecord record;
      try {
        record = await api.get(routeId);
      } catch (_) {
        final fallback = state.conversations
            .where((item) => item.id == routeId || item.proposal == routeId)
            .firstOrNull;
        if (fallback == null) {
          state = state.copyWith(settled: true);
          return;
        }
        record = await api.get(fallback.id);
      }
      final loaded = await _loadConversation(api, record, me, _knownNames());
      if (!ref.mounted) return;
      _merge(loaded);
    } catch (_) {
      if (!ref.mounted) return;
      state = state.copyWith(settled: true);
    }
  }

  void openConversation(Conversation conversation) {
    state = state.copyWith(
      conversations: state.find(conversation.id) != null
          ? null
          : [conversation, ...state.conversations],
      threads: state.threads.containsKey(conversation.id)
          ? null
          : {...state.threads, conversation.id: const []},
    );
  }

  void markRead(String conversationId) {
    final conversation = state.find(conversationId);
    if (conversation == null) return;
    final thread = state.threads[conversation.id];
    final incoming = thread?.where((message) => !message.mine).lastOrNull;
    if (incoming == null) return;
    final session = ref.read(sessionSnapshotProvider);
    final key = '${session.generation}:${conversation.id}:${incoming.id}';
    if (_markingRead.contains(key) || _acknowledgedRead[conversation.id] == key)
      return;
    _markingRead.add(key);
    ref
        .read(authRuntimeProvider)
        .services
        .conversations
        .markRead(conversation.id, messageId: incoming.id)
        .then((_) {
          if (ref.mounted && session == ref.read(sessionSnapshotProvider)) {
            _acknowledgedRead[conversation.id] = key;
            state = state.copyWith(read: {...state.read, conversation.id});
            ref.read(refreshTicksProvider.notifier).bump(const {
              RefreshScope.inbox,
            });
          }
        }, onError: (_, _) {})
        .whenComplete(() => _markingRead.remove(key));
  }

  void _append(String conversationId, ChatMessage message) {
    final previous = state.threads[conversationId] ?? const [];
    state = state.copyWith(
      threads: {
        ...state.threads,
        conversationId: [...previous, message],
      },
      read: {...state.read, conversationId},
    );
  }

  Future<void> loadOlder(String conversationId) async {
    final conversation = state.find(conversationId);
    final cursor = state.olderCursors[conversation?.id];
    if (conversation == null || cursor == null || cursor.isEmpty) return;
    try {
      final me = ref.read(accountProvider).value?.userId ?? '';
      final page = await ref
          .read(authRuntimeProvider)
          .services
          .conversations
          .messages(conversation.id, cursor: cursor, limit: 50);
      final older = [
        for (final message in page.items) _chatMessage(message, me),
      ];
      final current = state.threads[conversation.id] ?? const <ChatMessage>[];
      if (!ref.mounted) return;
      state = state.copyWith(
        threads: {
          ...state.threads,
          conversation.id: [...older, ...current],
        },
        olderCursors: {...state.olderCursors, conversation.id: page.nextCursor},
      );
    } catch (_) {}
  }

  Future<void> send(
    String conversationId,
    String text, {
    List<String> attachmentFileIds = const [],
  }) async {
    final conversation = state.find(conversationId);
    final body = text.trim();
    if (conversation == null) return;
    if (body.isEmpty && attachmentFileIds.isEmpty) return;
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
            attachmentFileIds: attachmentFileIds,
            idempotencyKey: clientMessageId,
          );
      final me = ref.read(accountProvider).value?.userId ?? '';
      _append(conversation.id, _chatMessage(message, me));
      await ref
          .read(authRuntimeProvider)
          .services
          .conversations
          .delivery(conversation.id, clientMessageId);
    } catch (_) {}
  }
}

ChatMessage _chatMessage(MessageRecord message, String me) {
  final sentAt = DateTime.tryParse(message.sentAt);
  final attachments = [
    for (final item in message.attachments)
      ChatAttachmentView(
        attachmentId: item.attachmentId,
        filename: item.filename,
        bytes: item.fileSizeBytes,
        mimeType: item.mimeType,
      ),
  ];
  return ChatMessage(
    id: message.id,
    mine: message.senderId == me,
    text: message.messageText,
    time: clockTime(sentAt?.toLocal()),
    sentAt: sentAt,
    sequence: message.sequence,
    attachments: attachments,
    file: attachments.isEmpty
        ? null
        : (name: attachments.first.filename, bytes: attachments.first.bytes),
  );
}

final messagesProvider = NotifierProvider<MessagesNotifier, MessagesState>(
  MessagesNotifier.new,
);

final openChatProvider = FutureProvider.family<void, String>((ref, id) async {
  if (ref.watch(sessionSnapshotProvider.select((s) => s.phase)) !=
      SessionPhase.ready) {
    return;
  }
  Future<void> open() => ref.read(messagesProvider.notifier).ensureOpen(id);
  await open();
  final timer = Timer.periodic(const Duration(seconds: 8), (_) {
    if (!ref.mounted) return;
    open();
  });
  final life = AppLifecycleListener(onResume: open);
  ref.onDispose(() {
    timer.cancel();
    life.dispose();
  });
});

String conversationReference(String proposalId) {
  if (proposalId.length < 8) return proposalId;
  return '#${proposalId.substring(proposalId.length - 8).toUpperCase()}';
}
