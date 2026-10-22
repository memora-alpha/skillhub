import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../components/app_button.dart';
import '../../components/feature_page.dart';
import '../../core/http/app_error.dart';
import '../auth/session/auth_session.dart';
import 'service/study_service.dart';

String _text(Object? value) => value?.toString() ?? '';

int? _version(Object? value) => value is int ? value : int.tryParse('$value');

class StudyLiveScreen extends ConsumerStatefulWidget {
  const StudyLiveScreen({super.key});

  @override
  ConsumerState<StudyLiveScreen> createState() => _StudyLiveScreenState();
}

class _StudyLiveScreenState extends ConsumerState<StudyLiveScreen> {
  List<Map<String, dynamic>> _paths = const [];
  Map<String, dynamic>? _path;
  List<Map<String, dynamic>> _sessions = const [];
  Map<String, dynamic>? _session;
  List<Map<String, dynamic>> _reviews = const [];
  Map<String, dynamic>? _reputation;
  String _note = '';
  String? _busy;

  StudyService get _api => ref.read(authRuntimeProvider).services.study;

  Future<void> _run(String action, Future<void> Function() work) async {
    if (_busy != null) return;
    setState(() {
      _busy = action;
      _note = '';
    });
    try {
      await work();
      if (mounted && _note.isEmpty) setState(() => _note = 'Máy chủ đã phản hồi.');
    } catch (error) {
      if (mounted) setState(() => _note = errorMessage(error));
    } finally {
      if (mounted) setState(() => _busy = null);
    }
  }

  Future<void> _loadPath(String id) async {
    final detail = await _api.path(id);
    final reviews = await _api.reviews(id);
    setState(() {
      _path = detail;
      _reviews = reviews;
    });
  }

  AppButton _action({
    required String action,
    required String label,
    required Future<void> Function() work,
    ButtonVariant variant = ButtonVariant.primary,
  }) {
    return AppButton(
      label: label,
      variant: variant,
      loading: _busy == action,
      disabled: _busy != null,
      onPressed: () => _run(action, work),
    );
  }

