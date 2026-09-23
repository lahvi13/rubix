import { useCallback, useState } from 'react';
import { reportError } from '../lib/errors';
import { deliverShareCard, type ShareCard } from '../lib/share-card';
import { strings } from '../lib/strings';
import { useCubeSkin } from './use-cube-skin';

export interface ShareCardView {
  /** Drawing or sharing is under way; a second tap would open a second sheet. */
  isBusy: boolean;
  share: (card: ShareCard, filename: string) => void;
}

export function useShareCard(): ShareCardView {
  const [isBusy, setBusy] = useState(false);
  const { faces } = useCubeSkin();

  const share = useCallback((card: ShareCard, filename: string) => {
    setBusy(true);
    deliverShareCard(card, { faces }, filename)
      .catch((cause: unknown) => reportError(strings.share.failed, cause))
      .finally(() => setBusy(false));
  }, [faces]);

  return { isBusy, share };
}
