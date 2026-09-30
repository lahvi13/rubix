import { useMemo } from 'react';
import type { VoiceProfile } from '../../../domain/audio/onset';
import { useSetting } from '../../../hooks/use-setting';

export interface VoiceProfileView {
  /** The calibrated voice, or null before calibration. */
  voice: VoiceProfile | null;
  save: (voice: VoiceProfile) => void;
}

/** The solver's calibrated voice on this device. */
export function useVoiceProfile(): VoiceProfileView {
  const [loudnessDb, setLoudnessDb] = useSetting('audio.voiceLoudnessDb');
  // One object per calibration, not per render: it opens the microphone again when it changes.
  const voice = useMemo(() => (loudnessDb > 0 ? { loudnessDb } : null), [loudnessDb]);
  return {
    voice,
    save: (next) => setLoudnessDb(next.loudnessDb),
  };
}
