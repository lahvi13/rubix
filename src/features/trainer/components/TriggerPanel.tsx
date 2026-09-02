import { useState } from 'react';
import { TRIGGER_COLOURS } from '../../../db/repositories/trigger-repository';
import { parseAlg } from '../../../domain/cube/notation';
import { strings } from '../../../lib/strings';
import { useTriggers } from '../hooks/use-triggers';

/**
 * The triggers highlighting works from. Built-in ones can be switched off or
 * rewritten — the moment one is edited it belongs to the user and the app
 * stops updating it.
 */
export function TriggerPanel() {
  const { triggers, create, rename, rewrite, recolour, setEnabled, remove } = useTriggers();
  const [name, setName] = useState('');
  const [moves, setMoves] = useState('');

  const isValid = name.trim() !== '' && moves.trim() !== '' && parseAlg(moves).ok;

  return (
    <section className="triggers">
      <p className="notation__hint">{strings.trainer.triggersHint}</p>

      <ul className="triggers__list">
        {triggers.map((trigger) => (
          <li key={trigger.id} className="triggers__item">
            <label className="triggers__toggle">
              <input
                type="checkbox"
                checked={trigger.isEnabled === 1}
                onChange={(event) => void setEnabled(trigger.id, event.target.checked)}
                aria-label={`${strings.trainer.triggerEnabled}: ${trigger.name}`}
              />
            </label>
            <input
              className="triggers__name"
              value={trigger.name}
              onChange={(event) => void rename(trigger.id, event.target.value)}
              aria-label={strings.trainer.triggerName}
            />
            <input
              className={parseAlg(trigger.moves).ok ? 'triggers__moves' : 'triggers__moves is-invalid'}
              value={trigger.moves}
              onChange={(event) => void rewrite(trigger.id, event.target.value)}
              aria-label={strings.trainer.triggerMoves}
            />
            <div className="triggers__colours" role="group" aria-label={strings.trainer.triggerColour}>
              {TRIGGER_COLOURS.map((colour) => (
                <button
                  key={colour}
                  type="button"
                  className={
                    (trigger.colour ?? TRIGGER_COLOURS[0]) === colour
                      ? 'triggers__colour is-active'
                      : 'triggers__colour'
                  }
                  style={{ background: colour }}
                  aria-label={colour}
                  aria-pressed={(trigger.colour ?? TRIGGER_COLOURS[0]) === colour}
                  onClick={() => void recolour(trigger.id, colour)}
                />
              ))}
            </div>
            <button type="button" onClick={() => void remove(trigger.id)}>
              {strings.solve.delete}
            </button>
          </li>
        ))}
      </ul>

      <form
        className="triggers__add"
        onSubmit={(event) => {
          event.preventDefault();
          if (!isValid) return;
          void create(name, moves);
          setName('');
          setMoves('');
        }}
      >
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
        />
        <button type="submit" disabled={!isValid}>
          {strings.trainer.addTrigger}
        </button>
      </form>
    </section>
  );
}
