import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../components/app_button.dart';
import '../../../components/app_icon.dart';
import '../../../components/dialogs.dart';
import '../../../components/misc.dart';
import '../../../components/tappable.dart';
import '../../../core/theme/tokens.dart';
import 'welcome_data.dart';

class WelcomeScreen extends StatefulWidget {
  const WelcomeScreen({super.key});

  @override
  State<WelcomeScreen> createState() => _WelcomeScreenState();
}

class _WelcomeScreenState extends State<WelcomeScreen> {
  final _scroll = ScrollController();
  final _how = GlobalKey();
  final _categories = GlobalKey();
  final _credit = GlobalKey();

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  void _scrollTo(GlobalKey key) {
    final target = key.currentContext;
    if (target == null) return;
    Scrollable.ensureVisible(
      target,
      duration: const Duration(milliseconds: 350),
      curve: Curves.easeInOut,
    );
  }

  void _onLink(String label) {
    if (label == 'Cách hoạt động') return _scrollTo(_how);
    if (label == 'Credit') return _scrollTo(_credit);
    if (label == 'Khám phá kỹ năng' || label == 'Xem tất cả') {
      return _scrollTo(_categories);
    }
    showAppDialog<void>(
      context,
      barrierColor: const Color(0x66000000),
      builder: (dialogContext) => _WelcomeNotice(
        title: label,
        onClose: () => Navigator.of(dialogContext).pop(),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final width = MediaQuery.sizeOf(context).width;
    final buttonPadding = width < 360 ? 4.0 : (width < 400 ? 8.0 : 16.0);
    Widget headerButton(String label, bool primary, VoidCallback onTap) =>
        Tappable(
          onTap: onTap,
          child: Container(
            padding: EdgeInsets.symmetric(
              horizontal: buttonPadding,
              vertical: 8,
            ),
            decoration: BoxDecoration(
              color: primary ? Palette.brand : null,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Text(
              label,
              style: nunito(
                TypeScale.body,
                weight: FontWeight.w600,
                color: primary ? Palette.white : Palette.ink,
              ),
            ),
          ),
        );
    return Scaffold(
      backgroundColor: Palette.cream,
      body: SafeArea(
        child: Column(
          children: [
            DecoratedBox(
              decoration: const BoxDecoration(
                color: Palette.cream,
                border: Border(bottom: BorderSide(color: Palette.border)),
              ),
              child: Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: Layout.maxWidth),
                  child: SizedBox(
                    height: 64,
                    child: Padding(
                      padding: EdgeInsets.symmetric(
                        horizontal: width < 360 ? 12 : Layout.gutter,
                      ),
                      child: Row(
                        spacing: 8,
                        children: [
                          Tappable(
                            semanticLabel: 'SkillHub — về đầu trang',
                            onTap: () => _scroll.animateTo(
                              0,
                              duration: const Duration(milliseconds: 350),
                              curve: Curves.easeInOut,
                            ),
                            child: const BrandLogo(),
                          ),
                          const Spacer(),
                          if (width >= 768) ...[
                            Tappable(
                              onTap: () => _scrollTo(_categories),
                              child: _navText('Khám phá'),
                            ),
                            const SizedBox(width: 16),
                            Tappable(
                              onTap: () => _scrollTo(_how),
                              child: _navText('Cách hoạt động'),
                            ),
                            const Spacer(),
                          ],
                          headerButton(
                            'Đăng nhập',
                            false,
                            () => context.push('/login'),
                          ),
                          headerButton(
                            'Đăng ký',
                            true,
                            () => context.push('/register'),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
            Expanded(
              child: SingleChildScrollView(
                controller: _scroll,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    _Hero(
                      onRegister: () => context.push('/register'),
                      onExplore: () => _scrollTo(_categories),
                    ),
                    _Sections(
                      howKey: _how,
                      categoriesKey: _categories,
                      creditKey: _credit,
                      onRegister: () => context.push('/register'),
                      onLink: _onLink,
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _navText(String label) => Text(
    label,
    style: const TextStyle(
      fontFamily: Fonts.nunito,
      fontWeight: FontWeight.w600,
      fontSize: 14,
      color: Palette.muted,
    ),
  );
}

class _Container extends StatelessWidget {
  const _Container({
    super.key,
    required this.child,
    this.maxWidth = Layout.maxWidth,
    this.vertical = 0,
  });

  final Widget child;
  final double maxWidth;
  final double vertical;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: ConstrainedBox(
        constraints: BoxConstraints(maxWidth: maxWidth),
        child: Padding(
          padding: EdgeInsets.symmetric(
            horizontal: Layout.gutter,
            vertical: vertical,
          ),
          child: child,
        ),
      ),
    );
  }
}

class _Hero extends StatelessWidget {
  const _Hero({required this.onRegister, required this.onExplore});

  final VoidCallback onRegister;
  final VoidCallback onExplore;

  @override
  Widget build(BuildContext context) {
    final width = MediaQuery.sizeOf(context).width;
    final wide = width >= 1024;
    final titleScale = wide ? (46.0, 56.0) : (34.0, 42.0);
    final actions = [
      AppButton(label: 'Bắt đầu miễn phí', size: ButtonSize.lg, onPressed: onRegister),
      AppButton(
        variant: ButtonVariant.secondary,
        size: ButtonSize.lg,
        onPressed: onExplore,
        child: Row(
          mainAxisSize: MainAxisSize.min,
          spacing: 8,
          children: [
            const AppIcon(AppIcon.compass, color: Palette.inkSoft),
            Text(
              'Khám phá SkillHub',
              style: nunito(
                (16, 24),
                weight: FontWeight.w600,
                color: Palette.inkSoft,
              ),
            ),
          ],
        ),
      ),
    ];
    final copy = Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: 20,
      children: [
        Align(
          alignment: Alignment.centerLeft,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
            decoration: BoxDecoration(
              color: Palette.brandLight,
              borderRadius: BorderRadius.circular(100),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              spacing: 8,
              children: [
                const AppIcon(AppIcon.zap, size: 14),
                Flexible(
                  child: Text(
                    'Cộng đồng học kỹ năng 1:1',
                    style: nunito(
                      TypeScale.body,
                      weight: FontWeight.w600,
                      color: Palette.brand,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
        Semantics(
          header: true,
          child: Text.rich(
            const TextSpan(
              text: 'Chia sẻ điều\nbạn biết.\n',
              children: [
                TextSpan(
                  text: 'Học điều',
                  style: TextStyle(color: Palette.brand),
                ),
                TextSpan(text: '\nbạn muốn.'),
              ],
            ),
            style: nunito(
              titleScale,
              weight: FontWeight.w700,
              color: Palette.ink,
            ),
          ),
        ),
        ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 448),
          child: Text(
            'Kết nối với những người có kỹ năng phù hợp, cùng tạo lộ trình và học trực tiếp 1:1.',
            style: nunito((16, 24), color: Palette.body),
          ),
        ),
        if (width >= 640)
          Row(
            spacing: 12,
            children: [for (final action in actions) action],
          )
        else
          Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            spacing: 12,
            children: actions,
          ),
        Padding(
          padding: const EdgeInsets.only(top: 4),
          child: Wrap(
            crossAxisAlignment: WrapCrossAlignment.center,
            spacing: width < 360 ? 12 : 20,
            runSpacing: 12,
            children: [
              for (var i = 0; i < welcomeStats.length; i++) ...[
                if (i > 0)
                  Container(width: 1, height: 32, color: Palette.border),
                Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      welcomeStats[i].$1,
                      style: nunito(
                        (20, 26),
                        weight: FontWeight.w700,
                        color: Palette.brand,
                      ),
                    ),
                    Text(
                      welcomeStats[i].$2,
                      style: nunito(TypeScale.secondary, color: Palette.muted),
                    ),
                  ],
                ),
              ],
            ],
          ),
        ),
      ],
    );
    return _Container(
      vertical: 48,
      child: wide
          ? Row(
              spacing: 56,
              children: [
                Expanded(child: copy),
                const Expanded(child: _Visual()),
              ],
            )
          : Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              spacing: 32,
              children: [copy, const _Visual()],
            ),
    );
  }
}

class _WelcomeAvatar extends StatelessWidget {
  const _WelcomeAvatar(this.name);

  final String name;

  @override
  Widget build(BuildContext context) {
    final initials = name
        .split(' ')
        .take(2)
        .map((word) => word.isEmpty ? '' : word[0])
        .join();
    return Container(
      width: 32,
      height: 32,
      alignment: Alignment.center,
      decoration: const BoxDecoration(
        color: Palette.brandMuted,
        shape: BoxShape.circle,
      ),
      child: Text(
        initials,
        style: fraunces(12, 16, weight: FontWeight.w700, color: Palette.brand),
      ),
    );
  }
}

class _Stars extends StatelessWidget {
  const _Stars({this.size = 14});

  final double size;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        for (var i = 0; i < 5; i++)
          AppIcon(AppIcon.star, color: Palette.star, size: size),
      ],
    );
  }
}

class _Visual extends StatelessWidget {
  const _Visual();

  @override
  Widget build(BuildContext context) {
    final cardDecoration = BoxDecoration(
      color: Palette.white,
      borderRadius: BorderRadius.circular(Radii.card),
      border: Border.all(color: Palette.border),
      boxShadow: Shadows.md,
    );
    final cardTitle = nunito(
      TypeScale.secondary,
      weight: FontWeight.w700,
      color: Palette.ink,
    );
    return Column(
      children: [
        Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 400),
            child: AspectRatio(
              aspectRatio: 4 / 5,
              child: Stack(
                clipBehavior: Clip.none,
                children: [
                  Positioned(
                    top: -12,
                    bottom: -12,
                    left: -12,
                    right: -12,
                    child: Transform.rotate(
                      angle: 0.035,
                      child: Container(
                        decoration: BoxDecoration(
                          border: Border.all(color: Palette.borderDark),
                          borderRadius: BorderRadius.circular(32),
                        ),
                      ),
                    ),
                  ),
                  Positioned.fill(
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(24),
                      child: Stack(
                        fit: StackFit.expand,
                        children: [
                          Semantics(
                            image: true,
                            label: 'Hai người bạn cùng học qua máy tính xách tay',
                            child: Image.asset(
                              'assets/images/welcome-study.jpg',
                              fit: BoxFit.cover,
                            ),
                          ),
                          const DecoratedBox(
                            decoration: BoxDecoration(
                              gradient: LinearGradient(
                                begin: Alignment.topCenter,
                                end: Alignment.bottomCenter,
                                colors: [
                                  Color(0x0DFAF7F2),
                                  Color(0x00000000),
                                  Color(0x8C1C1410),
                                ],
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  Positioned(
                    top: 28,
                    left: -12,
                    child: Container(
                      width: 192,
                      padding: const EdgeInsets.all(16),
                      decoration: cardDecoration,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        spacing: 8,
                        children: [
                          Row(
                            spacing: 8,
                            children: [
                              _WelcomeAvatar(welcomeMentor.name),
                              Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(welcomeMentor.title, style: cardTitle),
                                  const _Stars(size: 10),
                                ],
                              ),
                            ],
                          ),
                          Text(
                            welcomeMentor.quote,
                            style: nunito(
                              TypeScale.caption,
                              color: Palette.muted,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  Positioned(
                    bottom: 28,
                    right: -12,
                    child: Container(
                      width: 192,
                      padding: const EdgeInsets.all(16),
                      decoration: cardDecoration,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(welcomeSession.title, style: cardTitle),
                          const SizedBox(height: 4),
                          Text(
                            welcomeSession.schedule,
                            style: nunito(
                              TypeScale.caption,
                              weight: FontWeight.w600,
                              color: Palette.brand,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Row(
                            spacing: 4,
                            children: [
                              Container(
                                width: 8,
                                height: 8,
                                decoration: const BoxDecoration(
                                  color: Palette.success,
                                  shape: BoxShape.circle,
                                ),
                              ),
                              Text(
                                welcomeSession.status,
                                style: nunito(
                                  TypeScale.caption,
                                  weight: FontWeight.w600,
                                  color: Palette.success,
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),
                  Positioned(
                    bottom: 28,
                    left: 24,
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 208),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        spacing: 8,
                        children: [
                          Text(
                            '“Học cùng nhau, tiến bộ thật.”',
                            style: nunito(
                              (20, 26),
                              weight: FontWeight.w600,
                              color: Palette.white,
                            ),
                          ),
                          Text(
                            'Kết nối 1:1 theo lộ trình rõ ràng',
                            style: nunito(
                              TypeScale.secondary,
                              color: const Color(0xCCFFFFFF),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
        const SizedBox(height: 16),
        Text(
          'Ảnh: Kateryna Hliznitsova / Unsplash',
          textAlign: TextAlign.center,
          style: nunito(TypeScale.caption, color: Palette.muted),
        ),
      ],
    );
  }
}

class _Sections extends StatelessWidget {
  const _Sections({
    required this.howKey,
    required this.categoriesKey,
    required this.creditKey,
    required this.onRegister,
    required this.onLink,
  });

  final GlobalKey howKey;
  final GlobalKey categoriesKey;
  final GlobalKey creditKey;
  final VoidCallback onRegister;
  final ValueChanged<String> onLink;

  static final _heading = nunito(
    (26, 32),
    weight: FontWeight.w700,
    color: Palette.ink,
  );
  static final _subtitle = nunito((16, 24), color: Palette.muted);

  @override
  Widget build(BuildContext context) {
    final tablet = MediaQuery.sizeOf(context).width >= 768;
    Widget responsive(List<Widget> children, double gap) => tablet
        ? Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            spacing: gap,
            children: [for (final child in children) Expanded(child: child)],
          )
        : Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            spacing: gap,
            children: children,
          );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(
          key: howKey,
          decoration: const BoxDecoration(
            color: Palette.white,
            border: Border.symmetric(
              horizontal: BorderSide(color: Palette.border),
            ),
          ),
          padding: const EdgeInsets.symmetric(vertical: Layout.sectionPadding),
          child: _Container(
            child: Column(
              children: [
                Text(
                  'SkillHub hoạt động như thế nào?',
                  textAlign: TextAlign.center,
                  style: _heading,
                ),
                const SizedBox(height: 8),
                Text(
                  'Đơn giản, minh bạch, hiệu quả.',
                  textAlign: TextAlign.center,
                  style: _subtitle,
                ),
                const SizedBox(height: 48),
                responsive([
                  for (final (step, icon, title, description) in welcomeSteps)
                    Column(
                      spacing: 16,
                      children: [
                        SizedBox(
                          width: 64,
                          height: 64,
                          child: Stack(
                            clipBehavior: Clip.none,
                            children: [
                              Container(
                                decoration: BoxDecoration(
                                  color: Palette.brandLight,
                                  borderRadius: BorderRadius.circular(16),
                                ),
                                alignment: Alignment.center,
                                child: AppIcon(icon, size: 28),
                              ),
                              Positioned(
                                top: -8,
                                right: -8,
                                child: Container(
                                  width: 24,
                                  height: 24,
                                  alignment: Alignment.center,
                                  decoration: const BoxDecoration(
                                    color: Palette.brand,
                                    shape: BoxShape.circle,
                                  ),
                                  child: Text(
                                    step,
                                    style: const TextStyle(
                                      fontFamily: Fonts.nunito,
                                      fontWeight: FontWeight.w700,
                                      fontSize: 12,
                                      color: Palette.white,
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                        Text(
                          title,
                          style: nunito(
                            (18, 24),
                            weight: FontWeight.w700,
                            color: Palette.ink,
                          ),
                        ),
                        Text(
                          description,
                          textAlign: TextAlign.center,
                          style: nunito(TypeScale.body, color: Palette.muted),
                        ),
                      ],
                    ),
                ], 32),
              ],
            ),
          ),
        ),
        _Container(
          key: categoriesKey,
          vertical: Layout.sectionPadding,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                spacing: 8,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      spacing: 4,
                      children: [
                        Text('Khám phá kỹ năng', style: _heading),
                        Text(
                          'Từ kỹ thuật đến sáng tạo, từ kinh doanh đến nghệ thuật.',
                          style: _subtitle,
                        ),
                      ],
                    ),
                  ),
                  AppButton(
                    variant: ButtonVariant.ghost,
                    size: ButtonSize.sm,
                    onPressed: () => onLink('Xem tất cả'),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      spacing: 8,
                      children: [
                        Text(
                          'Xem tất cả',
                          style: nunito(
                            TypeScale.body,
                            weight: FontWeight.w600,
                            color: Palette.inkSoft,
                          ),
                        ),
                        const AppIcon(
                          AppIcon.arrow,
                          size: 16,
                          color: Palette.inkSoft,
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 32),
              LayoutBuilder(
                builder: (context, constraints) {
                  final columns = tablet ? 4 : 2;
                  final width =
                      (constraints.maxWidth - 16 * (columns - 1)) / columns;
                  return Wrap(
                    spacing: 16,
                    runSpacing: 16,
                    children: [
                      for (final (title, description, color, icon)
                          in welcomeCategories)
                        SizedBox(
                          width: width,
                          child: Tappable(
                            pressedOpacity: 0.7,
                            semanticLabel: '$title: $description',
                            onTap: () => onLink(title),
                            child: Container(
                              padding: const EdgeInsets.all(20),
                              decoration: BoxDecoration(
                                color: Palette.white,
                                border: Border.all(color: Palette.border),
                                borderRadius: BorderRadius.circular(Radii.card),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  AppIcon(icon, color: color, size: 24),
                                  const SizedBox(height: 12),
                                  Text(
                                    title,
                                    style: nunito(
                                      TypeScale.body,
                                      weight: FontWeight.w600,
                                      color: Palette.ink,
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    description,
                                    style: nunito(
                                      TypeScale.secondary,
                                      color: color,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ),
                    ],
                  );
                },
              ),
            ],
          ),
        ),
        Container(
          key: creditKey,
          color: Palette.ink,
          padding: const EdgeInsets.symmetric(vertical: Layout.sectionPadding),
          child: _Container(
            maxWidth: 896,
            child: responsive([
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                spacing: 24,
                children: [
                  Text(
                    'Credit là gì?',
                    style: _heading.copyWith(color: Palette.white),
                  ),
                  Text(
                    'Credit là đơn vị trao đổi trên SkillHub. Credit được tạm giữ và chỉ quyết toán khi toàn bộ lộ trình hoàn thành.',
                    style: nunito((16, 26), color: Palette.mutedLight),
                  ),
                  Column(
                    spacing: 12,
                    children: [
                      for (final benefit in welcomeBenefits)
                        Row(
                          spacing: 12,
                          children: [
                            Container(
                              width: 20,
                              height: 20,
                              alignment: Alignment.center,
                              decoration: const BoxDecoration(
                                color: Palette.brand,
                                shape: BoxShape.circle,
                              ),
                              child: const AppIcon(
                                AppIcon.check,
                                color: Palette.white,
                                size: 12,
                              ),
                            ),
                            Expanded(
                              child: Text(
                                benefit,
                                style: nunito(
                                  TypeScale.body,
                                  color: Palette.border,
                                ),
                              ),
                            ),
                          ],
                        ),
                    ],
                  ),
                  AppButton(
                    label: 'Nhận 50 Credit miễn phí',
                    variant: ButtonVariant.secondary,
                    onPressed: onRegister,
                  ),
                ],
              ),
              Container(
                padding: const EdgeInsets.all(32),
                decoration: BoxDecoration(
                  color: Palette.inkSoft,
                  borderRadius: BorderRadius.circular(Radii.card),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  spacing: 16,
                  children: [
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: Palette.ink,
                        borderRadius: BorderRadius.circular(Radii.card),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        spacing: 8,
                        children: [
                          Flexible(
                            child: Text(
                              'Số dư hiện tại',
                              style: nunito(
                                TypeScale.body,
                                color: Palette.mutedLight,
                              ),
                            ),
                          ),
                          Text(
                            welcomeBalance,
                            style: nunito(
                              (24, 32),
                              weight: FontWeight.w700,
                              color: Palette.brand,
                            ),
                          ),
                        ],
                      ),
                    ),
                    Column(
                      spacing: 8,
                      children: [
                        for (final (label, amount, color) in welcomeTransactions)
                          Padding(
                            padding: const EdgeInsets.symmetric(vertical: 8),
                            child: Row(
                              spacing: 8,
                              children: [
                                Expanded(
                                  child: Text(
                                    label,
                                    style: nunito(
                                      TypeScale.body,
                                      color: Palette.mutedLight,
                                    ),
                                  ),
                                ),
                                Text(
                                  amount,
                                  style: nunito(
                                    TypeScale.body,
                                    weight: FontWeight.w600,
                                    color: color,
                                  ),
                                ),
                              ],
                            ),
                          ),
                      ],
                    ),
                  ],
                ),
              ),
            ], 48),
          ),
        ),
        _Container(
          vertical: Layout.sectionPadding,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                'Cộng đồng tin tưởng SkillHub',
                textAlign: TextAlign.center,
                style: _heading,
              ),
              const SizedBox(height: 40),
              responsive([
                for (final (name, role, text) in welcomeReviews)
                  Container(
                    padding: const EdgeInsets.all(24),
                    decoration: BoxDecoration(
                      color: Palette.white,
                      border: Border.all(color: Palette.border),
                      borderRadius: BorderRadius.circular(Radii.card),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      spacing: 16,
                      children: [
                        const _Stars(),
                        Text(
                          text,
                          style: nunito(
                            TypeScale.body,
                            color: Palette.body,
                            style: FontStyle.italic,
                          ),
                        ),
                        Row(
                          spacing: 12,
                          children: [
                            _WelcomeAvatar(name),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    name,
                                    style: nunito(
                                      TypeScale.body,
                                      weight: FontWeight.w600,
                                      color: Palette.ink,
                                    ),
                                  ),
                                  Text(
                                    role,
                                    style: nunito(
                                      TypeScale.secondary,
                                      color: Palette.muted,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
              ], 24),
            ],
          ),
        ),
        Container(
          color: Palette.brand,
          padding: const EdgeInsets.symmetric(vertical: Layout.sectionPadding),
          child: _Container(
            maxWidth: 672,
            child: Column(
              spacing: 24,
              children: [
                Text(
                  'Bắt đầu hành trình của bạn ngay hôm nay',
                  textAlign: TextAlign.center,
                  style: _heading.copyWith(color: Palette.white),
                ),
                Text(
                  'Miễn phí đăng ký. 50 Credit chào mừng. Không cần thẻ ngân hàng.',
                  textAlign: TextAlign.center,
                  style: nunito((18, 28), color: Palette.brandLight),
                ),
                AppButton(
                  label: 'Tạo tài khoản miễn phí',
                  variant: ButtonVariant.white,
                  size: ButtonSize.xl,
                  onPressed: onRegister,
                ),
              ],
            ),
          ),
        ),
        Container(
          decoration: const BoxDecoration(
            border: Border(top: BorderSide(color: Palette.border)),
          ),
          padding: const EdgeInsets.symmetric(vertical: 40),
          child: _Container(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                responsive([
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    spacing: 12,
                    children: [
                      const BrandLogo(compact: true),
                      Text(
                        'Nền tảng trao đổi kỹ năng 1:1 dành cho cộng đồng Việt Nam.',
                        style: nunito(TypeScale.secondary, color: Palette.muted),
                      ),
                    ],
                  ),
                  for (final (title, links) in welcomeFooter)
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          title,
                          style: nunito(
                            TypeScale.body,
                            weight: FontWeight.w600,
                            color: Palette.ink,
                          ),
                        ),
                        const SizedBox(height: 12),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          spacing: 8,
                          children: [
                            for (final link in links)
                              Tappable(
                                onTap: () => onLink(link),
                                child: Text(
                                  link,
                                  style: nunito(
                                    TypeScale.secondary,
                                    color: Palette.muted,
                                  ),
                                ),
                              ),
                          ],
                        ),
                      ],
                    ),
                ], 32),
                const SizedBox(height: 32),
                Container(
                  padding: const EdgeInsets.only(top: 24),
                  decoration: const BoxDecoration(
                    border: Border(top: BorderSide(color: Palette.border)),
                  ),
                  child: Text(
                    '© 2024 SkillHub. Phát triển tại Việt Nam.',
                    textAlign: TextAlign.center,
                    style: nunito(TypeScale.secondary, color: Palette.muted),
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _WelcomeNotice extends StatelessWidget {
  const _WelcomeNotice({required this.title, required this.onClose});

  final String title;
  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      constraints: const BoxConstraints(maxWidth: 384),
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: Palette.white,
        borderRadius: BorderRadius.circular(Radii.card),
        boxShadow: Shadows.lg,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        spacing: 24,
        children: [
          Text(
            title,
            textAlign: TextAlign.center,
            style: nunito(
              TypeScale.title,
              weight: FontWeight.w700,
              color: Palette.ink,
            ),
          ),
          Text(
            'Màn này sẽ được triển khai tiếp theo. Hiện bạn có thể khám phá màn chào SkillHub.',
            textAlign: TextAlign.center,
            style: nunito(TypeScale.body, color: Palette.muted),
          ),
          AppButton(label: 'Quay lại màn chào', onPressed: onClose),
        ],
      ),
    );
  }
}
