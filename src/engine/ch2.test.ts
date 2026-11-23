// Chapter 2 "Divide & Measure" (tickets 2-1 .. 2-4): every naive build fails for the stated reason, every ref passes, bands are calibrated with margins, and the UI queries
// (bench, liveFrame, ticketCard, coach, scope, dmm, chapterMap) answer from the real engine. DESIGN §2.8, docs/API-CH2.md.
import { describe, expect, it } from 'vitest';
import { Engine } from '@core/kit';
import { GAME } from '../game';
import { LEVEL_DEFS } from '../data/levels';
import { eseries } from '../data/eseries';
import { solveCards } from '../sim/oracles/util';
import { clearFaultActions, refActions } from './replay';
import { newTicketProgress, type NodeState } from './state';

const def = (id: string) => LEVEL_DEFS.find((d) => d.id === id)!;
/** A fresh engine with the earlier tickets passed (so `id` is unlocked), the ticket open. */
function open(id: string, passed: string[] = ['1-4', '2-1', '2-2'], mode = 'learner', clear = true): Engine<NodeState> {
  const e = new Engine(GAME, { mode }); e.autosave = false;
  const st = structuredClone(e.state) as NodeState;
  for (const d of passed) st.progress.tickets[d] = { ...newTicketProgress(), passed: true, stars: 1 };
  e.setState(st);
  expect(e.act('openTicket', [id]).ok, `open ${id}`).toBe(true);
  // a repair ticket (2-1 since phase C) arrives with the customer's board: the player clears the old work first, as in ch1.test
  if (clear) for (const a of clearFaultActions(LEVEL_DEFS.find((d) => d.id === id)!)) expect(e.act(a.name, a.args ?? []).ok, `${a.name} ${String(a.args)}`).toBe(true);
  return e;
}
const st = (e: Engine<NodeState>): NodeState => e.state as NodeState;
const ok = (e: Engine<NodeState>, name: string, ...args: unknown[]) => { const r = e.act(name, args); expect(r.ok, `${name} ${JSON.stringify(args)}: ${r.message}`).toBe(true); return r; };
const bad = (e: Engine<NodeState>, name: string, ...args: unknown[]) => { const r = e.act(name, args); expect(r.ok, `${name} should be refused`).toBe(false); return r.message; };
const q = (e: Engine<NodeState>, name: string, ...args: unknown[]) => e.q(name, args) as any;
const bench = (e: Engine<NodeState>) => { ok(e, 'runBench'); return q(e, 'benchResult'); };
const spec = (b: any, id: string) => b.specs.find((x: any) => x.id === id);
const runRef = (e: Engine<NodeState>, id: string) => { for (const a of refActions(def(id)).slice(clearFaultActions(def(id)).length).filter((x) => x.name !== 'runBench' && x.name !== 'power' && x.name !== 'advance')) ok(e, a.name, ...(a.args ?? [])); };
const powerUp = (e: Engine<NodeState>, frames = 3) => { ok(e, 'power', true); return ok(e, 'advance', frames); };
const galvo = (e: Engine<NodeState>) => q(e, 'liveFrame').parts.find((p: any) => p.galvo).galvo;
const texts = (b: any): string => b.failures.map((f: any) => f.text).join(' | ');

// ---------------------------------------------------------------- unlocking
describe('chapter 2 unlocks after 1-4 or the 1-5 exam', () => {
  it('2-1 is locked on a fresh save, opens after 1-4 alone or after the 1-5 exam alone', () => {
    const e = new Engine(GAME, { mode: 'learner' }); e.autosave = false;
    expect(bad(e, 'openTicket', '2-1')).toMatch(/1-4 or 1-5/);
    for (const id of ['1-4', '1-5']) { const x = open('2-1', [id]); expect(st(x).ticket!.id).toBe('2-1'); }
  });
  it('the rest of the chapter unlocks together after 2-1; the exam after 2-1 and one more build ticket', () => {
    const e = new Engine(GAME, { mode: 'learner' }); e.autosave = false;
    const set = (ids: string[]) => { const s = structuredClone(e.state) as NodeState; s.progress.tickets = {}; for (const d of ids) s.progress.tickets[d] = { ...newTicketProgress(), passed: true, stars: 1 }; e.setState(s); };
    set(['1-4']); expect(q(e, 'chapterMap', 2).tickets.map((t: any) => t.state)).toEqual(['open', 'locked', 'locked', 'locked']);
    set(['1-4', '2-1']); expect(q(e, 'chapterMap', 2).tickets.map((t: any) => t.state)).toEqual(['passed', 'open', 'open', 'locked']);
    set(['1-4', '2-1', '2-3']); expect(q(e, 'chapterMap', 2).tickets.map((t: any) => t.state)).toEqual(['passed', 'open', 'passed', 'open']);
    set(['1-4', '2-1']); expect(bad(e, 'openTicket', '2-4')).toMatch(/Pass 2-2 or 2-3 first/); set(['1-4']); expect(bad(e, 'openTicket', '2-4')).toMatch(/Pass 2-1, 2-2 or 2-3 first/);
    const m = q(e, 'chapterMap', 2); expect(m.title).toBe('Divide & Measure'); expect(m.blurb).toMatch(/four jobs/); expect(m.starsTotal).toBe(2 + 2 + 2 + 3);
    expect(q(e, 'chapterMap', 1).tickets).toHaveLength(5);
  });
});

