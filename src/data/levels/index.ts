// The ticket table. To add a ticket: write `<id>.ts` exporting a LevelDef and add it here (data-only change; levels.ts and the engine pick it up).
import type { LevelDef } from './types';
import { L0_0 } from './0-0';

export type * from './types';
export const LEVEL_DEFS: readonly LevelDef[] = [L0_0];
