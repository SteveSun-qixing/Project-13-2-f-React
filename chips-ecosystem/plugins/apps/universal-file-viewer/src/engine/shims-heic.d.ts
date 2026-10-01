declare module "heic2any" {
  interface Heic2AnyOptions {
    blob: Blob;
    toType?: string | undefined;
    quality?: number | undefined;
    gifInterval?: number | undefined;
    multiple?: boolean | undefined;
  }
  function heic2any(options: Heic2AnyOptions): Promise<Blob | Blob[]>;
  export default heic2any;
}

declare module "utif" {
  export interface UtifIfd {
    width?: number | undefined;
    height?: number | undefined;
    data?: Uint8Array | undefined;
    [key: string]: unknown;
  }
  export function decode(buffer: ArrayBuffer): UtifIfd[];
  export function decodeImage(buffer: ArrayBuffer, ifd: UtifIfd): void;
  export function toRGBA8(ifd: UtifIfd): Uint8Array;
}
