import 'package:dio/dio.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../components/app_button.dart';
import '../../components/feature_page.dart';
import '../../components/misc.dart';
import '../../core/http/app_error.dart';
import '../auth/session/auth_session.dart';
import '../skills/schema/skill_schema.dart';
import '../skills/skills_feature.dart';

final _uuid = RegExp(
  r'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$',
);

bool isMaterialId(String id) => _uuid.hasMatch(id);

const _materialMimes = {
  'pdf': 'application/pdf',
  'docx':
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'pptx':
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

const _orderStatus = {
  'SUCCESS': 'Đã mua',
  'REFUNDED': 'Đã hoàn',
};

const _statusLabel = {
  'DRAFT': 'Bản nháp',
  'PENDING_REVIEW': 'Chờ duyệt',
  'PUBLISHED': 'Đã công bố',
  'REJECTED': 'Bị từ chối',
  'HIDDEN': 'Đã ẩn',
  'ARCHIVED': 'Ngừng phân phối',
};

final myMaterialsProvider = FutureProvider<List<Map<String, dynamic>>>((
  ref,
) async {
  if (ref.watch(sessionSnapshotProvider).phase != SessionPhase.ready) {
    return const [];
  }
  return ref.read(authRuntimeProvider).services.materials.mine();
});

final materialOrdersProvider = FutureProvider<List<Map<String, dynamic>>>((
  ref,
) async {
  if (ref.watch(sessionSnapshotProvider).phase != SessionPhase.ready) {
    return const [];
  }
  return ref.read(authRuntimeProvider).services.materials.orders();
});

final materialCatalogProvider =
    FutureProvider.family<List<Map<String, dynamic>>, String>((ref, key) async {
      final parts = key.split('\n');
      final q = parts.first;
      final access = parts.length > 1 && parts[1].isNotEmpty ? parts[1] : null;
      return ref.read(authRuntimeProvider).services.materials.search(
        q: q,
        accessType: access,
      );
    });

String _text(Object? value) => value == null ? '' : '$value';

int _version(Object? value) {
  if (value is int) return value;
  if (value is num) return value.round();
  return int.tryParse('$value') ?? 0;
}

String _skillName(List<SkillRecord> catalog, String skillId) {
  for (final item in catalog) {
    if (item.id == skillId) return item.name;
  }
  return skillId;
}

String _priceLabel(Map<String, dynamic> material) =>
    material['accessType'] == 'FREE'
    ? 'Miễn phí'
    : '${material['priceCredit']} CR';

Map<String, dynamic>? _fileOf(Map<String, dynamic> material) {
  final file = material['file'];
  return file is Map ? Map<String, dynamic>.from(file) : null;
}

class LiveMaterialsPage extends ConsumerStatefulWidget {
  const LiveMaterialsPage({super.key});

  @override
  ConsumerState<LiveMaterialsPage> createState() => _LiveMaterialsPageState();
}

class _LiveMaterialsPageState extends ConsumerState<LiveMaterialsPage> {
  String _search = '';
  String _filter = 'Tất cả';

  @override
  Widget build(BuildContext context) {
    final access = _filter == 'Tất cả' ? '' : _filter;
    final query = ref.watch(materialCatalogProvider('$_search\n$access'));
    final catalog = ref.watch(skillCatalogProvider).value ?? const <SkillRecord>[];
    final items = query.value ?? const <Map<String, dynamic>>[];
    return FeaturePage(
      title: 'Tài liệu học tập',
      back: '/home',
      subtitle: 'Tìm tài liệu hữu ích, do cộng đồng chia sẻ.',
      onRefresh: () async {
        ref.invalidate(materialCatalogProvider);
      },
      children: [
        SimpleInput(
          label: 'Tìm tài liệu hoặc kỹ năng',
          onChanged: (value) => setState(() => _search = value.trim()),
        ),
        ChoiceGroup(
          label: 'Loại tài liệu',
          options: const ['Tất cả', 'FREE', 'PAID'],
          value: _filter,
          onChange: (value) => setState(() => _filter = value),
        ),
        const RouteButton(
          secondary: true,
          href: '/materials/library',
          label: 'Tài liệu đã mua',
        ),
        if (query.isLoading && items.isEmpty)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 24),
            child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
          ),
        if (query.hasError && items.isEmpty)
          FormNotice(tone: NoticeTone.error, message: errorMessage(query.error)),
        for (final item in items)
          Panel(
            title: _text(item['title']),
            children: [
              StatusBadge(_priceLabel(item)),
              Copy(_text(item['description'])),
              Copy(
                '${_skillName(catalog, _text(item['skillId']))} · phiên bản ${item['listingVersion']}',
                muted: true,
              ),
              RouteButton(
                secondary: true,
                href: '/materials/${item['id']}',
                label: 'Xem tài liệu',
              ),
            ],
          ),
        if (query.hasValue && items.isEmpty)
          const EmptyState(
            title: 'Không tìm thấy tài liệu',
            description: 'Thử từ khóa hoặc bộ lọc khác.',
          ),
      ],
    );
  }
}

