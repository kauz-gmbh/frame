// Reads an image and draws it into its frame. The page and the workers share this file.

import { FACES, STYLES } from './styles.js';
import { imageDataRGBA } from './vendor/stackblur.js';

const MAX_SIDE = 4096;
const TOKENS = ['camera', 'lens', 'focal', 'aperture', 'shutter', 'iso', 'date', 'frame'];

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

const styleOf = (settings) => STYLES[settings.style] ?? STYLES.none;

// A style loads the faces of its lines, each one once, before its first text is drawn. Every
// face has a family of its own, because Chromium keeps the fallback for good in a worker when
// a face is added after the name of its family was used.
const fontSet = typeof document === 'undefined' ? self.fonts : document.fonts;
const loading = new Map();
const settled = new Set();
const load = (face) => {
  if (!loading.has(face)) {
    const { family, weight, file } = FACES[face];
    const source = `url("${new URL(`../fonts/${file}`, import.meta.url)}")`;
    const loaded = (async () => fontSet.add(await new FontFace(family, source, { weight: String(weight) }).load()))();
    loading.set(face, loaded.then(() => true, () => false).finally(() => settled.add(face)));
  }
  return loading.get(face);
};
const facesOf = (settings) => [...new Set(styleOf(settings).lines.map((line) => line.face))];

// Whether the style of these settings can be drawn now.
export const ready = (settings) => facesOf(settings).every((face) => settled.has(face));

// Loads what the style needs. Resolves to false when a face did not load, as without a
// connection. The text is then drawn in a face of the device.
export const prepare = async (settings) => (await Promise.all(facesOf(settings).map(load))).every(Boolean);

// Where the photo sits in its frame. The style wraps the photo first, and the two make a card.
// The original ratio takes the size of the card. Any other ratio fits the card into its frame.
const layout = (image, style, { ratio, border }) => {
  const unit = Math.min(image.width, image.height) / 100;
  const [top, right, bottom, left] = style.pad.map((n) => n * unit);
  const across = image.width + left + right;
  const down = image.height + top + bottom;
  let width;
  let height;
  let scale;
  if (ratio === 'original') {
    scale = Math.min(1, (MAX_SIDE - border * 2) / Math.max(across, down));
    width = Math.round(across * scale) + border * 2;
    height = Math.round(down * scale) + border * 2;
  } else {
    const [wide, tall] = ratio.split(':').map(Number);
    const longest = Math.min(Math.max(across, down), MAX_SIDE);
    width = wide >= tall ? longest : Math.round((longest * wide) / tall);
    height = wide >= tall ? Math.round((longest * tall) / wide) : longest;
    // A border wider than the frame leaves no room for the card.
    scale = Math.max(0, Math.min((width - border * 2) / across, (height - border * 2) / down));
  }
  // The card sits on whole pixels, so that its edge stays sharp.
  const w = Math.round(across * scale);
  const h = Math.round(down * scale);
  const x = Math.round((width - w) / 2);
  const y = Math.round((height - h) / 2);
  return {
    width,
    height,
    unit: unit * scale,
    card: { x, y, w, h },
    photo: { x: x + left * scale, y: y + top * scale, w: w - (left + right) * scale, h: h - (top + bottom) * scale },
  };
};

// Fills the tokens of a text, as in "{focal}  {aperture}  {shutter}  {iso}". A part with nothing
// to show leaves no gap behind. The parts are divided by two spaces, or by a dot, bar, or slash
// between spaces.
const fill = (text, values) => {
  const parts = text.split(/(\s+[·|/]\s+|\s{2,})/);
  let filled = '';
  for (let i = 0; i < parts.length; i += 2) {
    const part = parts[i]
      .replace(/\{(\w+)\}/g, (token, name) => (TOKENS.includes(name) ? values[name] ?? '' : token))
      .replace(/\s+/g, ' ')
      .trim();
    if (part) filled += (filled ? parts[i - 1] : '') + part;
  }
  return filled;
};

// The height of a capital letter, as a part of the size of the text.
const CAPITAL = 0.72;

