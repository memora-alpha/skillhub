import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';

import '../../components/app_button.dart';
import '../../components/app_icon.dart';
import '../../components/avatar.dart';
import '../../components/misc.dart';
import '../../components/tappable.dart';
import '../../core/theme/tokens.dart';
import '../../core/toast/toast.dart';
import '../account/schema/account_schema.dart';
import '../auth/session/auth_session.dart';
import '../auth/session/avatar_monitor.dart';
import '../discovery/discovery_data.dart';
import '../shell/app_screen_layout.dart';
import 'edit_profile_screen.dart';
import 'public_profiles_data.dart';

class UserProfileScreen extends ConsumerWidget {
  const UserProfileScreen({super.key, required this.id, this.requestId});

  final String id;
  final String? requestId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profile = ref.watch(publicProfileProvider(id)).value;
    final request = (ref.watch(learningRequestsProvider).value ?? const <LearningRequest>[])
        .where((r) => r.id == requestId && r.userId == profile?.id)
        .firstOrNull;
    final back = request != null ? '/request/${request.id}' : '/proposals';
    final body = nunito(TypeScale.body, color: Palette.body);
    final heroBody = nunito(TypeScale.body, color: Palette.sand);
    final caption = nunito(TypeScale.secondary, color: Palette.muted);
    final heading = nunito(
      TypeScale.heading,
      weight: FontWeight.w700,
      color: Palette.ink,
    );
    final label = nunito(
      TypeScale.body,
      weight: FontWeight.w600,
      color: Palette.ink,
    );

