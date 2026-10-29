import 'dart:async';

import 'package:flutter/material.dart' hide ConnectionState;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:livekit_client/livekit_client.dart';

import '../../components/app_button.dart';
import '../../components/feature_page.dart';
import '../../components/misc.dart';
import '../../core/http/app_error.dart';
import '../../core/theme/tokens.dart';
import '../auth/session/auth_session.dart';
import '../shell/app_screen_layout.dart';
import 'live_sessions.dart';

class LiveRoomPage extends ConsumerStatefulWidget {
  const LiveRoomPage({super.key, required this.id});

  final String id;

  @override
  ConsumerState<LiveRoomPage> createState() => _LiveRoomPageState();
}

class _LiveRoomPageState extends ConsumerState<LiveRoomPage> {
  Room? _room;
  String? _error;
  var _entering = false;
  var _mediaBusy = false;
  var _leave = false;

  @override
  void dispose() {
    final room = _room;
    _room = null;
    if (room != null) unawaited(_shutdown(room));
    super.dispose();
  }

  void _onRoom() {
    if (mounted) setState(() {});
  }

  Future<void> _shutdown(Room room) async {
    room.removeListener(_onRoom);
    try {
      await room.disconnect();
    } catch (_) {}
    try {
      await room.dispose();
    } catch (_) {}
  }

  Future<void> _enter() async {
    if (_entering || _room != null) return;
    setState(() {
      _entering = true;
      _error = null;
      _leave = false;
    });
    final room = Room(
      roomOptions: const RoomOptions(adaptiveStream: true, dynacast: true),
    );
    room.addListener(_onRoom);
    _room = room;
    try {
      final token = await ref
          .read(authRuntimeProvider)
          .services
          .study
          .liveKitToken(widget.id);
      final url = token['serverUrl']?.toString() ?? '';
      final jwt = token['participantToken']?.toString() ?? '';
      if (url.isEmpty || jwt.isEmpty) {
        throw StateError('missing-livekit-token');
      }
      await room.connect(url, jwt);
      if (!mounted) return;
      setState(() => _entering = false);
    } catch (error) {
      if (identical(_room, room)) _room = null;
      await _shutdown(room);
      if (!mounted) return;
      setState(() {
        _entering = false;
        _error = error is AppError
            ? errorMessage(error)
            : 'Không vào được phòng. Kiểm tra quyền camera, mic và giờ mở phòng.';
      });
    }
  }

  Future<void> _toggleCamera() async {
    final participant = _room?.localParticipant;
    if (participant == null || _mediaBusy) return;
    setState(() => _mediaBusy = true);
    try {
      await participant.setCameraEnabled(!participant.isCameraEnabled());
    } catch (_) {
      if (mounted) {
        setState(() => _error = 'Không dùng được camera trên thiết bị này.');
      }
    } finally {
      if (mounted) setState(() => _mediaBusy = false);
    }
  }

  Future<void> _toggleMic() async {
    final participant = _room?.localParticipant;
    if (participant == null || _mediaBusy) return;
    setState(() => _mediaBusy = true);
    try {
      await participant.setMicrophoneEnabled(!participant.isMicrophoneEnabled());
    } catch (_) {
      if (mounted) {
        setState(() => _error = 'Không dùng được mic trên thiết bị này.');
      }
    } finally {
      if (mounted) setState(() => _mediaBusy = false);
    }
  }

  Future<void> _confirmLeave() async {
    final room = _room;
    _room = null;
    if (room != null) await _shutdown(room);
    if (!mounted) return;
    context.go('/learning-sessions/${widget.id}');
  }

