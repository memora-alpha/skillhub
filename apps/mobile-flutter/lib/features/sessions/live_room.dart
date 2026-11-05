import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart' hide ConnectionState;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:livekit_client/livekit_client.dart';

import '../../components/app_button.dart';
import '../../components/avatar.dart';
import '../../components/feature_page.dart';
import '../../components/misc.dart';
import '../../core/http/app_error.dart';
import '../../core/theme/tokens.dart';
import '../auth/session/auth_session.dart';
import '../profile/public_profiles_data.dart';
import '../remote/refresh_signal.dart';
import '../shell/app_screen_layout.dart';
import 'live_sessions.dart';
import 'room_chat.dart';

enum _RoomStatus { connecting, connected, reconnecting, disconnected }

class LiveRoomPage extends ConsumerStatefulWidget {
  const LiveRoomPage({super.key, required this.id});

  final String id;

  @override
  ConsumerState<LiveRoomPage> createState() => _LiveRoomPageState();
}

class _LiveRoomPageState extends ConsumerState<LiveRoomPage>
    with WidgetsBindingObserver {
  Room? _room;
  EventsListener<RoomEvent>? _roomEvents;
  RoomChatTransport? _chat;
  LocalVideoTrack? _preview;
  var _attempt = 0;
  var _startCamera = false;
  var _startMicrophone = false;
  var _entering = false;
  var _mediaBusy = false;
  var _mediaPending = true;
  var _leave = false;
  var _expanded = true;
  var _chatOpen = false;
  var _sharingScreen = false;
  final _focused = true;
  var _facing = CameraPosition.front;
  var _status = _RoomStatus.disconnected;
  String? _error;
  String? _mediaNotice;
  String? _notice;
  var _chatMessages = const <RoomChatMessage>[];
  var _chatStatus = RoomChatStatus.disconnected;
  String? _chatError;
  var _chatPending = false;
  final _chatDraft = TextEditingController();
  final _chatScroll = ScrollController();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _chatDraft.dispose();
    _chatScroll.dispose();
    unawaited(_stopPreview());
    final room = _room;
    _room = null;
    _detachChat();
    if (room != null) unawaited(_shutdown(room));
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    // Web: switching browser tabs fires hidden/paused. Keep LiveKit up so two
    // accounts in two tabs of the same browser can share one session room.
    if (kIsWeb) return;
    if (state == AppLifecycleState.paused ||
        state == AppLifecycleState.hidden) {
      if (_sharingScreen) return;
      if (_preview != null) unawaited(_stopPreview());
      if (_room != null) {
        unawaited(_dropCall(
          notice:
              'Cuộc gọi đã dừng khi ứng dụng chuyển sang nền. Bạn có thể vào lại phòng.',
        ));
      }
    } else if (state == AppLifecycleState.resumed &&
        _startCamera &&
        _room == null &&
        _attempt == 0) {
      unawaited(_ensurePreview());
    }
  }

  bool _lifecycleAllowsCall() {
    if (kIsWeb || _sharingScreen) return true;
    final life = WidgetsBinding.instance.lifecycleState;
    return life == AppLifecycleState.resumed || life == null;
  }

  bool _callIsCurrent(Map<String, dynamic> session) {
    final status = session['status']?.toString() ?? '';
    final end = sessionInstant(session['endAt']);
    return _focused &&
        _lifecycleAllowsCall() &&
        const {'CONFIRMED', 'READY', 'ONGOING'}.contains(status) &&
        (end == null || DateTime.now().isBefore(end));
  }

  void _onRoom() {
    if (mounted) setState(() {});
  }

  void _detachChat() {
    _chat?.close();
    _chat = null;
    _chatMessages = const [];
    _chatStatus = RoomChatStatus.disconnected;
    _chatError = null;
    _chatPending = false;
  }

  Future<void> _shutdown(Room room) async {
    _roomEvents?.dispose();
    _roomEvents = null;
    room.removeListener(_onRoom);
    try {
      await room.disconnect();
    } catch (_) {}
    try {
      await room.dispose();
    } catch (_) {}
  }

  Future<void> _stopPreview() async {
    final track = _preview;
    _preview = null;
    if (track == null) return;
    try {
      await track.stop();
    } catch (_) {}
  }

  Future<void> _ensurePreview() async {
    // Match RN web: no local getUserMedia preview (holds the only camera).
    if (kIsWeb || !_startCamera || _room != null || _preview != null) return;
    try {
      final track = await LocalVideoTrack.createCameraTrack(
        const CameraCaptureOptions(cameraPosition: CameraPosition.front),
      );
      if (!mounted || !_startCamera || _room != null) {
        await track.stop();
        return;
      }
      setState(() => _preview = track);
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _startCamera = false;
        _mediaNotice =
            'Chưa mở được camera. Kiểm tra quyền hoặc tắt camera để vào phòng trước.';
      });
    }
  }

  Future<void> _setStartCamera(bool value) async {
    setState(() {
      _startCamera = value;
      if (!value) _mediaNotice = null;
    });
    if (value) {
      await _ensurePreview();
    } else {
      await _stopPreview();
      if (mounted) setState(() {});
    }
  }

  Future<void> _dropCall({String? notice}) async {
    final room = _room;
    _room = null;
    _detachChat();
    _sharingScreen = false;
    _attempt = 0;
    _status = _RoomStatus.disconnected;
    _expanded = false;
    _chatOpen = false;
    _leave = false;
    if (notice != null) _notice = notice;
    if (mounted) setState(() {});
    if (room != null) await _shutdown(room);
  }

  Future<void> _enter(Map<String, dynamic> session) async {
    if (_entering || _room != null || !_callIsCurrent(session)) return;
    final join = session['join'] is Map
        ? Map<String, dynamic>.from(session['join'] as Map)
        : const <String, dynamic>{};
    if (join['canJoin'] != true) return;
    setState(() {
      _entering = true;
      _error = null;
      _mediaNotice = null;
      _notice = null;
      _leave = false;
      _attempt += 1;
      _status = _RoomStatus.connecting;
      _mediaPending = true;
      _expanded = true;
    });
    await _stopPreview();
    final room = Room(
      roomOptions: const RoomOptions(adaptiveStream: true, dynacast: true),
    );
    room.addListener(_onRoom);
    _room = room;
    final ticket = _attempt;
    final listener = room.createListener()
      ..on<RoomReconnectingEvent>((_) {
        if (!mounted || _attempt != ticket || !identical(_room, room)) return;
        setState(() => _status = _RoomStatus.reconnecting);
      })
      ..on<RoomResumingEvent>((_) {
        if (!mounted || _attempt != ticket || !identical(_room, room)) return;
        setState(() => _status = _RoomStatus.reconnecting);
      })
      ..on<RoomReconnectedEvent>((_) {
        if (!mounted || _attempt != ticket || !identical(_room, room)) return;
        setState(() => _status = _RoomStatus.connected);
      })
      ..on<RoomDisconnectedEvent>((_) {
        if (!identical(_room, room) || !mounted || _attempt != ticket) return;
        _detachChat();
        _sharingScreen = false;
        setState(() {
          _status = _RoomStatus.disconnected;
          _error =
              'Kết nối phòng học đã đóng. Bạn có thể thử vào lại phòng.';
          _expanded = false;
          _chatOpen = false;
          _leave = false;
        });
        unawaited(_shutdown(room));
        if (identical(_room, room)) _room = null;
      })
      ..on<LocalTrackPublishedEvent>((event) {
        _syncScreenShare(room);
      })
      ..on<LocalTrackUnpublishedEvent>((event) {
        _syncScreenShare(room);
      });
    _roomEvents = listener;
    try {
      final token = await ref
          .read(authRuntimeProvider)
          .services
          .study
          .liveKitToken(widget.id);
      if (!mounted || _attempt != ticket || !identical(_room, room)) {
        await _shutdown(room);
        return;
      }
      final url = token['serverUrl']?.toString() ?? '';
      final jwt = token['participantToken']?.toString() ?? '';
      if (url.isEmpty || jwt.isEmpty) {
        throw StateError('missing-livekit-token');
      }
      await room.connect(url, jwt);
      if (!mounted || _attempt != ticket || !identical(_room, room)) {
        await _shutdown(room);
        return;
      }
      _attachChat(room, session);
      setState(() {
        _entering = false;
        _status = _RoomStatus.connected;
      });
      await _publishStartMedia(room, ticket);
    } catch (error) {
      if (identical(_room, room)) _room = null;
      _detachChat();
      await _shutdown(room);
      if (!mounted || _attempt != ticket) return;
      setState(() {
        _entering = false;
        _attempt = 0;
        _status = _RoomStatus.disconnected;
        _error = error is AppError
            ? errorMessage(error)
            : 'Không kết nối được phòng học. Kiểm tra mạng và thử lại.';
      });
    }
  }

  void _attachChat(Room room, Map<String, dynamic> session) {
    _detachChat();
    final peer = _partnerIdentity(session);
    if (peer.isEmpty) return;
    _chat = RoomChatTransport(
      room: room,
      peerIdentity: peer,
      isCurrent: () =>
          identical(_room, room) &&
          _callIsCurrent(ref.read(liveSessionProvider(widget.id)).value ?? {}),
      changed: (messages) {
        if (!mounted || !identical(_room, room)) return;
        setState(() => _chatMessages = messages);
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (!_chatScroll.hasClients) return;
          _chatScroll.animateTo(
            _chatScroll.position.maxScrollExtent,
            duration: const Duration(milliseconds: 200),
            curve: Curves.easeOut,
          );
        });
      },
      statusChanged: (status) {
        if (!mounted || !identical(_room, room)) return;
        setState(() => _chatStatus = status);
      },
    );
  }

  Future<void> _publishStartMedia(Room room, int ticket) async {
    final local = room.localParticipant;
    if (local == null) return;
    Future<bool> publish(Future<LocalTrackPublication?> Function() work) async {
      try {
        final publication = await work();
        if (!identical(_room, room) || _attempt != ticket) {
          publication?.track?.stop();
          return false;
        }
      } catch (_) {
        if (identical(_room, room) && mounted) {
          setState(() {
            _mediaNotice = kIsWeb
                ? 'Chưa bật được camera hoặc micro (trình duyệt thường chỉ cho một tab dùng camera). Bạn vẫn ở trong phòng; tắt camera ở tab kia rồi bật lại.'
                : 'Chưa bật được camera hoặc micro. Bạn vẫn có thể nghe và xem; hãy kiểm tra quyền rồi bật lại bằng nút bên dưới.';
          });
        }
      }
      return true;
    }

    if (_startMicrophone) {
      if (!await publish(() => local.setMicrophoneEnabled(true))) return;
    }
    if (_startCamera) {
      if (!await publish(
        () => local.setCameraEnabled(
          true,
          cameraCaptureOptions: CameraCaptureOptions(
            cameraPosition: _facing,
          ),
        ),
      )) {
        return;
      }
    }
    if (mounted && identical(_room, room) && _attempt == ticket) {
      setState(() => _mediaPending = false);
    }
  }

  void _syncScreenShare(Room room) {
    final sharing = room.localParticipant?.isScreenShareEnabled() == true;
    _sharingScreen = sharing;
    if (kIsWeb) return;
    final life = WidgetsBinding.instance.lifecycleState;
    if (!sharing &&
        (life == AppLifecycleState.paused ||
            life == AppLifecycleState.hidden)) {
      unawaited(_dropCall(
        notice:
            'Cuộc gọi đã dừng khi ứng dụng chuyển sang nền. Bạn có thể vào lại phòng.',
      ));
    }
  }

  String _partnerId(Map<String, dynamic> session) {
    final me = ref.read(accountSessionProvider)?.userId ?? '';
    final teacherId = session['teacherId']?.toString() ?? '';
    final learnerId = session['learnerId']?.toString() ?? '';
    if (me.isEmpty || teacherId.isEmpty || learnerId.isEmpty) return '';
    return me == teacherId ? learnerId : teacherId;
  }

  String _partnerIdentity(Map<String, dynamic> session) {
    final partnerId = _partnerId(session);
    if (partnerId.isEmpty) return '';
    return '${widget.id}:$partnerId';
  }

  Future<void> _performMedia(Future<void> Function() work) async {
    final room = _room;
    final local = room?.localParticipant;
    if (room == null ||
        local == null ||
        _mediaBusy ||
        _mediaPending ||
        _status != _RoomStatus.connected) {
      return;
    }
    setState(() => _mediaBusy = true);
    try {
      await work();
      if (identical(_room, room)) _mediaNotice = null;
    } catch (_) {
      if (identical(_room, room) && mounted) {
        setState(() {
          _mediaNotice =
              'Chưa bật được camera hoặc micro. Bạn vẫn có thể nghe và xem; hãy kiểm tra quyền rồi bật lại bằng nút bên dưới.';
        });
      }
    } finally {
      if (mounted) setState(() => _mediaBusy = false);
    }
  }

  Future<void> _retry(Map<String, dynamic> session) async {
    if (_entering || _room != null) return;
    ref.read(refreshTicksProvider.notifier).bump(const {RefreshScope.study});
    try {
      final next = await ref.refresh(liveSessionProvider(widget.id).future);
      if (!mounted) return;
      if (!_callIsCurrent(next)) {
        setState(() {
          _attempt = 0;
          _notice = knownMessage(
            (next['join'] is Map
                    ? (next['join'] as Map)['reason']
                    : null)
                ?.toString(),
            'Chưa vào phòng được.',
          );
        });
        return;
      }
      final join = next['join'] is Map
          ? Map<String, dynamic>.from(next['join'] as Map)
          : const <String, dynamic>{};
      if (join['canJoin'] != true) {
        setState(() {
          _attempt = 0;
          _notice = knownMessage(
            join['reason']?.toString(),
            'Chưa vào phòng được.',
          );
        });
        return;
      }
      setState(() {
        _attempt = 0;
        _error = null;
      });
      await _enter(next);
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error is AppError
            ? errorMessage(error)
            : 'Không kết nối được phòng học. Kiểm tra mạng và thử lại.';
      });
    }
  }

  Future<void> _sendChat() async {
    final text = _chatDraft.text;
    final chat = _chat;
    if (chat == null || _chatPending || _chatStatus != RoomChatStatus.ready) {
      return;
    }
    setState(() {
      _chatPending = true;
      _chatError = null;
    });
    try {
      final sent = await chat.send(text);
      if (sent && mounted && _chatDraft.text == text) _chatDraft.clear();
    } catch (error) {
      if (mounted) {
        setState(() {
          _chatError = error is StateError
              ? error.message
              : 'Không gửi được tin nhắn.';
        });
      }
    } finally {
      if (mounted) setState(() => _chatPending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final query = ref.watch(liveSessionProvider(widget.id));
    final session = query.value ?? const <String, dynamic>{};
    final join = session['join'] is Map
        ? Map<String, dynamic>.from(session['join'] as Map)
        : const <String, dynamic>{};
    final canJoin = join['canJoin'] == true;
    final end = sessionInstant(session['endAt']);
    final ended = end != null && !DateTime.now().isBefore(end);
    final status = session['status']?.toString() ?? '';
    final terminal = session.isNotEmpty &&
        !const {'CONFIRMED', 'READY', 'ONGOING'}.contains(status);
    final partnerId = _partnerId(session);
    final partner = partnerId.isEmpty
        ? null
        : ref.watch(publicProfileProvider(partnerId)).value;
    final partnerName =
        (partner?.name.trim().isNotEmpty == true)
            ? partner!.name
            : 'Người trao đổi';
    final partnerAvatar = partner?.avatarUrl;
    final room = _room;
    final inCall = _attempt > 0 && !terminal && !ended;
    final reason = knownMessage(
      join['reason']?.toString(),
      'Chưa vào phòng được.',
    );

    Widget body() => ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
      children: [
        Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 860),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              spacing: 16,
              children: [
                if (query.isLoading && session.isEmpty)
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 24),
                    child: Center(
                      child: CircularProgressIndicator(strokeWidth: 2),
                    ),
                  ),
                if (query.hasError && session.isEmpty)
                  FormNotice(
                    tone: NoticeTone.error,
                    message: errorMessage(query.error),
                  ),
                if (session.isNotEmpty) ...[
                  Panel(
                    title: 'Buổi học trực tuyến',
                    children: [
                      Copy(partnerName),
                      const Copy(
                        'Bạn có thể vào phòng trong thời gian hệ thống cho phép và vào lại khi mất kết nối trong giờ học. Camera và micro chỉ bật theo lựa chọn của bạn. Chat trong phòng chỉ dùng cho phiên học, không lưu lịch sử. Rời phòng không xác nhận hoàn thành buổi học.',
                      ),
                    ],
                  ),
                  if (ended || (_notice != null && _notice!.isNotEmpty))
                    FormNotice(
                      tone: NoticeTone.info,
                      message: ended
                          ? knownMessage('SESSION_ENDED', 'Buổi học đã kết thúc.')
                          : _notice!,
                    ),
                  if (_error != null)
                    FormNotice(tone: NoticeTone.error, message: _error!),
                  if (_mediaNotice != null)
                    FormNotice(tone: NoticeTone.info, message: _mediaNotice!),
                  if (inCall)
                    _ConnectedRoom(
                      status: _status,
                      expanded: _expanded,
                      onToggleExpanded: () =>
                          setState(() => _expanded = !_expanded),
                      room: room,
                      partnerName: partnerName,
                      partnerAvatarUrl: partnerAvatar,
                      mediaBusy: _mediaBusy || _mediaPending,
                      onMic: () => _performMedia(() async {
                        final local = _room?.localParticipant;
                        if (local == null) return;
                        await local.setMicrophoneEnabled(
                          !local.isMicrophoneEnabled(),
                        );
                      }),
                      onCamera: () => _performMedia(() async {
                        final local = _room?.localParticipant;
                        if (local == null) return;
                        await local.setCameraEnabled(
                          !local.isCameraEnabled(),
                          cameraCaptureOptions: CameraCaptureOptions(
                            cameraPosition: _facing,
                          ),
                        );
                      }),
                      onFlip: () => _performMedia(() async {
                        final local = _room?.localParticipant;
                        final track = local
                            ?.getTrackPublicationBySource(TrackSource.camera)
                            ?.track;
                        if (track is! LocalVideoTrack) return;
                        final next = _facing.switched();
                        await track.setCameraPosition(next);
                        if (mounted) setState(() => _facing = next);
                      }),
                      onScreenShare:
                          !kIsWeb &&
                              defaultTargetPlatform == TargetPlatform.android
                          ? () => _performMedia(() async {
                              final local = _room?.localParticipant;
                              if (local == null) return;
                              await local.setScreenShareEnabled(
                                !local.isScreenShareEnabled(),
                              );
                            })
                          : null,
                      onLeave: () => setState(() => _leave = true),
                      chatOpen: _chatOpen,
                      chatCount: _chatMessages.length,
                      onToggleChat: () =>
                          setState(() => _chatOpen = !_chatOpen),
                      chat: _chatOpen
                          ? _RoomChatPanel(
                              messages: _chatMessages,
                              status: _chatStatus,
                              error: _chatError,
                              pending: _chatPending,
                              draft: _chatDraft,
                              scroll: _chatScroll,
                              partnerName: partnerName,
                              partnerAvatarUrl: partnerAvatar,
                              onSend: _sendChat,
                            )
                          : null,
                      onRetry: _status == _RoomStatus.disconnected
                          ? () => unawaited(_retry(session))
                          : null,
                      retrying: query.isLoading,
                    )
                  else
                    Panel(
                      title: 'Chuẩn bị vào học',
                      children: [
                        if (_startCamera && !terminal && !ended)
                          _PreviewTile(track: _preview),
                        _ToggleRow(
                          label: 'Bật camera khi vào phòng',
                          value: _startCamera,
                          onChanged: (value) =>
                              unawaited(_setStartCamera(value)),
                        ),
                        _ToggleRow(
                          label: 'Bật micro khi vào phòng',
                          value: _startMicrophone,
                          onChanged: (value) =>
                              setState(() => _startMicrophone = value),
                        ),
                        Copy(
                          canJoin && !ended && !terminal
                              ? 'Phòng học đã mở. Kiểm tra kết nối và cho phép camera, micro khi được hỏi.'
                              : reason,
                        ),
                        AppButton(
                          label: _entering
                              ? 'Đang vào phòng...'
                              : 'Vào phòng học',
                          loading: _entering,
                          disabled: _entering ||
                              !canJoin ||
                              ended ||
                              terminal ||
                              query.isLoading ||
                              query.hasError,
                          onPressed: () => unawaited(_enter(session)),
                        ),
                        AppButton(
                          label: 'Tải lại trạng thái',
                          variant: ButtonVariant.paper,
                          disabled: query.isLoading,
                          onPressed: () {
                            ref
                                .read(refreshTicksProvider.notifier)
                                .bump(const {RefreshScope.study});
                            unawaited(
                              ref.refresh(
                                liveSessionProvider(widget.id).future,
                              ),
                            );
                          },
                        ),
                      ],
                    ),
                  if (_leave)
                    Panel(
                      title: 'Rời buổi học?',
                      children: [
                        const Copy(
                          'Rời phòng không xác nhận buổi đã hoàn thành.',
                        ),
                        AppButton(
                          label: 'Xác nhận rời phòng',
                          onPressed: () {
                            unawaited(
                              _dropCall(
                                notice:
                                    'Bạn đã rời phòng học. Rời phòng không xác nhận hoàn thành buổi học.',
                              ),
                            );
                          },
                        ),
                        AppButton(
                          label: 'Ở lại',
                          variant: ButtonVariant.paper,
                          onPressed: () => setState(() => _leave = false),
                        ),
                      ],
                    ),
                ],
              ],
            ),
          ),
        ),
      ],
    );

    if (_expanded && inCall) {
      return Material(
        color: const Color(0xFF202124),
        child: SafeArea(
          child: Column(
            children: [
              Align(
                alignment: Alignment.centerRight,
                child: TextButton(
                  onPressed: () => setState(() => _expanded = false),
                  child: Text(
                    'Thu gọn phòng học',
                    style: nunito(TypeScale.secondary, color: Colors.white),
                  ),
                ),
              ),
              Expanded(child: body()),
            ],
          ),
        ),
      );
    }

    return AppScreenLayout(
      title: 'Phòng học',
      selected: 'Lịch học',
      back: (
        route: '/learning-sessions/${widget.id}',
        label: 'Chi tiết buổi học',
      ),
      child: body(),
    );
  }
}

