import type { ReactNode } from "react";

export function ScreenLoadingContent({
  waiting,
  children,
}: Readonly<{
  waiting: boolean;
  children: ReactNode;
}>) {
  return (
    <div
      inert={waiting}
      aria-hidden={waiting}
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        minHeight: 0,
        visibility: waiting ? "hidden" : "visible",
      }}
    >
      {children}
    </div>
  );
}
