// Reads the camera data that a caption shows from the EXIF block of a JPEG or HEIC file.

// A JPEG file has the block in its first segments, and a HEIC file has the list of its items
// there, so the head of the file is enough to find the block.
const HEAD = 256 * 1024;

// The bytes that one value of each EXIF type takes.
const SIZES = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 };

// The entries of one directory, by tag. An entry that points outside the data is left out.
const directory = (view, base, offset, little) => {
  const tags = new Map();
  const start = base + offset;
  if (start + 2 > view.byteLength) return tags;
  const entries = view.getUint16(start, little);
  for (let i = 0; i < entries; i++) {
    const at = start + 2 + i * 12;
    if (at + 12 > view.byteLength) break;
    const type = view.getUint16(at + 2, little);
    const count = view.getUint32(at + 4, little);
    const size = (SIZES[type] ?? 0) * count;
    // A value of up to four bytes is in the entry itself. A larger one is at an offset.
    const where = size <= 4 ? at + 8 : base + view.getUint32(at + 8, little);
    if (size && where + size <= view.byteLength) tags.set(view.getUint16(at, little), { type, count, where });
  }
  return tags;
};

// The text or the first number of an entry.
const value = (view, entry, little) => {
  if (!entry) return undefined;
  const { type, count, where } = entry;
  if (type === 2) {
    let text = '';
    for (let i = 0; i < count; i++) {
      const code = view.getUint8(where + i);
      if (!code) break;
      text += String.fromCharCode(code);
    }
    return text.trim();
  }
  if (type === 3) return view.getUint16(where, little);
  if (type === 4) return view.getUint32(where, little);
  if (type === 9) return view.getInt32(where, little);
  if (type === 5) return view.getUint32(where, little) / view.getUint32(where + 4, little);
  if (type === 10) return view.getInt32(where, little) / view.getInt32(where + 4, little);
  return undefined;
};

// The fields of an EXIF block. The view starts at its TIFF header.
const fields = (view) => {
  const little = view.getUint16(0) === 0x4949;
  const main = directory(view, 0, view.getUint32(4, little), little);
  const sub = directory(view, 0, value(view, main.get(0x8769), little) ?? view.byteLength, little);
  const get = (tags, tag) => value(view, tags.get(tag), little);
  return {
    make: get(main, 0x010f),
    model: get(main, 0x0110),
    shutter: get(sub, 0x829a),
    aperture: get(sub, 0x829d),
    iso: get(sub, 0x8827),
    date: get(sub, 0x9003),
    focal: get(sub, 0x920a),
    focal35: get(sub, 0xa405),
    lens: get(sub, 0xa434),
  };
};

// The EXIF block of a JPEG file is the segment before the image data that starts with "Exif".
const jpegBlock = (buffer) => {
  const file = new DataView(buffer);
  for (let at = 2; at + 4 <= file.byteLength;) {
    const marker = file.getUint16(at);
    if ((marker & 0xff00) !== 0xff00 || marker === 0xffda) return null;
    const length = file.getUint16(at + 2);
    if (marker === 0xffe1 && at + 18 <= file.byteLength && file.getUint32(at + 4) === 0x45786966) {
      return new DataView(buffer, at + 10, Math.min(file.byteLength, at + 2 + length) - at - 10);
    }
    at += 2 + length;
  }
  return null;
};

// A HEIC file is made of boxes. A box starts with its size and its name of four letters, and
// may hold more boxes.
const name = (letters) => [...letters].reduce((code, letter) => code * 256 + letter.charCodeAt(0), 0);
const boxes = function* (view, start, end) {
  for (let at = start; at + 8 <= end;) {
    let size = view.getUint32(at);
    let header = 8;
    if (size === 1) {
      // The size did not fit into four bytes, so it follows the name in eight.
      size = Number(view.getBigUint64(at + 8));
      header = 16;
    }
    if (size === 0) size = end - at;
    if (size < header) return;
    yield { type: view.getUint32(at + 4), start: at + header, end: Math.min(end, at + size) };
    at += size;
  }
};
const find = (view, start, end, type) => {
  for (const box of boxes(view, start, end)) if (box.type === type) return box;
  return null;
};
const uint = (view, at, size) => (size === 8 ? Number(view.getBigUint64(at)) : size === 4 ? view.getUint32(at) : 0);

