import 'dart:async';
import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';

import '../../components/app_button.dart';
import '../../components/app_input.dart';
import '../../components/avatar.dart';
import '../../components/misc.dart';
import '../../core/http/app_error.dart';
import '../../core/theme/tokens.dart';
import '../../core/toast/toast.dart';
import '../account/account_api.dart';
import '../auth/session/auth_session.dart';
import '../auth/session/avatar_monitor.dart';
import '../shell/app_screen_layout.dart';
import 'profile_widgets.dart';

const _avatarMaxBytes = 5 * 1024 * 1024;

/// Matches the backend validator: variation selectors and surrogate pairs
/// count as one character.
int profileTextLength(String value) {
  final selectors = RegExp(r'[^\uFE0F\uFE0E][\uFE0F\uFE0E]').allMatches(value);
  final pairs = RegExp(r'[\uD800-\uDBFF][\uDC00-\uDFFF]').allMatches(value);
  return value.length - selectors.length - pairs.length;
}

final _hasLetter = RegExp(r'\p{L}', unicode: true);
final _nameChars = RegExp("^[\\p{L}\\p{M} '\u2019-]+\$", unicode: true);

String? validateProfileName(String value) {
  final name = value.trim();
  final length = name.runes.length;
  if (length < 2 || length > 100) return 'Tên hiển thị cần từ 2 đến 100 ký tự.';
  if (!_hasLetter.hasMatch(name) || !_nameChars.hasMatch(name)) {
    return 'Tên chỉ gồm chữ, khoảng trắng, dấu nháy hoặc gạch nối.';
  }
  return null;
}

String profileSaveErrorMessage(Object error) {
  if (error is AppError &&
      (error.kind == AppErrorKind.network ||
          error.kind == AppErrorKind.protocol ||
          error.status >= 500)) {
    return 'Chưa xác nhận được kết quả lưu. Bản nháp vẫn được giữ. Hãy kiểm tra hồ sơ trước khi lưu lại.';
  }
  return errorMessage(error);
}

String avatarSaveErrorMessage(Object error) {
  if (error is AppError) {
    if (error.status == 413) {
      return 'Ảnh đại diện tối đa 5MB. Hãy chọn ảnh nhỏ hơn.';
    }
    if (error.status == 415 ||
        error.code == 'INVALID_IMAGE' ||
        error.code == 'MIME_MISMATCH') {
      return 'Ảnh không hợp lệ. Hãy chọn ảnh JPG, PNG hoặc WebP khác.';
    }
    if (error.kind == AppErrorKind.network ||
        error.kind == AppErrorKind.protocol ||
        error.status >= 500) {
      return 'Chưa xác nhận được thay đổi ảnh. Hãy kiểm tra hồ sơ trước khi thử lại; ảnh đã chọn vẫn được giữ.';
    }
  }
  return errorMessage(error);
}

class _SelectionError implements Exception {
  const _SelectionError(this.message);
  final String message;
}

typedef AvatarImage = ({Uint8List bytes, String mime, String name});

sealed class AvatarDraft {
  const AvatarDraft();
}

class AvatarUploadDraft extends AvatarDraft {
  const AvatarUploadDraft(this.image);
  final AvatarImage image;
}

class AvatarRemoveDraft extends AvatarDraft {
  const AvatarRemoveDraft();
}

String? _sniffMime(Uint8List bytes) {
  bool at(int offset, List<int> signature) {
    if (bytes.length < offset + signature.length) return false;
    for (var i = 0; i < signature.length; i++) {
      if (bytes[offset + i] != signature[i]) return false;
    }
    return true;
  }

  if (at(0, const [0xFF, 0xD8, 0xFF])) return 'image/jpeg';
  if (at(0, const [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])) {
    return 'image/png';
  }
  if (at(0, 'RIFF'.codeUnits) && at(8, 'WEBP'.codeUnits)) return 'image/webp';
  return null;
}

