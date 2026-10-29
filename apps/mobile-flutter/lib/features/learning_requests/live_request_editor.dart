import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../components/app_button.dart';
import '../../components/app_input.dart';
import '../../components/feature_page.dart';
import '../../components/misc.dart';
import '../../core/theme/tokens.dart';
import '../auth/session/auth_session.dart';
import '../remote/refresh_signal.dart';
import '../shell/app_screen_layout.dart';
import '../remote/remote_load.dart';
import '../skills/schema/skill_schema.dart';
import '../skills/skills_feature.dart';
import 'requests_state.dart';
import 'schema/learning_request_schema.dart';

const _editable = ['DRAFT', 'OPEN', 'PENDING_MODERATION', 'REJECTED'];
const _levels = ['NONE', 'BEGINNER', 'INTERMEDIATE', 'ADVANCED'];
const _clock = r'^(?:[01]\d|2[0-3]):[0-5]\d$';

String deviceTimeZone() {
  return DateTime.now().timeZoneOffset.inHours == 7
      ? 'Asia/Ho_Chi_Minh'
      : 'Asia/Ho_Chi_Minh';
}

String timeZoneNote(String zone) {
  final hours = DateTime.now().timeZoneOffset.inHours;
  final sign = hours >= 0 ? '+' : '';
  if (zone == deviceTimeZone()) return 'Giờ theo thiết bị · GMT$sign$hours';
  return 'Giờ theo lịch đã lưu · ${zone.replaceAll('_', ' ')}';
}

String? _creditRule(String value) {
  final text = value.trim();
  if (text.isEmpty) return null;
  if (!RegExp(r'^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$').hasMatch(text)) {
    return 'Nhập Credit bằng số, tối đa 10 chữ số nguyên và 2 chữ số thập phân.';
  }
  if (num.parse(text) <= 0) return 'Credit mong muốn phải lớn hơn 0.';
  return null;
}

String? _overviewRule(String value) {
  final text = value.trim();
  if (text.isEmpty) return null;
  if (text.runes.length < 20 || text.runes.length > 3000) {
    return 'Nhập từ 20 đến 3000 ký tự khi điền.';
  }
  return null;
}

String normalizeCredit(String value) {
  final parts = value.trim().split('.');
  final fraction = parts.length > 1 ? parts[1].padRight(2, '0') : '00';
  return '${parts.first}.$fraction';
}

final _skillSearchProvider = FutureProvider.family<List<SkillRecord>, String>((
  ref,
  keyword,
) async {
  if (keyword.runes.length < 2) return const [];
  final page = await ref
      .read(authRuntimeProvider)
      .services
      .skills
      .catalog(q: keyword, limit: 20);
  return [
    for (final item in page.items)
      if (item.status == 'ACTIVE') item,
  ];
});

final _tagsCatalogProvider = FutureProvider<List<TagRecord>>((ref) async {
  if (ref.watch(sessionSnapshotProvider).phase != SessionPhase.ready) {
    return const [];
  }
  return drainPages(
    (cursor) =>
        ref.read(authRuntimeProvider).services.skills.tags(cursor: cursor, limit: 50),
  );
});

class LiveRequestEditor extends ConsumerStatefulWidget {
  const LiveRequestEditor({super.key, this.id});

  final String? id;

  @override
  ConsumerState<LiveRequestEditor> createState() => _LiveRequestEditorState();
}

class _LiveRequestEditorState extends ConsumerState<LiveRequestEditor> {
  String? _loadedKey;
  late final _title = AppField(validator: textRule(10, 120));
  late final _description = AppField(validator: textRule(20, 3000));
  late final _goal = AppField(validator: textRule(10, 1000));
  late final _overview = AppField(validator: _overviewRule);
  late final _credit = AppField(validator: _creditRule);
  String _skillId = '';
  String _skillName = '';
  String _level = '';
  var _verified = false;
  final _tagIds = <String>[];
  final _offeringIds = <String>[];
  var _weekly = <WeeklySlot>[];
  var _savedSlots = <PreferredSlot>[];
  DateTime? _expiresAt;
  String _timeZone = deviceTimeZone();
  String _error = '';
  var _saving = false;
  var _skillOpen = false;
  var _tagOpen = false;
  var _offeringOpen = false;
  final _skillQuery = TextEditingController();
  final _tagQuery = TextEditingController();
  Timer? _skillDebounce;
  String _skillKeyword = '';

