import { contactTokens, type ContactToken } from "./contact-patterns";

const shortDomains = new Set([
  "zalo.me",
  "t.me",
  "telegram.me",
  "wa.me",
  "m.me",
  "fb.me",
  "discord.gg",
  "invite.gg",
]);
const profileDomains = new Set([
  "facebook.com",
  "facebook.net",
  "fb.com",
  "fb.net",
  "instagram.com",
  "instagram.net",
  "tiktok.com",
  "tiktok.net",
  "threads.com",
  "threads.net",
]);
const publicPaths = new Set([
  "help",
  "policies",
  "privacy",
  "terms",
  "developers",
]);
const hostPrefixes = new Set(["www", "m", "vm", "vt"]);
const platforms = new Set([
  "zalo",
  "telegram",
  "whatsapp",
  "messenger",
  "facebook",
  "instagram",
  "tiktok",
  "discord",
  "viber",
  "signal",
  "wechat",
  "fb",
  "ig",
]);
const prompts = new Set([
  "lien he",
  "inbox",
  "ib",
  "ket ban",
  "nhan tin",
  "add",
]);

function allowedHost(tokens: ContactToken[], index: number) {
  if (tokens[index - 1]?.value !== ".") return true;
  return (
    hostPrefixes.has(tokens[index - 2]?.value ?? "") &&
    tokens[index - 3]?.value !== "."
  );
}
function socialLinkAt(tokens: ContactToken[], index: number) {
  if (
    tokens[index + 1]?.value !== "." ||
    tokens[index + 3]?.value !== "/" ||
    !allowedHost(tokens, index)
  )
    return false;
  const domain = `${tokens[index]!.value}.${tokens[index + 2]?.value}`;
  if (shortDomains.has(domain)) return true;
  const path = tokens[index + 4]?.value ?? "";
  if (profileDomains.has(domain))
    return /^[\p{L}\p{N}@]/u.test(path) && !publicPaths.has(path);
  return (
    domain === "discord.com" &&
    (path === "users" || path === "invite") &&
    tokens[index + 5]?.value === "/"
  );
}
function contactPromptBefore(tokens: ContactToken[], index: number) {
  let cursor = index - 1;
  if (["qua", "tai", "tren"].includes(tokens[cursor]?.value ?? "")) cursor--;
  const last = tokens[cursor]?.value ?? "";
  return (
    prompts.has(last) || prompts.has(`${tokens[cursor - 1]?.value} ${last}`)
  );
}
function handleAt(text: string, token: ContactToken | undefined) {
  return (
    !!token &&
    /^@?[\p{L}\p{N}][\p{L}\p{N}_.-]{2,}/u.test(text.slice(token.index))
  );
}
function socialHandleAt(text: string, tokens: ContactToken[], index: number) {
  if (!platforms.has(tokens[index]!.value)) return false;
  if (contactPromptBefore(tokens, index) && handleAt(text, tokens[index + 1]))
    return true;
  let cursor = index + 1;
  if (tokens[cursor]?.value === "cua") cursor++;
  if (["minh", "toi"].includes(tokens[cursor]?.value ?? "")) cursor++;
  if (["id", "username", "nick"].includes(tokens[cursor]?.value ?? ""))
    cursor++;
  else if (
    tokens[cursor]?.value === "tai" &&
    tokens[cursor + 1]?.value === "khoan"
  )
    cursor += 2;
  if (![":", "=", "@", "la"].includes(tokens[cursor]?.value ?? ""))
    return false;
  return handleAt(text, tokens[cursor + 1]);
}
export function hasSocialContact(text: string) {
  const tokens = contactTokens(text);
  return tokens.some(
    (token, index) =>
      socialLinkAt(tokens, index) ||
      socialHandleAt(text, tokens, index) ||
      (token.value === "@" &&
        contactPromptBefore(tokens, index) &&
        handleAt(text, tokens[index + 1])),
  );
}
