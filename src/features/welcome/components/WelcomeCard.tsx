import { useId } from 'react';
import { strings } from '../../../lib/strings';

interface WelcomeCardProps {
  onLearn: () => void;
  onSolve: () => void;
}

/**
 * The question a new install asks, where the empty list would say there is
 * nothing to list yet. On the timer and not over it: most people who open the
 * app came for the timer, and a sheet across it was the first thing they met.
 * Two answers and no third — the timer above is the way to leave it unanswered.
 */
export function WelcomeCard({ onLearn, onSolve }: WelcomeCardProps) {
  const question = useId();
  return (
    <div className="welcome-card" role="group" aria-labelledby={question}>
      <p className="welcome-card__question" id={question}>
        {strings.welcome.canSolve}
      </p>
      <div className="welcome-card__answers">
        <button type="button" onClick={onLearn}>
          {strings.welcome.notYet}
        </button>
        <button type="button" onClick={onSolve}>
          {strings.welcome.yes}
        </button>
      </div>
    </div>
  );
}
