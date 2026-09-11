import { useState } from 'react';
import { TRIGGER_COLOURS } from '../../../db/repositories/trigger-repository';
import { ChevronIcon } from '../../../components/Icons';
import { parseAlg } from '../../../domain/cube/notation';
import { watchWrite } from '../../../lib/errors';
import { strings } from '../../../lib/strings';
import { useTriggers } from '../hooks/use-triggers';
import { triggerStyle } from './trigger-colour';

interface PaletteProps {
  value: string;
  onPick: (colour: string) => void;
}

/** The colours a trigger can wear, as the colours themselves. */
function Palette({ value, onPick }: PaletteProps) {
  return (
    <div className="trigger__colours" role="group" aria-label={strings.trainer.triggerColour}>
      {TRIGGER_COLOURS.map((colour) => (
        <button
          key={colour}
          type="button"
          className={value === colour ? 'trigger__colour is-active' : 'trigger__colour'}
          style={{ background: colour }}
          aria-label={colour}
          aria-pressed={value === colour}
          onClick={() => onPick(colour)}
        />
      ))}
    </div>
  );
}

/**
 * The triggers highlighting works from. Built-in ones can be switched off or
 * rewritten — the moment one is edited it belongs to the user and the app
 * stops updating it.
 *
 * A trigger is a line, and the boxes to change it are behind a tap. A dozen of
 * them, each with two full-width boxes and a row of colours, was most of a
 * phone screen tall for something read far more often than it is edited — and
 * the wall of black boxes and saturated squares looked like nothing else in
 * the app. What a trigger is can be taken in at a glance now: its name in its
 * own colour, and the moves it stands for.
 */
export function TriggerPanel() {
  const { triggers, create, rename, rewrite, recolour, setEnabled, remove } = useTriggers();
  const [name, setName] = useState('');
  const [moves, setMoves] = useState('');
  // Chosen while adding rather than afterwards. Every new trigger used to
  // arrive in the same green and land in the list by length, so giving it a
  // colour meant finding it again first.
  const [colour, setColour] = useState<string>(TRIGGER_COLOURS[0]);
  const [openId, setOpenId] = useState<string | null>(null);

  const isValid = name.trim() !== '' && moves.trim() !== '' && parseAlg(moves).ok;

  return (
    <section className="triggers">
      <p className="notation__hint">{strings.trainer.triggersHint}</p>

      <ul className="triggers__list">
        {triggers.map((trigger) => {
          const isOpen = openId === trigger.id;
          const shown = trigger.colour ?? TRIGGER_COLOURS[0];

          return (
            <li key={trigger.id} className={isOpen ? 'trigger is-open' : 'trigger'}>
              <div className="trigger__row">
                <label className="trigger__toggle">
                  <input
                    type="checkbox"
                    checked={trigger.isEnabled === 1}
                    onChange={(event) => {
                      const isEnabled = event.target.checked;
                      watchWrite(
                        () => setEnabled(trigger.id, isEnabled),
                        strings.trainer.triggerEnabled,
                      );
                    }}
                    aria-label={`${strings.trainer.triggerEnabled}: ${trigger.name}`}
                  />
                </label>
                <button
                  type="button"
                  className="trigger__open"
                  aria-expanded={isOpen}
                  onClick={() => setOpenId(isOpen ? null : trigger.id)}
                >
                  {/* Named in its own colour, so the palette needs no legend. */}
                  <span className="trigger__label" style={triggerStyle(shown)}>
                    {trigger.name}
                  </span>
                  <span
                    className={
                      parseAlg(trigger.moves).ok
                        ? 'trigger__preview'
                        : 'trigger__preview is-invalid'
                    }
                  >
                    {trigger.moves}
                  </span>
                  <ChevronIcon up={isOpen} />
                </button>
              </div>

              {isOpen ? (
                <div className="trigger__editor">
                  <input
                    className="trigger__name"
                    value={trigger.name}
                    onChange={(event) => {
                      const next = event.target.value;
                      watchWrite(() => rename(trigger.id, next), strings.trainer.triggerName);
                    }}
                    aria-label={strings.trainer.triggerName}
                  />
                  <input
                    className={
                      parseAlg(trigger.moves).ok ? 'trigger__moves' : 'trigger__moves is-invalid'
                    }
                    value={trigger.moves}
                    onChange={(event) => {
                      const next = event.target.value;
                      watchWrite(() => rewrite(trigger.id, next), strings.trainer.triggerMoves);
                    }}
                    aria-label={strings.trainer.triggerMoves}
                    spellCheck={false}
                    autoCapitalize="none"
                    autoCorrect="off"
                  />
                  <Palette
                    value={shown}
                    onPick={(next) =>
                      watchWrite(() => recolour(trigger.id, next), strings.trainer.triggerColour)
                    }
                  />
                  <button
                    type="button"
                    className="is-danger trigger__delete"
                    onClick={() => {
                      setOpenId(null);
                      watchWrite(() => remove(trigger.id), strings.solve.delete);
                    }}
                  >
                    {strings.solve.delete}
                  </button>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      <form
        className="triggers__add"
        onSubmit={(event) => {
          event.preventDefault();
          if (!isValid) return;
          watchWrite(() => create(name, moves, colour), strings.trainer.addTrigger);
          setName('');
          setMoves('');
        }}
      >
        <div className="triggers__add-row">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={strings.trainer.triggerName}
            aria-label={strings.trainer.triggerName}
          />
          <input
            value={moves}
            onChange={(event) => setMoves(event.target.value)}
            placeholder={strings.trainer.triggerMoves}
            aria-label={strings.trainer.triggerMoves}
            className={moves.trim() !== '' && !parseAlg(moves).ok ? 'is-invalid' : ''}
            spellCheck={false}
            autoCapitalize="none"
            autoCorrect="off"
          />
        </div>
        <Palette value={colour} onPick={setColour} />
        <button type="submit" className="is-primary" disabled={!isValid}>
          {strings.trainer.addTrigger}
        </button>
      </form>
    </section>
  );
}
