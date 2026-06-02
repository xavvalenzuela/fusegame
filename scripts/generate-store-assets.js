#!/usr/bin/env node
// Generates Play Store assets: 512×512 icon + 3 feature graphic options (1024×500).
// Run: node scripts/generate-store-assets.js

const zlib = require('zlib');
const fs   = require('fs');
const path = require('path');

// ── PNG encoder ───────────────────────────────────────────────────────────────
function writePNG(filePath, w, h, rgba) {
  function crc(buf) {
    let c = 0xFFFFFFFF;
    for (const b of buf) { c ^= b; for (let i = 0; i < 8; i++) c = (c >>> 1) ^ (c & 1 ? 0xEDB88320 : 0); }
    return (c ^ 0xFFFFFFFF) >>> 0;
  }
  function ck(type, data) {
    const t = Buffer.from(type);
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const cval = Buffer.alloc(4); cval.writeUInt32BE(crc(Buffer.concat([t, data])));
    return Buffer.concat([len, t, data, cval]);
  }
  const raw = Buffer.alloc((1 + w * 4) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w * 4)] = 0;
    for (let x = 0; x < w; x++) {
      const s = (y * w + x) * 4, d = y * (1 + w * 4) + 1 + x * 4;
      raw[d] = rgba[s]; raw[d+1] = rgba[s+1]; raw[d+2] = rgba[s+2]; raw[d+3] = rgba[s+3];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  const sig = Buffer.from([137,80,78,71,13,10,26,10]);
  fs.writeFileSync(filePath, Buffer.concat([
    sig, ck('IHDR', ihdr), ck('IDAT', zlib.deflateSync(raw)), ck('IEND', Buffer.alloc(0))
  ]));
}

// ── Drawing helpers ───────────────────────────────────────────────────────────
function createBuf(w, h) { return new Uint8Array(w * h * 4); }

function blend(buf, w, x, y, r, g, b, a) {
  if (x < 0 || x >= w || y < 0) return;
  const i = (y * w + x) * 4;
  if (i + 3 >= buf.length) return;
  if (a >= 255) { buf[i]=r; buf[i+1]=g; buf[i+2]=b; buf[i+3]=255; return; }
  const sa = a/255, da = buf[i+3]/255, oa = sa + da*(1-sa);
  if (oa === 0) return;
  buf[i]   = (r*sa + buf[i]  *da*(1-sa))/oa|0;
  buf[i+1] = (g*sa + buf[i+1]*da*(1-sa))/oa|0;
  buf[i+2] = (b*sa + buf[i+2]*da*(1-sa))/oa|0;
  buf[i+3] = oa*255|0;
}

function radialGrad(buf, w, h, cx, cy, inner, outer) {
  const maxD = Math.hypot(Math.max(cx, w-cx), Math.max(cy, h-cy));
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const t = Math.min(Math.hypot(x-cx, y-cy)/maxD, 1), i = (y*w+x)*4;
    buf[i]   = inner[0]+(outer[0]-inner[0])*t|0;
    buf[i+1] = inner[1]+(outer[1]-inner[1])*t|0;
    buf[i+2] = inner[2]+(outer[2]-inner[2])*t|0;
    buf[i+3] = 255;
  }
}

function glow(buf, w, h, cx, cy, radius, r, g, b, peak) {
  const x0=Math.max(0,cx-radius|0), x1=Math.min(w-1,(cx+radius)|0);
  const y0=Math.max(0,cy-radius|0), y1=Math.min(h-1,(cy+radius)|0);
  for (let y=y0; y<=y1; y++) for (let x=x0; x<=x1; x++) {
    const d = Math.hypot(x-cx, y-cy);
    if (d > radius) continue;
    blend(buf, w, x, y, r, g, b, peak*(1-d/radius*d/radius)|0);
  }
}

function star5pts(cx, cy, outer, inner) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const a = i*Math.PI/5 - Math.PI/2, R = i%2===0 ? outer : inner;
    pts.push([cx + R*Math.cos(a), cy + R*Math.sin(a)]);
  }
  return pts;
}

function fillPoly(buf, w, h, pts, r, g, b, a) {
  const minY = Math.max(0, Math.floor(Math.min(...pts.map(p=>p[1]))));
  const maxY = Math.min(h-1, Math.ceil(Math.max(...pts.map(p=>p[1]))));
  for (let y = minY; y <= maxY; y++) {
    const xs = [];
    for (let i = 0; i < pts.length; i++) {
      const [ax,ay]=pts[i], [bx,by]=pts[(i+1)%pts.length];
      if ((ay<=y&&by>y)||(by<=y&&ay>y)) xs.push(ax+(y-ay)*(bx-ax)/(by-ay));
    }
    xs.sort((a,b)=>a-b);
    for (let i = 0; i < xs.length-1; i+=2)
      for (let x=Math.max(0,xs[i]|0); x<=Math.min(w-1,xs[i+1]|0); x++)
        blend(buf, w, x, y, r, g, b, a);
  }
}

