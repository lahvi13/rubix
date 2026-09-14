import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db/schema';
import { setSetting } from '../db/repositories/settings-repository';
import { useSetting } from './use-setting';

function Theme({ label }: { label: string }) {
  const [theme] = useSetting('ui.theme');
  return <p>{`${label}: ${theme}`}</p>;
}

describe('useSetting', () => {
  beforeEach(async () => {
    await Promise.all(db.tables.map((table) => table.clear()));
  });

  it('draws a screen opened later with the stored value from its first render', async () => {
    await setSetting('ui.theme', 'light');
    // The app shell, which holds the settings for as long as the app runs.
    const shell = render(<Theme label="shell" />);
    expect(await screen.findByText('shell: light')).toBeInTheDocument();

    const beside = shell.container.appendChild(document.createElement('div'));
    render(<Theme label="settings" />, { container: beside });

    // Not findBy: the defaults must never be drawn, not even for a frame.
    expect(screen.getByText('settings: light')).toBeInTheDocument();
  });

  it('follows a write made anywhere else', async () => {
    render(<Theme label="shell" />);
    expect(await screen.findByText('shell: dark')).toBeInTheDocument();

    await setSetting('ui.theme', 'system');

    expect(await screen.findByText('shell: system')).toBeInTheDocument();
  });

  it('does not carry one test’s choices into the next', async () => {
    // The test before left system stored and read; the tables were cleared since.
    render(<Theme label="shell" />);

    expect(screen.getByText('shell: dark')).toBeInTheDocument();
  });
});
