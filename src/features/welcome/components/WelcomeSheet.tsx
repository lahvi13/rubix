import { useState } from 'react';
import { Sheet } from '../../../components/Sheet';
import { Wordmark } from '../../../components/Wordmark';
import { WELCOME_METHODS, type WelcomeAnswer, type WelcomeMethod } from '../../../domain/welcome/plan';
import { useCubeSkin } from '../../../hooks/use-cube-skin';
import { watchWrite } from '../../../lib/errors';
import { strings } from '../../../lib/strings';

interface WelcomeSheetProps {
  onAnswer: (answer: WelcomeAnswer) => Promise<void>;
  onSkip: () => void;
}

interface ChoiceProps {
  title: string;
  text: string;
  onPick: () => void;
}

/** One answer: what it is, and in a line, what it leads to. */
function Choice({ title, text, onPick }: ChoiceProps) {
  return (
    <button type="button" className="welcome__choice" onClick={onPick}>
      <span className="welcome__choice-title">{title}</span>
      <span className="welcome__choice-text">{text}</span>
    </button>
  );
}

/**
 * Two questions on a fresh install — can you solve it, and by which method —
 * and the app set up by the answers: the guide or the trainer, the method the
 * timer reads phases by. Each answer says what it leads to before it is
 * picked, and both can be walked away from; closing the sheet is skipping it.
 */
export function WelcomeSheet({ onAnswer, onSkip }: WelcomeSheetProps) {
  const skin = useCubeSkin();
  /** Null on the first question; the first answer once it is given. */
  const [canSolve, setCanSolve] = useState<boolean | null>(null);

  const answer = (value: WelcomeAnswer) => watchWrite(() => onAnswer(value), strings.welcome.saving);
  const methodText = (method: WelcomeMethod) =>
    canSolve === true ? strings.welcome.methods[method].solve : strings.welcome.methods[method].learn;

  return (
    <Sheet label={strings.welcome.title} className="welcome" onClose={onSkip}>
      <Wordmark faces={skin.faces} className="welcome__mark" />
      <h2 className="session-picker__title">{strings.welcome.title}</h2>

      {canSolve === null ? (
        <>
          <p className="welcome__intro">{strings.welcome.intro}</p>
          <h3 className="welcome__question">{strings.welcome.canSolve}</h3>
          <div className="welcome__choices">
            <Choice
              title={strings.welcome.notYet}
              text={strings.welcome.notYetText}
              onPick={() => setCanSolve(false)}
            />
            <Choice title={strings.welcome.yes} text={strings.welcome.yesText} onPick={() => setCanSolve(true)} />
          </div>
          <button type="button" className="welcome__quiet" onClick={onSkip}>
            {strings.welcome.skip}
          </button>
        </>
      ) : (
        <>
          <h3 className="welcome__question">
            {canSolve ? strings.welcome.solveMethod : strings.welcome.learnMethod}
          </h3>
          <div className="welcome__choices">
            {WELCOME_METHODS.map((method) => (
              <Choice
                key={method}
                title={strings.welcome.methods[method].name}
                text={methodText(method)}
                onPick={() => answer(canSolve ? { canSolve: true, method } : { canSolve: false, method })}
              />
            ))}
            {/* Only a solver can not know: a beginner is choosing what to learn. */}
            {canSolve ? (
              <Choice
                title={strings.welcome.unknown}
                text={strings.welcome.unknownText}
                onPick={() => answer({ canSolve: true, method: null })}
              />
            ) : null}
          </div>
          <button type="button" className="welcome__quiet" onClick={() => setCanSolve(null)}>
            {strings.welcome.back}
          </button>
        </>
      )}
    </Sheet>
  );
}
