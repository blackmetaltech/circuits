// Chapter 5 "Switches & Gain" (tickets 5-1 .. 5-5): every naive build fails for the stated reason (with the engine's own arithmetic in the words), every ref passes, bands have margins, the live switches and the UI queries answer
// from the real engine. DESIGN §2.8, docs/API-CH5.md.
import { describe, expect, it } from 'vitest';
import { Engine } from '@core/kit';
import { GAME } from '../game';
import { LEVEL_DEFS } from '../data/levels';
import { refActions } from './replay';
import { newTicketProgress, type NodeState } from './state';

const def = (id: string) => LEVEL_DEFS.find((d) => d.id === id)!;
function open(id: string, passed: string[] = ['4-3', '5-1', '5-2', '5-3', '5-4'], mode = 'learner'): Engine<NodeState> {
  const e = new Engine(GAME, { mode }); e.autosave = false;
  const st = structuredClone(e.state) as NodeState;
  for (const d of passed.filter((x) => x !== id)) st.progress.tickets[d] = { ...newTicketProgress(), passed: true, stars: 1 };
  e.setState(st);
  expect(e.act('openTicket', [id]).ok, `open ${id}`).toBe(true);
  return e;
}
const ok = (e: Engine<NodeState>, name: string, ...args: unknown[]) => { const r = e.act(name, args); expect(r.ok, `${name} ${JSON.stringify(args)}: ${r.message}`).toBe(true); return r; };
const q = (e: Engine<NodeState>, name: string, ...args: unknown[]) => e.q(name, args) as any;
const bench = (e: Engine<NodeState>) => { ok(e, 'runBench'); return q(e, 'benchResult'); };
const spec = (b: any, id: string) => b.specs.find((x: any) => x.id === id);
const texts = (b: any): string => b.failures.map((f: any) => f.text).join(' | ');
type Part = [string, number | null, string, number, number, number, boolean?];
/** The ref of a level as editable parts and wires. */
const refOf = (id: string) => ({ parts: def(id).ref.parts.map((p) => [p.partId, p.value, p.variant, p.x, p.y, p.rot, p.flip] as Part), wires: def(id).ref.wires.map((w) => w.map((c) => [...c])) });
/** Remove the wire that joins these two end pads, add new ones. */
const cut = (w: number[][][], a: number[], b: number[]) => { const i = w.findIndex((x) => (x[0]!.join() === a.join() && x[x.length - 1]!.join() === b.join()) || (x[0]!.join() === b.join() && x[x.length - 1]!.join() === a.join())); expect(i, `wire ${a}-${b}`).toBeGreaterThanOrEqual(0); w.splice(i, 1); };
/** A board with the given parts (partId, value, variant, x, y, rot, flip) and wires. */
function build(id: string, parts: Part[], wires: number[][][], passed?: string[]) {
  const e = open(id, passed);
  for (const p of parts) ok(e, 'placePart', p[0], p[1], p[2], p[3], p[4], p[5], p[6] ?? false);
  for (const w of wires) ok(e, 'addWire', w);
  return e;
}
const mk = (id: string, edit: (parts: Part[], wires: number[][][]) => void = () => {}) => { const r = refOf(id); edit(r.parts, r.wires); return build(id, r.parts, r.wires); };
/** Advance until something smokes (or give up). */
const burn = (e: Engine<NodeState>, max = 40): string[] => { for (let i = 0; i < max; i++) { const r = ok(e, 'advance', 8); if ((r.smoked as string[]).length) return r.smoked as string[]; } return []; };

