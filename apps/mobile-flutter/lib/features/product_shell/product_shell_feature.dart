import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../components/app_button.dart';
import '../../components/avatar.dart';
import '../../components/feature_page.dart';
import '../../components/misc.dart';
import '../../core/theme/tokens.dart';
import '../auth/session/auth_session.dart';
import '../discovery/discovery_data.dart';
import '../profile/public_profiles_data.dart';
import '../remote/remote_load.dart';
import '../shell/inbox_count.dart';
import 'schema/notification_schema.dart';

class PreviewNotification {
  const PreviewNotification({
    required this.id,
    required this.title,
    required this.body,
    required this.group,
    required this.href,
    this.read = false,
  });

  final String id;
  final String title;
  final String body;
  final String group;
  final String href;
  final bool read;

  PreviewNotification markRead() => PreviewNotification(
    id: id,
    title: title,
    body: body,
    group: group,
    href: href,
    read: true,
  );
}

const _notificationGroups = ['Học tập', 'Credit', 'Cộng đồng'];

PreviewNotification _notification(NotificationRecord record) => PreviewNotification(
  id: record.id,
  title: record.title,
  body: record.body,
  group: 'Học tập',
  href: '/notifications',
  read: record.readAt != null,
);

typedef ProductPreview = ({
  List<PreviewNotification> notifications,
  List<String> enabled,
  List<String> interests,
  String timezone,
  String language,
});

class ProductPreviewNotifier extends Notifier<ProductPreview> {
  var _ticket = 0;

  @override
  ProductPreview build() {
    final phase = ref.watch(sessionSnapshotProvider).phase;
    final userId = ref.watch(accountProvider).value?.userId;
    if (phase == SessionPhase.ready && userId != null) {
      _ticket++;
      _loadNotifications(_ticket);
    }
    return (
      notifications: const [],
      enabled: _notificationGroups,
      interests: const [],
      timezone: 'Asia/Ho_Chi_Minh',
      language: 'Tiếng Việt',
    );
  }

  Future<void> _loadNotifications(int ticket) async {
    try {
      final records = await drainPages(
        (cursor) => ref
            .read(authRuntimeProvider)
            .services
            .notifications
            .list(cursor: cursor, limit: 50),
      );
      if (!ref.mounted || ticket != _ticket) return;
      final items = [for (final record in records) _notification(record)];
      _set(notifications: items);
      ref.read(inboxCountProvider.notifier).setCount(
        items.where((item) => !item.read).length,
      );
    } catch (_) {}
  }

  void _set({
    List<PreviewNotification>? notifications,
    List<String>? enabled,
    List<String>? interests,
    String? timezone,
    String? language,
  }) => state = (
    notifications: notifications ?? state.notifications,
    enabled: enabled ?? state.enabled,
    interests: interests ?? state.interests,
    timezone: timezone ?? state.timezone,
    language: language ?? state.language,
  );

  Future<void> read([String? id]) async {
    final targets = [
      for (final item in state.notifications)
        if (!item.read && (id == null || item.id == id)) item.id,
    ];
    final next = [
      for (final n in state.notifications)
        id == null || n.id == id ? n.markRead() : n,
    ];
    _set(notifications: next);
    ref
        .read(inboxCountProvider.notifier)
        .setCount(next.where((item) => !item.read).length);
    final api = ref.read(authRuntimeProvider).services.notifications;
    for (final notificationId in targets) {
      try {
        await api.markRead(notificationId);
      } catch (_) {}
    }
  }

  void toggleGroup(String group) => _set(
    enabled: state.enabled.contains(group)
        ? state.enabled.where((g) => g != group).toList()
        : [...state.enabled, group],
  );

  void toggleInterest(String skill) => _set(
    interests: state.interests.contains(skill)
        ? state.interests.where((s) => s != skill).toList()
        : [...state.interests, skill],
  );

  void setTimezone(String value) => _set(timezone: value);
  void setLanguage(String value) => _set(language: value);
}

