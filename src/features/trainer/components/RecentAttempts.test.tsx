import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { AlgCase } from '../../../db/types';
import { defaultSkin } from '../../../lib/cube-skins';
import { RecentAttempts } from './RecentAttempts';

function algCase(id: string, name: string): AlgCase {
  return {
    id,
    setId: 'pll',
    name,
    label: null,
    progress: 'new',
    group: 'Edges only',
    setupAlg: "R U R' U'",
    order: 0,
    isCustom: 0,
    packVersion: 1,
    createdAt: 0,
    updatedAt: 0,
  };
}

const CASES = new Map([
  ['pll-t', algCase('pll-t', 'T')],
  ['pll-ua', algCase('pll-ua', 'Ua')],
  ['pll-jb', algCase('pll-jb', 'Jb')],
]);

describe('RecentAttempts', () => {
  it('lists the attempts with their times and how each compares to its ao5', () => {
    render(
      <RecentAttempts
        run={{
          recent: [
            { id: 'a', caseId: 'pll-t', finalMs: 2410, penalty: 'none', versusAo5Ms: -320 },
            { id: 'b', caseId: 'pll-ua', finalMs: 4100, penalty: 'plus2', versusAo5Ms: 450 },
            { id: 'c', caseId: 'pll-jb', finalMs: null, penalty: 'dnf', versusAo5Ms: null },
          ],
          todayCount: 12,
          todayMeanMs: 2840,
        }}
        cases={CASES}
        setId="pll"
        skin={defaultSkin('dark')}
        withPictures
        onOpen={() => {}}
      />,
    );

    expect(screen.getByText('today 12 · mean 2.84')).toBeInTheDocument();
    const rows = screen.getAllByRole('button');
    expect(rows.map((row) => row.textContent)).toEqual(['T2.41−0.32', 'Ua4.10++0.45', 'JbDNF']);
    expect(screen.getByText('−0.32')).toHaveClass('is-faster');
    expect(screen.getByText('+0.45')).toHaveClass('is-slower');
  });

  it('opens the case a row is about', async () => {
    const onOpen = vi.fn();
    render(
      <RecentAttempts
        run={{
          recent: [{ id: 'a', caseId: 'pll-ua', finalMs: 1880, penalty: 'none', versusAo5Ms: null }],
          todayCount: 1,
          todayMeanMs: 1880,
        }}
        cases={CASES}
        setId="pll"
        skin={defaultSkin('dark')}
        withPictures={false}
        onOpen={onOpen}
      />,
    );

    await userEvent.setup().click(screen.getByRole('button', { name: /Ua/ }));
    expect(onOpen).toHaveBeenCalledWith(CASES.get('pll-ua'));
  });

  it('says nothing before the first attempt', () => {
    const { container } = render(
      <RecentAttempts
        run={{ recent: [], todayCount: 0, todayMeanMs: null }}
        cases={CASES}
        setId="pll"
        skin={defaultSkin('dark')}
        withPictures
        onOpen={() => {}}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
