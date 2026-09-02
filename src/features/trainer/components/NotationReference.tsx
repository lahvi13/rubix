import { CubeDiagram } from '../../../components/CubeDiagram';
import { parseAlg } from '../../../domain/cube/notation';
import { applyAlg, solvedState } from '../../../domain/cube/state';
import type { CubeSkin } from '../../../lib/cube-skins';
import { strings } from '../../../lib/strings';

interface NotationReferenceProps {
  skin: CubeSkin;
}

/**
 * What each letter does, shown rather than described: every entry is a solved
 * cube with that one move applied, drawn by the same code as the cases.
 */
const ROWS: readonly (readonly string[])[] = [
  ['R', "R'", 'R2', 'r', "r'", 'x'],
  ['U', "U'", 'U2', 'u', "u'", 'y'],
  ['F', "F'", 'F2', 'f', "f'", 'z'],
  ['L', "L'", 'L2', 'l', "l'", 'M'],
  ['B', "B'", 'B2', 'b', "b'", "M'"],
  ['D', "D'", 'D2', 'd', "d'", 'E'],
];

export function NotationReference({ skin }: NotationReferenceProps) {
  return (
    <section className="notation">
      <p className="notation__hint">{strings.trainer.notationHint}</p>
      {ROWS.map((row, index) => (
        <div key={index} className="notation__row">
          {row.map((token) => (
            <figure key={token} className="notation__item">
              <CubeDiagram
                className="notation__diagram"
                state={stateAfter(token)}
                view="isometric"
                skin={skin}
                label={token}
              />
              <figcaption>{wideAlias(token)}</figcaption>
            </figure>
          ))}
        </div>
      ))}
    </section>
  );
}

/**
 * The app writes wide turns the short way, but published algorithms elsewhere
 * spell them `Rw`. The reference names both so neither is a surprise.
 */
function wideAlias(token: string): string {
  const wide = /^([udlrfb])(['2]?)$/.exec(token);
  if (!wide) return token;
  return `${token} · ${wide[1]?.toUpperCase() ?? ''}w${wide[2] ?? ''}`;
}

function stateAfter(token: string) {
  const parsed = parseAlg(token);
  return parsed.ok ? applyAlg(solvedState(), parsed.moves) : solvedState();
}