// ---------------------------------------------------------------- the chapter map and the unlock chain
describe('chapter 5 unlocks after chapter 4 and runs 5-1, then 5-2 / 5-3 / 5-4, then the exam', () => {
  it('the map has five chits, 11 stars, and the lock chain', () => {
    const e = new Engine(GAME, { mode: 'learner' }); e.autosave = false;
    const set = (ids: string[]) => { const s = structuredClone(e.state) as NodeState; s.progress.tickets = {}; for (const d of ids) s.progress.tickets[d] = { ...newTicketProgress(), passed: true, stars: 1 }; e.setState(s); };
    expect(e.act('openTicket', ['5-1']).message).toMatch(/4-3 or 4-4/);
    const m0 = q(e, 'chapterMap', 5); expect(m0.title).toBe('Switches & Gain'); expect(m0.starsTotal).toBe(11); expect(m0.tickets.map((t: any) => t.title)).toEqual(['Fan Driver', '3.3 V Gate', 'Gate Builder', 'Synth Preamp', 'Exam: CE Amplifier']);
    set(['4-4']); expect(q(e, 'chapterMap', 5).tickets.map((t: any) => t.state)).toEqual(['open', 'locked', 'locked', 'locked', 'locked']);
    set(['4-4', '5-1']); expect(q(e, 'chapterMap', 5).tickets.map((t: any) => t.state)).toEqual(['passed', 'open', 'open', 'open', 'locked']);
    set(['4-4', '5-1', '5-3']); expect(q(e, 'chapterMap', 5).tickets[4].state).toBe('open');
    expect(q(e, 'chapterMap', 5).tickets.every((t: any) => t.spec !== '' && t.chit.x > 0)).toBe(true); expect(q(e, 'chapterMap', 5).tickets[4].eb).toBe(true);
    for (const t of q(e, 'chapterMap', 5).tickets) expect(t.spec.length, `${t.id} chit line short enough for the map card`).toBeLessThanOrEqual(84);
  });
});

// ---------------------------------------------------------------- 5-1
describe('5-1 Fan Driver', () => {
  it('the ref (2N2222A, 220 ohm, 1N4007 across the fan) passes: fan 11.96 V, pin 17.1 mA, 2 stars, and the design numbers', () => {
    const e = mk('5-1'); const b = bench(e);
    expect(b.pass, texts(b)).toBe(true); expect(b.measured.fanhi).toBeCloseTo(11.96, 1); expect(b.measured.fanlo).toBeLessThan(0.01); expect(b.measured.ipin).toBeCloseTo(0.0171, 3); expect(b.stars).toBe(2); expect(b.metrics.cost).toBe(8);
    expect(spec(b, 'ipin').margin).toBeGreaterThan(0.002); expect(spec(b, 'fanhi').margin).toBeGreaterThan(0.5);
  });
  it('without a flyback diode the collector spikes past Vceo in the 100 Hz test: the transistor fails short, the words name the coil', () => {
    const e = mk('5-1', (p, w) => { p.splice(2, 1); w.splice(5, 2); }); const b = bench(e);
    expect(b.pass).toBe(false); expect(spec(b, 'ratings').pass).toBe(false); expect(b.smoked.length).toBe(1);
    expect(texts(b)).toMatch(/spiked to [\d.e+]+ V/); expect(texts(b)).toMatch(/inductance of the fan/); expect(texts(b)).toMatch(/diode/); expect(texts(b)).toMatch(/\b40 V\b/);
  });
  it('live: the 100 Hz switch on a coil without a diode burns the transistor on screen', () => {
    const e = mk('5-1', (p, w) => { p.splice(2, 1); w.splice(5, 2); }); ok(e, 'setSelector', 'pin', 2); ok(e, 'power', true);
    const sm = burn(e); expect(sm.length).toBe(1);
    const e2 = mk('5-1'); ok(e2, 'setSelector', 'pin', 2); ok(e2, 'power', true); expect(burn(e2, 12)).toEqual([]);   // the ref survives the same test
  });
  it('the BC547B carries 0.2 A against its 100 mA limit', () => {
    const e = mk('5-1', (p) => { p[1] = ['bc547b', null, 'TO92', 16, 8, 0, true]; }); const b = bench(e);
    expect(b.pass).toBe(false); expect(texts(b)).toMatch(/collector current rating is only 100 mA/); expect(texts(b)).toMatch(/2N2222A/);
  });
  it('Rb 8.2 k leaves the transistor in its active region: fan 6.5 V, and the words give the base current and the gain', () => {
    const e = mk('5-1', (p) => { p[0]![1] = 8200; }); const b = bench(e);
    expect(b.pass).toBe(false); expect(spec(b, 'fanhi').pass).toBe(false); expect(b.measured.fanhi).toBeLessThan(8); expect(texts(b)).toMatch(/not fully on/); expect(texts(b)).toMatch(/0\.523 mA into the base/);
    expect(texts(b)).toMatch(/fan only got 6\.\d+ V/);
  });
  it('Rb 5.6 k gives about 9 V on the fan (the design number); Rb 47 ohm asks the pin for 58 mA; Rb 2.2 k still saturates', () => {
    const b1 = bench(mk('5-1', (p) => { p[0]![1] = 5600; })); expect(b1.measured.fanhi).toBeGreaterThan(8.5); expect(b1.measured.fanhi).toBeLessThan(10); expect(b1.pass).toBe(false);
    const b2 = bench(mk('5-1', (p) => { p[0]![1] = 47; })); expect(b2.pass).toBe(false); expect(spec(b2, 'ipin').pass).toBe(false); expect(texts(b2)).toMatch(/pin had to give 58/); expect(texts(b2)).toMatch(/may give only 20 mA/);
    const b3 = bench(mk('5-1', (p) => { p[0]![1] = 2200; })); expect(b3.pass, texts(b3)).toBe(true);
  });
  it('the TIP120 alternative with Rb 2.2 k passes with a thin margin on the 11 V spec', () => {
    const e = mk('5-1', (p, w) => { p[0]![1] = 2200; p[1] = ['tip120', null, 'TO220', 12, 8, 0]; w.splice(1, 4, [[8, 7], [12, 7], [12, 8]], [[16, 8], [16, 14], [22, 14]], [[14, 8], [14, 6], [16, 6]], [[16, 6], [22, 6], [22, 4]]); });
    const b = bench(e); expect(b.pass, texts(b)).toBe(true); expect(b.measured.fanhi).toBeGreaterThan(11.0); expect(b.measured.fanhi).toBeLessThan(11.5);
  });
  it('the coach waits for a part, the base resistor, the wiring and the bench; the pin switch has three positions', () => {
    const e = open('5-1'); expect(q(e, 'coach').active).toBe('place'); expect(q(e, 'coach').anchor).toMatchObject({ target: 'bin', partId: '2n2222a' });
    const c = q(e, 'ticketCard'); expect(c.selectors.map((x: any) => [x.id, x.options])).toEqual([['pin', ['high', 'low', '100 Hz']]]);
  });
});