  @override
  Widget build(BuildContext context) {
    final pathId = _text(_path?['id']);
    final version = _version(_path?['currentVersion'] ?? _path?['version']);
    return FeaturePage(
      title: 'Lộ trình và buổi học',
      back: '/calendar',
      subtitle: 'Dữ liệu và thao tác lấy từ máy chủ.',
      children: [
        if (_busy != null) const Copy('Đang liên hệ máy chủ.', muted: true),
        if (_note.isNotEmpty) Copy(_note),
        DataForm(
          fields: [
            DataField(name: 'conversationId', label: 'Mã cuộc trao đổi', rule: _uuid),
            DataField(
              name: 'exchangeType',
              label: 'Hình thức',
              rule: (value) => value == 'ONE_WAY' || value == 'TWO_WAY'
                  ? null
                  : 'Chọn ONE_WAY hoặc TWO_WAY.',
              choices: const ['ONE_WAY', 'TWO_WAY'],
            ),
            DataField(name: 'teacherId', label: 'Mã người dạy', rule: _optionalUuid),
            DataField(name: 'learnerId', label: 'Mã người học', rule: _optionalUuid),
            DataField(
              name: 'credit',
              label: 'Credit',
              rule: (value) => value.trim().isEmpty ? 'Nhập số Credit.' : null,
            ),
          ],
          submitLabel: 'Tạo lộ trình',
          onSubmit: (values) async {
            final type = values['exchangeType']!;
            try {
              final created = await _api.createPath({
                'conversationId': values['conversationId'],
                'exchangeType': type,
                if (type == 'ONE_WAY') ...{
                  'teacherId': values['teacherId'],
                  'learnerId': values['learnerId'],
                  'negotiatedCredit': values['credit'],
                } else
                  'totalCreditPerUser': values['credit'],
              });
              setState(() => _path = created);
              return null;
            } catch (error) {
              return errorMessage(error);
            }
          },
        ),
        DataForm(
          fields: [
            DataField(name: 'scheduleId', label: 'Mã đề xuất lịch', rule: _uuid),
            DataField(
              name: 'expectedVersion',
              label: 'Phiên bản lịch',
              rule: (value) => int.tryParse(value.trim()) == null
                  ? 'Nhập phiên bản.'
                  : null,
              numeric: true,
            ),
          ],
          submitLabel: 'Xác nhận lịch',
          onSubmit: (values) async {
            try {
              await _api.confirmSchedule(values['scheduleId']!, {
                'expectedVersion': int.parse(values['expectedVersion']!.trim()),
              });
              return null;
            } catch (error) {
              return errorMessage(error);
            }
          },
        ),
        _action(
          action: 'paths',
          label: 'Tải lộ trình của tôi',
          work: () async {
            final rows = await _api.myPaths();
            setState(() => _paths = rows);
          },
        ),
        for (final item in _paths)
          Panel(
            title: _text(item['status']),
            children: [
              Copy(_text(item['exchangeType'])),
              Copy(_text(item['id']), muted: true),
              _action(
                action: 'path-${_text(item['id'])}',
                label: 'Xem thỏa thuận',
                variant: ButtonVariant.paper,
                work: () => _loadPath(_text(item['id'])),
              ),
            ],
          ),
        if (_path != null) ...[
          Panel(
            title: 'Thỏa thuận $pathId',
            children: [
              Copy('Phiên bản ${version ?? 'chưa rõ'}'),
              if (version != null) ...[
                _action(
                  action: 'confirm-path',
                  label: 'Xác nhận thỏa thuận',
                  variant: ButtonVariant.paper,
                  work: () async {
                    await _api.confirmPath(pathId, expectedVersion: version);
                    await _loadPath(pathId);
                  },
                ),
                _action(
                  action: 'validate-path',
                  label: 'Kiểm tra trước khi khóa',
                  variant: ButtonVariant.paper,
                  work: () async {
                    final result = await _api.validatePath(pathId);
                    setState(() => _note = _text(result['message']).isEmpty
                        ? 'Thỏa thuận sẵn sàng để khóa.'
                        : _text(result));
                  },
                ),
                _action(
                  action: 'finalize-path',
                  label: 'Khóa lộ trình và giữ Credit',
                  work: () async {
                    await _api.finalizePath(pathId, expectedVersion: version);
                    await _loadPath(pathId);
                  },
                ),
              ],
              DataForm(
                fields: [
                  DataField(
                    name: 'conversationId',
                    label: 'Mã cuộc trao đổi',
                    rule: _uuid,
                  ),
                  DataField(
                    name: 'exchangeType',
                    label: 'Hình thức',
                    rule: (value) =>
                        value == 'ONE_WAY' || value == 'TWO_WAY' ? null : 'Chọn ONE_WAY hoặc TWO_WAY.',
                    choices: const ['ONE_WAY', 'TWO_WAY'],
                  ),
                  DataField(
                    name: 'teacherId',
                    label: 'Mã người dạy, nếu học một chiều',
                    rule: _optionalUuid,
                  ),
                  DataField(
                    name: 'learnerId',
                    label: 'Mã người học, nếu học một chiều',
                    rule: _optionalUuid,
                  ),
                  DataField(
                    name: 'credit',
                    label: 'Credit thỏa thuận',
                    rule: (value) => value.trim().isEmpty ? 'Nhập số Credit.' : null,
                  ),
                ],
                submitLabel: 'Tạo phiên bản thỏa thuận mới',
                onSubmit: (values) => _submitRevision(pathId, version, values),
              ),
              DataForm(
                fields: [
                  DataField(name: 'skillId', label: 'Mã kỹ năng', rule: _uuid),
                  DataField(
                    name: 'learningGoal',
                    label: 'Mục tiêu học',
                    rule: (value) => value.trim().isEmpty ? 'Nhập mục tiêu.' : null,
                  ),
                  DataField(
                    name: 'outline',
                    label: 'Nội dung từng buổi, mỗi dòng một buổi',
                    rule: (value) => value.trim().isEmpty ? 'Nhập ít nhất một buổi.' : null,
                    multiline: true,
                  ),
                ],
                submitLabel: 'Thêm kế hoạch dạy',
                onSubmit: (values) async {
                  final lines = values['outline']!
                      .split('\n')
                      .map((line) => line.trim())
                      .where((line) => line.isNotEmpty)
                      .toList();
                  try {
                    await _api.addPlan(pathId, {
                      'skillId': values['skillId'],
                      'learningGoal': values['learningGoal'],
                      'totalSessions': lines.length,
                      'sessionOutline': [
                        for (final line in lines) {'content': line},
                      ],
                    });
                    await _loadPath(pathId);
                    return null;
                  } catch (error) {
                    return errorMessage(error);
                  }
                },
              ),
            ],
          ),
          _plans(pathId),
          Panel(
            title: 'Đánh giá',
            children: [
              for (final review in _reviews)
                Copy('${_text(review['rating'])} · ${_text(review['comment'])}'),
              DataForm(
                fields: [
                  DataField(
                    name: 'rating',
                    label: 'Số sao từ 1 đến 5',
                    rule: (value) {
                      final rating = int.tryParse(value.trim());
                      return rating != null && rating >= 1 && rating <= 5
                          ? null
                          : 'Chọn từ 1 đến 5.';
                    },
                    numeric: true,
                  ),
                  DataField(
                    name: 'comment',
                    label: 'Nhận xét',
                    rule: (value) => value.trim().length <= 1000
                        ? null
                        : 'Nhận xét tối đa 1000 ký tự.',
                    multiline: true,
                  ),
                ],
                submitLabel: 'Gửi đánh giá',
                onSubmit: (values) async {
                  try {
                    await _api.createReview(pathId, {
                      'rating': int.parse(values['rating']!.trim()),
                      'comment': values['comment']!.trim(),
                    });
                    await _loadPath(pathId);
                    return null;
                  } catch (error) {
                    return errorMessage(error);
                  }
                },
              ),
            ],
          ),
          _action(
            action: 'settle',
            label: 'Quyết toán Credit',
            variant: ButtonVariant.paper,
            work: () async {
              final result = await _api.settle(pathId);
              setState(() => _note = 'Đã gửi quyết toán. ${_text(result['status'])}');
            },
          ),
        ],
        _action(
          action: 'sessions',
          label: 'Tải buổi học của tôi',
          variant: ButtonVariant.paper,
          work: () async {
            final now = DateTime.now().toUtc();
            final rows = await _api.mySessions(
              from: now.subtract(const Duration(days: 30)).toIso8601String(),
              to: now.add(const Duration(days: 60)).toIso8601String(),
            );
            setState(() => _sessions = rows);
          },
        ),
        for (final item in _sessions)
          Panel(
            title: _text(item['status']),
            children: [
              Copy(_text(item['id']), muted: true),
              _action(
                action: 'session-${_text(item['id'])}',
                label: 'Mở buổi học',
                variant: ButtonVariant.paper,
                work: () async {
                  final detail = await _api.session(_text(item['id']));
                  setState(() => _session = detail);
                },
              ),
            ],
          ),
        if (_session != null) _sessionPanel(),
        _action(
          action: 'reputation',
          label: 'Tải lịch sử uy tín',
          variant: ButtonVariant.paper,
          work: () async {
            final page = await _api.reputation();
            setState(() => _reputation = page);
          },
        ),
        if (_reputation != null)
          Panel(
            title: 'Uy tín',
            children: [
              Copy(_text(_reputation)),
            ],
          ),
      ],
    );
  }

