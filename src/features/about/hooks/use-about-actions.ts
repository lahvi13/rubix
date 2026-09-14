import { useState } from 'react';
import { checkForUpdate, type UpdateCheck } from '../../../lib/app-update';
import { shareLink, type LinkShareOutcome } from '../../../lib/share';

export type UpdateCheckState = { status: 'idle' } | { status: 'checking' } | { status: 'done'; result: UpdateCheck };

export interface AboutActions {
  update: UpdateCheckState;
  checkUpdates: () => void;
  shareOutcome: LinkShareOutcome | null;
  share: () => void;
}

export function useAboutActions(): AboutActions {
  const [update, setUpdate] = useState<UpdateCheckState>({ status: 'idle' });
  const [shareOutcome, setShareOutcome] = useState<LinkShareOutcome | null>(null);

  return {
    update,
    checkUpdates: () => {
      setUpdate({ status: 'checking' });
      void checkForUpdate().then((result) => setUpdate({ status: 'done', result }));
    },
    shareOutcome,
    share: () => {
      setShareOutcome(null);
      // The origin rather than a fixed address: a preview build passes on
      // itself, and production is only ever served from the one domain.
      void shareLink(`${window.location.origin}/`, 'Rubix').then(setShareOutcome);
    },
  };
}
