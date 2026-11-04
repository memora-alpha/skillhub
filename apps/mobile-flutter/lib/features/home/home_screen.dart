import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../components/app_button.dart';
import '../../components/app_icon.dart';
import '../../components/user_avatar.dart';
import '../../components/feature_page.dart';
import '../../components/tappable.dart';
import '../../core/http/app_error.dart';
import '../../core/theme/tokens.dart';
import '../auth/session/auth_session.dart';
import '../discovery/discovery_data.dart';
import '../messages/messages_data.dart';
import '../shell/app_screen_layout.dart';
import '../sessions/live_sessions.dart';
import '../shell/navigation.dart';
import '../remote/refresh_signal.dart';
import '../wallet/wallet_feature.dart';

String _creditText(Object? value) {
  if (value == null) return '—';
  final text = '$value'.trim();
  return text.isEmpty ? '—' : text;
}

abstract final class _C {
  static const background = Chrome.background;
  static const surface = Chrome.surface;
  static const ink = Chrome.ink;
  static const body = Color(0xFF534D47);
  static const muted = Color(0xFF97928A);
  static const border = Chrome.border;
  static const orange = Chrome.accent;
  static const orangeDark = Color(0xFFC74623);
  static const orangeSoft = Color(0xFFFFF0E8);
  static const sessionStart = Color(0xFFF8D8C5);
  static const sessionEnd = Color(0xFFF3BFA6);
  static const green = Color(0xFF27977B);
  static const greenSoft = Color(0xFFEAF7F0);
  static const yellow = Color(0xFFFFB800);
  static const yellowSoft = Color(0xFFFFF7DD);
  static const blue = Color(0xFF24B3DA);
  static const track = Color(0xFFF3F4F6);
}

const _cardShadow = [
  BoxShadow(color: Color(0x0B352B1F), offset: Offset(0, 4), blurRadius: 16),
];

const _onboardingTasks = [
  (label: 'Hoàn thiện hồ sơ', done: false, icon: AppIcon.user),
  (label: 'Thêm kỹ năng chia sẻ', done: false, icon: AppIcon.award),
  (label: 'Khám phá kỹ năng', done: false, icon: AppIcon.search),
  (label: 'Tạo yêu cầu học đầu tiên', done: false, icon: AppIcon.edit),
];

