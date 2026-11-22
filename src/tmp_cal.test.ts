import { it } from 'vitest';
import { checkAllLevels } from '@core/kit';
import { GAME } from './game';
it('cal', () => { const t0 = Date.now(); const r = checkAllLevels(GAME, { seed: 1 }); console.log('ALL ms', Date.now() - t0, JSON.stringify(r.map((x) => [x.level, x.problems.length, x.problems.slice(0, 1)]))); }, 1200000);
