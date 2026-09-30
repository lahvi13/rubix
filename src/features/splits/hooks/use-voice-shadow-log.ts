import { useMemo } from 'react';
import { DETECTOR_VERSION } from '../../../domain/audio/onset';
import { readShadowRecords, summariseShadow, type ShadowSummary } from '../../../domain/audio/shadow';
import { useSetting } from '../../../hooks/use-setting';

export interface VoiceShadowLog {
  summary: ShadowSummary;
  /** Everything heard, as text to paste somewhere it can be looked at. */
  details: () => string;
  clear: () => void;
}

/** The voice trial's tally, over what this detector has heard on this device. */
export function useVoiceShadowLog(): VoiceShadowLog {
  const [stored, setStored] = useSetting('audio.voiceShadowLog');
  const records = useMemo(() => readShadowRecords(stored), [stored]);
  const summary = useMemo(() => summariseShadow(records, DETECTOR_VERSION), [records]);

  return {
    summary,
    details: () => JSON.stringify({ detector: DETECTOR_VERSION, records }),
    clear: () => setStored([]),
  };
}