  @override
  void dispose() {
    _skillDebounce?.cancel();
    _title.dispose();
    _description.dispose();
    _goal.dispose();
    _overview.dispose();
    _credit.dispose();
    _skillQuery.dispose();
    _tagQuery.dispose();
    super.dispose();
  }

  void update([VoidCallback? fn]) {
    if (!mounted) return;
    setState(fn ?? () {});
  }

  void _sync(OwnRequest? request) {
    if (widget.id != null && request == null) return;
    final key = request == null ? 'new' : '${request.id}@${request.version}';
    if (_loadedKey == key) return;
    _loadedKey = key;
    _title.text = request?.title ?? '';
    _description.text = request?.description ?? '';
    _goal.text = request?.goal ?? '';
    _overview.text = request?.teachingOverview ?? '';
    _credit.text = request?.desiredCreditPerHour ?? '';
    _skillId = request?.skillId ?? '';
    _skillName = request?.skill ?? '';
    _level = request?.level ?? '';
    _verified = request?.verifiedTeacherOnly ?? false;
    _tagIds
      ..clear()
      ..addAll(request?.tagIds ?? const []);
    _offeringIds
      ..clear()
      ..addAll(request?.offeredSharingSkillIds ?? const []);
    _weekly = [
      ...request?.preferredAvailability?.weeklySlots ?? const <WeeklySlot>[],
    ];
    _savedSlots = [...request?.preferredSlots ?? const <PreferredSlot>[]];
    _expiresAt = request?.expiresAt;
    _timeZone = request?.preferredAvailability?.timeZone ?? deviceTimeZone();
  }

  Future<void> _save(OwnRequest? current) async {
    if (_saving) return;
    final fields = [_title, _description, _goal, _overview, _credit];
    if (!validateFields(fields)) return;
    if (_skillId.isEmpty) {
      setState(() => _error = 'Chọn một kỹ năng trong danh mục.');
      return;
    }
    final weeklyError = _weeklyError(_weekly);
    if (weeklyError != null) {
      setState(() => _error = weeklyError);
      return;
    }
    if (_expiresAt != null && !_expiresAt!.isAfter(DateTime.now())) {
      setState(() => _error = 'Chọn ngày và giờ trong tương lai cho hạn yêu cầu.');
      return;
    }
    setState(() {
      _saving = true;
      _error = '';
    });
    final credit = _credit.text.trim();
    final overview = _overview.text.trim();
    final result = await ref.read(requestsProvider.notifier).save(
      OwnRequest(
        id: current?.id ?? '',
        title: _title.text.trim(),
        skill: _skillName,
        skillId: _skillId,
        description: _description.text.trim(),
        goal: _goal.text.trim(),
        level: _level,
        status: current?.status ?? 'DRAFT',
        version: current?.version ?? 1,
        tagIds: [..._tagIds],
        tags: current?.tags ?? const [],
        preferredSlots: _weekly.isEmpty ? _savedSlots : const [],
        teachingOverview: overview.isEmpty ? null : overview,
        offeredSharingSkillIds: [..._offeringIds],
        verifiedTeacherOnly: _verified,
        desiredCreditPerHour: credit.isEmpty ? null : normalizeCredit(credit),
        preferredAvailability: _weekly.isEmpty
            ? null
            : PreferredAvailability(timeZone: _timeZone, weeklySlots: _weekly),
        expiresAt: _expiresAt,
        publishedAt: current?.publishedAt,
      ),
      creating: current == null,
    );
    if (!mounted) return;
    setState(() => _saving = false);
    if (result.error != null) {
      setState(() => _error = result.error!);
      return;
    }
    context.pushReplacement('/requests/${result.id}');
  }

