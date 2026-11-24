// A ZIP archive of stored files.

const table = Uint32Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});

// Give the checksum of what came before to continue it.
export const crc32 = (bytes, before = 0) => {
  let crc = before ^ 0xffffffff;
  for (let i = 0; i < bytes.length; i++) crc = table[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
};

const record = (size, write) => {
  const view = new DataView(new ArrayBuffer(size));
  write(view);
  return view;
};

// Takes a list of { name, blob, crc } and returns a Blob. The names must be unique.
export const zip = (files, date = new Date()) => {
  const encoder = new TextEncoder();
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1);
  const day = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  const parts = [];
  const directory = [];
  let offset = 0;

  for (const { name, blob, crc } of files) {
    const path = encoder.encode(name);
    // The fields that the file's own header and its directory entry share.
    const fields = record(26, (view) => {
      view.setUint16(0, 20, true); // The version of ZIP needed to read the file.
      view.setUint16(2, 0x0800, true); // The name is UTF-8.
      view.setUint16(4, 0, true);
      view.setUint16(6, time, true);
      view.setUint16(8, day, true);
      view.setUint32(10, crc, true);
      view.setUint32(14, blob.size, true);
      view.setUint32(18, blob.size, true);
      view.setUint16(22, path.length, true);
    });
    parts.push(record(4, (view) => view.setUint32(0, 0x04034b50, true)), fields, path, blob);
    const start = offset;
    directory.push(
      record(6, (view) => {
        view.setUint32(0, 0x02014b50, true);
        view.setUint16(4, 20, true);
      }),
      fields,
      record(14, (view) => view.setUint32(10, start, true)),
      path,
    );
    offset += 30 + path.length + blob.size;
  }

  const directorySize = directory.reduce((sum, part) => sum + part.byteLength, 0);
  // Larger archives need the ZIP64 format, which this does not write.
  if (files.length > 0xffff || offset + directorySize > 0xffffffff) throw new RangeError('Too large for a ZIP archive.');
  const end = record(22, (view) => {
    view.setUint32(0, 0x06054b50, true);
    view.setUint16(8, files.length, true);
    view.setUint16(10, files.length, true);
    view.setUint32(12, directorySize, true);
    view.setUint32(16, offset, true);
  });
  return new Blob([...parts, ...directory, end], { type: 'application/zip' });
};