final productPreviewProvider =
    NotifierProvider<ProductPreviewNotifier, ProductPreview>(
      ProductPreviewNotifier.new,
    );

bool _matches(String text, String query) =>
    text.toLowerCase().contains(query.toLowerCase());

Iterable<LearningRequest> _searchRequests(
  List<LearningRequest> requests,
  String query,
) => requests.where((r) => _matches('${r.title} ${r.tags.join(' ')}', query));

class NotificationsScreen extends ConsumerStatefulWidget {
  const NotificationsScreen({super.key});

  @override
  ConsumerState<NotificationsScreen> createState() =>
      _NotificationsScreenState();
}

class _NotificationsScreenState extends ConsumerState<NotificationsScreen> {
  var _filter = 'Tất cả';

  @override
  Widget build(BuildContext context) {
    final preview = ref.watch(productPreviewProvider);
    final notifier = ref.read(productPreviewProvider.notifier);
    final items = preview.notifications.where(
      (n) =>
          preview.enabled.contains(n.group) && (_filter == 'Tất cả' || !n.read),
    );
    return FeaturePage(
      title: 'Thông báo',
      back: '/home',
      children: [
        ChoiceGroup(
          label: 'Hiển thị',
          options: const ['Tất cả', 'Chưa đọc'],
          value: _filter,
          onChange: (value) => setState(() => _filter = value),
        ),
        AppButton(
          label: 'Đánh dấu tất cả đã đọc',
          variant: ButtonVariant.paper,
          onPressed: notifier.read,
        ),
        for (final n in items)
          Panel(
            title: n.title,
            children: [
              StatusBadge(n.read ? 'Đã đọc' : 'Mới'),
              Copy(n.body),
              AppButton(
                label: 'Xem nội dung liên quan',
                variant: ButtonVariant.paper,
                onPressed: () {
                  notifier.read(n.id);
                  context.push(n.href);
                },
              ),
            ],
          ),
        if (items.isEmpty)
          const EmptyState(
            title: 'Không có thông báo',
            description: 'Bạn đã xem hết hoặc nhóm thông báo này đã tắt trong bản xem thử.',
          ),
        const RouteButton(
          secondary: true,
          href: '/preferences/notifications',
          label: 'Tùy chỉnh thông báo mẫu',
        ),
      ],
    );
  }
}

class SearchScreen extends ConsumerStatefulWidget {
  const SearchScreen({super.key});

  @override
  ConsumerState<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends ConsumerState<SearchScreen> {
  var _query = '';
  var _tab = 'Người chia sẻ';
  var _verified = false;

  @override
  Widget build(BuildContext context) {
    final users = const <DemoPublicProfile>[];
    final requests = _searchRequests(
      ref.watch(learningRequestsProvider).value ?? const [],
      _query,
    ).toList();
    return FeaturePage(
      title: 'Tìm kiếm',
      back: '/home',
      subtitle: 'Kết nối với người có kỹ năng bạn muốn học.',
      children: [
        SimpleInput(
          label: 'Tên người hoặc kỹ năng',
          onChanged: (value) => setState(() => _query = value),
        ),
        ChoiceGroup(
          label: 'Tìm trong',
          options: const ['Người chia sẻ', 'Yêu cầu học'],
          value: _tab,
          onChange: (value) => setState(() => _tab = value),
        ),
        if (_tab == 'Người chia sẻ') ...[
          AppButton(
            label: _verified
                ? 'Đang lọc: đã xác minh'
                : 'Chỉ kỹ năng đã xác minh',
            variant: ButtonVariant.paper,
            onPressed: () => setState(() => _verified = !_verified),
          ),
          for (final p in users)
            Panel(
              title: p.name,
              children: [
                Align(
                  alignment: Alignment.centerLeft,
                  child: Avatar(name: p.name, userId: p.id, size: 48),
                ),
                Copy(
                  p.skills
                      .map(
                        (s) =>
                            '${s.name}${s.verified ? ' · đã xác minh' : ' · chưa xác minh'}',
                      )
                      .join('\n'),
                ),
                RouteButton(
                  secondary: true,
                  href: '/user/${p.id}',
                  label: 'Xem hồ sơ',
                ),
                RouteButton(
                  href: '/send-proposal?userId=${p.id}',
                  label: 'Gửi lời mời trao đổi',
                ),
              ],
            ),
          if (users.isEmpty)
            const EmptyState(
              title: 'Không tìm thấy người chia sẻ',
              description: 'Thử kỹ năng khác hoặc tắt bộ lọc xác minh.',
            ),
        ] else ...[
          for (final r in requests)
            Panel(
              title: r.title,
              children: [
                Copy('${r.user} · ${r.tags.join(', ')}'),
                RouteButton(
                  secondary: true,
                  href: '/request/${r.id}',
                  label: 'Xem yêu cầu',
                ),
              ],
            ),
          if (requests.isEmpty)
            const EmptyState(
              title: 'Không tìm thấy yêu cầu',
              description: 'Thử từ khóa khác.',
            ),
        ],
      ],
    );
  }
}

const _onboardingTitles = [
  'Chào mừng bạn',
  'Bạn muốn học gì?',
  'Bạn có thể chia sẻ gì?',
  'Sẵn sàng kết nối',
];

class OnboardingScreen extends ConsumerStatefulWidget {
  const OnboardingScreen({super.key});