  @override
  Widget build(BuildContext context) {
    ref.watch(requestsProvider);
    final request = ref.read(requestsProvider.notifier).find(widget.id);
    _sync(request);
    final blocked =
        widget.id != null &&
        (request == null || !_editable.contains(request.status));
    final creating = widget.id == null;
    return AppScreenLayout(
      title: creating ? 'Tạo yêu cầu học' : 'Sửa yêu cầu học',
      selected: 'Hồ sơ',
      back: (route: '/requests', label: 'Quay lại'),
      rightAction: creating || request?.status == 'DRAFT'
          ? Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: Palette.warningLight,
                borderRadius: BorderRadius.circular(20),
              ),
              child: Text(
                'Bản nháp',
                style: nunito(
                  TypeScale.caption,
                  weight: FontWeight.w700,
                  color: AppColors.primary,
                ),
              ),
            )
          : null,
      child: blocked
          ? const EmptyState(
              title: 'Không thể chỉnh sửa',
              description: 'Yêu cầu không còn ở trạng thái cho phép sửa.',
            )
          : Column(
              children: [
                Expanded(
                  child: RefreshIndicator(
                    onRefresh: () =>
                        pullRefresh(ref, const {RefreshScope.requests}),
                    child: ListView(
                      keyboardDismissBehavior:
                          ScrollViewKeyboardDismissBehavior.onDrag,
                      padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
                      children: [
                        Center(
                          child: ConstrainedBox(
                            constraints: const BoxConstraints(maxWidth: 640),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              spacing: 16,
                              children: [
                                Copy(
                                  creating
                                      ? 'Lưu nháp, sau đó đăng bài.'
                                      : 'Bài đã đăng sẽ được duyệt lại khi sửa.',
                                  muted: true,
                                ),
                                _NeedCard(state: this, request: request),
                                _OfferCard(state: this),
                                _OptionsCard(state: this),
                                _TimeCard(state: this),
                                _DeadlineCard(state: this),
                                if (_error.isNotEmpty)
                                  FormNotice(
                                    tone: NoticeTone.error,
                                    message: _error,
                                  ),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                Material(
                  color: AppColors.surface,
                  child: SafeArea(
                    top: false,
                    child: Center(
                      child: ConstrainedBox(
                        constraints: const BoxConstraints(maxWidth: 640),
                        child: Padding(
                          padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            spacing: 8,
                            children: [
                              AppButton(
                                label: _saving
                                    ? 'Đang lưu...'
                                    : creating
                                    ? 'Lưu bản nháp'
                                    : 'Lưu thay đổi',
                                loading: _saving,
                                onPressed: () => _save(request),
                              ),
                              if (creating)
                                const Copy(
                                  'Lưu nháp để xem lại trước khi đăng.',
                                  muted: true,
                                ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
    );
  }
}

class _NeedCard extends ConsumerWidget {
  const _NeedCard({required this.state, required this.request});

  final _LiveRequestEditorState state;
  final OwnRequest? request;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final locked = request?.publishedAt != null;
    return Panel(
      title: 'Nhu cầu học',
      children: [
        AppInput(
          field: state._title,
          label: 'Tiêu đề',
          required: true,
          placeholder: 'Ví dụ: Muốn học React Hooks để làm dự án web',
          editable: !state._saving,
        ),
        Text(
          'Kỹ năng muốn học *',
          style: nunito(
            TypeScale.body,
            weight: FontWeight.w700,
            color: AppColors.body,
          ),
        ),
        if (locked) ...[
          Copy(state._skillName.isEmpty ? 'Thông tin kỹ năng chưa khả dụng' : state._skillName),
          const Copy(
            'Kỹ năng được giữ nguyên sau lần đăng đầu tiên.',
            muted: true,
          ),
        ] else
          _SkillPicker(state: state),
        AppInput(
          field: state._description,
          label: 'Mô tả nhu cầu',
          required: true,
          multiline: true,
          hint: '20–3000 ký tự.',
          placeholder: 'Bạn đang ở đâu, cần hỗ trợ gì và thích học theo cách nào?',
          editable: !state._saving,
        ),
        AppInput(
          field: state._goal,
          label: 'Mục tiêu học tập',
          required: true,
          multiline: true,
          hint: '10–1000 ký tự.',
          placeholder: 'Ví dụ: Tự hoàn thành một ứng dụng web sau 2 tháng',
          editable: !state._saving,
        ),
      ],
    );
  }
}

class _SkillPicker extends ConsumerWidget {
  const _SkillPicker({required this.state});

  final _LiveRequestEditorState state;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final query = ref.watch(_skillSearchProvider(state._skillKeyword));
    final options = query.value ?? const <SkillRecord>[];
    var label = 'Chọn kỹ năng muốn học';
    if (state._skillId.isNotEmpty) {
      label = state._skillName.isEmpty ? 'Đã chọn kỹ năng' : state._skillName;
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: 8,
      children: [
        AppButton(
          label: label,
          variant: ButtonVariant.paper,
          disabled: state._saving,
          onPressed: () =>
              state.update(() => state._skillOpen = !state._skillOpen),
        ),
        if (state._skillOpen) ...[
          TextField(
            controller: state._skillQuery,
            enabled: !state._saving,
            decoration: const InputDecoration(
              labelText: 'Tìm kỹ năng',
              hintText: 'Nhập ít nhất 2 ký tự để tìm trong toàn bộ danh mục.',
            ),
            onChanged: (value) {
              state._skillDebounce?.cancel();
              state._skillDebounce = Timer(const Duration(milliseconds: 300), () {
                if (!state.mounted) return;
                state.update(
                  () => state._skillKeyword = value.trim(),
                );
              });
            },
          ),
          if (state._skillKeyword.runes.length < 2)
            const Copy(
              'Nhập ít nhất 2 ký tự để tìm trong toàn bộ danh mục.',
              muted: true,
            ),
          if (query.isLoading)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 8),
              child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
            ),
          if (query.hasError)
            FormNotice(tone: NoticeTone.error, message: 'Không tải được danh mục kỹ năng.'),
          if (query.hasValue && options.isEmpty && state._skillKeyword.runes.length >= 2)
            const Copy('Chưa có kỹ năng phù hợp.', muted: true),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final skill in options)
                ChoiceChip(
                  label: Text(skill.name),
                  selected: skill.id == state._skillId,
                  onSelected: state._saving
                      ? null
                      : (_) => state.update(() {
                          state._skillId = skill.id;
                          state._skillName = skill.name;
                          state._skillOpen = false;
                          state._error = '';
                        }),
                ),
            ],
          ),
        ],
      ],
    );
  }
}

class _OfferCard extends ConsumerWidget {
  const _OfferCard({required this.state});

  final _LiveRequestEditorState state;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final mine = ref.watch(skillsProvider);
    final options = [
      for (final skill in mine)
        if (skill.visible && !skill.archived) skill,
    ];
    return Panel(
      accent: true,
      title: 'Bạn có thể dạy',
      children: [
        const Copy(
          'Chia sẻ thế mạnh để tìm bạn trao đổi phù hợp',
          muted: true,
        ),
        AppInput(
          field: state._overview,
          label: 'Nội dung có thể dạy (không bắt buộc)',
          multiline: true,
          hint: '20–3000 ký tự khi điền.',
          placeholder: 'Bạn có thể hướng dẫn lại những gì cho bạn học?',
          editable: !state._saving,
        ),
        Copy(
          'Chọn kỹ năng đang công khai trong hồ sơ của bạn. ${state._offeringIds.length}/10 đã chọn',
          muted: true,
        ),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            for (final id in state._offeringIds)
              () {
                final skill = options
                    .where((item) => item.id == id)
                    .firstOrNull;
                final label = skill?.name ?? id;
                return InputChip(
                  label: Text(label),
                  onDeleted: state._saving
                      ? null
                      : () => state.update(() => state._offeringIds.remove(id)),
                );
              }(),
          ],
        ),
        AppButton(
          label: state._offeringOpen
              ? 'Thu gọn danh sách'
              : state._offeringIds.isEmpty
              ? 'Chọn kỹ năng có thể dạy'
              : 'Thêm kỹ năng',
          variant: ButtonVariant.paper,
          disabled: state._saving,
          onPressed: () =>
              state.update(() => state._offeringOpen = !state._offeringOpen),
        ),
        if (state._offeringOpen) ...[
          if (options.isEmpty)
            const Copy('Chưa có kỹ năng công khai để chọn.', muted: true)
          else if (options.every((item) => state._offeringIds.contains(item.id)))
            const Copy('Bạn đã chọn hết kỹ năng hiện có.', muted: true)
          else
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final skill in options)
                  if (!state._offeringIds.contains(skill.id))
                    ActionChip(
                      label: Text(skill.name),
                      onPressed: state._saving || state._offeringIds.length >= 10
                          ? null
                          : () => state.update(
                              () => state._offeringIds.add(skill.id),
                            ),
                    ),
              ],
            ),
          if (state._offeringIds.isNotEmpty)
            AppButton(
              label: 'Bỏ tất cả lựa chọn',
              variant: ButtonVariant.paper,
              disabled: state._saving,
              onPressed: () => state.update(state._offeringIds.clear),
            ),
        ],
      ],
    );
  }
}

class _OptionsCard extends ConsumerWidget {
  const _OptionsCard({required this.state});

