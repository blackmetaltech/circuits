import { describe, it } from 'vitest';
import { Engine } from '@core/kit';
import { GAME } from '../game';
import { LEVEL_DEFS } from '../data/levels';
import { newTicketProgress, type NodeState } from './state';
function open(id: string): Engine<NodeState> {
  const e = new Engine(GAME, { mode: 'learner' }); e.autosave = false;
  const st = structuredClone(e.state) as NodeState;
  for (const d of LEVEL_DEFS.filter((x) => x.chapter === 1)) { if (d.id === id) break; st.progress.tickets[d.id] = { ...newTicketProgress(), passed: true, stars: 1 }; }
  e.setState(st); e.act('openTicket', [id]); return e;
}
const q = (e: any, n: string, ...a: unknown[]) => e.q(n, a) as any;
describe('repro', () => {
  it('floating return', () => {
    const e = open('1-5'); const a = (n: string, ...x: unknown[]) => { const r = e.act(n, x); if (!r.ok) throw new Error(n + r.message); return r; };
    a('placePart', 'res-exact', 2, 'ideal', 4, 2, 0, false); a('placePart', 'res-exact', 3, 'ideal', 10, 4, 0, false); a('placePart', 'res-exact', 6, 'ideal', 8, 7, 1, false);
    for (const w of [[[2, 2], [4, 2]], [[8, 2], [8, 6]], [[14, 2], [14, 4]], [[10, 4], [10, 6], [8, 6]], [[8, 6], [8, 7]], [[8, 11], [9, 11], [9, 13]], [[2, 8], [2, 13], [9, 13]], [[14, 8], [14, 13], [9, 13]]]) a('addWire', w);
    a('predict', 'pva', 6.6667); a('predict', 'pie2', 0.5556);
    a('power', true); a('setMeter', 'dcv', [[8, 6], [9, 13]]); a('advance', 4);
    console.log('METER', JSON.stringify(q(e, 'meter')));
    console.log('LS', JSON.stringify(q(e, 'liveStatus')));
    a('runBench'); const b = q(e, 'benchResult'); console.log(JSON.stringify(b.failures), JSON.stringify(b.specs));
  });
});
