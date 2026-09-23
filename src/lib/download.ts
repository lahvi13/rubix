/**
 * Handing a file to the user. Nothing is uploaded anywhere — the blob is built
 * in the page and the browser's own download machinery takes it from there.
 */

/** How long the blob URL must outlive the click for the download to start. */
const REVOKE_DELAY_MS = 1000;

export function downloadText(filename: string, text: string, type = 'application/json'): void {
  downloadBlob(filename, new Blob([text], { type }));
}

export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;

  // Firefox only follows a programmatic click on an anchor that is in the
  // document, and the URL must still resolve when the download begins.
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS);
}
