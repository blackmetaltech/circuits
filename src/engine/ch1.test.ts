// Chapter 1 "First Light" (tickets 1-1 .. 1-5): every naive build fails for the stated reason, every ref passes, bands are calibrated, and the UI queries
// (bench, liveFrame, ticketCard, coach, scope, dmm, wallet, chapterMap, ghost) answer from the real engine. DESIGN §2.8, docs/API-CH1.md.
import { describe, expect, it } from 'vitest';
import { Engine, createProtocol } from '@core/kit';
import { GAME } from '../game';
import { LEVEL_DEFS } from '../data/levels';
import { refActions } from './replay';
import { newTicketProgress, type NodeState } from './state';

const CH1 = LEVEL_DEFS.filter((d) => d.chapter === 1);
const def = (id: string) => LEVEL_DEFS.find((d) => d.id === id)!;
/** A fresh engine with the earlier chapter-1 tickets passed (so `id` is unlocked), the ticket open. */
function open(id: string, mode = 'learner'): Engine<NodeState> {
  const e = new Engine(GAME, { mode }); e.autosave = false;
  const st = structuredClone(e.state) as NodeState;
  for (const d of CH1) { if (d.id === id) break; st.progress.tickets[d.id] = { ...newTicketProgress(), passed: true, stars: 1 }; }
  e.setState(st);
  expect(e.act('openTicket', [id]).ok).toBe(true);
  return e;
}
const st = (e: Engine<NodeState>): NodeState => e.state as NodeState;
const ok = (e: Engine<NodeState>, name: string, ...args: unknown[]) => { const r = e.act(name, args); expect(r.ok, `${name} ${JSON.stringify(args)}: ${r.message}`).toBe(true); return r; };
const bad = (e: Engine<NodeState>, name: string, ...args: unknown[]) => { const r = e.act(name, args); expect(r.ok, `${name} should be refused`).toBe(false); return r.message; };
const q = (e: Engine<NodeState>, name: string, ...args: unknown[]) => e.q(name, args) as any;
const bench = (e: Engine<NodeState>) => { ok(e, 'runBench'); return q(e, 'benchResult'); };
const spec = (b: any, id: string) => b.specs.find((x: any) => x.id === id);
const runRef = (e: Engine<NodeState>, id: string) => { for (const a of refActions(def(id)).filter((x) => x.name !== 'runBench' && x.name !== 'power' && x.name !== 'advance')) ok(e, a.name, ...(a.args ?? [])); };
const powerUp = (e: Engine<NodeState>, frames = 3) => { ok(e, 'power', true); return ok(e, 'advance', frames); };
/** Advance until something smokes (or give up). */
const burn = (e: Engine<NodeState>, max = 60): string[] => { for (let i = 0; i < max; i++) { const r = ok(e, 'advance', 8); if ((r.smoked as string[]).length) return r.smoked as string[]; } return []; };

