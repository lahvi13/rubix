import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { parseAlg, type Move } from '../../../domain/cube/notation';
import type { TriggerDefinition } from '../../../domain/alg/triggers';
import { AlgText } from './AlgText';

function movesOf(alg: string): Move[] {
  const parsed = parseAlg(alg);
  if (!parsed.ok) throw new Error(`not an algorithm: ${alg}`);
  return parsed.moves;
}

const SEXY: TriggerDefinition = {
  id: 'sexy',
  name: 'Sexy move',
  moves: movesOf("R U R' U'"),
};

describe('AlgText', () => {
  it('marks the move the cube is turning', () => {
    render(<AlgText moves={movesOf("R U R' U'")} triggers={[]} playingMove={2} />);

    expect(screen.getByText("R'")).toHaveAttribute('aria-current', 'step');
    expect(screen.getByText('U')).not.toHaveAttribute('aria-current');
  });

  it('marks nothing while nothing is playing', () => {
    render(<AlgText moves={movesOf("R U R' U'")} triggers={[]} playingMove={null} />);

    expect(document.querySelectorAll('[aria-current]')).toHaveLength(0);
  });

  it('counts moves through a trigger, which groups them without renumbering them', () => {
    // The first four moves are one named block; the fifth is still index 4.
    render(<AlgText moves={movesOf("R U R' U' F")} triggers={[SEXY]} playingMove={4} />);

    expect(screen.getByText('Sexy move')).toBeInTheDocument();
    expect(screen.getByText('F')).toHaveAttribute('aria-current', 'step');
  });

  it('does not name a trigger again under a case of the same name', () => {
    render(<AlgText moves={movesOf("R U R' U'")} triggers={[SEXY]} caseName="sexy move" />);

    expect(screen.queryByText('Sexy move')).not.toBeInTheDocument();
    expect(screen.getByText("R'")).toBeInTheDocument();
  });

  it('still names a trigger under a case called something else', () => {
    render(<AlgText moves={movesOf("R U R' U' F")} triggers={[SEXY]} caseName="Dot" />);

    expect(screen.getByText('Sexy move')).toBeInTheDocument();
  });
});