    Widget section(String title, List<Widget> children) => Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Chrome.surface,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        spacing: 12,
        children: [
          Semantics(header: true, child: Text(title, style: heading)),
          ...children,
        ],
      ),
    );

    Widget stars(int count, double size, Color color) => Row(
      mainAxisSize: MainAxisSize.min,
      spacing: 2,
      children: [
        for (var star = 1; star <= 5; star++)
          AppIcon(AppIcon.star, size: size, filled: star <= count, color: color),
      ],
    );

    return AppScreenLayout(
      title: 'Hồ sơ công khai',
      selected: 'Khám phá',
      back: (route: back, label: 'Quay lại'),
      child: profile == null
          ? EmptyState(
              title: 'Không tìm thấy hồ sơ',
              description: 'Hồ sơ này không có trên máy chủ.',
              action: 'Quay lại khám phá',
              onAction: () => context.go('/discover'),
            )
          : ListView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
              children: [
                Center(
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 840),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      spacing: 16,
                      children: [
                        Container(
                          padding: const EdgeInsets.all(24),
                          decoration: BoxDecoration(
                            color: Palette.ink,
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            spacing: 8,
                            children: [
                              _PublicAvatar(profile: profile),
                              Semantics(
                                header: true,
                                child: SelectableText(
                                  profile.name,
                                  style: fraunces(
                                    26,
                                    34,
                                    weight: FontWeight.w700,
                                    color: Palette.white,
                                  ),
                                ),
                              ),
                              if (profile.headline != null)
                                Text(profile.headline!, style: heroBody),
                              Wrap(
                                spacing: 16,
                                children: [
                                  if (profile.rating != null)
                                    Row(
                                      mainAxisSize: MainAxisSize.min,
                                      spacing: 6,
                                      children: [
                                        const AppIcon(
                                          AppIcon.star,
                                          size: 14,
                                          filled: true,
                                          color: Palette.star,
                                        ),
                                        Text(profile.rating!, style: heroBody),
                                      ],
                                    ),
                                  if (profile.reputation != null)
                                    Text(
                                      '${profile.reputation} Reputation',
                                      style: heroBody,
                                    ),
                                ],
                              ),
                              Text(
                                'Hồ sơ mẫu',
                                style: nunito(
                                  TypeScale.caption,
                                  weight: FontWeight.w500,
                                  color: Palette.brandMuted,
                                ),
                              ),
                            ],
                          ),
                        ),
                        if (profile.stats case final stats?)
                          Row(
                            spacing: 8,
                            children: [
                              for (final stat in stats)
                                Expanded(
                                  child: Container(
                                    padding: const EdgeInsets.all(12),
                                    decoration: BoxDecoration(
                                      color: Chrome.surface,
                                      borderRadius: BorderRadius.circular(8),
                                    ),
                                    child: Column(
                                      spacing: 4,
                                      children: [
                                        SelectableText(
                                          stat.value,
                                          style: nunito(
                                            TypeScale.title,
                                            weight: FontWeight.w700,
                                            color: Palette.brandHover,
                                          ),
                                        ),
                                        Text(stat.label, style: caption),
                                      ],
                                    ),
                                  ),
                                ),
                            ],
                          ),
                        section('Giới thiệu', [
                          SelectableText(
                            profile.bio ??
                                'Người dùng chưa viết phần giới thiệu.',
                            style: body,
                          ),
                        ]),
                        section('Kỹ năng chia sẻ', [
                          if (profile.skills.isEmpty)
                            Text(
                              'Chưa có kỹ năng chia sẻ.',
                              style: body,
                            ),
                          for (final skill in profile.skills)
                            Container(
                              padding: const EdgeInsets.symmetric(vertical: 8),
                              decoration: const BoxDecoration(
                                border: Border(
                                  bottom: BorderSide(color: Chrome.border),
                                ),
                              ),
                              child: Row(
                                spacing: 8,
                                children: [
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      spacing: 6,
                                      children: [
                                        Text(skill.name, style: label),
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
                                  Text(skill.level, style: caption),
                                ],
                              ),
                            ),
                        ]),
                        section('Đánh giá', [
                          if (profile.reviews?.isEmpty ?? true)
                            Text(
                              'Chưa có đánh giá.',
                              style: body,
                            ),
                          for (final review in profile.reviews ?? const <DemoReview>[])
                            Padding(
                              padding: const EdgeInsets.symmetric(vertical: 6),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                spacing: 8,
                                children: [
                                  Wrap(
                                    spacing: 6,
                                    crossAxisAlignment:
                                        WrapCrossAlignment.center,
                                    children: [
                                      Avatar(name: review.name, size: 28),
                                      Text(review.name, style: label),
                                      Semantics(
                                        label: '${review.stars}/5 sao',
                                        child: stars(
                                          review.stars,
                                          12,
                                          Palette.gold,
                                        ),
                                      ),
                                    ],
                                  ),
                                  SelectableText(review.text, style: body),
                                ],
                              ),
                            ),
                        ]),
                        Wrap(
                          spacing: 10,
                          runSpacing: 10,
                          children: [
                            if (request != null)
                              AppButton(
                                label: 'Xem yêu cầu',
                                variant: ButtonVariant.secondary,
                                minHeight: 48,
                                onPressed: () => context.canPop()
                                    ? context.pop()
                                    : context.go(back),
                              ),
                            AppButton(
                              label: request != null
                                  ? 'Gửi đề xuất'
                                  : 'Gửi lời mời trao đổi',
                              minHeight: 48,
                              onPressed: () => context.push(
                                request != null
                                    ? '/send-proposal?requestId=${request.id}'
                                    : '/send-proposal?userId=${profile.id}',
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
    );
  }
}

class _PublicAvatar extends ConsumerStatefulWidget {
  const _PublicAvatar({required this.profile});

  final DemoPublicProfile profile;

  @override
  ConsumerState<_PublicAvatar> createState() => _PublicAvatarState();
}

class _PublicAvatarState extends ConsumerState<_PublicAvatar> {
  var _busy = false;
  var _retriedImage = false;
  Uint8List? _preview;

  Future<void> _upload() async {
    if (_busy) return;
    final toast = ref.read(toastProvider.notifier);
    setState(() => _busy = true);
    try {
      final file = await ImagePicker().pickImage(
        source: ImageSource.gallery,
        requestFullMetadata: false,
      );
      if (file == null || !mounted) return;
      final image = await prepareAvatarImage(file);
      final upload = await ref
          .read(authRuntimeProvider)
          .account
          .uploadAvatar(avatarUploadBody(image));
      if (!mounted) return;
      setState(() => _preview = image.bytes);
      ref.read(avatarMonitorProvider.notifier).track(upload);
      ref.invalidate(publicProfileProvider(widget.profile.id));
      toast.show('Ảnh đã tải lên, đang kiểm tra.', ToastTone.info);
    } on AvatarSelectionException catch (error) {
      toast.show(error.message, ToastTone.error);
    } catch (error) {
      toast.show(avatarSaveErrorMessage(error), ToastTone.error);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final session = ref.watch(accountSessionProvider);
    final own = session?.userId == widget.profile.id;
    final monitor = ref.watch(avatarMonitorProvider);
    ref.listen(avatarMonitorProvider, (_, next) {
      if (!own || next?.settled != true) return;
      ref.invalidate(publicProfileProvider(widget.profile.id));
    });
    final imageUrl = own
        ? session?.avatarUrl ?? widget.profile.avatarUrl
        : widget.profile.avatarUrl;
    final rejected = monitor?.upload.status == AvatarStatus.rejected;
    final avatar = Avatar(
      name: widget.profile.name,
      userId: widget.profile.id,
      size: 72,
      imageUrl: _preview == null || rejected ? imageUrl : null,
      imageBytes: rejected ? null : _preview,
      onImageError: () {
        if (!mounted || _retriedImage) return;
        _retriedImage = true;
        ref.invalidate(publicProfileProvider(widget.profile.id));
      },
    );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      spacing: 8,
      children: [
        if (!own)
          avatar
        else
          Tappable(
            semanticLabel: _busy ? 'Đang tải ảnh đại diện' : 'Tải ảnh đại diện',
            pressedOpacity: 0.85,
            onTap: _busy ? null : _upload,
            child: Stack(
              clipBehavior: Clip.none,
              children: [
                avatar,
                Positioned(
                  right: -2,
                  bottom: -2,
                  child: Container(
                    width: 26,
                    height: 26,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: Palette.white,
                      shape: BoxShape.circle,
                      border: Border.all(color: Palette.ink, width: 2),
                    ),
                    child: const AppIcon(
                      AppIcon.plus,
                      size: 14,
                      color: Palette.ink,
                    ),
                  ),
                ),
              ],
            ),
          ),
        if (own)
          Text(
            _busy ? 'Đang tải ảnh...' : 'Chạm ảnh để tải avatar',
            style: nunito(
              TypeScale.caption,
              weight: FontWeight.w500,
              color: Palette.brandMuted,
            ),
          ),
      ],
    );
  }
}
