import { useCallback, useState } from 'react';
import { diagramImageUrl } from '../components/cube-diagram-svg';
import { withWhiteTop } from '../lib/cube-skins';
import { reportError } from '../lib/errors';
import { deliverShareCard, NET_WIDTH, type ShareCard } from '../lib/share-card';
import { strings } from '../lib/strings';
import { useCubeSkin } from './use-cube-skin';

export interface ShareCardView {
  /** Drawing or sharing is under way; a second tap would open a second sheet. */
  isBusy: boolean;
  /** `message` goes along with the picture where the share sheet takes one. */
  share: (card: ShareCard, filename: string, message?: string | null) => void;
}

export function useShareCard(): ShareCardView {
  const [isBusy, setBusy] = useState(false);
  const skin = useCubeSkin();

  const share = useCallback(
    (card: ShareCard, filename: string, message: string | null = null) => {
      setBusy(true);
      // White on top, as the timer draws a scramble: the one it is defined in.
      const cube =
        card.cube === null
          ? null
          : diagramImageUrl(card.cube, 'net', 'full', withWhiteTop(skin), NET_WIDTH);
      deliverShareCard(card, { faces: skin.faces, cube }, filename, message)
        .catch((cause: unknown) => reportError(strings.share.failed, cause))
        .finally(() => setBusy(false));
    },
    [skin],
  );

  return { isBusy, share };
}
