import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../../../db/schema';
import {
  activateSession,
  createSession,
  getActiveSession,
  getOrCreateActiveSession,
} from '../../../db/repositories/session-repository';
import { getSetting, setSetting } from '../../../db/repositories/settings-repository';
import { addSolve, updateSolve } from '../../../db/repositories/solve-repository';
import { createTag } from '../../../db/repositories/tag-repository';
import { seedPacks } from '../../../db/seed/seed';
import { strings } from '../../../lib/strings';
import { StatsScreen } from './StatsScreen';

// The charts are dumb by contract and jsdom has no layout for Recharts to
// measure; the numbers on the cards are what this screen is responsible for.
vi.mock('../charts/HistogramChart', () => ({
  HistogramChart: () => <div data-testid="histogram-chart" />,
}));
vi.mock('../charts/TrendChart', () => ({
  TrendChart: () => <div data-testid="trend-chart" />,
}));
vi.mock('../charts/DailyTrendChart', () => ({
  DailyTrendChart: () => <div data-testid="daily-trend-chart" />,
}));
vi.mock('../charts/PracticeChart', () => ({
  PracticeChart: () => <div data-testid="practice-chart" />,
}));

async function seedSolve(sessionId: string, rawMs: number) {
  return addSolve({
    sessionId,
    puzzle: '333',
    mode: 'freestyle',
    scramble: "R U R' U'",
    rawMs,
    penalty: 'none',
    penaltySource: 'auto',
    inspectionMs: null,
    startedAt: Date.now(),
  });
}