  @override
  Widget build(BuildContext context) {
    final query = ref.watch(liveSessionProvider(widget.id));
    final session = query.value ?? const <String, dynamic>{};
    final join = session['join'] is Map
        ? Map<String, dynamic>.from(session['join'] as Map)
        : const <String, dynamic>{};
    final canJoin = join['canJoin'] == true;
    final room = _room;
    final connected = room?.connectionState == ConnectionState.connected;
    final local = room?.localParticipant;
    final remote = room?.remoteParticipants.values.firstOrNull;
    final reason = knownMessage(
      join['reason']?.toString(),
      'Chưa vào phòng được.',
    );
    return AppScreenLayout(
      title: 'Phòng học',
      selected: 'Lịch học',
      back: (
        route: '/learning-sessions/${widget.id}',
        label: 'Chi tiết buổi học',
      ),
      child: ListView(
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
                    Text(
                      sessionRoleLabel(session),
                      style: nunito(TypeScale.heading, weight: FontWeight.w700),
                    ),
                    Text(
                      connected
                          ? 'Đã vào phòng. Rời phòng không xác nhận buổi đã hoàn thành.'
                          : room == null
                          ? 'Bật camera và mic sau khi vào phòng.'
                          : 'Đang vào phòng.',
                      style: nunito(TypeScale.secondary, color: AppColors.muted),
                    ),
                    _Stage(
                      remote: _videoOf(remote),
                      local: _videoOf(local),
                      remoteLabel: remote == null
                          ? 'Đối tác chưa vào phòng'
                          : 'Đối tác đã tắt camera',
                    ),
                    if (_error != null)
                      FormNotice(tone: NoticeTone.error, message: _error!),
                    if (!canJoin && room == null)
                      FormNotice(tone: NoticeTone.info, message: reason),
                    if (room == null && canJoin)
                      AppButton(
                        label: _entering ? 'Đang vào phòng...' : 'Vào phòng',
                        loading: _entering,
                        disabled: _entering,
                        onPressed: _enter,
                      ),
                    if (room != null) ...[
                      Wrap(
                        spacing: 12,
                        runSpacing: 12,
                        children: [
                          AppButton(
                            label: local?.isCameraEnabled() == true
                                ? 'Tắt camera'
                                : 'Bật camera',
                            variant: ButtonVariant.paper,
                            disabled: _mediaBusy || !connected,
                            onPressed: _toggleCamera,
                          ),
                          AppButton(
                            label: local?.isMicrophoneEnabled() == true
                                ? 'Tắt mic'
                                : 'Bật mic',
                            variant: ButtonVariant.paper,
                            disabled: _mediaBusy || !connected,
                            onPressed: _toggleMic,
                          ),
                        ],
                      ),
                      AppButton(
                        label: 'Rời phòng',
                        variant: ButtonVariant.paper,
                        onPressed: () => setState(() => _leave = true),
                      ),
                    ],
                    if (_leave)
                      Panel(
                        title: 'Rời buổi học?',
                        children: [
                          const Copy(
                            'Rời phòng không xác nhận buổi đã hoàn thành.',
                          ),
                          AppButton(
                            label: 'Xác nhận rời phòng',
                            onPressed: _confirmLeave,
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
      ),
    );
  }
}

VideoTrack? _videoOf(Participant? participant) {
  if (participant == null) return null;
  for (final publication in participant.videoTrackPublications) {
    final track = publication.track;
    if (track is VideoTrack && !publication.muted) return track;
  }
  return null;
}

class _Stage extends StatelessWidget {
  const _Stage({
    required this.remote,
    required this.local,
    required this.remoteLabel,
  });

  final VideoTrack? remote;
  final VideoTrack? local;
  final String remoteLabel;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 420,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(16),
        child: ColoredBox(
          color: const Color(0xFF1C1917),
          child: Stack(
            fit: StackFit.expand,
            children: [
              _Tile(track: remote, label: remoteLabel),
              Positioned(
                right: 12,
                bottom: 12,
                width: 128,
                height: 172,
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(12),
                  child: _Tile(track: local, label: 'Bạn'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Tile extends StatelessWidget {
  const _Tile({required this.track, required this.label});

  final VideoTrack? track;
  final String label;

  @override
  Widget build(BuildContext context) {
    final video = track;
    if (video != null) {
      return VideoTrackRenderer(video, fit: VideoViewFit.cover);
    }
    return ColoredBox(
      color: const Color(0xFF292524),
      child: Center(
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Text(
            label,
            textAlign: TextAlign.center,
            style: nunito(TypeScale.secondary, color: Colors.white),
          ),
        ),
      ),
    );
  }
}
