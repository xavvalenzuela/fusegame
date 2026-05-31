#!/usr/bin/env node
// Generates all app icons and splash screen assets as PNG files.
// Run: node scripts/generate-icons.js
// Outputs: android/app/src/main/res/mipmap-*/  and  assets/

const zlib = require('zlib');
const fs   = require('fs');
const path = require('path');

// ── PNG encoder ───────────────────────────────────────────────────────────────

function writePNG(filePath, size, rgba) {
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
  const raw = Buffer.alloc((1 + size * 4) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (1 + size * 4)] = 0;
    for (let x = 0; x < size; x++) {
      const s = (y * size + x) * 4, d = y * (1 + size * 4) + 1 + x * 4;
      raw[d] = rgba[s]; raw[d+1] = rgba[s+1]; raw[d+2] = rgba[s+2]; raw[d+3] = rgba[s+3];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  const sig = Buffer.from([137,80,78,71,13,10,26,10]);
  fs.writeFileSync(filePath, Buffer.concat([
    sig, ck('IHDR', ihdr), ck('IDAT', zlib.deflateSync(raw)), ck('IEND', Buffer.alloc(0))
  ]));
}

// ── Drawing ───────────────────────────────────────────────────────────────────

function createBuf(size) { return new Uint8Array(size * size * 4); }

function blend(buf, size, x, y, r, g, b, a) {
  if (x < 0 || x >= size || y < 0 || y >= size) return;
  const i = (y * size + x) * 4;
  if (a >= 255) { buf[i]=r; buf[i+1]=g; buf[i+2]=b; buf[i+3]=255; return; }
  const sa = a/255, da = buf[i+3]/255, oa = sa + da*(1-sa);
  if (oa === 0) return;
  buf[i]   = (r*sa + buf[i]  *da*(1-sa))/oa|0;
  buf[i+1] = (g*sa + buf[i+1]*da*(1-sa))/oa|0;
  buf[i+2] = (b*sa + buf[i+2]*da*(1-sa))/oa|0;
  buf[i+3] = oa*255|0;
}

function radialGrad(buf, size, cx, cy, inner, outer) {
  const maxD = Math.hypot(Math.max(cx, size-cx), Math.max(cy, size-cy));
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const t = Math.min(Math.hypot(x-cx, y-cy)/maxD, 1), i = (y*size+x)*4;
    buf[i]  =inner[0]+(outer[0]-inner[0])*t|0;
    buf[i+1]=inner[1]+(outer[1]-inner[1])*t|0;
    buf[i+2]=inner[2]+(outer[2]-inner[2])*t|0;
    buf[i+3]=255;
  }
}

function solidFill(buf, size, r, g, b) {
  for (let i = 0; i < size*size*4; i+=4) { buf[i]=r; buf[i+1]=g; buf[i+2]=b; buf[i+3]=255; }
}

function glow(buf, size, cx, cy, radius, r, g, b, peak) {
  const x0=Math.max(0,cx-radius|0), x1=Math.min(size-1,(cx+radius)|0);
  const y0=Math.max(0,cy-radius|0), y1=Math.min(size-1,(cy+radius)|0);
  for (let y=y0; y<=y1; y++) for (let x=x0; x<=x1; x++) {
    const d = Math.hypot(x-cx, y-cy);
    if (d > radius) continue;
    const t = d/radius;
    blend(buf, size, x, y, r, g, b, peak*(1-t*t)|0);
  }
}

function star5(cx, cy, outer, inner) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const a = i*Math.PI/5 - Math.PI/2, R = i%2===0 ? outer : inner;
    pts.push([cx + R*Math.cos(a), cy + R*Math.sin(a)]);
  }
  return pts;
}

function fillPoly(buf, size, pts, r, g, b, a) {
  const minY = Math.max(0, Math.floor(Math.min(...pts.map(p=>p[1]))));
  const maxY = Math.min(size-1, Math.ceil(Math.max(...pts.map(p=>p[1]))));
  for (let y = minY; y <= maxY; y++) {
    const xs = [];
    for (let i = 0; i < pts.length; i++) {
      const [ax,ay]=pts[i], [bx,by]=pts[(i+1)%pts.length];
      if ((ay<=y&&by>y)||(by<=y&&ay>y)) xs.push(ax+(y-ay)*(bx-ax)/(by-ay));
    }
    xs.sort((a,b)=>a-b);
    for (let i = 0; i < xs.length-1; i+=2)
      for (let x=Math.max(0,xs[i]|0); x<=Math.min(size-1,xs[i+1]|0); x++)
        blend(buf, size, x, y, r, g, b, a);
  }
}

