/**
 * Short local tone for the inspection cues at 8 and 12 seconds. Web Audio
 * only — no audio files to load and nothing to precache.
 */

let context: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof AudioContext === 'undefined') return null;
  context ??= new AudioContext();
  // Browsers suspend the context until a user gesture; a timer press is one.
  if (context.state === 'suspended') void context.resume();
  return context;
}

export function beep(frequencyHz = 880, durationMs = 100): void {
  const ctx = getContext();
  if (!ctx) return;

  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.frequency.value = frequencyHz;
  oscillator.type = 'sine';

  // Ramp instead of a hard stop, otherwise the cut produces an audible click.
  const endsAt = ctx.currentTime + durationMs / 1000;
  gain.gain.setValueAtTime(0.15, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, endsAt);

  oscillator.connect(gain).connect(ctx.destination);
  oscillator.start();
  oscillator.stop(endsAt);
}
