import Sound from 'react-native-sound';

Sound.setCategory('Playback');

const SOUND_FILES: Record<string, string> = {
  cancel:       'fuse_cancel.wav',
  fuse_circle:  'fuse_circle.wav',
  fuse_diamond: 'fuse_diamond.wav',
  fuse_star:    'fuse_star.wav',
  bonus:        'fuse_bonus.wav',
  game_over:    'fuse_gameover.wav',
  timer_tick:   'fuse_tick.wav',
};

// 3 instances per sound so rapid taps don't collide with an already-playing player
const POOL_SIZE = 3;

let _enabled = true;
let _pool: Record<string, Sound[]> = {};
let _idx: Record<string, number> = {};
let _music: Sound | null = null;

export function initAudio(): Promise<void> {
  // Release any existing instances so re-calls don't grow the pool unboundedly
  for (const pool of Object.values(_pool)) pool.forEach(s => s.release());
  _pool = {};
  _idx  = {};

  const loads: Promise<void>[] = [];
  for (const [key, file] of Object.entries(SOUND_FILES)) {
    _pool[key] = [];
    _idx[key]  = 0;
    for (let i = 0; i < POOL_SIZE; i++) {
      loads.push(new Promise<void>(resolve => {
        const s = new Sound(file, Sound.MAIN_BUNDLE, err => {
          if (err) console.warn('[audio] load failed:', key, JSON.stringify(err));
          resolve();
        });
        _pool[key].push(s);
      }));
    }
  }
  return Promise.all(loads).then(() => {});
}

export function setSoundEnabled(on: boolean) {
  _enabled = on;
  if (!on) _music?.pause();
  else _music?.play();
}

export function playSound(name: string) {
  if (!_enabled || !_pool[name]?.length) return;
  // Round-robin: pick the next idle instance
  const pool = _pool[name];
  const s = pool[_idx[name]];
  _idx[name] = (_idx[name] + 1) % POOL_SIZE;
  s.setCurrentTime(0);
  s.play();
}

export function startMusic() {
  if (_music) { _music.stop(); _music.release(); _music = null; }
  _music = new Sound('fuse_music.wav', Sound.MAIN_BUNDLE, (err) => {
    if (err || !_music) { console.warn('[audio] music load failed', JSON.stringify(err)); return; }
    _music.setNumberOfLoops(-1);
    _music.setVolume(0.32);
    if (_enabled) _music.play();
  });
}

export function stopMusic() {
  _music?.stop();
  _music?.release();
  _music = null;
}

export function pauseMusic() {
  _music?.pause();
}

export function resumeMusic() {
  if (_enabled) _music?.play();
}
