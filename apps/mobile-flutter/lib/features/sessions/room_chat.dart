import 'dart:convert';

import 'package:livekit_client/livekit_client.dart';

import '../remote/remote_load.dart';

const roomChatTopic = 'skillhub.session-chat.v1';
const roomChatTextLimit = 1000;

class RoomChatMessage {
  const RoomChatMessage({
    required this.id,
    required this.text,
    required this.own,
  });

  final String id;
  final String text;
  final bool own;
}

enum RoomChatStatus { disconnected, waiting, notPermitted, ready }

String roomChatStatusMessage(RoomChatStatus status) => switch (status) {
  RoomChatStatus.notPermitted =>
    'Máy chủ chưa cấp quyền gửi tin nhắn trong phòng này. Vào lại phòng sau khi quyền được cập nhật.',
  RoomChatStatus.waiting =>
    'Chờ người cùng học kết nối vào phòng để gửi tin.',
  RoomChatStatus.disconnected => 'Chat tạm ngắt khi phòng mất kết nối.',
  RoomChatStatus.ready => 'Đã kết nối chat trực tiếp',
};

RoomChatStatus roomChatStatusOf(
  Room? room,
  String peerIdentity, {
  bool current = true,
}) {
  if (!current || room?.connectionState != ConnectionState.connected) {
    return RoomChatStatus.disconnected;
  }
  if (room!.localParticipant?.permissions.canPublishData != true) {
    return RoomChatStatus.notPermitted;
  }
  if (peerIdentity.isEmpty || !room.remoteParticipants.containsKey(peerIdentity)) {
    return RoomChatStatus.waiting;
  }
  return RoomChatStatus.ready;
}

final _idPattern = RegExp(r'^[a-z0-9-]{8,80}$', caseSensitive: false);

bool _validId(String? id) => id != null && _idPattern.hasMatch(id);

/// RAM-only room chat for one LiveKit attempt. No history API or device storage.
class EphemeralRoomChat {
  EphemeralRoomChat({
    required this.peerIdentity,
    required this.active,
    required this.publish,
    required this.createId,
    required this.changed,
  });

  final String peerIdentity;
  final bool Function() active;
  final Future<void> Function(List<int> data) publish;
  final String Function() createId;
  final void Function(List<RoomChatMessage> items) changed;

  var _closed = false;
  var _sending = false;
  final _seen = <String>{};
  var _messages = <RoomChatMessage>[];

  void receive(List<int> data, String? sender, String? topic) {
    if (_closed ||
        !active() ||
        sender != peerIdentity ||
        topic != roomChatTopic ||
        data.length > 8192) {
      return;
    }
    try {
      final packet = jsonDecode(utf8.decode(data));
      if (packet is! Map) return;
      final id = packet['id']?.toString();
      final text = packet['text'];
      if (packet['v'] != 1 ||
          !_validId(id) ||
          text is! String ||
          text.trim().isEmpty ||
          text.length > roomChatTextLimit) {
        return;
      }
      _append(id: id!, text: text, own: false);
    } catch (_) {}
  }

  Future<bool> send(String value) async {
    final text = value.trim();
    if (_closed ||
        _sending ||
        !active() ||
        text.isEmpty ||
        text.length > roomChatTextLimit) {
      return false;
    }
    final id = createId();
    if (!_validId(id)) return false;
    _sending = true;
    try {
      await publish(utf8.encode(jsonEncode({'v': 1, 'id': id, 'text': text})));
      if (_closed || !active()) return false;
      _append(id: id, text: text, own: true);
      return true;
    } finally {
      _sending = false;
    }
  }

  void close() {
    _closed = true;
    _messages = [];
    _seen.clear();
    changed(const []);
  }

  void _append({required String id, required String text, required bool own}) {
    if (_closed || _seen.contains(id)) return;
    _seen.add(id);
    if (_seen.length > 500) _seen.remove(_seen.first);
    _messages = [
      ..._messages,
      RoomChatMessage(id: id, text: text, own: own),
    ];
    if (_messages.length > 100) {
      _messages = _messages.sublist(_messages.length - 100);
    }
    changed(_messages);
  }
}

class RoomChatTransport {
  RoomChatTransport({
    required Room room,
    required String peerIdentity,
    required bool Function() isCurrent,
    required void Function(List<RoomChatMessage> messages) changed,
    required void Function(RoomChatStatus status) statusChanged,
  }) : _room = room,
       _peerIdentity = peerIdentity,
       _isCurrent = isCurrent,
       _statusChanged = statusChanged {
    _chat = EphemeralRoomChat(
      peerIdentity: peerIdentity,
      active: _active,
      createId: newUuid,
      changed: changed,
      publish: (payload) async {
        final availability = status();
        if (availability != RoomChatStatus.ready) {
          throw StateError(roomChatStatusMessage(availability));
        }
        final local = room.localParticipant;
        if (local == null) {
          throw StateError(roomChatStatusMessage(RoomChatStatus.disconnected));
        }
        await local.publishData(
          payload,
          reliable: true,
          topic: roomChatTopic,
          destinationIdentities: [peerIdentity],
        );
      },
    );
    _listener = room.createListener()
      ..on<DataReceivedEvent>((event) {
        _chat.receive(
          event.data,
          event.participant?.identity,
          event.topic,
        );
      })
      ..on<ParticipantConnectedEvent>((_) => _emitStatus())
      ..on<ParticipantDisconnectedEvent>((_) => _emitStatus())
      ..on<ParticipantPermissionsUpdatedEvent>((_) => _emitStatus())
      ..on<RoomReconnectedEvent>((_) => _emitStatus())
      ..on<RoomDisconnectedEvent>((_) {
        close();
        _statusChanged(RoomChatStatus.disconnected);
      });
    _emitStatus();
  }

  final Room _room;
  final String _peerIdentity;
  final bool Function() _isCurrent;
  final void Function(RoomChatStatus) _statusChanged;
  late final EphemeralRoomChat _chat;
  late final EventsListener<RoomEvent> _listener;
  var _closed = false;

  bool _active() =>
      !_closed &&
      _isCurrent() &&
      _room.connectionState == ConnectionState.connected &&
      _peerIdentity.isNotEmpty;

  RoomChatStatus status() =>
      roomChatStatusOf(_room, _peerIdentity, current: !_closed && _isCurrent());

  void _emitStatus() {
    if (!_closed) _statusChanged(status());
  }

  Future<bool> send(String value) => _chat.send(value);

  void close() {
    if (_closed) return;
    _closed = true;
    _listener.dispose();
    _chat.close();
  }
}
