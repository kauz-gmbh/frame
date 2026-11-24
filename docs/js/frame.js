// Reads an image and draws it into its frame. The page and the workers share this file.

import { imageDataRGBA } from './vendor/stackblur.js';

const MAX_SIDE = 4096;

const newCanvas = () => (typeof document === 'undefined' ? new OffscreenCanvas(1, 1) : document.createElement('canvas'));

// A page reads through an image element, which redraws about three times faster than a bitmap
// and also reads SVG. A worker has no such element, so it reads a bitmap.
export const read = async (blob) => {
  let image;
  if (typeof Image === 'undefined') {
    image = await createImageBitmap(blob);
  } else {
    image = new Image();
    image.src = URL.createObjectURL(blob);
    try {
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = reject;
      });
    } finally {
      URL.revokeObjectURL(image.src);
    }
  }
  if (!image.width || !image.height) throw new Error('The image has no size.');
  return image;
};

const frameSize = (image, ratio) => {
  const [across, down] = ratio.split(':').map(Number);
  const longest = Math.min(Math.max(image.width, image.height), MAX_SIDE);
  return across >= down
    ? { width: longest, height: Math.round((longest * down) / across) }
    : { width: Math.round((longest * across) / down), height: longest };
};

// The last blurred background is kept, so that a change of the border does not blur it again.
let blurred = null;
const blurredBackground = (image, width, height, radius) => {
  if (blurred?.image === image && blurred.width === width && blurred.height === height && blurred.radius === radius) {
    return blurred.canvas;
  }
  // A blur hides detail, so it is drawn on a smaller copy and enlarged, which is many times faster.
  const shrink = Math.max(1, Math.min(Math.max(width, height) / 1024, radius / 4));
  const canvas = blurred?.canvas ?? newCanvas();
  canvas.width = Math.round(width / shrink);
  canvas.height = Math.round(height / shrink);
  const scale = Math.max(canvas.width / image.width, canvas.height / image.height);
  const w = image.width * scale;
  const h = image.height * scale;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.imageSmoothingQuality = 'high';
  context.drawImage(image, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  context.putImageData(imageDataRGBA(pixels, 0, 0, canvas.width, canvas.height, Math.round(radius / shrink)), 0, 0);
  blurred = { image, width, height, radius, canvas };
  return canvas;
};

// The settings are { ratio, border, background, color, blur }. Returns the size of the frame.
export const draw = (canvas, image, { ratio, border, background, color, blur }) => {
  const { width, height } = frameSize(image, ratio);
  // Setting the size allocates the canvas anew, even when the size stays the same.
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  const context = canvas.getContext('2d', { alpha: false });
  if (background === 'blur') {
    context.imageSmoothingQuality = 'low';
    context.drawImage(blurredBackground(image, width, height, blur), 0, 0, width, height);
  } else {
    context.fillStyle = color;
    context.fillRect(0, 0, width, height);
  }
  context.imageSmoothingQuality = 'high';
  // A border wider than the frame leaves no room for the image.
  const scale = Math.max(0, Math.min((width - border * 2) / image.width, (height - border * 2) / image.height));
  const w = image.width * scale;
  const h = image.height * scale;
  context.drawImage(image, (width - w) / 2, (height - h) / 2, w, h);
  return { width, height };
};
