// One-off diagnostic: report a PNG's opaque bounding box to detect asymmetric transparent padding.
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

const file = process.argv[2];
const buf = readFileSync(file);

if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a png');

let pos = 8;
let ihdr = null;
const idat = [];
let plte = null;
let trns = null;

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
  else if (type === 'PLTE') plte = Buffer.from(data);
  else if (type === 'tRNS') trns = Buffer.from(data);
  else if (type === 'IEND') break;
  pos += 12 + len;
}

console.log('IHDR', ihdr);
if (ihdr.interlace !== 0) throw new Error('interlaced png not supported');
if (ihdr.bitDepth !== 8) throw new Error('only 8-bit supported, got ' + ihdr.bitDepth);

const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[ihdr.colorType];
const bpp = channels;
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

function alphaAt(x, y) {
  const i = y * stride + x * bpp;
  if (ihdr.colorType === 6) return out[i + 3];
  if (ihdr.colorType === 4) return out[i + 1];
  if (ihdr.colorType === 3 && trns) {
    const idx = out[i];
    return idx < trns.length ? trns[idx] : 255;
  }
  return 255;
}

const THRESHOLD = 8;
let minX = ihdr.width, maxX = -1, minY = ihdr.height, maxY = -1;
for (let y = 0; y < ihdr.height; y++) {
  for (let x = 0; x < ihdr.width; x++) {
    if (alphaAt(x, y) > THRESHOLD) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
}

const padLeft = minX;
const padRight = ihdr.width - 1 - maxX;
const padTop = minY;
const padBottom = ihdr.height - 1 - maxY;
const contentW = maxX - minX + 1;
const contentH = maxY - minY + 1;
const contentCenterX = (minX + maxX) / 2;
const imageCenterX = (ihdr.width - 1) / 2;

console.log({
  imageSize: `${ihdr.width}x${ihdr.height}`,
  imageAspect: (ihdr.width / ihdr.height).toFixed(4),
  opaqueBox: { minX, maxX, minY, maxY, contentW, contentH },
  contentAspect: (contentW / contentH).toFixed(4),
  padLeft,
  padRight,
  padTop,
  padBottom,
  horizontalPadImbalancePx: padLeft - padRight,
  contentCenterX,
  imageCenterX,
  contentOffsetFromCenterPx: +(contentCenterX - imageCenterX).toFixed(2),
  contentOffsetPercentOfWidth: +(((contentCenterX - imageCenterX) / ihdr.width) * 100).toFixed(2),
});
