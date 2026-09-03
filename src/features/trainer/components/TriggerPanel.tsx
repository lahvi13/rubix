import { useState } from 'react';
import { TRIGGER_COLOURS } from '../../../db/repositories/trigger-repository';
import { parseAlg } from '../../../domain/cube/notation';
import { watchWrite } from '../../../lib/errors';
import { strings } from '../../../lib/strings';
import { useTriggers } from '../hooks/use-triggers';

/**
 * The triggers highlighting works from. Built-in ones can be switched off or
 * rewritten — the moment one is edited it belongs to the user and the app
 * stops updating it.
 *
 * A trigger is a card rather than a table row: on a phone, name and moves next
 * to eight colours and a button leaves nothing wide enough to type in.
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
          <li key={trigger.id} className="trigger">
            <div className="trigger__head">
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
              <input
                className="trigger__name"
                value={trigger.name}
                onChange={(event) => {
                  const name = event.target.value;
                  watchWrite(() => rename(trigger.id, name), strings.trainer.triggerName);
                }}
                aria-label={strings.trainer.triggerName}
                // Shown in its own colour, so the palette below needs no legend.
                style={{ color: trigger.colour ?? TRIGGER_COLOURS[0] }}
              />
              <button
                type="button"
                className="trigger__delete"
                onClick={() => watchWrite(() => remove(trigger.id), strings.solve.delete)}
              >
                {strings.solve.delete}
              </button>
            </div>

            <input
              className={
                parseAlg(trigger.moves).ok ? 'trigger__moves' : 'trigger__moves is-invalid'
              }
              value={trigger.moves}
              onChange={(event) => {
                const moves = event.target.value;
                watchWrite(() => rewrite(trigger.id, moves), strings.trainer.triggerMoves);
              }}
              aria-label={strings.trainer.triggerMoves}
              spellCheck={false}
              autoCapitalize="none"
              autoCorrect="off"
            />

            <div
              className="trigger__colours"
              role="group"
              aria-label={strings.trainer.triggerColour}
            >
              {TRIGGER_COLOURS.map((colour) => (
                <button
                  key={colour}
                  type="button"
                  className={
                    (trigger.colour ?? TRIGGER_COLOURS[0]) === colour
                      ? 'trigger__colour is-active'
                      : 'trigger__colour'
                  }
                  style={{ background: colour }}
                  aria-label={colour}
                  aria-pressed={(trigger.colour ?? TRIGGER_COLOURS[0]) === colour}
                  onClick={() =>
                    watchWrite(() => recolour(trigger.id, colour), strings.trainer.triggerColour)
                  }
                />
              ))}
            </div>
          </li>
        ))}
      </ul>

      <form
        className="triggers__add"
        onSubmit={(event) => {
          event.preventDefault();
          if (!isValid) return;
          watchWrite(() => create(name, moves), strings.trainer.addTrigger);
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
          spellCheck={false}
          autoCapitalize="none"
          autoCorrect="off"
        />
        <button type="submit" disabled={!isValid}>
          {strings.trainer.addTrigger}
        </button>
      </form>
    </section>
  );
}