  Widget _plans(String pathId) {
    final plans = _path?['plans'];
    if (plans is! List) return const SizedBox.shrink();
    return Column(
      children: [
        for (final plan in plans)
          if (plan is Map)
            Panel(
              title: 'Kế hoạch ${_text(plan['id'])}',
              children: [
                Copy('Phiên bản ${_text(plan['version'] ?? plan['currentVersion'])}'),
                AppButton(
                  label: 'Xác nhận kế hoạch',
                  variant: ButtonVariant.paper,
                  loading: _busy == 'plan-${_text(plan['id'])}',
                  disabled: _busy != null,
                  onPressed: () {
                    final planVersion = _version(
                      plan['version'] ?? plan['currentVersion'],
                    );
                    final id = _text(plan['id']);
                    if (planVersion == null || id.isEmpty) return;
                    _run('plan-$id', () async {
                      await _api.confirmPlan(id, expectedVersion: planVersion);
                      await _loadPath(pathId);
                    });
                  },
                ),
                DataForm(
                  fields: [
                    DataField(
                      name: 'startAt',
                      label: 'Bắt đầu, dạng 2026-10-22T12:00:00Z',
                      rule: _instant,
                    ),
                    DataField(
                      name: 'endAt',
                      label: 'Kết thúc, dạng 2026-10-22T13:00:00Z',
                      rule: _instant,
                    ),
                  ],
                  submitLabel: 'Đề xuất lịch buổi 1',
                  onSubmit: (values) async {
                    final planVersion = _version(
                      plan['version'] ?? plan['currentVersion'],
                    );
                    if (planVersion == null) return 'Kế hoạch chưa có phiên bản.';
                    try {
                      await _api.proposeSchedule(_text(plan['id']), {
                        'expectedPlanVersion': planVersion,
                        'items': [
                          {
                            'sessionNo': 1,
                            'startAt': values['startAt'],
                            'endAt': values['endAt'],
                          },
                        ],
                      });
                      return null;
                    } catch (error) {
                      return errorMessage(error);
                    }
                  },
                ),
              ],
            ),
      ],
    );
  }

