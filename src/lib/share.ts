/**
 * Handing a file to another app through the system share sheet — Drive, a
 * mail client, a messenger. Like a download, nothing is sent by the app
 * itself: the user picks where the file goes, and that app carries it.
 */

export function canShareFile(file: File): boolean {
  return typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] });
}

export type ShareOutcome = 'shared' | 'cancelled' | 'failed';

/** Must be called straight from a tap: the share sheet needs user activation. */
export async function shareFile(file: File): Promise<ShareOutcome> {
  try {
    await navigator.share({ files: [file] });
    return 'shared';
  } catch (cause) {
    return failureOf(cause);
  }
}

export type LinkShareOutcome = ShareOutcome | 'copied';

/**
 * A link through the share sheet, or onto the clipboard where there is no
 * sheet — desktop Firefox has none, and a link is still worth passing on.
 */
export async function shareLink(url: string, title: string): Promise<LinkShareOutcome> {
  try {
    if (typeof navigator.share === 'function') {
      await navigator.share({ url, title });
      return 'shared';
    }
    await navigator.clipboard.writeText(url);
    return 'copied';
  } catch (cause) {
    return failureOf(cause);
  }
}

// Closing the sheet without picking anything rejects too, and is no failure.
function failureOf(cause: unknown): ShareOutcome {
  return cause instanceof DOMException && cause.name === 'AbortError' ? 'cancelled' : 'failed';
}
