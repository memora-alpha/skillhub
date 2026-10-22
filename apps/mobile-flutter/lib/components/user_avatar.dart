import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/theme/tokens.dart';
import '../features/auth/session/auth_session.dart';
import 'avatar.dart';

/// Signed avatar URLs expire quickly, so a visible avatar refreshes itself.
final userAvatarUrlProvider = FutureProvider.autoDispose
    .family<String?, String>((ref, userId) async {
      if (userId.isEmpty) return null;
      final session = ref.watch(accountSessionProvider);
      if (session != null && session.userId == userId) return session.avatarUrl;
      final phase = ref.watch(sessionSnapshotProvider).phase;
      if (phase != SessionPhase.ready) return null;
      try {
        final json = await ref
            .read(authRuntimeProvider)
            .account
            .publicProfile(userId);
        final url = json['avatarUrl'];
        final link = url is String && url.isNotEmpty ? url : null;
        if (link != null) {
          final timer = Timer(const Duration(seconds: 45), ref.invalidateSelf);
          ref.onDispose(timer.cancel);
        }
        return link;
      } catch (_) {
        return null;
      }
    });

/// Avatar that loads the person's photo from their public profile.
class UserAvatar extends ConsumerStatefulWidget {
  const UserAvatar({
    super.key,
    required this.name,
    this.userId,
    this.size = AvatarSizes.list,
  });

  final String name;
  final String? userId;
  final double size;

  @override
  ConsumerState<UserAvatar> createState() => _UserAvatarState();
}

class _UserAvatarState extends ConsumerState<UserAvatar> {
  var _retried = false;

  @override
  Widget build(BuildContext context) {
    final userId = widget.userId;
    final imageUrl = userId == null || userId.isEmpty
        ? null
        : ref.watch(userAvatarUrlProvider(userId)).value;
    return Avatar(
      name: widget.name,
      userId: userId,
      size: widget.size,
      imageUrl: imageUrl,
      onImageError: () {
        if (!mounted || _retried || userId == null || userId.isEmpty) return;
        _retried = true;
        ref.invalidate(userAvatarUrlProvider(userId));
      },
    );
  }
}
