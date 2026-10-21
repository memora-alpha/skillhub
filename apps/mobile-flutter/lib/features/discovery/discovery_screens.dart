import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../components/app_button.dart';
import '../../components/app_icon.dart';
import '../../components/avatar.dart';
import '../../components/misc.dart';
import '../../components/tappable.dart';
import '../../core/theme/tokens.dart';
import '../shell/app_screen_layout.dart';
import '../shell/navigation.dart';
import 'discovery_data.dart';

typedef _C = DiscoveryColors;

const _cardShadow = [
  BoxShadow(color: Color(0x0A352B1F), offset: Offset(0, 3), blurRadius: 12),
];

class DiscoverScreen extends ConsumerStatefulWidget {
  const DiscoverScreen({super.key, this.query = ''});

  final String query;

  @override
  ConsumerState<DiscoverScreen> createState() => _DiscoverScreenState();
}

class _DiscoverScreenState extends ConsumerState<DiscoverScreen> {
  late final _search = TextEditingController(text: widget.query);
  final _focus = FocusNode();
  String _filter = 'Tất cả';
  bool _advancedOpen = false;
  String _advanced = 'all';
  bool _oldestFirst = false;
  bool _sortOpen = false;

  @override
  void initState() {
    super.initState();
    _search.addListener(() => setState(() {}));
    _focus.addListener(() => setState(() {}));
  }

