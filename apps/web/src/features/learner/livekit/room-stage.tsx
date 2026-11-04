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
  return (
    <div className={styles.stage}>
      <div className={styles.stageBar}>
        <div>
          <RoomIcon
            name={primary.source === "screen_share" ? "screen" : "camera"}
          />
          <span>
            {primary.source === "screen_share"
              ? `${primary.name} đang chia sẻ màn hình`
              : participants
                ? "Học cùng nhau"
                : `Đang chờ ${peerName} vào phòng`}
          </span>
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
        {tiles.map((tile) => {
          const main = tile.id === primary.id;
          const screen = tile.source === "screen_share";
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
                    screen
                      ? `Màn hình chia sẻ của ${tile.name}`
                      : `Video ${tile.name}`
                  }
                  className={styles.media}
                />
              ) : (
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
                  <span>
                    {screen ? "Đang tải màn hình chia sẻ…" : tile.name}
                  </span>
                  {main && (
                    <small>
                      {screen
                        ? "Nội dung sẽ xuất hiện khi kết nối sẵn sàng"
                        : "Camera đang tắt"}
                    </small>
                  )}
                </div>
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
                  <RoomIcon
                    name={tile.microphone ? "microphone" : "microphoneOff"}
                  />
                )}
              </div>
              <button
                type="button"
                className={styles.pin}
                aria-label={
                  main && pinnedTile
                    ? `Bỏ ghim ${tile.name}${screen ? " chia sẻ màn hình" : ""}`
                    : `Chọn ${tile.name}${screen ? " chia sẻ màn hình" : " camera"} làm màn hình chính`
                }
                title={
                  main && pinnedTile ? "Bỏ ghim" : "Đặt làm màn hình chính"
                }
                aria-pressed={main && pinnedTile}
                onClick={() => setPinned(main && pinnedTile ? null : tile.id)}
              >
                <RoomIcon name="pin" />
              </button>
            </article>
          );
        })}
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