const write = (context, { unit, card, photo }, style, line, values, caption) => {
  let text = fill(line.edit && caption ? caption : line.text, values);
  if (line.upper) text = text.toUpperCase();
  if (!text || !unit) return;
  const { family, weight, fallback } = FACES[line.face];
  const inset = line.zone === 'over' ? unit * 3 : 0;
  const room = photo.w - inset * 2;
  let size = line.size * unit;
  const setFont = () => {
    context.font = `${weight} ${size}px "${family}", ${fallback}`;
    // Not every browser can space the letters of a canvas. The text is then set closer.
    if ('letterSpacing' in context) context.letterSpacing = `${(line.track ?? 0) * size}px`;
  };
  setFont();
  // A long text on a narrow photo gets smaller, so that it is not cut off.
  const most = room * (line.max ?? 1);
  const taken = context.measureText(text).width + (line.lead ? size : 0);
  if (taken > most) {
    size *= most / taken;
    setFont();
  }
  // In a margin, the capitals have their middle on the line, so that two texts of different
  // sizes sit level. Over the photo, the text stands on a line as far from the lower edge as
  // from the side.
  const end = photo.y + photo.h;
  const half = (size * CAPITAL) / 2;
  const middle = { top: (card.y + photo.y) / 2, bottom: (end + card.y + card.h) / 2, over: end - inset - half };
  const y = middle[line.zone] + (line.dy ?? 0) * unit;
  let x = photo.x + inset + room * line.at;
  context.textAlign = line.align ?? { 0.5: 'center', 1: 'right' }[line.at] ?? 'left';
  context.textBaseline = 'alphabetic';
  context.fillStyle = style.ink;
  context.globalAlpha = line.alpha ?? 1;
  if (style.shade) {
    // A soft shade keeps text readable on a part of the photo that is close to its color.
    context.shadowColor = style.shade;
    context.shadowBlur = unit;
  }
  if (line.lead === 'play') {
    // The arrow that points at a frame number on the edge of a film strip.
    const h = size * 0.56;
    context.beginPath();
    context.moveTo(x, y - h / 2);
    context.lineTo(x + h * 0.9, y);
    context.lineTo(x, y + h / 2);
    context.fill();
    x += size * 0.9;
  }
  context.fillText(text, x, y + half);
  context.globalAlpha = 1;
  context.shadowColor = 'transparent';
  context.shadowBlur = 0;
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

// The settings are { ratio, border, background, color, blur, style, caption }. The values are
// the camera data of the image, for the tokens of the text. Call prepare with the settings
// first. Returns the size of the frame.
export const draw = (canvas, image, settings, values = {}) => {
  const { background, color, blur, caption } = settings;
  const style = styleOf(settings);
  const place = layout(image, style, settings);
  const { width, height, card, photo } = place;
  // Setting the size allocates the canvas anew, even when the size stays the same.
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  const context = canvas.getContext('2d', { alpha: false });
  // A card that fills the frame hides the background.
  if (card.w < width || card.h < height) {
    if (background === 'blur') {
      context.imageSmoothingQuality = 'low';
      context.drawImage(blurredBackground(image, width, height, blur), 0, 0, width, height);
    } else {
      context.fillStyle = color;
      context.fillRect(0, 0, width, height);
    }
  }
  if (style.paper) {
    context.fillStyle = style.paper;
    context.fillRect(card.x, card.y, card.w, card.h);
  }
  context.imageSmoothingQuality = 'high';
  if (style.round && context.roundRect) {
    // The corners of a frame on film are a little round.
    context.save();
    context.beginPath();
    context.roundRect(photo.x, photo.y, photo.w, photo.h, style.round * place.unit);
    context.clip();
    context.drawImage(image, photo.x, photo.y, photo.w, photo.h);
    context.restore();
  } else {
    context.drawImage(image, photo.x, photo.y, photo.w, photo.h);
  }
  if (style.rule) {
    // A fine line on the edge of the photo, so that a pale sky does not run into pale paper.
    const thick = Math.max(1, Math.round(place.unit * 0.07));
    const x = Math.round(photo.x);
    const y = Math.round(photo.y);
    context.strokeStyle = style.rule;
    context.lineWidth = thick;
    context.strokeRect(x + thick / 2, y + thick / 2, Math.round(photo.x + photo.w) - x - thick, Math.round(photo.y + photo.h) - y - thick);
  }
  for (const line of style.lines) write(context, place, style, line, values, caption);
  return { width, height };
};
