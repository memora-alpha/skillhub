import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../components/app_button.dart';
import '../../components/app_icon.dart';
import '../../components/avatar.dart';
import '../../components/feature_page.dart';
import '../../components/tappable.dart';
import '../../core/theme/tokens.dart';
import '../auth/session/auth_session.dart';
import '../discovery/discovery_data.dart';
import '../messages/messages_data.dart';
import '../shell/app_screen_layout.dart';
import '../shell/navigation.dart';

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
  (label: 'Hoàn thiện hồ sơ', done: true, icon: AppIcon.user),
  (label: 'Thêm kỹ năng chia sẻ', done: true, icon: AppIcon.award),
  (label: 'Khám phá kỹ năng', done: false, icon: AppIcon.search),
  (label: 'Tạo yêu cầu học đầu tiên', done: false, icon: AppIcon.edit),
];
const _newUserSummary = (credit: 0, reputation: 50, learned: 0, taught: 0);
const _returningSummary = (credit: 180, reputation: 85, learned: 8, taught: 12);
const _nextSession = (
  title: 'React Hooks & State Management',
  mentor: 'Trần Việt Anh',
  mentorId: 'demo-viet-anh',
  schedule: 'Thứ 5, 20:00 – 21:30',
);
const _learningPath = (
  title: 'React cho người mới bắt đầu',
  completed: 3,
  total: 6,
  next: 'Thứ 5, 20:00',
);
const _matchingRequests = [
  (
    id: 'react',
    title: 'Muốn học React từ cơ bản đến nâng cao',
    name: 'Lê Hồng Anh',
    userId: 'demo-hong-anh',
    credit: 50,
    match: 95,
  ),
  (
    id: 'portfolio',
    title: 'Cần mentor hướng dẫn xây dựng portfolio',
    name: 'Vũ Minh Tuấn',
    userId: 'demo-minh-tuan',
    credit: 45,
    match: 87,
  ),
];
const _achievement = (
  title: 'Người học chăm chỉ',
  description: 'Hoàn thành 10 buổi học',
  completed: 8,
  total: 10,
);
const _recentMessages = [
  (
    id: 'viet-anh',
    name: 'Trần Việt Anh',
    userId: 'demo-viet-anh',
    message: 'Xác nhận buổi học thứ 5 nhé bạn?',
    time: '2 giờ trước',
    unread: 2,
  ),
  (
    id: 'bich',
    name: 'Nguyễn Thị Bích',
    userId: 'demo-thi-bich',
    message: 'Mình muốn học Python cơ bản...',
    time: '5 giờ trước',
    unread: 0,
  ),
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

    void action(String label) {
      if (label == 'Hoàn thiện hồ sơ') {
        context.push('/edit-profile');
        return;
      }
      if (appRoutes.containsKey(label)) {
        if (label != 'Trang chủ') openAppAction(context, label);
        return;
      }
      for (final request in _matchingRequests) {
        if (request.title == label) {
          findLearningRequest(request.id) != null
              ? context.push('/request/${request.id}')
              : context.go('/discover');
          return;
        }
      }
      for (final conversation in conversationList) {
        if (conversation.name == label) {
          context.push('/chat/${conversation.proposal}');
          return;
        }
      }
      context.push('/ui');
    }

    final words = session.name.trim().split(RegExp(r'\s+'));
    final name = words.length > 2
        ? words.sublist(words.length - 2).join(' ')
        : words.join(' ');

    return AppScreenLayout(
      title: '',
      selected: 'Trang chủ',
      background: _C.background,
      child: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 1000),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                spacing: 12,
                children: [
                  Text(
                    'Hoạt động học tập bên dưới dùng dữ liệu mẫu. Hồ sơ và tài khoản dùng thông tin đã lưu.',
                    style: nunito((12, 16), color: AppColors.muted),
                  ),
                  _HomeContent(
                    name: name,
                    isNew: session.isNew,
                    onAction: action,
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

class _HomeContent extends StatelessWidget {
  const _HomeContent({
    required this.name,
    required this.isNew,
    required this.onAction,
  });

  final String name;
  final bool isNew;
  final ValueChanged<String> onAction;

  @override
  Widget build(BuildContext context) {
    final wide = MediaQuery.sizeOf(context).width >= 840;
    final summary = isNew ? _newUserSummary : _returningSummary;
    final achievementProgress = isNew ? 0 : _achievement.completed;
    final achievementPercent =
        (achievementProgress / _achievement.total * 100).round();
    final messages = isNew ? const <Never>[] : _recentMessages;
    final stats = [
      ('Reputation', summary.reputation, _C.orange),
      ('Đã học', summary.learned, _C.ink),
      ('Đã dạy', summary.taught, _C.ink),
    ];

    final primary = Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: 28,
      children: [
        _SessionCard(isNew: isNew, onAction: onAction),
        Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _SectionHeading(
              title: 'Lộ trình đang học',
              action: isNew ? 'Khám phá' : 'Chi tiết',
              onTap: () => onAction(isNew ? 'Khám phá' : 'Lộ trình đang học'),
            ),
            Tappable(
              semanticLabel: isNew ? 'Tìm lộ trình học' : _learningPath.title,
              onTap: () => onAction(isNew ? 'Khám phá' : 'Lộ trình đang học'),
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
                              Text(
                                isNew
                                    ? 'Chưa có lộ trình đang học'
                                    : _learningPath.title,
                                style: _label,
                              ),
                              Text(
                                isNew
                                    ? 'Tìm kỹ năng để bắt đầu buổi đầu tiên.'
                                    : 'Buổi tiếp: ${_learningPath.next}',
                                style: _caption,
                              ),
                            ],
                          ),
                        ),
                        if (!isNew)
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 7,
                              vertical: 3,
                            ),
                            decoration: BoxDecoration(
                              color: const Color(0xFFF7F8FA),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(
                              '${_learningPath.completed}/${_learningPath.total} buổi',
                              style: nunito(
                                TypeScale.caption,
                                weight: FontWeight.w700,
                                color: _C.ink,
                              ),
                            ),
                          ),
                      ],
                    ),
                    if (!isNew)
                      AppProgressBar(
                        value: _learningPath.completed,
                        max: _learningPath.total,
                        color: _C.orange,
                        trackColor: _C.track,
                        height: 6,
                        label: _learningPath.title,
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
                                  child: Text(
                                    _achievement.title,
                                    style: _label,
                                  ),
                                ),
                                Text(
                                  '$achievementPercent%',
                                  style: nunito(
                                    TypeScale.secondary,
                                    weight: FontWeight.w700,
                                    color: _C.orange,
                                  ),
                                ),
                              ],
                            ),
                            Text(
                              '${_achievement.description} · $achievementProgress/${_achievement.total} buổi',
                              style: _caption,
                            ),
                          ],
                        ),
                        AppProgressBar(
                          value: achievementProgress,
                          max: _achievement.total,
                          color: _C.yellow,
                          trackColor: _C.track,
                          height: 6,
                          label: _achievement.title,
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
                for (final request in _matchingRequests)
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
                                    '${request.match}% phù hợp',
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
                                    '${request.credit} CR/lộ trình',
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
                              Avatar(
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
                            text: '${summary.credit} ',
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
  const _SessionCard({required this.isNew, required this.onAction});

  final bool isNew;
  final ValueChanged<String> onAction;

  @override
  Widget build(BuildContext context) {
    final caption = nunito(
      TypeScale.caption,
      weight: FontWeight.w600,
      color: _C.body,
    );
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
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
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
                  Text(
                    isNew ? 'Buổi học tiếp theo' : 'Sắp diễn ra',
                    style: caption,
                  ),
                ],
              ),
              if (!isNew)
                _Chip(
                  background: const Color(0x73FFFFFF),
                  children: [
                    const AppIcon(
                      AppIcon.video,
                      size: IconSizes.inline,
                      color: _C.body,
                    ),
                    Text('Google Meet', style: caption),
                  ],
                ),
            ],
          ),
          Text(
            isNew ? 'Chưa có buổi học sắp tới' : _nextSession.title,
            style: nunito((18, 25), weight: FontWeight.w700, color: _C.ink),
          ),
          if (isNew)
            Text(
              'Tìm kỹ năng bạn muốn học và kết nối với người hướng dẫn.',
              style: nunito(
                TypeScale.secondary,
                weight: FontWeight.w500,
                color: _C.body,
              ),
            )
          else
            Row(
              spacing: 7,
              children: [
                Avatar(
                  name: _nextSession.mentor,
                  userId: _nextSession.mentorId,
                  size: AvatarSizes.compact,
                ),
                Flexible(
                  child: Text(
                    _nextSession.mentor,
                    style: nunito(
                      TypeScale.secondary,
                      weight: FontWeight.w600,
                      color: _C.body,
                    ),
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 6,
                    vertical: 2,
                  ),
                  decoration: BoxDecoration(
                    color: const Color(0x99FFFFFF),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(
                    'Mentor',
                    style: nunito(
                      TypeScale.caption,
                      weight: FontWeight.w500,
                      color: _C.orangeDark,
                    ),
                  ),
                ),
              ],
            ),
          Padding(
            padding: const EdgeInsets.only(top: 16),
            child: Wrap(
              alignment: WrapAlignment.spaceBetween,
              crossAxisAlignment: WrapCrossAlignment.center,
              spacing: 10,
              runSpacing: 10,
              children: [
                if (!isNew)
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    spacing: 6,
                    children: [
                      const AppIcon(
                        AppIcon.clock,
                        size: 14,
                        color: _C.orangeDark,
                      ),
                      Text(
                        _nextSession.schedule,
                        style: nunito(
                          TypeScale.secondary,
                          weight: FontWeight.w500,
                          color: _C.body,
                        ),
                      ),
                    ],
                  ),
                AppButton(
                  size: ButtonSize.sm,
                  variant: ButtonVariant.white,
                  minHeight: 36,
                  onPressed: () => onAction(isNew ? 'Khám phá' : 'Vào học'),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    spacing: 4,
                    children: [
                      Text(
                        isNew ? 'Khám phá kỹ năng' : 'Vào học',
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
              ],
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
                Avatar(
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
