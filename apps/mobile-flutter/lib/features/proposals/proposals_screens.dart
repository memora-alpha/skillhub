import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../components/app_button.dart';
import '../../components/app_icon.dart';
import '../../components/app_input.dart';
import '../../components/avatar.dart';
import '../../components/misc.dart';
import '../../components/tappable.dart';
import '../../core/theme/tokens.dart';
import '../auth/session/auth_session.dart';
import '../discovery/discovery_data.dart';
import '../messages/messages_data.dart';
import '../profile/public_profiles_data.dart';
import '../skills/skills_feature.dart';
import '../shell/app_screen_layout.dart';
import 'proposals_data.dart';

final _title = nunito(
  TypeScale.title,
  weight: FontWeight.w700,
  color: Palette.ink,
);
final _heading = nunito(
  TypeScale.heading,
  weight: FontWeight.w700,
  color: Palette.ink,
);
final _body = nunito(TypeScale.body, color: Palette.body);
final _caption = nunito(TypeScale.secondary, color: Palette.muted);
final _name = nunito(TypeScale.body, weight: FontWeight.w700, color: Palette.ink);
final _label = nunito(
  TypeScale.body,
  weight: FontWeight.w600,
  color: Palette.ink,
);

BadgeVariant _statusVariant(String status) => switch (status) {
  'ACCEPTED' => BadgeVariant.success,
  'PENDING' => BadgeVariant.warning,
  _ => BadgeVariant.neutral,
};

/// Scrollable body shared by the proposal screens (max width 720).
class _ProposalBody extends StatelessWidget {
  const _ProposalBody({required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return ListView(
      keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
      children: [
        Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 720),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              spacing: 16,
              children: children,
            ),
          ),
        ),
      ],
    );
  }
}

class _Card extends StatelessWidget {
  const _Card({
    required this.children,
    this.padding = 16,
    this.spacing = 16,
  });

  final List<Widget> children;
  final double padding;
  final double spacing;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.all(padding),
      decoration: BoxDecoration(
        color: Chrome.surface,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        spacing: spacing,
        children: children,
      ),
    );
  }
}

class ProposalCard extends StatelessWidget {
  const ProposalCard({super.key, required this.proposal, required this.onTap});

  final DemoProposal proposal;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final status = proposalStatusLabels[proposal.status]!;
    return Tappable(
      pressedOpacity: 0.75,
      semanticLabel:
          'Xem đề xuất ${proposal.sent ? 'gửi đến' : 'từ'} ${proposal.partner}, $status',
      onTap: onTap,
      child: _Card(
        spacing: 10,
        children: [
          Row(
            spacing: 8,
            children: [
              Avatar(
                name: proposal.partner,
                userId: proposal.partnerId,
                size: 40,
              ),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  spacing: 2,
                  children: [
                    Text(proposal.partner, style: _name),
                    Text(proposal.time, style: _caption),
                  ],
                ),
              ),
              Text(
                '${proposal.credit} CR',
                style: _name.copyWith(
                  color: Palette.brandHover,
                  fontFeatures: const [FontFeature.tabularFigures()],
                ),
              ),
            ],
          ),
          Text(
            '${proposal.sent ? 'Bạn đề xuất chia sẻ' : 'Có thể chia sẻ'} ${proposal.skill}',
            style: _label.copyWith(color: Palette.inkSoft),
          ),
          Text(
            proposal.requestTitle,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: nunito(TypeScale.secondary, color: Palette.body),
          ),
          Text(
            proposal.sourceType == 'DIRECT_SEARCH'
                ? 'Lời mời trực tiếp'
                : 'Phản hồi yêu cầu học',
            style: _caption,
          ),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              AppBadge(
                label: status,
                variant: _statusVariant(proposal.status),
              ),
              Text('${proposal.sessions} buổi dự kiến', style: _caption),
            ],
          ),
        ],
      ),
    );
  }
}

class ProposalSummary extends StatelessWidget {
  const ProposalSummary({
    super.key,
    required this.proposal,
    this.compact = false,
  });

