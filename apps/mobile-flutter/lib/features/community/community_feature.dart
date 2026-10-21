import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../components/app_button.dart';
import '../../components/feature_page.dart';
import '../../components/misc.dart';
import '../../core/http/app_error.dart';
import '../../core/toast/toast.dart';
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

final achievementsProvider =
    FutureProvider<List<({String title, String description, String code})>>((ref) async {
      final phase = ref.watch(sessionSnapshotProvider).phase;
      if (phase != SessionPhase.ready) return const [];
      final data = await ref.read(authRuntimeProvider).services.study.achievements();
      if (data is! Map) return const [];
      final items = data['items'];
      if (items is! List) return const [];
      return [
        for (final item in items)
          if (item is Map)
            (
              title: item['title']?.toString() ?? '',
              description: item['description']?.toString() ?? '',
              code: item['code']?.toString() ?? '',
            ),
      ];
    });

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

class AchievementsScreen extends ConsumerStatefulWidget {
  const AchievementsScreen({super.key});

  @override
  ConsumerState<AchievementsScreen> createState() => _AchievementsScreenState();
}

class _AchievementsScreenState extends ConsumerState<AchievementsScreen> {
  @override
  Widget build(BuildContext context) {
    final badge = ref.watch(selectedBadgeProvider);
    final notifier = ref.read(selectedBadgeProvider.notifier);
    final unlocked = ref.watch(achievementsProvider).value ?? const [];
    return FeaturePage(
      title: 'Thành tích & danh hiệu',
      back: '/profile',
      children: [
        Panel(
          title: 'Danh hiệu đang chọn',
          accent: true,
          children: [
            Copy(badge.isEmpty ? 'Không hiển thị danh hiệu' : badge),
            AppButton(
              label: 'Ẩn danh hiệu',
              variant: ButtonVariant.paper,
              onPressed: () async {
                try {
                  await ref
                      .read(authRuntimeProvider)
                      .services
                      .study
                      .selectTitle(null);
                  notifier.select('');
                } catch (error) {
                  ref
                      .read(toastProvider.notifier)
                      .show(errorMessage(error), ToastTone.error);
                }
              },
            ),
          ],
        ),
        for (final item in unlocked)
          Panel(
            title: item.title,
            children: [
              const StatusBadge('Đã mở'),
              Copy(item.description),
              AppButton(
                label: 'Chọn danh hiệu này',
                variant: ButtonVariant.paper,
                onPressed: () async {
                  try {
                    await ref
                        .read(authRuntimeProvider)
                        .services
                        .study
                        .selectTitle(item.code.isEmpty ? null : item.code);
                    notifier.select(item.title);
                  } catch (error) {
                    ref
                        .read(toastProvider.notifier)
                        .show(errorMessage(error), ToastTone.error);
                  }
                },
              ),
            ],
          ),
        if (unlocked.isEmpty)
          const EmptyState(
            title: 'Chưa có thành tích',
            description: 'Danh hiệu xuất hiện khi máy chủ ghi nhận mốc của bạn.',
          ),
      ],
    );
  }
}

class ReputationScreen extends ConsumerWidget {
  const ReputationScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final score = ref.watch(accountProvider).value?.profile.reputationScore;
    final label = score == null ? 'Chưa có' : '$score';
    return FeaturePage(
      title: 'Điểm uy tín',
      back: '/profile',
      children: [
        Panel(
          title: 'Uy tín tài khoản',
          accent: true,
          children: [
            Metric(label: 'Điểm uy tín', value: label),
            const Copy(
              'Điểm lấy từ hồ sơ đang đăng nhập.',
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

class ReputationHistoryScreen extends ConsumerWidget {
  const ReputationHistoryScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final history = ref.watch(_reputationProvider);
    final data = history.value;
    final items = data?['items'] ?? data?['entries'];
    return FeaturePage(
      title: 'Lịch sử uy tín',
      back: '/reputation',
      children: [
        if (history.isLoading)
          const Copy('Đang tải lịch sử uy tín.', muted: true)
        else if (history.hasError)
          Copy(errorMessage(history.error))
        else if (items is List && items.isNotEmpty)
          for (final item in items)
            Panel(
              title: item is Map ? item['reason']?.toString() ?? 'Sự kiện' : 'Sự kiện',
              children: [
                Copy(item.toString()),
              ],
            )
        else
          Panel(
            title: 'Chưa có sự kiện uy tín',
            children: [
              Copy(data == null ? 'Máy chủ chưa trả lịch sử.' : data.toString()),
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

final _reputationProvider = FutureProvider<Map<String, dynamic>>((ref) async {
  final phase = ref.watch(sessionSnapshotProvider).phase;
  if (phase != SessionPhase.ready) return const {};
  return ref.read(authRuntimeProvider).services.study.reputation();
});
