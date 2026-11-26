// Reads an image and draws it into its frame. The page and the workers share this file.

import { FACES, STYLES } from './styles.js';
import { imageDataRGBA } from './vendor/stackblur.js';

const MAX_SIDE = 4096;
const TOKENS = ['camera', 'lens', 'focal', 'aperture', 'shutter', 'iso', 'date', 'yy', 'mm', 'dd', 'm', 'd', 'frame'];

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
  // A turned style has its upper margin on the right side, and so on around the photo.
  const turned = Boolean(style.turn) && image.height > image.width;
  const [top, right, bottom, left] = (turned ? [3, 0, 1, 2] : [0, 1, 2, 3]).map((side) => style.pad[side] * unit);
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
    // The margins of a style are parts of a pixel, and the frame is whole pixels.
    const longest = Math.round(Math.min(Math.max(across, down), MAX_SIDE));
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
    turned,
    unit: unit * scale,
    card: { x, y, w, h },
    photo: { x: x + left * scale, y: y + top * scale, w: w - (left + right) * scale, h: h - (top + bottom) * scale },
  };
};

// Fills the tokens of a text, as in "{focal}  {aperture}  {shutter}  {iso}". The parts are
// divided by two spaces, or by a dot, bar, or slash between spaces. A part with nothing to
// show leaves no gap behind, and neither does a part of which every token is empty.
const fill = (text, values) => {
  const parts = text.split(/(\s+[·|/]\s+|\s{2,})/);
  let filled = '';
  for (let i = 0; i < parts.length; i += 2) {
    let tokens = 0;
    let found = 0;
    const part = parts[i]
      .replace(/\{(\w+)\}/g, (token, name) => {
        if (!TOKENS.includes(name)) return token;
        tokens++;
        if (values[name]) found++;
        return values[name] ?? '';
      })
      // Only plain spaces are closed up. A token may bring a space as wide as a digit.
      .replace(/ +/g, ' ')
      .replace(/^ | $/g, '');
    if (part && (found || !tokens)) filled += (filled ? parts[i - 1] : '') + part;
  }
  return filled;
};

// The height of a capital letter, as a part of the size of the text.
const CAPITAL = 0.72;
// The room that a drawn apostrophe takes, as a part of the size of the text.
const TICK = 0.34;

