"use client";
import { useId, useState } from "react";
import { primaryRoomTile, type RoomTile } from "./room-media";
import { RoomAvatar } from "./room-avatar";
import { RoomIcon } from "./room-icon";
import { RoomTrack } from "./room-track";
import styles from "./room.module.css";

export function RoomStage({
  tiles,
  participants,
  peerName,
}: Readonly<{ tiles: RoomTile[]; participants: number; peerName: string }>) {
  const [collapsed, setCollapsed] = useState(false);
  const [pinned, setPinned] = useState<string | null>(null);
  const stripId = useId();
  const primary = primaryRoomTile(tiles, pinned);
  if (!primary) return null;
  const hasSecondary = tiles.length > 1;
  const pinnedTile = tiles.some((tile) => tile.id === pinned);
  let stageLabel: "screen" | "camera";
  if (primary.source === "screen_share") stageLabel = "screen";
  else stageLabel = "camera";
  let participantStatus: string;
  if (primary.source === "screen_share") {
    participantStatus = `${primary.name} đang chia sẻ màn hình`;
  } else {
    if (participants) {
      participantStatus = "Học cùng nhau";
    } else {
      participantStatus = `Đang chờ ${peerName} vào phòng`;
    }
  }
  return (
    <div className={styles.stage}>
      <div className={styles.stageBar}>
        <div>
          <RoomIcon name={stageLabel} />
          <span>{participantStatus}</span>
        </div>
        {pinnedTile && (
          <button
            type="button"
            className={styles.iconButton}
            title="Bỏ ghim, tự ưu tiên màn hình chia sẻ"
            aria-label="Bỏ ghim, tự ưu tiên màn hình chia sẻ"
            onClick={() => setPinned(null)}
          >
            <RoomIcon name="automatic" />
          </button>
        )}
      </div>
      <div
        id={stripId}
        className={styles.tiles}
        data-hide-secondary={collapsed || !hasSecondary}
      >
        {tiles.map((tile) => (
          <RoomStageTile
            key={tile.id}
            tile={tile}
            primaryId={primary.id}
            pinnedTile={pinnedTile}
            collapsed={collapsed}
            setPinned={setPinned}
          />
        ))}
      </div>
      {hasSecondary && (
        <button
          type="button"
          className={styles.participantsToggle}
          aria-controls={stripId}
          aria-expanded={!collapsed}
          title={
            collapsed ? "Mở dải người tham gia" : "Thu gọn dải người tham gia"
          }
          onClick={() => setCollapsed((value) => !value)}
        >
          <RoomIcon name={collapsed ? "chevronUp" : "chevronDown"} />
          <span>
            {collapsed
              ? `Hiện ${tiles.length - 1} màn hình thu nhỏ`
              : "Thu gọn người tham gia"}
          </span>
        </button>
      )}
    </div>
  );
}

function RoomStageTile({
  tile,
  primaryId,
  pinnedTile,
  collapsed,
  setPinned,
}: Readonly<{
  tile: RoomTile;
  primaryId: string;
  pinnedTile: boolean;
  collapsed: boolean;
  setPinned: (id: string | null) => void;
}>) {
  const main = tile.id === primaryId;
  const screen = tile.source === "screen_share";
  const screenSuffix = screen ? " chia sẻ màn hình" : "";
  const selectedSuffix = screen ? " chia sẻ màn hình" : " camera";
  return (
    <article
      key={tile.id}
      className={styles.tile}
      data-primary={main}
      data-screen={screen}
      data-speaking={tile.speaking}
      data-local={tile.local}
      hidden={!main && collapsed}
    >
      {tile.track ? (
        <RoomTrack
          track={tile.track}
          local={tile.local}
          label={
            screen ? `Màn hình chia sẻ của ${tile.name}` : `Video ${tile.name}`
          }
          className={styles.media}
        />
      ) : (
        <RoomTilePlaceholder tile={tile} main={main} screen={screen} />
      )}
      <div className={styles.tileLabel}>
        <span>
          <RoomAvatar
            name={tile.name}
            avatarUrl={tile.avatarUrl}
            className={styles.labelAvatar}
          />
          {screen && <RoomIcon name="screen" />}
          {tile.name}
          {screen ? " · Màn hình" : ""}
        </span>
        {!screen && (
          <RoomIcon name={tile.microphone ? "microphone" : "microphoneOff"} />
        )}
      </div>
      <button
        type="button"
        className={styles.pin}
        aria-label={
          main && pinnedTile
            ? `Bỏ ghim ${tile.name}${screenSuffix}`
            : `Chọn ${tile.name}${selectedSuffix} làm màn hình chính`
        }
        title={main && pinnedTile ? "Bỏ ghim" : "Đặt làm màn hình chính"}
        aria-pressed={main && pinnedTile}
        onClick={() => setPinned(main && pinnedTile ? null : tile.id)}
      >
        <RoomIcon name="pin" />
      </button>
    </article>
  );
}

function RoomTilePlaceholder({
  tile,
  main,
  screen,
}: Readonly<{ tile: RoomTile; main: boolean; screen: boolean }>) {
  return (
    <div className={styles.placeholder}>
      {screen ? (
        <span className={styles.avatar}>
          <RoomIcon name="screen" />
        </span>
      ) : (
        <RoomAvatar
          name={tile.name}
          avatarUrl={tile.avatarUrl}
          className={styles.avatar}
        />
      )}
      <span>{screen ? "Đang tải màn hình chia sẻ…" : tile.name}</span>
      {main && (
        <small>
          {screen
            ? "Nội dung sẽ xuất hiện khi kết nối sẵn sàng"
            : "Camera đang tắt"}
        </small>
      )}
    </div>
  );
}
