declare module "upng-js" {
  /**
   * Encode RGBA image data to PNG
   * @param imgs Array of ArrayBuffer containing RGBA pixel data
   * @param w Width of the image
   * @param h Height of the image
   * @param cnum Number of colors in the palette (0 for truecolor PNG)
   * @param dels Optional array of delays for animated PNGs
   * @returns ArrayBuffer containing the encoded PNG data
   */
  function encode(
    imgs: ArrayBuffer[],
    w: number,
    h: number,
    cnum: number,
    dels?: number[],
  ): ArrayBuffer;

  /**
   * Decode PNG data
   * @param buffer ArrayBuffer containing PNG data
   * @returns Decoded PNG object
   */
  function decode(buffer: ArrayBuffer): {
    width: number;
    height: number;
    depth: number;
    ctype: number;
    frames: Array<{
      rect: { x: number; y: number; width: number; height: number };
      blend: number;
      dispose: number;
      delay: number;
    }>;
    tabs: Record<string, unknown>;
    data: Uint8Array;
  };

  /**
   * Convert decoded PNG frames to RGBA
   * @param png Decoded PNG object from decode()
   * @returns Array of Uint8Array containing RGBA pixel data for each frame
   */
  function toRGBA8(png: ReturnType<typeof decode>): Uint8Array[];

  export { encode, decode, toRGBA8 };
  export default { encode, decode, toRGBA8 };
}