// The meta box lists the items of a HEIC file, and the EXIF block is one of them. The list
// of items gives its number, and the list of places gives where in the file it is.
const heicBlock = async (blob, buffer) => {
  const view = new DataView(buffer);
  const meta = find(view, 0, view.byteLength, name('meta'));
  const items = meta && find(view, meta.start + 4, meta.end, name('iinf'));
  const places = meta && find(view, meta.start + 4, meta.end, name('iloc'));
  if (!items || !places) return null;

  let id;
  // The count of the items is two bytes long in the first version of the list, and then four.
  for (const item of boxes(view, items.start + (view.getUint8(items.start) ? 8 : 6), items.end)) {
    // An entry has the type of its item from version 2, and a number of four bytes from version 3.
    const version = view.getUint8(item.start);
    if (item.type !== name('infe') || version < 2) continue;
    const wide = version > 2 ? 4 : 2;
    if (view.getUint32(item.start + 4 + wide + 2) !== name('Exif')) continue;
    id = wide === 4 ? view.getUint32(item.start + 4) : view.getUint16(item.start + 4);
  }
  if (id === undefined) return null;

  // The sizes of the numbers in the list of places are in its first two bytes.
  const version = view.getUint8(places.start);
  const wide = version < 2 ? 2 : 4;
  const offsetSize = view.getUint8(places.start + 4) >> 4;
  const lengthSize = view.getUint8(places.start + 4) & 15;
  const baseSize = view.getUint8(places.start + 5) >> 4;
  const indexSize = version ? view.getUint8(places.start + 5) & 15 : 0;
  const count = wide === 4 ? view.getUint32(places.start + 6) : view.getUint16(places.start + 6);
  let at = places.start + 6 + wide;
  for (let i = 0; i < count; i++) {
    const item = wide === 4 ? view.getUint32(at) : view.getUint16(at);
    // Method 0 counts the place from the start of the file. The other methods are not read.
    const method = version ? view.getUint16(at + wide) & 15 : 0;
    at += wide + (version ? 2 : 0) + 2;
    const base = uint(view, at, baseSize);
    const extents = view.getUint16(at + baseSize);
    at += baseSize + 2;
    if (item === id) {
      if (method || !extents) return null;
      const offset = base + uint(view, at + indexSize, offsetSize);
      const length = Math.min(uint(view, at + indexSize + offsetSize, lengthSize), HEAD);
      const data = await blob.slice(offset, offset + length).arrayBuffer();
      // The item starts with the count of the bytes before the TIFF header, in four bytes.
      return new DataView(data, 4 + new DataView(data).getUint32(0));
    }
    at += extents * (indexSize + offsetSize + lengthSize);
  }
  return null;
};

const number = (n) => String(Number(n.toFixed(1)));
const positive = (n) => Number.isFinite(n) && n > 0;

// A phone names its lens after itself and repeats the focal length and the aperture, as in
// "iPhone 17 back dual wide camera 5.96mm f/1.6". The caption has all three elsewhere.
const lensName = (lens = '', model = '') => {
  if (!model || !lens.startsWith(model)) return lens;
  const name = lens.slice(model.length).replace(/\s+[\d.]+\s*mm\s+f\/[\d.]+$/i, '').trim();
  return name.charAt(0).toUpperCase() + name.slice(1);
};

// The text of each token of a caption. A token that the file does not have is empty.
const tokens = ({ make, model, shutter, aperture, iso, date, focal, focal35, lens }) => {
  // The model often starts with the maker, as in "Canon EOS R5".
  const maker = make?.split(/\s+/)[0] ?? '';
  const named = model?.toLowerCase().startsWith(maker.toLowerCase());
  // The lens of a small sensor, as in a phone, is known by its 35 mm equivalent: 26mm, not 5.96mm.
  const small = positive(focal35) && (!positive(focal) || focal35 / focal > 2.5);
  const length = small ? focal35 : focal;
  return {
    camera: model ? (maker && !named ? `${maker} ${model}` : model) : '',
    lens: lensName(lens, model),
    focal: positive(length) ? `${number(length)}mm` : '',
    aperture: positive(aperture) ? `f/${number(aperture)}` : '',
    shutter: positive(shutter) ? (shutter >= 0.3 ? `${number(shutter)}s` : `1/${Math.round(1 / shutter)}s`) : '',
    iso: positive(iso) ? `ISO ${iso}` : '',
    date: /^\d{4}:\d\d:\d\d/.test(date) ? date.slice(0, 10).replaceAll(':', '-') : '',
  };
};

// Returns { camera, lens, focal, aperture, shutter, iso, date } as text. A file without
// camera data, or one of another kind, gives empty text for each. The kind is read from the
// first bytes, because the name of a file can be wrong.
export const cameraData = async (blob) => {
  try {
    const head = await blob.slice(0, HEAD).arrayBuffer();
    const start = new DataView(head);
    const block = start.getUint16(0) === 0xffd8 ? jpegBlock(head)
      : start.getUint32(4) === name('ftyp') ? await heicBlock(blob, head)
      : null;
    return tokens(block ? fields(block) : {});
  } catch {
    return tokens({});
  }
};