class LiveMyMaterialsPage extends ConsumerStatefulWidget {
  const LiveMyMaterialsPage({super.key});

  @override
  ConsumerState<LiveMyMaterialsPage> createState() =>
      _LiveMyMaterialsPageState();
}

class _LiveMyMaterialsPageState extends ConsumerState<LiveMyMaterialsPage> {
  String? _archive;
  String? _error;
  var _busy = false;

  Future<void> _stop(String id) async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref.read(authRuntimeProvider).services.materials.archive(id);
      ref.invalidate(myMaterialsProvider);
      if (mounted) setState(() => _archive = null);
    } catch (error) {
      if (mounted) setState(() => _error = errorMessage(error));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final query = ref.watch(myMaterialsProvider);
    final catalog = ref.watch(skillCatalogProvider).value ?? const <SkillRecord>[];
    final items = query.value ?? const <Map<String, dynamic>>[];
    return FeaturePage(
      title: 'Tài liệu tôi chia sẻ',
      back: '/profile',
      onRefresh: () async => ref.invalidate(myMaterialsProvider),
      children: [
        const RouteButton(href: '/materials/new', label: 'Đăng tài liệu'),
        if (query.isLoading && items.isEmpty)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 24),
            child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
          ),
        if (query.hasError && items.isEmpty)
          FormNotice(tone: NoticeTone.error, message: errorMessage(query.error)),
        if (_error != null) FormNotice(tone: NoticeTone.error, message: _error!),
        for (final item in items)
          Panel(
            title: _text(item['title']),
            children: [
              StatusBadge(_statusLabel[item['status']] ?? _text(item['status'])),
              Copy(
                _text(item['rejectReason']).isEmpty
                    ? _text(item['description'])
                    : 'Lý do từ chối: ${item['rejectReason']}',
              ),
              Copy(
                _skillName(catalog, _text(item['skillId'])),
                muted: true,
              ),
              RouteButton(
                secondary: true,
                href: '/materials/${item['id']}',
                label: 'Xem & chỉnh sửa',
              ),
              if (item['status'] != 'ARCHIVED' && item['status'] != 'HIDDEN')
                AppButton(
                  label: 'Ngừng phân phối',
                  variant: ButtonVariant.paper,
                  disabled: _busy,
                  onPressed: () => setState(() => _archive = _text(item['id'])),
                ),
              if (_archive == item['id']) ...[
                const Copy(
                  'Ngừng phân phối tài liệu này? Người đã mua vẫn giữ bản họ đã nhận.',
                ),
                AppButton(
                  label: 'Xác nhận ngừng',
                  loading: _busy,
                  onPressed: () => _stop(_text(item['id'])),
                ),
                AppButton(
                  label: 'Giữ tài liệu',
                  variant: ButtonVariant.paper,
                  onPressed: () => setState(() => _archive = null),
                ),
              ],
            ],
          ),
        if (query.hasValue && items.isEmpty)
          const EmptyState(
            title: 'Bạn chưa đăng tài liệu',
            description: 'Tài liệu gửi lên sẽ chờ kiểm duyệt trước khi công bố.',
          ),
        const RouteButton(
          secondary: true,
          href: '/materials/library',
          label: 'Tài liệu đã mua',
        ),
      ],
    );
  }
}