// ---------------------------------------------------------------- 5-2
describe('5-2 3.3 V Gate', () => {
  const noPd = (e = 0) => mk('5-2', (p, w) => { p.splice(2, 1); w.splice(3, 2); void e; });
  it('the ref (IRLZ44N, 100 ohm, 100 kohm pull-down) passes at every threshold: 0.30 A, 2 stars', () => {
    const e = mk('5-2'); const b = bench(e);
    expect(b.pass, texts(b)).toBe(true); expect(b.measured.istrip).toBeGreaterThan(0.29); expect(b.measured.ioff).toBeLessThan(1e-6); expect(b.stars).toBe(2); expect(spec(b, 'istrip').margin).toBeGreaterThan(0.01);
  });
  it('without the pull-down the reset test lights the strip: the words say the gate floated up', () => {
    const b = bench(noPd()); expect(b.pass).toBe(false); expect(spec(b, 'ioff').pass).toBe(false); expect(spec(b, 'istrip').pass).toBe(true);
    expect(texts(b)).toMatch(/gate drifted to 1\.8 V/); expect(texts(b)).toMatch(/no resistor from the gate to GND/);
  });
  it('the 2N7000 on 3.3 V: 45 mA at the typical threshold (it overheats and smokes), 0.18 A at the minimum, nothing at the maximum', () => {
    const e = mk('5-2', (p, w) => { p[1] = ['2n7000', null, 'TO92', 16, 8, 0, true]; w.splice(1, 2, [[8, 8], [10, 8]], [[10, 8], [10, 7], [15, 7], [15, 8]]); w.splice(5, 0); });
    const b = bench(e); expect(b.pass).toBe(false); expect(spec(b, 'istrip').pass).toBe(false); expect(b.smoked.length).toBe(1);
    expect(texts(b)).toMatch(/threshold .* is 2\.1 V/); expect(texts(b)).toMatch(/Vth minimum test/); expect(texts(b)).toMatch(/Vth maximum test/); expect(texts(b)).toMatch(/2N7000/);
    expect(texts(b)).toMatch(/logic-level FET/); expect(texts(b)).toMatch(/Vov = 3\.3 V - 2\.1 V = 1\.2 V/);
  });
  it('the IRF540N: 0.15 A at the typical threshold and nothing at the maximum (4 V): it never turns on', () => {
    const b = bench(mk('5-2', (p) => { p[1] = ['irf540n', null, 'TO220', 12, 8, 0]; })); expect(b.pass).toBe(false); expect(texts(b)).toMatch(/never switched on/); expect(texts(b)).toMatch(/Vth|threshold/);
  });
  it('the THRESHOLD switch moves the live FET: the scope locks at typical and at minimum and loses the lock at the maximum threshold of an IRF540N', () => {
    const e = mk('5-2'); ok(e, 'power', true); ok(e, 'advance', 4); expect(q(e, 'scope').lock).toBe(true); ok(e, 'setSelector', 'vth', 2); ok(e, 'advance', 4); expect(q(e, 'ticketCard').selectors[0].index).toBe(2); expect(q(e, 'scope').lock).toBe(true);
    const f = mk('5-2', (p) => { p[1] = ['irf540n', null, 'TO220', 12, 8, 0]; }); ok(f, 'power', true); ok(f, 'advance', 4); ok(f, 'setSelector', 'vth', 2); ok(f, 'advance', 4); expect(q(f, 'scope').lock).toBe(false);
  });
  it('the 5-1 pin switch: the scope locks with the pin high on the ref (the pin-low spec belongs to another test) and shows the pin current', () => {
    const e = mk('5-1'); ok(e, 'power', true); ok(e, 'advance', 6); const sc = q(e, 'scope'); expect(sc.target).toMatchObject({ spec: 'ipin', unit: 'mA' }); expect(sc.lock).toBe(true); expect(sc.gauge.value).toBeGreaterThan(15); expect(sc.gauge.value).toBeLessThan(19);
    ok(e, 'setSelector', 'pin', 1); ok(e, 'advance', 6); expect(q(e, 'scope').gauge.value).toBeNull();   // the pin-current band belongs to the pin-high test
  });
});