  @override
  ConsumerState<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends ConsumerState<OnboardingScreen> {
  var _step = 0;

  @override
  Widget build(BuildContext context) {
    final interests = ref.watch(
      productPreviewProvider.select((p) => p.interests),
    );
    return FeaturePage(
      title: 'Bắt đầu với SkillHub',
      back: '/home',
      children: [
        Panel(
          title: _onboardingTitles[_step],
          children: [
            Copy('Bước ${_step + 1}/4'),
            if (_step == 0) ...const [
              Copy(
                'Mỗi người đều có điều đáng để chia sẻ. Hoàn thiện hồ sơ để cộng đồng hiểu bạn hơn.',
              ),
              RouteButton(
                secondary: true,
                href: '/edit-profile',
                label: 'Hoàn thiện hồ sơ của tôi',
              ),
            ],
            if (_step == 1) ...[
              const Copy('Chọn mối quan tâm cho bản xem thử.'),
              for (final skill in const [
                'React',
                'UI/UX',
                'Tiếng Anh',
                'Guitar',
                'Nhiếp ảnh',
              ])
                AppButton(
                  label: '${interests.contains(skill) ? '✓ ' : ''}$skill',
                  variant: interests.contains(skill)
                      ? ButtonVariant.craft
                      : ButtonVariant.paper,
                  onPressed: () => ref
                      .read(productPreviewProvider.notifier)
                      .toggleInterest(skill),
                ),
            ],
            if (_step == 2) ...const [
              Copy(
                'Thêm kỹ năng và gửi bằng chứng nếu muốn xác minh. Kỹ năng chưa xác minh được ghi nhãn rõ ràng.',
              ),
              RouteButton(href: '/skills/new', label: 'Thêm kỹ năng mẫu'),
            ],
            if (_step == 3) ...const [
              Copy(
                'Khám phá yêu cầu học, trao đổi đề xuất và thống nhất từng kế hoạch trước khi chốt lịch.',
              ),
              RouteButton(href: '/search', label: 'Tìm người chia sẻ'),
              RouteButton(
                secondary: true,
                href: '/home',
                label: 'Về trang chủ',
              ),
            ],
            if (_step < 3)
              AppButton(
                label: 'Tiếp tục',
                onPressed: () => setState(() => _step++),
              ),
            if (_step > 0)
              AppButton(
                label: 'Bước trước',
                variant: ButtonVariant.paper,
                onPressed: () => setState(() => _step--),
              ),
          ],
        ),
      ],
    );
  }
}

const _faqs = [
  (
    'Chấp nhận đề xuất đã chốt lịch chưa?',
    'Chấp nhận chỉ mở cuộc trao đổi. Hai bên vẫn cần tạo kế hoạch, xác nhận kế hoạch, điều khoản và từng lịch trước khi khóa lịch.',
  ),
  (
    'Trao đổi hai chiều cần mấy kế hoạch?',
    'Hai kế hoạch đối ứng. Mỗi người tự tạo kế hoạch cho kỹ năng mình dạy, người học xác nhận phiên bản hiện tại.',
  ),
  (
    'Khi nào Credit được quyết toán?',
    'Sau khi tất cả buổi học trong thỏa thuận hoàn thành và không có tranh chấp giữ quyết toán. Hoàn thành một buổi chưa quyết toán.',
  ),
  (
    'Tôi có thể đổi lịch không?',
    'Hai bên phải cùng xác nhận lịch mới ít nhất 60 phút trước giờ bắt đầu của lịch cũ. Nếu chưa đủ xác nhận, lịch cũ giữ nguyên.',
  ),
  (
    'Có thể rút Credit không?',
    'SkillHub chưa hỗ trợ rút hoặc quy đổi Credit thành tiền. Credit dùng cho học tập và tài liệu trên nền tảng.',
  ),
  (
    'Bằng chứng xác minh có công khai không?',
    'Người xem hồ sơ chỉ thấy trạng thái xác minh. Tệp bằng chứng riêng tư không được công khai.',
  ),
];

class HelpScreen extends StatefulWidget {
  const HelpScreen({super.key});

