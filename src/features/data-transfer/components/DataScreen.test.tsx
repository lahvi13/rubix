import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../../../db/schema';
import { createSession } from '../../../db/repositories/session-repository';
import { addSolve } from '../../../db/repositories/solve-repository';
import { buildExportFile, clearAllData } from '../../../db/repositories/transfer-repository';
import { seedPacks } from '../../../db/seed/seed';
import { forgetErrors, logQuietly } from '../../../lib/errors';
import CSTIMER_PHASES from '../../../test/fixtures/cstimer-export-phases.txt?raw';
import { DataScreen } from './DataScreen';

async function exportedFile(): Promise<File> {
  const session = await createSession('Evening', '333', 'freestyle');
  await addSolve({
    sessionId: session.id,
    puzzle: '333',
    mode: 'freestyle',
    scramble: "R U R' U'",
    rawMs: 12_340,
    penalty: 'none',
    penaltySource: 'auto',
    inspectionMs: null,
    startedAt: Date.now(),
  });

  const file = await buildExportFile('0.4.0');
  await clearAllData();
  return new File([JSON.stringify(file)], 'rubix-backup.json', { type: 'application/json' });
}

describe('DataScreen', () => {
  beforeEach(async () => {
    await Promise.all(db.tables.map((table) => table.clear()));
  });

  it('keeps the troubleshooting tools folded while nothing has failed', async () => {
    forgetErrors();
    const user = userEvent.setup();

    render(<DataScreen />);
    const toggle = screen.getByRole('button', { name: /nothing has failed/ });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('button', { name: 'Reconnect the database' })).not.toBeInTheDocument();

    await user.click(toggle);
    expect(screen.getByRole('button', { name: 'Reconnect the database' })).toBeInTheDocument();
  });

  it('unfolds the troubleshooting tools when a failure is logged', async () => {
    forgetErrors();
    logQuietly('Could not save the solve', new Error('QuotaExceededError'));

    render(<DataScreen />);

    expect(screen.getByRole('button', { name: /1 failure logged/ })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.getByText(/QuotaExceededError/)).toBeInTheDocument();
    forgetErrors();
  });

  it('previews a file first and only writes after the import is confirmed', async () => {
    const backup = await exportedFile();
    const user = userEvent.setup();

    render(<DataScreen />);
    await user.upload(screen.getByLabelText('Choose a file'), backup);

    const row = await screen.findByRole('row', { name: /^Solves/ });
    expect(row).toHaveTextContent('1');
    expect(await db.solves.count()).toBe(0);

    await user.click(screen.getByRole('button', { name: 'Import' }));

    await waitFor(async () => {
      expect(await db.solves.count()).toBe(1);
    });
    expect(await db.sessions.count()).toBe(1);
    expect(screen.getByText('Import finished.')).toBeInTheDocument();
  });

  it('explains a file it cannot read instead of touching the database', async () => {
    const user = userEvent.setup();

    render(<DataScreen />);
    await user.upload(
      screen.getByLabelText('Choose a file'),
      new File(['{"format":"csTimer"}'], 'other.json', { type: 'application/json' }),
    );

    expect(await screen.findByText('That file is not a Rubix export.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Import' })).not.toBeInTheDocument();
  });

  it('says where the backup went', async () => {
    // jsdom has no blob URLs and no downloads; the anchor click is the seam.
    const createObjectURL = vi.fn(() => 'blob:test');
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL: vi.fn() });
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    const user = userEvent.setup();

    render(<DataScreen />);
    await user.click(screen.getByRole('button', { name: 'Export data' }));

    expect(await screen.findByText(/^rubix-\d{4}-\d{2}-\d{2}\.json$/)).toBeInTheDocument();
    expect(click).toHaveBeenCalled();
    expect(
      await screen.findByText(/^Last backup: Today · \d+ KB\. Nothing has changed since\.$/),
    ).toBeInTheDocument();
    // jsdom cannot share, and a button that cannot work is not offered.
    expect(screen.queryByRole('button', { name: 'Send it somewhere…' })).not.toBeInTheDocument();

    click.mockRestore();
    vi.unstubAllGlobals();
  });

  it('hands the backup to the share sheet as plain text', async () => {
    vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn(() => 'blob:test'), revokeObjectURL: vi.fn() });
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    const share = vi.fn<(data: ShareData) => Promise<void>>(() => Promise.resolve());
    Object.defineProperty(navigator, 'canShare', { value: () => true, configurable: true });
    Object.defineProperty(navigator, 'share', { value: share, configurable: true });
    const user = userEvent.setup();

    try {
      render(<DataScreen />);
      await user.click(screen.getByRole('button', { name: 'Export data' }));
      await user.click(await screen.findByRole('button', { name: 'Send it somewhere…' }));

      const shared = share.mock.calls[0]?.[0].files?.[0];
      expect(shared?.name).toMatch(/^rubix-\d{4}-\d{2}-\d{2}\.txt$/);
      expect(shared?.type).toBe('text/plain');
    } finally {
      Reflect.deleteProperty(navigator, 'canShare');
      Reflect.deleteProperty(navigator, 'share');
      click.mockRestore();
      vi.unstubAllGlobals();
    }
  });

  it('restores a backup that travelled as a .txt', async () => {
    const backup = await exportedFile();
    const user = userEvent.setup();

    render(<DataScreen />);
    await user.upload(
      screen.getByLabelText('Choose a file'),
      new File([await backup.text()], 'rubix-2026-09-14.txt', { type: 'text/plain' }),
    );

    expect(await screen.findByRole('row', { name: /^Solves/ })).toHaveTextContent('1');
  });

  it('holds the wipe behind a countdown and then says it happened', async () => {
    const session = await createSession('Evening', '333', 'freestyle');
    await addSolve({
      sessionId: session.id,
      puzzle: '333',
      mode: 'freestyle',
      scramble: 'U',
      rawMs: 9_000,
      penalty: 'none',
      penaltySource: 'auto',
      inspectionMs: null,
      startedAt: Date.now(),
    });
    const user = userEvent.setup();

    render(<DataScreen />);
    await user.click(screen.getByRole('button', { name: 'Delete all data' }));

    // Armed, but the button cannot be part of the same double tap.
    expect(screen.getByRole('button', { name: /Delete everything \(\d\)/ })).toBeDisabled();
    expect(await db.solves.count()).toBe(1);

    // Real seconds: the delay is the whole point of the guard.
    const confirm = await screen.findByRole(
      'button',
      { name: 'Delete everything' },
      { timeout: 8000 },
    );
    await user.click(confirm);

    await waitFor(async () => {
      expect(await db.solves.count()).toBe(0);
    });
    expect(screen.getByText('All data deleted.')).toBeInTheDocument();
  }, 15_000);
});