// ---------------------------------------------------------------- 2-1
describe('2-1 Sensor Reference', () => {
  const build = (r1: number, r2: number) => {
    const e = open('2-1', ['1-4']);
    ok(e, 'placePart', 'res-cf', r1, '0.25W', 4, 2, 0, false); ok(e, 'placePart', 'res-cf', r2, '0.25W', 8, 4, 1, false);
    for (const w of [[[2, 2], [4, 2]], [[8, 2], [14, 2]], [[8, 4], [8, 2]], [[8, 8], [14, 8]]]) ok(e, 'addWire', w);
    return e;
  };
  const loaded = (r1: number, r2: number): number => { const par = (r2 * 1e4) / (r2 + 1e4); return (9 * par) / (r1 + par); };
  it('the ref (15 kohm over 82 kohm: 3.355 V at 3.39 mW) passes with 2 stars and pays the fee plus the power-par bonus', () => {
    const e = open('2-1', ['1-4']); runRef(e, '2-1'); const b = bench(e);
    expect(b.pass).toBe(true); expect(b.stars).toBe(2); expect(b.metrics).toMatchObject({ parts: 2, cost: 4 }); expect(b.metrics.power).toBeGreaterThan(3380); expect(b.metrics.power).toBeLessThan(3395);
    expect(spec(b, 'vout').margin).toBeGreaterThan(0.012); expect(b.pay).toBe(500 + 2 * 150); expect(q(e, 'wallet')).toMatchObject({ minor: 800, text: '$8.00' });
    powerUp(e); const s = q(e, 'scope'); expect(s.target).toMatchObject({ spec: 'vout', unit: 'V', lo: 3.234, hi: 3.366, mode: 'probe' });
  });
  it('the unloaded-divider answer 5.6 kohm / 3.3 kohm fails at 2.76 V and the explainer names the ADC load in parallel with the bottom resistor', () => {
    const b = bench(build(5600, 3300)); expect(b.pass).toBe(false); expect(spec(b, 'vout').pass).toBe(false);
    expect(texts(b)).toMatch(/2\.76 V/); expect(texts(b)).toMatch(/3\.34 V/); expect(texts(b)).toMatch(/10 kΩ/); expect(texts(b)).toMatch(/parallel/);
    expect(loaded(5600, 3300)).toBeCloseTo(2.763, 3);
  });
  it('the passing E12 pairs (1 k - 100 k): eleven pass the 2 % band with the 10 kohm load; the design values 6.8k/6.8k 7.5 mW and 2.7k/1.8k 19 mW hold', () => {
    const E = eseries('E12', 1e3, 1e5), pass: [number, number][] = [];
    for (const r1 of E) for (const r2 of E) { const v = loaded(r1, r2); if (v >= 3.234 && v <= 3.366) pass.push([r1, r2]); }
    expect(pass.length).toBe(10);   // (560 / 330 passes too, but lives below the 1 k floor of the bin)
    const power = (r1: number, r2: number): number => 81 / (r1 + (r2 * 1e4) / (r2 + 1e4)) * 1e3;
    expect(power(6800, 6800)).toBeCloseTo(7.47, 2); expect(power(2700, 1800)).toBeCloseTo(19.2, 1); expect(power(15000, 82000)).toBeCloseTo(3.387, 3);
    expect(pass.map(([a, c]) => power(a, c)).sort((x, y) => x - y)[0]).toBeCloseTo(3.387, 3);
    for (const [r1, r2] of [[15000, 68000], [4700, 3900], [2700, 1800], [6800, 6800]] as [number, number][]) expect(bench(build(r1, r2)).pass, `${r1}/${r2}`).toBe(true);
    for (const [r1, r2] of [[15000, 47000], [1000, 1000], [10000, 10000], [5600, 3300]] as [number, number][]) expect(bench(build(r1, r2)).pass, `${r1}/${r2}`).toBe(false);
  });
  it('a divider that wastes power (2.7 kohm / 1.8 kohm, 19 mW) passes with ONE star: the power par is 5 mW', () => {
    const b = bench(build(2700, 1800)); expect(b.pass).toBe(true); expect(b.stars).toBe(1); expect(b.metrics.power).toBeGreaterThan(19000);
  });
  it('the coach asks for two resistors, the divider wiring, power, then the optional meter; the DMM reads the loaded 3.35 V', () => {
    const e = open('2-1', ['1-4']); let c = q(e, 'coach'); expect(c.active).toBe('place'); expect(c.anchor).toMatchObject({ target: 'bin', partId: 'res-cf' }); expect(c.text).toMatch(/Kaya/);
    runRef(e, '2-1'); c = q(e, 'coach'); expect(c.active).toBe('power'); expect(c.anchor.target).toBe('power');
    powerUp(e); expect(q(e, 'coach').active).toBe('measure'); ok(e, 'dmmLead', 'red', [14, 2]); ok(e, 'dmmLead', 'black', [14, 8]); expect(q(e, 'dmm').display.value).toBeCloseTo(3.3545, 2);
    c = q(e, 'coach'); expect(c.active).toBe('run-bench'); expect(c.text).toMatch(/^Run the bench/);
    expect(q(e, 'scope').lock).toBe(true);   // the live LOCK is the level on the live solution: the scope clip only draws the trace
  });
  it('the shoebox offers E12 1 k - 100 k in 1/4 W only; the supply is fixed at 9 V and the ADC is a fixed 10 kohm between OUT and GND', () => {
    const e = open('2-1', ['1-4']); const card = q(e, 'ticketCard'); const res = card.shoebox.find((f: any) => f.partId === 'res-cf');
    expect(res.values).toHaveLength(25); expect(res.values[0]).toBe(1000); expect(res.values[24]).toBe(1e5); expect(res.variants.map((v: any) => v.id)).toEqual(['0.25W']);
    expect(card.conditions).toEqual([{ id: 'nominal', set: [{ target: 'psu', key: 'v', value: 9 }, { target: 'psu', key: 'ilim', value: 0.5 }], ambientC: 25 }]);
    const fixed = q(e, 'bench').parts.find((p: any) => p.fixed); expect(fixed).toMatchObject({ partId: 'adc-in', name: 'ADC input', pins: [{ pad: [14, 2] }, { pad: [14, 8] }] });
  });
});