  @override
  State<HelpScreen> createState() => _HelpScreenState();
}

class _HelpScreenState extends State<HelpScreen> {
  var _search = '';
  String? _expanded;

  @override
  Widget build(BuildContext context) {
    return FeaturePage(
      title: 'Trung tâm trợ giúp',
      back: '/profile',
      demo: false,
      children: [
        SimpleInput(
          label: 'Tìm câu hỏi',
          onChanged: (value) => setState(() => _search = value),
        ),
        for (final (q, a) in _faqs)
          if (_matches('$q $a', _search))
            Panel(
              children: [
                AppButton(
                  label: q,
                  variant: ButtonVariant.paper,
                  onPressed: () =>
                      setState(() => _expanded = _expanded == q ? null : q),
                ),
                if (_expanded == q) Copy(a),
              ],
            ),
        const RouteButton(
          secondary: true,
          href: '/reports',
          label: 'Theo dõi báo cáo',
        ),
        const RouteButton(
          secondary: true,
          href: '/policies',
          label: 'Quyền riêng tư & nguyên tắc sử dụng',
        ),
      ],
    );
  }
}

class PreferencesScreen extends ConsumerWidget {
  const PreferencesScreen({super.key, required this.section});

  final String section;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (section == 'timezone' || section == 'language') {
      return LocalePreviewScreen(timezone: section == 'timezone');
    }
    if (section != 'notifications' && section != 'privacy') {
      return const FeaturePage(
        title: 'Tùy chọn',
        back: '/account-settings',
        children: [Copy('Không tìm thấy mục cài đặt này.')],
      );
    }
    final enabled = ref.watch(productPreviewProvider.select((p) => p.enabled));
    final notifications = section == 'notifications';
    return FeaturePage(
      title: notifications ? 'Tùy chỉnh thông báo' : 'Quyền riêng tư',
      back: '/account-settings',
      children: [
        if (notifications)
          Panel(
            title: 'Nhóm thông báo trong bản xem thử',
            children: [
              for (final group in _notificationGroups)
                AppButton(
                  label:
                      '$group: ${enabled.contains(group) ? 'Đang bật' : 'Đã tắt'}',
                  variant: ButtonVariant.paper,
                  onPressed: () => ref
                      .read(productPreviewProvider.notifier)
                      .toggleGroup(group),
                ),
              const Copy(
                'Lựa chọn này chỉ lọc trung tâm thông báo mẫu; không thay đổi email hoặc push thực tế.',
                muted: true,
              ),
              const RouteButton(
                href: '/notifications',
                label: 'Xem trung tâm thông báo',
              ),
            ],
          )
        else
          const Panel(
            title: 'Bạn quyết định điều mình chia sẻ',
            children: [
              Copy(
                'Email đăng nhập, thông tin thanh toán, bằng chứng và tệp tài liệu riêng tư không được hiển thị trên hồ sơ công khai.',
              ),
              RouteButton(
                href: '/skills',
                label: 'Quản lý hiển thị kỹ năng mẫu',
              ),
              RouteButton(
                secondary: true,
                href: '/profile',
                label: 'Xem hồ sơ của tôi',
              ),
            ],
          ),
      ],
    );
  }
}

const _timezones = [
  'Asia/Ho_Chi_Minh',
  'Asia/Tokyo',
  'UTC',
  'Europe/London',
  'America/New_York',
];

DateTime _nthSunday(int year, int month, int nth) {
  final first = DateTime.utc(year, month);
  return first.add(Duration(days: (7 - first.weekday) % 7 + (nth - 1) * 7));
}

DateTime _lastSunday(int year, int month) {
  final last = DateTime.utc(year, month + 1, 0);
  return last.subtract(Duration(days: last.weekday % 7));
}

/// Fixed offsets plus the current EU/US daylight-saving rules; Dart has no
/// IANA zone database without an extra package.
Duration _zoneOffset(String zone, DateTime utc) {
  final year = utc.year;
  switch (zone) {
    case 'Asia/Ho_Chi_Minh':
      return const Duration(hours: 7);
    case 'Asia/Tokyo':
      return const Duration(hours: 9);
    case 'Europe/London':
      final start = _lastSunday(year, 3).add(const Duration(hours: 1));
      final end = _lastSunday(year, 10).add(const Duration(hours: 1));
      return Duration(hours: !utc.isBefore(start) && utc.isBefore(end) ? 1 : 0);
    case 'America/New_York':
      final start = _nthSunday(year, 3, 2).add(const Duration(hours: 7));
      final end = _nthSunday(year, 11, 1).add(const Duration(hours: 6));
      return Duration(
        hours: !utc.isBefore(start) && utc.isBefore(end) ? -4 : -5,
      );
    default:
      return Duration.zero;
  }
}

const _weekdays = [
  'Thứ Hai',
  'Thứ Ba',
  'Thứ Tư',
  'Thứ Năm',
  'Thứ Sáu',
  'Thứ Bảy',
  'Chủ Nhật',
];

String _zonedFull(String zone, DateTime now) {
  final d = now.toUtc().add(_zoneOffset(zone, now.toUtc()));
  String two(int v) => v.toString().padLeft(2, '0');
  return '${_weekdays[d.weekday - 1]}, ${d.day} tháng ${d.month}, ${d.year} '
      'lúc ${two(d.hour)}:${two(d.minute)}';
}

class LocalePreviewScreen extends ConsumerWidget {
  const LocalePreviewScreen({super.key, required this.timezone});

