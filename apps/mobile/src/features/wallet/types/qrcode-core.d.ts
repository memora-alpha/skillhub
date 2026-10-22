// Narrow declaration for the reviewed, pinned qrcode@1.5.4 internal core entry.
declare module "qrcode/lib/core/qrcode" {
  const core: {
    create(
      segments: { data: string; mode: "byte" }[],
      options: { errorCorrectionLevel: "M" },
    ): { modules: { size: number; data: Uint8Array } };
  };
  export default core;
}
