import { memo, useMemo } from 'react';
import type { MethodPhase, Split } from '../../../db/types';
import { phaseSegments } from '../../../domain/solve/splits';
import { formatMs } from '../../../lib/format';
import { phaseColour } from '../../../lib/phase-colours';

interface PhaseBarProps {
  splits: readonly Split[];
  phases: readonly MethodPhase[];
  rawMs: number;
  /** Names and times under the bar. Off where the bar is only a hint of shape. */
  showLabels?: boolean;
}

/**
 * The solve as a strip: one block per phase, as wide as the phase was long.
 * Phases whose boundary was never recorded share one grey block, because the
 * only thing known about them is their sum.
 */
export const PhaseBar = memo(function PhaseBar({
  splits,
  phases,
  rawMs,
  showLabels = true,
}: PhaseBarProps) {
  const keys = useMemo(() => phases.map((phase) => phase.key), [phases]);
  const segments = useMemo(() => phaseSegments(splits, keys, rawMs), [splits, keys, rawMs]);
  if (segments.length === 0) return null;

  const labelOf = (key: string) => phases.find((phase) => phase.key === key)?.label ?? key;

  return (
    <div className="phase-bar">
      <div className="phase-bar__track">
        {segments.map((segment) => (
          <span
            key={segment.startMs}
            className="phase-bar__segment"
            style={{
              // A zero-length phase (a skip) would otherwise vanish; the flex
              // basis keeps a sliver of it visible.
              flexGrow: Math.max(segment.ms, 1),
              background:
                segment.phases.length === 1
                  ? phaseColour(keys.indexOf(segment.phases[0] ?? ''), keys.length)
                  : 'var(--muted)',
            }}
          />
        ))}
      </div>
      {showLabels ? (
        <ul className="phase-bar__labels">
          {segments.map((segment) => (
            <li key={segment.startMs} className="phase-bar__label">
              <span
                className="phase-bar__name"
                style={{
                  color:
                    segment.phases.length === 1
                      ? phaseColour(keys.indexOf(segment.phases[0] ?? ''), keys.length)
                      : 'var(--muted)',
                }}
              >
                {segment.phases.map(labelOf).join(' + ')}
              </span>{' '}
              <span className="phase-bar__time">{formatMs(segment.ms)}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
});
