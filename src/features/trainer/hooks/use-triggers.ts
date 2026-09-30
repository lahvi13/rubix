import { useLiveQuery } from 'dexie-react-hooks';
import type { Trigger } from '../../../db/types';
import {
  createTrigger,
  deleteTrigger,
  isPackTrigger,
  listTriggers,
  setTriggerEnabled,
  updateTrigger,
} from '../../../db/repositories/trigger-repository';
import { parseAlg } from '../../../domain/cube/notation';
import type { TriggerDefinition } from '../../../domain/alg/triggers';

export interface TriggersView {
  triggers: Trigger[];
  /** Parsed and longest first, ready for segmenting an algorithm. */
  definitions: TriggerDefinition[];
  create: (name: string, moves: string, colour: string) => Promise<void>;
  rename: (id: string, name: string) => Promise<void>;
  rewrite: (id: string, moves: string) => Promise<void>;
  recolour: (id: string, colour: string) => Promise<void>;
  setEnabled: (id: string, enabled: boolean) => Promise<void>;
  remove: (id: string) => Promise<void>;
  /** Shipped with the app, and so switched off rather than deleted. */
  isBuiltIn: (id: string) => boolean;
}

export function useTriggers(): TriggersView {
  const triggers = useLiveQuery(listTriggers, [], []);

  return {
    triggers,
    definitions: toDefinitions(triggers),
    create: async (name, moves, colour) => {
      await createTrigger(name, moves, colour);
    },
    rename: async (id, name) => updateTrigger(id, { name }),
    rewrite: async (id, moves) => updateTrigger(id, { moves }),
    recolour: async (id, colour) => updateTrigger(id, { colour }),
    setEnabled: async (id, enabled) => setTriggerEnabled(id, enabled),
    remove: deleteTrigger,
    isBuiltIn: isPackTrigger,
  };
}

/** A trigger nobody can parse cannot match anything, so it is left out. */
export function toDefinitions(triggers: readonly Trigger[]): TriggerDefinition[] {
  return triggers.flatMap((trigger) => {
    if (trigger.isEnabled !== 1) return [];

    const parsed = parseAlg(trigger.moves);
    if (!parsed.ok || parsed.moves.length === 0) return [];
    return [{ id: trigger.id, name: trigger.name, moves: parsed.moves, colour: trigger.colour }];
  });
}