  final bool timezone;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final preview = ref.watch(productPreviewProvider);
    final notifier = ref.read(productPreviewProvider.notifier);
    return FeaturePage(
      title: timezone ? 'Múi giờ' : 'Ngôn ngữ',
      back: '/account-settings',
      children: [
        Panel(
          title: timezone ? 'Giờ hiển thị mẫu' : 'Lựa chọn ngôn ngữ mẫu',
          children: [
            ChoiceGroup(
              label: timezone ? 'Múi giờ' : 'Ngôn ngữ',
              value: timezone ? preview.timezone : preview.language,
              options: timezone ? _timezones : const ['Tiếng Việt', 'English'],
              onChange: timezone ? notifier.setTimezone : notifier.setLanguage,
            ),
            if (timezone) Copy(_zonedFull(preview.timezone, DateTime.now())),
            Copy(
              timezone
                  ? 'Lựa chọn chỉ thay đổi đồng hồ mẫu ở màn hình này. Các lịch xem thử vẫn theo múi giờ thiết bị; cấu hình tài khoản thật cần API.'
                  : 'Lựa chọn được giữ trong phiên xem thử. Giao diện hiện dùng tiếng Việt; bản dịch English và đồng bộ tùy chọn cần triển khai khi có yêu cầu bản địa hóa.',
              muted: true,
            ),
          ],
        ),
      ],
    );
  }
}

