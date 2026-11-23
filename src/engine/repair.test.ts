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
const REPAIRS = ['1-1', '1-2', '1-3', '1-4', '2-1', '3-1', '3-3', '5-1', '6-1', '6-2', '6-3', '6-4', '6-5', '6-6'];   // chapter 6 since 0.7: every op-amp job arrives faulty   // 2-1 since 0.4.0 (D-bench-ch2 delivered): the weather station arrives with its unloaded divider; 3-1 and 3-3 since D-bench-ch23
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
  it('exactly the repair tickets carry a faulty board; the exam and the other chapters do not', () => {
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
  it('1-1: Ctrl+Z through the removal of the arrived-burnt LED brings it back burnt, and powering the faulty board bills nothing (the unexplained US$1.53, 0.5)', () => {
    const e = open('1-1');
    expect(tk(e).live.smoked).toEqual(['x1']);
    ok(e, 'deletePart', 'x1');
    ok(e, 'undo');
    expect(tk(e).board.parts.some((p) => p.uid === 'x1')).toBe(true);
    expect(tk(e).live.smoked).toEqual(['x1']);                              // still the customer's burnt LED, not a free fresh one
    ok(e, 'power', true); ok(e, 'advance', 8);
    expect(tk(e).burnCost ?? 0).toBe(0);
    // an unrelated edit and its undo do not heal it either
    ok(e, 'power', false); ok(e, 'addWire', [[12, 10], [14, 10]]); ok(e, 'undo');
    expect(tk(e).live.smoked).toEqual(['x1']);
  });
  it('3-1: the flash timer arrives with a 22 uF timing capacitor: the ready-light comes on after about 0.22 s, not 1 s, and the bench says so', () => {
    const e = open('3-1'); ok(e, 'power', true); ok(e, 'advance', 4);
    const r = ok(e, 'runBench'); expect(r.pass).toBe(false);
    const b = e.q('benchResult') as any;
    const t = b.specs.find((x: any) => x.id === 'tcross');
    expect(t.pass).toBe(false);
    expect(b.measured.tcross).toBeGreaterThan(0.2); expect(b.measured.tcross).toBeLessThan(0.24);   // 10 k x 22 uF: 0.22 s to reach 63 %, clearly short of the 0.95 s floor
    expect(tk(e).board.parts.filter((p) => !p.fixed).map((p) => [p.partId, p.value])).toEqual([['res-cf', 10000], ['cap-el', 22e-6]]);
  });
  it('3-1: changing only the capacitor to 100 uF repairs it', () => {
    const e = open('3-1'); ok(e, 'setValue', 'x2', 100e-6); ok(e, 'power', true); ok(e, 'advance', 4);
    expect(ok(e, 'runBench').pass).toBe(true);
  });
  it('3-3: the irrigation relay arrives behind a 560 ohm series resistor: the coil only gets about 32 mA, it never pulls in (40 mA), and the bench fails it', () => {
    const e = open('3-3'); ok(e, 'power', true); ok(e, 'advance', 4);
    expect(ok(e, 'runBench').pass).toBe(false);
    const b = e.q('benchResult') as any;
    const pull = b.specs.find((x: any) => x.id === 'tpull'), steady = b.specs.find((x: any) => x.id === 'isteady');
    expect(pull.pass).toBe(false); expect(steady.pass).toBe(false);
    expect(b.measured.isteady).toBeGreaterThan(0.031); expect(b.measured.isteady).toBeLessThan(0.032);   // 24 V / (200 + 560) ohm = 31.6 mA
    expect(tk(e).burnCost ?? 0).toBe(0);                                    // 24 V x 31.6 mA = 0.76 W in 760 ohm: the 1 W resistor does not burn
  });
  it('3-3: changing only the series resistor to 200 ohm repairs it', () => {
    const e = open('3-3'); ok(e, 'setValue', 'x1', 200); ok(e, 'power', true); ok(e, 'advance', 4);
    expect(ok(e, 'runBench').pass).toBe(true);
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
