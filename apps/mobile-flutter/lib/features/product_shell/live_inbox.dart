import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../components/app_button.dart';
import '../../components/feature_page.dart';
import '../../core/config/env.dart';
import '../../core/http/app_error.dart';
import '../../core/toast/toast.dart';
import '../auth/session/auth_session.dart';
import 'schema/notification_schema.dart';

final inboxProvider = FutureProvider<List<NotificationRecord>>((ref) async {
  final phase = ref.watch(sessionSnapshotProvider).phase;
  if (phase != SessionPhase.ready) return const [];
  final page = await ref
      .read(authRuntimeProvider)
      .services
      .notifications
      .list(limit: 20);
  return page.items;
});

class LiveInbox extends ConsumerStatefulWidget {
  const LiveInbox({super.key});

  @override
  ConsumerState<LiveInbox> createState() => _LiveInboxState();
}

class _LiveInboxState extends ConsumerState<LiveInbox> {
  String _events = '';
  String _tokenId = '';

  Future<void> _listen() async {
    setState(() => _events = 'Đang mở luồng sự kiện.');
    try {
      final token = await ref.read(authRuntimeProvider).controller.getToken();
      final dio = Dio(
        BaseOptions(
          connectTimeout: const Duration(seconds: 10),
          receiveTimeout: const Duration(seconds: 8),
          responseType: ResponseType.plain,
          validateStatus: (_) => true,
        ),
      );
      final response = await dio.get<String>(
        '${getApiUrl()}/events',
        options: Options(
          headers: {
            'Accept': 'text/event-stream',
            if (token != null) 'Authorization': 'Bearer $token',
          },
        ),
      );
      final body = response.data ?? '';
      if (!mounted) return;
      setState(
        () => _events = body.isEmpty
            ? 'Luồng đã mở, chưa có sự kiện mới.'
            : body,
      );
    } catch (error) {
      if (!mounted) return;
      setState(() => _events = errorMessage(error));
    }
  }

  @override
  Widget build(BuildContext context) {
    final inbox = ref.watch(inboxProvider);
    final items = inbox.value ?? const <NotificationRecord>[];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: 12,
      children: [
        Panel(
          title: 'Hộp thư máy chủ',
          children: [
            if (inbox.isLoading && items.isEmpty)
              const Copy('Đang tải thông báo.', muted: true)
            else if (items.isEmpty)
              const Copy('Chưa có thông báo từ máy chủ.', muted: true),
            for (final item in items)
              Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Copy(item.title.isEmpty ? item.body : item.title),
                  if (item.readAt == null)
                    AppButton(
                      label: 'Đánh dấu đã đọc',
                      variant: ButtonVariant.paper,
                      onPressed: () async {
                        await ref
                            .read(authRuntimeProvider)
                            .services
                            .notifications
                            .markRead(item.id);
                        ref.invalidate(inboxProvider);
                      },
                    ),
                ],
              ),
            AppButton(
              label: 'Nghe sự kiện',
              variant: ButtonVariant.paper,
              onPressed: _listen,
            ),
            if (_events.isNotEmpty) Copy(_events, muted: true),
          ],
        ),
        Panel(
          title: 'Thông báo đẩy trên trình duyệt',
          children: [
            DataForm(
              fields: [
                DataField(
                  name: 'token',
                  label: 'Mã FCM của trình duyệt',
                  rule: (value) => value.trim().length >= 20
                      ? null
                      : 'Mã thông báo đẩy cần ít nhất 20 ký tự.',
                ),
              ],
              submitLabel: 'Đăng ký thiết bị',
              onSubmit: (values) async {
                try {
                  final saved = await ref
                      .read(authRuntimeProvider)
                      .services
                      .notifications
                      .registerPush(values['token']!.trim());
                  final id = saved['id']?.toString() ?? '';
                  if (mounted) setState(() => _tokenId = id);
                  return null;
                } catch (error) {
                  return errorMessage(error);
                }
              },
            ),
            if (_tokenId.isNotEmpty)
              AppButton(
                label: 'Ngừng thông báo cho thiết bị này',
                variant: ButtonVariant.paper,
                onPressed: () async {
                  try {
                    await ref
                        .read(authRuntimeProvider)
                        .services
                        .notifications
                        .unregisterPush(_tokenId);
                    if (mounted) setState(() => _tokenId = '');
                  } catch (error) {
                    ref
                        .read(toastProvider.notifier)
                        .show(errorMessage(error), ToastTone.error);
                  }
                },
              ),
          ],
        ),
      ],
    );
  }
}