class _PickedFile {
  const _PickedFile(this.name, this.bytes, this.mime);

  final String name;
  final List<int> bytes;
  final String mime;
}

class LiveMaterialEditor extends ConsumerStatefulWidget {
  const LiveMaterialEditor({super.key, this.id});

  final String? id;

  @override
  ConsumerState<LiveMaterialEditor> createState() => _LiveMaterialEditorState();
}

class _LiveMaterialEditorState extends ConsumerState<LiveMaterialEditor> {
  _PickedFile? _file;
  String _phase = '';
  String _error = '';

  Future<void> _pick() async {
    try {
      final picked = await FilePicker.pickFiles(
        type: FileType.custom,
        allowedExtensions: _materialMimes.keys.toList(),
      );
      if (picked.isEmpty) return;
      final file = picked.single;
      final bytes = await file.readAsBytes();
      final name = file.name;
      final mime = _materialMimes[name.split('.').last.toLowerCase()];
      if (mime == null) return;
      if (bytes.length > 20000000) {
        setState(() => _error = 'Tệp tối đa 20 MB.');
        return;
      }
      setState(() {
        _file = _PickedFile(name, bytes, mime);
        _error = '';
      });
    } catch (_) {
      if (mounted) setState(() => _error = 'Không mở được tệp. Hãy thử lại.');
    }
  }

  Future<String?> _waitReady(String fileId) async {
    final api = ref.read(authRuntimeProvider).services.materials;
    for (var attempt = 0; attempt < 8; attempt++) {
      final status = await api.fileStatus(fileId);
      final state = status['state']?.toString();
      if (state == 'READY') return null;
      if (state == 'REJECTED' ||
          state == 'FAILED' ||
          state == 'SCAN_FAILED' ||
          state == 'UPLOAD_FAILED') {
        return 'Tệp không vượt qua kiểm tra. Hãy chọn tệp khác.';
      }
      await Future<void>.delayed(const Duration(seconds: 2));
    }
    return 'Tệp chưa được kiểm tra xong. Hãy thử gửi lại sau ít phút.';
  }

