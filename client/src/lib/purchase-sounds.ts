type SoundType = "critical" | "important";

interface SoundJob {
  type: SoundType;
}

let queue: SoundJob[] = [];
let isPlaying = false;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
const DEBOUNCE_MS = 300;

function generateBeep(
  ctx: AudioContext,
  frequency: number,
  duration: number,
  volume: number,
  oscillatorType: OscillatorType = "sine"
): Promise<void> {
  return new Promise<void>((resolve) => {
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.type = oscillatorType;
    oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);

    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.01);
    gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + duration);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + duration);

    oscillator.onended = () => resolve();
  });
}

async function playCriticalSound(volume: number): Promise<void> {
  try {
    const ctx = new AudioContext();
    await generateBeep(ctx, 880, 0.15, volume, "square");
    await new Promise<void>(r => setTimeout(r, 80));
    await generateBeep(ctx, 880, 0.15, volume, "square");
    await new Promise<void>(r => setTimeout(r, 80));
    await generateBeep(ctx, 1100, 0.25, volume, "square");
    await ctx.close();
  } catch {
  }
}

async function playImportantSound(volume: number): Promise<void> {
  try {
    const ctx = new AudioContext();
    await generateBeep(ctx, 660, 0.12, volume, "sine");
    await new Promise<void>(r => setTimeout(r, 60));
    await generateBeep(ctx, 880, 0.18, volume, "sine");
    await ctx.close();
  } catch {
  }
}

async function processQueue(volume: number): Promise<void> {
  if (isPlaying || queue.length === 0) return;

  const hasCritical = queue.some(j => j.type === "critical");
  queue = [];
  isPlaying = true;

  try {
    if (hasCritical) {
      await playCriticalSound(volume);
    } else {
      await playImportantSound(volume);
    }
  } catch {
  } finally {
    isPlaying = false;
  }
}

export interface SoundPreferences {
  soundEnabled: boolean;
  onlyCriticalSound: boolean;
  mutedUntil: string | null;
  volume?: number;
}

export function playAlertSound(
  type: SoundType,
  prefs: SoundPreferences
): void {
  if (!prefs.soundEnabled) return;

  if (prefs.mutedUntil) {
    const muted = new Date(prefs.mutedUntil);
    if (muted > new Date()) return;
  }

  if (prefs.onlyCriticalSound && type !== "critical") return;

  queue.push({ type });

  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    processQueue(prefs.volume ?? 0.4).catch(() => {});
  }, DEBOUNCE_MS);
}

export function severityToSoundType(severity: string): SoundType {
  return severity === "critico" ? "critical" : "important";
}
