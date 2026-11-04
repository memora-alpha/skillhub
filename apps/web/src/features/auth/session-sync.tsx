"use client";
import { useEffect } from "react";

const channelName = "skillhub-auth-session";
export function announceSessionChange() {
  if (typeof BroadcastChannel === "undefined") return;
  const channel = new BroadcastChannel(channelName);
  channel.postMessage("changed");
  channel.close();
}
export function SessionSync() {
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel(channelName);
    channel.onmessage = (event: MessageEvent) => {
      if (event.data !== "changed") return;
      // A full navigation clears account-bound UI and query state in other tabs.
      if (window.location.pathname === "/login") window.location.reload();
      else if (/^\/(learn|staff|admin)(\/|$)/.test(window.location.pathname))
        window.location.replace("/login");
    };
    return () => channel.close();
  }, []);
  return null;
}
