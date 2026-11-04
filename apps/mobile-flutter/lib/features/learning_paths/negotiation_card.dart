import 'package:flutter/material.dart';

import '../../components/app_button.dart';
import '../../components/app_icon.dart';
import '../../components/feature_page.dart';
import '../../components/misc.dart';
import '../../components/tappable.dart';
import '../../core/theme/tokens.dart';
import 'negotiation_message.dart';

/// Compact, expandable card for a path negotiation chat message.
class NegotiationSuggestionCard extends StatefulWidget {
  const NegotiationSuggestionCard({
    super.key,
    required this.suggestion,
    required this.mine,
    this.onOpenPath,
    this.onApply,
    this.expandedByDefault = false,
  });

  final PathNegotiationSuggestion suggestion;
  final bool mine;
  final VoidCallback? onOpenPath;
  final VoidCallback? onApply;
  final bool expandedByDefault;

  @override
  State<NegotiationSuggestionCard> createState() =>
      _NegotiationSuggestionCardState();
}

class _NegotiationSuggestionCardState extends State<NegotiationSuggestionCard> {
  late var _expanded = widget.expandedByDefault;

  @override
  Widget build(BuildContext context) {
    final suggestion = widget.suggestion;
    return Align(
      alignment: widget.mine ? Alignment.centerRight : Alignment.centerLeft,
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 340),
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(AppRadii.card),
            border: Border.all(color: AppColors.border),
            boxShadow: const [
              BoxShadow(
                color: Color(0x0A352B1F),
                offset: Offset(0, 3),
                blurRadius: 12,
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            spacing: 10,
            children: [
              Row(
                spacing: 8,
                children: [
                  Container(
                    width: 28,
                    height: 28,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: AppColors.primarySoft,
                      borderRadius: BorderRadius.circular(AppRadii.control),
                    ),
                    child: const AppIcon(
                      AppIcon.clipboard,
                      size: 16,
                      color: AppColors.primary,
                    ),
                  ),
                  Expanded(
                    child: Text(
                      'Gợi ý lộ trình',
                      style: nunito(
                        TypeScale.secondary,
                        weight: FontWeight.w700,
                        color: AppColors.ink,
                      ),
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 4,
                    ),
                    decoration: BoxDecoration(
                      color: AppColors.primarySoft,
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Text(
                      'Chưa xác nhận',
                      style: nunito(
                        TypeScale.caption,
                        weight: FontWeight.w600,
                        color: AppColors.primary,
                      ),
                    ),
                  ),
                ],
              ),
              Text(
                suggestion.goal,
                maxLines: _expanded ? null : 2,
                overflow: _expanded ? null : TextOverflow.ellipsis,
                style: nunito(
                  TypeScale.body,
                  weight: FontWeight.w700,
                  color: AppColors.ink,
                ),
              ),
              Text(
                suggestion.skill,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: nunito(TypeScale.secondary, color: AppColors.body),
              ),
              Wrap(
                spacing: 6,
                runSpacing: 6,
                children: [
                  _Chip(label: suggestion.exchangeLabel),
                  _Chip(label: '${suggestion.credit} CR'),
                  if (suggestion.sessions.isNotEmpty)
                    _Chip(label: '${suggestion.sessions.length} buổi'),
                ],
              ),
              if (_expanded) ...[
                Text(
                  suggestion.directionLabel,
                  style: nunito(TypeScale.secondary, color: AppColors.muted),
                ),
                if (suggestion.sessions.isNotEmpty)
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: AppColors.surfaceLow,
                      borderRadius: BorderRadius.circular(AppRadii.control),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      spacing: 6,
                      children: [
                        for (var i = 0; i < suggestion.sessions.length; i++)
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            spacing: 8,
                            children: [
                              Text(
                                '${i + 1}',
                                style: nunito(
                                  TypeScale.caption,
                                  weight: FontWeight.w700,
                                  color: AppColors.primary,
                                ),
                              ),
                              Expanded(
                                child: Text(
                                  suggestion.sessions[i],
                                  style: nunito(
                                    TypeScale.secondary,
                                    color: AppColors.ink,
                                  ),
                                ),
                              ),
                            ],
                          ),
                      ],
                    ),
                  ),
                const Copy(
                  'Chỉ là thương lượng trong Chat — chưa tạo lộ trình và chưa giữ Credit.',
                  muted: true,
                ),
                if (widget.onApply != null)
                  AppButton(
                    label: 'Dùng gợi ý này để tạo lộ trình',
                    variant: ButtonVariant.craft,
                    onPressed: widget.onApply,
                  ),
                if (widget.onOpenPath != null)
                  AppButton(
                    label: 'Mở màn lộ trình học',
                    variant: ButtonVariant.paper,
                    onPressed: widget.onOpenPath,
                  ),
              ],
              Tappable(
                semanticLabel: _expanded ? 'Thu gọn gợi ý' : 'Xem gợi ý',
                onTap: () => setState(() => _expanded = !_expanded),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      widget.mine ? 'Bạn gửi' : 'Đối tác gửi',
                      style: nunito(
                        TypeScale.caption,
                        weight: FontWeight.w600,
                        color: AppColors.muted,
                      ),
                    ),
                    Row(
                      spacing: 4,
                      children: [
                        Text(
                          _expanded ? 'Thu gọn' : 'Xem gợi ý',
                          style: nunito(
                            TypeScale.secondary,
                            weight: FontWeight.w700,
                            color: AppColors.primary,
                          ),
                        ),
                        Transform.rotate(
                          angle: _expanded ? -1.5708 : 1.5708,
                          child: const AppIcon(
                            AppIcon.chevron,
                            size: 14,
                            color: AppColors.primary,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Compact summary used on the official path agreement screen.
class NegotiationInboxPanel extends StatelessWidget {
  const NegotiationInboxPanel({
    super.key,
    required this.suggestion,
    required this.onApply,
    required this.onOpenChat,
  });

  final PathNegotiationSuggestion suggestion;
  final VoidCallback onApply;
  final VoidCallback onOpenChat;

  @override
  Widget build(BuildContext context) {
    return Panel(
      title: 'Gợi ý từ Chat',
      children: [
        const FormNotice(
          tone: NoticeTone.info,
          message:
              'Đã có gợi ý thương lượng trong cuộc trò chuyện. Có thể dùng để điền hình thức và Credit trước khi tạo lộ trình chính thức.',
        ),
        Text(
          suggestion.goal,
          style: nunito(
            TypeScale.body,
            weight: FontWeight.w700,
            color: AppColors.ink,
          ),
        ),
        Copy('${suggestion.skill} · ${suggestion.exchangeLabel} · ${suggestion.credit} CR'),
        if (suggestion.sessions.isNotEmpty)
          Copy(
            '${suggestion.sessions.length} buổi dự kiến: ${suggestion.sessions.take(3).join(' · ')}${suggestion.sessions.length > 3 ? '…' : ''}',
            muted: true,
          ),
        AppButton(
          label: 'Áp dụng gợi ý vào form bên dưới',
          variant: ButtonVariant.craft,
          onPressed: onApply,
        ),
        AppButton(
          label: 'Xem lại trong Chat',
          variant: ButtonVariant.paper,
          onPressed: onOpenChat,
        ),
      ],
    );
  }
}

class _Chip extends StatelessWidget {
  const _Chip({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: AppColors.surfaceLow,
        borderRadius: BorderRadius.circular(AppRadii.badge),
        border: Border.all(color: AppColors.border),
      ),
      child: Text(
        label,
        style: nunito(
          TypeScale.caption,
          weight: FontWeight.w600,
          color: AppColors.body,
        ),
      ),
    );
  }
}
