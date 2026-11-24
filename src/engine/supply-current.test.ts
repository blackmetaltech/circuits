// 0.7: the bench supply's AMPS display read the current of fixed part f1 (the 5-1 fan), so 6-1 on ±12 V showed 0.000 A while the op-amp
// drew current. liveFrame now reports each bench supply's output current.
import { describe, expect, it } from 'vitest';
import { Engine } from '@core/kit';
import { GAME } from '../game';
import { LEVEL_DEFS } from '../data/levels';
import { refActions } from './replay';
import { newTicketProgress, type NodeState } from './state';

function built(id: string): Engine<NodeState> {
  const e = new Engine(GAME, { mode: 'learner' }); e.autosave = false;
  const st = structuredClone(e.state) as NodeState;
  for (const d of LEVEL_DEFS) { if (d.id === id) break; st.progress.tickets[d.id] = { ...newTicketProgress(), passed: true, stars: 1 }; }
  e.setState(st); expect(e.act('openTicket', [id]).ok).toBe(true);
  for (const a of refActions(LEVEL_DEFS.find((d) => d.id === id)!)) if (!['runBench', 'power', 'advance'].includes(a.name)) expect(e.act(a.name, a.args ?? []).ok).toBe(true);
  expect(e.act('power', [true]).ok).toBe(true); e.act('advance', [6]);
  return e;
}
describe('liveFrame supplies', () => {
  it('1-3: the 12 V bench supply delivers the heater current, 8.33 V / 50 ohm = 167 mA (22 ohm 1 W ref) within 3 %', () => {
    const f = built('1-3').q('liveFrame', []) as any;
    const s = f.supplies.find((x: any) => x.id === 'psu');
    expect(s).toBeDefined();
    expect(s.i).toBeGreaterThan(0.150); expect(s.i).toBeLessThan(0.175);
  });
  it('6-1: both rails of the ±12 V supply report a current above zero (the op-amp draws its quiescent current)', () => {
    const f = built('6-1').q('liveFrame', []) as any;
    expect(f.supplies.length).toBe(2);
    for (const s of f.supplies) expect(s.i, s.id).toBeGreaterThan(1e-4);
  });
});
