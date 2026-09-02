/**
 * Short local tone for the inspection cues at 8 and 12 seconds. Web Audio
 * only — no audio files to load and nothing to precache.
 *
 * Audio is a nicety: nothing here may ever take the timer down, so both entry
 * points swallow their own failures.
 */

let context: AudioContext | null = null;

/**
 * Create (or wake) the context from a real user gesture — the press that
 * starts the attempt. Doing it lazily inside the animation-frame tick meant
 * exercising the no-gesture autoplay path on every phone, which is exactly
 * the kind of edge browsers handle worst.
 */
export function primeBeep(): void {
  try {
    if (typeof AudioContext === 'undefined') return;
    context ??= new AudioContext();
    if (context.state === 'suspended') void context.resume();
  } catch {
    context = null;
  }
}

export function beep(frequencyHz = 880, durationMs = 100): void {
  try {
    if (!context) primeBeep();
    if (!context || context.state !== 'running') return;

    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = frequencyHz;
    oscillator.type = 'sine';

    // Ramp instead of a hard stop, otherwise the cut produces an audible click.
    const endsAt = context.currentTime + durationMs / 1000;
    gain.gain.setValueAtTime(0.15, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, endsAt);

    oscillator.connect(gain).connect(context.destination);
    oscillator.addEventListener('ended', () => {
      oscillator.disconnect();
      gain.disconnect();
    });
    oscillator.start();
    oscillator.stop(endsAt);
  } catch {
    // A beep that failed is a beep nobody hears; never a crash.
  }
}