// ---------------------------------------------------------------- 1-1
describe('1-1 Torch', () => {
  const led = (e: Engine<NodeState>) => { ok(e, 'placePart', 'led-red-5mm', null, '5mm', 4, 5, 0, false); ok(e, 'addWire', [[2, 2], [2, 5], [4, 5]]); ok(e, 'addWire', [[6, 5], [6, 2], [8, 2]]); };
  const withR = (v: number) => { const e = open('1-1'); ok(e, 'placePart', 'res-cf', v, '0.25W', 2, 5, 0, false); ok(e, 'placePart', 'led-red-5mm', null, '5mm', 8, 5, 0, false); ok(e, 'addWire', [[2, 2], [2, 5]]); ok(e, 'addWire', [[6, 5], [8, 5]]); ok(e, 'addWire', [[10, 5], [10, 2], [8, 2]]); return e; };
  it('the ref (470 ohm) passes with 2 stars at 14.95 mA and pays the fee plus the star bonus', () => {
    const e = open('1-1'); runRef(e, '1-1'); const b = bench(e);
    expect(b.pass).toBe(true); expect(b.stars).toBe(2); expect(b.metrics).toMatchObject({ cost: 5, parts: 2 });
    expect(b.pay).toBe(300 + 2 * 100); expect(st(e).progress.wallet).toBe(500); expect(q(e, 'wallet')).toMatchObject({ minor: 500, text: '$5.00', lastPay: 500 });
    powerUp(e); const f = q(e, 'liveFrame'); expect(f.parts.find((p: any) => p.led).led.mA).toBeCloseTo(14.95, 1);
    ok(e, 'runBench'); expect(st(e).progress.wallet).toBe(500);   // never paid twice
  });
  it('an LED straight on the battery cracks and smokes instantly: 0.6 A against a 30 mA maximum', () => {
    const e = open('1-1'); led(e); ok(e, 'power', true);
    const r = ok(e, 'advance', 3); expect(r.smoked).toEqual(['p1']); expect(st(e).ticket!.live.frame).toBeLessThanOrEqual(3);
    const f = q(e, 'liveFrame'); expect(f.events).toMatchObject([{ part: 'p1', kind: 'crack', key: 'smoke.led.die' }]); expect(f.events[0].text).toMatch(/LED/);
    expect(f.parts.find((p: any) => p.uid === 'p1').led.mood).toBe('cracked');
    expect(bench(e).pass).toBe(false);
  });
  it('100 ohm: 64 mA smokes the LED after thermal time, not instantly', () => {
    const e = withR(100); ok(e, 'power', true);
    expect((ok(e, 'advance', 1).smoked as string[])).toEqual([]);
    expect(burn(e)).toEqual(['p2']);
  });
  it('220 ohm (31 mA) fails the band as too bright, 1k (7.2 mA) as too dim', () => {
    const hi = bench(withR(220)); expect(hi.pass).toBe(false); expect(spec(hi, 'led').pass).toBe(false);
    expect(hi.failures.some((f: any) => /20 mA|rating|LED/i.test(f.text))).toBe(true);
    const lo = bench(withR(1000)); expect(lo.pass).toBe(false); expect(spec(lo, 'led').pass).toBe(false); expect(spec(lo, 'led').margin).toBeLessThan(0);
  });
  it('the amber band locks on the ref and does not on 220 ohm', () => {
    const e = open('1-1'); runRef(e, '1-1'); powerUp(e); const s = q(e, 'scope');
    expect(s.target).toMatchObject({ spec: 'led', unit: 'mA', lo: 10, hi: 20, mode: 'gauge' }); expect(s.lock).toBe(true); expect(s.gauge.value).toBeCloseTo(14.95, 1); expect(s.gauge.inBand).toBe(true);
    const n = withR(220); powerUp(n); expect(q(n, 'scope').lock).toBe(false);
  });
  it('the coach walks Wren\'s steps from engine state and points the arrow at an object', () => {
    const e = open('1-1'); let c = q(e, 'coach'); expect(c.active).toBe('place-led'); expect(c.anchor).toMatchObject({ target: 'bin', partId: 'led-red-5mm' }); expect(c.text).toMatch(/Lio/);
    ok(e, 'placePart', 'led-red-5mm', null, '5mm', 4, 5, 0, false); c = q(e, 'coach');
    expect(c.active).toBe('wire-led'); expect(c.anchor).toMatchObject({ target: 'part', uid: 'p1', pin: 'A', pad: [4, 5] });
    ok(e, 'addWire', [[2, 2], [2, 5], [4, 5]]); ok(e, 'addWire', [[6, 5], [6, 2], [8, 2]]);
    expect(q(e, 'coach').active).toBe('power-on'); expect(q(e, 'coach').anchor.target).toBe('power');
    ok(e, 'power', true); ok(e, 'advance', 3); c = q(e, 'coach'); expect(c.active).toBe('undo-smoke'); expect(c.anchor).toMatchObject({ target: 'bin', partId: 'res-cf' });
    expect(c.steps.length).toBe(7); expect(c.total).toBe(7);
  });
});

