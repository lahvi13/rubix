import { useState } from 'react';
import type { CaseWithAlg } from '../../../db/repositories/alg-repository';
import { slowestCases, type CaseStats } from '../../../domain/drill/case-stats';
import { caseTitle } from '../../../domain/alg/case-name';
import { strings } from '../../../lib/strings';

interface CasePoolProps {
  /** The whole set. Undefined while it loads. */
  cases: readonly CaseWithAlg[] | undefined;
  /** Ticked cases across every set — case ids say which set they are in. */
  selectedIds: readonly string[];
  /** For the "slowest 10" shortcut; whichever kind of practice is on show. */
  stats: Map<string, CaseStats> | undefined;
  /** The new flat selection, other sets' ticks left as they were. */
  onSelect: (ids: readonly string[]) => void;
}

/**
 * Which cases are being practised. One flat list of ids across every set, so
 * a subset picked for PLL survives a detour through OLL, and the same picker
 * serves both ways of drilling — the pool is a statement about what you are
 * working on, not about how you are working on it.
 */
export function CasePool({ cases, selectedIds, stats, onSelect }: CasePoolProps) {
  const [isOpen, setOpen] = useState(false);

  const caseIds = (cases ?? []).map((entry) => entry.algCase.id);
  const tickedHere = caseIds.filter((id) => selectedIds.includes(id));

  const chooseHere = (ids: readonly string[]): void => {
    onSelect([...selectedIds.filter((id) => !caseIds.includes(id)), ...ids]);
  };

  return (
    <div className="drill__pool">
      <button
        type="button"
        className="drill__pool-toggle"
        aria-expanded={isOpen}
        onClick={() => setOpen((open) => !open)}
      >
        {strings.drill.pool} {tickedHere.length === 0 ? caseIds.length : tickedHere.length}
        {' / '}
        {caseIds.length}
      </button>

      {isOpen ? (
        <div className="drill__picker">
          <div className="drill__picker-actions">
            <button type="button" onClick={() => chooseHere(caseIds)}>
              {strings.drill.poolAll}
            </button>
            <button
              type="button"
              onClick={() =>
                chooseHere(slowestCases([...(stats?.values() ?? [])]).map((entry) => entry.caseId))
              }
            >
              {strings.drill.poolSlowest}
            </button>
          </div>
          <p className="drill__hint">{strings.drill.poolHint}</p>
          <div className="drill__chips">
            {(cases ?? []).map((entry) => (
              <label key={entry.algCase.id} className="drill__chip">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(entry.algCase.id)}
                  onChange={(event) =>
                    chooseHere(
                      event.target.checked
                        ? [...tickedHere, entry.algCase.id]
                        : tickedHere.filter((id) => id !== entry.algCase.id),
                    )
                  }
                />
                {caseTitle(entry.algCase)}
              </label>
            ))}
          </div>
          <button type="button" className="drill__picker-done" onClick={() => setOpen(false)}>
            {strings.drill.poolDone}
          </button>
        </div>
      ) : null}
    </div>
  );
}
