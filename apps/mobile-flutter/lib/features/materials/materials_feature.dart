import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../components/app_button.dart';
import '../../components/feature_page.dart';
import '../../components/misc.dart';
import '../auth/session/auth_session.dart';
import '../skills/schema/skill_schema.dart';
import '../skills/skills_feature.dart';

class LearningMaterial {
  const LearningMaterial({
    required this.id,
    required this.owner,
    required this.title,
    required this.description,
    required this.skill,
    required this.access,
    required this.price,
    required this.version,
    required this.status,
    required this.file,
    this.reason,
  });

  final String id;
  final String owner;
  final String title;
  final String description;
  final String skill;
  final String access;
  final String price;
  final int version;
  final String status;
  final String file;
  final String? reason;

  bool get mine => owner == 'me';
  String get priceLabel => access == 'FREE' ? 'Miễn phí' : '$price CR';

  LearningMaterial archived() => LearningMaterial(
    id: id,
    owner: owner,
    title: title,
    description: description,
    skill: skill,
    access: access,
    price: price,
    version: version,
    status: 'ARCHIVED',
    file: file,
    reason: reason,
  );
}

typedef MaterialsState = ({List<LearningMaterial> materials, Map<String, int> library});

class MaterialsNotifier extends Notifier<MaterialsState> {
  @override
  MaterialsState build() {
    ref.watch(sessionSnapshotProvider.select((s) => s.generation));
    return (materials: const [], library: const {});
  }

  LearningMaterial? find(String? id) =>
      state.materials.where((m) => m.id == id).firstOrNull;

  void save(LearningMaterial material) => state = (
    materials: [material, ...state.materials.where((m) => m.id != material.id)],
    library: state.library,
  );

  void grantFree(String id) {
    final m = find(id);
    if (m?.status == 'PUBLISHED' && m?.access == 'FREE') {
      state = (
        materials: state.materials,
        library: {...state.library, id: m!.version},
      );
    }
  }
}

final materialsProvider = NotifierProvider<MaterialsNotifier, MaterialsState>(
  MaterialsNotifier.new,
);

const _missing = EmptyState(
  title: 'Không tìm thấy tài liệu',
  description: 'Tài liệu không có trong bản xem thử.',
);

class _MaterialCard extends StatelessWidget {
  const _MaterialCard(this.material);

  final LearningMaterial material;

  @override
  Widget build(BuildContext context) {
    final m = material;
    return Panel(
      title: m.title,
      children: [
        StatusBadge(m.priceLabel),
        Copy(m.description),
        Copy('${m.skill} · phiên bản ${m.version}', muted: true),
        RouteButton(
          secondary: true,
          href: '/materials/${m.id}',
          label: 'Xem tài liệu',
        ),
      ],
    );
  }
}

class MaterialsScreen extends ConsumerStatefulWidget {
  const MaterialsScreen({super.key});

  @override
  ConsumerState<MaterialsScreen> createState() => _MaterialsScreenState();
}

class _MaterialsScreenState extends ConsumerState<MaterialsScreen> {
  String _search = '';
  String _filter = 'Tất cả';

  @override
  Widget build(BuildContext context) {
    final query = _search.toLowerCase();
    final items = ref
        .watch(materialsProvider)
        .materials
        .where(
          (m) =>
              m.status == 'PUBLISHED' &&
              (_filter == 'Tất cả' || m.access == _filter) &&
              '${m.title} ${m.skill}'.toLowerCase().contains(query),
        )
        .toList();
    return FeaturePage(
      title: 'Tài liệu học tập',
      back: '/home',
      subtitle: 'Tìm tài liệu hữu ích, do cộng đồng chia sẻ.',
      children: [
        SimpleInput(
          label: 'Tìm tài liệu hoặc kỹ năng',
          onChanged: (value) => setState(() => _search = value),
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
          label: 'Thư viện của tôi',
        ),
        for (final m in items) _MaterialCard(m),
        if (items.isEmpty)
          const EmptyState(
            title: 'Không tìm thấy tài liệu',
            description: 'Thử từ khóa hoặc bộ lọc khác.',
          ),
      ],
    );
  }
}

class MaterialDetailScreen extends ConsumerWidget {
  const MaterialDetailScreen({super.key, required this.id});

