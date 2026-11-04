import type { Room, Track, Participant } from "livekit-client";

export type RoomTile = {
  id: string;
  name: string;
  identity?: string;
  avatarUrl?: string | null;
  local: boolean;
  source: "camera" | "screen_share";
  microphone: boolean;
  speaking: boolean;
  track?: Track;
};

function participantMedia(
  participant: Participant,
  local: boolean,
  localName: string,
) {
  const tiles: RoomTile[] = [];
  const audio: { id: string; track: Track }[] = [];
  const name = local
    ? `${localName} (Bạn)`
    : participant.name || "Người tham gia";
  const camera = participant.getTrackPublication("camera" as Track.Source);
  tiles.push({
    id: `${participant.identity}:camera`,
    identity: participant.identity,
    name,
    local,
    source: "camera",
    microphone: participant.isMicrophoneEnabled,
    speaking: participant.isSpeaking,
    track: camera?.isMuted ? undefined : camera?.track,
  });
  for (const publication of participant.trackPublications.values()) {
    if (publication.source === "screen_share") {
      tiles.push({
        id: `${participant.identity}:screen`,
        identity: participant.identity,
        name,
        local,
        source: "screen_share",
        microphone: participant.isMicrophoneEnabled,
        speaking: false,
        track: publication.isMuted ? undefined : publication.track,
      });
    }
    if (!local && publication.kind === "audio" && publication.track) {
      audio.push({ id: publication.trackSid, track: publication.track });
    }
  }
  return { tiles, audio };
}
export function roomMedia(room: Room, localName: string) {
  const media = [
    room.localParticipant,
    ...room.remoteParticipants.values(),
  ].map((participant) =>
    participantMedia(
      participant,
      participant === room.localParticipant,
      localName,
    ),
  );
  return {
    tiles: media.flatMap((value) => value.tiles),
    audio: media.flatMap((value) => value.audio),
  };
}

export function primaryRoomTile(tiles: RoomTile[], pinnedId: string | null) {
  return (
    tiles.find((tile) => tile.id === pinnedId) ??
    tiles.find((tile) => tile.source === "screen_share" && !tile.local) ??
    tiles.find((tile) => tile.source === "screen_share") ??
    tiles.find((tile) => !tile.local) ??
    tiles[0]
  );
}
