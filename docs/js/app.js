import { draw, read } from './frame.js';
import { crc32, zip } from './zip.js';

const SETTINGS_KEY = 'frame_settings';

const byId = (id) => document.getElementById(id);
const fileField = byId('files');
const status = byId('status');
const editor = byId('editor');
const pager = byId('pager');
const previousButton = byId('previous');
const nextButton = byId('next');
const position = byId('position');
const canvas = byId('canvas');
const caption = byId('caption');
const settings = byId('settings');
const fields = settings.elements;
const downloadButton = byId('download');
const copyButton = byId('copy');
const downloadAllButton = byId('download-all');
const clearButton = byId('clear');
const saveStatus = byId('save-status');

// Each entry is { name, file, blob }. Only the image on screen is read, as { entry, image },
// so that a large set takes little memory.
let images = [];
let index = 0;
let shown = null;
// Counts the calls to show an image, so that a newer one replaces an image that is still being read.
let turns = 0;

const count = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

// Cleared first, so that a screen reader also announces a repeated message.
const timers = new Map();
const announce = (region, text = '') => {
  clearTimeout(timers.get(region));
  region.textContent = '';
  if (text) timers.set(region, setTimeout(() => { region.textContent = text; }, 100));
};

const chosen = () => ({
  ratio: fields.ratio.value,
  border: Number(fields.border.value),
  background: fields.background.value,
  color: fields.color.value,
  blur: Number(fields.blur.value),
});

// The converter is large, so it loads with the first HEIC file that the browser cannot read itself.
let converter;
const loadConverter = () => {
  converter ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = '/js/vendor/heic2any.js';
    script.onload = () => resolve(window.heic2any);
    script.onerror = () => {
      converter = undefined;
      reject(new Error('The converter for HEIC files did not load.'));
    };
    document.head.append(script);
  });
  return converter;
};

const isHeic = (file) => /\.hei[cf]$/i.test(file.name) || /^image\/hei[cf]/.test(file.type);

// A converted HEIC file stays with its entry, because the conversion takes seconds.
const open = async (entry) => {
  try {
    return await read(entry.blob);
  } catch (error) {
    if (entry.blob !== entry.file || !isHeic(entry.file)) throw error;
    announce(status, `Converting ${entry.name}.`);
    const convert = await loadConverter();
    entry.blob = [await convert({ blob: entry.file, toType: 'image/jpeg', quality: 0.95 })].flat()[0];
    announce(status);
    return read(entry.blob);
  }
};

let queued = false;
const render = () => {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => {
    queued = false;
    if (!shown) return;
    const { entry, image } = shown;
    const { width, height } = draw(canvas, image, chosen());
    caption.textContent = `${entry.name}: ${image.width} × ${image.height} pixels, framed to ${width} × ${height} pixels.`;
  });
};

const reset = (message) => {
  turns++;
  shown = null;
  images = [];
  index = 0;
  editor.hidden = true;
  canvas.width = 0;
  canvas.height = 0;
  fileField.value = '';
  announce(saveStatus);
  announce(status, message);
};

const remove = (entry) => {
  if (!images.includes(entry)) return;
  const current = images[index];
  images = images.filter((other) => other !== entry);
  const message = `The browser could not read ${entry.name}.`;
  if (!images.length) return reset(`No image loaded. ${message}`);
  announce(status, `${message} It was removed.`);
  // The image that was open stays open. If it is the removed one, the next takes its place.
  show(current === entry ? index : images.indexOf(current));
};

const show = async (next) => {
  index = Math.max(0, Math.min(next, images.length - 1));
  const many = images.length > 1;
  pager.hidden = !many;
  downloadAllButton.hidden = !many;
  if (!downloadAllButton.disabled) downloadAllButton.textContent = `Download all ${images.length} images (ZIP)`;
  position.textContent = `Image ${index + 1} of ${images.length}`;
  // A disabled button loses the focus, so the other one takes it.
  const focused = document.activeElement;
  previousButton.disabled = index === 0;
  nextButton.disabled = index === images.length - 1;
  if (focused === previousButton && previousButton.disabled) nextButton.focus();
  if (focused === nextButton && nextButton.disabled) previousButton.focus();

  const entry = images[index];
  const turn = ++turns;
  let image;
  try {
    image = await open(entry);
  } catch {
    return remove(entry);
  }
  if (turn !== turns) return;
  shown = { entry, image };
  editor.hidden = false;
  render();
};

