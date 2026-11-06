import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../components/app_button.dart';
import '../../components/feature_page.dart';
import '../../components/misc.dart';
import '../../core/http/app_error.dart';
import '../../core/toast/toast.dart';
import '../auth/session/auth_session.dart';
import '../learning_paths/paths_data.dart';
import '../remote/refresh_signal.dart';
import 'reputation_history.dart';

class AchievementsSnapshot {
  const AchievementsSnapshot({
    required this.selectedTitle,
    required this.items,
  });

  final String? selectedTitle;
  final List<
    ({String title, String description, String code, String? unlockedAt})
  >
  items;
}

final achievementsProvider = FutureProvider<AchievementsSnapshot?>((ref) async {
  watchRefresh(ref, RefreshScope.profile);
  final phase = ref.watch(sessionSnapshotProvider).phase;
  if (phase != SessionPhase.ready) return null;
  try {
    final data = await ref
        .read(authRuntimeProvider)
        .services
        .study
        .achievements();
    if (data is! Map) return null;
    final items = data['items'];
    final selected = data['selectedTitle'];
    final snapshot = AchievementsSnapshot(
      selectedTitle: selected is String && selected.isNotEmpty
          ? selected
          : null,
      items: [
        for (final item in items is List ? items : const [])
          if (item is Map)
            (
              title: item['title']?.toString() ?? '',
              description: item['description']?.toString() ?? '',
              code: item['code']?.toString() ?? '',
              unlockedAt: item['unlockedAt']?.toString(),
            ),
      ],
    );
    final account = ref.read(accountProvider).value;
    if (account != null &&
        account.profile.selectedTitle != snapshot.selectedTitle) {
      ref
          .read(accountProvider.notifier)
          .replaceProfile(
            account.profile.copyWith(
              selectedTitle: snapshot.selectedTitle,
              clearSelectedTitle: snapshot.selectedTitle == null,
            ),
          );
    }
    return snapshot;
  } on AppError catch (error) {
    if (error.kind == AppErrorKind.http && error.status == 403) return null;
    rethrow;
  }
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
  Future<void> _selectTitle(String? code) async {
    final result = await ref
        .read(authRuntimeProvider)
        .services
        .study
        .selectTitle(code);
    final title = result['selectedTitle']?.toString();
    final account = ref.read(accountProvider).value;
    if (account != null) {
      ref
          .read(accountProvider.notifier)
          .replaceProfile(
            account.profile.copyWith(
              selectedTitle: title,
              clearSelectedTitle: title == null || title.isEmpty,
            ),
          );
    }
    ref.invalidate(achievementsProvider);
  }

  @override
  Widget build(BuildContext context) {
    final query = ref.watch(achievementsProvider);
    final data = query.value;
    final selected =
        data?.selectedTitle ??
        ref.watch(accountProvider).value?.profile.selectedTitle;
    final unlocked = data?.items ?? const [];
    return FeaturePage(
      onRefresh: () async {
        ref.invalidate(achievementsProvider);
        await ref.read(achievementsProvider.future);
      },
      title: 'Thành tích & danh hiệu',
      back: '/profile',
      children: [
        if (query.isLoading && data == null)
          const Copy('Đang tải thành tích.', muted: true),
        if (query.hasError)
          Panel(
            title: 'Chưa thể cập nhật thành tích',
            children: [Copy(errorMessage(query.error))],
          ),
        if (data == null && query.hasValue)
          const Copy('Tài khoản hiện không có quyền xem thành tích.'),
        if (data != null) ...[
          Panel(
            title: 'Danh hiệu đang chọn',
            accent: true,
            children: [
              Copy(
                selected == null || selected.isEmpty
                    ? 'Không hiển thị danh hiệu'
                    : selected,
              ),
              AsyncAppButton(
                label: 'Ẩn danh hiệu',
                busyLabel: 'Đang cập nhật...',
                variant: ButtonVariant.paper,
                disabled: selected == null || selected.isEmpty,
                onPressed: () async {
                  try {
                    await _selectTitle(null);
                  } catch (error) {
                    ref
                        .read(toastProvider.notifier)
                        .show(
                          error is AppError &&
                                  error.code == 'TITLE_NOT_UNLOCKED'
                              ? 'Danh hiệu này chưa được mở khóa hoặc không còn khả dụng. Hãy làm mới thành tích.'
                              : errorMessage(error),
                          ToastTone.error,
                        );
                  }
                },
              ),
            ],
          ),
          if (unlocked.isEmpty)
            const EmptyState(
              title: 'Chưa có thành tích được mở khóa',
              description:
                  'Thành tích sẽ xuất hiện khi bạn đạt các mốc của hệ thống.',
            ),
          for (final item in unlocked)
            Panel(
              title: item.title,
              children: [
                StatusBadge(
                  selected == item.title
                      ? 'Đang hiển thị trên hồ sơ'
                      : 'Đã mở khóa',
                ),
                Copy(item.description),
                if (item.unlockedAt != null && item.unlockedAt!.isNotEmpty)
                  Copy(
                    'Mở khóa ngày ${_formatUnlocked(item.unlockedAt!)}',
                    muted: true,
                  ),
                AsyncAppButton(
                  label: selected == item.title
                      ? 'Đang chọn'
                      : 'Chọn danh hiệu này',
                  busyLabel: 'Đang cập nhật...',
                  variant: ButtonVariant.paper,
                  disabled: selected == item.title,
                  onPressed: () async {
                    try {
                      await _selectTitle(item.code.isEmpty ? null : item.code);
                    } catch (error) {
                      ref
                          .read(toastProvider.notifier)
                          .show(
                            error is AppError &&
                                    error.code == 'TITLE_NOT_UNLOCKED'
                                ? 'Danh hiệu này chưa được mở khóa hoặc không còn khả dụng. Hãy làm mới thành tích.'
                                : errorMessage(error),
                            ToastTone.error,
                          );
                    }
                  },
                ),
              ],
            ),
        ],
      ],
    );
  }
}

String _formatUnlocked(String value) {
  final date = DateTime.tryParse(value)?.toLocal();
  if (date == null) return value;
  return '${date.day}/${date.month}/${date.year}';
}

class ReputationScreen extends ConsumerWidget {
  const ReputationScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final score = ref.watch(accountProvider).value?.profile.reputationScore;
    final label = score == null ? 'Chưa có' : '$score';
    return FeaturePage(
      onRefresh: () async {
        ref.read(refreshTicksProvider.notifier).bump(const {
          RefreshScope.profile,
        });
        await ref.read(accountProvider.notifier).reload();
      },
      title: 'Điểm uy tín',
      back: '/profile',
      children: [
        Panel(
          title: 'Uy tín tài khoản',
          accent: true,
          children: [
            Metric(label: 'Điểm uy tín', value: label),
            const Copy('Điểm lấy từ hồ sơ đang đăng nhập.', muted: true),
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
  Widget build(BuildContext context) => const LiveReputationHistory();
}
