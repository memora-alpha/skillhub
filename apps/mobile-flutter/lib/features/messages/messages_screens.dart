import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';

import '../../components/app_button.dart';
import '../../components/app_icon.dart';
import '../../components/user_avatar.dart';
import '../../components/feature_page.dart';
import '../../components/misc.dart';
import '../../components/tappable.dart';
import '../../core/theme/tokens.dart';
import '../../core/http/app_error.dart';
import '../auth/session/auth_session.dart';
import '../shell/app_screen_layout.dart';
import 'messages_data.dart';

final _openedConversationProvider = FutureProvider.family<void, String>((
  ref,
  id,
) async {
  final phase = ref.watch(sessionSnapshotProvider).phase;
  if (phase != SessionPhase.ready) return;
  await ref.read(authRuntimeProvider).services.conversations.get(id);
});

class MessagesScreen extends ConsumerStatefulWidget {
  const MessagesScreen({super.key});

  @override
  ConsumerState<MessagesScreen> createState() => _MessagesScreenState();
}

class _MessagesScreenState extends ConsumerState<MessagesScreen> {
  final _query = TextEditingController();
  final _focus = FocusNode();

  @override
  void initState() {
    super.initState();
    _query.addListener(() => setState(() {}));
    _focus.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _query.dispose();
    _focus.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(messagesProvider);
    final normalized = _query.text.trim().toLowerCase();
    final filtered = state.previews
        .where(
          (item) => '${item.name} ${item.skill} ${item.request} ${item.proposal}'
              .toLowerCase()
              .contains(normalized),
        )
        .toList();
    final caption = nunito(TypeScale.caption, color: MessageColors.muted);
    return AppScreenLayout(
      title: 'Tin nhắn',
      selected: 'Tin nhắn',
      background: MessageColors.background,
      child: ListView(
        keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
        padding: const EdgeInsets.only(bottom: 24),
        children: [
          Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 640),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Padding(
                    padding: const EdgeInsets.fromLTRB(12, 14, 12, 10),
                    child: Tappable(
                      semanticLabel: 'Xem các proposal hiện có',
                      onTap: () => context.push('/proposals'),
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 10,
                          vertical: 9,
                        ),
                        decoration: BoxDecoration(
                          color: MessageColors.orangePale,
                          borderRadius: BorderRadius.circular(9),
                          border: Border.all(color: const Color(0xFFFFE6D9)),
                        ),
                        child: Row(
                          spacing: 8,
                          children: [
                            Container(
                              width: 32,
                              height: 32,
                              alignment: Alignment.center,
                              decoration: BoxDecoration(
                                color: MessageColors.orangeSoft,
                                borderRadius: BorderRadius.circular(7),
                              ),
                              child: const AppIcon(
                                AppIcon.clipboard,
                                size: IconSizes.control,
                                color: MessageColors.orange,
                              ),
                            ),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    'Các proposal hiện có',
                                    style: nunito(
                                      TypeScale.body,
                                      weight: FontWeight.w700,
                                      color: MessageColors.ink,
                                    ),
                                  ),
                                  Text(
                                    'Đang chờ duyệt hoặc phản hồi',
                                    style: caption,
                                  ),
                                ],
                              ),
                            ),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 9,
                                vertical: 5,
                              ),
                              decoration: BoxDecoration(
                                color: MessageColors.orangeSoft,
                                borderRadius: BorderRadius.circular(5),
                              ),
                              child: Row(
                                spacing: 2,
                                children: [
                                  Text(
                                    'Xem',
                                    style: nunito(
                                      TypeScale.caption,
                                      weight: FontWeight.w700,
                                      color: MessageColors.orange,
                                    ),
                                  ),
                                  const AppIcon(
                                    AppIcon.chevron,
                                    size: IconSizes.inline,
                                    color: MessageColors.orange,
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                  Container(
                    margin: const EdgeInsets.fromLTRB(12, 0, 12, 2),
                    padding: const EdgeInsets.symmetric(horizontal: 10),
                    decoration: BoxDecoration(
                      color: MessageColors.surface,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(
                        color: _focus.hasFocus
                            ? MessageColors.orange
                            : MessageColors.border,
                      ),
                    ),
                    child: Row(
                      spacing: 8,
                      children: [
                        const AppIcon(
                          AppIcon.search,
                          size: IconSizes.control,
                          color: MessageColors.muted,
                        ),
                        Expanded(
                          child: TextField(
                            controller: _query,
                            focusNode: _focus,
                            autocorrect: false,
                            textInputAction: TextInputAction.search,
                            style: nunito(
                              TypeScale.secondary,
                              color: MessageColors.ink,
                            ),
                            decoration: InputDecoration(
                              isDense: true,
                              border: InputBorder.none,
                              contentPadding: const EdgeInsets.symmetric(
                                vertical: 10,
                              ),
                              hintText:
                                  'Tìm theo người, kỹ năng hoặc bài đăng...',
                              hintStyle: nunito(
                                TypeScale.secondary,
                                color: MessageColors.mutedLight,
                              ),
                            ),
                          ),
                        ),
                        if (_query.text.isNotEmpty)
                          Tappable(
                            semanticLabel: 'Xóa tìm kiếm',
                            onTap: _query.clear,
                            child: const AppIcon(
                              AppIcon.close,
                              size: IconSizes.control,
                              color: MessageColors.muted,
                            ),
                          ),
                      ],
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(12, 14, 12, 8),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text.rich(
                          TextSpan(
                            text: 'CÁC PROPOSAL ĐÃ CHẤP NHẬN  ',
                            children: [
                              TextSpan(
                                text: '${filtered.length}',
                                style: const TextStyle(
                                  color: MessageColors.orange,
                                ),
                              ),
                            ],
                          ),
                          style: caption.copyWith(fontWeight: FontWeight.w700),
                        ),
                        Text('Đang trao đổi', style: caption),
                      ],
                    ),
                  ),
                  if (filtered.isEmpty)
                    EmptyState(
                      icon: AppIcon.message,
                      title: 'Không tìm thấy cuộc trao đổi',
                      description:
                          'Thử tên người, kỹ năng hoặc nội dung bài đăng khác.',
                      action: 'Xóa tìm kiếm',
                      onAction: _query.clear,
                    ),
                  for (final item in filtered)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: ConversationCard(
                        conversation: item,
                        unread: state.read.contains(item.proposal)
                            ? 0
                            : item.unread,
                        onTap: () => context.push('/chat/${item.proposal}'),
                      ),
                    ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class ConversationCard extends StatelessWidget {
  const ConversationCard({
    super.key,
    required this.conversation,
    required this.unread,
    required this.onTap,
  });

  final Conversation conversation;
  final int unread;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final hasUnread = unread > 0;
    return Tappable(
      pressedOpacity: 0.72,
      semanticLabel:
          'Xem trao đổi với ${conversation.name}${hasUnread ? ', $unread tin chưa đọc' : ''}',
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.symmetric(horizontal: 12),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
        decoration: BoxDecoration(
          color: MessageColors.surface,
          borderRadius: BorderRadius.circular(10),
          boxShadow: messageCardShadow,
        ),
        child: Row(
          spacing: 10,
          children: [
            Stack(
              clipBehavior: Clip.none,
              children: [
                UserAvatar(
                  name: conversation.name,
                  userId: conversation.userId,
                  size: AvatarSizes.list,
                ),
                if (hasUnread)
                  Positioned(
                    top: -3,
                    right: -3,
                    child: Container(
                      constraints: const BoxConstraints(minWidth: 18),
                      height: 18,
                      padding: const EdgeInsets.symmetric(horizontal: 2),
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: MessageColors.orange,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(
                          color: MessageColors.surface,
                          width: 2,
                        ),
                      ),
                      child: Text(
                        '$unread',
                        style: nunito(
                          (9, 12),
                          weight: FontWeight.w700,
                          color: MessageColors.white,
                        ),
                      ),
                    ),
                  ),
              ],
            ),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                spacing: 2,
                children: [
                  Row(
                    spacing: 5,
                    children: [
                      Flexible(
                        child: Text(
                          conversation.name,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: nunito(
                            TypeScale.body,
                            weight: FontWeight.w700,
                            color: MessageColors.ink,
                          ),
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 5,
                          vertical: 1,
                        ),
                        decoration: BoxDecoration(
                          color: MessageColors.tag,
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          conversation.skill,
                          style: nunito(
                            TypeScale.caption,
                            weight: FontWeight.w500,
                            color: MessageColors.muted,
                          ),
                        ),
                      ),
                      const Spacer(),
                      Text(
                        conversation.time,
                        style: nunito(
                          TypeScale.caption,
                          weight: hasUnread ? FontWeight.w700 : FontWeight.w400,
                          color: hasUnread
                              ? MessageColors.orange
                              : MessageColors.mutedLight,
                        ),
                      ),
                    ],
                  ),
                  Text(
                    conversation.last,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: nunito(
                      TypeScale.body,
                      weight: hasUnread ? FontWeight.w600 : FontWeight.w400,
                      color: hasUnread ? MessageColors.ink : MessageColors.body,
                    ),
                  ),
                  Text(
                    conversation.request,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: nunito(
                      TypeScale.secondary,
                      color: MessageColors.mutedLight,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class ChatScreen extends ConsumerWidget {
  const ChatScreen({super.key, required this.proposalId});

  final String proposalId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final conversation = ref.watch(
      messagesProvider.select((s) => s.find(proposalId)),
    );
    if (conversation != null) {
      ref.watch(_openedConversationProvider(conversation.id));
    }
    if (conversation == null) {
      return AppScreenLayout(
        title: 'Tin nhắn',
        selected: 'Tin nhắn',
        back: (route: '/messages', label: 'Quay lại tin nhắn'),
        child: EmptyState(
          icon: AppIcon.message,
          title: 'Không tìm thấy cuộc trao đổi',
          description: 'Cuộc trao đổi này không có trên máy chủ.',
          action: 'Quay lại tin nhắn',
          onAction: () => context.go('/messages'),
        ),
      );
    }
    return _ChatConversation(
      key: ValueKey(conversation.proposal),
      conversation: conversation,
    );
  }
}

class _ChatConversation extends ConsumerStatefulWidget {
  const _ChatConversation({super.key, required this.conversation});

  final Conversation conversation;

  @override
  ConsumerState<_ChatConversation> createState() => _ChatConversationState();
}

class _ChatConversationState extends ConsumerState<_ChatConversation> {
  final _draft = TextEditingController();
  final _focus = FocusNode();
  final _scroll = ScrollController();
  var _sending = false;

  String get _proposal => widget.conversation.proposal;

  @override
  void initState() {
    super.initState();
    _draft.addListener(() => setState(() {}));
    _focus.addListener(() => setState(() {}));
    Future.microtask(
      () => ref.read(messagesProvider.notifier).markRead(_proposal),
    );
  }

  @override
  void dispose() {
    _draft.dispose();
    _focus.dispose();
    _scroll.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final text = _draft.text;
    if (_sending || text.trim().isEmpty) return;
    setState(() => _sending = true);
    _draft.clear();
    try {
      await ref.read(messagesProvider.notifier).send(_proposal, text);
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (_scroll.hasClients) {
          _scroll.jumpTo(_scroll.position.maxScrollExtent);
        }
      });
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  void _agreement() => context.push('/agreement-type?proposalId=$_proposal');

  @override
  Widget build(BuildContext context) {
    final conversation = widget.conversation;
    final messages = ref.watch(
      messagesProvider.select((s) => s.threads[_proposal] ?? const []),
    );
    return Scaffold(
      backgroundColor: MessageColors.surface,
      body: SafeArea(
        child: Column(
          children: [
            _ChatHeader(
              conversation: conversation,
              onBack: () =>
                  context.canPop() ? context.pop() : context.go('/messages'),
              onAgreement: _agreement,
            ),
            Expanded(
              child: ColoredBox(
                color: MessageColors.canvas,
                child: ListView(
                  controller: _scroll,
                  keyboardDismissBehavior:
                      ScrollViewKeyboardDismissBehavior.onDrag,
                  padding: const EdgeInsets.fromLTRB(12, 10, 12, 16),
                  children: [
                    Center(
                      child: ConstrainedBox(
                        constraints: const BoxConstraints(maxWidth: 640),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          spacing: 8,
                          children: [
                            Padding(
                              padding: const EdgeInsets.symmetric(vertical: 2),
                              child: Text(
                                messages.isNotEmpty
                                    ? 'Hôm nay, ${messages.first.time}'
                                    : 'Bắt đầu cuộc trao đổi',
                                textAlign: TextAlign.center,
                                style: nunito(
                                  TypeScale.caption,
                                  color: MessageColors.mutedLight,
                                ),
                              ),
                            ),
                            const _AcceptedProposalNotice(),
                            AppButton(
                              label: 'Xem đề xuất gốc',
                              variant: ButtonVariant.secondary,
                              onPressed: () =>
                                  context.push('/proposal/$_proposal'),
                            ),
                            const SizedBox(height: 8),
                            for (final message in messages)
                              _MessageBubble(
                                message: message,
                                partner: conversation.name,
                                partnerId: conversation.userId,
                              ),
                            const SizedBox(height: 10),
                            _ChatNextStep(onPressed: _agreement),
                            Semantics(
                              label: 'Trạng thái đang nhập mẫu',
                              child: Row(
                                crossAxisAlignment: CrossAxisAlignment.end,
                                spacing: 8,
                                children: [
                                  UserAvatar(
                                    name: conversation.name,
                                    userId: conversation.userId,
                                    size: AvatarSizes.inline,
                                  ),
                                  Container(
                                    constraints: const BoxConstraints(
                                      minHeight: 24,
                                    ),
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 10,
                                      vertical: 7,
                                    ),
                                    decoration: BoxDecoration(
                                      color: MessageColors.surface,
                                      borderRadius: BorderRadius.circular(10),
                                      boxShadow: messageCardShadow,
                                    ),
                                    child: Row(
                                      mainAxisSize: MainAxisSize.min,
                                      spacing: 4,
                                      children: List.generate(
                                        3,
                                        (_) => Container(
                                          width: 4,
                                          height: 4,
                                          decoration: const BoxDecoration(
                                            color: MessageColors.mutedLight,
                                            shape: BoxShape.circle,
                                          ),
                                        ),
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            _ChatComposer(
              controller: _draft,
              focus: _focus,
              sending: _sending,
              onSend: _submit,
              onAttach: () =>
                  context.push('/chat-attachment?proposalId=$_proposal'),
            ),
          ],
        ),
      ),
    );
  }
}

class _ChatHeader extends StatelessWidget {
  const _ChatHeader({
    required this.conversation,
    required this.onBack,
    required this.onAgreement,
  });

  final Conversation conversation;
  final VoidCallback onBack;
  final VoidCallback onAgreement;

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: const BoxConstraints(minHeight: 64),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: const BoxDecoration(
        color: MessageColors.surface,
        border: Border(bottom: BorderSide(color: MessageColors.border)),
      ),
      child: Row(
        spacing: 7,
        children: [
          Tappable(
            semanticLabel: 'Quay lại tin nhắn',
            onTap: onBack,
            child: SizedBox(
              width: 28,
              height: 44,
              child: Center(
                child: Transform.rotate(
                  angle: 3.14159,
                  child: const AppIcon(
                    AppIcon.arrow,
                    size: IconSizes.control,
                    color: MessageColors.inkSoft,
                  ),
                ),
              ),
            ),
          ),
          UserAvatar(
            name: conversation.name,
            userId: conversation.userId,
            size: AvatarSizes.compact,
          ),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Semantics(
                  header: true,
                  child: Text(
                    conversation.name,
                    style: nunito(
                      TypeScale.body,
                      weight: FontWeight.w600,
                      color: MessageColors.ink,
                    ),
                  ),
                ),
                Row(
                  spacing: 4,
                  children: [
                    Container(
                      width: 6,
                      height: 6,
                      decoration: const BoxDecoration(
                        color: Color(0xFF30A876),
                        shape: BoxShape.circle,
                      ),
                    ),
                    Expanded(
                      child: Text(
                        'Đang hoạt động · Proposal đã chấp nhận',
                        style: nunito(
                          TypeScale.caption,
                          color: const Color(0xFF409678),
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          Tappable(
            semanticLabel: 'Tạo thỏa thuận',
            pressedOpacity: 0.8,
            onTap: onAgreement,
            child: Container(
              constraints: const BoxConstraints(minHeight: 36),
              padding: const EdgeInsets.symmetric(horizontal: 9),
              decoration: BoxDecoration(
                color: MessageColors.orange,
                borderRadius: BorderRadius.circular(14),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                spacing: 4,
                children: [
                  const AppIcon(
                    AppIcon.checkCircle,
                    size: IconSizes.inline,
                    color: MessageColors.white,
                  ),
                  Text(
                    'Tạo thỏa thuận',
                    style: nunito(
                      TypeScale.caption,
                      weight: FontWeight.w600,
                      color: MessageColors.white,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _AcceptedProposalNotice extends StatelessWidget {
  const _AcceptedProposalNotice();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Container(
        constraints: const BoxConstraints(maxWidth: 512),
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: MessageColors.sageLight,
          borderRadius: BorderRadius.circular(AppRadii.card),
          border: Border.all(color: const Color(0xFFBDEFD6)),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          spacing: 12,
          children: [
            const AppIcon(
              AppIcon.checkCircle,
              size: IconSizes.control,
              color: MessageColors.sage,
            ),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                spacing: 4,
                children: [
                  Text(
                    ChatCopy.acceptedTitle,
                    style: nunito(
                      TypeScale.secondary,
                      weight: FontWeight.w700,
                      color: MessageColors.sage,
                    ),
                  ),
                  Text(
                    ChatCopy.acceptedBody,
                    style: nunito(
                      TypeScale.secondary,
                      color: MessageColors.body,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ChatNextStep extends StatelessWidget {
  const _ChatNextStep({required this.onPressed});

  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Container(
        constraints: const BoxConstraints(maxWidth: 512),
        clipBehavior: Clip.antiAlias,
        decoration: BoxDecoration(
          color: MessageColors.surface,
          borderRadius: BorderRadius.circular(AppRadii.card),
          border: Border.all(color: const Color(0xFFD8CCBE)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Container(height: 4, color: MessageColors.brand),
            Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                spacing: 3,
                children: [
                  Wrap(
                    alignment: WrapAlignment.spaceBetween,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    spacing: 8,
                    runSpacing: 4,
                    children: [
                      Text(
                        'BƯỚC TIẾP THEO',
                        style: nunito(
                          TypeScale.caption,
                          weight: FontWeight.w700,
                          color: MessageColors.brand,
                        ),
                      ),
                      const AppBadge(
                        label: 'Chưa chọn',
                        variant: BadgeVariant.warning,
                      ),
                    ],
                  ),
                  Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Text(
                      ChatCopy.nextStepTitle,
                      style: nunito(
                        TypeScale.body,
                        weight: FontWeight.w700,
                        color: MessageColors.ink,
                      ),
                    ),
                  ),
                  Text(
                    ChatCopy.nextStepBody,
                    style: nunito(TypeScale.caption, color: MessageColors.muted),
                  ),
                  const SizedBox(height: 10),
                  AppButton(
                    variant: ButtonVariant.craft,
                    onPressed: onPressed,
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      spacing: 6,
                      children: [
                        Text(
                          'Chọn hình thức học',
                          style: nunito(
                            TypeScale.secondary,
                            weight: FontWeight.w600,
                            color: MessageColors.white,
                          ),
                        ),
                        const AppIcon(
                          AppIcon.arrow,
                          size: IconSizes.inline,
                          color: MessageColors.white,
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _MessageBubble extends StatelessWidget {
  const _MessageBubble({
    required this.message,
    required this.partner,
    required this.partnerId,
  });

  final ChatMessage message;
  final String partner;
  final String partnerId;

  @override
  Widget build(BuildContext context) {
    final mine = message.mine;
    final width = MediaQuery.sizeOf(context).width;
    final factor = width >= 768 ? 0.62 : (mine ? 0.82 : 0.70);
    final file = message.file;
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Column(
        crossAxisAlignment: mine
            ? CrossAxisAlignment.end
            : CrossAxisAlignment.start,
        spacing: 2,
        children: [
          LayoutBuilder(
            builder: (context, constraints) => Row(
              mainAxisAlignment: mine
                  ? MainAxisAlignment.end
                  : MainAxisAlignment.start,
              crossAxisAlignment: CrossAxisAlignment.end,
              spacing: 8,
              children: [
                if (!mine)
                  UserAvatar(
                    name: partner,
                    userId: partnerId,
                    size: AvatarSizes.inline,
                  ),
                ConstrainedBox(
                  constraints: BoxConstraints(
                    maxWidth: constraints.maxWidth * factor,
                  ),
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 7,
                    ),
                    decoration: BoxDecoration(
                      color: mine ? MessageColors.orange : MessageColors.surface,
                      borderRadius: BorderRadius.only(
                        topLeft: const Radius.circular(10),
                        topRight: const Radius.circular(10),
                        bottomLeft: Radius.circular(mine ? 10 : 3),
                        bottomRight: Radius.circular(mine ? 3 : 10),
                      ),
                      boxShadow: mine ? null : messageCardShadow,
                    ),
                    child: SelectableText(
                      '${message.text}'
                      '${file != null ? '\n${(file.bytes / 1024 / 1024).toStringAsFixed(1)} MB · tệp mẫu, không có đường dẫn tải' : ''}',
                      style: nunito(
                        TypeScale.body,
                        color: mine ? MessageColors.white : MessageColors.ink,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
          Padding(
            padding: EdgeInsets.only(left: mine ? 0 : AvatarSizes.inline + 8),
            child: Text(
              message.time,
              style: nunito(
                TypeScale.caption,
                color: mine ? MessageColors.muted : MessageColors.mutedLight,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ChatComposer extends StatelessWidget {
  const _ChatComposer({
    required this.controller,
    required this.focus,
    required this.onSend,
    required this.onAttach,
    this.sending = false,
  });

  final TextEditingController controller;
  final FocusNode focus;
  final VoidCallback onSend;
  final VoidCallback onAttach;
  final bool sending;

  @override
  Widget build(BuildContext context) {
    final disabled = sending || controller.text.trim().isEmpty;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: const BoxDecoration(
        color: MessageColors.surface,
        border: Border(top: BorderSide(color: MessageColors.border)),
      ),
      child: Column(
        spacing: 3,
        children: [
          ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 768),
            child: Row(
              spacing: 6,
              children: [
                Tappable(
                  semanticLabel: 'Đính kèm tệp',
                  onTap: sending ? null : onAttach,
                  child: const SizedBox(
                    width: 44,
                    height: 44,
                    child: Center(
                      child: AppIcon(
                        AppIcon.paperclip,
                        size: IconSizes.control,
                        color: MessageColors.muted,
                      ),
                    ),
                  ),
                ),
                Expanded(
                  child: Container(
                    constraints: const BoxConstraints(minHeight: 44),
                    alignment: Alignment.centerLeft,
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF5F4F2),
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(
                        color: focus.hasFocus
                            ? MessageColors.brand
                            : Colors.transparent,
                      ),
                    ),
                    child: TextField(
                      controller: controller,
                      focusNode: focus,
                      textInputAction: TextInputAction.send,
                      onSubmitted: sending ? null : (_) => onSend(),
                      style: nunito(TypeScale.body, color: MessageColors.ink),
                      decoration: InputDecoration(
                        isDense: true,
                        border: InputBorder.none,
                        hintText: 'Nhập tin nhắn...',
                        hintStyle: nunito(
                          TypeScale.body,
                          color: MessageColors.mutedLight,
                        ),
                      ),
                    ),
                  ),
                ),
                Semantics(
                  button: true,
                  enabled: !disabled,
                  label: sending ? 'Đang gửi tin nhắn' : 'Gửi tin nhắn',
                  child: Opacity(
                    opacity: disabled ? 0.5 : 1,
                    child: GestureDetector(
                      onTap: disabled ? null : onSend,
                      child: Container(
                        width: 44,
                        height: 44,
                        alignment: Alignment.center,
                        decoration: const BoxDecoration(
                          color: MessageColors.orange,
                          shape: BoxShape.circle,
                        ),
                        child: sending
                            ? const SizedBox(
                                width: 18,
                                height: 18,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: MessageColors.white,
                                ),
                              )
                            : const AppIcon(
                                AppIcon.send,
                                size: IconSizes.control,
                                color: MessageColors.white,
                              ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
          Text(
            ChatCopy.footer,
            textAlign: TextAlign.center,
            style: nunito(TypeScale.caption, color: MessageColors.mutedLight),
          ),
        ],
      ),
    );
  }
}

class AttachmentScreen extends ConsumerStatefulWidget {
  const AttachmentScreen({super.key, required this.proposalId});

  final String? proposalId;

  @override
  ConsumerState<AttachmentScreen> createState() => _AttachmentScreenState();
}

class _AttachmentScreenState extends ConsumerState<AttachmentScreen> {
  String _error = '';
  String _status = '';
  var _sending = false;

  Future<void> _send() async {
    if (_sending) return;
    final proposalId = widget.proposalId;
    final conversation = proposalId == null
        ? null
        : ref.read(messagesProvider).find(proposalId);
    if (conversation == null) return;
    setState(() {
      _sending = true;
      _error = '';
      _status = '';
    });
    try {
      final picked = await ImagePicker().pickImage(
        source: ImageSource.gallery,
        requestFullMetadata: false,
      );
      if (picked == null) return;
      final bytes = await picked.readAsBytes();
      final api = ref.read(authRuntimeProvider).services.conversations;
      final uploaded = await api.upload(
        conversation.id,
        FormData.fromMap({
          'file': MultipartFile.fromBytes(bytes, filename: picked.name),
        }),
      );
      final fileId = uploaded['fileId']?.toString() ?? '';
      if (fileId.isEmpty) {
        setState(() => _status = 'Máy chủ đã nhận tệp.');
        return;
      }
      final status = await api.attachmentStatus(conversation.id, fileId);
      final deliveryId = uploaded['clientMessageId']?.toString() ?? '';
      if (deliveryId.isNotEmpty) {
        await api.delivery(conversation.id, deliveryId);
      }
      final messageId = uploaded['messageId']?.toString() ?? '';
      final attachmentId = uploaded['attachmentId']?.toString() ?? fileId;
      if (messageId.isNotEmpty) {
        final link = await api.attachmentDownload(
          conversation.id,
          messageId,
          attachmentId,
        );
        setState(() => _status = link['url']?.toString() ?? status.toString());
        return;
      }
      setState(() => _status = status['state']?.toString() ?? 'Đã tải lên.');
    } catch (error) {
      if (mounted) setState(() => _error = errorMessage(error));
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final id = widget.proposalId;
    final exists = ref.watch(
      messagesProvider.select((s) => s.find(id) != null),
    );
    return FeaturePage(
      title: 'Gửi tệp trong chat',
      back: id != null ? '/chat/$id' : '/messages',
      children: [
        if (!exists)
          const EmptyState(
            title: 'Không tìm thấy cuộc trao đổi',
            description: 'Không thể gửi tệp vào cuộc trao đổi này.',
          )
        else
          Panel(
            title: 'Đính kèm ảnh',
            children: [
              if (_error.isNotEmpty)
                FormNotice(tone: NoticeTone.error, message: _error),
              if (_status.isNotEmpty) Copy(_status),
              AppButton(
                label: _sending ? 'Đang gửi...' : 'Chọn ảnh và gửi',
                loading: _sending,
                onPressed: _send,
              ),
            ],
          ),
      ],
    );
  }
}
