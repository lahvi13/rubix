import { useState } from 'react';
import type { MethodPhase, Solve, Split } from '../../../db/types';
import { parseTimeInput } from '../../../domain/solve/parse-time';
import {
  insertSplit,
  moveSplitAsTyped,
  phaseDurations,
  removeSplit,
} from '../../../domain/solve/splits';
import { formatMs } from '../../../lib/format';
import { phaseFillColour } from '../../../lib/phase-colours';
import { strings } from '../../../lib/strings';
import { PhaseBar } from './PhaseBar';

interface SplitEditorProps {
  solve: Solve;
  phases: readonly MethodPhase[];
  /** Phases of this solve that are the fastest that phase has been. */
  bestPhases?: readonly string[];
  onChange: (splits: Split[]) => void;
}

/**
 * Phase times in the solve detail: what each phase took, and the running time
 * at which it ended. The cumulative time is the editable one — it is what is
 * stored, and moving one boundary is meant to change exactly two phases.
 */
export function SplitEditor({ solve, phases, bestPhases, onChange }: SplitEditorProps) {
  const [invalidPhase, setInvalidPhase] = useState<string | null>(null);
  const keys = phases.map((phase) => phase.key);
  const durations = phaseDurations(solve.splits, keys, solve.rawMs);
  const lastKey = keys[keys.length - 1];

  const commit = (phase: string, input: string) => {
    const parsed = parseTimeInput(input);
    const next =
      parsed === null ? null : moveSplitAsTyped(solve.splits, keys, phase, parsed, solve.rawMs);
    if (next === null) {
      setInvalidPhase(phase);
      return;
    }
    setInvalidPhase(null);
    onChange(next);
  };

  return (
    <div className="splits">
      <PhaseBar splits={solve.splits} phases={phases} rawMs={solve.rawMs} detail="shares" />

      {/* Two times per row read as one number twice over unless the columns
          say which is which — the first phase makes them equal. */}
      <div className="splits__head" aria-hidden="true">
        <span />
        <span />
        <span>{strings.splits.length}</span>
        <span>{strings.splits.endsAtColumn}</span>
        <span />
      </div>

      <ul className="splits__list">
        {phases.map((phase, index) => {
          const split = solve.splits.find((entry) => entry.phase === phase.key);
          const duration = durations[index];
          // The last phase ends when the clock stops, so it has no boundary
          // of its own to move.
          const editable = phase.key !== lastKey;

          return (
            <li key={phase.key} className="splits__row">
              <span
                className="splits__swatch"
                style={{ background: phaseFillColour(index, phases.length) }}
                aria-hidden="true"
              />
              <span className="splits__name">
                {phase.label}
                {bestPhases?.includes(phase.key) ? (
                  <span
                    className="splits__best"
                    role="img"
                    aria-label={strings.splits.bestPhase(phase.label)}
                  >
                    {strings.history.star}
                  </span>
                ) : null}
              </span>
              <span className="splits__duration">
                {duration?.ms == null ? '—' : formatMs(duration.ms)}
              </span>

              {split ? (
                <SplitTimeInput
                  key={split.atMs}
                  phase={phase}
                  atMs={split.atMs}
                  invalid={invalidPhase === phase.key}
                  onCommit={(input) => commit(phase.key, input)}
                />
              ) : (
                <span className="splits__at splits__at--empty">
                  {duration?.isFinal ? strings.splits.endsAtStop : ''}
                </span>
              )}

              {editable ? (
                <button
                  type="button"
                  className="splits__action"
                  aria-label={`${split ? strings.splits.removeSplit : strings.splits.addSplit} ${phase.label}`}
                  onClick={() =>
                    onChange(
                      split
                        ? removeSplit(solve.splits, phase.key)
                        : insertSplit(solve.splits, keys, phase.key, solve.rawMs),
                    )
                  }
                >
                  {split ? '✕' : '+'}
                </button>
              ) : (
                <span className="splits__action" />
              )}
            </li>
          );
        })}
      </ul>

      {solve.splits.length > 0 ? (
        <button type="button" className="splits__clear" onClick={() => onChange([])}>
          {strings.splits.clear}
        </button>
      ) : null}
    </div>
  );
}

interface SplitTimeInputProps {
  phase: MethodPhase;
  atMs: number;
  invalid: boolean;
  onCommit: (input: string) => void;
}

/**
 * Keyed on the stored value, so an accepted edit re-reads the number the
 * repository actually kept. A refused one keeps what was typed and marks it,
 * the same way the raw time field does — retyping a whole time to fix one
 * digit is worse than seeing the digit that was wrong.
 */
function SplitTimeInput({ phase, atMs, invalid, onCommit }: SplitTimeInputProps) {
  const [value, setValue] = useState(() => formatMs(atMs));

  return (
    <input
      className={invalid ? 'splits__at is-invalid' : 'splits__at'}
      value={value}
      inputMode="decimal"
      aria-label={`${phase.label} ${strings.splits.endsAt}`}
      onChange={(event) => setValue(event.target.value)}
      onBlur={() => onCommit(value)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') onCommit(value);
      }}
    />
  );
}
