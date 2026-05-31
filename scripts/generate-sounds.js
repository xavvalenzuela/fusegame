#!/usr/bin/env node
// Generates all game sound effects and music as WAV files.
// Run: node scripts/generate-sounds.js
// Output: android/app/src/main/res/raw/*.wav

const fs = require('fs');
const path = require('path');

const SR = 44100;
const OUT_DIR = path.join(__dirname, '../android/app/src/main/res/raw');

// ─── WAV encoding ──────────────────────────────────────────────────────────

function encodeWAV(samples) {
  const n = samples.length;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0, 'ascii');
  buf.writeUInt32LE(36 + n * 2, 4);
  buf.write('WAVE', 8, 'ascii');
  buf.write('fmt ', 12, 'ascii');
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);  // PCM
  buf.writeUInt16LE(1, 22);  // mono
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 2, 28);
  buf.writeUInt16LE(2, 32);  // block align
  buf.writeUInt16LE(16, 34); // bits per sample
  buf.write('data', 36, 'ascii');
  buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    buf.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(samples[i] * 32767))), 44 + i * 2);
  }
  return buf;
}

// ─── Synthesis primitives ──────────────────────────────────────────────────

function env(t, dur, atk, rel) {
  if (t < atk) return t / atk;
  if (t > dur - rel) return Math.max(0, (dur - t) / rel);
  return 1;
}

function tone(freq, dur, vol = 0.7, atk = 0.006, rel = 0.06) {
  const n = Math.ceil(SR * dur);
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    out[i] = Math.sin(2 * Math.PI * freq * (i / SR)) * env(i / SR, dur, atk, rel) * vol;
  }
  return Array.from(out);
}

function sweep(f0, f1, dur, vol = 0.65) {
  const n = Math.ceil(SR * dur);
  const out = [];
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const freq = f0 + (f1 - f0) * (i / n);
    phase += (2 * Math.PI * freq) / SR;
    out.push(Math.sin(phase) * env(t, dur, 0.006, 0.08) * vol);
  }
  return out;
}

function silence(dur) {
  return new Array(Math.ceil(SR * dur)).fill(0);
}

function concat(...tracks) {
  return [].concat(...tracks);
}

function mix(...tracks) {
  const len = Math.max(...tracks.map(t => t.length));
  const out = new Array(len).fill(0);
  for (const track of tracks) {
    for (let i = 0; i < track.length; i++) out[i] += track[i];
  }
  const peak = Math.max(...out.map(Math.abs), 0.001);
  const scale = peak > 0.9 ? 0.9 / peak : 1;
  return out.map(s => s * scale);
}

function arp(freqs, noteDur, vol = 0.6) {
  return concat(...freqs.map(f => concat(tone(f, noteDur * 0.82, vol, 0.003, 0.04), silence(noteDur * 0.18))));
}

// Bell tone: sharp attack, exponential decay, inharmonic partials (wind chime / handbell quality)
function bell(freq, duration, vol = 0.55) {
  const n = Math.ceil(SR * duration);
  const out = new Array(n).fill(0);
  // Partials: [frequency ratio, relative amplitude, decay rate]
  // 2.756× is the characteristic inharmonic "nominal" partial of real bells
  const partials = [
    [1.000, 1.00, 5.5],
    [2.000, 0.35, 7.0],
    [2.756, 0.40, 8.5],
    [5.404, 0.15, 14.0],
  ];
  for (const [ratio, amp, decay] of partials) {
    const f = freq * ratio;
    if (f > 20000) continue;
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      const atk = Math.min(t / 0.002, 1.0); // 2ms sharp attack
      out[i] += Math.sin(2 * Math.PI * f * t) * atk * Math.exp(-decay * t) * amp * vol;
    }
  }
  return out;
}