// ---------------------------------------------------------------- 2-2
describe('2-2 Cable Fault', () => {
  const ref = (jockey = 400, passed = ['1-4', '2-1']) => { const e = open('2-2', passed); runRef(e, '2-2'); ok(e, 'setJockey', 'f3', jockey); return e; };
  /** The metre bridge with a box plug R: balance at l = R L / (R + X) from end A. */
  const wireWith = (e: Engine<NodeState>, r: number) => {
    ok(e, 'placePart', 'res-box', r, 'plug', 3, 5, 0, false); ok(e, 'placePart', 'galvanometer', null, '100ohm', 13, 8, 0, false);
    for (const w of [[[2, 2], [2, 11]], [[22, 11], [22, 2]], [[3, 5], [3, 11], [2, 11]], [[7, 5], [11, 5]], [[17, 5], [20, 5], [20, 11], [22, 11]], [[11, 5], [11, 8], [13, 8]], [[19, 8], [19, 10], [12, 10], [12, 9]]]) ok(e, 'addWire', w);
  };
  it('the ref (R 5 ohm, balance at l = 40.0 cm, X = 7.5 ohm, d = 75.0 m) passes with 2 stars: the needle is on zero and the answer is exact', () => {
    const e = ref(); const b = bench(e);
    expect(b.pass).toBe(true); expect(b.stars).toBe(2); expect(b.metrics.accuracy).toBe(0); expect(spec(b, 'ig').pass).toBe(true); expect(spec(b, 'dist').pass).toBe(true);
    expect(spec(b, 'ig').margin).toBeGreaterThan(0.0000099); expect(b.pay).toBe(600 + 2 * 200);
    powerUp(e); expect(Math.abs(galvo(e).uA)).toBeLessThan(0.01); expect(galvo(e).needle).toBeCloseTo(0, 3);
    const s = q(e, 'scope'); expect(s.target).toMatchObject({ spec: 'ig', unit: 'µA', lo: 0, hi: 10, mode: 'gauge' }); expect(s.lock).toBe(true); expect(s.gauge.value).toBeLessThan(0.01); expect(s.gauge.inBand).toBe(true);
  });
  it('the needle is the signed current in units of its +-50 uA full scale: about 16 uA per millimetre of jockey travel', () => {
    const e = ref(); powerUp(e);
    for (const [mm, uA] of [[399, -16.08], [401, 16.08], [405, 80.4]] as [number, number][]) { ok(e, 'setJockey', 'f3', mm); ok(e, 'advance', 1); expect(galvo(e).uA).toBeCloseTo(uA, 1); }
    ok(e, 'setJockey', 'f3', 401); ok(e, 'advance', 1); expect(galvo(e).needle).toBeCloseTo(0.3216, 3); ok(e, 'setJockey', 'f3', 440); ok(e, 'advance', 1); expect(galvo(e).needle).toBe(1.15);   // pegged at the stop
  });
  it('the null needs the jockey within about 0.6 mm: 399.4 passes the 10 uA spec, 399.3 does not (the LOCK follows the same band)', () => {
    const e = ref(399.4); powerUp(e); expect(q(e, 'scope').lock).toBe(true); expect(bench(e).pass).toBe(true);
    const f = ref(399.3); powerUp(f); expect(q(f, 'scope').lock).toBe(false); const b = bench(f); expect(b.pass).toBe(false); expect(spec(b, 'ig').pass).toBe(false);
    expect(texts(b)).toMatch(/galvanometer reads 11\.\d µA/); expect(texts(b)).toMatch(/within 10 µA of zero/);
  });
  it('a wrongly wired bridge never nulls: the needle deflects one way whatever the jockey does', () => {
    const e = open('2-2', ['1-4', '2-1']); ok(e, 'placePart', 'res-box', 5, 'plug', 3, 5, 0, false); ok(e, 'placePart', 'galvanometer', null, '100ohm', 13, 8, 0, false);
    for (const w of [[[2, 2], [2, 11]], [[22, 11], [22, 2]], [[3, 5], [3, 11], [2, 11]], [[7, 5], [11, 5]], [[17, 5], [20, 5], [20, 11], [22, 11]], [[11, 5], [11, 8], [13, 8]], [[19, 8], [22, 8], [22, 11]]]) ok(e, 'addWire', w);   // galvanometer from C to end B, not to the jockey
    powerUp(e); const signs = new Set<number>();
    for (let mm = 0; mm <= 1000; mm += 50) { ok(e, 'setJockey', 'f3', mm); ok(e, 'advance', 1); const u = galvo(e).uA; expect(Math.abs(u), `at ${mm} mm`).toBeGreaterThan(10); signs.add(Math.sign(u)); }
    expect(signs.size).toBe(1); ok(e, 'predict', 'dist', 75); const b = bench(e); expect(b.pass).toBe(false); expect(spec(b, 'ig').pass).toBe(false); expect(texts(b)).toMatch(/wired wrongly/);
  });
  it('the formula the wrong way round passes the null and fails the distance: 33.3 m instead of 75 m, and the failure uses your R and l', () => {
    const e = ref(); ok(e, 'predict', 'dist', 33.3); const b = bench(e);
    expect(b.pass).toBe(false); expect(spec(b, 'ig').pass).toBe(true); expect(spec(b, 'dist').pass).toBe(false);
    expect(texts(b)).toMatch(/33\.3 m/); expect(texts(b)).toMatch(/R = 5 Ω at l = 40 cm/); expect(texts(b)).toMatch(/× 1\.5/); expect(texts(b)).not.toMatch(/75/);   // the working is shown, the answer is not
  });
  it('the distance is checked to 1 %: 74.4 m passes (0.8 %) and 76 m fails (1.33 %); no answer on the slip refuses the pass', () => {
    const lo = ref(); ok(lo, 'predict', 'dist', 74.4); const a = bench(lo); expect(a.pass).toBe(true); expect(a.metrics.accuracy).toBe(8000); expect(a.stars).toBe(1);   // accuracy par is 3000 ppm
    const hi = ref(); ok(hi, 'predict', 'dist', 76); expect(bench(hi).pass).toBe(false);
    const none = open('2-2', ['1-4', '2-1']); runRef(none, '2-2'); const st2 = st(none).ticket!; delete st2.predictions.dist; expect(bench(none).failures.map((f: any) => f.text).join(' ')).toMatch(/Write your answer on the slip/);
    expect(q(none, 'ticketCard').answers).toEqual([{ id: 'dist', name: 'Your distance to the fault within 1 % of the true one', unit: 'm', entered: null, side: 'left', formula: 'X = R (100 - l) / l' }]);
  });
  it('another plug works too, as long as the null is found: R 10 ohm balances at 57.14 cm; R 1 ohm at 11.76 cm (near the end, the same null is 5x touchier in distance)', () => {
    for (const [r, l] of [[10, 571.4], [20, 727.3], [1, 117.6], [2, 210.5]] as [number, number][]) {
      const e = open('2-2', ['1-4', '2-1']); wireWith(e, r); ok(e, 'setJockey', 'f3', l); ok(e, 'predict', 'dist', 75); powerUp(e);
      expect(Math.abs(galvo(e).uA), `R ${r}`).toBeLessThan(10); const b = bench(e); expect(b.pass, `R ${r}: ${texts(b)}`).toBe(true);
    }
  });
  it('Engineer draws X from 2-20 ohm (3 significant figures) and the answer follows it', () => {
    const e = open('2-2', ['1-4', '2-1'], 'engineer'); const x = st(e).ticket!.hidden.x!; expect(x).toBeGreaterThanOrEqual(2); expect(x).toBeLessThanOrEqual(20);
    wireWith(e, 5); const l = (5 * 1000) / (5 + x); ok(e, 'setJockey', 'f3', Math.round(l * 10) / 10); ok(e, 'predict', 'dist', x / 0.1); const b = bench(e);
    expect(spec(b, 'dist').pass).toBe(true); expect(b.metrics.accuracy).toBeLessThan(3000);
  });
  it('the coach follows Wren: galvanometer, plug, bridge wiring, GND, power, null, the crew slip, bench', () => {
    const e = open('2-2', ['1-4', '2-1']); const act = () => q(e, 'coach').active;
    expect(act()).toBe('galvo'); ok(e, 'placePart', 'galvanometer', null, '100ohm', 13, 8, 0, false); expect(act()).toBe('box');
    ok(e, 'placePart', 'res-box', 5, 'plug', 3, 5, 0, false); expect(act()).toBe('wire'); expect(q(e, 'coach').anchor).toMatchObject({ target: 'part', partId: 'cable-loop', pad: [11, 5] });
    for (const w of [[[2, 2], [2, 11]], [[3, 5], [3, 11], [2, 11]], [[7, 5], [11, 5]], [[17, 5], [20, 5], [20, 11], [22, 11]], [[11, 5], [11, 8], [13, 8]], [[19, 8], [19, 10], [12, 10], [12, 9]]]) ok(e, 'addWire', w);
    expect(act()).toBe('ground'); ok(e, 'addWire', [[22, 11], [22, 2]]); expect(act()).toBe('power');
    ok(e, 'power', true); expect(act()).toBe('null'); expect(q(e, 'coach').anchor.target).toBe('jockey');
    ok(e, 'setJockey', 'f3', 400); expect(act()).toBe('answer'); ok(e, 'predict', 'dist', 75); expect(act()).toBe('run-bench');
    ok(e, 'runBench'); expect(act()).toBe('done'); expect(q(e, 'coach').text).toMatch(/Foreman Dunn/);
  });
  it('the slide wire is a fixed part with the jockey terminal on its own pad; the jockey moves in 0.1 mm steps between 0 and 1000 mm', () => {
    const e = open('2-2', ['1-4', '2-1']); const w = q(e, 'bench').parts.find((p: any) => p.partId === 'slidewire-m');
    expect(w).toMatchObject({ fixed: true, kind: 'SLIDEWIRE', pos: null, pins: [{ name: 'A', pad: [2, 11] }, { name: 'J', pad: [12, 9] }, { name: 'B', pad: [22, 11] }] });
    ok(e, 'setJockey', 'f3', 333.33); expect(q(e, 'bench').parts.find((p: any) => p.uid === 'f3').pos).toBeCloseTo(0.3333, 9); expect(bad(e, 'setJockey', 'f3', 1200)).toMatch(/0 to 1000 mm/);
    expect(bad(e, 'deletePart', 'f3')).toMatch(/part of the ticket/);
  });
});

