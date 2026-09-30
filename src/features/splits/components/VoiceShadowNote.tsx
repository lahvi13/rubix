import type { ShadowMatch } from '../../../domain/audio/shadow';
import { formatSigned } from '../../../lib/format';
import { strings } from '../../../lib/strings';
import type { MicStatus } from '../hooks/use-mic';

/**
 * What the voice would have measured on the solve just finished, under the
 * phases the taps measured: how many ends it caught, how far each was from
 * its tap, and what it heard that was no end at all.
 */
export function VoiceShadowNote({ mic, result }: { mic: MicStatus; result: ShadowMatch | null }) {
  let text: string | null = null;
  if (mic.kind === 'failed') {
    text = strings.voice.noteFailed[mic.reason];
  } else if (result !== null) {
    text = [
      strings.voice.noteHeard(result.heard, result.boundaries),
      result.offsetsMs.length > 0 ? `${result.offsetsMs.map(formatSigned).join(' ')} ms` : null,
      result.extra > 0 ? strings.voice.noteExtra(result.extra) : null,
    ]
      .filter((part): part is string => part !== null)
      .join(' · ');
  }
  return text === null ? null : <p className="voice-note">{text}</p>;
}
