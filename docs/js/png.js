// A PNG file of an opaque canvas, for the workers. An OffscreenCanvas would save an
// alpha channel that the frame does not need, and the file would be a quarter larger.

import { crc32 } from './zip.js';

const ROWS = 256;
const SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

const bytes = (...parts) => {
  const all = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    all.set(part, offset);
    offset += part.length;
  }
  return all;
};
const uint32 = (...numbers) => {
  const view = new DataView(new ArrayBuffer(numbers.length * 4));
  numbers.forEach((number, i) => view.setUint32(i * 4, number));
  return new Uint8Array(view.buffer);
};
const text = (string) => Uint8Array.from(string, (character) => character.charCodeAt(0));

// A chunk is its length, its type, its data, and a checksum of the type and the data.
const chunk = (type, data = new Uint8Array(0)) => {
  const name = text(type);
  return bytes(uint32(data.length), name, data, uint32(crc32(data, crc32(name))));
};

// Returns { blob, crc }, with the checksum of the whole file for the ZIP archive.
export const png = async (canvas) => {
  const { width, height } = canvas;
  const { data } = canvas.getContext('2d').getImageData(0, 0, width, height);
  const deflate = new CompressionStream('deflate');
  const writer = deflate.writable.getWriter();
  // Each row starts with its filter. Filter 1 stores a pixel as its difference to the one before.
  const feed = async () => {
    for (let top = 0, i = 0; top < height; top += ROWS) {
      const rows = Math.min(ROWS, height - top);
      const band = new Uint8Array(rows * (width * 3 + 1));
      for (let y = 0, o = 0; y < rows; y++) {
        band[o++] = 1;
        let r = 0;
        let g = 0;
        let b = 0;
        for (let x = 0; x < width; x++, i += 4) {
          band[o++] = data[i] - r;
          band[o++] = data[i + 1] - g;
          band[o++] = data[i + 2] - b;
          r = data[i];
          g = data[i + 1];
          b = data[i + 2];
        }
      }
      await writer.write(band);
    }
    await writer.close();
  };
  const [, compressed] = await Promise.all([feed(), new Response(deflate.readable).arrayBuffer()]);
  // 8 bits for each color, and color type 2, which is RGB.
  const header = bytes(uint32(width, height), new Uint8Array([8, 2, 0, 0, 0]));
  const file = bytes(SIGNATURE, chunk('IHDR', header), chunk('IDAT', new Uint8Array(compressed)), chunk('IEND'));
  return { blob: new Blob([file], { type: 'image/png' }), crc: crc32(file) };
};