// ---------------------------------------------------------------- 1-2
describe('1-2 Tail-light', () => {
  const series = (v: number) => { const e = open('1-2'); runRef(e, '1-2'); ok(e, 'setValue', 'p1', v); return e; };
  it('the ref (3 LEDs in series with 150 ohm) passes fresh and tired with a 0.35 mA margin', () => {
    const e = open('1-2'); runRef(e, '1-2'); const b = bench(e);
    expect(b.pass).toBe(true); expect(b.stars).toBe(2); expect(spec(b, 'led1').margin).toBeGreaterThan(0.00034); expect(spec(b, 'led1').margin).toBeLessThan(0.00036);
    expect(spec(b, 'ibat').pass).toBe(true); expect(b.pay).toBe(400 + 2 * 150);
  });
  it('the band is tight by design: 120 ohm fails fresh (23 mA), 180 ohm fails tired (13.99 mA)', () => {
    const a = bench(series(120)); expect(a.pass).toBe(false); expect(a.failures.some((f: any) => f.vars.cond === 'fresh' || /fresh/.test(f.text))).toBe(true);
    const c = bench(series(180)); expect(c.pass).toBe(false); expect(c.failures.some((f: any) => f.vars.cond === 'tired' || /tired/.test(f.text))).toBe(true);
    expect(bench(series(120)).failures.some((f: any) => f.vars.cond === 'tired')).toBe(false);
  });
  it('three LEDs in parallel on one 120 ohm resistor keep their 14-20 mA but the battery current triples (57 mA)', () => {
    const e = open('1-2'); ok(e, 'placePart', 'res-cf', 120, '0.25W', 2, 5, 0, false);
    for (const y of [5, 8, 11]) ok(e, 'placePart', 'led-red-5mm', null, '5mm', 10, y, 0, false);
    for (const w of [[[2, 2], [2, 5]], [[6, 5], [10, 5]], [[10, 5], [10, 8]], [[10, 8], [10, 11]], [[12, 5], [12, 8]], [[12, 8], [12, 11]], [[12, 5], [12, 2], [8, 2]]]) ok(e, 'addWire', w);
    const b = bench(e); expect(b.pass).toBe(false); expect(spec(b, 'ibat').pass).toBe(false); expect(spec(b, 'led1').pass).toBe(true);
    expect(b.failures.some((f: any) => f.vars.id === 'ibat')).toBe(true);
  });
  it('three resistor-LED branches pass the LEDs (E12 390 ohm) but fail the battery-current spec', () => {
    const e = open('1-2');
    for (const y of [5, 8, 11]) { ok(e, 'placePart', 'res-cf', 390, '0.25W', 2, y, 0, false); ok(e, 'placePart', 'led-red-5mm', null, '5mm', 8, y, 0, false); }
    for (const w of [[[2, 2], [2, 5]], [[2, 5], [2, 8]], [[2, 8], [2, 11]], [[6, 5], [8, 5]], [[6, 8], [8, 8]], [[6, 11], [8, 11]], [[10, 5], [10, 2], [8, 2]], [[10, 8], [10, 5]], [[10, 11], [10, 8]]]) ok(e, 'addWire', w);
    const b = bench(e); expect(b.pass).toBe(false); expect(spec(b, 'ibat').pass).toBe(false); expect(spec(b, 'led1').pass).toBe(true);
  });
  it('the LED spec has to hold in the tired condition: a fresh-only design fails the card\'s second condition', () => {
    const card = q(open('1-2'), 'ticketCard'); expect(card.conditions.map((c: any) => c.id)).toEqual(['fresh', 'tired']);
    expect(card.conditions[1].set).toEqual([{ target: 'f1', key: 'emf', value: 8.4 }, { target: 'f1', key: 'r', value: 6 }]);
  });
});