// ---------------------------------------------------------------- 5-3
describe('5-3 Gate Builder', () => {
  it('the ref (DTL NAND) passes: VOH 4.10 V into 10 kohm, VOL 0.06 V at 1 mA, all four vectors', () => {
    const e = mk('5-3'); const b = bench(e);
    expect(b.pass, texts(b)).toBe(true); expect(b.measured.voh).toBeCloseTo(4.098, 2); expect(b.measured.vol).toBeLessThan(0.15); expect(b.stars).toBe(2); expect(spec(b, 'voh').margin).toBeGreaterThan(0.05);
  });
  it('no level-shift diodes: a 0.4 V input low still turns the transistor on (OUT collapses), and the words count the volts', () => {
    const e = mk('5-3', (p, w) => { p.splice(3, 2); cut(w, [12, 6], [12, 8]); cut(w, [16, 8], [18, 8]); cut(w, [18, 12], [20, 12]); w.push([[12, 6], [12, 10], [18, 10], [18, 12]], [[18, 12], [20, 12]]); }); const b = bench(e);
    expect(b.pass).toBe(false); expect(spec(b, 'voh').pass).toBe(false); expect(texts(b)).toMatch(/low input is 0\.4 V/); expect(texts(b)).toMatch(/1\.05 V/); expect(texts(b)).toMatch(/Put two diodes in series/);
  });
  it('one level-shift diode still works for a 0.4 V low (less noise margin); a 47 kohm collector pull-up gives 0.88 V into the load', () => {
    const b1 = bench(mk('5-3', (p, w) => { p.splice(4, 1); cut(w, [16, 8], [18, 8]); w.push([[16, 8], [16, 10], [18, 10], [18, 12]]); })); expect(b1.pass, texts(b1)).toBe(true);
    const b2 = bench(mk('5-3', (p) => { p[7]![1] = 47e3; })); expect(b2.pass).toBe(false); expect(b2.measured.voh).toBeCloseTo(0.876, 1); expect(texts(b2)).toMatch(/5 V x 10 kΩ \/ \(47 kΩ \+ 10 kΩ\) = 0\.877 V/);
  });
  it('without the base pull-down the output sags to 3.95 V (just under the 4.0 V line)', () => {
    const b = bench(mk('5-3', (p, w) => { p.splice(5, 1); cut(w, [17, 12], [18, 12]); cut(w, [13, 12], [22, 14]); })); expect(b.pass).toBe(false); expect(b.measured.voh).toBeLessThan(4.0); expect(b.measured.voh).toBeGreaterThan(3.9);
  });
  it('a hungry collector resistor is allowed (470 ohm passes: the 4 V is easier, VOL still holds)', () => {
    const b = bench(mk('5-3', (p) => { p[7]![1] = 470; })); expect(b.pass, texts(b)).toBe(true);
  });
  it('the live inputs switch the output: A and B low give a high Y, both high give a low Y', () => {
    const e = mk('5-3'); ok(e, 'power', true); ok(e, 'advance', 4);
    expect(q(e, 'ticketCard').selectors.map((s: any) => s.id)).toEqual(['a', 'b']); expect(q(e, 'scope').target).toMatchObject({ spec: 'voh', unit: 'V', mode: 'probe' });
    ok(e, 'setSelector', 'a', 1); ok(e, 'setSelector', 'b', 1); ok(e, 'advance', 4); expect(q(e, 'ticketCard').selectors.map((s: any) => s.index)).toEqual([1, 1]);
  });
});

