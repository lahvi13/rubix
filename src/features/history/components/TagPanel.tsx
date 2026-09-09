import { useState } from 'react';
import { CloseIcon } from '../../../components/Icons';
import { Sheet } from '../../../components/Sheet';
import { watchWrite } from '../../../lib/errors';
import { strings } from '../../../lib/strings';
import { useRemoveTag } from '../hooks/use-remove-tag';
import { useTagUsage } from '../hooks/use-tag-usage';
import { useTags } from '../hooks/use-tags';

interface TagPanelProps {
  onClose: () => void;
}

/**
 * Keeping the tags themselves, as opposed to putting them on a solve. The row
 * of tags in the solve detail is for tagging and is tapped often; an offer to
 * delete sitting in it would be a trap next to the thing it destroys.
 *
 * Shaped like the trigger panel: a card each, the name editable in place, and
 * the destructive button apart from it.
 */
export function TagPanel({ onClose }: TagPanelProps) {
  const { tags, create, rename } = useTags();
  const removeTag = useRemoveTag();
  const usage = useTagUsage();
  const [newName, setNewName] = useState('');

  const submitNew = () => {
    const name = newName.trim();
    if (name === '') return;
    setNewName('');
    watchWrite(() => create(name).then(() => undefined), strings.history.newTag);
  };

  return (
    <Sheet label={strings.history.tags} className="tag-panel" onClose={onClose}>
      <div className="detail__header detail__header--bare">
        <button
          type="button"
          className="detail__close"
          onClick={onClose}
          aria-label={strings.history.close}
        >
          <CloseIcon />
        </button>
      </div>

      <h2 className="session-picker__title">{strings.history.tags}</h2>

      {tags.length === 0 ? <p className="detail__hint">{strings.history.noTags}</p> : null}

      <ul className="tag-list">
        {tags.map((tag) => (
          <li key={tag.id} className="tag-row">
            <input
              className="tag-row__name"
              value={tag.name}
              onChange={(event) => {
                const name = event.target.value;
                watchWrite(() => rename(tag.id, name), strings.history.tagName);
              }}
              aria-label={`${strings.history.tagName}: ${tag.name}`}
              style={{ borderColor: tag.color }}
            />

            <span className="tag-row__usage">
              {strings.history.tagOnSolves(usage.get(tag.id) ?? 0)}
            </span>

            {/* One press: the undo bar carries the way back, and the count
                beside this has already said how many solves it comes off.
                A confirmation on top of an undo is a tax on being right. */}
            <button type="button" className="is-danger" onClick={() => void removeTag(tag.id)}>
              {strings.solve.delete}
            </button>
          </li>
        ))}
      </ul>

      <form
        className="session-form"
        onSubmit={(event) => {
          event.preventDefault();
          submitNew();
        }}
      >
        <input
          value={newName}
          onChange={(event) => setNewName(event.target.value)}
          placeholder={strings.history.newTag}
          aria-label={strings.history.newTag}
        />
        <button type="submit">{strings.sessions.create}</button>
      </form>
    </Sheet>
  );
}
