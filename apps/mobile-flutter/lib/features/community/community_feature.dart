import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../components/app_button.dart';
import '../../components/feature_page.dart';
import '../../components/misc.dart';
import '../auth/session/auth_session.dart';
import '../learning_paths/paths_data.dart';

class SelectedBadgeNotifier extends Notifier<String> {
  @override
  String build() {
    ref.watch(sessionSnapshotProvider.select((s) => s.generation));
    return 'Người mới gia nhập';
  }

  void select(String value) => state = value;
}

final selectedBadgeProvider = NotifierProvider<SelectedBadgeNotifier, String>(
  SelectedBadgeNotifier.new,
);

class ReviewEditorScreen extends ConsumerWidget {
  const ReviewEditorScreen({super.key, required this.id});

  final String id;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    ref.watch(pathsProvider);
    final notifier = ref.read(pathsProvider.notifier);
    final path = notifier.find(id);
    return FeaturePage(
      title: 'Đánh giá cuối lộ trình',
      back: '/paths/$id',
      children: [
        if (path == null || path.status != 'COMPLETED')
          const EmptyState(
            title: 'Chưa thể đánh giá',
            description: 'Đánh giá chỉ mở sau khi toàn bộ lộ trình hoàn thành.',
          )
        else if (path.reviewed)
          Panel(
            title: 'Đã gửi đánh giá mẫu',
            children: [
              Copy('${path.review?.rating}/5 sao · ${path.review?.comment}'),
              const Copy(
                'Mỗi người đánh giá đối tác một lần cho mỗi lộ trình.',
                muted: true,
              ),
            ],
          )
        else
          Panel(
            title: 'Chia sẻ trải nghiệm với ${path.partner}',
            children: [
              DataForm(
                fields: [
                  DataField(
                    name: 'rating',
                    label: 'Đánh giá của bạn',
                    rule: (v) =>
                        RegExp(r'^[1-5]$').hasMatch(v) ? null : 'Chọn 1–5 sao.',
                    choices: const ['1', '2', '3', '4', '5'],
                  ),
                  DataField(
                    name: 'comment',
                    label: 'Điều bạn muốn chia sẻ',
                    rule: textRule(0, 1000),
                    multiline: true,
                  ),
                ],
                submitLabel: 'Gửi đánh giá mẫu',
                onSubmit: (v) {
                  notifier.save(
                    path.copyWith(
                      reviewed: true,
                      review: (
                        rating: int.parse(v['rating']!),
                        comment: v['comment']!,
                      ),
                    ),
                  );
                  return null;
                },
              ),
              const Copy(
                'Điểm uy tín và Credit thưởng, nếu có, do hệ thống quyết định. Bản xem thử không tự cộng điểm.',
                muted: true,
              ),
            ],
          ),
      ],
    );
  }
}

class ReviewsScreen extends ConsumerStatefulWidget {
  const ReviewsScreen({super.key});

  @override
  ConsumerState<ReviewsScreen> createState() => _ReviewsScreenState();
}

class _ReviewsScreenState extends ConsumerState<ReviewsScreen> {
  String _tab = 'Tôi đánh giá';

  @override
  Widget build(BuildContext context) {
    final items = ref
        .watch(pathsProvider)
        .where((p) => p.status == 'COMPLETED')
        .toList();
    final mine = _tab == 'Tôi đánh giá';
    return FeaturePage(
      title: 'Đánh giá',
      back: '/profile',
      children: [
        ChoiceGroup(
          label: 'Đánh giá lộ trình',
          options: const ['Tôi đánh giá', 'Đánh giá nhận được'],
          value: _tab,
          onChange: (value) => setState(() => _tab = value),
        ),
        if (!mine)
          const Panel(
            title: 'Hồng Anh · lộ trình trao đổi đã hoàn tất',
            children: [
              StatusBadge('5/5 sao', variant: BadgeVariant.success),
              Copy('Bạn chuẩn bị nội dung rõ ràng và trao đổi rất dễ hiểu.'),
              Copy(
                'Đánh giá nhận được là dữ liệu mẫu, không thay đổi điểm uy tín tài khoản.',
                muted: true,
              ),
            ],
          )
        else
          for (final p in items)
            Panel(
              title: p.title,
              children: [
                Copy(p.partner),
                Copy(
                  p.reviewed
                      ? 'Bạn đã đánh giá ${p.review?.rating}/5 sao: ${p.review?.comment}'
                      : 'Bạn chưa đánh giá lộ trình này.',
                ),
                RouteButton(
                  secondary: true,
                  href: '/paths/${p.id}/review',
                  label: p.reviewed ? 'Xem đánh giá' : 'Viết đánh giá',
                ),
              ],
            ),
        if (mine && items.isEmpty)
          const EmptyState(
            title: 'Chưa có lộ trình để đánh giá',
            description: 'Hoàn thành lộ trình để chia sẻ trải nghiệm.',
          ),
      ],
    );
  }
}

