import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { connectUpdates, disconnectUpdates } from '../../../lib/app-update';
import { strings } from '../../../lib/strings';
import { AboutScreen } from './AboutScreen';

describe('AboutScreen', () => {
  afterEach(() => {
    disconnectUpdates();
    Reflect.deleteProperty(navigator, 'share');
    Reflect.deleteProperty(navigator, 'clipboard');
    window.location.hash = '';
  });

  it('shows the build, and puts it in the subject of a mail', () => {
    render(<AboutScreen />);

    expect(screen.getByText(strings.about.version(__APP_VERSION__))).toBeInTheDocument();
    const mail = screen.getByRole('link', { name: 'jan@lahvi.cz' });
    expect(mail.getAttribute('href')).toBe(
      `mailto:jan@lahvi.cz?subject=${encodeURIComponent(`Rubix ${__APP_VERSION__}`)}`,
    );
  });

  it('opens a GitHub bug report with the build already filled in', () => {
    render(<AboutScreen />);

    const issue = screen.getByRole('link', { name: strings.about.issueLink });
    const url = new URL(issue.getAttribute('href') ?? '');
    expect(url.origin + url.pathname).toBe('https://github.com/lahvi13/rubix/issues/new');
    expect(url.searchParams.get('template')).toBe('bug.yml');
    expect(url.searchParams.get('version')).toBe(__APP_VERSION__);
  });

  it('credits J Perm for the algorithms', () => {
    render(<AboutScreen />);

    expect(screen.getByRole('link', { name: 'jperm.net' })).toHaveAttribute('href', 'https://jperm.net/');
  });

  it('says which version is current after a check', async () => {
    const user = userEvent.setup();
    connectUpdates({ update: () => Promise.resolve(), installing: null, waiting: null }, () => {});
    render(<AboutScreen />);

    await user.click(screen.getByRole('button', { name: strings.about.checkUpdates }));

    expect(await screen.findByText(strings.about.updateCurrent)).toBeInTheDocument();
  });

  it('copies the link where there is no share sheet', async () => {
    const user = userEvent.setup();
    const copied: string[] = [];
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: (text: string) => Promise.resolve(void copied.push(text)) },
      configurable: true,
    });
    render(<AboutScreen />);

    await user.click(screen.getByRole('button', { name: strings.about.share }));

    expect(await screen.findByText(strings.about.copied)).toBeInTheDocument();
    expect(copied).toEqual([`${window.location.origin}/`]);
  });

  it('leads to the backup', async () => {
    const user = userEvent.setup();
    render(<AboutScreen />);

    await user.click(screen.getByRole('button', { name: strings.about.toData }));

    expect(window.location.hash).toBe('#/data');
  });
});