  final String id;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final library = ref.watch(materialsProvider).library;
    final notifier = ref.read(materialsProvider.notifier);
    final m = notifier.find(id);
    return FeaturePage(
      title: 'Chi tiết tài liệu',
      back: '/materials',
      children: m == null
          ? const [_missing]
          : [
              Panel(
                title: m.title,
                children: [
                  StatusBadge(m.status),
                  Copy(m.description),
                  Copy('${m.skill} · v${m.version} · ${m.priceLabel}'),
                  if (m.reason != null) Copy('Lý do từ chối: ${m.reason}'),
                  const Copy(
                    'Chỉ hiển thị mô tả công khai. Tệp gốc cần quyền truy cập riêng.',
                    muted: true,
                  ),
                ],
              ),
              if (m.status == 'PUBLISHED')
                if (library.containsKey(id) || m.mine)
                  RouteButton(
                    href: '/materials/$id/access',
                    label: 'Mở tài liệu mẫu',
                  )
                else if (m.access == 'FREE')
                  AppButton(
                    label: 'Nhận tài liệu miễn phí vào thư viện mẫu',
                    variant: ButtonVariant.craft,
                    onPressed: () => notifier.grantFree(id),
                  )
                else
                  RouteButton(
                    href: '/materials/$id/purchase',
                    label: 'Xem xác nhận mua',
                  ),
              if (m.mine) ...[
                RouteButton(
                  secondary: true,
                  href: '/materials/$id/edit',
                  label: 'Sửa thông tin / tạo phiên bản',
                ),
                const RouteButton(
                  secondary: true,
                  href: '/materials/mine',
                  label: 'Quản lý tài liệu tôi chia sẻ',
                ),
              ],
              RouteButton(
                secondary: true,
                href: '/reports/new?materialId=$id',
                label: 'Báo cáo tài liệu',
              ),
            ],
    );
  }
}