  final _LiveRequestEditorState state;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tags = ref.watch(_tagsCatalogProvider).value ?? const <TagRecord>[];
    final query = state._tagQuery.text.trim().toLowerCase();
    final matches = [
      for (final tag in tags)
        if (query.isEmpty || tag.label.toLowerCase().contains(query)) tag,
    ];
    final selected = [
      for (final id in state._tagIds)
        tags.where((tag) => tag.id == id).firstOrNull ??
            TagRecord(id: id, label: id),
    ];
    return Panel(
      title: 'Tùy chọn học tập',
      children: [
        ChoiceGroup(
          label: 'Trình độ hiện tại (không bắt buộc)',
          options: const ['Chưa khai', ..._levels],
          value: state._level.isEmpty ? 'Chưa khai' : state._level,
          onChange: (value) => state.update(
            () => state._level = value == 'Chưa khai' ? '' : value,
          ),
        ),
        ChoiceGroup(
          label: 'Chỉ nhận người dạy có kỹ năng đã xác minh',
          options: const ['Không', 'Có'],
          value: state._verified ? 'Có' : 'Không',
          onChange: (value) =>
              state.update(() => state._verified = value == 'Có'),
        ),
        const Copy('Tag (không bắt buộc)'),
        AppButton(
          label: state._tagOpen ? 'Đóng danh mục tag' : 'Chọn tag',
          variant: ButtonVariant.paper,
          disabled: state._saving,
          onPressed: () => state.update(() => state._tagOpen = !state._tagOpen),
        ),
        if (state._tagOpen) ...[
          TextField(
            controller: state._tagQuery,
            enabled: !state._saving,
            decoration: const InputDecoration(labelText: 'Tìm tag'),
            onChanged: (_) => state.update(() {}),
          ),
          if (matches.isEmpty)
            const Copy('Chưa có tag phù hợp.', muted: true),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final tag in matches)
                FilterChip(
                  label: Text(tag.label),
                  selected: state._tagIds.contains(tag.id),
                  onSelected: state._saving
                      ? null
                      : (selected) => state.update(() {
                          if (selected) {
                            if (state._tagIds.length < 10 &&
                                !state._tagIds.contains(tag.id)) {
                              state._tagIds.add(tag.id);
                            }
                          } else {
                            state._tagIds.remove(tag.id);
                          }
                        }),
                ),
            ],
          ),
        ],
        if (selected.isNotEmpty)
          Copy('${selected.length}/10 đã chọn', muted: true),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            for (final tag in selected)
              InputChip(
                label: Text(tag.label),
                onDeleted: state._saving
                    ? null
                    : () => state.update(() => state._tagIds.remove(tag.id)),
              ),
          ],
        ),
        AppInput(
          field: state._credit,
          label: 'Credit mong muốn mỗi giờ (không bắt buộc)',
          hint: 'Mức mong muốn; giá cuối cùng sẽ được thỏa thuận.',
          placeholder: 'Ví dụ: 50.00',
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          editable: !state._saving,
        ),
      ],
    );
  }
}

