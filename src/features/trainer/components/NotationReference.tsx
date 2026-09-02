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
  ['R', "R'", 'R2', 'Rw', "Rw'", 'x'],
  ['U', "U'", 'U2', 'Uw', "Uw'", 'y'],
  ['F', "F'", 'F2', 'Fw', "Fw'", 'z'],
  ['L', "L'", 'L2', 'Lw', "Lw'", 'M'],
  ['B', "B'", 'B2', 'Bw', "Bw'", "M'"],
  ['D', "D'", 'D2', 'Dw', "Dw'", 'E'],
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
              <figcaption>{lowercaseAlias(token)}</figcaption>
            </figure>
          ))}
        </div>
      ))}
    </section>
  );
}

/**
 * Wide turns get written both ways — `Rw` and `r` mean the same thing, and the
 * packs use whichever the source did. The reference shows both so neither
 * spelling is a surprise.
 */
function lowercaseAlias(token: string): string {
  const wide = /^([UDLRFB])w(['2]?)$/.exec(token);
  if (!wide) return token;
  return `${token} · ${wide[1]?.toLowerCase() ?? ''}${wide[2] ?? ''}`;
}

function stateAfter(token: string) {
  const parsed = parseAlg(token);
  return parsed.ok ? applyAlg(solvedState(), parsed.moves) : solvedState();
}