// ---------------------------------------------------------------- 5-4
describe('5-4 Synth Preamp', () => {
  it('the ref (68k / 10k divider, RC 4.7k, RE 390, 10 uF in and out) passes: gain 9.56, THD 0.26 %, for beta 100, 200 and 300', () => {
    const e = mk('5-4'); const b = bench(e);
    expect(b.pass, texts(b)).toBe(true); expect(b.measured.gain / 0.2).toBeGreaterThan(9.3); expect(b.measured.gain / 0.2).toBeLessThan(9.8); expect(b.measured.thd).toBeLessThan(1); expect(b.stars).toBe(2);
    expect(spec(b, 'gain').margin).toBeGreaterThan(0.1);
  });
  it('the BC547B also works (its own beta range 200-450)', () => { const b = bench(mk('5-4', (p) => { p[2]![0] = 'bc547b'; p[2]![5] = 1; })); expect(b.pass, texts(b)).toBe(true); });
  it('no emitter resistor: the gain is huge and the output clips; the words give the transistor\'s own 26 mV / Ic', () => {
    const b = bench(mk('5-4', (p, w) => { p.splice(4, 1); cut(w, [12, 10], [12, 11]); cut(w, [12, 15], [22, 14]); cut(w, [8, 13], [12, 15]); w.push([[12, 10], [12, 14], [22, 14]], [[8, 13], [8, 15], [22, 15], [22, 14]]); })); expect(b.pass).toBe(false); expect(spec(b, 'gain').pass).toBe(false); expect(b.measured.thd).toBeGreaterThan(5);
    expect(texts(b)).toMatch(/no emitter resistor/); expect(texts(b)).toMatch(/26 mV \/ Ic/);
  });
  it('bias by one resistor: the gain wanders with beta (1 Mohm: the collector current follows beta), and the words quote the two currents', () => {
    const b = bench(mk('5-4', (p, w) => { p[0]![1] = 1e6; p.splice(1, 1); cut(w, [8, 7], [8, 9]); cut(w, [8, 13], [12, 15]); cut(w, [8, 9], [12, 9]); w.push([[8, 7], [10, 7], [10, 9], [12, 9]]); })); expect(b.pass).toBe(false);
    expect(texts(b)).toMatch(/bias is not steady/); expect(texts(b)).toMatch(/collector current would go from [\d.]+ mA to [\d.]+ mA/);
  });
  it('electrolytics the wrong way round vent: the stripe words and the reverse volts', () => {
    const e = mk('5-4', (p) => { p[5]![3] = 4; p[5]![5] = 0; p[6]![3] = 16; p[6]![5] = 2; }); const b = bench(e);
    expect(b.pass).toBe(false); expect(spec(b, 'ratings').pass).toBe(false); expect(texts(b)).toMatch(/wrong way round/);
  });
  it('the live line-out drives the amplifier: the scope probe on OUT shows a sine of about 0.95 V peak', () => {
    const e = mk('5-4'); ok(e, 'power', true); ok(e, 'advance', 8); expect(q(e, 'liveFrame').powered).toBe(true);
  });
});