const load = (files) => {
  if (!files.length) return;
  // A file without a type may still be an image, so it gets a try.
  const others = files.filter((file) => file.type && !file.type.startsWith('image/') && !isHeic(file));
  const problem = others.length
    ? ` ${others.length === 1 ? 'Not an image' : 'Not images'}: ${others.map((file) => file.name).join(', ')}.`
    : '';
  const entries = files.filter((file) => !others.includes(file)).map((file) => ({ name: file.name, file, blob: file }));
  if (!entries.length) return announce(status, `No image loaded.${problem}`);
  images = entries;
  announce(saveStatus);
  announce(status, `${count(entries.length, 'image')} loaded.${problem}`);
  show(0);
};

const describe = () => {
  byId('border-value').value = count(Number(fields.border.value), 'pixel');
  byId('blur-value').value = count(Number(fields.blur.value), 'pixel');
  const blur = fields.background.value === 'blur';
  byId('color-field').hidden = blur;
  byId('blur-field').hidden = !blur;
};

// The browser may refuse storage, as in a private window.
const store = () => {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({
      ratio: fields.ratio.value,
      border: fields.border.value,
      bgType: fields.background.value,
      bgColor: fields.color.value,
      blurAmount: fields.blur.value,
    }));
  } catch {}
};

const restore = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY)) ?? {};
    if ([...fields.ratio.options].some((option) => option.value === saved.ratio)) fields.ratio.value = saved.ratio;
    if (Number.isFinite(Number(saved.border))) fields.border.value = saved.border;
    if (['color', 'blur'].includes(saved.bgType)) fields.background.value = saved.bgType;
    if (/^#[0-9a-f]{6}$/i.test(saved.bgColor)) fields.color.value = saved.bgColor;
    if (Number.isFinite(Number(saved.blurAmount))) fields.blur.value = saved.blurAmount;
  } catch {}
};

const fileName = ({ name }) => {
  const suffix = fields.ratio.selectedOptions[0].dataset.name;
  return `${name.replace(/\.[^.]+$/, '')}_${suffix}.png`;
};

const toPng = (source) => new Promise((resolve, reject) => {
  source.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('The image is too large to save.'))), 'image/png');
});

const save = (blob, name) => {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 10000);
};

// Saving a PNG file takes most of the time, so a few workers frame the images side by side.
// Each one holds an image and its frame in memory, hence the limit.
const startWorkers = (most) => {
  if (!window.Worker || !window.OffscreenCanvas || !window.CompressionStream) return [null];
  const wanted = Math.min(most, 4, Math.ceil((navigator.hardwareConcurrency ?? 2) / 2));
  return Array.from({ length: wanted }, () => new Worker('/js/worker.js', { type: 'module' }));
};

const ask = (worker, message) => new Promise((resolve, reject) => {
  worker.onmessage = ({ data }) => (data.error ? reject(new Error(data.error)) : resolve(data));
  worker.onerror = reject;
  worker.postMessage(message);
});

// The page frames what a worker cannot, such as a HEIC file that needs the converter.
// It has one canvas for this, so one image waits for the other.
const scratch = document.createElement('canvas');
let queue = Promise.resolve();
const frameHere = (entry, options) => {
  const result = queue.then(async () => {
    draw(scratch, await open(entry), options);
    const blob = await toPng(scratch);
    return { blob, crc: crc32(new Uint8Array(await blob.arrayBuffer())) };
  });
  queue = result.catch(() => {});
  return result;
};

