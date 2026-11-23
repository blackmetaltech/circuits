// Decision 10b: repair tickets arrive with the customer's faulty board, and parts the player burns cost their replacement.
import { describe, expect, it } from 'vitest';
import { Engine } from '@core/kit';
import { GAME } from '../game';
import { LEVEL_DEFS } from '../data/levels';
import { clearFaultActions, refActions } from './replay';
import { newTicketProgress, type NodeState } from './state';
import { partPrice } from './metrics';
import { REGIONS } from '../regions';

const def = (id: string) => LEVEL_DEFS.find((d) => d.id === id)!;
const REPAIRS = ['1-1', '1-2', '1-3', '1-4', '5-1'];
function open(id: string): Engine<NodeState> {
  const e = new Engine(GAME, { mode: 'learner' }); e.autosave = false;
  const st = structuredClone(e.state) as NodeState;
  for (const d of LEVEL_DEFS) { if (d.id === id) break; st.progress.tickets[d.id] = { ...newTicketProgress(), passed: true, stars: 1 }; }
  e.setState(st);
  expect(e.act('openTicket', [id]).ok).toBe(true);
  return e;
}
const ok = (e: Engine<NodeState>, name: string, ...args: unknown[]) => { const r = e.act(name, args); expect(r.ok, `${name} ${JSON.stringify(args)}: ${r.message}`).toBe(true); return r; };
const tk = (e: Engine<NodeState>) => (e.state as NodeState).ticket!;

describe('repair tickets arrive faulty', () => {
  it('exactly the five repair tickets carry a faulty board; the exam and the other chapters do not', () => {
    expect(LEVEL_DEFS.filter((d) => d.fault).map((d) => d.id)).toEqual(REPAIRS);
  });
  it.each(REPAIRS.map((id) => [id]))('%s: the board arrives as the customer left it, it fails the bench, and the ref replay from the arrival passes', (id) => {
    const e = open(id), d = def(id)!;
    const uids = tk(e).board.parts.filter((p) => !p.fixed).map((p) => p.uid);
    expect(uids).toEqual(d.fault!.parts.map((_, i) => `x${i + 1}`));
    expect(tk(e).board.wires.filter((w) => !w.fixed).map((w) => w.wid)).toEqual(d.fault!.wires.map((_, i) => `xw${i + 1}`));
    expect(tk(e).live.smoked).toEqual(d.fault!.smoked.map((i) => `x${i + 1}`));
    ok(e, 'power', true); ok(e, 'advance', 4);
    expect(ok(e, 'runBench').pass).toBe(false);
    expect(tk(e).burnCost ?? 0).toBe(0);                                    // arrived burnt: not the player's bill
    const f = open(id);
    for (const a of refActions(d)) ok(f, a.name, ...(a.args ?? []));
    expect((f.q('benchResult') as any).pass).toBe(true);
  });
  it('1-1: the arrived torch is dark: its LED is open, so no current flows while the PP3 still reads 9 V', () => {
    const e = open('1-1'); ok(e, 'power', true); ok(e, 'advance', 4);
    const fr = e.q('liveFrame') as any;
    const led = fr.parts.find((p: any) => p.uid === 'x1');
    expect(led?.led?.mA ?? 0).toBeLessThan(0.01);
  });
  it('1-2: the dim light is fixed by changing one value: 1 k gives about 5 mA and fails, 150 ohm passes', () => {
    const e = open('1-2'); ok(e, 'power', true); ok(e, 'advance', 4);
    expect(ok(e, 'runBench').pass).toBe(false);
    ok(e, 'setValue', 'x1', 150); ok(e, 'advance', 4);
    expect(ok(e, 'runBench').pass).toBe(true);
  });
});

describe('burnt parts cost money', () => {
  it('1-1: an LED the player burns is billed as a rush replacement (its price plus the courier) and comes out of the pay', () => {
    const e = open('1-1');
    for (const a of clearFaultActions(def('1-1'))) ok(e, a.name, ...(a.args ?? []));
    ok(e, 'placePart', 'led-red-5mm', null, '5mm', 4, 5, 0, false); ok(e, 'addWire', [[2, 2], [2, 5], [4, 5]]); ok(e, 'addWire', [[6, 5], [6, 2], [8, 2]]);
    ok(e, 'power', true);
    let smoked: string[] = [];
    for (let i = 0; i < 30 && smoked.length === 0; i++) smoked = ok(e, 'advance', 8).smoked as string[];
    expect(smoked.length).toBe(1);
    const price = partPrice(REGIONS.get((e.state as NodeState).region), 'led-red-5mm', '5mm', null);
    expect(price).toBeGreaterThan(0);
    const rush = REGIONS.get((e.state as NodeState).region).data.prices['service:rush']!;
    expect(rush).toBe(150);                                                  // US$1.50: a burn is no longer a rounding error on a $5 job
    expect(tk(e).burnCost).toBe(price + rush);
    expect((e.q('bench') as any).burnCost).toBe(price + rush);
    expect((e.q('bench') as any).rushFeeText).toBe('$1.50');
    ok(e, 'power', false);
    const uid = smoked[0]!; ok(e, 'deletePart', uid);
    const ref = refActions(def('1-1')).slice(clearFaultActions(def('1-1')).length);
    for (const a of ref) ok(e, a.name, ...(a.args ?? []));
    const r = e.q('benchResult') as any;
    expect(r.pass).toBe(true);
    expect((e.state as NodeState).progress.wallet).toBe(300 + 2 * 100 - price - rush);
    expect(tk(e).burnDeducted).toBe(price + rush);
  });
  it('the sandbox never bills a burn', () => {
    const e = new Engine(GAME, { mode: 'sandbox' }); e.autosave = false; ok(e, 'openTicket', '1-1');
    for (const a of clearFaultActions(def('1-1'))) ok(e, a.name, ...(a.args ?? []));
    ok(e, 'placePart', 'led-red-5mm', null, '5mm', 4, 5, 0, false); ok(e, 'addWire', [[2, 2], [2, 5], [4, 5]]); ok(e, 'addWire', [[6, 5], [6, 2], [8, 2]]);
    ok(e, 'power', true); for (let i = 0; i < 30; i++) ok(e, 'advance', 8);
    expect(tk(e).burnCost ?? 0).toBe(0);
  });
});