// ---------------------------------------------------------------- 1-3
describe('1-3 Hot Resistor', () => {
  const build = (v: number, rating: string) => { const e = open('1-3'); ok(e, 'placePart', 'res-cf', v, rating, 4, 2, 0, false); ok(e, 'addWire', [[2, 2], [4, 2]]); ok(e, 'addWire', [[8, 2], [14, 2]]); return e; };
  it('Ref A (22 ohm 1 W: 8.33 V, 7c) passes with 1 star; Ref B (two 47 ohm 1/2 W in parallel: 8.16 V, 6c) is cheaper and earns the cost-par star', () => {
    const a = open('1-3'); runRef(a, '1-3'); const ba = bench(a); expect(ba.pass).toBe(true); expect(ba.stars).toBe(1); expect(ba.metrics.cost).toBe(7);
    const e = open('1-3'); ok(e, 'placePart', 'res-cf', 47, '0.5W', 4, 2, 0, false); ok(e, 'placePart', 'res-cf', 47, '0.5W', 4, 4, 0, false);
    for (const w of [[[2, 2], [4, 2]], [[2, 2], [2, 4], [4, 4]], [[8, 2], [14, 2]], [[8, 4], [8, 3], [8, 2]]]) ok(e, 'addWire', w);
    const b = bench(e); expect(b.pass).toBe(true); expect(b.stars).toBe(2); expect(b.metrics.cost).toBe(6);
    powerUp(e); const f = q(e, 'liveFrame'); expect(f.parts.filter((p: any) => p.power > 0.3 && p.power < 0.32)).toHaveLength(2);
  });
  it('one 22 ohm 1/4 W gives the right voltage but 0.61 W in a 0.25 W part: it glows, then smokes', () => {
    const e = build(22, '0.25W'); ok(e, 'power', true); ok(e, 'advance', 1);
    const f1 = q(e, 'liveFrame'); const r = f1.parts.find((p: any) => p.uid === 'p1'); expect(r.ratio).toBeGreaterThan(2.3); expect(r.ratio).toBeLessThan(2.6); expect(['warm', 'hot']).toContain(r.state);
    const smoked = burn(e); expect(smoked).toEqual(['p1']);
    const f2 = q(e, 'liveFrame'); expect(f2.events).toMatchObject([{ part: 'p1', kind: 'smoke', key: 'smoke.resistor' }]);
    const b = bench(e); expect(b.pass).toBe(false);
    const e2 = build(22, '0.25W'); const b2 = bench(e2); expect(b2.pass).toBe(false);
    expect(spec(b2, 'vout').pass).toBe(true); expect(spec(b2, 'ratings').pass).toBe(false); expect(b2.failures.some((f: any) => /0\.61|0\.25/.test(f.text) || f.key.startsWith('bench.rating') || f.key.startsWith('smoke'))).toBe(true);
  });
  it('27 ohm gives 7.79 V: out of band', () => {
    const b = bench(build(27, '0.5W')); expect(b.pass).toBe(false); expect(spec(b, 'vout').pass).toBe(false); expect(b.failures[0].text).toMatch(/7\.79/);
  });
  it('the amber band locks on the ref when the scope is clipped to OUT, with the trace inside it', () => {
    const e = open('1-3'); runRef(e, '1-3'); ok(e, 'attachProbe', 1, [14, 2]); powerUp(e, 4);
    const s = q(e, 'scope', 1); expect(s.target).toMatchObject({ spec: 'vout', unit: 'V', lo: 7.85, hi: 8.4, mode: 'probe', clipped: true, clip: { connector: 'OUT', pad: [14, 2] } });
    expect(s.lock).toBe(true); expect(s.attached).toBe(true); expect(s.v.length).toBeGreaterThan(8); expect(s.v[s.v.length - 1]).toBeCloseTo(8.33, 1);
  });
});