function drawStar(buf, w, h, cx, cy, outerR, innerR) {
  glow(buf, w, h, cx, cy, outerR*1.5,  255, 160,  0, 35);
  glow(buf, w, h, cx, cy, outerR*1.0,  255, 210,  0, 65);
  glow(buf, w, h, cx, cy, outerR*0.65, 255, 235, 60, 90);
  fillPoly(buf, w, h, star5pts(cx, cy, outerR*1.06, innerR*1.06), 255, 190, 0, 110);
  fillPoly(buf, w, h, star5pts(cx, cy, outerR, innerR),           255, 155, 0, 255);
  fillPoly(buf, w, h, star5pts(cx, cy, outerR*0.78, innerR*0.78), 255, 225, 80, 190);
  fillPoly(buf, w, h, star5pts(cx, cy, outerR*0.38, innerR*0.38), 255, 245, 160, 200);
}

// ── Bitmap font (5×7) ─────────────────────────────────────────────────────────
const FONT = {
  'S': ['01110','10001','10000','01110','00001','10001','01110'],
  'T': ['11111','00100','00100','00100','00100','00100','00100'],
  'A': ['01110','10001','10001','11111','10001','10001','10001'],
  'R': ['11110','10001','10001','11110','10010','10001','10001'],
  'F': ['11111','10000','10000','11110','10000','10000','10000'],
  'U': ['10001','10001','10001','10001','10001','10001','01110'],
  'E': ['11111','10000','10000','11110','10000','10000','11111'],
  'B': ['11110','10001','10001','11110','10001','10001','11110'],
  'C': ['01110','10001','10000','10000','10000','10001','01110'],
  'H': ['10001','10001','10001','11111','10001','10001','10001'],
  'I': ['01110','00100','00100','00100','00100','00100','01110'],
  'N': ['10001','11001','10101','10011','10001','10001','10001'],
  'O': ['01110','10001','10001','10001','10001','10001','01110'],
  'P': ['11110','10001','10001','11110','10000','10000','10000'],
  'D': ['11100','10010','10001','10001','10001','10010','11100'],
  'K': ['10001','10010','10100','11000','10100','10010','10001'],
  'L': ['10000','10000','10000','10000','10000','10000','11111'],
  'M': ['10001','11011','10101','10001','10001','10001','10001'],
  'V': ['10001','10001','10001','10001','01010','01010','00100'],
  'W': ['10001','10001','10001','10101','10101','11011','10001'],
  'X': ['10001','01010','01010','00100','01010','01010','10001'],
  'Y': ['10001','10001','01010','00100','00100','00100','00100'],
  '0': ['01110','10001','10011','10101','11001','10001','01110'],
  '6': ['01110','10000','10000','11110','10001','10001','01110'],
  ' ': ['00000','00000','00000','00000','00000','00000','00000'],
  '.': ['00000','00000','00000','00000','00000','00000','00100'],
};

function textWidth(text, scale) {
  return text.length * 7 * scale - 2 * scale;
}

function drawText(buf, w, h, text, x0, y0, scale, r, g, b, a) {
  let x = x0;
  for (const ch of text.toUpperCase()) {
    const glyph = FONT[ch] || FONT[' '];
    for (let row = 0; row < 7; row++) {
      for (let col = 0; col < 5; col++) {
        if (glyph[row][col] === '1') {
          for (let dy = 0; dy < scale; dy++)
            for (let dx = 0; dx < scale; dx++)
              blend(buf, w, x + col*scale + dx, y0 + row*scale + dy, r, g, b, a);
        }
      }
    }
    x += 7 * scale;
  }
}

// ── Feature graphics (1024×500) ───────────────────────────────────────────────
const FW = 1024, FH = 500;

// Option 1: Star left, "STAR / FUSE" stacked right — dark purple
function makeFeature1() {
  const buf = createBuf(FW, FH);
  radialGrad(buf, FW, FH, FW*0.28, FH*0.5, [62,14,130],[7,1,22]);
  glow(buf, FW, FH, FW*0.28, FH*0.5, 220, 100, 20, 200, 22);
  drawStar(buf, FW, FH, FW*0.28, FH*0.5, 175, 72);

  const scale = 16, textH = 7*scale;
  // Center the text block in the right half
  const rightStart = FW * 0.52 | 0;
  const rightWidth = FW - rightStart - 20;
  const tw = textWidth('STAR', scale);
  const tx = rightStart + (rightWidth - tw) / 2 | 0;
  const ty1 = (FH/2 - textH - 14) | 0;
  const ty2 = (FH/2 + 14) | 0;

  // Gold divider line between STAR and FUSE
  const lineY = FH/2 | 0;
  for (let x = tx; x < tx + tw; x++)
    blend(buf, FW, x, lineY, 255, 200, 0, 80);

  drawText(buf, FW, FH, 'STAR', tx+3, ty1+3, scale, 0, 0, 0, 120);
  drawText(buf, FW, FH, 'FUSE', tx+3, ty2+3, scale, 0, 0, 0, 120);
  drawText(buf, FW, FH, 'STAR', tx, ty1, scale, 255, 220, 0, 255);
  drawText(buf, FW, FH, 'FUSE', tx, ty2, scale, 255, 200, 40, 255);

  const ts = 4, tag = 'FUSE YOUR WAY';
  const tagW = textWidth(tag, ts);
  const tagX = rightStart + (rightWidth - tagW) / 2 | 0;
  drawText(buf, FW, FH, tag, tagX, ty2 + textH + 18, ts, 200, 170, 255, 160);
  return buf;
}