Future<AvatarImage> _avatarImage(XFile file) async {
  final size = await file.length();
  if (size > _avatarMaxBytes) {
    throw const _SelectionError('Ảnh đại diện tối đa 5MB.');
  }
  if (size == 0) {
    throw const _SelectionError('Ảnh không hợp lệ. Hãy chọn ảnh khác.');
  }
  final bytes = await file.readAsBytes();
  final mime = _sniffMime(bytes);
  if (mime == null) throw const _SelectionError('Chọn ảnh JPG, PNG hoặc WebP.');
  final ui.Codec codec;
  try {
    codec = await ui.instantiateImageCodec(bytes);
  } catch (_) {
    throw const _SelectionError('Ảnh không hợp lệ. Hãy chọn ảnh khác.');
  }
  try {
    final frame = await codec.getNextFrame();
    final pixels = frame.image.width * frame.image.height;
    frame.image.dispose();
    if (pixels > 20000000) {
      throw const _SelectionError(
        'Ảnh quá lớn. Chọn ảnh không quá 20 megapixel.',
      );
    }
  } on _SelectionError {
    rethrow;
  } catch (_) {
    throw const _SelectionError('Ảnh không hợp lệ. Hãy chọn ảnh khác.');
  } finally {
    codec.dispose();
  }
  return (
    bytes: bytes,
    mime: mime,
    name: 'avatar.${mime == 'image/jpeg' ? 'jpg' : mime.split('/')[1]}',
  );
}

FormData _avatarFormData(AvatarImage image) => FormData.fromMap({
  'image': MultipartFile.fromBytes(
    image.bytes,
    filename: image.name,
    contentType: DioMediaType.parse(image.mime),
  ),
});

typedef _ProfileDraft = ({String fullName, String headline, String bio});

class EditProfileScreen extends ConsumerWidget {
  const EditProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(accountSessionProvider);
    if (session == null) return const SizedBox.shrink();
    final generation = ref.watch(
      sessionSnapshotProvider.select((s) => s.generation),
    );
    return _ProfileForm(key: ValueKey(generation), session: session);
  }
}

class _ProfileForm extends ConsumerStatefulWidget {
  const _ProfileForm({super.key, required this.session});

  final AccountSession session;

  @override
  ConsumerState<_ProfileForm> createState() => _ProfileFormState();
}

class _ProfileFormState extends ConsumerState<_ProfileForm> {
  late _ProfileDraft _initial = (
    fullName: widget.session.name,
    headline: widget.session.headline,
    bio: widget.session.bio,
  );
  late final _name = AppField(
    text: _initial.fullName,
    validator: validateProfileName,
  );
  late final _headline = AppField(
    text: _initial.headline,
    validator: (value) => profileTextLength(value) > 120
        ? 'Dòng giới thiệu tối đa 120 ký tự.'
        : null,
  );
  late final _bio = AppField(
    text: _initial.bio,
    validator: (value) => profileTextLength(value) > 1000
        ? 'Giới thiệu bản thân tối đa 1.000 ký tự.'
        : null,
  );

  AvatarDraft? _avatarDraft;
  bool _picking = false;
  bool _saving = false;
  String? _pickerError;
  Object? _profileError;
  Object? _avatarError;
  bool _profileSaved = false;

  bool get _pending => _picking || _saving;

  _ProfileDraft get _values =>
      (fullName: _name.text.trim(), headline: _headline.text, bio: _bio.text);

  bool _profileChanged(_ProfileDraft values) =>
      _initial.fullName != values.fullName ||
      _initial.headline != values.headline ||
      _initial.bio != values.bio;

  int get _generation => ref.read(authRuntimeProvider).controller.generation;

  @override
  void dispose() {
    _name.dispose();
    _headline.dispose();
    _bio.dispose();
    super.dispose();
  }

  void _back() {
    if (_pending) return;
    if (context.canPop()) {
      context.pop();
    } else {
      context.go('/profile');
    }
  }

  void _changeAvatar(AvatarDraft? draft) => setState(() {
    _avatarDraft = draft;
    _pickerError = null;
    _avatarError = null;
  });

  Future<void> _pickAvatar() async {
    if (_pending) return;
    setState(() {
      _picking = true;
      _pickerError = null;
    });
    final generation = _generation;
    bool isCurrent() => mounted && generation == _generation;
    try {
      final file = await ImagePicker().pickImage(
        source: ImageSource.gallery,
        requestFullMetadata: false,
      );
      if (file != null && isCurrent()) {
        final image = await _avatarImage(file);
        if (isCurrent()) _changeAvatar(AvatarUploadDraft(image));
      }
    } on _SelectionError catch (error) {
      if (isCurrent()) setState(() => _pickerError = error.message);
    } catch (_) {
      if (isCurrent()) {
        setState(
          () => _pickerError = 'Không mở được thư viện ảnh. Hãy thử lại.',
        );
      }
    } finally {
      if (isCurrent()) setState(() => _picking = false);
    }
  }