  @override
  Widget build(BuildContext context) {
    final id = widget.id;
    final mine = ref.watch(myMaterialsProvider);
    final current = (mine.value ?? const <Map<String, dynamic>>[])
        .where((item) => item['id'] == id)
        .firstOrNull;
    final catalog = ref.watch(skillCatalogProvider).value ?? const <SkillRecord>[];
    final choices = [for (final item in catalog) item.name];
    final skillName = current == null
        ? (choices.isEmpty ? '' : choices.first)
        : _skillName(catalog, _text(current['skillId']));
    final locked =
        current != null &&
        (current['status'] == 'ARCHIVED' || current['status'] == 'HIDDEN');
    final missing = id != null && mine.hasValue && (current == null || locked);
    return FeaturePage(
      title: id != null ? 'Sửa tài liệu / phiên bản mới' : 'Đăng tài liệu',
      back: '/materials/mine',
      children: [
        if (mine.isLoading && id != null && current == null)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 24),
            child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
          )
        else if (missing)
          const EmptyState(
            title: 'Không thể chỉnh sửa',
            description: 'Bạn chỉ chỉnh sửa tài liệu của mình còn được quản lý.',
          )
        else
          Panel(
            title: 'Chia sẻ tài liệu hữu ích',
            children: [
              const Copy(
                'Chọn tệp pdf, docx, pptx hoặc xlsx, tối đa 20 MB. Tệp được kiểm tra trước khi gửi duyệt.',
                muted: true,
              ),
              if (_file != null) Copy(_file!.name),
              if (current != null && _file == null)
                Copy(
                  'Tệp hiện tại: ${_fileOf(current)?['originalFilename'] ?? 'chưa có'}. Chọn tệp mới sẽ tạo phiên bản mới.',
                ),
              if (_phase.isNotEmpty) Copy(_phase),
              if (_error.isNotEmpty)
                FormNotice(tone: NoticeTone.error, message: _error),
              AppButton(
                label: _file == null ? 'Chọn tệp' : 'Chọn tệp khác',
                variant: ButtonVariant.paper,
                disabled: _phase.isNotEmpty,
                onPressed: _pick,
              ),
              if (choices.isEmpty)
                const Copy('Danh mục kỹ năng chưa tải xong.')
              else
                DataForm(
                  defaults: {
                    'title': _text(current?['title']),
                    'description': _text(current?['description']),
                    'skill': choices.contains(skillName) ? skillName : choices.first,
                    'access': _text(current?['accessType']).isEmpty
                        ? 'FREE'
                        : _text(current?['accessType']),
                    'price': _text(current?['priceCredit']).isEmpty
                        ? '0'
                        : _text(current?['priceCredit']),
                  },
                  fields: [
                    DataField(
                      name: 'title',
                      label: 'Tên tài liệu',
                      rule: textRule(5, 150),
                    ),
                    DataField(
                      name: 'description',
                      label: 'Mô tả',
                      rule: textRule(10, 3000),
                      multiline: true,
                    ),
                    DataField(
                      name: 'skill',
                      label: 'Danh mục kỹ năng',
                      rule: textRule(1, 100),
                      choices: choices,
                    ),
                    DataField(
                      name: 'access',
                      label: 'Cách chia sẻ',
                      rule: (value) =>
                          value == 'FREE' || value == 'PAID'
                          ? null
                          : 'Chọn một lựa chọn.',
                      choices: const ['FREE', 'PAID'],
                    ),
                    DataField(
                      name: 'price',
                      label: 'Giá (Credit)',
                      rule: creditRule(0, true),
                      numeric: true,
                      hint: 'FREE = 0; PAID > 0. Tối đa 2 số thập phân.',
                    ),
                    DataField(
                      name: 'rights',
                      label: 'Quyền phân phối',
                      rule: (value) =>
                          value.isEmpty ? 'Xác nhận quyền phân phối.' : null,
                      choices: const ['Tôi có quyền phân phối nội dung này'],
                    ),
                  ],
                  submitLabel: 'Gửi tài liệu để duyệt',
                  onSubmit: (values) => _submit(values, current, catalog),
                ),
            ],
          ),
      ],
    );
  }

  Future<String?> _submit(
    Map<String, String> values,
    Map<String, dynamic>? current,
    List<SkillRecord> catalog,
  ) async {
    final price = num.tryParse(values['price'] ?? '') ?? -1;
    if (values['access'] == 'FREE' && price != 0) {
      return 'Tài liệu FREE phải có giá 0.';
    }
    if (values['access'] == 'PAID' && price <= 0) {
      return 'Tài liệu PAID phải có giá lớn hơn 0.';
    }
    if (current == null && _file == null) return 'Chọn một tệp tài liệu.';
    final skill = catalog.where((item) => item.name == values['skill']).firstOrNull;
    if (skill == null) return 'Chọn kỹ năng trong danh mục.';
    void phase(String value) {
      if (mounted) setState(() => _phase = value);
    }

    try {
      final api = ref.read(authRuntimeProvider).services.materials;
      String? fileId;
      final picked = _file;
      if (picked != null) {
        phase('Đang tải tệp lên...');
        final uploaded = await api.upload(
          FormData.fromMap({
            'file': MultipartFile.fromBytes(
              picked.bytes,
              filename: picked.name,
              contentType: DioMediaType.parse(picked.mime),
            ),
          }),
        );
        fileId = uploaded['fileId']?.toString();
        if (fileId == null || fileId.isEmpty) return 'Máy chủ không nhận tệp.';
        phase('Đang kiểm tra tệp...');
        final waitError = await _waitReady(fileId);
        if (waitError != null) return waitError;
      }
      phase('Đang gửi tài liệu...');
      final body = {
        'skillId': skill.id,
        'title': values['title'],
        'description': values['description'],
        'accessType': values['access'],
        'priceCredit': values['price'],
        'distributionRightsConfirmed': true,
        'fileId': ?fileId,
      };
      final saved = current == null
          ? await api.create(body)
          : await api.update(widget.id!, {
              ...body,
              'expectedListingVersion': _version(current['listingVersion']),
            });
      final savedId = _text(saved['id']);
      if (saved['status'] == 'DRAFT') await api.submit(savedId);
      ref.invalidate(myMaterialsProvider);
      ref.invalidate(materialCatalogProvider);
      if (mounted) context.pushReplacement('/materials/$savedId');
      return null;
    } catch (error) {
      return errorMessage(error);
    } finally {
      if (mounted) setState(() => _phase = '');
    }
  }
}