// Option 2: Star centered top, "STARFUSE" large text below — cosmic glow
function makeFeature2() {
  const buf = createBuf(FW, FH);
  radialGrad(buf, FW, FH, FW*0.5, FH*0.36, [55,10,118],[6,1,20]);
  glow(buf, FW, FH, FW*0.5, FH*0.34, 300, 120, 30, 200, 18);
  glow(buf, FW, FH, FW*0.5, FH*0.34, 180, 200, 90,  20, 28);
  drawStar(buf, FW, FH, FW*0.5, FH*0.34, 162, 67);

  const scale = 16;
  const tw = textWidth('STARFUSE', scale);
  const tx = (FW - tw) / 2 | 0;
  const ty = FH * 0.66 | 0;

  glow(buf, FW, FH, FW*0.5, ty + 7*scale/2, 220, 255, 180, 0, 16);
  drawText(buf, FW, FH, 'STARFUSE', tx+3, ty+3, scale, 0, 0, 0, 130);
  drawText(buf, FW, FH, 'STARFUSE', tx, ty, scale, 255, 215, 0, 255);

  const ts = 4, tag = '60 SECONDS. INFINITE CHAINS.';
  const tw2 = textWidth(tag, ts);
  drawText(buf, FW, FH, tag, Math.max(10, (FW-tw2)/2|0), ty + 7*scale + 14, ts, 200, 175, 255, 155);
  return buf;
}

// Option 3: "STAR / FUSE" bold left, large star burst right — high contrast
function makeFeature3() {
  const buf = createBuf(FW, FH);
  radialGrad(buf, FW, FH, FW*0.72, FH*0.5, [68,15,145],[5,1,16]);
  glow(buf, FW, FH, FW*0.72, FH*0.5, 280, 160, 60, 0, 28);
  glow(buf, FW, FH, FW*0.72, FH*0.5, 160, 255, 155, 0, 38);
  drawStar(buf, FW, FH, FW*0.72, FH*0.5, 190, 78);

  const scale = 20, textH = 7*scale;
  const tx = 55;
  const ty1 = (FH/2 - textH - 14) | 0;
  const ty2 = (FH/2 + 14) | 0;

  drawText(buf, FW, FH, 'STAR', tx+4, ty1+4, scale, 0, 0, 0, 140);
  drawText(buf, FW, FH, 'FUSE', tx+4, ty2+4, scale, 0, 0, 0, 140);
  drawText(buf, FW, FH, 'STAR', tx, ty1, scale, 255, 255, 255, 255);
  drawText(buf, FW, FH, 'FUSE', tx, ty2, scale, 255, 210, 20, 255);

  const ts = 4, tag = 'BEAT THE CLOCK. TOP THE BOARD.';
  drawText(buf, FW, FH, tag, tx, ty2 + textH + 18, ts, 200, 175, 255, 165);
  return buf;
}

// ── 512×512 icon ──────────────────────────────────────────────────────────────
function makeIcon512() {
  const size = 512, c = size/2;
  const buf = createBuf(size, size);
  radialGrad(buf, size, size, c, c, [58,16,128],[8,2,28]);
  glow(buf, size, size, c, c, c*0.85, 120, 0, 200, 30);
  drawStar(buf, size, size, c, c, c*0.40, c*0.165);
  return buf;
}

// ── Write files ───────────────────────────────────────────────────────────────
const ASSETS = path.join(__dirname, '../assets');

writePNG(path.join(ASSETS, 'icon-512.png'),   512, 512,   makeIcon512());
console.log('  assets/icon-512.png: 512×512');

writePNG(path.join(ASSETS, 'feature-1.png'),  FW, FH, makeFeature1());
console.log('  assets/feature-1.png: Star left, text right');

writePNG(path.join(ASSETS, 'feature-2.png'),  FW, FH, makeFeature2());
console.log('  assets/feature-2.png: Star centered, STARFUSE below');

writePNG(path.join(ASSETS, 'feature-3.png'),  FW, FH, makeFeature3());
console.log('  assets/feature-3.png: Bold text left, star burst right');

console.log('Done.');