class _ConnectedRoom extends StatelessWidget {
  const _ConnectedRoom({
    required this.status,
    required this.expanded,
    required this.onToggleExpanded,
    required this.room,
    required this.partnerName,
    required this.partnerAvatarUrl,
    required this.mediaBusy,
    required this.onMic,
    required this.onCamera,
    required this.onFlip,
    required this.onScreenShare,
    required this.onLeave,
    required this.chatOpen,
    required this.chatCount,
    required this.onToggleChat,
    required this.chat,
    required this.onRetry,
    required this.retrying,
  });

  final _RoomStatus status;
  final bool expanded;
  final VoidCallback onToggleExpanded;
  final Room? room;
  final String partnerName;
  final String? partnerAvatarUrl;
  final bool mediaBusy;
  final VoidCallback onMic;
  final VoidCallback onCamera;
  final VoidCallback onFlip;
  final VoidCallback? onScreenShare;
  final VoidCallback onLeave;
  final bool chatOpen;
  final int chatCount;
  final VoidCallback onToggleChat;
  final Widget? chat;
  final VoidCallback? onRetry;
  final bool retrying;

  @override
  Widget build(BuildContext context) {
    final activeRoom = room;
    final local = activeRoom?.localParticipant;
    final labels = {
      _RoomStatus.connecting: 'Đang kết nối phòng học…',
      _RoomStatus.connected: 'Đã vào phòng học',
      _RoomStatus.reconnecting: 'Mất kết nối. Đang kết nối lại…',
      _RoomStatus.disconnected: 'Đã ngắt kết nối',
    };
    final disabled =
        activeRoom == null || mediaBusy || status != _RoomStatus.connected;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: 12,
      children: [
        AppButton(
          label: expanded ? 'Thu gọn phòng học' : 'Mở rộng phòng học',
          variant: ButtonVariant.paper,
          onPressed: onToggleExpanded,
        ),
        Text(
          labels[status]!,
          style: nunito(TypeScale.secondary, color: AppColors.muted),
        ),
        if (status == _RoomStatus.connecting ||
            status == _RoomStatus.reconnecting)
          const Center(child: CircularProgressIndicator(strokeWidth: 2)),
        if (activeRoom != null) ...[
          _RoomStage(
            room: activeRoom,
            partnerName: partnerName,
            partnerAvatarUrl: partnerAvatarUrl,
            expanded: expanded,
          ),
          Wrap(
            spacing: 12,
            runSpacing: 12,
            children: [
              AppButton(
                label: local?.isMicrophoneEnabled() == true
                    ? 'Tắt micro'
                    : 'Bật micro',
                variant: ButtonVariant.paper,
                disabled: disabled,
                onPressed: onMic,
              ),
              AppButton(
                label: local?.isCameraEnabled() == true
                    ? 'Tắt camera'
                    : 'Bật camera',
                variant: ButtonVariant.paper,
                disabled: disabled,
                onPressed: onCamera,
              ),
            ],
          ),
          if (onScreenShare != null)
            AppButton(
              label: local?.isScreenShareEnabled() == true
                  ? 'Dừng chia sẻ màn hình'
                  : 'Chia sẻ màn hình',
              variant: ButtonVariant.paper,
              disabled: disabled,
              onPressed: onScreenShare,
            ),
          AppButton(
            label: 'Đổi camera trước / sau',
            variant: ButtonVariant.paper,
            disabled: disabled || local?.isCameraEnabled() != true,
            onPressed: onFlip,
          ),
          AppButton(label: 'Rời phòng học', onPressed: onLeave),
          AppButton(
            label:
                '${chatOpen ? 'Đóng chat' : 'Chat phiên học'} ($chatCount)',
            variant: ButtonVariant.paper,
            onPressed: onToggleChat,
          ),
          ?chat,
        ],
        if (onRetry != null)
          AppButton(
            label: retrying ? 'Đang kiểm tra phòng…' : 'Kết nối lại',
            disabled: retrying,
            onPressed: onRetry,
          ),
        if (activeRoom == null && onRetry == null)
          AppButton(label: 'Rời phòng học', onPressed: onLeave),
      ],
    );
  }
}

