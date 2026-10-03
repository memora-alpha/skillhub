export type AvatarInput = { bytes: Buffer; mime: string; size: number };
export type ScanEvidence = {
  lease?: number;
  attempts?: number;
  reason?: string;
  clean?: boolean;
  selected?: boolean;
};