/**
 * A real csTimer export, byte for byte — csTimer writes its JSON with a .txt
 * name, which is exactly the case that would trip a screen that trusted the
 * extension.
 */
const CSTIMER_EXPORT =
  '{"session1":[[[0,2056],"D\' R F2 B2 L F\' R U2 B\' U2 B2 R2 B2 U2 R2 D\' L2 F2 R2","",1788509385]],' +
  '"session2":[],"properties":{"sessionData":"{\\"1\\":{\\"name\\":1,\\"opt\\":{},\\"rank\\":1}}"}}';

describe('DataScreen, importing from csTimer', () => {
  beforeEach(async () => {
    await Promise.all(db.tables.map((table) => table.clear()));
    await seedPacks();
  });

  it('previews the file, then writes it into a session of its own', async () => {
    const user = userEvent.setup();
    const file = new File([CSTIMER_EXPORT], 'cstimer_20260907_171755.txt', {
      type: 'text/plain',
    });

    render(<DataScreen />);
    await user.upload(screen.getByLabelText('Choose a csTimer file'), file);

    expect(await screen.findByText(/1 solve in 1 session/)).toBeInTheDocument();
    expect(await db.solves.count()).toBe(0);

    await user.click(screen.getByRole('button', { name: 'Import from csTimer' }));

    await waitFor(async () => {
      expect(await db.solves.count()).toBe(1);
    });
    const solve = await db.solves.toCollection().first();
    expect(solve?.rawMs).toBe(2056);
    expect(screen.getByText(/Imported 1 solve from csTimer./)).toBeInTheDocument();
  });

  it('says a second import of the same file has nothing to add', async () => {
    const user = userEvent.setup();
    const file = () =>
      new File([CSTIMER_EXPORT], 'cstimer.txt', { type: 'text/plain' });

    render(<DataScreen />);
    const input = screen.getByLabelText('Choose a csTimer file');

    await user.upload(input, file());
    await user.click(await screen.findByRole('button', { name: 'Import from csTimer' }));
    await waitFor(async () => {
      expect(await db.solves.count()).toBe(1);
    });

    await user.upload(input, file());

    expect(await screen.findByText('Every solve in this file is already here.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Import from csTimer' })).toBeDisabled();
  });

  it('refuses a file that is not a csTimer export', async () => {
    const user = userEvent.setup();

    render(<DataScreen />);
    await user.upload(
      screen.getByLabelText('Choose a csTimer file'),
      new File(['{"format":"rubix-export"}'], 'backup.json', { type: 'application/json' }),
    );

    expect(
      await screen.findByText('That file is JSON, but not a csTimer export.'),
    ).toBeInTheDocument();
  });
});