// ---------------------------------------------------------------- 2-3
describe('2-3 Black Box', () => {
  const supply = (e: Engine<NodeState>, v: number) => ok(e, 'setSupply', v, 0.5);
  const serial = (e: Engine<NodeState>, rs: number[], v: number) => {
    let x = 4; const wires: number[][][] = [[[2, 2], [4, 2]]];
    rs.forEach((r, i) => { ok(e, 'placePart', 'res-cf', r, '0.25W', x, 2, 0, false); if (i > 0) wires.push([[x - 1, 2], [x, 2]]); x += 5; });
    wires.push([[x - 6 + 4, 2], [14, 2]]); void wires; supply(e, v); return x;
  };
  it('the ref (8.00 V + 1.1 kohm + 33 ohm = 1133 ohm) passes all four loads with 2 stars; the worst error is 0.3 %', () => {
    const e = open('2-3', ['1-4', '2-1']); runRef(e, '2-3'); ok(e, 'dmmLead', 'red', [2, 12]); ok(e, 'dmmLead', 'black', [14, 8]);
    const b = bench(e); expect(b.pass).toBe(true); expect(b.stars).toBe(2); expect(b.metrics.parts).toBe(2); expect(spec(b, 'match').margin).toBeGreaterThan(0.01);   // volts: 2 % of 0.647 V less the 0.3 % gap
    expect(b.pay).toBe(700 + 2 * 200);
  });
  it('the sealed box: open-circuit 8.000 V and short-circuit 7.04 mA on the meter (Voc / Isc = 1136.7 + the meter\'s 0.1 ohm)', () => {
    const e = open('2-3', ['1-4', '2-1']); powerUp(e);
    ok(e, 'dmmLead', 'red', [2, 12]); ok(e, 'dmmLead', 'black', [14, 8]); expect(q(e, 'dmm')).toMatchObject({ mode: 'dcv', valid: true }); expect(q(e, 'dmm').value).toBeCloseTo(8.0, 3);
    ok(e, 'dmmDial', 'dca'); ok(e, 'advance', 1); expect(q(e, 'dmm').display).toMatchObject({ unit: 'mA' }); expect(q(e, 'dmm').display.value).toBeCloseTo(7.0375, 3);
    const rth = 8.0 / (q(e, 'dmm').value as number); expect(rth).toBeGreaterThan(1130); expect(rth).toBeLessThan(1140);
  });
  it('matching only the open-circuit voltage passes "open" and fails the loaded tests: 8.00 V straight to OUT gives 7.27 V where the box gives 0.647 V at 100 ohm', () => {
    const e = open('2-3', ['1-4', '2-1']); ok(e, 'placePart', 'res-cf', 10, '0.25W', 4, 2, 0, false); ok(e, 'addWire', [[2, 2], [4, 2]]); ok(e, 'addWire', [[8, 2], [14, 2]]); supply(e, 8);
    ok(e, 'dmmLead', 'red', [2, 12]); ok(e, 'dmmLead', 'black', [14, 8]); const b = bench(e);
    expect(b.pass).toBe(false); const conds = b.failures.map((f: any) => f.vars.cond); expect(conds).toEqual(expect.arrayContaining(['100 ohm load', '1 kilohm load', '10 kilohm load'])); expect(conds).not.toContain('open circuit');
    expect(b.failures[0].text).toMatch(/100 ohm load on OUT your replacement gave 7\.27 V, the sealed box 0\.647 V/); expect(b.failures[0].text).toMatch(/series resistance is too small/);
  });
  it('too much series resistance sags too far and the text says so; the wrong supply voltage fails "open" first', () => {
    const e = open('2-3', ['1-4', '2-1']); runRef(e, '2-3'); ok(e, 'setValue', 'p1', 2200); ok(e, 'dmmLead', 'red', [2, 12]); ok(e, 'dmmLead', 'black', [14, 8]);
    const b = bench(e); expect(b.pass).toBe(false); expect(texts(b)).toMatch(/sags more under load/); expect(texts(b)).toMatch(/series resistance is too big/);
    const f = open('2-3', ['1-4', '2-1']); runRef(f, '2-3'); supply(f, 6); ok(f, 'dmmLead', 'red', [2, 12]); ok(f, 'dmmLead', 'black', [14, 8]);
    const c = bench(f); expect(c.failures.some((x: any) => x.vars.cond === 'open circuit')).toBe(true); expect(texts(c)).toMatch(/Set the bench supply to the open-circuit voltage/);
  });
  it('one part is enough (7.90 V + 1.1 kohm: worst error 1.8 %), so the reference is not the minimum: the parts par is 2', () => {
    const e = open('2-3', ['1-4', '2-1']); ok(e, 'placePart', 'res-cf', 1100, '0.25W', 4, 2, 0, false); ok(e, 'addWire', [[2, 2], [4, 2]]); ok(e, 'addWire', [[8, 2], [14, 2]]); supply(e, 7.9);
    ok(e, 'dmmLead', 'red', [2, 12]); ok(e, 'dmmLead', 'black', [14, 8]); const b = bench(e); expect(b.pass).toBe(true); expect(b.metrics.parts).toBe(1); expect(b.stars).toBe(2);
  });
  it('the bench will not run until the meter has been on the box (measure it first), and the trimmer is a value from a list of ten', () => {
    const e = open('2-3', ['1-4', '2-1']); runRef(e, '2-3'); const r = e.act('runBench', [true]); expect(r.ok).toBe(false); expect(r.message).toMatch(/Measure the sealed box first/);
    ok(e, 'dmmLead', 'red', [2, 12]); ok(e, 'dmmLead', 'black', [14, 8]); expect(e.act('runBench', [true]).ok).toBe(true);
    const tri = q(e, 'ticketCard').shoebox.find((f: any) => f.partId === 'trimmer'); expect(tri.values).toEqual([100, 200, 300, 400, 500, 600, 700, 800, 900, 1000]); expect(tri.max).toBe(1);
    const res = q(e, 'ticketCard').shoebox.find((f: any) => f.partId === 'res-cf'); expect(res.values).toContain(1100); expect(res.values).toContain(33); expect(res.values[0]).toBe(10);
  });
  it('the box hides its numbers: the bench and the card show no EMF or resistance, the Learner box has no rating to read, and the coach walks measure, supply, build, wire, bench', () => {
    const e = open('2-3', ['1-4', '2-1']); const dump = JSON.stringify([q(e, 'bench'), q(e, 'ticketCard')]); expect(dump).not.toMatch(/1136|8\.000|"emf"/);
    const act = () => q(e, 'coach').active; expect(act()).toBe('power'); ok(e, 'power', true); expect(act()).toBe('voc'); expect(q(e, 'coach').anchor.target).toBe('dmm');
    ok(e, 'dmmLead', 'red', [2, 12]); ok(e, 'dmmLead', 'black', [14, 8]); expect(act()).toBe('supply'); expect(q(e, 'coach').anchor.target).toBe('supplyv'); expect(q(e, 'coach').text).toMatch(/Optional: Turn the dial to mA/);
    supply(e, 8); expect(act()).toBe('place'); runRef(e, '2-3'); expect(act()).toBe('run-bench'); ok(e, 'runBench'); expect(act()).toBe('done'); expect(q(e, 'coach').text).toMatch(/Tomo/);
  });
  it('Engineer seeds the box (4-12 V behind 300-3000 ohm) and the supply moves in 10 mV steps', () => {
    const e = open('2-3', ['1-4', '2-1'], 'engineer'); const h = st(e).ticket!.hidden; expect(h.vth).toBeGreaterThanOrEqual(4); expect(h.vth).toBeLessThanOrEqual(12); expect(h.rth).toBeGreaterThanOrEqual(300); expect(h.rth).toBeLessThanOrEqual(3000);
    ok(e, 'setSupply', 8.004, 0.5); expect(q(e, 'bench').instruments.supply.v).toBe(8); void serial;
  });
});