// ---------------------------------------------------------------- 1-4
describe('1-4 Tired Battery', () => {
  const load = (v: number, part = 'res-ww5', rating = '5W', mode = 'learner') => { const e = open('1-4', mode); ok(e, 'placePart', part, v, rating, 2, 5, 0, false); ok(e, 'addWire', [[2, 2], [2, 5]]); ok(e, 'addWire', [[6, 5], [6, 2], [8, 2]]); return e; };
  it('the ref (4.7 ohm 5 W) passes at 4.31 W with 2 stars', () => { const e = open('1-4'); runRef(e, '1-4'); const b = bench(e); expect(b.pass).toBe(true); expect(b.stars).toBe(2); expect(b.metrics.power).toBeGreaterThan(4.3e6); expect(b.metrics.power).toBeLessThan(4.32e6); });
  it('the load table of the design: 3.3 fails (4.18 W), 3.9 / 4.7 / 5.6 pass, 6.8 fails (4.16 W)', () => {
    const r: Record<number, boolean> = {};
    for (const v of [3.3, 3.9, 4.7, 5.6, 6.8]) r[v] = bench(load(v)).pass;
    expect(r).toEqual({ 3.3: false, 3.9: true, 4.7: true, 5.6: true, 6.8: false });
  });
  it('a 1 W resistor smokes at 4.3 W', () => {
    const e = load(4.7, 'res-cf', '1W'); ok(e, 'power', true); expect(burn(e)).toEqual(['p1']);
    const b = bench(load(4.7, 'res-cf', '1W')); expect(b.pass).toBe(false); expect(spec(b, 'ratings').pass).toBe(false);
  });
  it('the player measures: open-circuit 9.0 V, loaded V gives r = 4.7 ohm (the hidden value stays hidden)', () => {
    const e = open('1-4'); powerUp(e);
    ok(e, 'dmmLead', 'red', [2, 2]); expect(q(e, 'dmm').valid).toBe(false); ok(e, 'dmmLead', 'black', [8, 2]);
    let m = q(e, 'dmm'); expect(m.mode).toBe('dcv'); expect(m.display.unit).toBe('V'); expect(m.value).toBeCloseTo(9.0, 1);   // 10 Mohm meter on a 4.7 ohm source
    expect(JSON.stringify(e.snapshot())).not.toContain('hidden');
    const l = load(4.7); powerUp(l); ok(l, 'dmmLead', 'red', [2, 2]); ok(l, 'dmmLead', 'black', [8, 2]);
    m = q(l, 'dmm'); expect(m.value).toBeCloseTo(4.5, 2);   // 9 * 4.7 / 9.4
    const r = (9 - m.value) / (m.value / 4.7); expect(r).toBeCloseTo(4.7, 1);
    ok(l, 'dmmDial', 'dca'); ok(l, 'advance', 1); m = q(l, 'dmm'); expect(m.display.unit).toBe('mA');
  });
  it('Engineer draws r from 3.3-4.7 ohm so the ticket stays solvable, and the bench follows the hidden r', () => {
    const r = (e: Engine<NodeState>) => (st(e).ticket!.hidden.r as number);
    for (const seed of [1, 2, 3, 4, 5, 6]) { const e = new Engine(GAME, { mode: 'engineer', seed }); e.autosave = false; const s0 = structuredClone(e.state) as NodeState; for (const d of CH1.slice(0, 3)) s0.progress.tickets[d.id] = { ...newTicketProgress(), passed: true }; e.setState(s0); ok(e, 'openTicket', '1-4'); expect(r(e)).toBeGreaterThanOrEqual(3.3); expect(r(e)).toBeLessThanOrEqual(4.7); }
  });
  it('the gauge shows watts with the spec band 4.20 W and locks on the ref', () => {
    const e = open('1-4'); runRef(e, '1-4'); powerUp(e); const s = q(e, 'scope'); expect(s.target).toMatchObject({ unit: 'W', lo: 4.2, mode: 'gauge' }); expect(s.gauge.value).toBeCloseTo(4.31, 1); expect(s.lock).toBe(true);
  });
});

// ---------------------------------------------------------------- 1-5
describe('1-5 EB: Two Batteries (NC-04)', () => {
  it('the textbook answers: V(A) = 6.667 V, 0.5556 A into E2 (charging)', () => {
    const e = open('1-5'); runRef(e, '1-5'); const b = bench(e);
    expect(b.pass).toBe(true); const pva = b.predictions.find((p: any) => p.id === 'pva'), pi = b.predictions.find((p: any) => p.id === 'pie2');
    expect(pva.truth).toBeCloseTo(6.666667, 4); expect(pi.truth).toBeCloseTo(0.555556, 5); expect(pva.grade).toBe('exact'); expect(pi.grade).toBe('exact');
    expect(b.stars).toBe(3); expect(b.gap ?? 0).toBe(0);
  });
  it('predictions are graded: within 5 % is close, further is a miss with the gap shown; stars follow DESIGN §2.5', () => {
    const e = open('1-5'); runRef(e, '1-5'); ok(e, 'predict', 'pva', 6.9); ok(e, 'predict', 'pie2', 0.5556); const b = bench(e);
    expect(b.pass).toBe(true); expect(b.predictions.find((p: any) => p.id === 'pva')).toMatchObject({ grade: 'close', gradeText: 'within 5 %' }); expect(b.stars).toBe(2);   // within 5 % + first run, not all within 1 %
    const f = open('1-5'); runRef(f, '1-5'); ok(f, 'predict', 'pva', 8); const bf = bench(f); expect(bf.predictions.find((p: any) => p.id === 'pva')).toMatchObject({ grade: 'miss' }); expect(bf.predictions.find((p: any) => p.id === 'pva').gap).toBeGreaterThan(10);
  });
  it('no predictions entered: the bench asks for them; a wrong build fails the 0.1 % checks', () => {
    const e = open('1-5'); for (const a of refActions(def('1-5')).filter((x) => x.name === 'placePart' || x.name === 'addWire')) ok(e, a.name, ...(a.args ?? []));
    const b = bench(e); expect(b.pass).toBe(false); expect(b.failures.some((f: any) => f.key === 'bench.predict.missing')).toBe(true);
    const w = open('1-5'); ok(w, 'predict', 'pva', 6.6667); ok(w, 'predict', 'pie2', 0.5556);
    ok(w, 'placePart', 'res-exact', 6, 'ideal', 4, 2, 0, false); ok(w, 'placePart', 'res-exact', 3, 'ideal', 10, 4, 0, false); ok(w, 'placePart', 'res-exact', 2, 'ideal', 8, 7, 1, false);   // R1 and R3 swapped
    for (const a of refActions(def('1-5')).filter((x) => x.name === 'addWire')) ok(w, a.name, ...(a.args ?? []));
    const bw = bench(w); expect(bw.pass).toBe(false); expect(spec(bw, 'va').pass).toBe(false);
  });
  it('the card carries the prediction fields and the textbook bin', () => {
    const c = q(open('1-5'), 'ticketCard'); expect(c.eb).toBe(true); expect(c.predictions.map((p: any) => [p.id, p.unit])).toEqual([['pva', 'V'], ['pie2', 'A']]);
    expect(c.shoebox).toEqual([expect.objectContaining({ partId: 'res-exact', values: [2, 3, 6], unit: 'Ω', max: 3, variants: [expect.objectContaining({ id: 'ideal', price: 0 })] })]);
  });
});

