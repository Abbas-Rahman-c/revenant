/**
 * Every sound is synthesized with Web Audio, so there are no audio files to license or download.
 * Sound starts muted; nothing plays until the visitor turns it on.
 */
let ctx: AudioContext | null = null;
let enabled = false;

export function setSoundEnabled(on: boolean) {
  enabled = on;
  if (on && !ctx) ctx = new AudioContext();
  if (on) {
    void ctx?.resume();
    startAmbience();
  } else {
    stopAmbience();
  }
  window.dispatchEvent(new CustomEvent("lab:sound", { detail: on }));
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

/**
 * Speak a line. Uses the browser's built-in speech voice as a stand-in until the creature's own
 * text-to-speech model is wired up. With sound off it still "talks": the timing is simulated so
 * the jaw and subtitles move, but nothing plays.
 */
export function speak(text: string, onStart: () => void, onEnd: () => void) {
  const words = text.split(/\s+/).filter(Boolean).length;
  const simulate = () => {
    onStart();
    window.setTimeout(onEnd, Math.max(900, words * 340));
  };
  if (!enabled || !("speechSynthesis" in window)) return simulate();
  const u = new SpeechSynthesisUtterance(text);
  const voices = window.speechSynthesis.getVoices();
  u.voice = voices.find((v) => /en[-_](GB|US)/i.test(v.lang) && /male|daniel|george|david/i.test(v.name)) ?? voices.find((v) => v.lang.startsWith("en")) ?? null;
  u.pitch = 0.45;
  u.rate = 0.82;
  u.onstart = onStart;
  u.onend = onEnd;
  u.onerror = onEnd;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
}

/* ───────── ambience: rain on the window, the room's electrical hum, thunder with each flash ───────── */

let ambience: { stop: () => void } | null = null;

export function isSoundEnabled() {
  return enabled;
}

/** Start the room's ambience. Safe to call repeatedly; it only ever runs once. */
export function startAmbience() {
  const ac = audio();
  if (!ac || ambience) return;
  const master = ac.createGain();
  master.gain.value = 0;
  master.gain.linearRampToValueAtTime(1, ac.currentTime + 3);
  master.connect(ac.destination);

  // rain: looping noise, band-limited, with a slow swell
  const rain = ac.createBufferSource();
  rain.buffer = noiseBuffer(ac, 4);
  rain.loop = true;
  const rainHi = ac.createBiquadFilter();
  rainHi.type = "highpass";
  rainHi.frequency.value = 900;
  const rainLo = ac.createBiquadFilter();
  rainLo.type = "lowpass";
  rainLo.frequency.value = 5200;
  const rainGain = ac.createGain();
  rainGain.gain.value = 0.045;
  const swell = ac.createOscillator();
  swell.frequency.value = 0.07;
  const swellGain = ac.createGain();
  swellGain.gain.value = 0.015;
  swell.connect(swellGain).connect(rainGain.gain);
  rain.connect(rainHi).connect(rainLo).connect(rainGain).connect(master);

  // the hum: mains-like low tones that beat slowly against each other
  const humGain = ac.createGain();
  humGain.gain.value = 0.022;
  const hums = [50, 100.4, 150.2].map((f, i) => {
    const o = ac.createOscillator();
    o.type = i === 0 ? "sine" : "triangle";
    o.frequency.value = f;
    const g = ac.createGain();
    g.gain.value = i === 0 ? 1 : 0.25 / i;
    o.connect(g).connect(humGain);
    return o;
  });
  humGain.connect(master);

  rain.start();
  swell.start();
  hums.forEach((o) => o.start());

  const onThunder = () => playThunder();
  window.addEventListener("lab:thunder", onThunder);
  ambience = {
    stop: () => {
      window.removeEventListener("lab:thunder", onThunder);
      const now = ac.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(master.gain.value, now);
      master.gain.linearRampToValueAtTime(0, now + 0.4);
      [rain, swell, ...hums].forEach((n) => n.stop(now + 0.5));
      ambience = null;
    },
  };
}

export function stopAmbience() {
  ambience?.stop();
}

/** A distant roll of thunder: arrives a moment after the flash, rumbles and fades. */
export function playThunder() {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime + 0.4 + Math.random() * 0.8;
  const src = ac.createBufferSource();
  src.buffer = noiseBuffer(ac, 5);
  const f = ac.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.setValueAtTime(380, t);
  f.frequency.exponentialRampToValueAtTime(70, t + 4.5);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.55, t + 0.25);
  g.gain.exponentialRampToValueAtTime(0.18, t + 1.4);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 4.8);
  src.connect(f).connect(g).connect(ac.destination);
  src.start(t);
}
