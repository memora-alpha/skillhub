import { isIP } from "node:net";

/** Trust explicit proxy addresses/subnets only; never trust arbitrary forwarded headers. */
export function trustedProxySetting(value?: string): false | string[] {
  if (!value?.trim()) return false;
  const entries = value.split(",").map((entry) => entry.trim());
  for (const entry of entries) {
    const [address = "", prefix, extra] = entry.split("/");
    const version = isIP(address);
    if (
      !version ||
      extra !== undefined ||
      (prefix !== undefined &&
        (!/^\d{1,3}$/.test(prefix) ||
          Number(prefix) < 1 ||
          Number(prefix) > (version === 4 ? 32 : 128)))
    )
      throw new Error(
        "TRUSTED_PROXY_CIDRS must contain explicit IP addresses or CIDRs",
      );
  }
  return entries;
}
