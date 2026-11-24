// Frames one image at a time for the ZIP file, off the main thread.

import { draw, prepare, read } from './frame.js';
import { png } from './png.js';

const canvas = new OffscreenCanvas(1, 1);

onmessage = async ({ data: { blob, settings, values } }) => {
  let image;
  try {
    // The page frames the image when the fonts of the text do not load here.
    if (!(await prepare(settings))) throw new Error('The fonts did not load.');
    image = await read(blob);
    draw(canvas, image, settings, values);
    // Before the file is written, because that takes the most memory.
    image.close();
    postMessage(await png(canvas));
  } catch (error) {
    image?.close();
    postMessage({ error: String(error) });
  }
};
