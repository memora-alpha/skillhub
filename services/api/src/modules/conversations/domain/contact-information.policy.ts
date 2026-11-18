import { BadRequestException } from "@nestjs/common";

const email = /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.[\p{L}]{2,63}/u;
const contactScheme = /\b(?:mailto|tel|sms|callto|skype|tg):\S/iu;
const vietnamesePhone =
  /(?<![\p{L}\p{N}])(?:0[35789](?:[ .()-]{0,3}\d){8}|02(?:[ .()-]{0,3}\d){9})(?![\p{L}\p{N}])/u;
const internationalPhone =
  /(?<![\p{L}\p{N}])\+(?:[ .()-]{0,3}\d){8,15}(?![\p{L}\p{N}])/u;
// Consume the complete URL so a contact-like string in another site's path
// (example.com/t.me/name) is not mistaken for that contact site's hostname.
const urls =
  /(?:https?:\/\/|www\.)[^\s<>"']+|(?:[a-z0-9-]+\.)+[a-z]{2,63}\/[^\s<>"']+/giu;
const messagingHosts = new Set([
  "zalo.me",
  "chat.zalo.me",
  "wa.me",
  "chat.whatsapp.com",
  "t.me",
  "telegram.me",
  "telegram.dog",
  "m.me",
  "messenger.com",
  "discord.gg",
]);
const facebookContentPaths = new Set([
  "help",
  "policies",
  "privacy",
  "terms",
  "watch",
  "share",
  "sharer",
  "login",
  "recover",
]);
const instagramContentPaths = new Set([
  "p",
  "reel",
  "reels",
  "stories",
  "explore",
  "about",
  "legal",
  "accounts",
  "developer",
  "developers",
  "help",
]);

function isContactUrl(candidate: string): boolean {
  let url: URL;
  try {
    url = new URL(
      /^https?:\/\//iu.test(candidate) ? candidate : `https://${candidate}`,
    );
  } catch {
    return false;
  }
  const host = url.hostname
    .toLowerCase()
    .replace(/^www\./u, "")
    .replace(/^m\.(?=(?:facebook|instagram|linkedin)\.com$)/u, "");
  const parts = url.pathname.toLowerCase().split("/").filter(Boolean);
  const first = parts[0];
  if (!first) return false;
  if (messagingHosts.has(host)) return true;
  if (["whatsapp.com", "api.whatsapp.com", "web.whatsapp.com"].includes(host))
    return first === "send";
  if (["facebook.com", "fb.com", "fb.me"].includes(host))
    return !facebookContentPaths.has(first);
  if (host === "instagram.com") return !instagramContentPaths.has(first);
  if (host === "linkedin.com") return ["in", "pub"].includes(first);
  if (host === "discord.com") return ["users", "invite"].includes(first);
  if (host === "line.me")
    return /^\/(?:r\/)?ti\/p\//u.test(url.pathname.toLowerCase());
  return false;
}

/** Inspect normalized chat text only; file bytes and arbitrary obfuscation are out of scope. */
export function assertNoContactInformation(messageText: string): void {
  // Canonicalize full-width characters and invisible formatting for detection;
  // keep the persisted text and existing idempotency digest unchanged.
  const text = messageText.normalize("NFKC").replace(/\p{Cf}/gu, "");
  if (
    email.test(text) ||
    contactScheme.test(text) ||
    vietnamesePhone.test(text) ||
    internationalPhone.test(text) ||
    [...text.matchAll(urls)].some(([candidate]) => isContactUrl(candidate))
  )
    throw new BadRequestException("CONTACT_INFORMATION_NOT_ALLOWED");
}