const _badges = [
  ('Người mới gia nhập', 'Email đã xác minh và tài khoản ACTIVE.', true),
  ('Bước đầu trao đổi', 'Hoàn thành lộ trình đầu tiên.', true),
  ('Người học tích cực', 'Hoàn thành 5 lộ trình.', false),
  (
    'Người chia sẻ tích cực',
    'Hoàn thành 10 lộ trình có vai trò chia sẻ.',
    false,
  ),
  ('Thành viên uy tín', 'Uy tín ≥70 và ít nhất 5 lộ trình hoàn thành.', false),
  (
    'Người lâu năm',
    'Tài khoản ≥180 ngày và ít nhất 10 lộ trình hoàn thành.',
    false,
  ),
  ('Kỹ năng đã xác minh', 'Ít nhất 3 kỹ năng chia sẻ đã xác minh.', false),
];

class AchievementsScreen extends ConsumerStatefulWidget {
  const AchievementsScreen({super.key});

  @override
  ConsumerState<AchievementsScreen> createState() => _AchievementsScreenState();
}

class _AchievementsScreenState extends ConsumerState<AchievementsScreen> {
  String? _detail;

  @override
  Widget build(BuildContext context) {
    final badge = ref.watch(selectedBadgeProvider);
    final notifier = ref.read(selectedBadgeProvider.notifier);
    return FeaturePage(
      title: 'Thành tích & danh hiệu',
      back: '/profile',
      children: [
        Panel(
          title: 'Danh hiệu mẫu đang chọn',
          accent: true,
          children: [
            Copy(badge.isEmpty ? 'Không hiển thị danh hiệu' : badge),
            AppButton(
              label: 'Ẩn danh hiệu mẫu',
              variant: ButtonVariant.paper,
              onPressed: () => notifier.select(''),
            ),
          ],
        ),
        for (final (name, condition, unlocked) in _badges)
          Panel(
            title: name,
            children: [
              StatusBadge(
                unlocked ? 'Đã mở trong kịch bản mẫu' : 'Chưa đạt mốc',
              ),
              Copy(condition),
              AppButton(
                label: 'Xem điều kiện',
                variant: ButtonVariant.paper,
                onPressed: () =>
                    setState(() => _detail = _detail == name ? null : name),
              ),
              if (_detail == name)
                const Copy(
                  'Tiến độ mẫu: đã hoàn thành 1 lộ trình, 1 kỹ năng xác minh và uy tín 50/100. Mốc chính thức lấy từ hồ sơ thành tích.',
                  muted: true,
                ),
              AppButton(
                label: badge == name ? 'Đang chọn' : 'Chọn danh hiệu mẫu',
                disabled: !unlocked || badge == name,
                onPressed: () => notifier.select(name),
              ),
            ],
          ),
      ],
    );
  }
}

class ReputationScreen extends StatelessWidget {
  const ReputationScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const FeaturePage(
      title: 'Điểm uy tín',
      back: '/profile',
      children: [
        Panel(
          title: 'Uy tín tài khoản mẫu',
          accent: true,
          children: [
            Metric(label: 'Điểm uy tín', value: '50 / 100'),
            Copy('Bình thường · không hạn chế'),
            Copy(
              'Điểm khởi tạo là 50, luôn nằm trong 0–100. Điểm thực tế và hạn chế do hệ thống ghi nhận.',
              muted: true,
            ),
          ],
        ),
        Panel(
          title: 'Cùng xây dựng sự tin cậy',
          children: [
            Copy(
              'Giữ đúng lịch hẹn, hoàn thành hành trình và tôn trọng đối tác khi trao đổi.',
            ),
            RouteButton(
              secondary: true,
              href: '/reputation/history',
              label: 'Lịch sử điểm & vi phạm',
            ),
          ],
        ),
        RouteButton(
          secondary: true,
          href: '/achievements',
          label: 'Xem danh hiệu',
        ),
      ],
    );
  }
}

class ReputationHistoryScreen extends StatelessWidget {
  const ReputationHistoryScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const FeaturePage(
      title: 'Lịch sử uy tín',
      back: '/reputation',
      children: [
        Panel(
          title: 'Khởi tạo tài khoản',
          children: [
            Copy('+50 · điểm khởi tạo trong kịch bản mẫu'),
            Copy('Không có sự kiện vi phạm ở tài khoản mẫu này.', muted: true),
          ],
        ),
        Panel(
          title: 'Khi cần xem xét vi phạm',
          children: [
            Copy(
              'Chi tiết quyết định sẽ gồm lý do, thời gian, mức hạn chế và tham chiếu báo cáo. Bạn có thể theo dõi báo cáo hoặc liên hệ hỗ trợ.',
            ),
            RouteButton(
              secondary: true,
              href: '/reports',
              label: 'Báo cáo của tôi',
            ),
            RouteButton(secondary: true, href: '/help', label: 'Trợ giúp'),
          ],
        ),
      ],
    );
  }
}
