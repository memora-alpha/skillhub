// Synthetic text only. Never a bank account, VietQR or payOS payment payload.
export const qrPayloads = {
  ascii: "SYNTHETIC ONLY",
  unicode: "  synthetic raw\nĐồng e\u0301 € 😀\r\n ",
  dense: "synthetic-dense:" + "x".repeat(420),
  markup: '<svg onload="synthetic-only">& https://example.invalid/qr</svg>',
  overCapacity: "x".repeat(4096),
  invalid: "synthetic-\ud800",
} as const;

export const decodableQrCases = [
  "ascii",
  "unicode",
  "dense",
  "markup",
] as const;