const write = (context, { unit, card, photo }, style, line, values, caption) => {
  let text = fill(line.edit && caption ? caption : line.text, values);
  if (line.upper) text = text.toUpperCase();
  if (!text || !unit) return;
  const { family, weight, fallback, blank, tick } = FACES[line.face];
  // The face of the segment digits has its own blank of the width of a digit, and it has
  // no apostrophe. The text is cut at each apostrophe, and a short segment is drawn there.
  if (blank) text = text.replaceAll('\u2007', blank);
  const pieces = tick ? text.split(/['’]/) : [text];
  const widthOf = () => pieces.reduce((sum, piece) => sum + context.measureText(piece).width, (pieces.length - 1) * TICK * size);
  const inset = line.zone === 'over' || line.zone === 'head' ? unit * (style.inset ?? 3) : 0;
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
  const taken = widthOf() + (line.lead ? size : 0);
  if (taken > most) {
    size *= most / taken;
    setFont();
  }
  // In a margin, the capitals have their middle on the line, so that two texts of different
  // sizes sit level. Over the photo, the text is as far from the lower or the upper edge as
  // from the side.
  const end = photo.y + photo.h;
  const half = (size * CAPITAL) / 2;
  const middle = {
    top: (card.y + photo.y) / 2,
    bottom: (end + card.y + card.h) / 2,
    over: end - inset - half,
    head: photo.y + inset + half,
  };
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
  if (pieces.length === 1) {
    context.fillText(text, x, y + half);
  } else {
    // The pieces follow one another from the left end of the whole text.
    const width = widthOf();
    let at = x - ({ center: width / 2, right: width }[context.textAlign] ?? 0);
    const top = y + half - context.measureText('8').actualBoundingBoxAscent;
    context.textAlign = 'left';
    pieces.forEach((piece, i) => {
      if (i) {
        // An apostrophe: a short upright segment at the height of the top of the digits.
        const thick = size * 0.14;
        const middle = at + TICK * size * 0.5;
        const bottom = top + size * 0.3;
        context.beginPath();
        context.moveTo(middle, top);
        context.lineTo(middle + thick / 2, top + thick / 2);
        context.lineTo(middle + thick / 2, bottom - thick / 2);
        context.lineTo(middle, bottom);
        context.lineTo(middle - thick / 2, bottom - thick / 2);
        context.lineTo(middle - thick / 2, top + thick / 2);
        context.fill();
        at += TICK * size;
      }
      context.fillText(piece, at, y + half);
      at += context.measureText(piece).width;
    });
  }
  context.globalAlpha = 1;
  context.shadowColor = 'transparent';
  context.shadowBlur = 0;
};

// The main colors of an image, from dark to light. The last ones are kept, so that a change
// of the settings does not look for them again.
let swatches = null;
const palette = (image, count) => {
  if (swatches?.image === image && swatches.colors.length === count) return swatches.colors;
  // A grid of single pixels has the colors of the whole image. The pixels are taken as they
  // are, not blended: a browser blends an image on the page and one in a worker differently,
  // and the preview and the ZIP file would not get the same colors.
  const side = 64;
  const canvas = swatches?.canvas ?? newCanvas();
  canvas.width = side;
  canvas.height = side;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.imageSmoothingEnabled = false;
  context.drawImage(image, 0, 0, side, side);
  const { data } = context.getImageData(0, 0, side, side);
  let boxes = [Array.from({ length: side * side }, (_, i) => [data[i * 4], data[i * 4 + 1], data[i * 4 + 2]])];
  // The pixels start as one group. The group that is widest in red, green, or blue is cut in
  // two at its middle pixel, until there are three times as many groups as colors.
  while (boxes.length < count * 3) {
    let widest = null;
    for (const box of boxes) {
      for (let channel = 0; channel < 3 && box.length > 1; channel++) {
        const levels = box.map((pixel) => pixel[channel]);
        const spread = Math.max(...levels) - Math.min(...levels);
        if (!widest || spread > widest.spread) widest = { box, channel, spread };
      }
    }
    if (!widest?.spread) break;
    const { box, channel } = widest;
    box.sort((a, b) => a[channel] - b[channel]);
    boxes = [...boxes.filter((other) => other !== box), box.slice(0, box.length >> 1), box.slice(box.length >> 1)];
  }
  const groups = boxes.map((box) => ({
    color: [0, 1, 2].map((channel) => Math.round(box.reduce((sum, pixel) => sum + pixel[channel], 0) / box.length)),
    share: box.length / (side * side),
  }));
  // The largest group is the first color. Each next one is the group that is furthest from
  // the colors so far, where a large group counts for more. So a small light in a dark photo
  // gets a chip, and five shades of the dark do not.
  const far = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const picked = [groups.reduce((most, group) => (group.share > most.share ? group : most))];
  while (picked.length < Math.min(count, groups.length)) {
    let next = null;
    for (const group of groups) {
      if (picked.includes(group)) continue;
      const score = Math.min(...picked.map((other) => far(group.color, other.color))) * group.share ** 0.3;
      if (!next || score > next.score) next = { group, score };
    }
    picked.push(next.group);
  }
  const light = ([r, g, b]) => r * 0.299 + g * 0.587 + b * 0.114;
  const colors = picked
    .map((group) => group.color)
    .sort((a, b) => light(a) - light(b))
    .map(([r, g, b]) => `rgb(${r}, ${g}, ${b})`);
  swatches = { image, colors, canvas };
  return colors;
};

const rounded = (context, x, y, w, h, radius) => {
  context.beginPath();
  if (context.roundRect) context.roundRect(x, y, w, h, radius);
  else context.rect(x, y, w, h);
};

// The shapes that a style draws besides its text.
const SHAPES = {
  // The perforations of a film strip: a row above the photo and a row below it. Their step is
  // set a little wider or closer, so that a whole number of them fits across the card.
  holes: (context, { unit, card, photo }, { size: [w, h], step, gap, round, color }) => {
    const count = Math.max(1, Math.round(card.w / (step * unit)));
    const each = card.w / count;
    context.fillStyle = color;
    for (let i = 0; i < count; i++) {
      const x = card.x + each * (i + 0.5) - (w * unit) / 2;
      for (const y of [photo.y - (gap + h) * unit, photo.y + photo.h + gap * unit]) {
        rounded(context, x, y, w * unit, h * unit, round * unit);
        context.fill();
      }
    }
  },
  // The main colors of the photo, as a row of chips below it that is as wide as the photo.
  chips: (context, { unit, photo }, { count, height, gap, top, rule }, image) => {
    const colors = palette(image, count);
    const each = (photo.w - gap * unit * (count - 1)) / count;
    const thick = Math.max(1, Math.round(unit * 0.07));
    const y = Math.round(photo.y + photo.h + top * unit);
    const h = Math.round(height * unit);
    colors.forEach((color, i) => {
      const x = Math.round(photo.x + (each + gap * unit) * i);
      const w = Math.round(photo.x + (each + gap * unit) * i + each) - x;
      context.fillStyle = color;
      context.fillRect(x, y, w, h);
      // The same fine line as on the photo, for a chip that is close to the color of the paper.
      context.strokeStyle = rule;
      context.lineWidth = thick;
      context.strokeRect(x + thick / 2, y + thick / 2, w - thick, h - thick);
    });
  },
  // The marks of a viewfinder: a bracket in each corner of the photo, and the corners of a
  // focus area at its middle.
  finder: (context, { unit, photo }, { inset, arm, box, boxArm, line, color, shade }) => {
    const corners = (x, y, w, h, length) => {
      for (const [cx, cy, dx, dy] of [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]]) {
        context.moveTo(cx + dx * length, cy);
        context.lineTo(cx, cy);
        context.lineTo(cx, cy + dy * length);
      }
    };
    context.beginPath();
    corners(photo.x + inset * unit, photo.y + inset * unit, photo.w - inset * unit * 2, photo.h - inset * unit * 2, arm * unit);
    corners(photo.x + (photo.w - box * unit) / 2, photo.y + (photo.h - box * unit) / 2, box * unit, box * unit, boxArm * unit);
    context.strokeStyle = color;
    context.lineWidth = Math.max(1, line * unit);
    context.shadowColor = shade;
    context.shadowBlur = unit;
    context.stroke();
    context.shadowColor = 'transparent';
    context.shadowBlur = 0;
  },
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
  // The shapes and the text of a turned style are drawn on a card that lies on its side: its
  // upper edge is the right edge of the card in the frame.
  const lying = place.turned && {
    unit: place.unit,
    card: { x: 0, y: 0, w: card.h, h: card.w },
    photo: { x: photo.y - card.y, y: card.x + card.w - photo.x - photo.w, w: photo.h, h: photo.w },
  };
  if (lying) {
    context.save();
    context.translate(card.x + card.w, card.y);
    context.rotate(Math.PI / 2);
  }
  for (const [shape, draws] of Object.entries(SHAPES)) {
    if (style[shape] && place.unit) draws(context, lying || place, style[shape], image);
  }
  for (const line of style.lines) write(context, lying || place, style, line, values, caption);
  if (lying) context.restore();
  return { width, height };
};