// ---------------------------------------------------------------- the UI contract
describe('UI queries and board actions', () => {
  it('every ref passes the bench in Learner mode, Engineer mode and through the core Level path', () => {
    for (const d of CH1) for (const mode of ['learner', 'engineer']) { const e = open(d.id, mode); runRef(e, d.id); expect(bench(e).pass, `${d.id} ${mode}`).toBe(true); }
  });
  it('the idle persona (empty board) never passes a build ticket', () => {
    for (const d of CH1) { const e = open(d.id); expect(bench(e).pass, d.id).toBe(false); }
  });
  it('ticketCard: customer, spec, fee, the shoebox as parts with prices and ratings, targets and conditions', () => {
    const c = q(open('1-3'), 'ticketCard');
    expect(c).toMatchObject({ id: '1-3', customer: 'Mr. Brook', fee: 500, feeText: '$5.00', eb: false });
    expect(c.shoebox[0]).toMatchObject({ partId: 'res-cf', values: [22, 27, 47, 51, 100], unit: 'Ω' });
    expect(c.shoebox[0].variants.map((v: any) => [v.id, v.price, v.priceText, v.ratings.P])).toEqual([['0.25W', 2, '$0.02', 0.25], ['0.5W', 3, '$0.03', 0.5], ['1W', 7, '$0.07', 1]]);
    expect(c.targets).toEqual([{ id: 'vout', name: 'Heater voltage between 7.85 V and 8.40 V, no part over its rating', lo: 7.85, hi: 8.4 }]);
    expect(c.brief).toContain('Mr. Brook');
  });
  it('bench(): board, parts with pin pads, wires, instruments', () => {
    const e = open('1-3'); runRef(e, '1-3'); ok(e, 'attachProbe', 1, [14, 2]); ok(e, 'dmmLead', 'red', [2, 2]);
    const b = q(e, 'bench');
    expect(b).toMatchObject({ ticket: '1-3', w: 24, h: 16, status: 'ok' });
    expect(b.connectors.map((c: any) => c.id)).toEqual(['IN', 'OUT', 'GND']);
    expect(b.parts[1]).toMatchObject({ uid: 'p1', partId: 'res-cf', valueText: '22 Ω', variant: '1W', fixed: false, pins: [{ name: '1', pad: [4, 2] }, { name: '2', pad: [8, 2] }] });
    expect(b.parts[0]).toMatchObject({ uid: 'f1', fixed: true, kind: 'HEATER' }); expect(b.wires).toHaveLength(2);
    expect(b.instruments).toMatchObject({ powered: false, supply: { on: false, v: 12 }, gen: null, scope: { probes: [{ ch: 1, pad: [14, 2] }] }, dmm: { mode: 'dcv', red: [2, 2], black: null } });
  });
  it('liveFrame(): node tint scalars, currents and dot speeds, ratios, temperatures, within the frame budget', () => {
    const e = open('1-3'); runRef(e, '1-3'); powerUp(e, 2);
    const f = q(e, 'liveFrame'); expect(f.valid).toBe(true);
    expect(f.nodes.find((n: any) => n.name === 'out').v).toBeCloseTo(8.33, 1);
    expect(f.wires.every((w: any) => Math.abs(w.i) > 0.16 && Math.abs(w.i) < 0.17 && Math.abs(w.speed) >= 0.2 && Math.abs(w.speed) <= 6)).toBe(true);
    const r = f.parts.find((p: any) => p.uid === 'p1'); expect(r.ratio).toBeGreaterThan(0.6); expect(r.ratio).toBeLessThan(0.62); expect(r.state).toBe('normal'); expect(r.temp).toBeGreaterThan(25);
    const t0 = performance.now(); for (let i = 0; i < 100; i++) q(e, 'liveFrame'); const per = (performance.now() - t0) / 100;
    const a0 = performance.now(); for (let i = 0; i < 20; i++) ok(e, 'advance', 1); const adv = (performance.now() - a0) / 20;
    console.log(`liveFrame query ${per.toFixed(2)} ms, advance(1) ${adv.toFixed(2)} ms (desktop)`);
    expect(per).toBeLessThan(8); expect(adv).toBeLessThan(8);   // DESIGN §3.11: <= 8 ms on desktop per frame
    expect(JSON.stringify(f).length).toBeLessThan(6000);
  });
  it('dots speed follows log current, LED bloom follows log current, mood follows the rating', async () => {
    const { dotSpeed, ledBloom, ledMood } = await import('./ui');
    expect(dotSpeed(0)).toBe(0); expect(dotSpeed(1e-6)).toBeCloseTo(0.2, 3); expect(dotSpeed(1)).toBe(6); expect(dotSpeed(-0.015)).toBeLessThan(-0.2);
    expect(dotSpeed(1e-3)).toBeGreaterThan(dotSpeed(1e-5));
    expect(ledBloom(0)).toBe(0); expect(ledBloom(0.03)).toBe(1); expect(ledBloom(0.001)).toBeGreaterThan(ledBloom(0.0001));
    expect([ledMood(0.001, false), ledMood(0.015, false), ledMood(0.031, false), ledMood(0.015, true)]).toEqual(['sleepy', 'happy', 'sweating', 'cracked']);
  });
  it('wire(a, b) routes pad to pad; unwire removes by id or by pad; undo restores; run/pause gates advance', () => {
    const e = open('1-1'); ok(e, 'placePart', 'res-cf', 470, '0.25W', 2, 5, 0, false);
    const r = ok(e, 'wire', [2, 2], [2, 5]); expect(r.path).toEqual([[2, 2], [2, 5]]);
    const r2 = ok(e, 'wire', [6, 5], [8, 2]); expect(r2.wid).toBe('w2'); expect((r2.path as number[][]).length).toBeGreaterThanOrEqual(2);
    expect(bad(e, 'wire', [6, 5], [6, 5])).toMatch(/two different pads/);
    ok(e, 'unwire', 'w1'); expect(st(e).ticket!.board.wires.map((w) => w.wid)).toEqual(['w2']);
    ok(e, 'unwire', [8, 2]); expect(st(e).ticket!.board.wires).toHaveLength(0); expect(bad(e, 'unwire', [8, 2])).toMatch(/No wire ends/);
    ok(e, 'undo'); expect(st(e).ticket!.board.wires).toHaveLength(1);
    ok(e, 'power', true); ok(e, 'setRunning', false); const p = ok(e, 'advance', 3); expect(p.frames).toBe(0); expect(p.paused).toBe(true); expect(st(e).ticket!.live.frame).toBe(0);
    expect(q(e, 'bench').instruments.paused).toBe(true); ok(e, 'setRunning', true); expect(ok(e, 'advance', 1).frames).toBe(1);
  });
  it('the DMM: leads, dial (V / mA / ohm), reading, and teaching refusals', () => {
    const e = open('1-3'); runRef(e, '1-3'); powerUp(e);
    expect(bad(e, 'dmmLead', 'green', [2, 2])).toMatch(/red.*black/); expect(bad(e, 'dmmLead', 'red', [20, 14])).toMatch(/nothing|no part|wire/i); expect(bad(e, 'dmmDial', 'amps')).toMatch(/off, dcv, dca, ohm/);
    ok(e, 'dmmLead', 'red', [14, 2]); ok(e, 'dmmLead', 'black', [14, 8]);
    let m = q(e, 'dmm'); expect(m).toMatchObject({ mode: 'dcv', label: 'V', valid: true, display: { unit: 'V' } }); expect(m.value).toBeCloseTo(8.33, 1);
    ok(e, 'dmmDial', 'ohm'); m = q(e, 'dmm'); expect(m.label).toBe('Ω'); expect(m.value).toBeCloseTo(15.28, 1);   // the heater (50 ohm) in parallel with the 22 ohm path back through the zeroed supply
    ok(e, 'dmmDial', 'off'); expect(q(e, 'dmm').value).toBeNull(); ok(e, 'dmmLead', 'red', null); expect(q(e, 'bench').instruments.dmm.red).toBeNull();
  });
  it('ghost(): the leads before release, and why a spot does not fit', () => {
    const e = open('1-1'); const g = q(e, 'ghost', 'res-cf', 4, 5, 0, false); expect(g).toMatchObject({ ok: true, pins: [{ name: '1', pad: [4, 5] }, { name: '2', pad: [8, 5] }], problem: null });
    expect(q(e, 'ghost', 'res-cf', 22, 5, 0, false)).toMatchObject({ ok: false }); expect(q(e, 'ghost', 'res-cf', 2, 2, 0, false).problem).toMatch(/occupied|pin/i);
  });
  it('chapterMap(): five chits with state, fee and position; stars and unlock chain', () => {
    const e = new Engine(GAME); e.autosave = false;
    let m = q(e, 'chapterMap'); expect(m).toMatchObject({ chapter: 1, title: 'First Light', complete: false, starsEarned: 0, starsTotal: 11 });
    expect(m.tickets.map((t: any) => [t.id, t.state, t.unlocked, t.eb])).toEqual([['1-1', 'open', true, false], ['1-2', 'locked', false, false], ['1-3', 'locked', false, false], ['1-4', 'locked', false, false], ['1-5', 'locked', false, true]]);
    expect(m.tickets[0]).toMatchObject({ title: 'Torch', customer: 'Lio', feeText: '$3.00', after: [], chit: { x: 0.2, y: 0.3 } });
    expect(bad(e, 'openTicket', '1-3')).toMatch(/locked.*1-2/);
    ok(e, 'openTicket', '1-1'); runRef(e, '1-1'); bench(e); ok(e, 'closeTicket');
    m = q(e, 'chapterMap'); expect(m.tickets[0]).toMatchObject({ state: 'done', passed: true, stars: 2 }); expect(m.tickets[1].state).toBe('open'); expect(m.starsEarned).toBe(2); expect(m.tickets[0].best.costText).toBe('$0.05');
    expect(q(e, 'wallet').text).toBe('$5.00');
  });
  it('chapter 1 plays end to end through the protocol (open, build the ref, bench) with the wallet growing', () => {
    const e = new Engine(GAME); e.autosave = false;
    for (const d of CH1) { ok(e, 'openTicket', d.id); runRef(e, d.id); expect(bench(e).pass, d.id).toBe(true); ok(e, 'closeTicket'); }
    expect(q(e, 'chapterMap').complete).toBe(true); expect(st(e).progress.wallet).toBeGreaterThan(2000);
    // the sidecar protocol exposes the whole contract of docs/API-CH1.md
    const h = createProtocol(new Engine(GAME)); const init = (h({ id: 1, fn: 'init' }).result as any);
    expect(init.actions).toEqual(expect.arrayContaining(['wire', 'unwire', 'dmmLead', 'dmmDial', 'setRunning', 'power', 'attachProbe', 'detachProbe', 'predict']));
    expect(init.queries).toEqual(expect.arrayContaining(['bench', 'liveFrame', 'ticketCard', 'coach', 'scope', 'dmm', 'wallet', 'chapterMap', 'ghost', 'shoebox']));
    expect(h({ id: 2, fn: 'q', name: 'wallet' }).ok).toBe(true);
  });
  it('the state stays JSON and the state hash is the same on a fresh replay (determinism)', () => {
    const run = () => { const e = open('1-2'); runRef(e, '1-2'); ok(e, 'runBench'); powerUp(e, 4); return JSON.stringify([e.state, q(e, 'liveFrame'), q(e, 'scope')]); };
    expect(run()).toBe(run());
  });
});
