import { useState } from 'react';
import { Sheet } from '../../../components/Sheet';
import { formatAlg, parseAlg } from '../../../domain/cube/notation';
import { strings } from '../../../lib/strings';

interface ScrambleSheetProps {
  /** The scramble on the timer now, which the field starts from. */
  scramble: string | null;
  /** Given, a scramble to solve instead of the one on the timer. */
  onUse: (scramble: string) => void;
  /** Skip this one: a fresh generated scramble, or back to them. */
  onNewRandom: () => void;
  onClose: () => void;
}

/**
 * The scramble, as text to change. It opens holding the one on the timer, so
 * copying it out, correcting one move and pasting a whole new one in are all
 * the same field — and the moves are read back through the app's own
 * notation, so what goes on the timer is spelled the way every scramble is.
 */
export function ScrambleSheet({ scramble, onUse, onNewRandom, onClose }: ScrambleSheetProps) {
  const [draft, setDraft] = useState(scramble ?? '');
  const parsed = parseAlg(draft);
  const cleaned = parsed.ok && parsed.moves.length > 0 ? formatAlg(parsed.moves) : null;
  const isInvalid = draft.trim() !== '' && cleaned === null;

  const use = (): void => {
    if (cleaned === null) return;
    if (cleaned === scramble) onClose();
    else onUse(cleaned);
  };

  return (
    <Sheet label={strings.scramble.label} className="scramble-sheet" onClose={onClose}>
      <h2 className="scramble-sheet__title">{strings.scramble.label}</h2>
      <form
        className="scramble-sheet__form"
        onSubmit={(event) => {
          event.preventDefault();
          use();
        }}
      >
        <textarea
          rows={3}
          value={draft}
          onChange={(event) => {
            // A line break means nothing in a scramble, so Enter is the submit
            // it would be in a one-line field. Read off the input rather than
            // the key: an open sheet keeps every keydown to itself.
            const input = event.nativeEvent;
            if (
              input instanceof InputEvent &&
              (input.inputType === 'insertLineBreak' || input.inputType === 'insertParagraph')
            ) {
              event.currentTarget.form?.requestSubmit();
              return;
            }
            setDraft(event.target.value.replace(/\s*\n\s*/g, ' '));
          }}
          aria-label={strings.scramble.field}
          aria-invalid={isInvalid || undefined}
          className={isInvalid ? 'is-invalid' : ''}
          // Moves are not words: a keyboard that corrects them or offers to
          // finish them only puts back what was just typed.
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="done"
        />
        {isInvalid ? (
          <p className="detail__error">{strings.scramble.invalid}</p>
        ) : (
          <p className="detail__hint">{strings.scramble.hint}</p>
        )}
        <div className="scramble-sheet__actions">
          <button type="button" onClick={onNewRandom}>
            {strings.scramble.next}
          </button>
          <button type="submit" className="is-primary" disabled={cleaned === null}>
            {strings.scramble.use}
          </button>
        </div>
      </form>
    </Sheet>
  );
}
