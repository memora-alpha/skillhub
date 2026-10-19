import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../utils/cooldown.dart';

/// Rebuilds with the seconds left before another code may be requested.
class CooldownBuilder extends ConsumerStatefulWidget {
  const CooldownBuilder({
    super.key,
    required this.provider,
    required this.email,
    required this.builder,
    this.initiallySent = false,
  });

  final NotifierProvider<CooldownNotifier, Map<String, int>> provider;
  final String email;
  final bool initiallySent;
  final Widget Function(BuildContext context, int seconds) builder;

  @override
  ConsumerState<CooldownBuilder> createState() => _CooldownBuilderState();
}

class _CooldownBuilderState extends ConsumerState<CooldownBuilder>
    with WidgetsBindingObserver {
  Timer? _timer;
  int? _scheduledFor;

  String get _key => widget.email.trim().toLowerCase();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    if (_key.isNotEmpty && widget.initiallySent) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        final notifier = ref.read(widget.provider.notifier);
        if (mounted && !ref.read(widget.provider).containsKey(_key)) {
          notifier.start(_key);
        }
      });
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && mounted) setState(() {});
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _timer?.cancel();
    super.dispose();
  }

  void _schedule(int deadline) {
    _timer?.cancel();
    if (deadline <= DateTime.now().millisecondsSinceEpoch) return;
    _timer = Timer.periodic(const Duration(milliseconds: 250), (timer) {
      if (!mounted) return timer.cancel();
      setState(() {});
      if (DateTime.now().millisecondsSinceEpoch >= deadline) timer.cancel();
    });
  }

  @override
  Widget build(BuildContext context) {
    final deadline = ref.watch(widget.provider.select((s) => s[_key] ?? 0));
    if (deadline != _scheduledFor) {
      _scheduledFor = deadline;
      _schedule(deadline);
    }
    final seconds = remainingCooldownSeconds(
      deadline,
      DateTime.now().millisecondsSinceEpoch,
    );
    return widget.builder(context, seconds);
  }
}
