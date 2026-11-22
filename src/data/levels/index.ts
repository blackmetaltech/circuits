// The ticket table. To add a ticket: write `<id>.ts` exporting a LevelDef and add it here (data-only change; levels.ts and the engine pick it up).
// 0-0 is the engine's sample ticket (chapter 0, not on the chapter map); 1-1..1-5 are chapter 1 "First Light".
import type { LevelDef } from './types';
import { L0_0 } from './0-0';
import { L1_1 } from './1-1';
import { L1_2 } from './1-2';
import { L1_3 } from './1-3';
import { L1_4 } from './1-4';
import { L1_5 } from './1-5';
import { L2_1 } from './2-1';
import { L2_2 } from './2-2';
import { L2_3 } from './2-3';
import { L2_4 } from './2-4';
import { L3_1 } from './3-1';
import { L3_2 } from './3-2';
import { L3_3 } from './3-3';
import { L3_4 } from './3-4';
import { L4_1 } from './4-1';
import { L4_2 } from './4-2';
import { L4_3 } from './4-3';
import { L4_4 } from './4-4';
import { L4_5 } from './4-5';
import { L5_1 } from './5-1';
import { L5_2 } from './5-2';
import { L5_3 } from './5-3';
import { L5_4 } from './5-4';
import { L5_5 } from './5-5';

export type * from './types';
export const LEVEL_DEFS: readonly LevelDef[] = [L0_0, L1_1, L1_2, L1_3, L1_4, L1_5, L2_1, L2_2, L2_3, L2_4, L3_1, L3_2, L3_3, L3_4, L4_1, L4_2, L4_3, L4_4, L4_5, L5_1, L5_2, L5_3, L5_4, L5_5];
