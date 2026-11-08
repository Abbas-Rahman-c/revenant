/**
 * Every sound is synthesized with Web Audio, so there are no audio files to license or download.
 * Sound starts muted; nothing plays until the visitor turns it on.
 */
let ctx: AudioContext | null = null;
let enabled = false;

export function setSoundEnabled(on: boolean) {
  enabled = on;
  if (on && !ctx) ctx = new AudioContext();
  if (on) void ctx?.resume();
}

function audio() {
  return enabled ? ctx : null;
}

function noiseBuffer(ac: AudioContext, seconds: number) {
  const buf = ac.createBuffer(1, ac.sampleRate * seconds, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

/** A short wet "thwip" as a stitch pulls tight. */
export function playStitch() {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime;
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = "triangle";
  o.frequency.setValueAtTime(900, t);
  o.frequency.exponentialRampToValueAtTime(260, t + 0.09);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.12, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
  o.connect(g).connect(ac.destination);
  o.start(t);
  o.stop(t + 0.14);
}

/** The heavy clack of a knife switch closing. */
export function playClack() {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime;
  const src = ac.createBufferSource();
  src.buffer = noiseBuffer(ac, 0.08);
  const f = ac.createBiquadFilter();
  f.type = "bandpass";
  f.frequency.value = 1800;
  const g = ac.createGain();
  g.gain.setValueAtTime(0.5, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
  src.connect(f).connect(g).connect(ac.destination);
  src.start(t);
}

/** Rising coil hum while the parts load. Returns a stop function. */
export function playCharge(seconds: number) {
  const ac = audio();
  if (!ac) return () => {};
  const t = ac.currentTime;
  const o = ac.createOscillator();
  const o2 = ac.createOscillator();
  const g = ac.createGain();
  o.type = "sawtooth";
  o2.type = "square";
  o.frequency.setValueAtTime(55, t);
  o.frequency.exponentialRampToValueAtTime(220, t + seconds);
  o2.frequency.setValueAtTime(110.5, t);
  o2.frequency.exponentialRampToValueAtTime(441, t + seconds);
  const f = ac.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.setValueAtTime(300, t);
  f.frequency.exponentialRampToValueAtTime(2400, t + seconds);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.06, t + 0.3);
  o.connect(f);
  o2.connect(f);
  f.connect(g).connect(ac.destination);
  o.start(t);
  o2.start(t);
  return () => {
    const now = ac.currentTime;
    g.gain.cancelScheduledValues(now);
    g.gain.setValueAtTime(g.gain.value, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);
    o.stop(now + 0.2);
    o2.stop(now + 0.2);
  };
}

/** A crack of lightning with a rolling tail. */
export function playZap() {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime;
  const src = ac.createBufferSource();
  src.buffer = noiseBuffer(ac, 1.6);
  const f = ac.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.setValueAtTime(6000, t);
  f.frequency.exponentialRampToValueAtTime(180, t + 1.4);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.7, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 1.5);
  src.connect(f).connect(g).connect(ac.destination);
  src.start(t);
}

/** One heartbeat: lub, then dub. */
export function playHeartbeat() {
  const ac = audio();
  if (!ac) return;
  const beat = (at: number, freq: number, vol: number) => {
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(freq, at);
    o.frequency.exponentialRampToValueAtTime(freq * 0.6, at + 0.12);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(vol, at + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.16);
    o.connect(g).connect(ac.destination);
    o.start(at);
    o.stop(at + 0.2);
  };
  const t = ac.currentTime;
  beat(t, 70, 0.4);
  beat(t + 0.18, 58, 0.28);
}
