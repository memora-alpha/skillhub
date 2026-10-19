import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'features/auth/screens/forgot_password_screen.dart';
import 'features/auth/screens/login_screen.dart';
import 'features/auth/screens/register_screen.dart';
import 'features/auth/screens/reset_password_code_screen.dart';
import 'features/auth/screens/reset_password_screen.dart';
import 'features/auth/screens/verify_email_screen.dart';
import 'features/auth/screens/welcome_screen.dart';
import 'features/auth/session/auth_session.dart';
import 'features/auth/utils/auth_validation.dart';
import 'features/auth/utils/password_recovery.dart';
import 'features/calendar/calendar_screens.dart';
import 'features/community/community_feature.dart';
import 'features/discovery/discovery_screens.dart';
import 'features/home/home_screen.dart';
import 'features/learning_paths/paths_screens.dart';
import 'features/learning_requests/requests_feature.dart';
import 'features/materials/materials_feature.dart';
import 'features/messages/messages_screens.dart';
import 'features/product_shell/product_shell_feature.dart';
import 'features/profile/edit_profile_screen.dart';
import 'features/profile/profile_screen.dart';
import 'features/profile/user_profile_screen.dart';
import 'features/proposals/proposals_screens.dart';
import 'features/reports/reports_feature.dart';
import 'features/sessions/sessions_screens.dart';
import 'features/settings/account_details_screen.dart';
import 'features/settings/account_settings_screen.dart';
import 'features/shell/app_screen_layout.dart';
import 'features/skills/skills_feature.dart';
import 'features/ui_preview/ui_preview_screens.dart';
import 'features/wallet/wallet_feature.dart';

const _guestOnly = {'/', '/login', '/register', '/verify-email'};
const _recoveryPaths = {
  '/forgot-password',
  '/reset-password-code',
  '/reset-password',
};

bool _requiresAccount(String path) =>
    !_guestOnly.contains(path) &&
    !_recoveryPaths.contains(path) &&
    path != '/explore' &&
    !path.startsWith('/explore/');

GoRoute _route(String path, Widget Function(GoRouterState state) build) =>
    GoRoute(path: path, builder: (_, state) => build(state));

String _p(GoRouterState s, String name) => s.pathParameters[name]!;
String? _q(GoRouterState s, String name) => s.uri.queryParameters[name];

