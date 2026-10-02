import { memo, useMemo, type CSSProperties } from 'react';
import type { MethodPhase, Split } from '../../../db/types';
import { phaseSegments, phaseShares } from '../../../domain/solve/splits';
import { formatMs } from '../../../lib/format';
import { phaseColour, phaseFillColour, phaseInkColour } from '../../../lib/phase-colours';

/**
 * How much of the solve the bar spells out. One component with three
 * densities rather than one per screen: the timer's list and the history's
 * list were drawing the same strip through two sets of rules, and every
 * change to it had to be made twice.
 *
 * - `shape` — the strip alone, which is all that can be read at row height
 * - `shares` — each phase's percentage of the solve, written into its block
 * - `labels` — names and times under the bar, for a solve on its own
 */
export type PhaseBarDetail = 'shape' | 'shares' | 'labels';

interface PhaseBarProps {
  splits: readonly Split[];
  phases: readonly MethodPhase[];
  rawMs: number;
  detail?: PhaseBarDetail;
  /**
   * Phases of this solve that are the fastest that phase has been over the set
   * it is being read in — `bestPhasesIn`. Leaving it out is how a bar says it
   * has nothing to compare against.
   */
  bestPhases?: readonly string[];
}

/** React's style type does not know about custom properties; these do. */
interface NameStyle extends CSSProperties {
  '--phase-dot': string;
}

interface SegmentStyle extends CSSProperties {
  '--phase': string;
  '--phase-ring': string;
  '--phase-ink'?: string;
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
  detail = 'labels',
  bestPhases,
}: PhaseBarProps) {
  const keys = useMemo(() => phases.map((phase) => phase.key), [phases]);
  const segments = useMemo(() => phaseSegments(splits, keys, rawMs), [splits, keys, rawMs]);
  const shares = useMemo(() => phaseShares(segments, rawMs), [segments, rawMs]);
  if (segments.length === 0) return null;

  const labelOf = (key: string) => phases.find((phase) => phase.key === key)?.label ?? key;
  const namesOf = (segment: { phases: string[] }) => segment.phases.map(labelOf).join(' + ');

  // A block covering two phases has no single length to beat: only the sum of
  // the pair is known, and the pair is not what any best was measured over.
  const isBest = (segment: { phases: string[] }) =>
    bestPhases !== undefined &&
    segment.phases.length === 1 &&
    bestPhases.includes(segment.phases[0] ?? '');

  const colourOf = (segment: { phases: string[] }) =>
    segment.phases.length === 1
      ? phaseColour(keys.indexOf(segment.phases[0] ?? ''), keys.length)
      : 'var(--muted)';
  const blockOf = (segment: { phases: string[] }) =>
    segment.phases.length === 1
      ? phaseFillColour(keys.indexOf(segment.phases[0] ?? ''), keys.length)
      : 'var(--muted)';

  // A block of several phases is grey, and the stylesheet's own lettering
  // already suits it.
  const inkOf = (segment: { phases: string[] }) =>
    segment.phases.length === 1
      ? phaseInkColour(keys.indexOf(segment.phases[0] ?? ''), keys.length)
      : undefined;

  return (
    <div className={`phase-bar phase-bar--${detail}`}>
      <div className="phase-bar__track">
        {segments.map((segment, index) => {
          const style: SegmentStyle = {
            // A zero-length phase (a skip) would otherwise vanish; the flex
            // basis keeps a sliver of it visible.
            flexGrow: Math.max(segment.ms, 1),
            '--phase': blockOf(segment),
            // The ring round a best in the ink: drawn in a pale face, on a
            // white card, it was there and could not be seen.
            '--phase-ring': colourOf(segment),
            '--phase-ink': inkOf(segment),
          };
          const share = shares[index] ?? 0;
          return (
            <span
              key={segment.startMs}
              className={isBest(segment) ? 'phase-bar__segment is-best' : 'phase-bar__segment'}
              style={style}
              // The share alone does not say which phase it belongs to, and
              // the names do not fit next to it at this height.
              title={`${namesOf(segment)} ${formatMs(segment.ms)}`}
            >
              {/* Written always and hidden by the stylesheet when the block is
                  too narrow for it: how narrow depends on the width the bar
                  was given and the text size, not on the share alone. */}
              {detail === 'shares' ? <span className="phase-bar__share">{share}%</span> : null}
            </span>
          );
        })}
      </div>
      {detail === 'labels' ? (
        <ul className="phase-bar__labels">
          {segments.map((segment) => {
            const nameStyle: NameStyle = { '--phase-dot': blockOf(segment) };
            return (
              <li key={segment.startMs} className="phase-bar__label">
                <span className="phase-bar__name" style={nameStyle}>
                  {namesOf(segment)}
                </span>{' '}
                <span className="phase-bar__time">{formatMs(segment.ms)}</span>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
});