  @override
  void didUpdateWidget(DiscoverScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.query != widget.query) _search.text = widget.query;
  }

  @override
  void dispose() {
    _search.dispose();
    _focus.dispose();
    super.dispose();
  }

  void _reset() => setState(() {
    _filter = 'Tất cả';
    _advanced = 'all';
    _search.clear();
  });

  @override
  Widget build(BuildContext context) {
    final search = _search.text.toLowerCase();
    final loaded = ref.watch(learningRequestsProvider).value ?? const <LearningRequest>[];
    final filters = ['Tất cả', ...{for (final item in loaded) item.category}];
    final requests = loaded.where(
      (item) =>
          (_filter == 'Tất cả' || item.category == _filter) &&
          (_advanced == 'all' ||
              (_advanced == 'credit' && item.budgetCredit >= 60) ||
              (_advanced == 'sessions' && item.sessions >= 8)) &&
          (search.isEmpty ||
              '${item.title} ${item.user} ${item.tags.join(' ')}'
                  .toLowerCase()
                  .contains(search)),
    ).toList();
    final sorted = _oldestFirst ? requests.reversed.toList() : requests;
    final secondary = nunito(
      TypeScale.secondary,
      weight: FontWeight.w500,
      color: _C.muted,
    );
    final filtersActive =
        _advancedOpen || _filter != 'Tất cả' || _advanced != 'all';

    return AppScreenLayout(
      title: 'Yêu cầu học',
      selected: 'Khám phá',
      background: _C.background,
      rightAction: AppButton(
        size: ButtonSize.sm,
        variant: ButtonVariant.craft,
        backgroundColor: _C.orange,
        semanticLabel: 'Đăng yêu cầu học',
        onPressed: () => openAppAction(context, 'Đăng yêu cầu học'),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          spacing: 4,
          children: [
            const AppIcon(AppIcon.plus, size: 14, color: _C.surface),
            Text(
              'Đăng',
              style: nunito(
                TypeScale.secondary,
                weight: FontWeight.w600,
                color: _C.surface,
              ),
            ),
          ],
        ),
      ),
      child: ListView(
        keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
        padding: const EdgeInsets.fromLTRB(24, 4, 24, 24),
        children: [
          Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 792),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                spacing: 14,
                children: [
                  const SizedBox(height: 0),
                  IntrinsicHeight(
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      spacing: 8,
                      children: [
                        Expanded(
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 12),
                            decoration: BoxDecoration(
                              color: _C.surface,
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(
                                color: _focus.hasFocus ? _C.orange : _C.border,
                              ),
                            ),
                            child: Row(
                              spacing: 8,
                              children: [
                                const AppIcon(
                                  AppIcon.search,
                                  size: IconSizes.control,
                                  color: _C.muted,
                                ),
                                Expanded(
                                  child: TextField(
                                    controller: _search,
                                    focusNode: _focus,
                                    autocorrect: false,
                                    textInputAction: TextInputAction.search,
                                    style: nunito(
                                      TypeScale.secondary,
                                      color: _C.ink,
                                    ),
                                    decoration: InputDecoration(
                                      isDense: true,
                                      border: InputBorder.none,
                                      contentPadding:
                                          const EdgeInsets.symmetric(
                                            vertical: 11,
                                          ),
                                      hintText: 'Tìm kỹ năng, người học...',
                                      hintStyle: nunito(
                                        TypeScale.secondary,
                                        color: _C.muted,
                                      ),
                                    ),
                                  ),
                                ),
                                if (_search.text.isNotEmpty)
                                  Tappable(
                                    semanticLabel: 'Xóa tìm kiếm',
                                    onTap: _search.clear,
                                    child: const AppIcon(
                                      AppIcon.close,
                                      size: IconSizes.control,
                                      color: _C.muted,
                                    ),
                                  ),
                              ],
                            ),
                          ),
                        ),
                        Semantics(
                          expanded: _advancedOpen,
                          child: Tappable(
                            semanticLabel: 'Hiện bộ lọc nâng cao',
                            onTap: () =>
                                setState(() => _advancedOpen = !_advancedOpen),
                            child: Container(
                              constraints: const BoxConstraints(minWidth: 64),
                              padding: const EdgeInsets.symmetric(
                                horizontal: 10,
                              ),
                              decoration: BoxDecoration(
                                color: filtersActive
                                    ? _C.orangeSoft
                                    : _C.surface,
                                borderRadius: BorderRadius.circular(6),
                                border: Border.all(
                                  color: filtersActive ? _C.orange : _C.border,
                                ),
                              ),
                              child: Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                spacing: 4,
                                children: [
                                  const AppIcon(
                                    AppIcon.filter,
                                    size: IconSizes.control,
                                    color: _C.orange,
                                  ),
                                  Text(
                                    'Lọc',
                                    style: nunito(
                                      TypeScale.secondary,
                                      weight: FontWeight.w600,
                                      color: _C.orange,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  if (_advancedOpen)
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: _C.surface,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: _C.border),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        spacing: 8,
                        children: [
                          Container(
                            padding: const EdgeInsets.all(4),
                            decoration: BoxDecoration(
                              color: _C.tag,
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Row(
                              spacing: 4,
                              children: [
                                for (final label in filters)
                                  Expanded(
                                    child: Semantics(
                                      selected: _filter == label,
                                      child: Tappable(
                                        pressedOpacity: 0.7,
                                        onTap: () =>
                                            setState(() => _filter = label),
                                        child: Container(
                                          constraints: const BoxConstraints(
                                            minHeight: 40,
                                          ),
                                          alignment: Alignment.center,
                                          decoration: BoxDecoration(
                                            color: _filter == label
                                                ? _C.orangeSoft
                                                : null,
                                            borderRadius:
                                                BorderRadius.circular(4),
                                          ),
                                          child: Text(
                                            label,
                                            textAlign: TextAlign.center,
                                            style: nunito(
                                              TypeScale.secondary,
                                              weight: FontWeight.w600,
                                              color: _filter == label
                                                  ? _C.orange
                                                  : _C.muted,
                                            ),
                                          ),
                                        ),
                                      ),
                                    ),
                                  ),
                              ],
                            ),
                          ),
                          Text('Lọc nhanh', style: secondary),
                          Wrap(
                            spacing: 8,
                            runSpacing: 8,
                            children: [
                              for (final (value, label) in const [
                                ('all', 'Tất cả'),
                                ('credit', 'Từ 60 CR'),
                                ('sessions', 'Từ 8 buổi'),
                              ])
                                Semantics(
                                  selected: _advanced == value,
                                  child: Tappable(
                                    semanticLabel: 'Lọc $label',
                                    onTap: () =>
                                        setState(() => _advanced = value),
                                    child: Container(
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: 10,
                                        vertical: 6,
                                      ),
                                      decoration: BoxDecoration(
                                        color: _advanced == value
                                            ? _C.orangeSoft
                                            : _C.tag,
                                        borderRadius: BorderRadius.circular(4),
                                      ),
                                      child: Text(
                                        label,
                                        style: nunito(
                                          TypeScale.secondary,
                                          weight: FontWeight.w600,
                                          color: _advanced == value
                                              ? _C.orange
                                              : _C.muted,
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
                  Tappable(
                    semanticLabel: 'Yêu cầu học của tôi',
                    onTap: () => openAppAction(context, 'Yêu cầu học của tôi'),
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 14,
                        vertical: 12,
                      ),
                      decoration: BoxDecoration(
                        color: _C.surface,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: _C.border),
                      ),
                      child: Row(
                        spacing: 10,
                        children: [
                          const AppIcon(
                            AppIcon.clipboard,
                            size: IconSizes.control,
                            color: _C.orange,
                          ),
                          Expanded(
                            child: Text(
                              'Yêu cầu học của tôi',
                              style: nunito(
                                TypeScale.secondary,
                                weight: FontWeight.w700,
                                color: _C.ink,
                              ),
                            ),
                          ),
                          const AppIcon(
                            AppIcon.chevron,
                            size: IconSizes.inline,
                            color: _C.muted,
                          ),
                        ],
                      ),
                    ),
                  ),
                  Wrap(
                    alignment: WrapAlignment.spaceBetween,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    spacing: 12,
                    children: [
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        spacing: 5,
                        children: [
                          Container(
                            width: 5,
                            height: 5,
                            decoration: const BoxDecoration(
                              color: _C.green,
                              shape: BoxShape.circle,
                            ),
                          ),
                          Text.rich(
                            TextSpan(
                              children: [
                                TextSpan(
                                  text: '${requests.length} yêu cầu',
                                  style: const TextStyle(
                                    color: _C.green,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                                const TextSpan(text: ' đang tìm mentor'),
                              ],
                            ),
                            style: secondary,
                          ),
                        ],
                      ),
                      Semantics(
                        expanded: _sortOpen,
                        child: Tappable(
                          semanticLabel: 'Sắp xếp yêu cầu',
                          onTap: () => setState(() => _sortOpen = !_sortOpen),
                          child: SizedBox(
                            height: 28,
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              spacing: 3,
                              children: [
                                Text(
                                  _oldestFirst ? 'Cũ nhất' : 'Mới nhất',
                                  style: secondary,
                                ),
                                Transform.rotate(
                                  angle: 1.5708,
                                  child: const AppIcon(
                                    AppIcon.chevron,
                                    size: IconSizes.inline,
                                    color: _C.muted,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                  if (_sortOpen)
                    Align(
                      alignment: Alignment.centerRight,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        spacing: 4,
                        children: [
                          for (final oldest in const [false, true])
                            Semantics(
                              checked: _oldestFirst == oldest,
                              inMutuallyExclusiveGroup: true,
                              child: Tappable(
                                onTap: () => setState(() {
                                  _oldestFirst = oldest;
                                  _sortOpen = false;
                                }),
                                child: Padding(
                                  padding: const EdgeInsets.all(8),
                                  child: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    spacing: 14,
                                    children: [
                                      Text(
                                        oldest ? 'Cũ nhất' : 'Mới nhất',
                                        style: secondary.copyWith(
                                          color: _oldestFirst == oldest
                                              ? _C.orange
                                              : null,
                                        ),
                                      ),
                                      if (_oldestFirst == oldest)
                                        const AppIcon(
                                          AppIcon.check,
                                          size: 14,
                                          color: _C.orange,
                                        ),
                                    ],
                                  ),
                                ),
                              ),
                            ),
                        ],
                      ),
                    ),
                  if (sorted.isEmpty)
                    EmptyState(
                      title: 'Không tìm thấy yêu cầu học',
                      description: 'Thử kỹ năng khác hoặc bỏ bộ lọc hiện tại.',
                      action: 'Bỏ bộ lọc',
                      onAction: _reset,
                    ),
                  for (final item in sorted)
                    LearningRequestRow(
                      request: item,
                      onTap: () => context.push('/request/${item.id}'),
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

class LearningRequestRow extends StatelessWidget {
  const LearningRequestRow({
    super.key,
    required this.request,
    required this.onTap,
  });

  final LearningRequest request;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final caption = nunito(TypeScale.secondary, color: _C.muted);
    return Tappable(
      pressedOpacity: 0.8,
      semanticLabel: 'Xem yêu cầu: ${request.title}',
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: _C.surface,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: _C.border),
          boxShadow: _cardShadow,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          spacing: 12,
          children: [
            Row(
              spacing: 8,
              children: [
                Avatar(
                  name: request.user,
                  userId: request.userId,
                  size: AvatarSizes.list,
                ),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        request.user,
                        style: nunito(
                          TypeScale.secondary,
                          weight: FontWeight.w600,
                          color: _C.ink,
                        ),
                      ),
                      Text(
                        'Mới đăng · ${request.created}',
                        style: nunito(TypeScale.caption, color: _C.muted),
                      ),
                    ],
                  ),
                ),
                _Pill(
                  label: 'Đang mở',
                  background: _C.greenSoft,
                  color: _C.green,
                  bold: true,
                ),
              ],
            ),
            Text(
              request.title,
              style: nunito(
                TypeScale.body,
                weight: FontWeight.w600,
                color: _C.ink,
              ),
            ),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: [
                for (final tag in request.tags)
                  _Pill(label: tag, background: _C.tag, color: _C.muted),
              ],
            ),
            Wrap(
              alignment: WrapAlignment.spaceBetween,
              crossAxisAlignment: WrapCrossAlignment.center,
              spacing: 8,
              runSpacing: 8,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  spacing: 2,
                  children: [
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      spacing: 4,
                      children: [
                        const AppIcon(
                          AppIcon.calendar,
                          size: IconSizes.inline,
                          color: _C.muted,
                        ),
                        Text('${request.sessions} buổi học', style: caption),
                      ],
                    ),
                    Text(
                      request.budget,
                      style: nunito(
                        TypeScale.secondary,
                        weight: FontWeight.w700,
                        color: _C.orange,
                      ),
                    ),
                  ],
                ),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 8,
                  ),
                  decoration: BoxDecoration(
                    color: _C.orangeSoft,
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(color: const Color(0xFFFFE3D5)),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    spacing: 4,
                    children: [
                      Text(
                        'Xem chi tiết',
                        style: nunito(
                          TypeScale.secondary,
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
    );
  }
}

class _Pill extends StatelessWidget {
  const _Pill({
    required this.label,
    required this.background,
    required this.color,
    this.bold = false,
    this.border,
  });

  final String label;
  final Color background;
  final Color color;
  final bool bold;
  final Color? border;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(4),
        border: border == null ? null : Border.all(color: border!),
      ),
      child: Text(
        label,
        style: nunito(
          TypeScale.caption,
          weight: bold ? FontWeight.w700 : FontWeight.w500,
          color: color,
        ),
      ),
    );
  }
}

class RequestDetailScreen extends ConsumerWidget {
  const RequestDetailScreen({super.key, required this.id});

  final String id;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final request = (ref.watch(learningRequestsProvider).value ?? const <LearningRequest>[])
        .where((item) => item.id == id)
        .firstOrNull;
    final detail = request == null ? null : requestDetails[request.id];
    final caption = nunito(TypeScale.secondary, color: _C.muted);
    final card = BoxDecoration(
      color: _C.surface,
      borderRadius: BorderRadius.circular(8),
      border: Border.all(color: _C.border),
    );
    void openProfile() =>
        context.push('/user/${request!.userId}?requestId=${request.id}');

    return AppScreenLayout(
      title: 'Chi tiết yêu cầu',
      selected: 'Khám phá',
      background: _C.background,
      back: (route: '/discover', label: 'Quay lại yêu cầu học'),
      child: request == null
          ? EmptyState(
              title: 'Không tìm thấy yêu cầu học',
              description: 'Yêu cầu này không có trên máy chủ.',
              action: 'Quay lại khám phá',
              onAction: () => context.go('/discover'),
            )
          : Column(
              children: [
                Expanded(
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
                    children: [
                      Center(
                        child: ConstrainedBox(
                          constraints: const BoxConstraints(maxWidth: 808),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            spacing: 12,
                            children: [
                              _ServerRequest(id: id),
                              Container(
                                padding: const EdgeInsets.all(16),
                                decoration: card,
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.stretch,
                                  spacing: 12,
                                  children: [
                                    Row(
                                      mainAxisAlignment:
                                          MainAxisAlignment.spaceBetween,
                                      children: [
                                        const AppBadge(
                                          label: 'Đang mở',
                                          variant: BadgeVariant.success,
                                        ),
                                        Text(
                                          'Mã: ${request.id}',
                                          style: nunito(
                                            TypeScale.caption,
                                            weight: FontWeight.w500,
                                            color: _C.muted,
                                          ),
                                        ),
                                      ],
                                    ),
                                    Semantics(
                                      header: true,
                                      child: Text(
                                        request.title,
                                        style: nunito(
                                          TypeScale.heading,
                                          weight: FontWeight.w700,
                                          color: _C.ink,
                                        ),
                                      ),
                                    ),
                                    Wrap(
                                      spacing: 6,
                                      runSpacing: 6,
                                      children: [
                                        for (final tag
                                            in detail?.hashtags ??
                                                request.tags.map((t) => '#$t'))
                                          Container(
                                            padding: const EdgeInsets.symmetric(
                                              horizontal: 6,
                                              vertical: 3,
                                            ),
                                            decoration: BoxDecoration(
                                              color: _C.orangeSoft,
                                              borderRadius:
                                                  BorderRadius.circular(4),
                                            ),
                                            child: Text(
                                              tag,
                                              style: nunito(
                                                TypeScale.caption,
                                                weight: FontWeight.w600,
                                                color: _C.orange,
                                              ),
                                            ),
                                          ),
                                      ],
                                    ),
                                    Wrap(
                                      spacing: 8,
                                      runSpacing: 4,
                                      children: [
                                        _MetaItem(
                                          icon: AppIcon.clock,
                                          text: 'Đăng ${request.created}',
                                        ),
                                        _MetaItem(
                                          icon: AppIcon.calendar,
                                          text:
                                              '${request.sessions} buổi${detail != null ? ' · ${detail.duration}' : ''}',
                                        ),
                                      ],
                                    ),
                                  ],
                                ),
                              ),
                              _SkillSection(
                                title: 'Tôi muốn học',
                                icon: AppIcon.book,
                                text: detail?.learning ?? request.goal,
                                tags: detail?.learningTags,
                              ),
                              _SkillSection(
                                title: 'Tôi có thể dạy lại',
                                icon: AppIcon.star,
                                text: detail?.sharing,
                                tags: detail?.sharingTags,
                                teaching: true,
                              ),
                              _ScheduleSection(detail: detail),
                              Container(
                                padding: const EdgeInsets.all(16),
                                decoration: card,
                                child: Row(
                                  spacing: 8,
                                  children: [
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            'NGÂN SÁCH TRAO ĐỔI',
                                            style: nunito(
                                              TypeScale.caption,
                                              weight: FontWeight.w500,
                                              color: _C.muted,
                                            ),
                                          ),
                                          Text.rich(
                                            TextSpan(
                                              text: request.budget
                                                  .split('/')
                                                  .first,
                                              children: [
                                                TextSpan(
                                                  text: ' / lộ trình',
                                                  style: caption,
                                                ),
                                              ],
                                            ),
                                            style: nunito(
                                              TypeScale.title,
                                              weight: FontWeight.w700,
                                              color: _C.orangeDark,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                    Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.end,
                                      children: [
                                        Text('Tổng dự kiến', style: caption),
                                        Text(
                                          request.budget.split('/').first,
                                          style: nunito(
                                            TypeScale.body,
                                            weight: FontWeight.w700,
                                            color: _C.orange,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ],
                                ),
                              ),
                              Tappable(
                                semanticLabel: 'Xem hồ sơ ${request.user}',
                                onTap: openProfile,
                                child: Container(
                                  padding: const EdgeInsets.all(14),
                                  decoration: card,
                                  child: Row(
                                    spacing: 10,
                                    children: [
                                      Avatar(
                                        name: request.user,
                                        userId: request.userId,
                                        size: AvatarSizes.list,
                                      ),
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment:
                                              CrossAxisAlignment.start,
                                          spacing: 2,
                                          children: [
                                            Text(
                                              request.user,
                                              style: nunito(
                                                TypeScale.body,
                                                weight: FontWeight.w700,
                                                color: _C.ink,
                                              ),
                                            ),
                                            Wrap(
                                              spacing: 4,
                                              children: detail != null
                                                  ? [
                                                      Text(
                                                        '${detail.reputation} Reputation',
                                                        style: nunito(
                                                          TypeScale.caption,
                                                          weight:
                                                              FontWeight.w500,
                                                          color: _C.green,
                                                        ),
                                                      ),
                                                      Text(
                                                        detail.memberSince,
                                                        style: caption,
                                                      ),
                                                    ]
                                                  : [
                                                      Text(
                                                        'Thông tin hồ sơ đang được cập nhật.',
                                                        style: caption,
                                                      ),
                                                    ],
                                            ),
                                          ],
                                        ),
                                      ),
                                      const AppIcon(
                                        AppIcon.chevron,
                                        size: IconSizes.control,
                                        color: _C.muted,
                                      ),
                                    ],
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
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 12,
                  ),
                  decoration: const BoxDecoration(
                    color: _C.surface,
                    border: Border(top: BorderSide(color: _C.border)),
                  ),
                  child: SafeArea(
                    top: false,
                    child: Center(
                      child: ConstrainedBox(
                        constraints: const BoxConstraints(maxWidth: 808),
                        child: Row(
                          spacing: 10,
                          children: [
                            Expanded(
                              flex: 10,
                              child: AppButton(
                                variant: ButtonVariant.paper,
                                backgroundColor: _C.tag,
                                minHeight: 40,
                                onPressed: openProfile,
                                child: Text(
                                  'Xem hồ sơ',
                                  style: nunito(
                                    TypeScale.secondary,
                                    weight: FontWeight.w700,
                                    color: _C.body,
                                  ),
                                ),
                              ),
                            ),
                            Expanded(
                              flex: 14,
                              child: AppButton(
                                variant: ButtonVariant.craft,
                                backgroundColor: _C.orangeDark,
                                minHeight: 40,
                                semanticLabel: 'Liên hệ trao đổi',
                                onPressed: () => context.push(
                                  '/send-proposal?requestId=${request.id}',
                                ),
                                child: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  spacing: 6,
                                  children: [
                                    const AppIcon(
                                      AppIcon.message,
                                      size: IconSizes.control,
                                      color: _C.surface,
                                    ),
                                    Text(
                                      'Liên hệ trao đổi',
                                      style: nunito(
                                        TypeScale.secondary,
                                        weight: FontWeight.w600,
                                        color: _C.surface,
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
                  ),
                ),
              ],
            ),
    );
  }
}

class _MetaItem extends StatelessWidget {
  const _MetaItem({required this.icon, required this.text});

  final String icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      spacing: 4,
      children: [
        AppIcon(icon, size: IconSizes.inline, color: _C.muted),
        Text(text, style: nunito(TypeScale.secondary, color: _C.muted)),
      ],
    );
  }
}

const _sectionShadow = [
  BoxShadow(color: Color(0x06352B1F), offset: Offset(0, 2), blurRadius: 8),
];

class _SkillSection extends StatelessWidget {
  const _SkillSection({
    required this.title,
    required this.icon,
    this.text,
    this.tags,
    this.teaching = false,
  });

  final String title;
  final String icon;
  final String? text;
  final List<String>? tags;
  final bool teaching;

  @override
  Widget build(BuildContext context) {
    final tint = teaching ? _C.green : _C.orange;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: teaching ? _C.sharing : _C.surface,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: teaching ? _C.greenSoft : _C.border),
        boxShadow: _sectionShadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        spacing: 12,
        children: [
          _SectionHeading(
            icon: icon,
            title: title,
            tint: tint,
            background: teaching ? _C.greenSoft : _C.orangeSoft,
          ),
          Text(
            text ?? 'Nội dung chi tiết đang được cập nhật.',
            style: nunito(TypeScale.body, color: _C.body),
          ),
          if (tags?.isNotEmpty ?? false)
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: [
                for (final tag in tags!)
                  _Pill(
                    label: tag,
                    background: teaching ? _C.greenSoft : _C.tag,
                    color: teaching ? _C.green : _C.body,
                  ),
              ],
            ),
        ],
      ),
    );
  }
}

class _SectionHeading extends StatelessWidget {
  const _SectionHeading({
    required this.icon,
    required this.title,
    required this.tint,
    required this.background,
    this.titleColor,
  });

  final String icon;
  final String title;
  final Color tint;
  final Color background;
  final Color? titleColor;

  @override
  Widget build(BuildContext context) {
    return Row(
      spacing: 8,
      children: [
        Container(
          width: 32,
          height: 32,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: background,
            borderRadius: BorderRadius.circular(6),
          ),
          child: AppIcon(icon, size: IconSizes.control, color: tint, filled: false),
        ),
        Text(
          title,
          style: nunito(
            TypeScale.body,
            weight: FontWeight.w700,
            color: titleColor ?? tint,
          ),
        ),
      ],
    );
  }
}

class _ScheduleSection extends StatelessWidget {
  const _ScheduleSection({required this.detail});

  final RequestDetailContent? detail;

  @override
  Widget build(BuildContext context) {
    final detail = this.detail;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: _C.surface,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: _C.border),
        boxShadow: _sectionShadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        spacing: 12,
        children: [
          const _SectionHeading(
            icon: AppIcon.calendar,
            title: 'Lịch rảnh',
            tint: _C.purple,
            background: _C.purpleSoft,
            titleColor: _C.ink,
          ),
          if (detail == null)
            Text(
              'Lịch rảnh đang được cập nhật.',
              style: nunito(TypeScale.body, color: _C.body),
            )
          else ...[
            for (final row in detail.schedule)
              Row(
                spacing: 8,
                children: [
                  SizedBox(
                    width: 58,
                    child: Text(
                      row.day,
                      style: nunito(
                        TypeScale.secondary,
                        weight: FontWeight.w600,
                        color: _C.body,
                      ),
                    ),
                  ),
                  Expanded(
                    child: Wrap(
                      spacing: 6,
                      runSpacing: 6,
                      children: [
                        for (final slot in row.slots)
                          _Pill(
                            label: slot,
                            background: _C.tag,
                            color: _C.body,
                            border: _C.border,
                          ),
                      ],
                    ),
                  ),
                ],
              ),
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                spacing: 6,
                children: [
                  const AppIcon(
                    AppIcon.clock,
                    size: IconSizes.inline,
                    color: _C.muted,
                  ),
                  Expanded(
                    child: Text(
                      detail.scheduleNote,
                      style: nunito(TypeScale.caption, color: _C.muted),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _ServerRequest extends ConsumerWidget {
  const _ServerRequest({required this.id});

  final String id;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final detail = ref.watch(serverRequestProvider(id));
    final description = detail.value?['description']?.toString() ?? '';
    if (detail.isLoading || description.isEmpty) return const SizedBox.shrink();
    return Text(description, style: nunito(TypeScale.body, color: _C.body));
  }
}