// ---------------------------------------------------------------- 2-4
describe('2-4 EB: Slide-wire Potentiometer', () => {
  const build = (rh: number, jock = 750) => {
    const e = open('2-4', ['1-4', '2-1', '2-2']);
    ok(e, 'placePart', 'rheostat', rh, 'ideal', 6, 2, 0, false); ok(e, 'placePart', 'galvanometer', null, '100ohm', 12, 7, 0, false);
    for (const w of [[[16, 2], [10, 2]], [[6, 2], [2, 2], [2, 11]], [[22, 11], [22, 2]], [[4, 5], [3, 5], [3, 11], [2, 11]], [[10, 5], [10, 7], [12, 7]], [[18, 7], [18, 10], [12, 10], [12, 9]]]) ok(e, 'addWire', w);
    ok(e, 'setJockey', 'f3', jock); return e;
  };
  const predict = (e: Engine<NodeState>, g = 0.02, emf = 1.5, r = 0.5) => { ok(e, 'predict', 'pgrad', g); ok(e, 'predict', 'pemf', emf); ok(e, 'predict', 'pr', r); };
  it('the ref (10 ohm rheostat) balances at 75.0 cm open circuit and 67.5 cm shunted: 3 stars with the three predictions exact; the debrief works the potentiometer out', () => {
    const e = open('2-4', ['1-4', '2-1', '2-2']); runRef(e, '2-4'); const b = bench(e);
    expect(b.pass).toBe(true); expect(b.stars).toBe(3); expect(b.pay).toBe(800 + 3 * 150); expect(b.predictions.map((p: any) => [p.id, p.grade])).toEqual([['pgrad', 'exact'], ['pemf', 'exact'], ['pr', 'exact']]);
    expect(spec(b, 'ig').margin).toBeGreaterThan(0.0000194); expect(b.metrics.parts).toBe(2);
    const d = b.debrief; expect(d.answer).toBe('r = 0.5 ohm'); expect(d.working).toHaveLength(5); expect(d.working[1]).toMatch(/gradient is k = 0\.2 x 10 \/ 100 = 0\.02 V per cm/);
    expect(d.working[2]).toMatch(/E = k x l1 = 0\.02 x 75 = 1\.5 V/); expect(d.working[3]).toMatch(/V = k x l2 = 0\.02 x 67\.5 = 1\.35 V/); expect(d.working[4]).toMatch(/4\.5 x \(75 - 67\.5\) \/ 67\.5 = 0\.5 ohm/);
    expect(d.rows.map((r: any) => [r.unit, r.ok])).toEqual([['V/cm', true], ['V', true], ['ohm', true]]); expect(d.starsText).toMatch(/3 stars/); expect(d.currents[0].text).toMatch(/null method is robust/);
  });
  it('the exam card: figure data, the printed numbers, units on the slip and the star rule', () => {
    const e = open('2-4', ['1-4', '2-1', '2-2']); const c = q(e, 'ticketCard');
    expect(c.eb).toBe(true); expect(c.figure).toMatchObject({ kind: 'pot', pot: { driverV: 4, rheostat: 10, wireCm: 100, wireOhm: 10, l1Cm: 75, l2Cm: 67.5, shunt: 4.5 } });
    expect(c.predictions.map((p: any) => [p.id, p.unit, p.entered])).toEqual([['pgrad', 'V/cm', null], ['pemf', 'V', null], ['pr', 'ohm', null]]); expect(c.starRule).toMatch(/within 1 %/);
    expect(c.shoebox.find((f: any) => f.partId === 'rheostat').values).toEqual([5, 10, 20]); expect(c.brief).toMatch(/75\.0 cm/); expect(c.brief).toMatch(/67\.5 cm/);
  });
  it('the live LOCK is the open-circuit balance: 75.0 cm locks, 0.1 cm either side still does, 0.2 cm off does not; the needle shows the way', () => {
    const e = build(10); predict(e); powerUp(e); expect(q(e, 'scope').lock).toBe(true); expect(Math.abs(galvo(e).uA)).toBeLessThan(0.01);
    ok(e, 'setJockey', 'f3', 749); ok(e, 'advance', 1); expect(q(e, 'scope').lock).toBe(true); expect(galvo(e).uA).toBeCloseTo(-19.01, 1);
    ok(e, 'setJockey', 'f3', 748); ok(e, 'advance', 1); expect(q(e, 'scope').lock).toBe(false); expect(galvo(e).uA).toBeLessThan(-37);
    ok(e, 'setJockey', 'f3', 751); ok(e, 'advance', 1); expect(galvo(e).uA).toBeGreaterThan(18);
  });
  it('the wrong rheostat changes the gradient and misses both balance marks: 5 ohm (0.0267 V/cm) and 20 ohm (0.0133 V/cm) fail the build', () => {
    for (const rh of [5, 20]) { const e = build(rh); predict(e); const b = bench(e); expect(b.pass, `${rh}`).toBe(false); expect(spec(b, 'ig').pass).toBe(false); expect(texts(b)).toMatch(/rheostat sets how much voltage the wire carries/); }
  });
  it('the test cell on the wrong end fails the balance, and a missing prediction refuses the bench', () => {
    const e = open('2-4', ['1-4', '2-1', '2-2']); runRef(e, '2-4'); const s2 = st(e).ticket!; s2.predictions = {};
    const b = bench(e); expect(b.pass).toBe(false); expect(b.failures.map((f: any) => f.key)).toContain('bench.predict.missing'); expect(texts(b)).toMatch(/not entered a prediction|have not entered/i);
    const w = open('2-4', ['1-4', '2-1', '2-2']); ok(w, 'placePart', 'rheostat', 10, 'ideal', 6, 2, 0, false); ok(w, 'placePart', 'galvanometer', null, '100ohm', 12, 7, 0, false);
    for (const p of [[[16, 2], [10, 2]], [[6, 2], [2, 2], [2, 11]], [[22, 11], [22, 2]], [[4, 5], [4, 8], [22, 8], [22, 11]], [[10, 5], [10, 7], [12, 7]], [[18, 7], [18, 10], [12, 10], [12, 9]]]) { const r = w.act('addWire', [p]); if (!r.ok) throw new Error(r.message); }
    predict(w); ok(w, 'setJockey', 'f3', 750); expect(bench(w).pass).toBe(false);
  });
  it('a prediction off by more than 5 % still passes the build with ONE star: the gradient written as 2 V per cm', () => {
    const e = build(10); predict(e, 2); const b = bench(e); expect(b.pass).toBe(true); expect(b.stars).toBe(1); expect(b.predictions[0]).toMatchObject({ id: 'pgrad', grade: 'miss' }); expect(b.debrief.rows[0].ok).toBe(false);
    const f = build(10); predict(f, 0.0205); expect(bench(f).stars).toBe(2);   // 2.5 % off: within 5 %
  });
  it('reality check (engine level): a driver cell with 0.3 ohm of its own changes the gradient (0.0197 V/cm) but the balance lengths still give r = 0.5 ohm', () => {
    // the potentiometer as cards: driver 4 V + rd, rheostat 10 ohm, wire A (high) to B (ground) 10 ohm / 100 cm, jockey J at l cm from A, the cell + on A and - through 100 ohm to J, shunt optional
    const solve = (rd: number, l: number, shunt: boolean, cell = true) => solveCards(`V1 d0 0 4\nRd d0 d ${Math.max(rd, 1e-6)}\nRh d A 10\nRw1 A J ${(0.1 * l).toFixed(6)}\nRw2 J 0 ${(10 - 0.1 * l).toFixed(6)}\n${cell ? `Vc A m0 1.5\nRc m0 m 0.5\nRg m J 100\n${shunt ? 'Rsh A m 4.5' : ''}` : 'Rx J 0 1e12'}`);
    const gradient = (rd: number): number => solve(rd, 50, false, false).v('A') / 100;   // volts across the whole wire per cm, with no cell on it
    expect(gradient(0)).toBeCloseTo(0.02, 6); expect(gradient(0.3)).toBeCloseTo(0.019704, 5);
    for (const rd of [0, 0.3]) {
      const g = gradient(rd), l1 = 1.5 / g, l2 = 1.35 / g;
      expect(Math.abs(solve(rd, l1, false).i('Rg')), `open, rd ${rd}`).toBeLessThan(1e-9); expect(Math.abs(solve(rd, l2, true).i('Rg')), `shunted, rd ${rd}`).toBeLessThan(1e-9);
      expect(4.5 * (l1 / l2 - 1), `r from the lengths, rd ${rd}`).toBeCloseTo(0.5, 6);
    }
    expect(1.5 / gradient(0.3)).toBeCloseTo(76.12, 1);   // the balance moved from 75.0 cm to 76.1 cm, the answer did not
  });
});

// ---------------------------------------------------------------- the chapter as a whole
describe('chapter 2 as a whole', () => {
  it('every ticket 2-x replays its reference through the player actions and passes', () => {
    for (const id of ['2-1', '2-2', '2-3', '2-4']) {
      const e = open(id, ['1-4', '2-1', '2-2', '2-3'], 'learner', false);   // as it arrives: the replay clears the customer's board itself
      for (const a of refActions(def(id))) { if (a.name === 'advance') continue; ok(e, a.name, ...(a.args ?? [])); }
      expect(q(e, 'benchResult').pass, id).toBe(true);
    }
  });
  it('hints answer on every ticket (nudge, then the equation or the ghost)', () => {
    for (const id of ['2-1', '2-2', '2-3', '2-4']) { const e = open(id, ['1-4', '2-1', '2-2', '2-3']); expect(ok(e, 'hint').message.length, id).toBeGreaterThan(20); }
  });
  it('payment follows the first pass: fee plus a bonus per new star, never twice', () => {
    const e = open('2-1', ['1-4']); runRef(e, '2-1'); expect(bench(e).pay).toBe(800); expect(bench(e).pay).toBe(0); expect(st(e).progress.wallet).toBe(800);
  });
});