class LiveMaterialDetail extends ConsumerWidget {
  const LiveMaterialDetail({super.key, required this.id});

  final String id;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final mine = ref.watch(myMaterialsProvider);
    final query = ref.watch(_publicMaterialProvider(id));
    final owned = (mine.value ?? const <Map<String, dynamic>>[])
        .where((item) => item['id'] == id)
        .firstOrNull;
    final material = owned ?? query.value;
    final catalog = ref.watch(skillCatalogProvider).value ?? const <SkillRecord>[];
    final me = ref.watch(accountSessionProvider)?.userId ?? '';
    final bought =
        (ref.watch(materialOrdersProvider).value ??
                const <Map<String, dynamic>>[])
            .any(
              (item) =>
                  item['materialId'] == id && item['status'] == 'SUCCESS',
            );
    final owner = material?['ownerId'] == me;
    final published = material?['status'] == 'PUBLISHED';
    return FeaturePage(
      title: 'Chi tiết tài liệu',
      back: '/materials',
      onRefresh: () async {
        ref.invalidate(myMaterialsProvider);
        ref.invalidate(materialOrdersProvider);
        ref.invalidate(_publicMaterialProvider(id));
      },
      children: [
        if ((mine.isLoading || query.isLoading) && material == null)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 24),
            child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
          ),
        if (owned == null && query.hasError && material == null)
          FormNotice(tone: NoticeTone.error, message: errorMessage(query.error)),
        if (material == null && mine.hasValue && !query.isLoading && !query.hasError)
          const EmptyState(
            title: 'Không tìm thấy tài liệu',
            description: 'Tài liệu không còn trên máy chủ hoặc chưa được công bố.',
          ),
        if (material != null) ...[
          Panel(
            title: _text(material['title']),
            children: [
              StatusBadge(
                _statusLabel[material['status']] ?? _text(material['status']),
              ),
              Copy(_text(material['description'])),
              Copy(
                '${_skillName(catalog, _text(material['skillId']))} · v${material['listingVersion']} · ${_priceLabel(material)}',
              ),
              if (_text(material['rejectReason']).isNotEmpty)
                Copy('Lý do từ chối: ${material['rejectReason']}'),
              if (_fileOf(material)?['originalFilename'] != null)
                Copy(
                  'Tệp: ${_fileOf(material)!['originalFilename']}',
                  muted: true,
                ),
            ],
          ),
          if (owner &&
              material['status'] != 'ARCHIVED' &&
              material['status'] != 'HIDDEN')
            RouteButton(
              secondary: true,
              href: '/materials/$id/edit',
              label: 'Sửa thông tin / tạo phiên bản',
            ),
          if (owner && _fileOf(material) != null)
            RouteButton(href: '/materials/$id/access', label: 'Mở tệp'),
          if (!owner && published && (material['accessType'] == 'FREE' || bought))
            RouteButton(href: '/materials/$id/access', label: 'Mở tệp'),
          if (!owner && published && material['accessType'] == 'PAID' && !bought)
            RouteButton(
              href: '/materials/$id/purchase',
              label: 'Mua tài liệu',
            ),
        ],
      ],
    );
  }
}

final _publicMaterialProvider = FutureProvider.family<Map<String, dynamic>, String>((
  ref,
  id,
) async {
  return ref.read(authRuntimeProvider).services.materials.detail(id);
});

class LiveMaterialAccess extends ConsumerStatefulWidget {
  const LiveMaterialAccess({super.key, required this.id});

  final String id;

  @override
  ConsumerState<LiveMaterialAccess> createState() => _LiveMaterialAccessState();
}

class _LiveMaterialAccessState extends ConsumerState<LiveMaterialAccess> {
  String? _url;
  String? _error;
  var _busy = false;