// Overlapping bells at staggered offsets — wind chime cascade
function windChime(freqs, gapSec, bellDur, vol = 0.6) {
  const totalDur = gapSec * (freqs.length - 1) + bellDur;
  const n = Math.ceil(SR * totalDur);
  const out = new Array(n).fill(0);
  freqs.forEach((freq, i) => {
    const start = Math.floor(i * gapSec * SR);
    const b = bell(freq, bellDur, vol);
    for (let j = 0; j < b.length && start + j < n; j++) out[start + j] += b[j];
  });
  const peak = Math.max(...out.map(Math.abs), 0.001);
  const scale = peak > 0.88 ? 0.88 / peak : 1;
  return out.map(s => s * scale);
}

// ─── Sound definitions ─────────────────────────────────────────────────────

const A2 = 110, A3 = 220, C4 = 261.6, D4 = 293.7, E4 = 329.6, G4 = 392, A4 = 440;
const C5 = 523.3, E5 = 659.3, G5 = 784.0, A5 = 880, C6 = 1046.5, E6 = 1318.5;

const SOUNDS = {
  fuse_select: tone(A5, 0.048, 0.42, 0.002, 0.038),
  fuse_cancel: mix(tone(D4 * 0.95, 0.09, 0.28, 0.005, 0.07), tone(A3 * 0.9, 0.09, 0.18, 0.005, 0.07)),
  fuse_circle: sweep(A4, E5, 0.11, 0.62),
  fuse_diamond: mix(sweep(A4, A5, 0.16, 0.55), concat(silence(0.05), tone(A5, 0.1, 0.18, 0.008, 0.07))),

  // 3-note bright arpeggio: quick, light, upbeat
  fuse_star: arp([E5, A5, C6], 0.058, 0.52),

  // 5-note ascending shimmer + soft tail note
  fuse_bonus: mix(
    arp([A4, C5, E5, A5, C6], 0.052, 0.44),
    concat(silence(0.13), tone(C6, 0.22, 0.20, 0.006, 0.18)),
  ),

  fuse_gameover: concat(
    tone(A4, 0.17, 0.58, 0.005, 0.05), silence(0.025),
    tone(E4, 0.17, 0.52, 0.005, 0.05), silence(0.025),
    tone(C4, 0.17, 0.46, 0.005, 0.05), silence(0.025),
    tone(A3, 0.45, 0.42, 0.005, 0.38),
  ),
  fuse_tick: tone(E5, 0.052, 0.36, 0.001, 0.045),
};

// ─── Background music ──────────────────────────────────────────────────────

function makeMusic() {
  const melody = [A3, C4, D4, E4, G4, A4, G4, E4, A3, C4, E4, G4, A4, E5, A4, E4];
  const nd = 2.0 / melody.length;
  const melTrack = concat(...melody.map(f =>
    concat(tone(f, nd * 0.83, 0.20, 0.004, 0.025), silence(nd * 0.17))
  ));
  const bassTrack = concat(...Array.from({ length: 4 }, () =>
    concat(tone(A2, 0.28, 0.26, 0.008, 0.2), silence(0.22))
  ));
  const padTrack = mix(
    tone(A2, 2.0, 0.055, 0.12, 0.35),
    tone(A3, 2.0, 0.045, 0.12, 0.35),
    tone(E4, 2.0, 0.035, 0.12, 0.35),
  );
  return mix(melTrack, bassTrack, padTrack);
}

// ─── Write files ───────────────────────────────────────────────────────────

fs.mkdirSync(OUT_DIR, { recursive: true });

for (const [name, samples] of Object.entries(SOUNDS)) {
  const outPath = path.join(OUT_DIR, `${name}.wav`);
  fs.writeFileSync(outPath, encodeWAV(samples));
  console.log(`  wrote ${name}.wav (${(samples.length / SR * 1000).toFixed(0)}ms)`);
}

const musicSamples = makeMusic();
fs.writeFileSync(path.join(OUT_DIR, 'fuse_music.wav'), encodeWAV(musicSamples));
console.log(`  wrote fuse_music.wav (${(musicSamples.length / SR * 1000).toFixed(0)}ms)`);

console.log('Done.');
