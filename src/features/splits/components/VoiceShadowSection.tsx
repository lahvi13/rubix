import { useState } from 'react';
import type { MicLevel } from '../../../lib/mic-listener';
import { strings } from '../../../lib/strings';
import { useSetting } from '../../../hooks/use-setting';
import { useMic } from '../hooks/use-mic';
import { useVoiceShadowLog } from '../hooks/use-voice-shadow-log';

/** The span the meter draws: a quiet room at the bottom, shouting at the top. */
const METER_FLOOR_DB = -80;
const METER_CEILING_DB = -10;

function meterPercent(db: number): number {
  const share = (db - METER_FLOOR_DB) / (METER_CEILING_DB - METER_FLOOR_DB);
  return Math.min(100, Math.max(0, share * 100));
}

/** The voice trial's switch, a way to hear what the microphone hears, and the tally so far. */
export function VoiceShadowSection() {
  const [isEnabled, setEnabled] = useSetting('audio.voiceShadow');
  const [splitMode] = useSetting('timer.splitMode');
  // Switching the trial on is a tap, which is what a browser wants before it
  // asks for the microphone — so the test opens with it, and the question
  // comes here rather than at the first solve.
  const [isTesting, setTesting] = useState(false);
  const [isCopied, setCopied] = useState(false);
  const log = useVoiceShadowLog();
  const { summary } = log;

  return (
    <section className="data-section">
      <h2 className="data-section__title">{strings.voice.title}</h2>

      <label className="toggle">
        <input
          type="checkbox"
          checked={isEnabled}
          onChange={(event) => {
            setEnabled(event.target.checked);
            setTesting(event.target.checked);
          }}
        />
        {strings.voice.toggle}
      </label>
      <p className="data-section__hint">{strings.voice.hint}</p>

      {isEnabled ? (
        <>
          {splitMode === 'phases' ? null : (
            <p className="data-section__warning">{strings.voice.needsPhases}</p>
          )}

          {isTesting ? <MicTest /> : null}
          <div className="data-section__row">
            <button type="button" onClick={() => setTesting((testing) => !testing)}>
              {isTesting ? strings.voice.stopTest : strings.voice.test}
            </button>
          </div>

          <p className="data-section__hint data-section__hint--after">
            {summary.solves === 0
              ? strings.voice.summaryEmpty
              : strings.voice.summary(summary.solves, summary.heard, summary.boundaries, summary.extra)}
            {summary.medianOffsetMs !== null && summary.spreadMs !== null
              ? ` ${strings.voice.offset(summary.medianOffsetMs, summary.spreadMs)}`
              : null}
          </p>

          {summary.solves === 0 ? null : (
            <div className="data-section__row">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(log.details()).then(
                    () => setCopied(true),
                    () => setCopied(false),
                  );
                }}
              >
                {isCopied ? strings.voice.copied : strings.voice.copy}
              </button>
              <button type="button" className="is-danger" onClick={log.clear}>
                {strings.voice.clear}
              </button>
            </div>
          )}
        </>
      ) : null}
    </section>
  );
}

/** The microphone, open for as long as this is on screen, with what it hears. */
function MicTest() {
  const [heard, setHeard] = useState({ voices: 0, others: 0 });
  const [level, setLevel] = useState<MicLevel | null>(null);
  const { status } = useMic(true, {
    // The others are counted too: a clatter that is heard and turned away is
    // the test passing, and it should look like it.
    onSound: ({ isVoice }) =>
      setHeard((count) =>
        isVoice ? { ...count, voices: count.voices + 1 } : { ...count, others: count.others + 1 },
      ),
    onLevel: setLevel,
  });

  if (status.kind === 'failed') {
    return <p className="data-section__warning">{strings.voice.failed[status.reason]}</p>;
  }
  if (status.kind !== 'listening' || level === null) {
    return <p className="data-section__hint">{strings.voice.opening}</p>;
  }
  return (
    <>
      <div className="mic-meter" role="img" aria-label={strings.voice.meter}>
        <span
          className={level.levelDb >= level.gateDb ? 'mic-meter__level is-loud' : 'mic-meter__level'}
          style={{ width: `${meterPercent(level.levelDb)}%` }}
        />
        <span className="mic-meter__gate" style={{ left: `${meterPercent(level.gateDb)}%` }} />
      </div>
      <p className="data-section__hint">{strings.voice.heard(heard.voices, heard.others)}</p>
    </>
  );
}
