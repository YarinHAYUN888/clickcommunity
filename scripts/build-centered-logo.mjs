// Produces a tight-cropped copy of the logo whose artwork is exactly centred inside the
// canvas. The source PNG carries uneven transparent padding (58px left vs 35px right),
// which makes a perfectly centred <img> still look shifted.
// Lossless: pixels are copied unchanged, only the transparent border is removed.
import { readFileSync, writeFileSync } from 'node:fs';
import { deflateSync, inflateSync } from 'node:zlib';

const SRC = process.argv[2];
const DST = process.argv[3];

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function decodeRgba(file) {
  const buf = readFileSync(file);
  let pos = 8;
  let ihdr = null;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      ihdr = {
        width: data.readUInt32BE(0),
        height: data.readUInt32BE(4),
        bitDepth: data[8],
        colorType: data[9],
        interlace: data[12],
      };
    } else if (type === 'IDAT') idat.push(Buffer.from(data));
    else if (type === 'IEND') break;
    pos += 12 + len;
  }
  if (ihdr.colorType !== 6 || ihdr.bitDepth !== 8 || ihdr.interlace !== 0) {
    throw new Error('expected non-interlaced 8-bit RGBA source');
  }
  const bpp = 4;
  const stride = ihdr.width * bpp;
  const raw = inflateSync(Buffer.concat(idat));
  const out = Buffer.alloc(ihdr.height * stride);
  let rp = 0;
  for (let y = 0; y < ihdr.height; y++) {
    const filter = raw[rp++];
    const line = raw.subarray(rp, rp + stride);
    rp += stride;
    const cur = out.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0;
      const b = prev ? prev[x] : 0;
      const c = prev && x >= bpp ? prev[x - bpp] : 0;
      let v = line[x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      cur[x] = v & 0xff;
    }
  }
  return { width: ihdr.width, height: ihdr.height, stride, data: out };
}

function encodeRgba(width, height, pixels) {
  const bpp = 4;
  const stride = width * bpp;
  const rows = [];
  for (let y = 0; y < height; y++) {
    const cur = pixels.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? pixels.subarray((y - 1) * stride, y * stride) : Buffer.alloc(stride);
    let best = null;
    for (let f = 0; f < 5; f++) {
      const line = Buffer.alloc(stride + 1);
      line[0] = f;
      let score = 0;
      for (let x = 0; x < stride; x++) {
        const a = x >= bpp ? cur[x - bpp] : 0;
        const b = prev[x];
        const c = x >= bpp ? prev[x - bpp] : 0;
        let v;
        if (f === 0) v = cur[x];
        else if (f === 1) v = cur[x] - a;
        else if (f === 2) v = cur[x] - b;
        else if (f === 3) v = cur[x] - ((a + b) >> 1);
        else {
          const p = a + b - c;
          const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
          v = cur[x] - (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
        }
        v &= 0xff;
        line[x + 1] = v;
        score += v < 128 ? v : 256 - v;
      }
      if (!best || score < best.score) best = { score, line };
    }
    rows.push(best.line);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(Buffer.concat(rows), { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const img = decodeRgba(SRC);

const THRESHOLD = 8;
let minX = img.width, maxX = -1, minY = img.height, maxY = -1;
for (let y = 0; y < img.height; y++) {
  for (let x = 0; x < img.width; x++) {
    if (img.data[y * img.stride + x * 4 + 3] > THRESHOLD) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
}

const w = maxX - minX + 1;
const h = maxY - minY + 1;
const cropped = Buffer.alloc(w * h * 4);
for (let y = 0; y < h; y++) {
  img.data.copy(
    cropped,
    y * w * 4,
    (minY + y) * img.stride + minX * 4,
    (minY + y) * img.stride + (maxX + 1) * 4,
  );
}

writeFileSync(DST, encodeRgba(w, h, cropped));

console.log({
  source: `${img.width}x${img.height}`,
  sourcePadding: {
    left: minX,
    right: img.width - 1 - maxX,
    top: minY,
    bottom: img.height - 1 - maxY,
  },
  output: `${w}x${h}`,
  outputAspect: +(w / h).toFixed(6),
  // Rendered artwork size the old asset produced at height 180, so the visual size is unchanged.
  equivalentRenderAtOldHeight180: {
    width: +((w * 180) / img.height).toFixed(2),
    height: +((h * 180) / img.height).toFixed(2),
  },
});