function drawStar(buf, size, cx, cy, outerR, innerR) {
  // Outer glow
  glow(buf, size, cx, cy, outerR*1.25, 255, 200,  0, 50);
  glow(buf, size, cx, cy, outerR*0.95, 255, 218,  0, 75);
  glow(buf, size, cx, cy, outerR*0.65, 255, 235, 60, 95);
  // Star halo
  fillPoly(buf, size, star5(cx, cy, outerR*1.06, innerR*1.06), 255, 190, 0, 110);
  // Star body (orange-gold)
  fillPoly(buf, size, star5(cx, cy, outerR, innerR), 255, 155, 0, 255);
  // Highlight (brighter gold, offset slightly up)
  fillPoly(buf, size, star5(cx, cy*0.96+(size*0.04*0), outerR*0.78, innerR*0.78), 255, 225, 80, 190);
  // Inner bright core
  fillPoly(buf, size, star5(cx, cy, outerR*0.38, innerR*0.38), 255, 245, 160, 200);
}

// ── Designs ───────────────────────────────────────────────────────────────────

function makeIcon(size) {
  const buf = createBuf(size), c = size/2;
  radialGrad(buf, size, c, c, [58,16,128],[8,2,28]);
  glow(buf, size, c, c, c*0.85, 120, 0, 200, 30);
  drawStar(buf, size, c, c, c*0.40, c*0.165);
  return buf;
}

function makeForeground(size) {
  const buf = createBuf(size), c = size/2, s = size*0.31;
  drawStar(buf, size, c, c, s, s*0.41);
  return buf;
}

function makeBackground(size) {
  const buf = createBuf(size);
  radialGrad(buf, size, size/2, size/2, [45,18,85],[10,2,28]);
  return buf;
}

function makeMonochrome(size) {
  const buf = createBuf(size);
  fillPoly(buf, size, star5(size/2, size/2, size*0.38, size*0.16), 255,255,255,255);
  return buf;
}

function makeSplashLogo(size) {
  // Transparent bg, star centered — will be composited over dark color in layer-list
  const buf = createBuf(size), c = size/2, s = size*0.40;
  drawStar(buf, size, c, c, s, s*0.41);
  return buf;
}

// ── Write files ───────────────────────────────────────────────────────────────

const ANDROID = path.join(__dirname, '../android/app/src/main/res');
const ASSETS  = path.join(__dirname, '../assets');

const ICON_SIZES = [
  ['mipmap-mdpi',    48],
  ['mipmap-hdpi',    72],
  ['mipmap-xhdpi',   96],
  ['mipmap-xxhdpi',  144],
  ['mipmap-xxxhdpi', 192],
];

const SPLASH_SIZES = [
  ['drawable-mdpi',    200],
  ['drawable-hdpi',    300],
  ['drawable-xhdpi',   400],
  ['drawable-xxhdpi',  600],
  ['drawable-xxxhdpi', 800],
];

for (const [dir, size] of ICON_SIZES) {
  const p = path.join(ANDROID, dir);
  // Remove old WebP files so Android uses our PNGs
  for (const f of fs.readdirSync(p)) if (f.endsWith('.webp')) fs.unlinkSync(path.join(p, f));

  writePNG(path.join(p, 'ic_launcher.png'),            size, makeIcon(size));
  writePNG(path.join(p, 'ic_launcher_round.png'),      size, makeIcon(size));
  writePNG(path.join(p, 'ic_launcher_foreground.png'), size, makeForeground(size));
  writePNG(path.join(p, 'ic_launcher_background.png'), size, makeBackground(size));
  writePNG(path.join(p, 'ic_launcher_monochrome.png'), size, makeMonochrome(size));
  console.log(`  ${dir}: ${size}×${size}`);
}

for (const [dir, size] of SPLASH_SIZES) {
  const p = path.join(ANDROID, dir);
  writePNG(path.join(p, 'splashscreen_logo.png'), size, makeSplashLogo(size));
  console.log(`  ${dir}: splash ${size}×${size}`);
}

// 1024×1024 master icon for app stores / app.json
writePNG(path.join(ASSETS, 'icon.png'), 1024, makeIcon(1024));
console.log('  assets/icon.png: 1024×1024');
console.log('Done.');