  Widget _sessionPanel() {
    final id = _text(_session?['id']);
    final version = _version(_session?['version'] ?? _session?['scheduleVersion']);
    return Panel(
      title: 'Buổi học $id',
      children: [
        Copy(_text(_session?['status'])),
        _action(
          action: 'livekit',
          label: 'Lấy mã vào phòng',
          variant: ButtonVariant.paper,
          work: () async {
            final token = await _api.liveKitToken(id);
            setState(() => _note = 'Mã phòng: ${_text(token['token'] ?? token)}');
          },
        ),
        _action(
          action: 'complete',
          label: 'Xác nhận hoàn thành',
          variant: ButtonVariant.paper,
          work: () async {
            await _api.confirmCompletion(id, {'note': ''});
            final detail = await _api.session(id);
            setState(() => _session = detail);
          },
        ),
        if (version != null)
          DataForm(
            fields: [
              DataField(name: 'startAt', label: 'Bắt đầu mới', rule: _instant),
              DataField(name: 'endAt', label: 'Kết thúc mới', rule: _instant),
            ],
            submitLabel: 'Đề xuất đổi lịch',
            onSubmit: (values) async {
              try {
                await _api.reschedule(id, {
                  'expectedVersion': version,
                  'startAt': values['startAt'],
                  'endAt': values['endAt'],
                });
                return null;
              } catch (error) {
                return errorMessage(error);
              }
            },
          ),
      ],
    );
  }

  Future<String?> _submitRevision(
    String pathId,
    int? version,
    Map<String, String> values,
  ) async {
    if (version == null) return 'Chưa có phiên bản thỏa thuận.';
    final type = values['exchangeType']!;
    final body = <String, Object?>{
      'expectedVersion': version,
      'exchangeType': type,
      if (type == 'ONE_WAY') ...{
        'teacherId': values['teacherId'],
        'learnerId': values['learnerId'],
        'negotiatedCredit': values['credit'],
      } else
        'totalCreditPerUser': values['credit'],
    };
    try {
      await _api.revisePath(pathId, body);
      await _loadPath(pathId);
      return null;
    } catch (error) {
      return errorMessage(error);
    }
  }
}

String? _uuid(String value) {
  final ok = RegExp(
    r'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$',
  ).hasMatch(value.trim());
  return ok ? null : 'Nhập mã UUID.';
}

String? _optionalUuid(String value) =>
    value.trim().isEmpty ? null : _uuid(value);

String? _instant(String value) =>
    DateTime.tryParse(value.trim()) == null ? 'Nhập thời điểm có múi giờ.' : null;