class PoliciesScreen extends StatelessWidget {
  const PoliciesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const FeaturePage(
      title: 'Quyền riêng tư & sử dụng',
      back: '/help',
      demo: false,
      children: [
        Panel(
          title: 'Thông tin công khai',
          children: [
            Copy(
              'Tên hiển thị, avatar, bio, uy tín, danh hiệu đã chọn và kỹ năng chia sẻ có thể xuất hiện trên hồ sơ. Email, thông tin thanh toán và bằng chứng riêng tư không công khai.',
            ),
          ],
        ),
        Panel(
          title: 'Trao đổi có trách nhiệm',
          children: [
            Copy(
              'Thống nhất nội dung và lịch bằng các nút xác nhận đúng phiên bản. Tôn trọng đối tác, quyền phân phối tài liệu và báo cáo vấn đề có căn cứ.',
            ),
          ],
        ),
        Panel(
          title: 'Credit',
          children: [
            Copy(
              '1.000 VND = 1 Credit. Không hỗ trợ rút tiền. Quyết toán cuối lộ trình theo hình thức học; tranh chấp có thể giữ việc quyết toán.',
            ),
          ],
        ),
        Copy(
          'Nội dung này tóm tắt nguyên tắc sản phẩm trong SRS 1.6. Điều khoản pháp lý và chính sách lưu giữ dữ liệu chính thức cần được cung cấp trước khi phát hành.',
          muted: true,
        ),
      ],
    );
  }
}

class _PublicPage extends StatelessWidget {
  const _PublicPage({required this.title, required this.children});

