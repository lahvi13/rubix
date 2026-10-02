import type { MethodPhase } from '../../../db/types';
import { formatRunning, type RunningDisplay } from '../../../lib/format';
import { phaseColour, phaseFillColour } from '../../../lib/phase-colours';

interface PhaseRunProps {
  phases: readonly MethodPhase[];
  /** Boundaries recorded so far, as offsets from the start of the solve. */
  splitMs: readonly number[];
  /** Total time on the clock, so the phase in progress has one of its own. */
  elapsedMs: number;
  /** The clock's own setting: a phase time must not show what the clock hides. */
  display: RunningDisplay;
}

/**
 * The guided solve, while it is running: a block per phase, filled as each one
 * is finished, with the phase being solved lit in its own colour.
 *
 * The blocks are equal, not proportional like the finished solve's bar — mid
 * solve the question is how far along the reader is, and a bar that redraws
 * itself under a moving clock is one more thing to read.
 */
export function PhaseRun({ phases, splitMs, elapsedMs, display }: PhaseRunProps) {
  if (phases.length === 0) return null;

  const current = splitMs.length;
  const startOfCurrent = splitMs[current - 1] ?? 0;

  const timeOf = (index: number): string | null => {
    if (index > current) return null;
    const end = index === current ? elapsedMs : (splitMs[index] ?? 0);
    const start = index === 0 ? 0 : (splitMs[index - 1] ?? startOfCurrent);
    return formatRunning(Math.max(end - start, 0), display);
  };

  return (
    <div className="phase-run">
      <div className="phase-run__track">
        {phases.map((phase, index) => (
          <span
            key={phase.key}
            className={index === current ? 'phase-run__block is-running' : 'phase-run__block'}
            style={index <= current ? { background: phaseFillColour(index, phases.length) } : undefined}
          />
        ))}
      </div>
      <ul className="phase-run__labels">
        {phases.map((phase, index) => (
          <li
            key={phase.key}
            className={index === current ? 'phase-run__label is-running' : 'phase-run__label'}
            style={index === current ? { color: phaseColour(index, phases.length) } : undefined}
          >
            <span className="phase-run__name">{phase.label}</span>{' '}
            <span className="phase-run__time">{timeOf(index)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
