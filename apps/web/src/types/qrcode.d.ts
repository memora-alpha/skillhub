declare module "qrcode" {
  export function toDataURL(
    text: string,
    options?: Parameters<typeof toCanvas>[2],
  ): Promise<string>;
  export function toCanvas(
    canvas: HTMLCanvasElement,
    text: string,
    options?: {
      width?: number;
      margin?: number;
      errorCorrectionLevel?: "L" | "M" | "Q" | "H";
    },
  ): Promise<void>;
}
