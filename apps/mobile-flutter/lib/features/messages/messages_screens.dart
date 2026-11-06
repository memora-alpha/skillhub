import 'package:dio/dio.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
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
import '../learning_paths/live_paths.dart';
import '../learning_paths/negotiation_card.dart';
import '../learning_paths/negotiation_message.dart';
import '../learning_paths/plan_suggestion_draft.dart';
import '../proposals/proposals_data.dart';
import '../shell/app_screen_layout.dart';
import '../remote/refresh_signal.dart';
import 'messages_data.dart';

Map<String, String> _skillByProposal(WidgetRef ref) => {
  for (final item in ref.watch(proposalsProvider))
    if (item.skill.trim().isNotEmpty) item.id: item.skill.trim(),
};

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

class MessagesScreen extends ConsumerStatefulWidget {
  const MessagesScreen({super.key});

  @override
  ConsumerState<MessagesScreen> createState() => _MessagesScreenState();
}

class _MessagesScreenState extends ConsumerState<MessagesScreen> {
  var _query = '';

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(messagesProvider);
    final skillByProposal = _skillByProposal(ref);
    final partners = state.partners(query: _query);
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
                      'Chọn người để xem các cuộc trao đổi theo kỹ năng.',
                      muted: true,
                    ),
                    _InboxSearchField(
                      hint: 'Tìm theo tên hoặc kỹ năng',
                      onChanged: (value) => setState(() => _query = value),
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
                      )
                    else if (partners.isEmpty)
                      const EmptyState(
                        icon: AppIcon.search,
                        title: 'Không tìm thấy người phù hợp',
                        description: 'Thử tên khác hoặc xóa bộ lọc tìm kiếm.',
                      )
                    else
                      for (final partner in partners)
                        _PartnerCard(
                          key: ValueKey(partner.userId),
                          partner: partner,
                          skillByProposal: skillByProposal,
                          onTap: () => context.push(
                            '/messages/with/${Uri.encodeComponent(partner.userId)}',
                          ),
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

class MessagePartnerScreen extends ConsumerStatefulWidget {
  const MessagePartnerScreen({super.key, required this.userId});

  final String userId;

  @override
  ConsumerState<MessagePartnerScreen> createState() =>
      _MessagePartnerScreenState();
}

class _MessagePartnerScreenState extends ConsumerState<MessagePartnerScreen> {
  var _query = '';

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(messagesProvider);
    final skillByProposal = _skillByProposal(ref);
    final skills = state.partnerSkills(
      widget.userId,
      query: _query,
      skillByProposal: skillByProposal,
    );
    final partner = state
        .partners()
        .where((item) => item.userId == widget.userId)
        .firstOrNull;
    final title = partner == null
        ? 'Kỹ năng'
        : (partner.name.isEmpty ? 'Thành viên SkillHub' : partner.name);
    return AppScreenLayout(
      title: title,
      selected: 'Tin nhắn',
      background: MessageColors.background,
      back: (route: '/messages', label: 'Quay lại tin nhắn'),
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
                    if (partner != null)
                      Row(
                        spacing: 12,
                        children: [
                          UserAvatar(
                            name: partner.name,
                            userId: partner.userId,
                            imageUrl: partner.avatarUrl,
                            size: AvatarSizes.list,
                          ),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              spacing: 2,
                              children: [
                                Text(
                                  title,
                                  style: nunito(
                                    TypeScale.heading,
                                    weight: FontWeight.w700,
                                    color: MessageColors.ink,
                                  ),
                                ),
                                Text(
                                  partner.skillSummary(
                                    skillByProposal: skillByProposal,
                                  ),
                                  style: nunito(
                                    TypeScale.secondary,
                                    color: MessageColors.muted,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    const Copy(
                      'Chọn kỹ năng để xem các cuộc trao đổi.',
                      muted: true,
                    ),
                    _InboxSearchField(
                      hint: 'Tìm theo kỹ năng',
                      onChanged: (value) => setState(() => _query = value),
                    ),
                    if (!state.settled && skills.isEmpty)
                      const Padding(
                        padding: EdgeInsets.symmetric(vertical: 28),
                        child: Center(
                          child: CircularProgressIndicator(strokeWidth: 2),
                        ),
                      )
                    else if (skills.isEmpty && _query.trim().isEmpty)
                      EmptyState(
                        icon: AppIcon.message,
                        title: 'Chưa có kỹ năng',
                        description: 'Chưa có cuộc chat với người này.',
                        action: 'Quay lại',
                        onAction: () => context.go('/messages'),
                      )
                    else if (skills.isEmpty)
                      const EmptyState(
                        icon: AppIcon.search,
                        title: 'Không tìm thấy kỹ năng',
                        description: 'Thử từ khóa khác hoặc xóa bộ lọc.',
                      )
                    else
                      for (final skill in skills)
                        _SkillGroupCard(
                          key: ValueKey(skill.key),
                          skill: skill,
                          onTap: () => context.push(
                            '${_partnerMessagesPath(widget.userId)}/skill/${Uri.encodeComponent(skill.key)}',
                          ),
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

class MessageSkillScreen extends ConsumerStatefulWidget {
  const MessageSkillScreen({
    super.key,
    required this.userId,
    required this.skillKey,
  });

  final String userId;
  final String skillKey;

  @override
  ConsumerState<MessageSkillScreen> createState() => _MessageSkillScreenState();
}

class _MessageSkillScreenState extends ConsumerState<MessageSkillScreen> {
  var _query = '';

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(messagesProvider);
    final skillByProposal = _skillByProposal(ref);
    final threads = state.partnerThreads(
      widget.userId,
      query: _query,
      skillKey: widget.skillKey,
      skillByProposal: skillByProposal,
    );
    final skill = state
        .partnerSkills(widget.userId, skillByProposal: skillByProposal)
        .where((item) => item.key == widget.skillKey)
        .firstOrNull;
    final title = skill?.label ?? 'Cuộc trao đổi';
    final back = _partnerMessagesPath(widget.userId);
    return AppScreenLayout(
      title: title,
      selected: 'Tin nhắn',
      background: MessageColors.background,
      back: (route: back, label: 'Quay lại kỹ năng'),
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
                    Copy(
                      skill == null
                          ? 'Chọn cuộc trao đổi để mở chat.'
                          : '${skill.threadSummary} · chọn một cuộc để mở chat.',
                      muted: true,
                    ),
                    _InboxSearchField(
                      hint: 'Tìm theo tiêu đề hoặc nội dung',
                      onChanged: (value) => setState(() => _query = value),
                    ),
                    if (!state.settled && threads.isEmpty)
                      const Padding(
                        padding: EdgeInsets.symmetric(vertical: 28),
                        child: Center(
                          child: CircularProgressIndicator(strokeWidth: 2),
                        ),
                      )
                    else if (threads.isEmpty && _query.trim().isEmpty)
                      EmptyState(
                        icon: AppIcon.message,
                        title: 'Chưa có cuộc trao đổi',
                        description: 'Chưa có chat cho kỹ năng này.',
                        action: 'Quay lại',
                        onAction: () => context.go(back),
                      )
                    else if (threads.isEmpty)
                      const EmptyState(
                        icon: AppIcon.search,
                        title: 'Không tìm thấy cuộc trao đổi',
                        description: 'Thử từ khóa khác hoặc xóa bộ lọc.',
                      )
                    else
                      for (final item in threads)
                        _SkillThreadCard(
                          key: ValueKey(item.id),
                          conversation: item,
                          onTap: () => context.push('/chat/${item.id}'),
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

class _InboxSearchField extends StatelessWidget {
  const _InboxSearchField({required this.hint, required this.onChanged});

  final String hint;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: const BoxConstraints(minHeight: 48),
      padding: const EdgeInsets.symmetric(horizontal: 12),
      decoration: BoxDecoration(
        color: MessageColors.surface,
        borderRadius: BorderRadius.circular(AppRadii.card),
        border: Border.all(color: MessageColors.border),
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
              onChanged: onChanged,
              style: nunito(TypeScale.body, color: MessageColors.ink),
              decoration: InputDecoration(
                isCollapsed: true,
                border: InputBorder.none,
                hintText: hint,
                hintStyle: nunito(
                  TypeScale.body,
                  color: MessageColors.mutedLight,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _PartnerCard extends StatelessWidget {
  const _PartnerCard({
    super.key,
    required this.partner,
    required this.onTap,
    this.skillByProposal = const {},
  });

  final MessagePartner partner;
  final VoidCallback onTap;
  final Map<String, String> skillByProposal;

  @override
  Widget build(BuildContext context) {
    final name = partner.name.isEmpty ? 'Thành viên SkillHub' : partner.name;
    return Tappable(
      semanticLabel: name,
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: MessageColors.surface,
          borderRadius: BorderRadius.circular(AppRadii.card),
          border: Border.all(color: MessageColors.border),
          boxShadow: messageCardShadow,
        ),
        child: Row(
          spacing: 12,
          children: [
            UserAvatar(
              name: partner.name,
              userId: partner.userId,
              imageUrl: partner.avatarUrl,
              size: AvatarSizes.list,
            ),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                spacing: 4,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          name,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: nunito(
                            TypeScale.body,
                            weight: FontWeight.w700,
                            color: MessageColors.ink,
                          ),
                        ),
                      ),
                      if (partner.latest.time.isNotEmpty)
                        Text(
                          partner.latest.time,
                          style: nunito(
                            TypeScale.caption,
                            color: MessageColors.muted,
                          ),
                        ),
                    ],
                  ),
                  Text(
                    partner.skillSummary(skillByProposal: skillByProposal),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: nunito(
                      TypeScale.secondary,
                      weight: FontWeight.w600,
                      color: MessageColors.body,
                    ),
                  ),
                  Text(
                    partner.preview,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: nunito(
                      TypeScale.secondary,
                      color: MessageColors.muted,
                    ),
                  ),
                ],
              ),
            ),
            if (partner.unread > 0)
              Container(
                constraints: const BoxConstraints(minWidth: 22, minHeight: 22),
                padding: const EdgeInsets.symmetric(horizontal: 6),
                alignment: Alignment.center,
                decoration: const BoxDecoration(
                  color: MessageColors.orange,
                  borderRadius: BorderRadius.all(Radius.circular(11)),
                ),
                child: Text(
                  partner.unread > 99 ? '99+' : '${partner.unread}',
                  style: nunito(
                    TypeScale.caption,
                    weight: FontWeight.w700,
                    color: MessageColors.white,
                  ),
                ),
              )
            else
              const AppIcon(
                AppIcon.chevron,
                size: IconSizes.control,
                color: MessageColors.muted,
              ),
          ],
        ),
      ),
    );
  }
}

class _SkillGroupCard extends StatelessWidget {
  const _SkillGroupCard({super.key, required this.skill, required this.onTap});

  final MessageSkillGroup skill;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Tappable(
      semanticLabel: skill.label,
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: MessageColors.surface,
          borderRadius: BorderRadius.circular(AppRadii.card),
          border: Border.all(color: MessageColors.border),
          boxShadow: messageCardShadow,
        ),
        child: Row(
          spacing: 12,
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                spacing: 6,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          skill.label,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: fraunces(20, 28, color: MessageColors.ink),
                        ),
                      ),
                      if (skill.latest.time.isNotEmpty)
                        Text(
                          skill.latest.time,
                          style: nunito(
                            TypeScale.caption,
                            color: MessageColors.muted,
                          ),
                        ),
                    ],
                  ),
                  Text(
                    skill.threadSummary,
                    style: nunito(
                      TypeScale.secondary,
                      weight: FontWeight.w600,
                      color: MessageColors.body,
                    ),
                  ),
                  Text(
                    skill.preview,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: nunito(
                      TypeScale.secondary,
                      color: MessageColors.muted,
                    ),
                  ),
                ],
              ),
            ),
            if (skill.unread > 0)
              Container(
                constraints: const BoxConstraints(minWidth: 22, minHeight: 22),
                padding: const EdgeInsets.symmetric(horizontal: 6),
                alignment: Alignment.center,
                decoration: const BoxDecoration(
                  color: MessageColors.orange,
                  borderRadius: BorderRadius.all(Radius.circular(11)),
                ),
                child: Text(
                  skill.unread > 99 ? '99+' : '${skill.unread}',
                  style: nunito(
                    TypeScale.caption,
                    weight: FontWeight.w700,
                    color: MessageColors.white,
                  ),
                ),
              )
            else
              const AppIcon(
                AppIcon.chevron,
                size: IconSizes.control,
                color: MessageColors.muted,
              ),
          ],
        ),
      ),
    );
  }
}