describe('StatsScreen', () => {
  let sessionId: string;

  beforeEach(async () => {
    await Promise.all(db.tables.map((table) => table.clear()));
    sessionId = (await getOrCreateActiveSession('333', 'freestyle')).id;
  });

  it('shows the empty state before the first solve', async () => {
    render(<StatsScreen />);
    expect(await screen.findByText('No solves yet.')).toBeInTheDocument();
  });

  it.each([
    [1, '1 solve'],
    [2, '2 solves'],
  ])('counts %i solve(s) in words that agree with the number', async (count, text) => {
    for (let i = 0; i < count; i += 1) await seedSolve(sessionId, 10_000);

    render(<StatsScreen />);

    expect(await screen.findByText(text)).toBeInTheDocument();
  });

  it('reads every session by default, and one when asked', async () => {
    const elsewhere = await createSession('Evening', '333', 'freestyle');
    await seedSolve(elsewhere.id, 10_000);
    await activateSession(sessionId);
    await seedSolve(sessionId, 20_000);
    await seedSolve(sessionId, 30_000);
    const user = userEvent.setup();

    render(<StatsScreen />);

    expect(await screen.findByText('3 solves')).toBeInTheDocument();
    // Mean and median agree over 10, 20 and 30.
    expect(screen.getAllByText('20.00')).toHaveLength(2);
    // Over every session the session best would only repeat the PB.
    expect(screen.queryByText('Session best')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'This session' }));

    expect(await screen.findByText(/2 solves/)).toBeInTheDocument();
    expect(screen.getAllByText('25.00')).toHaveLength(2);
    expect(screen.getByText('Session best')).toBeInTheDocument();
    expect(await getSetting('stats.scope')).toBe('session');
  });

  it('reads only the latest hundred solves when asked', async () => {
    // One slow solve first, then a hundred at ten seconds: the hundred leave it out.
    await seedSolve(sessionId, 60_000);
    for (let i = 0; i < 100; i += 1) await seedSolve(sessionId, 10_000);
    const user = userEvent.setup();

    render(<StatsScreen />);
    await user.click(await screen.findByRole('button', { name: 'Last 100' }));

    expect(await screen.findByText('Last 100 of 101 solves')).toBeInTheDocument();
    const mean = screen.getByText('Mean').parentElement;
    expect(mean).toHaveTextContent('10.00');
    expect(await getSetting('stats.scope')).toBe('recent');
  });

  it('shows PB, averages and rates computed from the session', async () => {
    await setSetting('stats.scope', 'session');
    for (const rawMs of [10_000, 11_000, 12_000, 13_000, 14_000]) {
      await seedSolve(sessionId, rawMs);
    }
    const dnf = await seedSolve(sessionId, 9000);
    await updateSolve(dnf.id, { penalty: 'dnf' });

    render(<StatsScreen />);

    // PB single and session best agree here: the clean 10s. The two cards fill
    // from separate live queries, so wait for both.
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /PB single/i })).toHaveTextContent('10.00');
      expect(screen.getByRole('button', { name: /Session best/i })).toHaveTextContent('10.00');
    });
    // Current ao5 over the last five (11..14 + DNF): DNF trimmed, (12+13+14)/3.
    expect(screen.getByRole('rowheader', { name: 'ao5' })).toBeInTheDocument();
    expect(screen.getByText('13.00')).toBeInTheDocument();
    // Not enough solves for ao12 yet.
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
    // One DNF out of six solves, on the card that carries both rates.
    expect(screen.getByText('17% DNF')).toBeInTheDocument();
    expect(screen.getByText('0% +2')).toBeInTheDocument();

    expect(await screen.findByTestId('histogram-chart')).toBeInTheDocument();
    // Six solves have no ao12 yet: the chart shows their singles, and says
    // when the line will come rather than leaving the reader to wonder.
    expect(await screen.findByTestId('trend-chart')).toBeInTheDocument();
    expect(screen.getByText(strings.stats.trendAverageLater(6))).toBeInTheDocument();
  });

  it('opens the solves behind an average, with the trimmed ones in brackets', async () => {
    for (const rawMs of [12_000, 10_000, 14_000, 11_000, 13_000]) await seedSolve(sessionId, rawMs);
    const user = userEvent.setup();

    render(<StatsScreen />);

    // Current and best ao5 are the same five solves: 12, 11 and 13 count.
    const [current] = await screen.findAllByRole('button', { name: '12.00' });
    if (current === undefined) throw new Error('no average to open');
    await user.click(current);

    const sheet = await screen.findByRole('dialog', { name: 'Current ao5' });
    expect(within(sheet).getByText('(10.00)')).toBeInTheDocument();
    expect(within(sheet).getByText('(14.00)')).toBeInTheDocument();

    await user.click(within(sheet).getByRole('button', { name: '11.00' }));

    // The solve takes the list's place and steps through the same five.
    expect(await screen.findByText('4 / 5')).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Current ao5' })).not.toBeInTheDocument();
  });

  it('lists when each record fell, newest first', async () => {
    for (const rawMs of [12_000, 13_000, 11_000, 11_500, 9000]) await seedSolve(sessionId, rawMs);

    render(<StatsScreen />);

    const records = within(await screen.findByRole('list', { name: 'Records' }));
    const rows = records.getAllByRole('button');
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringMatching(/^9.00−2.00/),
      expect.stringMatching(/^11.00−1.00/),
      expect.stringMatching(/^12.00first/),
    ]);
  });

  it('sets a goal and says how often it is beaten', async () => {
    for (const rawMs of [10_000, 11_000, 12_000, 13_000]) await seedSolve(sessionId, rawMs);
    const dnf = await seedSolve(sessionId, 9000);
    await updateSolve(dnf.id, { penalty: 'dnf' });
    const user = userEvent.setup();

    render(<StatsScreen />);

    await user.click(await screen.findByRole('button', { name: 'Set a goal' }));
    await user.type(screen.getByRole('textbox', { name: 'Goal time' }), '12');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Sub 12')).toBeInTheDocument();
    // 10 and 11 beat it; 12 only equals it, and the DNF is a miss.
    expect(screen.getAllByText('40%')).toHaveLength(2);
    expect(await getSetting('stats.goalMs')).toBe(12_000);
  });

  it('counts today towards the practice streak', async () => {
    for (const rawMs of [10_000, 11_000, 12_000]) await seedSolve(sessionId, rawMs);

    render(<StatsScreen />);

    expect(await screen.findByText('1 day')).toBeInTheDocument();
    expect(screen.getByText('1 of 30')).toBeInTheDocument();
    expect(await screen.findByTestId('practice-chart')).toBeInTheDocument();
  });

  it('reads the trend by day when asked, and remembers it', async () => {
    for (let i = 0; i < 12; i += 1) await seedSolve(sessionId, 10_000 + i * 100);
    const user = userEvent.setup();

    render(<StatsScreen />);
    expect(await screen.findByTestId('trend-chart')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'By day' }));

    expect(await screen.findByTestId('daily-trend-chart')).toBeInTheDocument();
    expect(await getSetting('stats.trendByDay')).toBe(true);
  });

  it('draws the rolling ao12 once the window has filled', async () => {
    for (let i = 0; i < 12; i += 1) await seedSolve(sessionId, 10_000 + i * 100);

    render(<StatsScreen />);

    expect(await screen.findByTestId('trend-chart')).toBeInTheDocument();
  });
  it('opens the solve behind a best without moving the reader elsewhere', async () => {
    // The all-time best belongs to another session; the one being read holds
    // only its own best.
    const elsewhere = await createSession('Evening', '333', 'freestyle');
    await seedSolve(elsewhere.id, 5000);
    await activateSession(sessionId);
    await seedSolve(sessionId, 12_000);
    await setSetting('stats.scope', 'session');
    const user = userEvent.setup();

    render(<StatsScreen />);
    await screen.findByText('5.00');

    await user.click(screen.getByRole('button', { name: /PB single/i }));

    const sheet = await screen.findByRole('dialog');
    // It says which session it came from, since it is not this one. The name
    // is a second read, so it lands a tick after the sheet itself.
    await waitFor(() => {
      expect(sheet.textContent).toContain('Evening');
    });
    // And reading it did not move anybody: the active session is untouched.
    expect((await getActiveSession('333', 'freestyle'))?.id).toBe(sessionId);
  });

  describe('by tag', () => {
    const tagRow = () => screen.getByRole('group', { name: 'Only solves with this tag' });

    it('reads only the solves with the chosen tag, and remembers it', async () => {
      const oh = await createTag('OH');
      for (const rawMs of [10_000, 20_000]) {
        await updateSolve((await seedSolve(sessionId, rawMs)).id, { tagIds: [oh.id] });
      }
      await seedSolve(sessionId, 60_000);
      const user = userEvent.setup();

      render(<StatsScreen />);
      await screen.findByText('3 solves');
      await user.click(within(tagRow()).getByRole('button', { name: 'OH' }));

      expect(await screen.findByText('2 solves · tagged OH')).toBeInTheDocument();
      expect(screen.getByText('Mean').parentElement).toHaveTextContent('15.00');
      expect(await getSetting('stats.tagId')).toBe(oh.id);

      // The same chip again turns it off.
      await user.click(within(tagRow()).getByRole('button', { name: 'OH' }));

      expect(await screen.findByText('3 solves')).toBeInTheDocument();
      expect(await getSetting('stats.tagId')).toBe('');
    });

    it('takes the latest hundred of the tag, not the tagged among the latest hundred', async () => {
      const oh = await createTag('OH');
      for (let i = 0; i < 3; i += 1) {
        await updateSolve((await seedSolve(sessionId, 20_000)).id, { tagIds: [oh.id] });
      }
      for (let i = 0; i < 100; i += 1) await seedSolve(sessionId, 10_000);
      await setSetting('stats.scope', 'recent');
      await setSetting('stats.tagId', oh.id);

      render(<StatsScreen />);

      expect(await screen.findByText('3 solves · tagged OH')).toBeInTheDocument();
      expect(screen.getByText('Mean').parentElement).toHaveTextContent('20.00');
    });

    it('says so when nothing carries the tag yet, and keeps the way out in reach', async () => {
      const oh = await createTag('OH');
      await seedSolve(sessionId, 10_000);
      await setSetting('stats.tagId', oh.id);

      render(<StatsScreen />);

      expect(await screen.findByText('No solves with this tag yet.')).toBeInTheDocument();
      expect(within(tagRow()).getByRole('button', { name: 'OH' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
    });

    it('reads a tag deleted since as no tag at all', async () => {
      await createTag('OH');
      await seedSolve(sessionId, 10_000);
      await seedSolve(sessionId, 20_000);
      await setSetting('stats.tagId', 'deleted-tag');

      render(<StatsScreen />);

      expect(await screen.findByText('2 solves')).toBeInTheDocument();
      expect(screen.queryByText(/tagged/)).not.toBeInTheDocument();
    });

    it('offers no tag row until there is a tag', async () => {
      await seedSolve(sessionId, 10_000);
      await seedSolve(sessionId, 20_000);

      render(<StatsScreen />);

      await screen.findByText('2 solves');
      expect(
        screen.queryByRole('group', { name: 'Only solves with this tag' }),
      ).not.toBeInTheDocument();
    });
  });

  /**
   * A method is what makes two solves comparable. Read across sessions, the
   * solves may have been timed in more than one, and every number on the
   * screen is about the one being timed in now.
   */
  describe('across sessions timed in different methods', () => {
    const split = (phase: string, atMs: number) => ({ phase, atMs, source: 'manual' as const });

    async function seedPhased(
      session: string,
      rawMs: number,
      phaseKeys: readonly string[],
      ends: readonly number[],
    ) {
      return addSolve({
        sessionId: session,
        puzzle: '333',
        mode: 'freestyle',
        scramble: "R U R' U'",
        rawMs,
        penalty: 'none',
        penaltySource: 'auto',
        inspectionMs: null,
        startedAt: Date.now(),
        splits: ends.map((atMs, index) => split(phaseKeys[index] ?? '', atMs)),
        phaseKeys,
      });
    }

    const CFOP = ['cross', 'f2l', 'oll', 'pll'];
    const ROUX = ['fb', 'sb', 'cmll', 'lse'];

    const phaseTable = async () => {
      const heading = await screen.findByText(/^Phase averages/);
      const section = heading.closest('section');
      if (section === null) throw new Error('the phase table lost its panel');
      return section;
    };

    const rowOf = (section: HTMLElement, name: string) =>
      within(section)
        .getAllByRole('row')
        .find((row) => row.querySelector('th')?.textContent === name)?.textContent;

    // A card is pressable once the solve behind it is known, a tick after the number.
    const card = async (label: RegExp) =>
      (await screen.findByRole('button', { name: label })).textContent;

    beforeEach(async () => {
      await seedPacks();
    });

    it('reads the sessions of the method being timed in, and says which', async () => {
      await seedSolve(sessionId, 20_000);
      await seedSolve(sessionId, 22_000);
      const blocks = await createSession('Blocks', '333', 'freestyle', 'roux');
      await seedSolve(blocks.id, 60_000);

      render(<StatsScreen />);

      // One Roux solve — not three solves with a mean of thirty-four seconds.
      expect(await screen.findByText(/^1 solve · Roux only$/)).toBeInTheDocument();
      expect(screen.getByText('Mean').closest('.stat-card')?.textContent).toContain('1:00.00');
    });

    it('goes back to the other method’s numbers with its session', async () => {
      await seedSolve(sessionId, 20_000);
      await seedSolve(sessionId, 22_000);
      const blocks = await createSession('Blocks', '333', 'freestyle', 'roux');
      await seedSolve(blocks.id, 60_000);
      await activateSession(sessionId);

      render(<StatsScreen />);

      expect(await screen.findByText(/^2 solves · CFOP only$/)).toBeInTheDocument();
      expect(screen.getByText('Mean').closest('.stat-card')?.textContent).toContain('21.00');
    });

    it('does not name the method while every session is timed in the same one', async () => {
      await seedSolve(sessionId, 20_000);
      const evening = await createSession('Evening', '333', 'freestyle');
      await seedSolve(evening.id, 22_000);

      render(<StatsScreen />);

      expect(await screen.findByText('2 solves')).toBeInTheDocument();
      expect(screen.queryByText(/only$/)).not.toBeInTheDocument();
    });

    it('switches session from any scope, which is how the other method is reached', async () => {
      await seedSolve(sessionId, 20_000);
      await seedSolve(sessionId, 22_000);
      const blocks = await createSession('Blocks', '333', 'freestyle', 'roux');
      await seedSolve(blocks.id, 60_000);
      const user = userEvent.setup();

      render(<StatsScreen />);
      await screen.findByText(/^1 solve · Roux only$/);

      // Across sessions, and the session in use is named and can be changed.
      expect(screen.getByRole('button', { name: 'All sessions' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      await user.click(screen.getByRole('button', { name: 'Blocks' }));
      const picker = await screen.findByRole('dialog');
      await user.click(await within(picker).findByRole('button', { name: /^Default/ }));

      expect(await screen.findByText(/^2 solves · CFOP only$/)).toBeInTheDocument();
      expect((await getActiveSession('333', 'freestyle'))?.id).toBe(sessionId);
    });

    it('keeps a personal best for each method', async () => {
      await seedSolve(sessionId, 15_000);
      const blocks = await createSession('Blocks', '333', 'freestyle', 'roux');
      await seedSolve(blocks.id, 58_000);
      await seedSolve(blocks.id, 64_000);

      render(<StatsScreen />);
      await screen.findByText(/^2 solves · Roux only$/);

      // Four times slower than the CFOP best, and the best Roux there is.
      expect(await card(/PB single/i)).toContain('58.00');
      expect(await card(/PB single/i)).not.toContain('15.00');
    });

    it('reads a method’s phases from the solves timed in it', async () => {
      await seedPhased(sessionId, 20_000, CFOP, [2000, 10_000, 14_000]);
      await seedPhased(sessionId, 22_000, CFOP, [3000, 12_000, 16_000]);
      const blocks = await createSession('Blocks', '333', 'freestyle', 'roux');
      await seedPhased(blocks.id, 30_000, ROUX, [3000, 8000, 18_000]);

      render(<StatsScreen />);

      const section = await phaseTable();
      expect(within(section).getByText('Phase averages · 1')).toBeInTheDocument();
      expect(section.textContent).toContain('1 of 1 solves were timed by phase');
      // Its four phases, and a total that is theirs: the CFOP solves are in
      // neither.
      expect(rowOf(section, 'All')).toBe('All3.005.0010.0012.0030.00');
      expect(rowOf(section, 'Best')).toBe('Best3.005.0010.0012.0030.00');
    });

    it('does not read one method’s phase as another’s because they share a name', async () => {
      // CFOP and ZZ both call a phase F2L. A CFOP solve read by ZZ's phases
      // would hand its OLL and PLL to ZZ's last layer.
      await seedPhased(sessionId, 20_000, CFOP, [2000, 10_000, 14_000]);
      const edges = await createSession('Edges first', '333', 'freestyle', 'zz');
      await seedSolve(edges.id, 50_000);

      render(<StatsScreen />);

      await screen.findByText(/^1 solve · ZZ only$/);
      expect(screen.queryByText(/^Phase averages/)).not.toBeInTheDocument();
    });
  });

  it('leaves a best that has no solve behind it unpressable', async () => {
    render(<StatsScreen />);

    await screen.findByText('No solves yet.');
    expect(screen.queryByRole('button', { name: /PB single/i })).not.toBeInTheDocument();
  });

});