final _label = nunito(TypeScale.body, weight: FontWeight.w600, color: _C.ink);
final _caption = nunito(TypeScale.secondary, color: _C.muted);

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(accountSessionProvider);
    if (session == null) return const SizedBox.shrink();
    final conversationList = ref.watch(
      messagesProvider.select((s) => s.conversations),
    );
    final requests =
        ref.watch(recommendedRequestsProvider).value ?? const <LearningRequest>[];
    final profile = session.profile;

    void action(String label) {
      if (label == 'Hoàn thiện hồ sơ') {
        context.push('/edit-profile');
        return;
      }
      if (appRoutes.containsKey(label)) {
        if (label != 'Trang chủ') openAppAction(context, label);
        return;
      }
      for (final request in requests) {
        if (request.title == label) {
          context.push('/request/${request.id}');
          return;
        }
      }
      for (final conversation in conversationList) {
        if (conversation.name == label) {
          context.push('/chat/${conversation.proposal}');
          return;
        }
      }
      context.push('/discover');
    }

    final upcoming = ref.watch(upcomingSessionProvider);
    final words = session.name.trim().split(RegExp(r'\s+'));
    final name = words.length > 2
        ? words.sublist(words.length - 2).join(' ')
        : words.join(' ');

    return AppScreenLayout(
      title: '',
      selected: 'Trang chủ',
      background: _C.background,
      child: RefreshIndicator(
        onRefresh: () => pullRefresh(
          ref,
          const {RefreshScope.study, RefreshScope.discover},
        ),
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(20),
        children: [
          Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 1000),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                spacing: 12,
                children: [
                  _HomeContent(
                    name: name,
                    nextSession: upcoming.asData?.value,
                    sessionsLoading: upcoming.isLoading && !upcoming.hasValue,
                    sessionsError: upcoming.hasError
                        ? errorMessage(upcoming.error)
                        : null,
                    balance: _creditText(
                      ref.watch(walletProvider).value?['availableCredit'],
                    ),
                    isNew: session.isNew,
                    reputation: profile.reputationScore?.round() ?? 0,
                    learned: profile.completedSessionCount,
                    taught: profile.verifiedSkillCount,
                    requests: [
                      for (final request in requests.take(4))
                        (
                          id: request.id,
                          title: request.title,
                          name: request.user,
                          userId: request.userId,
                          credit: request.budget.isEmpty ? '—' : request.budget,
                          match: 0,
                        ),
                    ],
                    messages: [
                      for (final item in conversationList.take(4))
                        (
                          id: item.proposal,
                          name: item.name,
                          userId: item.userId,
                          message: item.last,
                          time: item.time,
                          unread: item.unread,
                        ),
                    ],
                    onAction: action,
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

class _HomeContent extends StatelessWidget {
  const _HomeContent({
    required this.name,
    required this.nextSession,
    required this.sessionsLoading,
    required this.sessionsError,
    required this.balance,
    required this.isNew,
    required this.reputation,
    required this.learned,
    required this.taught,
    required this.requests,
    required this.messages,
    required this.onAction,
  });

  final String name;
  final Map<String, dynamic>? nextSession;
  final bool sessionsLoading;
  final String? sessionsError;
  final String balance;
  final bool isNew;
  final int reputation;
  final int learned;
  final int taught;
  final List<
    ({
      String id,
      String title,
      String name,
      String userId,
      String credit,
      int match,
    })
  >
  requests;
  final List<
    ({
      String id,
      String name,
      String userId,
      String message,
      String time,
      int unread,
    })
  >
  messages;
  final ValueChanged<String> onAction;

  @override
  Widget build(BuildContext context) {
    final wide = MediaQuery.sizeOf(context).width >= 840;
    final stats = [
      ('Reputation', reputation, _C.orange),
      ('Đã học', learned, _C.ink),
      ('Đã dạy', taught, _C.ink),
    ];

    final primary = Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: 28,
      children: [
        _SessionCard(
          session: nextSession,
          loading: sessionsLoading,
          error: sessionsError,
          onOpen: nextSession == null
              ? null
              : () => context.push('/learning-sessions/${nextSession!['id']}'),
          onDiscover: () => onAction('Khám phá'),
        ),
        Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _SectionHeading(
              title: 'Lộ trình đang học',
              action: 'Chi tiết',
              onTap: () => onAction('Lộ trình của tôi'),
            ),
            Tappable(
              semanticLabel: 'Tìm lộ trình học',
              onTap: () => onAction('Lộ trình của tôi'),
              child: _Card(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  spacing: 12,
                  children: [
                    Row(
                      spacing: 10,
                      children: [
                        _IconBox(
                          icon: AppIcon.book,
                          color: _C.orange,
                          background: _C.yellowSoft,
                          width: 40,
                          height: 40,
                        ),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('Chưa có lộ trình đang học', style: _label),
                              Text(
                                'Lộ trình xuất hiện sau khi đề xuất được chấp nhận.',
                                style: _caption,
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
        Row(
          spacing: 12,
          children: [
            for (var i = 0; i < stats.length; i++)
              Expanded(
                child: _Card(
                  padding: const EdgeInsets.symmetric(
                    vertical: 16,
                    horizontal: 4,
                  ),
                  child: Column(
                    spacing: 8,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        spacing: 4,
                        children: [
                          if (i == 0)
                            const AppIcon(
                              AppIcon.star,
                              size: 14,
                              color: _C.yellow,
                            ),
                          Text(
                            '${stats[i].$2}',
                            style: nunito(
                              (21, 28),
                              weight: FontWeight.w700,
                              color: stats[i].$3,
                            ),
                          ),
                        ],
                      ),
                      Text(
                        stats[i].$1,
                        textAlign: TextAlign.center,
                        style: nunito(
                          TypeScale.caption,
                          weight: FontWeight.w500,
                          color: _C.muted,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
          ],
        ),
        Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _SectionHeading(
              title: 'Tiến trình huy hiệu',
              action: 'Xem tất cả',
              accent: _C.yellow,
              onTap: () => onAction('Tiến trình huy hiệu'),
            ),
            _Card(
              padding: const EdgeInsets.all(16),
              child: Row(
                spacing: 12,
                children: [
                  const _IconBox(
                    icon: AppIcon.award,
                    color: _C.yellow,
                    background: _C.yellowSoft,
                    width: 44,
                    height: 48,
                  ),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      spacing: 8,
                      children: [
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              spacing: 8,
                              children: [
                                Expanded(
                                  child: Text('Chưa có thành tích', style: _label),
                                ),
                              ],
                            ),
                            Text(
                              'Danh hiệu mở khi bạn hoàn thành các mốc trên máy chủ.',
                              style: _caption,
                            ),
                          ],
                        ),
                        AppProgressBar(
                          value: 0,
                          max: 1,
                          color: _C.yellow,
                          trackColor: _C.track,
                          height: 6,
                          label: 'Chưa có thành tích',
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ],
    );

    final secondary = Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: 24,
      children: [
        Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _SectionHeading(
              title: 'Yêu cầu học phù hợp',
              action: 'Xem thêm',
              accent: _C.green,
              onTap: () => onAction('Yêu cầu học phù hợp'),
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              spacing: 12,
              children: [
                for (final request in requests)
                  Tappable(
                    semanticLabel: request.title,
                    onTap: () => onAction(request.title),
                    child: _Card(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        spacing: 10,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              _Chip(
                                background: _C.greenSoft,
                                children: [
                                  const AppIcon(
                                    AppIcon.check,
                                    size: 11,
                                    color: _C.green,
                                  ),
                                  Text(
                                    request.match > 0
                                        ? '${request.match}% phù hợp'
                                        : 'Gợi ý',
                                    style: nunito(
                                      TypeScale.caption,
                                      weight: FontWeight.w700,
                                      color: _C.green,
                                    ),
                                  ),
                                ],
                              ),
                              _Chip(
                                background: _C.orangeSoft,
                                children: [
                                  Text(
                                    request.credit,
                                    style: nunito(
                                      TypeScale.caption,
                                      weight: FontWeight.w600,
                                      color: _C.orangeDark,
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                          Text(
                            request.title,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: nunito(
                              TypeScale.body,
                              weight: FontWeight.w700,
                              color: _C.ink,
                            ),
                          ),
                          Row(
                            spacing: 6,
                            children: [
                              UserAvatar(
                                name: request.name,
                                userId: request.userId,
                                size: AvatarSizes.inline,
                              ),
                              Expanded(
                                child: Text(request.name, style: _caption),
                              ),
                              Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 9,
                                  vertical: 6,
                                ),
                                decoration: BoxDecoration(
                                  borderRadius: BorderRadius.circular(7),
                                  border: Border.all(color: _C.orangeSoft),
                                ),
                                child: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  spacing: 1,
                                  children: [
                                    Text(
                                      'Xem chi tiết',
                                      style: nunito(
                                        TypeScale.caption,
                                        weight: FontWeight.w700,
                                        color: _C.orange,
                                      ),
                                    ),
                                    const AppIcon(
                                      AppIcon.chevron,
                                      size: IconSizes.inline,
                                      color: _C.orange,
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),
              ],
            ),
          ],
        ),
        Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _SectionHeading(
              title: 'Tin nhắn mới',
              action: 'Tất cả',
              accent: _C.blue,
              onTap: () => onAction('Tin nhắn'),
            ),
            _Card(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (messages.isEmpty)
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      child: Row(
                        spacing: 12,
                        children: [
                          const AppIcon(
                            AppIcon.message,
                            size: 24,
                            color: _C.muted,
                          ),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              spacing: 4,
                              children: [
                                Text('Chưa có tin nhắn mới', style: _label),
                                Text(
                                  'Các cuộc trò chuyện của bạn sẽ xuất hiện ở đây.',
                                  style: _caption,
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  for (var i = 0; i < messages.length; i++)
                    _MessageRow(
                      message: messages[i],
                      first: i == 0,
                      onTap: () => onAction(messages[i].name),
                    ),
                ],
              ),
            ),
          ],
        ),
      ],
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: 28,
      children: [
        Row(
          spacing: 16,
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'CHÀO BẠN',
                    style: nunito(
                      TypeScale.secondary,
                      weight: FontWeight.w500,
                      color: _C.muted,
                    ),
                  ),
                  Text(
                    '$name!',
                    style: nunito(
                      (26, 32),
                      weight: FontWeight.w700,
                      color: _C.ink,
                    ),
                  ),
                ],
              ),
            ),
            Tappable(
              semanticLabel: 'Ví Credit',
              onTap: () => onAction('Ví Credit'),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                decoration: BoxDecoration(
                  color: _C.surface,
                  borderRadius: BorderRadius.circular(12),
                  boxShadow: _cardShadow,
                ),
                child: Row(
                  spacing: 8,
                  children: [
                    Container(
                      width: 24,
                      height: 24,
                      alignment: Alignment.center,
                      decoration: const BoxDecoration(
                        color: _C.orangeSoft,
                        shape: BoxShape.circle,
                      ),
                      child: const AppIcon(
                        AppIcon.wallet,
                        size: IconSizes.control,
                        color: _C.orange,
                      ),
                    ),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'SỐ DƯ',
                          style: nunito(
                            TypeScale.caption,
                            weight: FontWeight.w600,
                            color: _C.muted,
                          ),
                        ),
                        Text.rich(
                          TextSpan(
                            text: '$balance ',
                            children: const [
                              TextSpan(
                                text: 'CR',
                                style: TextStyle(color: _C.orange),
                              ),
                            ],
                          ),
                          style: nunito(
                            TypeScale.body,
                            weight: FontWeight.w700,
                            color: _C.ink,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
        if (isNew) _NewUserGuide(onAction: onAction),
        if (wide)
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            spacing: 24,
            children: [
              Expanded(child: primary),
              Expanded(child: secondary),
            ],
          )
        else
          Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            spacing: 24,
            children: [primary, secondary],
          ),
      ],
    );
  }
}

class _SessionCard extends StatelessWidget {
  const _SessionCard({
    required this.session,
    required this.loading,
    required this.error,
    required this.onOpen,
    required this.onDiscover,
  });

  final Map<String, dynamic>? session;
  final bool loading;
  final String? error;
  final VoidCallback? onOpen;
  final VoidCallback onDiscover;

  @override
  Widget build(BuildContext context) {
    final caption = nunito(
      TypeScale.caption,
      weight: FontWeight.w600,
      color: _C.body,
    );
    final start = session == null ? null : sessionInstant(session!['startAt']);
    final title = loading
        ? 'Đang tải buổi học'
        : error != null
        ? 'Không tải được buổi học'
        : session == null
        ? 'Chưa có buổi học sắp tới'
        : sessionRoleLabel(session!);
    final detail = loading
        ? 'Đang lấy buổi học từ hệ thống.'
        : error ??
              (session == null
                  ? 'Tìm kỹ năng bạn muốn học và kết nối với người hướng dẫn.'
                  : [
                      if (start != null) viDateTime(start),
                      '${sessionMinutes(session!)} phút',
                      sessionStatusLabel(session!['status']),
                    ].join(' · '));
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [_C.sessionStart, _C.sessionEnd],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(24),
        boxShadow: const [
          BoxShadow(
            color: Color(0x1FD67242),
            offset: Offset(0, 6),
            blurRadius: 18,
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        spacing: 12,
        children: [
          _Chip(
            background: const Color(0xFFFFFAF5),
            children: [
              Container(
                width: 6,
                height: 6,
                decoration: const BoxDecoration(
                  color: _C.green,
                  shape: BoxShape.circle,
                ),
              ),
              Text('Buổi học tiếp theo', style: caption),
            ],
          ),
          Text(
            title,
            style: nunito((18, 25), weight: FontWeight.w700, color: _C.ink),
          ),
          Text(
            detail,
            style: nunito(
              TypeScale.secondary,
              weight: FontWeight.w500,
              color: _C.body,
            ),
          ),
          Align(
            alignment: Alignment.centerLeft,
            child: AppButton(
              size: ButtonSize.sm,
              variant: ButtonVariant.white,
              minHeight: 36,
              onPressed: session == null ? onDiscover : onOpen,
              child: Row(
                mainAxisSize: MainAxisSize.min,
                spacing: 4,
                children: [
                  Text(
                    session == null ? 'Khám phá kỹ năng' : 'Mở buổi học',
                    style: nunito(
                      TypeScale.secondary,
                      weight: FontWeight.w700,
                      color: _C.orange,
                    ),
                  ),
                  const AppIcon(
                    AppIcon.arrow,
                    size: IconSizes.inline,
                    color: _C.orange,
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

class _MessageRow extends StatelessWidget {
  const _MessageRow({
    required this.message,
    required this.first,
    required this.onTap,
  });

  final ({
    String id,
    String name,
    String userId,
    String message,
    String time,
    int unread,
  })
  message;
  final bool first;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Tappable(
      semanticLabel: 'Tin nhắn từ ${message.name}',
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 14),
        decoration: BoxDecoration(
          border: first ? null : const Border(top: BorderSide(color: _C.border)),
        ),
        child: Row(
          spacing: 10,
          children: [
            Stack(
              children: [
                UserAvatar(
                  name: message.name,
                  userId: message.userId,
                  size: AvatarSizes.list,
                ),
                if (first)
                  Positioned(
                    right: 0,
                    bottom: 0,
                    child: Container(
                      width: 9,
                      height: 9,
                      decoration: BoxDecoration(
                        color: _C.green,
                        shape: BoxShape.circle,
                        border: Border.all(color: _C.surface, width: 2),
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
                    spacing: 6,
                    children: [
                      Expanded(
                        child: Text(
                          message.name,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: _label,
                        ),
                      ),
                      Text(
                        message.time,
                        style: nunito(
                          TypeScale.caption,
                          weight: FontWeight.w500,
                          color: _C.muted,
                        ),
                      ),
                    ],
                  ),
                  Text(
                    message.message,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: _caption.copyWith(
                      color: message.unread > 0 ? _C.body : null,
                    ),
                  ),
                ],
              ),
            ),
            if (message.unread > 0)
              Container(
                width: 18,
                height: 18,
                alignment: Alignment.center,
                decoration: const BoxDecoration(
                  color: _C.orange,
                  shape: BoxShape.circle,
                ),
                child: Text(
                  '${message.unread}',
                  style: nunito(
                    TypeScale.caption,
                    weight: FontWeight.w700,
                    color: _C.surface,
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _NewUserGuide extends StatefulWidget {
  const _NewUserGuide({required this.onAction});

  final ValueChanged<String> onAction;

  @override
  State<_NewUserGuide> createState() => _NewUserGuideState();
}

class _NewUserGuideState extends State<_NewUserGuide> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    final completed = _onboardingTasks.where((t) => t.done).length;
    return Container(
      decoration: BoxDecoration(
        color: _C.orangeSoft,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Semantics(
            expanded: _expanded,
            child: Tappable(
              pressedOpacity: 0.7,
              semanticLabel: 'Hướng dẫn người mới',
              onTap: () => setState(() => _expanded = !_expanded),
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Row(
                  spacing: 12,
                  children: [
                    const AppIcon(AppIcon.book, size: 22, color: _C.orange),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        spacing: 2,
                        children: [
                          Text('Hướng dẫn người mới', style: _label),
                          Text(
                            '$completed/${_onboardingTasks.length} bước đã hoàn thành',
                            style: _caption,
                          ),
                        ],
                      ),
                    ),
                    Transform.rotate(
                      angle: _expanded ? 0.785398 : 0,
                      child: const AppIcon(
                        AppIcon.plus,
                        size: 18,
                        color: _C.orange,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          if (_expanded)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
              child: Column(
                spacing: 4,
                children: [
                  for (final task in _onboardingTasks)
                    Tappable(
                      pressedOpacity: 0.7,
                      semanticLabel:
                          '${task.label}${task.done ? ', đã hoàn thành' : ''}',
                      onTap: () => widget.onAction(task.label),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(vertical: 10),
                        child: Row(
                          spacing: 12,
                          children: [
                            AppIcon(
                              task.done ? AppIcon.checkCircle : task.icon,
                              size: 20,
                              color: task.done ? _C.green : _C.orange,
                            ),
                            Expanded(
                              child: Text(
                                task.label,
                                style: nunito(
                                  TypeScale.body,
                                  weight: FontWeight.w500,
                                  color: task.done ? _C.muted : _C.ink,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

class _SectionHeading extends StatelessWidget {
  const _SectionHeading({
    required this.title,
    this.action,
    this.onTap,
    this.accent = _C.orange,
  });

  final String title;
  final String? action;
  final VoidCallback? onTap;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        spacing: 12,
        children: [
          Expanded(
            child: Row(
              spacing: 7,
              children: [
                Container(
                  width: 4,
                  height: 16,
                  decoration: BoxDecoration(
                    color: accent,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
                Flexible(
                  child: Semantics(
                    header: true,
                    child: Text(
                      title,
                      style: nunito(
                        TypeScale.heading,
                        weight: FontWeight.w700,
                        color: _C.ink,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
          if (action != null)
            Tappable(
              semanticLabel: '$action — $title',
              onTap: onTap,
              child: SizedBox(
                height: 24,
                child: Row(
                  spacing: 2,
                  children: [
                    Text(
                      action!,
                      style: nunito(
                        TypeScale.secondary,
                        weight: FontWeight.w600,
                        color: _C.orange,
                      ),
                    ),
                    const AppIcon(
                      AppIcon.chevron,
                      size: IconSizes.inline,
                      color: _C.orange,
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

class _Card extends StatelessWidget {
  const _Card({required this.child, required this.padding});

  final Widget child;
  final EdgeInsets padding;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: padding,
      decoration: BoxDecoration(
        color: _C.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: _C.border),
        boxShadow: _cardShadow,
      ),
      child: child,
    );
  }
}

class _Chip extends StatelessWidget {
  const _Chip({required this.background, required this.children});

  final Color background;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(6),
      ),
      child: Row(mainAxisSize: MainAxisSize.min, spacing: 4, children: children),
    );
  }
}

class _IconBox extends StatelessWidget {
  const _IconBox({
    required this.icon,
    required this.color,
    required this.background,
    required this.width,
    required this.height,
  });

  final String icon;
  final Color color;
  final Color background;
  final double width;
  final double height;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: width,
      height: height,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(12),
      ),
      child: AppIcon(icon, size: IconSizes.feature, color: color),
    );
  }
}