  final String title;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.canvas,
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                spacing: 12,
                children: [
                  const BrandLogo(small: true),
                  AppButton(
                    label: 'Quay lại',
                    variant: ButtonVariant.paper,
                    onPressed: () =>
                        context.canPop() ? context.pop() : context.go('/'),
                  ),
                ],
              ),
            ),
            Expanded(
              child: ListView(
                keyboardDismissBehavior:
                    ScrollViewKeyboardDismissBehavior.onDrag,
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 36),
                children: [
                  Center(
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 860),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        spacing: 16,
                        children: [
                          Semantics(
                            header: true,
                            child: Text(
                              title,
                              style: fraunces(28, 36, color: AppColors.ink),
                            ),
                          ),
                          const Copy(
                            'Đăng nhập để bắt đầu trao đổi.',
                            muted: true,
                          ),
                          ...children,
                        ],
                      ),
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

class PublicExploreScreen extends ConsumerStatefulWidget {
  const PublicExploreScreen({super.key, this.query = ''});

  final String query;

  @override
  ConsumerState<PublicExploreScreen> createState() =>
      _PublicExploreScreenState();
}

class _PublicExploreScreenState extends ConsumerState<PublicExploreScreen> {
  late var _search = widget.query;
  var _tab = 'Người chia sẻ';

  @override
  Widget build(BuildContext context) {
    final profiles = const <DemoPublicProfile>[];
    final requests = _searchRequests(
      ref.watch(learningRequestsProvider).value ?? const [],
      _search,
    ).toList();
    final sharers = _tab == 'Người chia sẻ';
    return _PublicPage(
      title: 'Khám phá cộng đồng',
      children: [
        SimpleInput(
          label: 'Tìm kỹ năng',
          value: widget.query,
          onChanged: (value) => setState(() => _search = value),
        ),
        ChoiceGroup(
          label: 'Khám phá',
          options: const ['Người chia sẻ', 'Yêu cầu học'],
          value: _tab,
          onChange: (value) => setState(() => _tab = value),
        ),
        if (sharers)
          for (final p in profiles)
            Panel(
              title: p.name,
              children: [
                Copy(p.skills.map((s) => s.name).join(', ')),
                RouteButton(
                  secondary: true,
                  href: '/explore/profiles/${p.id}',
                  label: 'Xem hồ sơ công khai',
                ),
              ],
            )
        else
          for (final r in requests)
            Panel(
              title: r.title,
              children: [
                Copy('${r.user} · ${r.tags.join(', ')}'),
                RouteButton(
                  secondary: true,
                  href: '/explore/requests/${r.id}',
                  label: 'Xem nhu cầu học',
                ),
              ],
            ),
        if (sharers ? profiles.isEmpty : requests.isEmpty)
          const EmptyState(
            title: 'Không tìm thấy kết quả',
            description: 'Thử kỹ năng hoặc từ khóa khác.',
          ),
        const RouteButton(href: '/login', label: 'Đăng nhập để trao đổi'),
      ],
    );
  }
}

class PublicGuestProfileScreen extends ConsumerWidget {
  const PublicGuestProfileScreen({super.key, required this.userId});

  final String userId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final signedIn = ref.watch(accountSessionProvider) != null;
    final profile = ref.watch(publicProfileProvider(userId)).value;
    return _PublicPage(
      title: 'Hồ sơ công khai',
      children: [
        if (profile == null)
          const EmptyState(
            title: 'Không tìm thấy người chia sẻ',
            description: 'Hồ sơ không có trong dữ liệu mẫu.',
          )
        else
          Panel(
            title: profile.name,
            children: [
              Copy(profile.bio ?? 'Người chia sẻ chưa thêm giới thiệu.'),
              Copy('Uy tín: ${profile.reputation ?? 'Chưa có thông tin'}'),
              for (final s in profile.skills)
                Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  spacing: 6,
                  children: [
                    Copy('${s.name} · ${s.level}'),
                    StatusBadge(s.verified ? 'Đã xác minh' : 'Chưa xác minh'),
                  ],
                ),
              RouteButton(
                href: signedIn ? '/send-proposal?userId=$userId' : '/login',
                label: signedIn
                    ? 'Gửi lời mời trao đổi'
                    : 'Đăng nhập để gửi lời mời',
              ),
            ],
          ),
      ],
    );
  }
}

class PublicGuestRequestScreen extends ConsumerWidget {
  const PublicGuestRequestScreen({super.key, required this.id});

  final String id;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final signedIn = ref.watch(accountSessionProvider) != null;
    final request = (ref.watch(learningRequestsProvider).value ?? const [])
        .where((r) => r.id == id)
        .firstOrNull;
    return _PublicPage(
      title: 'Nhu cầu học tập',
      children: [
        if (request == null)
          const EmptyState(
            title: 'Yêu cầu không khả dụng',
            description: 'Yêu cầu này không có trên máy chủ.',
          )
        else
          Panel(
            title: request.title,
            children: [
              const StatusBadge('Đang mở'),
              Copy('${request.user} · ${request.tags.join(', ')}'),
              Copy('${request.sessions} buổi gợi ý · ${request.budget}'),
              const Copy(
                'Người học đang tìm người chia sẻ phù hợp để thương lượng nội dung và lịch học.',
              ),
              RouteButton(
                secondary: true,
                href: '/explore/profiles/${request.userId}',
                label: 'Xem người đăng',
              ),
              RouteButton(
                href: signedIn ? '/send-proposal?requestId=$id' : '/login',
                label: signedIn ? 'Gửi đề xuất' : 'Đăng nhập để gửi đề xuất',
              ),
            ],
          ),
      ],
    );
  }
}