class _Slot {
  const _Slot({
    required this.key,
    required this.participant,
    required this.source,
    required this.track,
    required this.muted,
  });

  final String key;
  final Participant participant;
  final TrackSource source;
  final VideoTrack? track;
  final bool muted;
}

class _RoomStage extends StatefulWidget {
  const _RoomStage({
    required this.room,
    required this.partnerName,
    required this.partnerAvatarUrl,
    required this.expanded,
  });

  final Room room;
  final String partnerName;
  final String? partnerAvatarUrl;
  final bool expanded;

  @override
  State<_RoomStage> createState() => _RoomStageState();
}

class _RoomStageState extends State<_RoomStage> {
  String? _pinned;
  var _hidden = false;

  List<_Slot> _slots() {
    final participants = <Participant>[
      if (widget.room.localParticipant != null) widget.room.localParticipant!,
      ...widget.room.remoteParticipants.values,
    ];
    final slots = <_Slot>[];
    for (final participant in participants) {
      for (final publication in participant.videoTrackPublications) {
        final source = publication.source;
        if (source != TrackSource.camera &&
            source != TrackSource.screenShareVideo) {
          continue;
        }
        final track = publication.track;
        slots.add(
          _Slot(
            key: '${participant.identity}:${source.name}',
            participant: participant,
            source: source,
            track: track is VideoTrack ? track : null,
            muted: publication.muted,
          ),
        );
      }
      final hasCamera = participant.videoTrackPublications.any(
        (p) => p.source == TrackSource.camera,
      );
      if (!hasCamera) {
        slots.add(
          _Slot(
            key: '${participant.identity}:camera',
            participant: participant,
            source: TrackSource.camera,
            track: null,
            muted: true,
          ),
        );
      }
    }
    if (slots.isEmpty && widget.room.localParticipant != null) {
      slots.add(
        _Slot(
          key: '${widget.room.localParticipant!.identity}:camera',
          participant: widget.room.localParticipant!,
          source: TrackSource.camera,
          track: null,
          muted: true,
        ),
      );
    }
    return slots;
  }