class _TimeCard extends StatelessWidget {
  const _TimeCard({required this.state});

  final _LiveRequestEditorState state;

  @override
  Widget build(BuildContext context) {
    final full = state._weekly.length >= 5;
    return Panel(
      title: 'Thời gian ưu tiên',
      children: [
        const Copy(
          'Không bắt buộc · Lặp hằng tuần · Tối đa 5 khoảng',
          muted: true,
        ),
        Copy(timeZoneNote(state._timeZone), muted: true),
        for (var index = 0; index < state._weekly.length; index++)
          _WeeklyRowCard(state: state, index: index),
        if (!full)
          AppButton(
            label: 'Thêm giờ rảnh',
            variant: ButtonVariant.paper,
            disabled: state._saving,
            onPressed: () => state.update(
              () => state._weekly = [
                ...state._weekly,
                const WeeklySlot(weekday: 'MON', startTime: '', endTime: ''),
              ],
            ),
          )
        else
          const Copy('Đã chọn tối đa 5 khoảng.', muted: true),
        if (state._savedSlots.isNotEmpty) ...[
          const Copy('Khoảng ngày đã lưu'),
          for (var index = 0; index < state._savedSlots.length; index++)
            Row(
              children: [
                Expanded(
                  child: Copy(
                    '${viDateTime(state._savedSlots[index].startAt)} → ${viDateTime(state._savedSlots[index].endAt)}',
                  ),
                ),
                AppButton(
                  label: 'Xóa',
                  size: ButtonSize.sm,
                  variant: ButtonVariant.paper,
                  disabled: state._saving,
                  onPressed: () => state.update(() {
                    state._savedSlots = [
                      for (var i = 0; i < state._savedSlots.length; i++)
                        if (i != index) state._savedSlots[i],
                    ];
                  }),
                ),
              ],
            ),
          const Copy(
            'Lưu lịch tuần sẽ thay thế các khoảng ngày đã lưu.',
            muted: true,
          ),
        ],
      ],
    );
  }
}

