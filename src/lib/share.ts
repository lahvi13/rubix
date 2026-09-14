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
    // Closing the sheet without picking anything rejects too, and is no failure.
    return cause instanceof DOMException && cause.name === 'AbortError' ? 'cancelled' : 'failed';
  }
}
