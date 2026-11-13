// Sound Synthesizer & Vibration Engine for SIM-ALKES UPTD RSUD LAMADDUKELLENG
// Uses Web Audio API without requiring external audio files

let audioCtx: AudioContext | null = null;
let isAudioUnlocked = false;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function unlockAudio() {
  const ctx = getAudioContext();
  if (ctx && ctx.state === 'suspended') {
    ctx.resume().then(() => {
      isAudioUnlocked = true;
    }).catch(() => {});
  } else {
    isAudioUnlocked = true;
  }
}

// Play single tone helper
function playTone(
  ctx: AudioContext,
  freq: number,
  startTime: number,
  duration: number,
  type: OscillatorType = 'sine',
  gainPeak = 0.35
) {
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);

    gain.gain.setValueAtTime(0.001, startTime);
    gain.gain.exponentialRampToValueAtTime(gainPeak, startTime + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(startTime);
    osc.stop(startTime + duration + 0.05);
  } catch (e) {
    // ignore
  }
}

/**
 * Play high-urgency alarm for new Incoming Repair Request (Laporan Kerusakan Alkes)
 */
export function playEmergencyReportSound() {
  // Trigger Phone Vibration
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    try {
      navigator.vibrate([250, 100, 250, 100, 400, 100, 400]);
    } catch (e) {}
  }

  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    // Multi-tone urgent hospital telemetry alarm
    playTone(ctx, 880, now, 0.15, 'triangle', 0.4);       // A5
    playTone(ctx, 1174.66, now + 0.18, 0.15, 'triangle', 0.45); // D6
    playTone(ctx, 1396.91, now + 0.36, 0.25, 'sine', 0.5);     // F6

    // Repeat echo beep
    playTone(ctx, 880, now + 0.65, 0.15, 'triangle', 0.4);
    playTone(ctx, 1174.66, now + 0.83, 0.15, 'triangle', 0.45);
    playTone(ctx, 1396.91, now + 1.01, 0.35, 'sine', 0.5);
  } catch (err) {
    console.warn('Audio alert error:', err);
  }
}

/**
 * Play warning alarm for Penarikan Alkes / Alat Rusak Berat
 */
export function playWarningSound() {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    try {
      navigator.vibrate([300, 150, 300]);
    } catch (e) {}
  }

  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    playTone(ctx, 659.25, now, 0.2, 'sawtooth', 0.25); // E5
    playTone(ctx, 523.25, now + 0.22, 0.35, 'sawtooth', 0.3); // C5
  } catch (err) {
    console.warn('Audio alert error:', err);
  }
}

/**
 * Play gentle sync chime
 */
export function playSyncSound() {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    playTone(ctx, 523.25, now, 0.1, 'sine', 0.2); // C5
    playTone(ctx, 659.25, now + 0.1, 0.1, 'sine', 0.2); // E5
    playTone(ctx, 783.99, now + 0.2, 0.18, 'sine', 0.25); // G5
  } catch (err) {
    console.warn('Audio sync error:', err);
  }
}

/**
 * Play pleasant two-tone chime for new Thread Comment / Discussion Message
 */
export function playMessageSound() {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    playTone(ctx, 659.25, now, 0.08, 'sine', 0.22); // E5
    playTone(ctx, 987.77, now + 0.08, 0.16, 'sine', 0.28); // B5
  } catch (err) {
    // ignore
  }
}