  final DemoProposal proposal;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    Widget metric(String label, Widget value) => Expanded(
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: Palette.cream,
          borderRadius: BorderRadius.circular(6),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          spacing: 4,
          children: [Text(label, style: _caption), value],
        ),
      ),
    );
    return _Card(
      padding: 20,
      spacing: 12,
      children: [
        Row(
          spacing: 12,
          children: [
            Avatar(
              name: proposal.partner,
              userId: proposal.partnerId,
              size: 48,
            ),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                spacing: 4,
                children: [
                  Text(proposal.partner, style: _name),
                  Text(
                    '${proposal.sent ? 'Người nhận' : 'Người gửi'} · ${proposal.time}',
                    style: _caption,
                  ),
                ],
              ),
            ),
          ],
        ),
        Align(
          alignment: Alignment.centerLeft,
          child: AppBadge(
            label: proposalStatusLabels[proposal.status]!,
            variant: _statusVariant(proposal.status),
          ),
        ),
        Text(proposal.requestTitle, style: _heading),
        Text(
          '${proposal.sourceType == 'DIRECT_SEARCH' ? 'Lời mời trực tiếp từ hồ sơ' : 'Phản hồi yêu cầu học'} · ${proposal.skill}',
          style: _caption,
        ),
        if (!compact) ...[
          SelectableText(proposal.message, style: _body),
          Row(
            spacing: 12,
            children: [
              metric(
                'Credit gợi ý',
                Text(
                  '${proposal.credit} CR',
                  style: _heading.copyWith(color: Palette.brandHover),
                ),
              ),
              metric(
                'Số buổi dự kiến',
                Text('${proposal.sessions} buổi', style: _name),
              ),
            ],
          ),
          Text('Khung giờ tham khảo', style: _caption),
          SelectableText(
            proposal.schedule.isEmpty
                ? 'Chưa đề xuất khung giờ'
                : proposal.schedule,
            style: _body,
          ),
        ],
      ],
    );
  }
}

const _tabs = [
  (id: 'received', label: 'Đã nhận'),
  (id: 'sent', label: 'Đã gửi'),
  (id: 'discussing', label: 'Đang trao đổi'),
  (id: 'accepted', label: 'Đã chấp nhận'),
  (id: 'closed', label: 'Đã đóng'),
];

String _selectedTab(String? value) =>
    _tabs.where((t) => t.id == value).firstOrNull?.id ?? 'received';

class ProposalsScreen extends ConsumerStatefulWidget {
  const ProposalsScreen({super.key, this.tab});

  final String? tab;

  @override
  ConsumerState<ProposalsScreen> createState() => _ProposalsScreenState();
}

class _ProposalsScreenState extends ConsumerState<ProposalsScreen> {
  late String _tab = _selectedTab(widget.tab);