/// Static segments such as `new`, `history`, `library` and `mine` must stay
/// before their `:id` siblings because go_router matches in list order.
final _featureRoutes = <GoRoute>[
  _route('/request/:id', (s) => RequestDetailScreen(id: _p(s, 'id'))),
  _route(
    '/user/:id',
    (s) => UserProfileScreen(id: _p(s, 'id'), requestId: _q(s, 'requestId')),
  ),
  _route('/session/:id', (s) => SessionDetailScreen(id: _p(s, 'id'))),
  _route(
    '/chat/:proposalId',
    (s) => ChatScreen(proposalId: _p(s, 'proposalId')),
  ),
  _route(
    '/chat-attachment',
    (s) => AttachmentScreen(proposalId: _q(s, 'proposalId') ?? ''),
  ),
  _route('/proposals', (s) => ProposalsScreen(tab: _q(s, 'tab'))),
  _route(
    '/proposal/:id',
    (s) =>
        ProposalDetailScreen(id: _p(s, 'id'), updated: _q(s, 'updated') == '1'),
  ),
  _route('/proposal/:id/edit', (s) => EditProposalScreen(id: _p(s, 'id'))),
  _route(
    '/proposal/:id/close',
    (s) => CloseProposalScreen(id: _p(s, 'id'), action: _q(s, 'action')),
  ),
  _route(
    '/send-proposal',
    (s) => SendProposalScreen(
      requestId: _q(s, 'requestId'),
      userId: _q(s, 'userId'),
    ),
  ),
  _route(
    '/agreement-type',
    (s) => AgreementTypeScreen(proposalId: _q(s, 'proposalId')),
  ),
  _route('/paths', (_) => const PathsScreen()),
  _route('/paths/:id', (s) => PathDetailScreen(id: _p(s, 'id'))),
  _route('/paths/:id/plans/new', (s) => PlanEditorScreen(id: _p(s, 'id'))),
  _route(
    '/paths/:id/plans/:planId',
    (s) => PlanDetailScreen(id: _p(s, 'id'), planId: _p(s, 'planId')),
  ),
  _route(
    '/paths/:id/plans/:planId/edit',
    (s) => PlanEditorScreen(id: _p(s, 'id'), planId: _p(s, 'planId')),
  ),
  _route('/paths/:id/schedules', (s) => SchedulesScreen(id: _p(s, 'id'))),
  _route(
    '/paths/:id/schedules/:planId',
    (s) => ScheduleEditorScreen(id: _p(s, 'id'), planId: _p(s, 'planId')),
  ),
  _route('/paths/:id/hold', (s) => HoldScreen(id: _p(s, 'id'))),
  _route('/paths/:id/cancel', (s) => PathCancellationScreen(id: _p(s, 'id'))),
  _route('/paths/:id/terms', (s) => TermsEditorScreen(id: _p(s, 'id'))),
  _route('/paths/:id/settlement', (s) => SettlementScreen(id: _p(s, 'id'))),
  _route('/paths/:id/sessions', (s) => PathSessionsScreen(id: _p(s, 'id'))),
  _route('/paths/:id/review', (s) => ReviewEditorScreen(id: _p(s, 'id'))),
  _route('/learning-history', (_) => const PathSessionsScreen()),
  _route(
    '/learning-sessions/:id',
    (s) => LearningSessionScreen(id: _p(s, 'id')),
  ),
  _route(
    '/learning-sessions/:id/reschedule',
    (s) => RescheduleScreen(id: _p(s, 'id')),
  ),
  _route(
    '/learning-sessions/:id/completion',
    (s) => CompletionScreen(id: _p(s, 'id')),
  ),
  _route('/learning-sessions/:id/room', (s) => RoomScreen(id: _p(s, 'id'))),
  _route('/requests', (_) => const MyRequestsScreen()),
  _route('/requests/new', (_) => const RequestEditorScreen()),
  _route('/requests/:id', (s) => OwnRequestScreen(id: _p(s, 'id'))),
  _route('/requests/:id/edit', (s) => RequestEditorScreen(id: _p(s, 'id'))),
  _route('/skills', (_) => const SkillsScreen()),
  _route('/skills/new', (_) => const SkillEditorScreen()),
  _route('/skills/history', (_) => const VerificationHistoryScreen()),
  _route('/skills/:id', (s) => SkillDetailScreen(id: _p(s, 'id'))),
  _route('/skills/:id/edit', (s) => SkillEditorScreen(id: _p(s, 'id'))),
  _route('/skills/:id/evidence', (s) => EvidenceScreen(id: _p(s, 'id'))),
  _route('/wallet', (_) => const WalletScreen()),
  _route('/wallet/topup', (_) => const TopupScreen()),
  _route(
    '/wallet/payment',
    (s) => PaymentScreen(amount: _q(s, 'amount') ?? ''),
  ),
  _route(
    '/wallet/payment-status',
    (s) => PaymentStatusScreen(state: _q(s, 'state') ?? 'pending'),
  ),
  _route('/wallet/history', (_) => const TransactionsScreen()),
  _route(
    '/wallet/transactions/:id',
    (s) => TransactionDetailScreen(id: _p(s, 'id')),
  ),
  _route('/materials', (_) => const MaterialsScreen()),
  _route('/materials/library', (_) => const MaterialLibraryScreen()),
  _route('/materials/mine', (_) => const MyMaterialsScreen()),
  _route('/materials/new', (_) => const MaterialEditorScreen()),
  _route('/materials/:id', (s) => MaterialDetailScreen(id: _p(s, 'id'))),
  _route('/materials/:id/access', (s) => MaterialAccessScreen(id: _p(s, 'id'))),
  _route(
    '/materials/:id/purchase',
    (s) => MaterialPurchaseScreen(
      id: _p(s, 'id'),
      changed: _q(s, 'changed') == '1',
    ),
  ),
  _route('/materials/:id/edit', (s) => MaterialEditorScreen(id: _p(s, 'id'))),
  _route('/reports', (_) => const ReportsScreen()),
  _route(
    '/reports/new',
    (s) => ReportEditorScreen(
      pathId: _q(s, 'pathId'),
      sessionId: _q(s, 'sessionId'),
      materialId: _q(s, 'materialId'),
    ),
  ),
  _route('/reports/:id', (s) => ReportDetailScreen(id: _p(s, 'id'))),
  _route('/reviews', (_) => const ReviewsScreen()),
  _route('/reputation', (_) => const ReputationScreen()),
  _route('/reputation/history', (_) => const ReputationHistoryScreen()),
  _route('/achievements', (_) => const AchievementsScreen()),
  _route('/notifications', (_) => const NotificationsScreen()),
  _route('/search', (_) => const SearchScreen()),
  _route('/onboarding', (_) => const OnboardingScreen()),
  _route(
    '/preferences/:section',
    (s) => PreferencesScreen(section: _p(s, 'section')),
  ),
  _route('/help', (_) => const HelpScreen()),
  _route('/policies', (_) => const PoliciesScreen()),
  _route('/ui', (_) => const UiCatalogScreen()),
  _route('/states/:state', (s) => SystemStateScreen(state: _p(s, 'state'))),
  _route('/explore', (s) => PublicExploreScreen(query: _q(s, 'query') ?? '')),
  _route(
    '/explore/profiles/:userId',
    (s) => PublicGuestProfileScreen(userId: _p(s, 'userId')),
  ),
  _route(
    '/explore/requests/:id',
    (s) => PublicGuestRequestScreen(id: _p(s, 'id')),
  ),
];