  @override
  Widget build(BuildContext context) {
    final slots = _slots();
    final remotePresent = widget.room.remoteParticipants.isNotEmpty;
    _Slot? main;
    if (_pinned != null) {
      for (final slot in slots) {
        if (slot.key == _pinned) {
          main = slot;
          break;
        }
      }
    }
    _Slot? pick(_Slot? Function(_Slot slot) test) {
      for (final slot in slots) {
        final hit = test(slot);
        if (hit != null) return hit;
      }
      return null;
    }

    main ??= pick(
      (slot) =>
          slot.source == TrackSource.screenShareVideo &&
              slot.participant is! LocalParticipant
          ? slot
          : null,
    );
    main ??= pick(
      (slot) =>
          slot.source == TrackSource.screenShareVideo ? slot : null,
    );
    main ??= pick(
      (slot) => slot.participant is! LocalParticipant ? slot : null,
    );
    main ??= slots.isEmpty ? null : slots.first;

    final size = MediaQuery.sizeOf(context);
    final stageHeight = widget.expanded
        ? (size.height * 0.5).clamp(180.0, size.width * 0.65)
        : (size.width * 0.7).clamp(180.0, 320.0);

    final stageLabel = main?.source == TrackSource.screenShareVideo
        ? 'Đang chia sẻ màn hình'
        : remotePresent
        ? 'Học cùng nhau'
        : 'Đang chờ ${widget.partnerName} vào phòng';

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: 10,
      children: [
        Text(
          stageLabel,
          style: nunito(TypeScale.secondary, color: AppColors.muted),
        ),
        if (main != null)
          _RoomTile(
            slot: main,
            primary: true,
            height: stageHeight,
            partnerName: widget.partnerName,
            partnerAvatarUrl: widget.partnerAvatarUrl,
          ),
        if (slots.length > 1) ...[
          Wrap(
            spacing: 12,
            runSpacing: 8,
            children: [
              TextButton(
                onPressed: () => setState(() => _hidden = !_hidden),
                child: Text(
                  _hidden ? 'Hiện màn hình thu nhỏ' : 'Ẩn màn hình thu nhỏ',
                ),
              ),
              if (_pinned != null)
                TextButton(
                  onPressed: () => setState(() => _pinned = null),
                  child: const Text('Bỏ ghim · Tự ưu tiên màn hình chia sẻ'),
                ),
            ],
          ),
          if (!_hidden)
            SizedBox(
              height: 140,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: slots.length,
                separatorBuilder: (_, _) => const SizedBox(width: 10),
                itemBuilder: (context, index) {
                  final slot = slots[index];
                  return GestureDetector(
                    onTap: () => setState(() => _pinned = slot.key),
                    child: SizedBox(
                      width: 120,
                      child: _RoomTile(
                        slot: slot,
                        primary: false,
                        height: 92,
                        partnerName: widget.partnerName,
                        partnerAvatarUrl: widget.partnerAvatarUrl,
                      ),
                    ),
                  );
                },
              ),
            ),
        ],
      ],
    );
  }
}

