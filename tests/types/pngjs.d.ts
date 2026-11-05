// Minimal typing for the part of pngjs the QR test uses (avoids an extra @types dependency).
declare module 'pngjs' {
  export const PNG: { sync: { read(buffer: Buffer): { width: number; height: number; data: Buffer } } };
}
