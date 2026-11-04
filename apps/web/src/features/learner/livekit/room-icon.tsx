import type { ReactNode } from "react";

const paths = {
  settings: (
    <>
      <path d="M4 6h16M4 12h16M4 18h16" />
      <circle cx="8" cy="6" r="2" fill="currentColor" />
      <circle cx="16" cy="12" r="2" fill="currentColor" />
      <circle cx="10" cy="18" r="2" fill="currentColor" />
    </>
  ),
  background: (
    <>
      <circle cx="12" cy="8" r="3" />
      <path d="M7 21v-2a5 5 0 0 1 10 0v2M3 3h2m14 0h2M2 8h2m16 0h2M2 13h3m14 0h3M2 18h2m16 0h2" />
    </>
  ),
  chevronUp: <path d="m6 15 6-6 6 6" />,
  chevronDown: <path d="m6 9 6 6 6-6" />,
  minimize: <path d="M5 18h14" />,
  maximize: <rect x="4" y="4" width="16" height="16" rx="2" />,
  restoreWindow: (
    <>
      <rect x="3" y="8" width="13" height="13" rx="2" />
      <path d="M8 8V3h13v13h-5" />
    </>
  ),
  close: <path d="m6 6 12 12M6 18 18 6" />,
  chat: (
    <path d="M21 11a8 8 0 0 1-8 8H6l-4 3V11a8 8 0 0 1 8-8h3a8 8 0 0 1 8 8ZM7 8h9M7 12h6" />
  ),
  microphone: (
    <>
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3m-4 0h8" />
    </>
  ),
  microphoneOff: (
    <>
      <path d="m3 3 18 18M9 9v3a3 3 0 0 0 5 2m1-4V5a3 3 0 0 0-6 0M5 10v2a7 7 0 0 0 12 5m2-5v-2M12 19v3m-4 0h8" />
    </>
  ),
  camera: (
    <>
      <rect x="3" y="5" width="13" height="14" rx="3" />
      <path d="m16 10 5-3v10l-5-3" />
    </>
  ),
  cameraOff: (
    <>
      <path d="m3 3 18 18M7 5h6a3 3 0 0 1 3 3v2l5-3v10l-5-3M3 8v8a3 3 0 0 0 3 3h7" />
    </>
  ),
  screen: (
    <>
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8m-4-4v4M12 13V7m-3 3 3-3 3 3" />
    </>
  ),
  screenOff: (
    <>
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8m-4-4v4m-3-9 6-6m-6 0 6 6" />
    </>
  ),
  expand: <path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5" />,
  collapse: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M10 4v16m7-11-3 3 3 3" />
    </>
  ),
  fullscreen: (
    <path d="M8 3H3v5m0-5 6 6m7-6h5v5m0-5-6 6M3 16v5h5m-5 0 6-6m12 1v5h-5m5 0-6-6" />
  ),
  exitFullscreen: (
    <path d="M3 8h5V3m0 5L2 2m19 6h-5V3m0 5 6-6M3 16h5v5m0-5-6 6m19-6h-5v5m0-5 6 6" />
  ),
  people: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 21v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6m3 10v-3a6 6 0 0 0-2-4" />
    </>
  ),
  hidePeople: (
    <>
      <path d="m3 3 18 18M7 5a3 3 0 0 1 5 3m-6 0a3 3 0 0 0 5 2M3 21v-3a6 6 0 0 1 10-4M16 5a3 3 0 0 1 0 6m3 10v-3" />
    </>
  ),
  pin: <path d="m15 3 6 6-4 1-4 4v4l-7-7h4l4-4 1-4ZM9 15l-6 6" />,
  automatic: (
    <>
      <rect x="3" y="3" width="18" height="12" rx="2" />
      <path d="M3 19h4m3 0h4m3 0h4" />
    </>
  ),
  phone: <path d="M3 16v-4c5-5 13-5 18 0v4l-5-1v-3a14 14 0 0 0-8 0v3l-5 1Z" />,
  volume: (
    <>
      <path d="m11 4-6 5H2v6h3l6 5V4Zm4 4a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14" />
    </>
  ),
  refresh: <path d="M20 8a8 8 0 1 0 0 8M20 3v5h-5" />,
  back: <path d="m14 5-7 7 7 7M7 12h14" />,
  join: <path d="M14 3h6v18h-6M3 12h12m-4-4 4 4-4 4" />,
} satisfies Record<string, ReactNode>;

export type RoomIconName = keyof typeof paths;
export function RoomIcon({ name }: { name: RoomIconName }) {
  return (
    <svg
      aria-hidden="true"
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
}