class _RoomTile extends StatelessWidget {
  const _RoomTile({
    required this.slot,
    required this.primary,
    required this.height,
    required this.partnerName,
    required this.partnerAvatarUrl,
  });

  final _Slot slot;
  final bool primary;
  final double height;
  final String partnerName;
  final String? partnerAvatarUrl;

  @override
  Widget build(BuildContext context) {
    final local = slot.participant is LocalParticipant;
    final name = local ? 'Bạn' : partnerName;
    final avatar = local ? null : partnerAvatarUrl;
    final screen = slot.source == TrackSource.screenShareVideo;
    final micOff = !slot.participant.isMicrophoneEnabled();
    final video = !slot.muted ? slot.track : null;
    return ClipRRect(
      borderRadius: BorderRadius.circular(primary ? 16 : 12),
      child: ColoredBox(
        color: const Color(0xFF292524),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            SizedBox(
              height: height,
              child: video != null
                  ? VideoTrackRenderer(
                      video,
                      fit: screen ? VideoViewFit.contain : VideoViewFit.cover,
                    )
                  : ColoredBox(
                      color: const Color(0xFF3c4043),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        spacing: 8,
                        children: [
                          Avatar(
                            name: name,
                            imageUrl: avatar,
                            size: primary ? 72 : 36,
                          ),
                          Text(
                            'Camera đang tắt',
                            style: nunito(
                              TypeScale.secondary,
                              color: Colors.white70,
                            ),
                          ),
                        ],
                      ),
                    ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(10, 8, 10, 10),
              child: Row(
                spacing: 8,
                children: [
                  Avatar(name: name, imageUrl: avatar, size: 24),
                  Expanded(
                    child: Text(
                      [
                        name,
                        if (screen) 'Màn hình',
                        if (micOff) 'Tắt micro',
                      ].join(' · '),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: nunito(
                        TypeScale.secondary,
                        color: Colors.white70,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _PreviewTile extends StatelessWidget {
  const _PreviewTile({required this.track});

  final LocalVideoTrack? track;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(16),
      child: ColoredBox(
        color: const Color(0xFF292524),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            SizedBox(
              height: 220,
              child: track != null
                  ? VideoTrackRenderer(track!, fit: VideoViewFit.cover)
                  : Center(
                      child: Text(
                        'Đang chuẩn bị camera…',
                        style: nunito(
                          TypeScale.secondary,
                          color: Colors.white70,
                        ),
                      ),
                    ),
            ),
            Padding(
              padding: const EdgeInsets.all(12),
              child: Text(
                'Xem trước · Chưa phát hình vào phòng',
                style: nunito(TypeScale.secondary, color: Colors.white70),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ToggleRow extends StatelessWidget {
  const _ToggleRow({
    required this.label,
    required this.value,
    required this.onChanged,
  });

  final String label;
  final bool value;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(child: Copy(label)),
        Switch.adaptive(value: value, onChanged: onChanged),
      ],
    );
  }
}

class _RoomChatPanel extends StatelessWidget {
  const _RoomChatPanel({
    required this.messages,
    required this.status,
    required this.error,
    required this.pending,
    required this.draft,
    required this.scroll,
    required this.partnerName,
    required this.partnerAvatarUrl,
    required this.onSend,
  });

  final List<RoomChatMessage> messages;
  final RoomChatStatus status;
  final String? error;
  final bool pending;
  final TextEditingController draft;
  final ScrollController scroll;
  final String partnerName;
  final String? partnerAvatarUrl;
  final VoidCallback onSend;

  @override
  Widget build(BuildContext context) {
    final ready = status == RoomChatStatus.ready;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF292a2d),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        spacing: 12,
        children: [
          Text(
            'Chat trong phiên học',
            style: nunito(
              TypeScale.heading,
              weight: FontWeight.w700,
              color: Colors.white,
            ),
          ),
          Text(
            'Tin nhắn mất khi rời phòng. Người vào sau không xem được tin trước đó.',
            style: nunito(TypeScale.secondary, color: const Color(0xFFbdc1c6)),
          ),
          SizedBox(
            height: 220,
            child: ListView.builder(
              controller: scroll,
              itemCount: messages.isEmpty ? 1 : messages.length,
              itemBuilder: (context, index) {
                if (messages.isEmpty) {
                  return Text(
                    'Gửi lời chào hoặc câu hỏi cho đối tác.',
                    style: nunito(
                      TypeScale.body,
                      color: Colors.white,
                    ),
                  );
                }
                final message = messages[index];
                final name = message.own ? 'Bạn' : partnerName;
                return Align(
                  alignment: message.own
                      ? Alignment.centerRight
                      : Alignment.centerLeft,
                  child: Container(
                    margin: const EdgeInsets.only(bottom: 10),
                    padding: const EdgeInsets.all(10),
                    constraints: const BoxConstraints(maxWidth: 420),
                    decoration: BoxDecoration(
                      color: message.own
                          ? const Color(0xFF27445f)
                          : const Color(0xFF3c4043),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      spacing: 6,
                      children: [
                        Row(
                          mainAxisSize: MainAxisSize.min,
                          spacing: 8,
                          children: [
                            Avatar(
                              name: name,
                              imageUrl: message.own ? null : partnerAvatarUrl,
                              size: 24,
                            ),
                            Text(
                              name,
                              style: nunito(
                                TypeScale.secondary,
                                color: const Color(0xFFbdc1c6),
                              ),
                            ),
                          ],
                        ),
                        SelectableText(
                          message.text,
                          style: nunito(
                            TypeScale.body,
                            color: Colors.white,
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
          if (!ready)
            Text(
              roomChatStatusMessage(status),
              style: nunito(
                TypeScale.secondary,
                color: const Color(0xFFbdc1c6),
              ),
            ),
          if (error != null)
            Text(
              error!,
              style: nunito(TypeScale.body, color: Colors.white),
            ),
          TextField(
            controller: draft,
            enabled: ready && !pending,
            maxLength: roomChatTextLimit,
            maxLines: 4,
            minLines: 2,
            style: const TextStyle(color: Colors.white),
            decoration: InputDecoration(
              hintText: 'Nhập tin nhắn…',
              hintStyle: const TextStyle(color: Color(0xFFbdc1c6)),
              filled: true,
              fillColor: const Color(0xFF202124),
              counterStyle: const TextStyle(color: Color(0xFFbdc1c6)),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(10),
                borderSide: const BorderSide(color: Color(0xFF5f6368)),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(10),
                borderSide: const BorderSide(color: Color(0xFF5f6368)),
              ),
            ),
          ),
          AppButton(
            label: pending ? 'Đang gửi…' : 'Gửi tin nhắn',
            disabled: !ready || pending,
            onPressed: onSend,
          ),
        ],
      ),
    );
  }
}
