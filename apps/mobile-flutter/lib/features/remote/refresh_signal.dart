import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Each screen refreshes only its own server lists.
enum RefreshScope {
  study,
  skills,
  requests,
  discover,
  proposals,
  messages,
  inbox,
  reports,
  profile,
}

class RefreshTicks extends Notifier<Map<RefreshScope, int>> {
  @override
  Map<RefreshScope, int> build() => {
    for (final scope in RefreshScope.values) scope: 0,
  };

  void bump(Iterable<RefreshScope> scopes) {
    final next = Map<RefreshScope, int>.of(state);
    var changed = false;
    for (final scope in scopes) {
      next[scope] = (next[scope] ?? 0) + 1;
      changed = true;
    }
    if (changed) state = next;
  }
}

final refreshTicksProvider =
    NotifierProvider<RefreshTicks, Map<RefreshScope, int>>(RefreshTicks.new);

void watchRefresh(Ref ref, RefreshScope scope) {
  ref.watch(refreshTicksProvider.select((ticks) => ticks[scope]));
}

class ShellIndex extends Notifier<int> {
  @override
  int build() => 0;

  void setIndex(int index) {
    if (state == index) return;
    state = index;
  }
}

final shellIndexProvider = NotifierProvider<ShellIndex, int>(ShellIndex.new);

Future<void> pullRefresh(WidgetRef ref, Set<RefreshScope> scopes) async {
  ref.read(refreshTicksProvider.notifier).bump(scopes);
}

void listenForRefresh(Ref ref, RefreshScope scope, void Function() reload) {
  ref.listen<int?>(refreshTicksProvider.select((ticks) => ticks[scope]), (
    previous,
    next,
  ) {
    if (previous == next) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (ref.mounted) reload();
    });
  });
}

/// Reloads one group of server data while this widget is visible and [enabled].
class WaitingRefresh extends ConsumerStatefulWidget {
  const WaitingRefresh({
    super.key,
    required this.enabled,
    required this.scopes,
    required this.child,
    this.shellIndex,
  });

  final bool enabled;
  final Set<RefreshScope> scopes;
  final Widget child;

  /// When set, polling runs only while the bottom tab with this index is open.
  final int? shellIndex;

  @override
  ConsumerState<WaitingRefresh> createState() => _WaitingRefreshState();
}

class _WaitingRefreshState extends ConsumerState<WaitingRefresh> {
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(const Duration(seconds: 20), (_) => _tick());
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  void _tick() {
    if (!mounted || !widget.enabled) return;
    if (widget.shellIndex != null &&
        ref.read(shellIndexProvider) != widget.shellIndex) {
      return;
    }
    final route = ModalRoute.of(context);
    if (route != null && !route.isCurrent) return;
    ref.read(refreshTicksProvider.notifier).bump(widget.scopes);
  }

  @override
  Widget build(BuildContext context) => widget.child;
}
