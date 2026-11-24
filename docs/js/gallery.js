// Draws each style on a sample image, for the About page. The images are drawn by the same
// code as on the home page, so the gallery always shows the styles as they are.

import { cameraData } from './exif.js';
import { draw, prepare, read } from './frame.js';

const gallery = document.getElementById('gallery');

// What each sample image shows, for a reader who does not see it.
const SAMPLES = {
  boat: 'A red fishing boat in a harbor.',
  bus: 'A city bus at a station at night.',
  lake: 'A jetty on a lake, with mountains behind it.',
  lighthouse: 'A lighthouse and a street lamp by the sea.',
  snow: 'A valley between mountains in the snow.',
  sunset: 'A lighthouse against an orange sky after sunset.',
};

// An image is fetched and read once, with its camera data.
const loaded = new Map();
const sample = (name) => {
  if (!loaded.has(name)) {
    loaded.set(name, fetch(new URL(`../about/samples/${name}.jpg`, import.meta.url)).then(async (response) => {
      if (!response.ok) throw new Error(`The sample image ${name} did not load.`);
      const blob = await response.blob();
      return Promise.all([read(blob), cameraData(blob)]);
    }));
  }
  return loaded.get(name);
};

// One canvas draws all of them in turn. Each result is kept as a picture, which takes much
// less memory than a canvas for each.
const canvas = document.createElement('canvas');
const show = async () => {
  for (const figure of gallery.querySelectorAll('figure')) {
    const { style, sample: name, caption = '' } = figure.dataset;
    const settings = { ratio: 'original', border: 0, background: 'color', color: '#000000', blur: 0, style, caption };
    const [[image, values]] = await Promise.all([sample(name), prepare(settings)]);
    const { width, height } = draw(canvas, image, settings, { ...values, frame: '17' });
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
    const picture = new Image(width, height);
    picture.alt = SAMPLES[name];
    picture.src = URL.createObjectURL(blob);
    figure.prepend(picture);
  }
  canvas.width = 0;
  canvas.height = 0;
  gallery.hidden = false;
};

// The gallery is drawn when the reader comes near it, and not for one who never does.
const start = document.getElementById('style');
const watcher = new IntersectionObserver((entries) => {
  if (!entries.some((entry) => entry.isIntersecting)) return;
  watcher.disconnect();
  show().catch((error) => console.error(error));
}, { rootMargin: '300px' });
watcher.observe(start);
