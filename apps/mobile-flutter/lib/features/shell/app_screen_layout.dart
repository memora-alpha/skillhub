import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../components/app_icon.dart';
import '../../components/dialogs.dart';
import '../../components/tappable.dart';
import '../../core/theme/tokens.dart';
import '../auth/session/auth_session.dart';
import '../remote/refresh_signal.dart';
import 'account_menu.dart';
import 'inbox_count.dart';
import 'app_header.dart';
import 'navigation.dart';

/// Signed-in page chrome: header, account menu and logout confirmation.
class AppScreenLayout extends ConsumerWidget {
  const AppScreenLayout({
    super.key,
    required this.title,
    required this.child,
    this.selected,
    this.back,
    this.rightAction,
    this.background = AppColors.canvas,
    this.surface = AppColors.surface,
    this.noticeBody,
  });

  final String title;
  final String? selected;
  final ({String route, String label})? back;
  final Widget? rightAction;
  final Widget child;
  final Color background;
  final Color surface;
  final String? Function(String label)? noticeBody;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(accountSessionProvider);
    if (session == null) return const SizedBox.shrink();

    void action(String label) {
      final route = appRoutes[label];
      if (route != null && label == selected) {
        if (back != null) context.go(route);
        return;
      }
      openAppAction(context, label, noticeBody: noticeBody);
    }

    Future<void> openMenu() async {
      final choice = await showAccountMenu(context, session);
      if (choice == null || !context.mounted) return;
      if (choice == 'logout') {
        if (await showLogoutDialog(context) && context.mounted) {
          unawaited(ref.read(authRuntimeProvider).controller.signOut());
          context.go('/');
        }
        return;
      }
      action(choice);
    }

    return Scaffold(
      backgroundColor: surface,
      body: SafeArea(
        bottom: back != null,
        child: Column(
          children: [
            AppHeader(
              session: session,
              unreadCount: ref.watch(inboxCountProvider),
              title: title,
              onBack: back == null ? null : () => _goBack(context, back!.route),
              backLabel: back?.label ?? 'Quay lại hồ sơ',
              rightAction: rightAction,
              onAction: action,
              onAccount: openMenu,
            ),
            Expanded(
              child: ColoredBox(color: background, child: child),
            ),
          ],
        ),
      ),
    );
  }
}

void _goBack(BuildContext context, String fallback) {
  if (context.canPop()) {
    context.pop();
  } else {
    context.go(fallback);
  }
}

/// Bottom tab bar shared by the signed-in tabs.
class AppNavigation extends StatelessWidget {
  const AppNavigation({
    super.key,
    required this.selectedIndex,
    required this.onSelect,
  });

  final int selectedIndex;
  final ValueChanged<int> onSelect;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: const BoxDecoration(
        color: Chrome.surface,
        border: Border(top: BorderSide(color: Chrome.border)),
        boxShadow: [
          BoxShadow(
            color: Color(0x08352B1F),
            offset: Offset(0, -2),
            blurRadius: 12,
          ),
        ],
      ),
      child: SafeArea(
        top: false,
        child: Center(
          heightFactor: 1,
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 1024),
            child: Row(
              children: [
                for (var index = 0; index < appTabs.length; index++)
                  Expanded(
                    child: Semantics(
                      selected: index == selectedIndex,
                      child: Tappable(
                        pressedOpacity: 0.7,
                        semanticLabel: appTabs[index].label,
                        onTap: () => onSelect(index),
                        child: SizedBox(
                          height: 64,
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            spacing: 3,
                            children: [
                              AppIcon(
                                appTabs[index].icon,
                                size: IconSizes.navigation,
                                color: index == selectedIndex
                                    ? Chrome.accent
                                    : Chrome.muted,
                              ),
                              Text(
                                appTabs[index].label,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: nunito(
                                  (12, 16),
                                  weight: FontWeight.w600,
                                  color: index == selectedIndex
                                      ? Chrome.accent
                                      : Chrome.muted,
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
          ),
        ),
      ),
    );
  }
}

class TabShell extends ConsumerStatefulWidget {
  const TabShell({super.key, required this.shell});

  final StatefulNavigationShell shell;

  @override
  ConsumerState<TabShell> createState() => _TabShellState();
}

class _TabShellState extends ConsumerState<TabShell> {
  void _rememberIndex(int index) {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      ref.read(shellIndexProvider.notifier).setIndex(index);
    });
  }

  @override
  void initState() {
    super.initState();
    _rememberIndex(widget.shell.currentIndex);
  }

  @override
  void didUpdateWidget(TabShell oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.shell.currentIndex != widget.shell.currentIndex) {
      _rememberIndex(widget.shell.currentIndex);
    }
  }

  @override
  Widget build(BuildContext context) {
    final shell = widget.shell;
    return Scaffold(
      backgroundColor: Chrome.background,
      body: shell,
      bottomNavigationBar: AppNavigation(
        selectedIndex: shell.currentIndex,
        onSelect: (index) {
          shell.goBranch(index, initialLocation: index == shell.currentIndex);
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (!mounted) return;
            ref.read(shellIndexProvider.notifier).setIndex(index);
            ref.read(refreshTicksProvider.notifier).bump(switch (index) {
              1 => const {RefreshScope.discover},
              2 => const {RefreshScope.study},
              3 => const {RefreshScope.messages},
              4 => const {RefreshScope.profile},
              _ => const {RefreshScope.study, RefreshScope.discover},
            });
            if (index == 4) {
              ref.read(accountProvider.notifier).reload();
            }
          });
        },
      ),
    );
  }
}