const downloadAll = async () => {
  const batch = images;
  const options = chosen();
  // Two images of the same name get a number, or one would replace the other.
  const taken = new Set();
  const names = batch.map((entry) => {
    let name = fileName(entry);
    for (let n = 2; taken.has(name); n++) name = fileName(entry).replace(/\.png$/, `_${n}.png`);
    taken.add(name);
    return name;
  });
  const results = [];
  let next = 0;
  let done = 0;
  const lane = async (worker) => {
    while (next < batch.length) {
      const i = next++;
      const entry = batch[i];
      let result;
      if (worker) {
        result = await ask(worker, { blob: entry.blob, settings: options }).catch((reason) => {
          // An error event, not a message, means that the worker itself failed.
          if (reason instanceof Event) worker = null;
        });
      }
      result ??= await frameHere(entry, options).catch(() => null);
      results[i] = result && { name: names[i], ...result };
      downloadAllButton.textContent = `Framed ${++done} of ${batch.length} images`;
    }
  };

  downloadAllButton.disabled = true;
  announce(saveStatus, `Framing ${count(batch.length, 'image')}. This can take a moment.`);
  const workers = startWorkers(batch.length);
  try {
    await Promise.all(workers.map(lane));
    const files = results.filter(Boolean);
    const failed = batch.filter((_, i) => !results[i]).map((entry) => entry.name);
    if (!files.length) throw new Error('No image could be framed.');
    save(zip(files), 'frame_export.zip');
    const problem = failed.length ? ` The browser could not read ${failed.join(', ')}.` : '';
    announce(saveStatus, `Saved ${count(files.length, 'image')} as frame_export.zip.${problem}`);
  } catch (error) {
    console.error(error);
    announce(saveStatus, error instanceof RangeError
      ? 'These images are too large for one ZIP file. Choose fewer at a time.'
      : 'The ZIP file could not be made. Download the images one by one.');
  } finally {
    for (const worker of workers) worker?.terminate();
    downloadAllButton.disabled = false;
    downloadAllButton.textContent = `Download all ${images.length} images (ZIP)`;
  }
};

fileField.addEventListener('change', () => load([...fileField.files]));

// Files may be dropped anywhere on the page. The file field takes a drop by itself.
const hasFiles = (event) => Boolean(event.dataTransfer?.types.includes('Files'));
let dragDepth = 0;
addEventListener('dragenter', (event) => {
  if (!hasFiles(event)) return;
  dragDepth++;
  clearTimeout(timers.get(status));
  status.textContent = 'Drop the images to load them.';
});
addEventListener('dragleave', (event) => {
  if (!hasFiles(event)) return;
  dragDepth = Math.max(0, dragDepth - 1);
  if (!dragDepth) announce(status);
});
addEventListener('dragover', (event) => {
  if (hasFiles(event)) event.preventDefault();
});
addEventListener('drop', (event) => {
  if (!hasFiles(event)) return;
  dragDepth = 0;
  announce(status);
  if (event.target === fileField) return;
  event.preventDefault();
  const dropped = [...event.dataTransfer.files];
  try {
    fileField.files = event.dataTransfer.files;
  } catch {}
  load(dropped);
});

settings.addEventListener('submit', (event) => event.preventDefault());
settings.addEventListener('input', () => {
  describe();
  announce(saveStatus);
  render();
});
settings.addEventListener('change', store);

previousButton.addEventListener('click', () => show(index - 1));
nextButton.addEventListener('click', () => show(index + 1));
// In a field, the arrow keys change its value.
addEventListener('keydown', (event) => {
  if (images.length < 2 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
  if (event.target.closest?.('input, select, textarea')) return;
  if (event.key === 'ArrowLeft') show(index - 1);
  if (event.key === 'ArrowRight') show(index + 1);
});

downloadButton.addEventListener('click', async () => {
  try {
    save(await toPng(canvas), fileName(shown.entry));
  } catch (error) {
    announce(saveStatus, error.message);
  }
});

copyButton.hidden = !(navigator.clipboard?.write && window.ClipboardItem);
copyButton.addEventListener('click', async () => {
  try {
    // Safari takes the image only as a promise that starts with the click.
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': toPng(canvas) })]);
    announce(saveStatus, 'Copied the image.');
  } catch {
    announce(saveStatus, 'The browser did not allow copying. Download the image instead.');
  }
});

downloadAllButton.addEventListener('click', downloadAll);

clearButton.addEventListener('click', () => {
  reset('Removed all images.');
  fileField.focus();
});

restore();
describe();
byId('choose').hidden = false;
byId('no-script').hidden = true;