class _SkillThreadCard extends StatelessWidget {
  const _SkillThreadCard({
    super.key,
    required this.conversation,
    required this.onTap,
  });

  final Conversation conversation;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final title = conversation.inboxTitle;
    final preview = conversation.last.isEmpty
        ? (conversation.createdLabel.isEmpty
              ? 'Đề xuất đã chấp nhận'
              : 'Đề xuất đã chấp nhận · ${conversation.createdLabel}')
        : conversationMessagePreview(conversation.last);
    return Tappable(
      semanticLabel: title,
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: MessageColors.surface,
          borderRadius: BorderRadius.circular(AppRadii.card),
          border: Border.all(color: MessageColors.border),
          boxShadow: messageCardShadow,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          spacing: 8,
          children: [
            Row(
              spacing: 8,
              children: [
                Expanded(
                  child: Text(
                    title,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: fraunces(20, 28, color: MessageColors.ink),
                  ),
                ),
                if (conversation.time.isNotEmpty)
                  Text(
                    conversation.time,
                    style: nunito(
                      TypeScale.caption,
                      color: MessageColors.muted,
                    ),
                  ),
              ],
            ),
            Text(
              preview,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: nunito(TypeScale.body, color: MessageColors.body),
            ),
            Text(
              conversationReference(conversation.proposal),
              style: nunito(TypeScale.caption, color: MessageColors.muted),
            ),
            Align(
              alignment: Alignment.centerRight,
              child: Text(
                'Mở chat',
                style: nunito(
                  TypeScale.secondary,
                  weight: FontWeight.w700,
                  color: MessageColors.orange,
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
  const ChatScreen({super.key, required this.conversationId});

  final String conversationId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final id =
        GoRouterState.of(context).pathParameters['proposalId'] ?? conversationId;
    final opening = ref.watch(openChatProvider(id));
    final messages = ref.watch(messagesProvider);
    Conversation? conversation;
    for (final item in messages.conversations) {
      if (item.id == id) {
        conversation = item;
        break;
      }
    }
    if (conversation == null) {
      final pending = opening.isLoading || !messages.settled;
      return AppScreenLayout(
        title: 'Tin nhắn',
        selected: 'Tin nhắn',
        back: (route: '/messages', label: 'Quay lại tin nhắn'),
        child: pending
            ? const Center(
                child: CircularProgressIndicator(strokeWidth: 2),
              )
            : EmptyState(
                icon: AppIcon.message,
                title: 'Không tìm thấy cuộc trao đổi',
                description: 'Cuộc trao đổi này không có trên máy chủ.',
                action: 'Quay lại tin nhắn',
                onAction: () => context.go('/messages'),
              ),
      );
    }
    return _ChatConversation(
      key: ValueKey(conversation.id),
      conversation: conversation,
    );
  }
}

String _partnerMessagesPath(String userId) =>
    '/messages/with/${Uri.encodeComponent(userId)}';

class _ChatConversation extends ConsumerStatefulWidget {
  const _ChatConversation({super.key, required this.conversation});

  final Conversation conversation;

  @override
  ConsumerState<_ChatConversation> createState() => _ChatConversationState();
}

class _PendingChatFile {
  const _PendingChatFile({
    required this.name,
    required this.bytes,
    required this.mime,
    this.fileId,
  });

  final String name;
  final int bytes;
  final String mime;
  final String? fileId;

  _PendingChatFile copyWith({String? fileId}) => _PendingChatFile(
    name: name,
    bytes: bytes,
    mime: mime,
    fileId: fileId ?? this.fileId,
  );
}

class _ChatConversationState extends ConsumerState<_ChatConversation> {
  final _draft = TextEditingController();
  final _focus = FocusNode();
  final _scroll = ScrollController();
  var _sending = false;
  var _attaching = false;
  _PendingChatFile? _pendingFile;
  String? _attachError;
  String? _attachStatus;

  String get _id => widget.conversation.id;

  @override
  void initState() {
    super.initState();
    _draft.addListener(() => setState(() {}));
    _focus.addListener(() => setState(() {}));
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      ref.read(messagesProvider.notifier).markRead(_id);
    });
  }

  @override
  void dispose() {
    _draft.dispose();
    _focus.dispose();
    _scroll.dispose();
    super.dispose();
  }

  void _clearAttachment() {
    setState(() {
      _pendingFile = null;
      _attachError = null;
      _attachStatus = null;
    });
  }

  Future<void> _pickAttachment() async {
    if (_sending || _attaching || _pendingFile != null) return;
    setState(() {
      _attaching = true;
      _attachError = null;
      _attachStatus = null;
    });
    try {
      final picked = await FilePicker.pickFiles(
        type: FileType.custom,
        allowedExtensions: _chatMimes.keys.toList(),
      );
      if (!mounted || picked.isEmpty) return;
      final file = picked.single;
      final bytes = await file.readAsBytes();
      final mime = _chatMimes[file.name.split('.').last.toLowerCase()];
      if (mime == null) {
        setState(
          () => _attachError =
              'Chọn PDF, Word, Excel, PowerPoint, TXT hoặc ảnh JPG/PNG/WebP.',
        );
        return;
      }
      if (bytes.isEmpty) {
        setState(() => _attachError = 'Không đọc được tệp hoặc tệp rỗng.');
        return;
      }
      if (bytes.length > 15000000) {
        setState(() => _attachError = 'Tệp vượt giới hạn 15 MB.');
        return;
      }
      setState(() {
        _pendingFile = _PendingChatFile(
          name: file.name,
          bytes: bytes.length,
          mime: mime,
        );
        _attachStatus = 'Đang tải lên…';
      });
      final api = ref.read(authRuntimeProvider).services.conversations;
      final uploaded = await api.upload(
        _id,
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
        setState(() => _attachError = 'Máy chủ không trả fileId.');
        return;
      }
      setState(() {
        _pendingFile = _pendingFile?.copyWith(fileId: fileId);
        _attachStatus = 'Đang kiểm tra tệp…';
      });
      final ready = await _waitAttachmentReady(fileId);
      if (!mounted) return;
      if (!ready) {
        setState(
          () => _attachError =
              _attachError ?? 'Tệp chưa sẵn sàng. Thử kiểm tra lại.',
        );
        return;
      }
      setState(() => _attachStatus = null);
    } catch (error) {
      if (mounted) setState(() => _attachError = errorMessage(error));
    } finally {
      if (mounted) setState(() => _attaching = false);
    }
  }

  Future<bool> _waitAttachmentReady(String fileId) async {
    final api = ref.read(authRuntimeProvider).services.conversations;
    for (var i = 0; i < 20; i++) {
      final status = await api.attachmentStatus(_id, fileId);
      final state = status['state']?.toString() ?? '';
      if (state == 'READY') return true;
      if (const {'REJECTED', 'FAILED', 'DELETED'}.contains(state)) {
        _attachError = 'Tệp không đạt kiểm tra ($state).';
        return false;
      }
      await Future<void>.delayed(const Duration(milliseconds: 700));
    }
    return false;
  }

  Future<void> _submit() async {
    final text = _draft.text;
    final pending = _pendingFile;
    final fileId = pending?.fileId;
    final hasFile = fileId != null && fileId.isNotEmpty;
    if (_sending || _attaching || (text.trim().isEmpty && !hasFile)) return;
    if (pending != null && !hasFile) return;
    setState(() => _sending = true);
    final caption = text;
    _draft.clear();
    try {
      await ref
          .read(messagesProvider.notifier)
          .send(
            _id,
            caption,
            attachmentFileIds: hasFile ? [fileId] : const [],
          );
      if (mounted) _clearAttachment();
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (_scroll.hasClients) {
          _scroll.jumpTo(_scroll.position.maxScrollExtent);
        }
      });
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  void _agreement() {
    final paths =
        ref.read(livePathsProvider).value ?? const <Map<String, dynamic>>[];
    for (final item in paths) {
      if (item['conversationId']?.toString() == _id) {
        final pathId = item['id']?.toString() ?? '';
        if (pathId.isNotEmpty) {
          context.push('/paths/$pathId');
          return;
        }
      }
    }
    context.push('/agreement-type?proposalId=$_id');
  }

  void _applySuggestion(PathNegotiationSuggestion suggestion) {
    ref
        .read(planSuggestionDraftProvider.notifier)
        .setDraft(
          PlanSuggestionDraft.fromSuggestion(
            conversationId: _id,
            suggestion: suggestion,
          ),
        );
    final me = ref.read(accountSessionProvider)?.userId ?? '';
    final paths = ref.read(livePathsProvider).value ?? const <Map<String, dynamic>>[];
    Map<String, dynamic>? path;
    for (final item in paths) {
      if (item['conversationId']?.toString() == _id) {
        path = item;
        break;
      }
    }
    if (path == null) {
      context.push('/agreement-type?proposalId=$_id');
      return;
    }
    final pathId = path['id']?.toString() ?? '';
    if (pathId.isEmpty) {
      context.push('/agreement-type?proposalId=$_id');
      return;
    }
    final plans = path['plans'];
    final planList = plans is List ? plans : const [];
    String? myPlanId;
    for (final item in planList) {
      if (item is Map && item['teacherId']?.toString() == me) {
        myPlanId = item['id']?.toString();
        break;
      }
    }
    if (myPlanId != null && myPlanId.isNotEmpty) {
      context.push('/paths/$pathId/plans/$myPlanId/edit');
    } else {
      context.push('/paths/$pathId/plans/new');
    }
  }

  @override
  Widget build(BuildContext context) {
    final conversation = widget.conversation;
    final messages = ref.watch(
      messagesProvider.select((s) => s.threads[_id] ?? const []),
    );
    final olderCursor = ref.watch(
      messagesProvider.select((s) => s.olderCursors[_id]),
    );
    if (messages.isNotEmpty) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted &&
            ModalRoute.of(context)?.isCurrent == true &&
            WidgetsBinding.instance.lifecycleState == AppLifecycleState.resumed) {
          ref.read(messagesProvider.notifier).markRead(_id);
        }
      });
    }
    return Scaffold(
      backgroundColor: MessageColors.surface,
      body: SafeArea(
        child: Column(
          children: [
            _ChatHeader(
              conversation: conversation,
              onBack: () {
                final partner = _partnerMessagesPath(conversation.userId);
                if (context.canPop()) {
                  context.pop();
                  return;
                }
                if (conversation.userId.isNotEmpty) {
                  context.go(partner);
                  return;
                }
                context.go('/messages');
              },
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
                            if (olderCursor != null && olderCursor.isNotEmpty)
                              AppButton(
                                label: 'Tin nhắn trước đó',
                                variant: ButtonVariant.secondary,
                                onPressed: () => ref
                                    .read(messagesProvider.notifier)
                                    .loadOlder(_id),
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
                                conversationId: _id,
                                onOpenAgreement: _agreement,
                                onApplySuggestion: _applySuggestion,
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
              attaching: _attaching,
              pendingFile: _pendingFile,
              attachError: _attachError,
              attachStatus: _attachStatus,
              onSend: _submit,
              onAttach: _pickAttachment,
              onRemoveAttachment: _clearAttachment,
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
            imageUrl: conversation.avatarUrl,
            size: AvatarSizes.compact,
          ),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              spacing: 2,
              children: [
                Semantics(
                  header: true,
                  child: Text(
                    conversation.name.isEmpty
                        ? 'Thành viên SkillHub'
                        : conversation.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: nunito(
                      TypeScale.body,
                      weight: FontWeight.w700,
                      color: MessageColors.ink,
                    ),
                  ),
                ),
                Text(
                  conversation.inboxTitle,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: nunito(
                    TypeScale.secondary,
                    color: MessageColors.muted,
                  ),
                ),
              ],
            ),
          ),
          Tappable(
            semanticLabel: 'Thỏa thuận học của hai bạn',
            pressedOpacity: 0.8,
            onTap: onAgreement,
            child: Container(
              constraints: const BoxConstraints(minHeight: 44),
              padding: const EdgeInsets.symmetric(horizontal: 8),
              decoration: BoxDecoration(
                color: MessageColors.orangeSoft,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: MessageColors.border),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                spacing: 4,
                children: [
                  const AppIcon(
                    AppIcon.checkCircle,
                    size: IconSizes.inline,
                    color: MessageColors.orange,
                  ),
                  Text(
                    'Thỏa thuận',
                    style: nunito(
                      TypeScale.caption,
                      weight: FontWeight.w600,
                      color: MessageColors.orange,
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

class _MessageBubble extends ConsumerWidget {
  const _MessageBubble({
    required this.message,
    required this.partner,
    required this.partnerId,
    required this.conversationId,
    this.onOpenAgreement,
    this.onApplySuggestion,
  });

  final ChatMessage message;
  final String partner;
  final String partnerId;
  final String conversationId;
  final VoidCallback? onOpenAgreement;
  final void Function(PathNegotiationSuggestion suggestion)? onApplySuggestion;

  Future<void> _download(
    WidgetRef ref,
    BuildContext context,
    ChatAttachmentView file,
  ) async {
    try {
      final link = await ref
          .read(authRuntimeProvider)
          .services
          .conversations
          .attachmentDownload(conversationId, message.id, file.attachmentId);
      final url = link['url']?.toString() ?? '';
      if (url.isEmpty) return;
      await Clipboard.setData(ClipboardData(text: url));
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Đã copy link tải tệp.')),
        );
      }
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final mine = message.mine;
    final negotiation = message.attachments.isEmpty
        ? readNegotiationMessage(message.text)
        : null;
    final width = MediaQuery.sizeOf(context).width;
    final factor = width >= 768 ? 0.62 : (mine ? 0.82 : 0.70);
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Column(
        crossAxisAlignment: mine
            ? CrossAxisAlignment.end
            : CrossAxisAlignment.start,
        spacing: 2,
        children: [
          if (negotiation != null)
            NegotiationSuggestionCard(
              suggestion: negotiation,
              mine: mine,
              expandedByDefault: !mine,
              onOpenPath: onOpenAgreement,
              onApply: onApplySuggestion == null
                  ? null
                  : () => onApplySuggestion!(negotiation),
            )
          else
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
                      minWidth: message.attachments.isEmpty
                          ? 0
                          : (constraints.maxWidth * factor).clamp(0, 240),
                    ),
                    child: Builder(
                      builder: (context) {
                        final hasText = message.text.trim().isNotEmpty;
                        final fileOnly =
                            !hasText && message.attachments.isNotEmpty;
                        return Container(
                          padding: fileOnly
                              ? EdgeInsets.zero
                              : const EdgeInsets.symmetric(
                                  horizontal: 10,
                                  vertical: 7,
                                ),
                          decoration: BoxDecoration(
                            color: fileOnly
                                ? Colors.transparent
                                : (mine
                                      ? MessageColors.orange
                                      : MessageColors.surface),
                            borderRadius: BorderRadius.only(
                              topLeft: const Radius.circular(10),
                              topRight: const Radius.circular(10),
                              bottomLeft: Radius.circular(mine ? 10 : 3),
                              bottomRight: Radius.circular(mine ? 3 : 10),
                            ),
                            boxShadow: mine || fileOnly
                                ? null
                                : messageCardShadow,
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            spacing: 8,
                            children: [
                              if (hasText)
                                SelectableText(
                                  message.text,
                                  style: nunito(
                                    TypeScale.body,
                                    color: mine
                                        ? MessageColors.white
                                        : MessageColors.ink,
                                  ),
                                ),
                              for (final file in message.attachments)
                                _ChatFileCard(
                                  filename: file.filename,
                                  bytes: file.bytes,
                                  mine: mine,
                                  onPress: () =>
                                      _download(ref, context, file),
                                ),
                            ],
                          ),
                        );
                      },
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

String _fileSizeLabel(int bytes) {
  if (bytes < 1000) return '$bytes B';
  if (bytes < 1000000) return '${(bytes / 1000).ceil()} KB';
  return '${(bytes / 1000000).toStringAsFixed(1)} MB';
}

class _ChatFileCard extends StatelessWidget {
  const _ChatFileCard({
    required this.filename,
    required this.bytes,
    required this.mine,
    this.status,
    this.onPress,
    this.onRemove,
  });

  final String filename;
  final int bytes;
  final bool mine;
  final String? status;
  final VoidCallback? onPress;
  final VoidCallback? onRemove;

  @override
  Widget build(BuildContext context) {
    final extension =
        RegExp(r'\.([a-z0-9]{1,10})$', caseSensitive: false)
            .firstMatch(filename)
            ?.group(1)
            ?.toUpperCase() ??
        'TỆP';
    final card = Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: mine ? MessageColors.orangePale : MessageColors.surface,
        borderRadius: BorderRadius.circular(AppRadii.card),
        border: Border.all(color: MessageColors.border),
      ),
      child: Row(
        spacing: 10,
        children: [
          Container(
            width: 40,
            height: 44,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: mine ? MessageColors.orangeSoft : const Color(0xFFEAF2EE),
              borderRadius: BorderRadius.circular(AppRadii.control),
            ),
            child: AppIcon(
              AppIcon.clipboard,
              size: 22,
              color: mine ? MessageColors.brand : MessageColors.sage,
            ),
          ),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              spacing: 4,
              children: [
                Text(
                  filename,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: nunito(
                    TypeScale.body,
                    weight: FontWeight.w600,
                    color: MessageColors.ink,
                  ),
                ),
                Text(
                  status ?? '$extension · ${_fileSizeLabel(bytes)}',
                  style: nunito(
                    TypeScale.caption,
                    color: MessageColors.inkSoft,
                  ),
                ),
              ],
            ),
          ),
          if (onRemove != null)
            Tappable(
              semanticLabel: 'Gỡ tệp đính kèm',
              onTap: onRemove,
              child: const SizedBox(
                width: 28,
                height: 28,
                child: Center(
                  child: AppIcon(
                    AppIcon.close,
                    size: 16,
                    color: MessageColors.muted,
                  ),
                ),
              ),
            )
          else if (onPress != null)
            const AppIcon(
              AppIcon.chevron,
              size: 18,
              color: MessageColors.muted,
            ),
        ],
      ),
    );
    if (onPress == null) return card;
    return Tappable(
      semanticLabel: 'Mở tệp $filename',
      onTap: onPress,
      child: card,
    );
  }
}

class _ChatComposer extends StatelessWidget {
  const _ChatComposer({
    required this.controller,
    required this.focus,
    required this.onSend,
    required this.onAttach,
    required this.onRemoveAttachment,
    this.sending = false,
    this.attaching = false,
    this.pendingFile,
    this.attachError,
    this.attachStatus,
  });

  final TextEditingController controller;
  final FocusNode focus;
  final VoidCallback onSend;
  final VoidCallback onAttach;
  final VoidCallback onRemoveAttachment;
  final bool sending;
  final bool attaching;
  final _PendingChatFile? pendingFile;
  final String? attachError;
  final String? attachStatus;

  @override
  Widget build(BuildContext context) {
    final readyFile =
        pendingFile != null &&
        pendingFile!.fileId != null &&
        pendingFile!.fileId!.isNotEmpty &&
        attachStatus == null &&
        attachError == null;
    final disabled =
        sending ||
        attaching ||
        (controller.text.trim().isEmpty && !readyFile) ||
        (pendingFile != null && !readyFile);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: const BoxDecoration(
        color: MessageColors.surface,
        border: Border(top: BorderSide(color: MessageColors.border)),
      ),
      child: Column(
        spacing: 8,
        children: [
          ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 768),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              spacing: 8,
              children: [
                if (pendingFile != null)
                  Padding(
                    padding: const EdgeInsets.only(left: 50),
                    child: _ChatFileCard(
                      filename: pendingFile!.name,
                      bytes: pendingFile!.bytes,
                      mine: true,
                      status: attachStatus,
                      onRemove: sending || attaching
                          ? null
                          : onRemoveAttachment,
                    ),
                  ),
                if (attachError != null)
                  FormNotice(tone: NoticeTone.error, message: attachError!),
                Row(
                  spacing: 6,
                  children: [
                    Tappable(
                      semanticLabel: 'Đính kèm tệp',
                      onTap: sending || attaching || pendingFile != null
                          ? null
                          : onAttach,
                      child: SizedBox(
                        width: 44,
                        height: 44,
                        child: Center(
                          child: attaching
                              ? const SizedBox(
                                  width: 18,
                                  height: 18,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                  ),
                                )
                              : const AppIcon(
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
                          enabled: !sending && !attaching,
                          textInputAction: TextInputAction.send,
                          onSubmitted: disabled ? null : (_) => onSend(),
                          style: nunito(
                            TypeScale.body,
                            color: MessageColors.ink,
                          ),
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