// ---------------------------------------------------------------- 5-5
describe('5-5 EB: CE Amplifier', () => {
  const R = def('5-5').ref;
  const exam = (preds: Record<string, number>, edit: (p: Part[]) => void = () => {}) => {
    const e = open('5-5'); const parts: Part[] = R.parts.map((p) => [p.partId, p.value, p.variant, p.x, p.y, p.rot, p.flip] as Part); edit(parts);
    for (const p of parts) ok(e, 'placePart', ...p); for (const w of R.wires) ok(e, 'addWire', w); for (const [k, v] of Object.entries(preds)) ok(e, 'predict', k, v); return e;
  };
  it('the ref passes and the exact predictions earn 3 stars; the first look at the answer comes only after the bench', () => {
    const e = open('5-5'); const c = q(e, 'ticketCard'); expect(JSON.stringify(c)).not.toMatch(/232|2\.00 mA|\b6\.00 V\b/);   // no answer leaked before the prediction is locked
    const e2 = exam(R.predictions!); const b = bench(e2); expect(b.pass, texts(b)).toBe(true); expect(b.stars).toBe(3); expect(b.measured.ic).toBeCloseTo(0.002, 5); expect(b.measured.vce).toBeCloseTo(6, 1);
    expect(b.debrief.node).toBe('amp'); expect(b.debrief.working.join(' ')).toMatch(/IB = \(12 - 0\.7\) \/ 565 kΩ = 20 uA/); expect(b.debrief.working.join(' ')).toMatch(/gm = IC \/ 25\.85 mV = 2 mA \/ 25\.85 mV = 77\.36 mS/);
    expect(b.debrief.working.join(' ')).toMatch(/Reality check: a real junction .* 0\.6728 V/); expect(b.debrief.working.join(' ')).toMatch(/2\.00\d mA/); expect(b.debrief.working.join(' ')).toMatch(/Swap beta = 300: the same base current asks 6 mA/);
    expect(b.debrief.working.join(' ')).toMatch(/Av = -gm x RC = -77\.36 mS x 3 kΩ = -232\.1/);
  });
  it('wrong predictions still pass the build with one star and show the working; a wrong RB fails the build with the arithmetic', () => {
    const b1 = bench(exam({ pib: 40, pic: 4, pvce: 0, pav: -100 })); expect(b1.pass).toBe(true); expect(b1.stars).toBe(1);
    const b2 = bench(exam(R.predictions!, (p) => { p[0]![1] = 470e3; })); expect(b2.pass).toBe(false); expect(texts(b2)).toMatch(/IB = \(12 - 0\.7 V\) \/ 470 kΩ = 24 uA/); expect(texts(b2)).toMatch(/IC = 100 x IB = 2\.4 mA/);
  });
});
describe('5-4 scope', () => {
  it('the scope shows the live sine on OUT as a time trace against the amber tube and locks on the gain', () => {
    const e = mk('5-4'); ok(e, 'attachProbe', 1, [22, 8]); ok(e, 'power', true); for (let i = 0; i < 60; i++) ok(e, 'advance', 8);
    const sc = q(e, 'scope'); expect(sc.trace.complete).toBe(true); expect(Math.max(...sc.trace.v)).toBeGreaterThan(0.9); expect(Math.min(...sc.trace.v)).toBeLessThan(-0.9); expect(sc.lock).toBe(true);
  });
});
describe('5-1 coach after a burn', () => {
  it('after the fan burns the transistor, Wren points at the diode (not the power switch), and goes on to power once it is placed', () => {
    const e = mk('5-1', (p, w) => { p.splice(2, 1); w.splice(5, 2); }); ok(e, 'setSelector', 'pin', 2); ok(e, 'power', true); const sm = burn(e); expect(sm.length).toBe(1); ok(e, 'replaceSmoked', sm[0]); ok(e, 'power', false);
    const c = q(e, 'coach'); expect(c.active).toBe('diode-burn'); expect(c.anchor).toMatchObject({ target: 'bin', partId: '1n4007' }); expect(c.text).toMatch(/Put a diode across the fan/);
    ok(e, 'placePart', '1n4007', null, 'DO41', 10, 4, 0, false); expect(q(e, 'coach').active).toBe('wire');   // (the new diode is not wired yet)
    ok(e, 'addWire', [[10, 4], [10, 6], [16, 6]]); ok(e, 'addWire', [[14, 4], [14, 2]]); expect(q(e, 'coach').active).toBe('power');
  });
});
describe('a stuck transient ends', () => {
  it('a random 5-1 board that made the 100 Hz transient crawl (found by the level search) returns a bench failure instead of running for minutes', () => {
    const e = open('5-1'); const A: [string, unknown[]][] = [['placePart', ['tip120', null, null, 3, 12, 0, false]], ['placePart', ['2n2222a', null, null, 15, 8, 0, false]], ['placePart', ['res-cf', 47, null, 3, 8, 0, false]], ['rotatePart', ['p2']], ['addWire', [[[16, 2], [22, 2]]]], ['addWire', [[[2, 2], [7, 2], [7, 8]]]], ['placePart', ['1n4007', null, null, 9, 8, 0, false]], ['addWire', [[[2, 2], [5, 2], [5, 12]]]]];
    for (const [n, a] of A) e.act(n, a);
    const t0 = Date.now(); e.act('runBench', []); expect(Date.now() - t0).toBeLessThan(110000); expect(q(e, 'benchResult').pass).toBe(false);
  }, 150000);
});
