import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { MicError, openMic, type MicFailure, type MicHandlers, type MicListener } from '../../../lib/mic-listener';
import type { VoiceProfile } from '../../../domain/audio/onset';
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
 *
 * A new `voice` is handed to the detector already listening. Opening the
 * microphone again for it left a second and a half deaf — the moment the
 * first "hop" after calibrating was said.
 */
export function useMic(
  isWanted: boolean,
  handlers: MicHandlers,
  voice: VoiceProfile | null,
): { status: MicStatus; resume: () => void } {
  const loudnessDb = voice?.loudnessDb ?? null;
  const isVisible = useSyncExternalStore(subscribeVisibility, isPageVisible);
  const isOpen = isWanted && isVisible;
  // How the last opening ended; null while it is still under way.
  const [outcome, setOutcome] = useState<MicStatus | null>(null);
  const listener = useRef<MicListener | null>(null);
  const handlersRef = useRef(handlers);
  const voiceRef = useRef(voice);

  useEffect(() => {
    handlersRef.current = handlers;
    voiceRef.current = voice;
  });

  useEffect(() => {
    if (!isOpen) return;
    let isCancelled = false;
    openMic(
      {
        onSound: (sound) => handlersRef.current.onSound(sound),
        onLevel: (level) => handlersRef.current.onLevel?.(level),
      },
      voiceRef.current,
    ).then(
      (opened) => {
        // Closed again before it finished opening: the effect is gone.
        if (isCancelled) {
          opened.close();
          return;
        }
        listener.current = opened;
        // The voice may have changed while the microphone was opening.
        opened.setVoice(voiceRef.current);
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

  useEffect(() => {
    listener.current?.setVoice(loudnessDb === null ? null : { loudnessDb });
  }, [loudnessDb]);

  const resume = useCallback(() => listener.current?.resume(), []);
  return { status: isOpen ? (outcome ?? OPENING) : OFF, resume };
}
