// The ticket table. To add a ticket: write `<id>.ts` exporting a LevelDef and add it here (data-only change; levels.ts and the engine pick it up).
// 0-0 is the engine's sample ticket (chapter 0, not on the chapter map); 1-1..1-5 are chapter 1 "First Light".
import type { LevelDef } from './types';
import { L0_0 } from './0-0';
import { L1_1 } from './1-1';
import { L1_2 } from './1-2';
import { L1_3 } from './1-3';
import { L1_4 } from './1-4';
import { L1_5 } from './1-5';

export type * from './types';
export const LEVEL_DEFS: readonly LevelDef[] = [L0_0, L1_1, L1_2, L1_3, L1_4, L1_5];