  @override
  void didUpdateWidget(ProposalsScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.tab != widget.tab) _tab = _selectedTab(widget.tab);
  }

  @override
  Widget build(BuildContext context) {
    final proposals = ref.watch(proposalsProvider);
    final threads = ref.watch(messagesProvider.select((s) => s.threads));
    final filtered = proposals.where((item) {
      return switch (_tab) {
        'received' => !item.sent && item.status == 'PENDING',
        'sent' => item.sent,
        'discussing' =>
          item.status == 'ACCEPTED' && (threads[item.id]?.isNotEmpty ?? false),
        'accepted' => item.status == 'ACCEPTED',
        _ => item.closed,
      };
    }).toList();
    return AppScreenLayout(
      title: 'Đề xuất',
      selected: 'Tin nhắn',
      back: (route: '/messages', label: 'Quay lại tin nhắn'),
      child: _ProposalBody(
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            spacing: 12,
            children: [
              Text('Kết nối để cùng học', style: _title),
              Text(
                'Xem đề xuất cho yêu cầu học và lời mời trao đổi trực tiếp.',
                style: _body,
              ),
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(vertical: 4),
                child: Row(
                  spacing: 6,
                  children: [
                    for (final tab in _tabs)
                      Semantics(
                        selected: _tab == tab.id,
                        child: Tappable(
                          semanticLabel: tab.label,
                          onTap: () => setState(() => _tab = tab.id),
                          child: Container(
                            constraints: const BoxConstraints(minHeight: 44),
                            alignment: Alignment.center,
                            padding: const EdgeInsets.symmetric(horizontal: 14),
                            decoration: BoxDecoration(
                              color: _tab == tab.id
                                  ? Palette.brandLight
                                  : Palette.sand,
                              borderRadius: BorderRadius.circular(6),
                              border: _tab == tab.id
                                  ? Border.all(color: Palette.brand)
                                  : null,
                            ),
                            child: Text(
                              tab.label,
                              style: nunito(
                                TypeScale.secondary,
                                weight: FontWeight.w600,
                                color: _tab == tab.id
                                    ? Palette.brandHover
                                    : Palette.body,
                              ),
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
              if (_tab == 'received' && filtered.isNotEmpty)
                Align(
                  alignment: Alignment.centerLeft,
                  child: AppBadge(
                    label: '${filtered.length} đề xuất chờ phản hồi',
                    variant: BadgeVariant.warning,
                  ),
                ),
              Text(
                'Đề xuất mẫu · Chấp nhận chỉ mở Chat, chưa giữ Credit.',
                style: _caption,
              ),
            ],
          ),
          if (filtered.isEmpty)
            EmptyState(
              icon: AppIcon.message,
              title: 'Chưa có đề xuất',
              description: _tab == 'sent'
                  ? 'Tìm một yêu cầu học phù hợp để gửi đề xuất đầu tiên.'
                  : 'Đề xuất ở trạng thái này sẽ xuất hiện tại đây.',
              action: 'Khám phá yêu cầu học',
              onAction: () => context.go('/discover'),
            ),
          for (final item in filtered)
            ProposalCard(
              proposal: item,
              onTap: () => context.push('/proposal/${item.id}'),
            ),
        ],
      ),
    );
  }
}

class ProposalDetailScreen extends ConsumerStatefulWidget {
  const ProposalDetailScreen({super.key, required this.id, this.updated = false});

  final String id;
  final bool updated;

  @override
  ConsumerState<ProposalDetailScreen> createState() =>
      _ProposalDetailScreenState();
}

class _ProposalDetailScreenState extends ConsumerState<ProposalDetailScreen> {
  String? _error;

  @override
  Widget build(BuildContext context) {
    final id = widget.id;
    final proposals = ref.watch(proposalsProvider);
    final proposal = proposals.where((p) => p.id == id).firstOrNull;
    final otherAccepted =
        proposal?.requestId != null &&
        proposals.any(
          (item) =>
              item.id != id &&
              item.requestId == proposal!.requestId &&
              item.status == 'ACCEPTED',
        );
    final request = (ref.watch(learningRequestsProvider).value ?? const <LearningRequest>[])
        .where((item) => item.id == proposal?.requestId)
        .firstOrNull;

    Future<void> accept() async {
      if (!await ref.read(proposalsProvider.notifier).decide(id, 'ACCEPTED')) {
        if (!mounted) return;
        setState(
          () => _error =
              'Đề xuất đã thay đổi hoặc yêu cầu đã có kết nối được chấp nhận. Hãy xem lại danh sách.',
        );
        return;
      }
      if (!context.mounted) return;
      context.push('/chat/$id');
    }

    return AppScreenLayout(
      title: 'Chi tiết đề xuất',
      selected: 'Tin nhắn',
      back: (route: '/proposals', label: 'Quay lại đề xuất'),
      child: proposal == null
          ? EmptyState(
              title: 'Không tìm thấy đề xuất',
              description:
                  'Đề xuất không có trong phiên hiện tại. Hãy quay lại danh sách để chọn một đề xuất khác.',
              action: 'Về danh sách đề xuất',
              onAction: () => context.go('/proposals'),
            )
          : _ProposalBody(
              children: [
                if (widget.updated)
                  const FormNotice(
                    tone: NoticeTone.success,
                    message: 'Đã lưu thay đổi đề xuất trong phiên hiện tại.',
                  ),
                ProposalSummary(proposal: proposal),
                if (proposal.localDecisionNote?.isNotEmpty ?? false)
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Palette.white,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      spacing: 8,
                      children: [
                        Text('Lý do từ chối', style: _heading),
                        SelectableText(
                          proposal.localDecisionNote!,
                          style: _body,
                        ),
                      ],
                    ),
                  ),
                if (proposal.status == 'PENDING')
                  Text(
                    'Credit, số buổi và khung giờ là gợi ý ban đầu. Chấp nhận mở Chat để hai người thống nhất cách học.',
                    style: _body,
                  ),
                if (proposal.closed)
                  Text(switch (proposal.status) {
                    'EXPIRED' =>
                      'Đề xuất mẫu này đã hết hạn. Bạn có thể gửi một lời mời mới từ hồ sơ công khai.',
                    'WITHDRAWN' =>
                      'Bạn đã rút đề xuất này. Lịch sử vẫn được giữ trong danh sách Đã đóng.',
                    _ =>
                      'Đề xuất đã bị từ chối. Những đề xuất khác không bị đóng theo.',
                  }, style: _body),
                AppButton(
                  label: 'Xem hồ sơ công khai',
                  variant: ButtonVariant.secondary,
                  onPressed: () => context.push('/user/${proposal.partnerId}'),
                ),
                if (request != null)
                  AppButton(
                    label: 'Xem yêu cầu học gốc',
                    variant: ButtonVariant.secondary,
                    onPressed: () => context.push('/request/${request.id}'),
                  ),
                if (_error != null)
                  FormNotice(tone: NoticeTone.error, message: _error!),
                if (proposal.status == 'PENDING' && !proposal.sent) ...[
                  if (otherAccepted)
                    Text(
                      'Yêu cầu này đã có một đề xuất được chấp nhận.',
                      style: _body,
                    ),
                  AppButton(
                    label: 'Chấp nhận & mở Chat',
                    disabled: otherAccepted,
                    onPressed: accept,
                  ),
                  AppButton(
                    label: 'Từ chối đề xuất',
                    variant: ButtonVariant.secondary,
                    onPressed: () =>
                        context.push('/proposal/$id/close?action=reject'),
                  ),
                ],
                if (proposal.status == 'PENDING' && proposal.sent) ...[
                  AppButton(
                    label: 'Chỉnh sửa đề xuất',
                    onPressed: () => context.push('/proposal/$id/edit'),
                  ),
                  AppButton(
                    label: 'Rút đề xuất',
                    variant: ButtonVariant.secondary,
                    onPressed: () =>
                        context.push('/proposal/$id/close?action=withdraw'),
                  ),
                ],
                if (proposal.status == 'ACCEPTED') ...[
                  const FormNotice(
                    tone: NoticeTone.success,
                    message:
                        'Đã kết nối. Hai người có thể trao đổi về lộ trình và lịch học trong Chat.',
                  ),
                  AppButton(
                    label: 'Tiếp tục trao đổi',
                    onPressed: () => context.push('/chat/$id'),
                  ),
                ],
                if (proposal.closed && proposal.sent)
                  AppButton(
                    label: 'Gửi đề xuất mới',
                    onPressed: () => context.push(
                      request != null
                          ? '/send-proposal?requestId=${request.id}'
                          : '/send-proposal?userId=${proposal.partnerId}',
                    ),
                  ),
                Text(
                  'Chấp nhận mở cuộc trò chuyện. Lịch và Credit được chốt ở bước lộ trình.',
                  style: _caption,
                ),
              ],
            ),
    );
  }
}

class SendProposalScreen extends ConsumerStatefulWidget {
  const SendProposalScreen({super.key, this.requestId, this.userId});

  final String? requestId;
  final String? userId;

  @override
  ConsumerState<SendProposalScreen> createState() => _SendProposalScreenState();
}

class _SendProposalScreenState extends ConsumerState<SendProposalScreen> {
  String _skillId = '';
  late final _message = AppField(validator: validateProposalMessage);
  late final _credit = AppField(
    text: _request?.budget.split(' ').first ?? '50',
    validator: validateProposalCredit,
  );
  late final _sessions = AppField(
    text: '${_request?.sessions ?? 4}',
    validator: validateProposalSessions,
  );
  final _schedule = AppField(text: 'Tối Thứ 5 và Thứ 7');
  String? _formError;
  bool _sent = false;

  LearningRequest? get _request =>
      (ref.read(learningRequestsProvider).value ?? const <LearningRequest>[])
          .where((item) => item.id == widget.requestId)
          .firstOrNull;

  DemoPublicProfile? get _profile {
    final id = _request?.userId ?? widget.userId ?? '';
    return ref.read(publicProfileProvider(id)).value;
  }

  String? get _targetId => _request?.userId ?? _profile?.id;
  String? get _targetName => _request?.user ?? _profile?.name;

  List<({String id, String name, bool verified})> get _skills {
    if (_request == null) {
      return [
        for (final skill in _profile?.skills ?? const <DemoSkill>[])
          (id: skill.id, name: skill.name, verified: skill.verified),
      ];
    }
    return [
      for (final skill in ref.read(skillsProvider))
        (id: skill.id, name: skill.name, verified: skill.status == 'VERIFIED'),
    ];
  }

  @override
  void dispose() {
    for (final field in [_message, _credit, _sessions, _schedule]) {
      field.dispose();
    }
    super.dispose();
  }

  Future<void> _send() async {
    final valid = validateFields([_message, _credit, _sessions]);
    final userId = ref.read(accountSessionProvider)?.userId;
    String? formError;
    final skills = _skills;
    if (!skills.any((skill) => skill.id == _skillId)) {
      formError = 'Chọn kỹ năng phù hợp.';
    }
    if (_targetId == null || _targetId == userId) {
      formError = 'Bạn không thể gửi đề xuất cho chính mình.';
    }
    setState(() => _formError = formError);
    if (!valid || formError != null || _targetName == null) return;
    final chosen = skills.firstWhere((skill) => skill.id == _skillId);
    final saved = await ref
        .read(proposalsProvider.notifier)
        .submit(
          sourceType: _request != null ? 'LEARNING_REQUEST' : 'DIRECT_SEARCH',
          requestId: _request?.id,
          requestTitle:
              _request?.title ?? 'Lời mời trao đổi với $_targetName',
          partnerId: _targetId!,
          partner: _targetName!,
          skill: chosen.name,
          message: _message.text.trim(),
          credit: _credit.text.trim(),
          sessions: int.parse(_sessions.text.trim()),
          schedule: _schedule.text.trim(),
          recipientSharingSkillId: _request == null ? chosen.id : null,
        );
    if (!mounted) return;
    if (!saved) {
      setState(
        () => _formError =
            'Đã có đề xuất đang chờ phản hồi. Bạn có thể xem hoặc rút đề xuất trong danh sách Đã gửi.',
      );
      return;
    }
    FocusScope.of(context).unfocus();
    setState(() => _sent = true);
  }

  @override
  Widget build(BuildContext context) {
    ref.watch(learningRequestsProvider);
    ref.watch(skillsProvider);
    ref.watch(publicProfileProvider(widget.userId ?? ''));
    final request = _request;
    ref.watch(publicProfileProvider(request?.userId ?? widget.userId ?? ''));
    final targetId = _targetId;
    final targetName = _targetName;
    final userId = ref.watch(accountSessionProvider)?.userId;
    final duplicate = ref
        .watch(proposalsProvider)
        .any(
          (item) =>
              item.sent &&
              item.status == 'PENDING' &&
              item.partnerId == targetId &&
              item.requestId == request?.id,
        );
    final profile = _profile;
    final back = request != null
        ? '/request/${request.id}'
        : profile != null
        ? '/user/${profile.id}'
        : '/discover';
    return AppScreenLayout(
      title: request != null ? 'Gửi đề xuất' : 'Lời mời trao đổi',
      selected: 'Khám phá',
      back: (route: back, label: 'Quay lại'),
      child:
          targetId == null ||
              targetName == null ||
              (widget.requestId != null && request == null)
          ? EmptyState(
              title: 'Không tìm thấy yêu cầu',
              description: 'Chọn một yêu cầu học hoặc hồ sơ để gửi đề xuất.',
              action: 'Khám phá',
              onAction: () => context.go('/discover'),
            )
          : _ProposalBody(
              children: _sent
                  ? [
                      const FormNotice(
                        tone: NoticeTone.success,
                        message: 'Đề xuất mẫu đã gửi!',
                      ),
                      Text(
                        '$targetName sẽ xem nội dung và mức Credit gợi ý. Chat chỉ mở sau khi đề xuất được chấp nhận.',
                        style: _body,
                      ),
                      AppButton(
                        label: 'Xem đề xuất đã gửi',
                        onPressed: () =>
                            context.pushReplacement('/proposals?tab=sent'),
                      ),
                      AppButton(
                        label: 'Tiếp tục khám phá',
                        variant: ButtonVariant.secondary,
                        onPressed: () => context.go('/discover'),
                      ),
                    ]
                  : [
                      Semantics(
                        header: true,
                        child: Text(
                          'Cho $targetName biết bạn có thể chia sẻ gì',
                          style: _title,
                        ),
                      ),
                      Text(
                        'Giới thiệu kinh nghiệm, cách hướng dẫn và kết quả bạn muốn cùng đạt được.',
                        style: _body,
                      ),
                      _Card(
                        children: [
                          Text(
                            request?.title ?? 'Trao đổi trực tiếp từ hồ sơ',
                            style: _heading,
                          ),
                          Row(
                            spacing: 8,
                            children: [
                              Avatar(
                                name: targetName,
                                userId: targetId,
                                size: 28,
                              ),
                              Flexible(
                                child: Text(
                                  '$targetName${request != null ? ' · ${request.sessions} buổi dự kiến' : ''}',
                                  style: _caption,
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                      _Card(
                        children: [
                          Text('Kỹ năng bạn có thể chia sẻ', style: _label),
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            spacing: 8,
                            children: [
                              for (final skill in _skills)
                                Semantics(
                                  inMutuallyExclusiveGroup: true,
                                  checked: _skillId == skill.id,
                                  child: Tappable(
                                    onTap: () =>
                                        setState(() => _skillId = skill.id),
                                    child: Container(
                                      padding: const EdgeInsets.all(12),
                                      decoration: BoxDecoration(
                                        color: _skillId == skill.id
                                            ? Palette.sageLight
                                            : null,
                                        borderRadius: BorderRadius.circular(6),
                                        border: Border.all(
                                          color: _skillId == skill.id
                                              ? Palette.sage
                                              : Palette.border,
                                        ),
                                      ),
                                      child: Row(
                                        mainAxisAlignment:
                                            MainAxisAlignment.spaceBetween,
                                        children: [
                                          Text(skill.name, style: _label),
                                          AppBadge(
                                            label: skill.verified
                                                ? 'Đã xác minh'
                                                : 'Chưa xác minh',
                                            variant: skill.verified
                                                ? BadgeVariant.sage
                                                : BadgeVariant.neutral,
                                          ),
                                        ],
                                      ),
                                    ),
                                  ),
                                ),
                            ],
                          ),
                          if (_skills.isEmpty)
                            const FormNotice(
                              tone: NoticeTone.error,
                              message:
                                  'Hồ sơ mẫu của bạn chưa có kỹ năng phù hợp với yêu cầu này.',
                            ),
                          if (_formError != null)
                            FormNotice(
                              tone: NoticeTone.error,
                              message: _formError!,
                            ),
                          ListenableBuilder(
                            listenable: _message,
                            builder: (context, _) => AppInput(
                              field: _message,
                              label: 'Bạn sẽ giúp người học như thế nào?',
                              required: true,
                              multiline: true,
                              placeholder:
                                  'Chia sẻ kinh nghiệm, cách dạy và mục tiêu...',
                              hint: '${_message.text.length}/1.000 ký tự',
                            ),
                          ),
                          AppInput(
                            field: _credit,
                            label: 'Credit gợi ý cho toàn lộ trình',
                            required: true,
                            keyboardType: const TextInputType.numberWithOptions(
                              decimal: true,
                            ),
                            hint:
                                'Mức gợi ý; loại thỏa thuận và Credit chính thức sẽ được chốt trong Chat.',
                          ),
                          AppInput(
                            field: _sessions,
                            label: 'Số buổi dự kiến',
                            required: true,
                            keyboardType: TextInputType.number,
                          ),
                          AppInput(
                            field: _schedule,
                            label: 'Khung giờ đề xuất',
                            placeholder: 'Ví dụ: buổi tối hoặc cuối tuần',
                            hint:
                                'Khung giờ tham khảo, chưa phải lịch được xác nhận.',
                          ),
                        ],
                      ),
                      Text(
                        'Gửi đề xuất chưa mở Chat, chưa tạo buổi học và chưa tạm giữ Credit.',
                        style: _body,
                      ),
                      if (duplicate)
                        Semantics(
                          liveRegion: true,
                          child: Text(
                            'Bạn đã có đề xuất đang chờ phản hồi cho yêu cầu này.',
                            style: _caption,
                          ),
                        ),
                      AppButton(
                        label: 'Gửi đề xuất',
                        disabled:
                            _skills.isEmpty || duplicate || targetId == userId,
                        onPressed: _send,
                      ),
                      if (duplicate)
                        AppButton(
                          label: 'Xem đề xuất đã gửi',
                          variant: ButtonVariant.secondary,
                          onPressed: () => context.push('/proposals?tab=sent'),
                        ),
                      Text(
                        'Bản mẫu · Đề xuất chỉ lưu trong phiên hiện tại.',
                        style: _caption,
                      ),
                    ],
            ),
    );
  }
}

class EditProposalScreen extends ConsumerWidget {
  const EditProposalScreen({super.key, required this.id});

  final String id;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final proposal = ref
        .watch(proposalsProvider)
        .where((p) => p.id == id)
        .firstOrNull;
    return AppScreenLayout(
      title: 'Chỉnh sửa đề xuất',
      selected: 'Tin nhắn',
      back: (route: '/proposal/$id', label: 'Quay lại chi tiết đề xuất'),
      child: proposal == null || !proposal.sent || proposal.status != 'PENDING'
          ? EmptyState(
              title: 'Không thể chỉnh sửa',
              description:
                  'Chỉ đề xuất bạn đã gửi và đang chờ phản hồi mới có thể sửa. Hãy kiểm tra trạng thái hiện tại.',
              action: 'Về danh sách đề xuất',
              onAction: () => context.go('/proposals'),
            )
          : _EditProposalForm(key: ValueKey(proposal.id), proposal: proposal),
    );
  }
}

class _EditProposalForm extends ConsumerStatefulWidget {
  const _EditProposalForm({super.key, required this.proposal});

  final DemoProposal proposal;

  @override
  ConsumerState<_EditProposalForm> createState() => _EditProposalFormState();
}

class _EditProposalFormState extends ConsumerState<_EditProposalForm> {
  late final _message = AppField(
    text: widget.proposal.message,
    validator: validateProposalMessage,
  );
  late final _credit = AppField(
    text: widget.proposal.credit,
    validator: validateProposalCredit,
  );
  late final _sessions = AppField(
    text: '${widget.proposal.sessions}',
    validator: validateProposalSessions,
  );
  late final _schedule = AppField(text: widget.proposal.schedule);
  late final _fields = [_message, _credit, _sessions, _schedule];
  late final _initial = [for (final f in _fields) f.text];
  String? _error;

  @override
  void dispose() {
    for (final field in _fields) {
      field.dispose();
    }
    super.dispose();
  }

  void _close({bool updated = false}) {
    final detail = '/proposal/${widget.proposal.id}';
    final router = GoRouter.of(context);
    if (router.canPop()) router.pop();
    if (updated) router.pushReplacement('$detail?updated=1');
  }

  Future<void> _save() async {
    if (!validateFields(_fields)) return;
    final saved = await ref
        .read(proposalsProvider.notifier)
        .update(
          widget.proposal.id,
          message: _message.text,
          credit: _credit.text,
          sessions: _sessions.text,
          schedule: _schedule.text,
        );
    if (!mounted) return;
    if (!saved) {
      setState(
        () => _error =
            'Đề xuất đã thay đổi, không còn ở trạng thái chờ phản hồi. Hãy xem lại chi tiết.',
      );
      return;
    }
    FocusScope.of(context).unfocus();
    _close(updated: true);
  }

  @override
  Widget build(BuildContext context) {
    return _ProposalBody(
      children: [
        Text('Cập nhật lời đề nghị của bạn', style: _title),
        ProposalSummary(proposal: widget.proposal, compact: true),
        Text(
          'Bạn có thể đổi nội dung và các gợi ý trước khi người nhận phản hồi.',
          style: _body,
        ),
        AppInput(
          field: _message,
          label: 'Bạn sẽ giúp người học như thế nào?',
          required: true,
          multiline: true,
        ),
        AppInput(
          field: _credit,
          label: 'Credit gợi ý cho toàn lộ trình',
          required: true,
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
        ),
        AppInput(
          field: _sessions,
          label: 'Số buổi dự kiến',
          required: true,
          keyboardType: TextInputType.number,
        ),
        AppInput(
          field: _schedule,
          label: 'Khung giờ đề xuất',
          hint: 'Khung giờ tham khảo, chưa phải lịch được xác nhận.',
        ),
        if (_error != null) FormNotice(tone: NoticeTone.error, message: _error!),
        ListenableBuilder(
          listenable: Listenable.merge(_fields),
          builder: (context, _) => AppButton(
            label: 'Lưu thay đổi',
            disabled: [
              for (final f in _fields) f.text,
            ].indexed.every((e) => e.$2 == _initial[e.$1]),
            onPressed: _save,
          ),
        ),
        AppButton(
          label: 'Hủy chỉnh sửa',
          variant: ButtonVariant.secondary,
          onPressed: _close,
        ),
        Text(
          'Thay đổi được lưu trong phiên hiện tại. Credit và số buổi vẫn là gợi ý.',
          style: _caption,
        ),
      ],
    );
  }
}

class CloseProposalScreen extends ConsumerStatefulWidget {
  const CloseProposalScreen({super.key, required this.id, this.action});

  final String id;
  final String? action;

  @override
  ConsumerState<CloseProposalScreen> createState() =>
      _CloseProposalScreenState();
}

class _CloseProposalScreenState extends ConsumerState<CloseProposalScreen> {
  final _note = AppField(validator: validateRejectionNote);
  bool _done = false;
  String? _error;

  bool get _rejecting => widget.action == 'reject';

  @override
  void dispose() {
    _note.dispose();
    super.dispose();
  }

  void _backToDetail() {
    if (context.canPop()) {
      context.pop();
    } else {
      context.go('/proposal/${widget.id}');
    }
  }

  @override
  Widget build(BuildContext context) {
    final id = widget.id;
    final proposal = ref
        .watch(proposalsProvider)
        .where((p) => p.id == id)
        .firstOrNull;
    final allowed =
        proposal != null &&
        proposal.status == 'PENDING' &&
        (_rejecting
            ? !proposal.sent
            : widget.action == 'withdraw' && proposal.sent);

    Future<void> close([String? note]) async {
      if (!allowed ||
          !await ref
              .read(proposalsProvider.notifier)
              .decide(id, _rejecting ? 'REJECTED' : 'WITHDRAWN', note)) {
        if (!mounted) return;
        setState(
          () => _error =
              'Đề xuất đã thay đổi. Hãy quay lại chi tiết để kiểm tra trạng thái.',
        );
        return;
      }
      if (!context.mounted) return;
      FocusScope.of(context).unfocus();
      setState(() => _done = true);
    }

    return AppScreenLayout(
      title: _done
          ? 'Đề xuất đã đóng'
          : _rejecting
          ? 'Từ chối đề xuất'
          : 'Rút đề xuất',
      selected: 'Tin nhắn',
      back: (route: '/proposal/$id', label: 'Quay lại chi tiết đề xuất'),
      child: proposal == null || (!allowed && !_done)
          ? EmptyState(
              title: 'Không thể đóng đề xuất',
              description:
                  'Thao tác này chỉ áp dụng cho đề xuất đang chờ phản hồi và đúng người gửi hoặc người nhận.',
              action: 'Xem lại chi tiết',
              onAction: _backToDetail,
            )
          : _ProposalBody(
              children: [
                Text(
                  _done
                      ? (_rejecting
                            ? 'Bạn đã từ chối đề xuất'
                            : 'Bạn đã rút đề xuất')
                      : (_rejecting
                            ? 'Vì sao đề xuất chưa phù hợp?'
                            : 'Bạn muốn rút lời đề nghị này?'),
                  style: _title,
                ),
                ProposalSummary(proposal: proposal, compact: true),
                if (_done) ...[
                  const FormNotice(
                    tone: NoticeTone.success,
                    message:
                        'Đề xuất mẫu đã đóng. Bạn có thể xem lại trong danh sách Đã đóng.',
                  ),
                  if (proposal.localDecisionNote?.isNotEmpty ?? false) ...[
                    Text('Lý do từ chối', style: _heading),
                    SelectableText(proposal.localDecisionNote!, style: _body),
                  ],
                  AppButton(
                    label: 'Về danh sách đã đóng',
                    onPressed: () => context.go('/proposals?tab=closed'),
                  ),
                ] else ...[
                  Text(
                    _rejecting
                        ? 'Chia sẻ lý do để người gửi hiểu lựa chọn của bạn. Chỉ đề xuất này bị đóng; các đề xuất khác giữ nguyên.'
                        : 'Người nhận sẽ không thể chấp nhận đề xuất đã rút. Bạn vẫn xem được lịch sử và có thể gửi một đề xuất mới sau đó.',
                    style: _body,
                  ),
                  if (_rejecting)
                    AppInput(
                      field: _note,
                      label: 'Lý do từ chối',
                      required: true,
                      multiline: true,
                      placeholder:
                          'Ví dụ: Khung giờ chưa phù hợp với lịch của mình...',
                    ),
                  if (_error != null)
                    FormNotice(tone: NoticeTone.error, message: _error!),
                  AppButton(
                    label: _rejecting
                        ? 'Xác nhận từ chối'
                        : 'Xác nhận rút đề xuất',
                    onPressed: () {
                      if (!_rejecting) {
                        close();
                        return;
                      }
                      if (validateFields([_note])) close(_note.text);
                    },
                  ),
                  AppButton(
                    label: 'Giữ đề xuất & quay lại',
                    variant: ButtonVariant.secondary,
                    onPressed: _backToDetail,
                  ),
                ],
                Text(
                  'Dữ liệu mẫu · Lý do chỉ lưu trong phiên, chưa gửi thông báo đến người nhận.',
                  style: _caption,
                ),
              ],
            ),
    );
  }
}