final _rootKey = GlobalKey<NavigatorState>(debugLabel: 'root');

final routerProvider = Provider<GoRouter>((ref) {
  final refresh = ValueNotifier(0);
  ref.listen(authStatusProvider, (_, _) => refresh.value++);
  ref.listen(passwordRecoveryProvider, (_, _) => refresh.value++);

  String? redirect(BuildContext context, GoRouterState state) {
    final status = ref.read(authStatusProvider);
    if (status != AuthStatus.guest && status != AuthStatus.authenticated) {
      return null;
    }
    final path = state.uri.path;
    final signedIn = status == AuthStatus.authenticated;
    if (signedIn && _guestOnly.contains(path)) return '/home';
    if (!signedIn && _requiresAccount(path)) return '/';
    if (path == '/verify-email' &&
        validateEmail(state.uri.queryParameters['email'] ?? '') != null) {
      return '/login';
    }
    final draft = ref.read(passwordRecoveryProvider);
    if (path == '/reset-password-code') {
      if (draft == null) return '/forgot-password';
      if (draft.proof != null) return '/reset-password';
    }
    if (path == '/reset-password' && draft?.proof == null) {
      return '/forgot-password';
    }
    return null;
  }

  final router = GoRouter(
    navigatorKey: _rootKey,
    initialLocation: '/',
    refreshListenable: refresh,
    redirect: redirect,
    errorBuilder: (_, _) => const SystemStateScreen(state: '404'),
    routes: [
      GoRoute(path: '/', builder: (_, _) => const WelcomeScreen()),
      GoRoute(
        path: '/login',
        builder: (_, state) => LoginScreen(
          email: state.uri.queryParameters['email'],
          result: state.uri.queryParameters['result'],
        ),
      ),
      GoRoute(
        path: '/register',
        builder: (_, state) =>
            RegisterScreen(email: state.uri.queryParameters['email']),
      ),
      GoRoute(
        path: '/verify-email',
        builder: (_, state) => VerifyEmailScreen(
          email: state.uri.queryParameters['email'] ?? '',
          sent: state.uri.queryParameters['sent'] == 'true',
        ),
      ),
      GoRoute(
        path: '/forgot-password',
        builder: (_, _) => const ForgotPasswordScreen(),
      ),
      GoRoute(
        path: '/reset-password-code',
        builder: (_, state) => ResetPasswordCodeScreen(
          sent: state.uri.queryParameters['sent'] == 'true',
        ),
      ),
      GoRoute(
        path: '/reset-password',
        builder: (_, _) => const ResetPasswordScreen(),
      ),
      StatefulShellRoute.indexedStack(
        builder: (_, _, shell) => TabShell(shell: shell),
        branches: [
          StatefulShellBranch(
            routes: [
              GoRoute(path: '/home', builder: (_, _) => const HomeScreen()),
            ],
          ),
          StatefulShellBranch(
            routes: [
              _route(
                '/discover',
                (s) =>
                    DiscoverScreen(query: s.uri.queryParameters['query'] ?? ''),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/calendar',
                builder: (_, _) => const CalendarScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/messages',
                builder: (_, _) => const MessagesScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/profile',
                builder: (_, _) => const ProfileScreen(),
              ),
            ],
          ),
        ],
      ),
      GoRoute(
        path: '/edit-profile',
        builder: (_, _) => const EditProfileScreen(),
      ),
      GoRoute(
        path: '/profiles/:userId',
        builder: (_, state) =>
            PublicProfileScreen(userId: state.pathParameters['userId']!),
      ),
      GoRoute(
        path: '/account-settings',
        builder: (_, _) => const AccountSettingsScreen(),
      ),
      GoRoute(
        path: '/account-details',
        builder: (_, _) => const AccountDetailsScreen(),
      ),
      ..._featureRoutes,
    ],
  );

  void clearStaleRecovery() {
    final draft = ref.read(passwordRecoveryProvider);
    if (draft == null) return;
    final path = router.routerDelegate.currentConfiguration.uri.path;
    final email = ref.read(accountSessionProvider)?.email.trim().toLowerCase();
    if (!_recoveryPaths.contains(path) ||
        (email != null && email != draft.email)) {
      Future.microtask(ref.read(passwordRecoveryProvider.notifier).clear);
    }
  }

  router.routerDelegate.addListener(clearStaleRecovery);
  ref.onDispose(() {
    router.routerDelegate.removeListener(clearStaleRecovery);
    router.dispose();
    refresh.dispose();
  });
  return router;
});
