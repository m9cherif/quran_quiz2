/**
 * Tiny WebAudio cue player — no audio files, no dependency, no autoplay
 * surprises: every tone is synthesised on demand and only after the student
 * has interacted with the page (which a quiz answer always implies).
 *
 * Muted by default is deliberate for classrooms; the preference is per-device.
 */
const STORAGE_KEY = "quizcast-sound";

type Cue = "correct" | "wrong" | "tick" | "celebrate" | "pop";

let context: AudioContext | null = null;

export function soundEnabled(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "on";
  } catch {
    return false;
  }
}

export function setSoundEnabled(on: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, on ? "on" : "off");
  } catch {
    // ignore storage failures
  }
}

function ctx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!context) context = new Ctor();
  if (context.state === "suspended") void context.resume();
  return context;
}

function tone(freq: number, startAt: number, duration: number, gain = 0.09, type: OscillatorType = "sine") {
  const audio = ctx();
  if (!audio) return;
  const osc = audio.createOscillator();
  const amp = audio.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, audio.currentTime + startAt);
  // Short attack/decay envelope — a raw gate click sounds harsh on phones.
  amp.gain.setValueAtTime(0.0001, audio.currentTime + startAt);
  amp.gain.exponentialRampToValueAtTime(gain, audio.currentTime + startAt + 0.015);
  amp.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + startAt + duration);
  osc.connect(amp).connect(audio.destination);
  osc.start(audio.currentTime + startAt);
  osc.stop(audio.currentTime + startAt + duration + 0.02);
}

/** Play a cue; a no-op when the device is muted or WebAudio is unavailable. */
export function playCue(cue: Cue): void {
  if (!soundEnabled()) return;
  switch (cue) {
    case "correct":
      tone(660, 0, 0.12);
      tone(880, 0.1, 0.18);
      break;
    case "wrong":
      tone(220, 0, 0.18, 0.07, "triangle");
      break;
    case "tick":
      tone(1200, 0, 0.04, 0.04, "square");
      break;
    case "celebrate":
      [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.09, 0.2));
      break;
    case "pop":
      tone(900, 0, 0.06, 0.05);
      break;
  }
}
