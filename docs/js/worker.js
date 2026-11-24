// Frames one image at a time for the ZIP file, off the main thread.

import { draw, read } from './frame.js';
import { png } from './png.js';

const canvas = new OffscreenCanvas(1, 1);

onmessage = async ({ data: { blob, settings } }) => {
  let image;
  try {
    image = await read(blob);
    draw(canvas, image, settings);
    // Before the file is written, because that takes the most memory.
    image.close();
    postMessage(await png(canvas));
  } catch (error) {
    image?.close();
    postMessage({ error: String(error) });
  }
};
