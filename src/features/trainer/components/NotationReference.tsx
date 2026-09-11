import { CubeDiagram } from '../../../components/CubeDiagram';
import { parseAlg } from '../../../domain/cube/notation';
import { applyAlg, solvedState } from '../../../domain/cube/state';
import type { CubeSkin } from '../../../lib/cube-skins';
import { strings } from '../../../lib/strings';
import { F2L_ORIENTATION } from '../case-view';

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
  // The last column is the three rotations and the three slices; M' used to
  // take this place and S had none, which left one of the three unexplained
  // while another was shown twice.
  ['B', "B'", 'B2', 'b', "b'", 'S'],
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

/**
 * The cube stood the way the trainer stands it — red in front, green on the
 * right — and then the one move. Held in front of you differently from the
 * cases it explains, the reference would be teaching a letter on one cube and
 * using it on another.
 */
function stateAfter(token: string) {
  const parsed = parseAlg(`${F2L_ORIENTATION} ${token}`);
  return parsed.ok ? applyAlg(solvedState(), parsed.moves) : solvedState();
}
