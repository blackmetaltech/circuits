// Scripted players for playtests, soak runs and title-screen demos. They drive the real engine through Env.step.
// M0: only the idle persona exists (DESIGN §8.7 lists the full set, built with the real tickets in M2).
import type { PersonaFactory } from '@core/kit';
import type { NodeState } from './engine/state';

export const PERSONAS: Record<string, PersonaFactory<NodeState>> = {
  /** Does nothing: no ticket passes by idling (DESIGN §8.7). */
  idle: () => () => [],
};