class _WeeklyRowCard extends StatelessWidget {
  const _WeeklyRowCard({required this.state, required this.index});

  final _LiveRequestEditorState state;
  final int index;

  @override
  Widget build(BuildContext context) {
    final row = state._weekly[index];
    final weekdayValue = weekdayLabels.contains(weekdayLabel(row.weekday)) &&
            row.weekday.isNotEmpty
        ? weekdayLabel(row.weekday)
        : '';
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.canvas,
        border: Border.all(color: AppColors.border),
        borderRadius: BorderRadius.circular(AppRadii.card),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        spacing: 10,
        children: [
          Row(
            children: [
              Expanded(child: Copy('Khoảng ${index + 1}')),
              AppButton(
                label: 'Xóa',
                size: ButtonSize.sm,
                variant: ButtonVariant.ghost,
                disabled: state._saving,
                onPressed: () => state.update(() {
                  state._weekly = [
                    for (var i = 0; i < state._weekly.length; i++)
                      if (i != index) state._weekly[i],
                  ];
                }),
              ),
            ],
          ),
          ChoiceGroup(
            label: 'Thứ trong tuần · Khoảng ${index + 1}',
            options: weekdayLabels,
            value: weekdayValue.isEmpty ? weekdayLabels.first : weekdayValue,
            onChange: (label) {
              final weekday = weekdays[weekdayLabels.indexOf(label)];
              state.update(() {
                state._weekly[index] = WeeklySlot(
                  weekday: weekday,
                  startTime: state._weekly[index].startTime,
                  endTime: state._weekly[index].endTime,
                );
              });
            },
          ),
          AppButton(
            label: row.startTime.isEmpty
                ? 'Từ · Khoảng ${index + 1}'
                : 'Từ ${row.startTime}',
            variant: ButtonVariant.paper,
            disabled: state._saving,
            onPressed: () => _pickTime(context, start: true),
          ),
          AppButton(
            label: row.endTime.isEmpty
                ? 'Đến · Khoảng ${index + 1}'
                : 'Đến ${row.endTime}',
            variant: ButtonVariant.paper,
            disabled: state._saving,
            onPressed: () => _pickTime(context, start: false),
          ),
        ],
      ),
    );
  }

  Future<void> _pickTime(BuildContext context, {required bool start}) async {
    final row = state._weekly[index];
    final current = start ? row.startTime : row.endTime;
    final parts = current.split(':');
    final initial = TimeOfDay(
      hour: int.tryParse(parts.elementAtOrNull(0) ?? '') ?? 19,
      minute: int.tryParse(parts.elementAtOrNull(1) ?? '') ?? 0,
    );
    final picked = await showTimePicker(
      context: context,
      helpText: start ? 'Giờ bắt đầu' : 'Giờ kết thúc',
      cancelText: 'Hủy',
      confirmText: 'Chọn',
      initialTime: initial,
      builder: (context, child) => MediaQuery(
        data: MediaQuery.of(context).copyWith(alwaysUse24HourFormat: true),
        child: child ?? const SizedBox.shrink(),
      ),
    );
    if (picked == null) return;
    final value =
        '${picked.hour.toString().padLeft(2, '0')}:${picked.minute.toString().padLeft(2, '0')}';
    state.update(() {
      state._weekly[index] = WeeklySlot(
        weekday: state._weekly[index].weekday.isEmpty
            ? weekdays.first
            : state._weekly[index].weekday,
        startTime: start ? value : state._weekly[index].startTime,
        endTime: start ? state._weekly[index].endTime : value,
      );
    });
  }
}