describe('DataScreen, a csTimer file that cannot be read', () => {
  beforeEach(async () => {
    await Promise.all(db.tables.map((table) => table.clear()));
  });

  it('says so instead of sitting on “reading”', async () => {
    const user = userEvent.setup();
    const file = new File(['whatever'], 'cstimer.txt', { type: 'text/plain' });
    // A file can stop being readable between being picked and being read.
    vi.spyOn(file, 'text').mockRejectedValue(
      new DOMException('gone', 'NotReadableError'),
    );

    render(<DataScreen />);
    await user.upload(screen.getByLabelText('Choose a csTimer file'), file);

    expect(
      await screen.findByText('That file could not be read. Pick it again.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Reading the file…')).not.toBeInTheDocument();
  });
});

describe('DataScreen, a csTimer session timed by phase', () => {
  beforeEach(async () => {
    await Promise.all(db.tables.map((table) => table.clear()));
    await seedPacks();
  });

  it('promises exactly the phase times it then writes', async () => {
    const user = userEvent.setup();
    const file = new File([CSTIMER_PHASES], 'cstimer.txt', { type: 'text/plain' });

    render(<DataScreen />);
    await user.upload(screen.getByLabelText('Choose a csTimer file'), file);

    // Two of the five were timed in the method's four phases; the one timed
    // in five keeps its time and loses them.
    expect(await screen.findByText(/2 with phase times/)).toBeInTheDocument();
    expect(
      screen.getByText(/1 timed in another number of phases/),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Import from csTimer' }));
    // Generous: this one seeds the packs and imports five solves, and a busy
    // machine takes longer than the default second.
    await waitFor(
      async () => {
        expect(await db.solves.count()).toBe(5);
      },
      { timeout: 5000 },
    );

    // The count on screen has to be the count that landed, or the preview was
    // a promise about a different import.
    const solves = await db.solves.toArray();
    expect(solves.filter((solve) => solve.splits.length > 0)).toHaveLength(2);
    const withFive = solves.find((solve) => solve.rawMs === 32_706);
    expect(withFive?.penalty).toBe('plus2');
    expect(withFive?.splits).toEqual([]);
  });
});