class MaterialLibraryScreen extends ConsumerWidget {
  const MaterialLibraryScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(materialsProvider);
    final items = state.materials
        .where((m) => state.library.containsKey(m.id))
        .toList();
    return FeaturePage(
      title: 'Thư viện của tôi',
      back: '/materials',
      children: [
        for (final m in items)
          Panel(
            title: m.title,
            children: [
              Copy(
                'Quyền truy cập mẫu · phiên bản đã nhận ${state.library[m.id]}',
              ),
              RouteButton(
                href: '/materials/${m.id}/access',
                label: 'Mở tài liệu',
              ),
            ],
          ),
        if (items.isEmpty)
          const EmptyState(
            title: 'Thư viện đang trống',
            description: 'Nhận tài liệu miễn phí hoặc xem tài liệu bạn đã mua.',
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

class MaterialAccessScreen extends ConsumerWidget {
  const MaterialAccessScreen({super.key, required this.id});

  final String id;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final library = ref.watch(materialsProvider).library;
    final m = ref.read(materialsProvider.notifier).find(id);
    final allowed =
        m != null &&
        m.status == 'PUBLISHED' &&
        (m.mine || library.containsKey(id));
    return FeaturePage(
      title: 'Đọc tài liệu',
      back: '/materials/$id',
      children: [
        if (!allowed)
          const EmptyState(
            title: 'Chưa có quyền truy cập',
            description:
                'Nhận tài liệu hoặc kiểm tra quyền mua trước khi mở tệp.',
          )
        else
          Panel(
            title: m.title,
            children: [
              Copy(
                'Tệp mẫu: ${m.file} · phiên bản quyền truy cập ${library[id] ?? m.version}',
              ),
              const Copy(
                'Nội dung minh họa: chia một bài thực hành lớn thành từng bước nhỏ. Sau mỗi bước, hãy ghi lại điều đã hiểu và một câu hỏi cần trao đổi.',
              ),
              const Copy(
                'Đây là bản đọc mẫu trong ứng dụng. Không có tệp gốc hoặc đường dẫn riêng tư được công khai.',
                muted: true,
              ),
            ],
          ),
      ],
    );
  }
}

class MyMaterialsScreen extends ConsumerStatefulWidget {
  const MyMaterialsScreen({super.key});

  @override
  ConsumerState<MyMaterialsScreen> createState() => _MyMaterialsScreenState();
}

class _MyMaterialsScreenState extends ConsumerState<MyMaterialsScreen> {
  String? _archive;

  @override
  Widget build(BuildContext context) {
    final materials = ref.watch(materialsProvider).materials;
    final notifier = ref.read(materialsProvider.notifier);
    return FeaturePage(
      title: 'Tài liệu tôi chia sẻ',
      back: '/profile',
      children: [
        const RouteButton(href: '/materials/new', label: 'Đăng tài liệu'),
        for (final m in materials.where((m) => m.mine))
          Panel(
            title: m.title,
            children: [
              StatusBadge(m.status),
              Copy(m.reason ?? m.description),
              RouteButton(
                secondary: true,
                href: '/materials/${m.id}',
                label: 'Xem & chỉnh sửa',
              ),
              if (m.status != 'ARCHIVED')
                AppButton(
                  label: 'Ngừng phân phối',
                  variant: ButtonVariant.paper,
                  onPressed: () => setState(() => _archive = m.id),
                ),
              if (_archive == m.id) ...[
                const Copy(
                  'Ngừng phân phối bản mẫu? Lịch sử phiên bản vẫn được giữ.',
                ),
                AppButton(
                  label: 'Xác nhận ngừng',
                  onPressed: () {
                    notifier.save(m.archived());
                    setState(() => _archive = null);
                  },
                ),
                AppButton(
                  label: 'Giữ tài liệu',
                  variant: ButtonVariant.paper,
                  onPressed: () => setState(() => _archive = null),
                ),
              ],
            ],
          ),
        const RouteButton(
          secondary: true,
          href: '/materials/library',
          label: 'Tài liệu đã nhận / đã mua',
        ),
      ],
    );
  }
}

class MaterialEditorScreen extends ConsumerStatefulWidget {
  const MaterialEditorScreen({super.key, this.id});

  final String? id;

  @override
  ConsumerState<MaterialEditorScreen> createState() =>
      _MaterialEditorScreenState();
}

class _MaterialEditorScreenState extends ConsumerState<MaterialEditorScreen> {
  List<String> _files = const [];
  String _error = '';

  @override
  Widget build(BuildContext context) {
    final id = widget.id;
    ref.watch(materialsProvider);
    final catalogNames = [
      for (final item in ref.watch(skillCatalogProvider).value ?? const <SkillRecord>[])
        item.name,
    ];
    final notifier = ref.read(materialsProvider.notifier);
    final m = notifier.find(id);
    return FeaturePage(
      title: id != null ? 'Sửa tài liệu / phiên bản mới' : 'Đăng tài liệu',
      back: '/materials/mine',
      children: [
        if (id != null && (m == null || !m.mine || m.status == 'ARCHIVED'))
          const EmptyState(
            title: 'Không thể chỉnh sửa',
            description: 'Bạn chỉ chỉnh sửa tài liệu của mình còn được quản lý.',
          )
        else
          Panel(
            title: 'Chia sẻ tài liệu hữu ích',
            children: [
              SampleFiles(
                value: _files,
                maxCount: 1,
                onChange: (files) => setState(() => _files = files),
              ),
              if (m != null)
                Copy(
                  'Tệp hiện tại: ${m.file}. Chọn tệp mới sẽ tạo phiên bản mới.',
                ),
              if (_error.isNotEmpty)
                FormNotice(tone: NoticeTone.error, message: _error),
              DataForm(
                defaults: {
                  'title': m?.title ?? '',
                  'description': m?.description ?? '',
                  'skill': m?.skill ?? 'React',
                  'access': m?.access ?? 'FREE',
                  'price': m?.price ?? '0',
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
                    choices: catalogNames,
                  ),
                  DataField(
                    name: 'access',
                    label: 'Cách chia sẻ',
                    rule: (v) => v.isEmpty ? 'Chọn một lựa chọn.' : null,
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
                    rule: (v) =>
                        v.isEmpty ? 'Xác nhận quyền phân phối.' : null,
                    choices: const ['Tôi có quyền phân phối nội dung này'],
                  ),
                ],
                submitLabel: 'Gửi tài liệu mẫu để duyệt',
                onSubmit: (v) {
                  if (m == null && _files.isEmpty) {
                    setState(() => _error = 'Chọn một tệp tài liệu mẫu.');
                    return null;
                  }
                  final price = num.parse(v['price']!);
                  if (v['access'] == 'FREE' && price != 0) {
                    return 'Tài liệu FREE phải có giá 0.';
                  }
                  if (v['access'] == 'PAID' && price <= 0) {
                    return 'Tài liệu PAID phải có giá lớn hơn 0.';
                  }
                  final key =
                      id ?? 'material-${DateTime.now().millisecondsSinceEpoch}';
                  notifier.save(
                    LearningMaterial(
                      id: key,
                      owner: 'me',
                      title: v['title']!,
                      description: v['description']!,
                      skill: v['skill']!,
                      access: v['access']!,
                      price: v['price']!,
                      version: (m?.version ?? 0) + 1,
                      status: 'PENDING_REVIEW',
                      file: _files.firstOrNull ?? m!.file,
                    ),
                  );
                  context.pushReplacement('/materials/$key');
                  return null;
                },
              ),
              const Copy(
                'Tệp cần kiểm tra định dạng, kích thước theo cấu hình riêng và quét an toàn trước khi công bố. Không dùng giới hạn 15 MB của chat.',
                muted: true,
              ),
            ],
          ),
      ],
    );
  }
}

class MaterialPurchaseScreen extends ConsumerStatefulWidget {
  const MaterialPurchaseScreen({
    super.key,
    required this.id,
    this.changed = false,
  });

  final String id;
  final bool changed;

  @override
  ConsumerState<MaterialPurchaseScreen> createState() =>
      _MaterialPurchaseScreenState();
}

class _MaterialPurchaseScreenState
    extends ConsumerState<MaterialPurchaseScreen> {
  late bool _acceptedSnapshot = !widget.changed;

  @override
  Widget build(BuildContext context) {
    final id = widget.id;
    final library = ref.watch(materialsProvider).library;
    final m = ref.read(materialsProvider.notifier).find(id);
    return FeaturePage(
      title: 'Xác nhận mua tài liệu',
      back: '/materials/$id',
      children: [
        if (m == null ||
            m.status != 'PUBLISHED' ||
            m.access != 'PAID' ||
            m.mine)
          const EmptyState(
            title: 'Không thể mua tài liệu này',
            description: 'Chỉ mua tài liệu trả phí đã công bố của người khác.',
          )
        else if (library.containsKey(id))
          Panel(
            title: 'Bạn đã có quyền truy cập',
            children: [
              const Copy('Không thu tiền lần thứ hai cho tài liệu đã mua.'),
              RouteButton(
                href: '/materials/$id/access',
                label: 'Mở tài liệu mẫu',
              ),
            ],
          )
        else
          Panel(
            title: m.title,
            children: [
              if (!_acceptedSnapshot) ...[
                const FormNotice(
                  tone: NoticeTone.info,
                  message:
                      'Giá hoặc phiên bản đã thay đổi. Kiểm tra snapshot hiện tại trước khi tiếp tục.',
                ),
                AppButton(
                  label: 'Tôi đã xem giá & phiên bản mới',
                  variant: ButtonVariant.paper,
                  onPressed: () => setState(() => _acceptedSnapshot = true),
                ),
              ],
              Metric(label: 'Giá hiện tại', value: '${m.price} CR'),
              Copy('Phiên bản sẽ mua: ${m.version}'),
              const Copy(
                'Credit dùng từ số dư khả dụng, riêng với thỏa thuận học. Quyền truy cập gắn phiên bản đã mua.',
              ),
              const AppButton(
                label: 'Xác nhận mua',
                disabled: true,
                onPressed: null,
              ),
              const FormNotice(
                tone: NoticeTone.info,
                message:
                    'Luồng mua chưa được bật: cần chính sách phí tài liệu được chốt và dịch vụ thanh toán Credit. Bản xem thử không thu tiền hoặc tạo quyền mua.',
              ),
              const RouteButton(
                secondary: true,
                href: '/materials/library',
                label: 'Xem thư viện có quyền mẫu',
              ),
            ],
          ),
      ],
    );
  }
}