class _DeadlineCard extends StatelessWidget {
  const _DeadlineCard({required this.state});

  final _LiveRequestEditorState state;

  @override
  Widget build(BuildContext context) {
    return Panel(
      title: 'Hạn đăng bài',
      children: [
        const Copy('Không bắt buộc', muted: true),
        AppButton(
          label: state._expiresAt == null
              ? 'Chọn ngày và giờ'
              : viDateTime(state._expiresAt!),
          variant: ButtonVariant.paper,
          disabled: state._saving,
          onPressed: () async {
            final now = DateTime.now();
            final picked = await _pickFuture(context, state._expiresAt ?? now.add(const Duration(days: 7)));
            if (picked == null) return;
            state.update(() => state._expiresAt = picked);
          },
        ),
        const Copy('Để trống để dùng hạn mặc định.', muted: true),
        if (state._expiresAt != null)
          AppButton(
            label: 'Dùng hạn mặc định',
            variant: ButtonVariant.paper,
            disabled: state._saving,
            onPressed: () => state.update(() => state._expiresAt = null),
          ),
      ],
    );
  }
}

Future<DateTime?> _pickFuture(BuildContext context, DateTime initial) async {
  final now = DateTime.now();
  final first = DateTime(now.year, now.month, now.day);
  final last = first.add(const Duration(days: 90));
  final initialDay = DateTime(initial.year, initial.month, initial.day);
  final date = await showDatePicker(
    context: context,
    helpText: 'Thời hạn hiển thị bài',
    cancelText: 'Hủy',
    confirmText: 'Chọn',
    initialDate: initialDay.isBefore(first)
        ? first
        : (initialDay.isAfter(last) ? last : initialDay),
    firstDate: first,
    lastDate: last,
  );
  if (date == null || !context.mounted) return null;
  final time = await showTimePicker(
    context: context,
    helpText: 'Giờ hết hạn',
    cancelText: 'Hủy',
    confirmText: 'Chọn',
    initialTime: TimeOfDay.fromDateTime(initial),
    builder: (context, child) => MediaQuery(
      data: MediaQuery.of(context).copyWith(alwaysUse24HourFormat: true),
      child: child ?? const SizedBox.shrink(),
    ),
  );
  if (time == null) return null;
  return DateTime(date.year, date.month, date.day, time.hour, time.minute);
}

String? _weeklyError(List<WeeklySlot> rows) {
  if (rows.isEmpty) return null;
  if (rows.length > 5) return 'Chọn thứ và hai giờ hợp lệ, không chồng nhau. Tối đa 5 khoảng.';
  final clock = RegExp(_clock);
  for (var index = 0; index < rows.length; index++) {
    final row = rows[index];
    if (row.weekday.isEmpty ||
        !clock.hasMatch(row.startTime) ||
        !clock.hasMatch(row.endTime) ||
        row.endTime.compareTo(row.startTime) <= 0) {
      return 'Chọn thứ và hai giờ hợp lệ, không chồng nhau. Tối đa 5 khoảng.';
    }
    for (var previous = 0; previous < index; previous++) {
      final other = rows[previous];
      if (other.weekday == row.weekday &&
          row.startTime.compareTo(other.endTime) < 0 &&
          row.endTime.compareTo(other.startTime) > 0) {
        return 'Chọn thứ và hai giờ hợp lệ, không chồng nhau. Tối đa 5 khoảng.';
      }
    }
  }
  return null;
}