  Future<void> _save() async {
    final values = _values;
    if (_pending || (!_profileChanged(values) && _avatarDraft == null)) return;
    if (!validateFields([_name, _headline, _bio])) return;
    final runtime = ref.read(authRuntimeProvider);
    final account = ref.read(accountProvider.notifier);
    final toast = ref.read(toastProvider.notifier);
    final generation = _generation;
    bool isCurrent() => mounted && generation == _generation;
    toast.dismiss();
    FocusScope.of(context).unfocus();
    setState(() {
      _saving = true;
      _profileSaved = false;
      _profileError = null;
      _avatarError = null;
    });
    try {
      if (_profileChanged(values)) {
        try {
          final profile = await runtime.accountApi.updateProfile(
            ProfilePatch(
              fullName: values.fullName,
              headline: values.headline,
              bio: values.bio,
            ),
          );
          if (generation != _generation ||
              profile.userId != widget.session.userId) {
            throw const AppError.session();
          }
          account.replaceProfile(profile);
          unawaited(account.reload().then((_) {}, onError: (_) {}));
        } catch (error) {
          if (isCurrent()) setState(() => _profileError = error);
          return;
        }
        if (!isCurrent()) return;
        setState(() {
          _initial = values;
          _profileSaved = true;
        });
      }
      final draft = _avatarDraft;
      AvatarUpload? upload;
      if (draft != null) {
        try {
          if (draft is AvatarUploadDraft) {
            upload = await runtime.accountApi.uploadAvatar(
              _avatarFormData(draft.image),
            );
          } else {
            await runtime.accountApi.removeAvatar();
          }
          if (generation != _generation) throw const AppError.session();
          ref.read(avatarMonitorProvider.notifier).track(upload);
          if (upload == null) {
            account.replaceProfile(widget.session.profile.withoutAvatar());
            unawaited(account.reload().then((_) {}, onError: (_) {}));
          }
        } catch (error) {
          if (isCurrent()) setState(() => _avatarError = error);
          return;
        }
      }
      if (!mounted || generation != _generation) return;
      _avatarDraft = null;
      toast.show(
        upload != null
            ? 'Ảnh đã tải lên, đang kiểm tra.'
            : 'Hồ sơ đã được cập nhật.',
        upload != null ? ToastTone.info : ToastTone.success,
      );
      context.go('/profile');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final session = widget.session;
    return PopScope(
      canPop: !_pending,
      child: AppScreenLayout(
        title: 'Chỉnh sửa hồ sơ',
        back: (route: '/profile', label: 'Quay lại hồ sơ'),
        background: Chrome.background,
        surface: Chrome.surface,
        child: ListView(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 22),
          keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
          children: [
            Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 560),
                child: ListenableBuilder(
                  listenable: Listenable.merge([_name, _headline, _bio]),
                  builder: (context, _) {
                    final changed =
                        _profileChanged(_values) || _avatarDraft != null;
                    return Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      spacing: 20,
                      children: [
                        _AvatarDraftEditor(
                          session: session,
                          draft: _avatarDraft,
                          disabled: _pending,
                          picking: _picking,
                          error: _pickerError,
                          onPick: _pickAvatar,
                          onChange: _changeAvatar,
                        ),
                        ProfileSection(
                          spacing: 12,
                          children: [
                            Semantics(
                              header: true,
                              child: Text(
                                'Thông tin cơ bản',
                                style: profileHeading,
                              ),
                            ),
                            AppInput(
                              field: _name,
                              label: 'Tên hiển thị',
                              required: true,
                              editable: !_pending,
                              textCapitalization: TextCapitalization.words,
                              autofillHints: const [AutofillHints.name],
                              textInputAction: TextInputAction.next,
                              onChanged: (_) => _clearProfileError(),
                              onSubmitted: _headline.focus.requestFocus,
                            ),
                            AppInput(
                              field: _headline,
                              label: 'Vai trò / tiêu đề',
                              placeholder: 'Ví dụ: Frontend Developer',
                              hint: 'Không bắt buộc. Tối đa 120 ký tự.',
                              editable: !_pending,
                              textInputAction: TextInputAction.next,
                              onChanged: (_) => _clearProfileError(),
                              onSubmitted: _bio.focus.requestFocus,
                            ),
                            AppInput(
                              field: _bio,
                              label: 'Giới thiệu bản thân',
                              hint: 'Không bắt buộc. Tối đa 1.000 ký tự.',
                              editable: !_pending,
                              multiline: true,
                              onChanged: (_) => _clearProfileError(),
                            ),
                          ],
                        ),
                        if (_profileError != null)
                          FormNotice(
                            tone: NoticeTone.error,
                            message: profileSaveErrorMessage(_profileError!),
                          ),
                        if (_avatarError != null)
                          FormNotice(
                            tone: NoticeTone.error,
                            message:
                                '${_profileSaved ? 'Thông tin hồ sơ đã lưu. ' : ''}'
                                '${avatarSaveErrorMessage(_avatarError!)}',
                          ),
                        Row(
                          spacing: 12,
                          children: [
                            Expanded(
                              child: AppButton(
                                label: 'Hủy',
                                size: ButtonSize.lg,
                                variant: ButtonVariant.secondary,
                                disabled: _pending,
                                onPressed: _back,
                              ),
                            ),
                            Expanded(
                              child: AppButton(
                                label: _saving
                                    ? 'Đang lưu...'
                                    : 'Lưu thay đổi',
                                size: ButtonSize.lg,
                                disabled: _pending || !changed,
                                onPressed: _save,
                              ),
                            ),
                          ],
                        ),
                      ],
                    );
                  },
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _clearProfileError() {
    if (_profileError != null) setState(() => _profileError = null);
  }
}

class _AvatarDraftEditor extends StatelessWidget {
  const _AvatarDraftEditor({
    required this.session,
    required this.draft,
    required this.disabled,
    required this.picking,
    required this.error,
    required this.onPick,
    required this.onChange,
  });

  final AccountSession session;
  final AvatarDraft? draft;
  final bool disabled;
  final bool picking;
  final String? error;
  final VoidCallback onPick;
  final ValueChanged<AvatarDraft?> onChange;

  @override
  Widget build(BuildContext context) {
    final draft = this.draft;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: 8,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 8),
          child: Wrap(
            crossAxisAlignment: WrapCrossAlignment.center,
            spacing: 16,
            runSpacing: 16,
            children: [
              Avatar(
                name: session.name,
                userId: session.userId,
                size: AvatarSizes.profile,
                imageUrl: draft == null ? session.avatarUrl : null,
                imageBytes: draft is AvatarUploadDraft
                    ? draft.image.bytes
                    : null,
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                spacing: 8,
                children: [
                  AppButton(
                    label: picking ? 'Đang chọn ảnh...' : 'Thay ảnh đại diện',
                    variant: ButtonVariant.secondary,
                    disabled: disabled,
                    onPressed: onPick,
                  ),
                  Text('JPG, PNG, WebP. Tối đa 5MB.', style: profileCaption),
                  if (draft != null)
                    AppButton(
                      label: 'Bỏ thay đổi ảnh',
                      variant: ButtonVariant.ghost,
                      disabled: disabled,
                      onPressed: () => onChange(null),
                    )
                  else if (session.avatarUrl != null)
                    AppButton(
                      label: 'Xóa ảnh đại diện',
                      variant: ButtonVariant.ghost,
                      disabled: disabled,
                      onPressed: () => onChange(const AvatarRemoveDraft()),
                    ),
                ],
              ),
            ],
          ),
        ),
        if (draft != null)
          Text(
            draft is AvatarUploadDraft
                ? 'Ảnh mới sẽ được tải lên khi lưu.'
                : 'Ảnh đại diện sẽ được xóa khi lưu.',
            style: profileCaption,
          ),
        if (draft == null && error == null) const AvatarUploadNotice(),
        if (error != null) FormNotice(tone: NoticeTone.error, message: error!),
      ],
    );
  }
}