  Future<void> _open() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final result = await ref
          .read(authRuntimeProvider)
          .services
          .materials
          .download(widget.id);
      final url = result['url']?.toString() ?? '';
      if (url.isEmpty) {
        setState(() => _error = 'Máy chủ không trả liên kết tải.');
        return;
      }
      await Clipboard.setData(ClipboardData(text: url));
      setState(() => _url = url);
    } catch (error) {
      setState(() => _error = errorMessage(error));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return FeaturePage(
      title: 'Đọc tài liệu',
      back: '/materials/${widget.id}',
      children: [
        Panel(
          title: 'Tệp gốc',
          children: [
            const Copy(
              'Liên kết tải có thời hạn ngắn. Bấm để lấy liên kết và sao chép vào bộ nhớ tạm.',
              muted: true,
            ),
            if (_error != null)
              FormNotice(tone: NoticeTone.error, message: _error!),
            if (_url != null) Copy(_url!),
            AppButton(
              label: _busy ? 'Đang lấy liên kết...' : 'Lấy liên kết tải',
              loading: _busy,
              onPressed: _open,
            ),
          ],
        ),
      ],
    );
  }
}

class LiveMaterialPurchase extends ConsumerStatefulWidget {
  const LiveMaterialPurchase({super.key, required this.id});

  final String id;

  @override
  ConsumerState<LiveMaterialPurchase> createState() =>
      _LiveMaterialPurchaseState();
}

class _LiveMaterialPurchaseState extends ConsumerState<LiveMaterialPurchase> {
  String? _error;
  var _busy = false;

  Future<void> _buy(int version) async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref.read(authRuntimeProvider).services.materials.purchase(
        widget.id,
        expectedListingVersion: version,
      );
      ref.invalidate(materialOrdersProvider);
      if (mounted) context.pushReplacement('/materials/${widget.id}/access');
    } catch (error) {
      if (mounted) setState(() => _error = errorMessage(error));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final query = ref.watch(_publicMaterialProvider(widget.id));
    final material = query.value;
    return FeaturePage(
      title: 'Xác nhận mua tài liệu',
      back: '/materials/${widget.id}',
      children: [
        if (query.isLoading && material == null)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 24),
            child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
          ),
        if (query.hasError && material == null)
          FormNotice(tone: NoticeTone.error, message: errorMessage(query.error)),
        if (material != null)
          Panel(
            title: _text(material['title']),
            children: [
              Copy('Giá ${_priceLabel(material)} · phiên bản ${material['listingVersion']}'),
              const Copy(
                'Credit bị trừ khi mua thành công. Bản đã mua được giữ cho bạn.',
                muted: true,
              ),
              if (_error != null)
                FormNotice(tone: NoticeTone.error, message: _error!),
              AppButton(
                label: _busy ? 'Đang mua...' : 'Xác nhận mua',
                loading: _busy,
                onPressed: () => _buy(_version(material['listingVersion'])),
              ),
            ],
          ),
      ],
    );
  }
}

class LiveMaterialLibrary extends ConsumerWidget {
  const LiveMaterialLibrary({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final query = ref.watch(materialOrdersProvider);
    final items = query.value ?? const <Map<String, dynamic>>[];
    return FeaturePage(
      title: 'Tài liệu đã mua',
      back: '/materials',
      onRefresh: () async => ref.invalidate(materialOrdersProvider),
      children: [
        if (query.isLoading && items.isEmpty)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 24),
            child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
          ),
        if (query.hasError && items.isEmpty)
          FormNotice(tone: NoticeTone.error, message: errorMessage(query.error)),
        for (final item in items)
          Panel(
            title: '${item['grossCredit']} CR',
            children: [
              Copy(
                '${_orderStatus[item['status']] ?? item['status']} · phiên bản ${item['listingVersion']}',
              ),
              RouteButton(
                href: '/materials/${item['materialId']}/access',
                label: 'Mở tệp',
              ),
            ],
          ),
        if (query.hasValue && items.isEmpty)
          const EmptyState(
            title: 'Chưa có tài liệu đã mua',
            description: 'Tài liệu trả phí bạn mua sẽ xuất hiện tại đây.',
          ),
        const RouteButton(
          secondary: true,
          href: '/materials',
          label: 'Khám phá tài liệu',
        ),
      ],
    );
  }
}
