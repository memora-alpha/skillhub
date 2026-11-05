import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/http/app_error.dart';
import '../core/theme/tokens.dart';
import '../features/auth/session/auth_session.dart';
import 'avatar.dart';

/// API signs avatar URLs for 60s — refresh before they expire.
const _avatarResignEvery = Duration(seconds: 45);

/// Signed avatar URLs; refresh on a timer and on image error (not a stampede).
final userAvatarUrlProvider = FutureProvider.family<String?, String>((
  ref,
  userId,
) async {
  if (userId.isEmpty) return null;
  final session = ref.watch(accountSessionProvider);
  final phase = ref.watch(sessionSnapshotProvider).phase;
  if (phase != SessionPhase.ready) {
    if (session != null && session.userId == userId) return session.avatarUrl;
    return null;
  }
  // Own avatar is re-signed when accountProvider refreshes (~45s).
  if (session != null && session.userId == userId) return session.avatarUrl;
  try {
    final json = await ref
        .read(authRuntimeProvider)
        .account
        .publicProfile(userId);
    final url = json['avatarUrl'];
    final resolved = url is String && url.isNotEmpty ? url : null;
    if (resolved != null) {
      final timer = Timer(_avatarResignEvery, () {
        if (ref.mounted) ref.invalidateSelf();
      });
      ref.onDispose(timer.cancel);
    }
    return resolved;
  } on AppError catch (error) {
    if (isTransientReadError(error)) return null;
    return null;
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
    this.imageUrl,
  });

  final String name;
  final String? userId;
  final double size;

  /// Optional seed URL (e.g. feed `owner.avatarUrl`) shown until refresh loads.
  final String? imageUrl;

  @override
  ConsumerState<UserAvatar> createState() => _UserAvatarState();
}

class _UserAvatarState extends ConsumerState<UserAvatar> {
  /// Last URL we are willing to paint — kept across provider reloads so we do
  /// not fall back to an expired list seed after a resign.
  String? _stickyUrl;
  String? _failedUrl;
  var _retried = false;

  @override
  void initState() {
    super.initState();
    _stickyUrl = _nonEmpty(widget.imageUrl);
  }

  @override
  void didUpdateWidget(covariant UserAvatar oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.userId != widget.userId) {
      _stickyUrl = _nonEmpty(widget.imageUrl);
      _failedUrl = null;
      _retried = false;
      return;
    }
    final seed = _nonEmpty(widget.imageUrl);
    if (seed != null && seed != oldWidget.imageUrl && seed != _failedUrl) {
      _stickyUrl = seed;
      _retried = false;
    }
  }

  static String? _nonEmpty(String? value) =>
      value != null && value.isNotEmpty ? value : null;

  void _remember(String? url) {
    final next = _nonEmpty(url);
    if (next == null || next == _stickyUrl || next == _failedUrl) return;
    _stickyUrl = next;
    _retried = false;
  }

  @override
  Widget build(BuildContext context) {
    final userId = widget.userId;
    if (userId != null && userId.isNotEmpty) {
      final live = ref.watch(userAvatarUrlProvider(userId)).value;
      _remember(live);
      ref.listen<AsyncValue<String?>>(userAvatarUrlProvider(userId), (
        previous,
        next,
      ) {
        final url = _nonEmpty(next.asData?.value);
        if (url == null || url == _stickyUrl || url == _failedUrl) return;
        setState(() {
          _stickyUrl = url;
          _retried = false;
        });
      });
    }

    final imageUrl = _stickyUrl;
    return Avatar(
      name: widget.name,
      userId: userId,
      size: widget.size,
      imageUrl: imageUrl,
      onImageError: () {
        if (!mounted || imageUrl == null) return;
        _failedUrl = imageUrl;
        if (imageUrl == _stickyUrl) _stickyUrl = null;
        if (_retried || userId == null || userId.isEmpty) {
          setState(() {});
          return;
        }
        _retried = true;
        setState(() {});
        ref.invalidate(userAvatarUrlProvider(userId));
      },
    );
  }
}
