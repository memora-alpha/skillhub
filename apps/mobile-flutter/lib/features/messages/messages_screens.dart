import 'package:dio/dio.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

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
import '../remote/refresh_signal.dart';
import 'messages_data.dart';

const _chatMimes = {
  'pdf': 'application/pdf',
  'doc': 'application/msword',
  'docx':
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'xls': 'application/vnd.ms-excel',
  'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'ppt': 'application/vnd.ms-powerpoint',
  'pptx':
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'txt': 'text/plain',
  'jpg': 'image/jpeg',
  'jpeg': 'image/jpeg',
  'png': 'image/png',
  'webp': 'image/webp',
};

final _openedConversationProvider = FutureProvider.family<void, String>((
  ref,
  id,
) async {
  final phase = ref.watch(sessionSnapshotProvider).phase;
  if (phase != SessionPhase.ready) return;
  await ref.read(authRuntimeProvider).services.conversations.get(id);
});

class MessagesScreen extends ConsumerWidget {
  const MessagesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(messagesProvider);
    return AppScreenLayout(
      title: 'Tin nhắn',
      selected: 'Tin nhắn',
      background: MessageColors.background,
      child: RefreshIndicator(
        onRefresh: () => pullRefresh(ref, const {RefreshScope.messages}),
        child: ListView(
        keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
        children: [
          Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 640),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                spacing: 12,
                children: [
                  WaitingRefresh(
                    scopes: const {RefreshScope.messages},
                    enabled: true,
                    shellIndex: 3,
                    child: const SizedBox.shrink(),
                  ),
                  const RouteButton(
                    secondary: true,
                    href: '/proposals',
                    label: 'Xem đề xuất đã nhận / đã gửi',
                  ),
                  const Copy(
                    'Những đề xuất đã chấp nhận mở cuộc trao đổi tại đây.',
                  ),
                  if (!state.settled && state.conversations.isEmpty)
                    const Padding(
                      padding: EdgeInsets.symmetric(vertical: 28),
                      child: Center(
                        child: CircularProgressIndicator(strokeWidth: 2),
                      ),
                    )
                  else if (state.conversations.isEmpty)
                    EmptyState(
                      icon: AppIcon.message,
                      title: 'Chưa có cuộc trao đổi',
                      description:
                          'Chat xuất hiện sau khi đề xuất được chấp nhận.',
                      action: 'Xem đề xuất',
                      onAction: () => context.push('/proposals'),
                    ),
                  for (final item in state.conversations)
                    Panel(
                      title: item.name.isEmpty
                          ? 'Thành viên SkillHub'
                          : item.name,
                      children: [
                        Copy(
                          item.createdLabel.isEmpty
                              ? 'Đề xuất đã chấp nhận'
                              : 'Đề xuất đã chấp nhận · ${item.createdLabel}',
                        ),
                        AppButton(
                          label: 'Mở cuộc trao đổi',
                          onPressed: () =>
                              context.push('/chat/${item.proposal}'),
                        ),
                      ],
                    ),
                ],
              ),
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
    final messages = ref.watch(messagesProvider);
    final conversation = messages.find(proposalId);
    if (conversation != null) {
      ref.watch(_openedConversationProvider(conversation.id));
    }
    if (conversation == null) {
      return AppScreenLayout(
        title: 'Tin nhắn',
        selected: 'Tin nhắn',
        back: (route: '/messages', label: 'Quay lại tin nhắn'),
        child: messages.settled
            ? EmptyState(
                icon: AppIcon.message,
                title: 'Không tìm thấy cuộc trao đổi',
                description: 'Cuộc trao đổi này không có trên máy chủ.',
                action: 'Quay lại tin nhắn',
                onAction: () => context.go('/messages'),
              )
            : const Center(
                child: CircularProgressIndicator(strokeWidth: 2),
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
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      ref.read(messagesProvider.notifier).markRead(_proposal);
    });
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
    final olderCursor = ref.watch(
      messagesProvider.select((s) => s.olderCursors[_proposal]),
    );
    return WaitingRefresh(
      scopes: const {RefreshScope.messages},
      enabled: true,
      child: Scaffold(
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
                            const Copy(
                              'Chat để thương lượng; xác nhận kế hoạch và lịch học cần thao tác riêng.',
                              muted: true,
                            ),
                            AppButton(
                              label: 'Xem đề xuất gốc',
                              variant: ButtonVariant.secondary,
                              onPressed: () =>
                                  context.push('/proposal/$_proposal'),
                            ),
                            AppButton(
                              label: 'Lộ trình học',
                              onPressed: _agreement,
                            ),
                            if (olderCursor != null && olderCursor.isNotEmpty)
                              AppButton(
                                label: 'Tin nhắn trước đó',
                                variant: ButtonVariant.secondary,
                                onPressed: () => ref
                                    .read(messagesProvider.notifier)
                                    .loadOlder(_proposal),
                              ),
                            if (messages.isEmpty)
                              const Copy(
                                'Bắt đầu trao đổi về mục tiêu và cách học.',
                                muted: true,
                              ),
                            for (final message in messages)
                              _MessageBubble(
                                message: message,
                                partner: conversation.name,
                                partnerId: conversation.userId,
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
                Text(
                  'Đề xuất đã chấp nhận',
                  style: nunito(
                    TypeScale.caption,
                    color: MessageColors.muted,
                  ),
                ),
              ],
            ),
          ),
          Tappable(
            semanticLabel: 'Lộ trình học',
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
                    'Lộ trình học',
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
      final picked = await FilePicker.pickFiles(
        type: FileType.custom,
        allowedExtensions: _chatMimes.keys.toList(),
      );
      if (picked.isEmpty) return;
      final file = picked.single;
      final bytes = await file.readAsBytes();
      final mime = _chatMimes[file.name.split('.').last.toLowerCase()];
      if (mime == null) {
        setState(
          () => _error =
              'Chọn PDF, Word, Excel, PowerPoint, TXT hoặc ảnh JPG/PNG/WebP hợp lệ.',
        );
        return;
      }
      if (bytes.isEmpty) {
        setState(() => _error = 'Không đọc được kích thước tệp hoặc tệp rỗng.');
        return;
      }
      if (bytes.length > 15000000) {
        setState(
          () => _error = 'Tệp vượt giới hạn 15 MB (15.000.000 byte).',
        );
        return;
      }
      final api = ref.read(authRuntimeProvider).services.conversations;
      final uploaded = await api.upload(
        conversation.id,
        FormData.fromMap({
          'file': MultipartFile.fromBytes(
            bytes,
            filename: file.name,
            contentType: DioMediaType.parse(mime),
          ),
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
    final messages = ref.watch(messagesProvider);
    final exists = messages.find(id) != null;
    return FeaturePage(
      title: 'Gửi tệp trong chat',
      back: id != null ? '/chat/$id' : '/messages',
      children: [
        if (!exists && !messages.settled)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 28),
            child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
          )
        else if (!exists)
          const EmptyState(
            title: 'Không tìm thấy cuộc trao đổi',
            description: 'Không thể gửi tệp vào cuộc trao đổi này.',
          )
        else
          Panel(
            title: 'Gửi tệp trong chat',
            children: [
              const Copy(
                'Tối đa 15 MB mỗi tệp. Tệp cần hoàn tất kiểm tra trước khi gửi.',
                muted: true,
              ),
              if (_error.isNotEmpty)
                FormNotice(tone: NoticeTone.error, message: _error),
              if (_status.isNotEmpty) Copy(_status),
              AppButton(
                label: _sending ? 'Đang gửi...' : 'Chọn tệp',
                loading: _sending,
                onPressed: _send,
              ),
            ],
          ),
      ],
    );
  }
}
