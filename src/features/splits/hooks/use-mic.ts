import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { MicError, openMic, type MicFailure, type MicHandlers, type MicListener } from '../../../lib/mic-listener';
import { logQuietly } from '../../../lib/errors';

export type MicStatus =
  | { kind: 'off' }
  | { kind: 'opening' }
  | { kind: 'listening' }
  | { kind: 'failed'; reason: MicFailure };

const OFF: MicStatus = { kind: 'off' };
const OPENING: MicStatus = { kind: 'opening' };

function subscribeVisibility(onChange: () => void): () => void {
  document.addEventListener('visibilitychange', onChange);
  return () => document.removeEventListener('visibilitychange', onChange);
}

function isPageVisible(): boolean {
  return document.visibilityState === 'visible';
}

/**
 * The microphone, open while `isWanted` — and while the page is in front: a
 * hidden page has nothing to listen for, and a microphone left open behind it
 * is one the phone keeps flagging as in use.
 */
export function useMic(
  isWanted: boolean,
  handlers: MicHandlers,
): { status: MicStatus; resume: () => void } {
  const isVisible = useSyncExternalStore(subscribeVisibility, isPageVisible);
  const isOpen = isWanted && isVisible;
  // How the last opening ended; null while it is still under way.
  const [outcome, setOutcome] = useState<MicStatus | null>(null);
  const listener = useRef<MicListener | null>(null);
  const handlersRef = useRef(handlers);

  useEffect(() => {
    handlersRef.current = handlers;
  });

  useEffect(() => {
    if (!isOpen) return;
    let isCancelled = false;
    openMic({
      onVoice: (atMs) => handlersRef.current.onVoice(atMs),
      onLevel: (level) => handlersRef.current.onLevel?.(level),
    }).then(
      (opened) => {
        // Closed again before it finished opening: the effect is gone.
        if (isCancelled) {
          opened.close();
          return;
        }
        listener.current = opened;
        setOutcome({ kind: 'listening' });
      },
      (cause: unknown) => {
        if (isCancelled) return;
        logQuietly('Microphone', cause);
        setOutcome({
          kind: 'failed',
          reason: cause instanceof MicError ? cause.reason : 'unavailable',
        });
      },
    );
    return () => {
      isCancelled = true;
      listener.current?.close();
      listener.current = null;
      setOutcome(null);
    };
  }, [isOpen]);

  const resume = useCallback(() => listener.current?.resume(), []);
  return { status: isOpen ? (outcome ?? OPENING) : OFF, resume };
}
