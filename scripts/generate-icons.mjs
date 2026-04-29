/**
 * generate-icons.mjs
 * 外部依存なしでPWA用PNGアイコンを生成
 */
import { deflateSync } from 'zlib';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, '../artist-app/public');

// ── CRC32 ────────────────────────────────────────────────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c;
  }
  return t;
})();

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (const b of buf) crc = CRC_TABLE[(crc ^ b) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function uint32BE(n) {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(n);
  return b;
}

function pngChunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  const d = Buffer.isBuffer(data) ? data : Buffer.from(data);
  return Buffer.concat([uint32BE(d.length), t, d, uint32BE(crc32(Buffer.concat([t, d])))]);
}

// ── PNG生成（角丸付き） ───────────────────────────────────────────────────────
function createIconPNG(size) {
  const r = 17, g = 24, b = 39;   // #111827 (背景色)
  const radius = Math.round(size * 0.22); // 角丸半径 22%

  // 各ピクセルが角丸の内側かどうかを判定
  function inRect(x, y) {
    const cx = x < radius ? radius : x > size - 1 - radius ? size - 1 - radius : x;
    const cy = y < radius ? radius : y > size - 1 - radius ? size - 1 - radius : y;
    return (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2;
  }

  // RGBAスキャンライン
  const rows = [];
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 4);
    row[0] = 0; // filter: None
    for (let x = 0; x < size; x++) {
      const inside = inRect(x, y);
      const off = 1 + x * 4;
      row[off]     = inside ? r : 0;
      row[off + 1] = inside ? g : 0;
      row[off + 2] = inside ? b : 0;
      row[off + 3] = inside ? 255 : 0; // alpha
    }
    rows.push(row);
  }

  const raw = Buffer.concat(rows);
  const compressed = deflateSync(raw);

  // IHDR: RGBA (color_type=6)
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type: RGBA
  // compression, filter, interlace = 0

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]), // signature
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', compressed),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ── 出力 ─────────────────────────────────────────────────────────────────────
fs.mkdirSync(PUBLIC_DIR, { recursive: true });

const icons = [
  { name: 'icon-192.png',        size: 192 },
  { name: 'icon-512.png',        size: 512 },
  { name: 'apple-touch-icon.png', size: 180 },
];

for (const { name, size } of icons) {
  const buf = createIconPNG(size);
  fs.writeFileSync(path.join(PUBLIC_DIR, name), buf);
  console.log(`✅ ${name} (${size}x${size}) created`);
}

console.log('\n完了！');
