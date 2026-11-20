// Chapter 2 play-test round C2-1 (engine side): the exam must not give its numbers away before the predictions are locked, the marking hint names the right law,
// 2-1 says exactly what is missing from the divider and quotes the real measured value, and the 2-3 coach does not fall back to "switch the power on".
import { describe, expect, it } from 'vitest';
import { Engine } from '@core/kit';
import { GAME } from '../game';
import { LEVEL_DEFS } from '../data/levels';
import { refActions } from './replay';
import { newTicketProgress, type NodeState } from './state';

const def = (id: string) => LEVEL_DEFS.find((d) => d.id === id)!;
function open(id: string, passed: string[] = ['1-4', '2-1', '2-2', '2-3']): Engine<NodeState> {
  const e = new Engine(GAME, { mode: 'learner' }); e.autosave = false;
  const st = structuredClone(e.state) as NodeState;
  for (const d of passed) st.progress.tickets[d] = { ...newTicketProgress(), passed: true, stars: 1 };
  e.setState(st);
  expect(e.act('openTicket', [id]).ok, `open ${id}`).toBe(true);
  return e;
}
const ok = (e: Engine<NodeState>, name: string, ...args: unknown[]) => { const r = e.act(name, args); expect(r.ok, `${name} ${JSON.stringify(args)}: ${r.message}`).toBe(true); return r; };
const q = (e: Engine<NodeState>, name: string, ...args: unknown[]) => e.q(name, args) as any;
const bench = (e: Engine<NodeState>) => { ok(e, 'runBench'); return q(e, 'benchResult'); };
const runRef = (e: Engine<NodeState>, id: string) => { for (const a of refActions(def(id)).filter((x) => x.name !== 'runBench' && x.name !== 'power' && x.name !== 'advance')) ok(e, a.name, ...(a.args ?? [])); };
const texts = (b: any): string => b.failures.map((f: any) => f.text).join(' | ');
const allCoach = (e: Engine<NodeState>): string => q(e, 'coach').steps.map((s: any) => s.text).join(' | ');

describe('2-4 exam: nothing leaks before the predictions are locked', () => {
  it('the card hides the test cell EMF and the level specs, the coach never quotes a balance length, and everything appears once the predictions are in', () => {
    const e = open('2-4'); const c = q(e, 'ticketCard');
    expect(c.examHidden).toBe(true);
    expect(c.sources.find((s: any) => s.partId === 'cell-test')).toMatchObject({ volts: null, hidden: true });
    expect(c.sources.find((s: any) => s.partId === 'ideal-vsource')).toMatchObject({ volts: 4, hidden: false });
    expect(c.specs.map((s: any) => s.id)).not.toContain('ig'); expect(c.targets).toEqual([]);
    expect(JSON.stringify(c.specs)).not.toMatch(/75\.0|67\.5/);
    expect(allCoach(e)).not.toMatch(/75\.0|67\.5|75 cm|1\.5 V/);
    for (const id of ['pgrad', 'pemf', 'pr']) ok(e, 'predict', id, 1);
    const c2 = q(e, 'ticketCard');
    expect(c2.examHidden).toBe(false); expect(c2.sources.find((s: any) => s.partId === 'cell-test')).toMatchObject({ volts: 1.5, hidden: false }); expect(c2.specs.map((s: any) => s.id)).toContain('ig');
    expect(allCoach(e)).not.toMatch(/75\.0|67\.5/);
  });
  it('1-5 hides its band the same way, and a ticket that is not an exam never hides anything', () => {
    expect(q(open('1-5', ['1-4']), 'ticketCard').examHidden).toBe(true);
    expect(q(open('2-1', ['1-4']), 'ticketCard').examHidden).toBe(false);
  });
});

describe('the marking hint names the right law for each exam', () => {
  const sitExam = (id: string, pred: Record<string, number>) => { const e = open(id, id === '2-4' ? ['1-4', '2-1', '2-2'] : ['1-4']); runRef(e, id); for (const [k, v] of Object.entries(pred)) ok(e, 'predict', k, v); return e; };
  it('2-4 at one star points at V = k l and r = R (l1 / l2 - 1), never at KCL', () => {
    const b = bench(sitExam('2-4', { pgrad: 2, pemf: 1.5, pr: 0.5 })); expect(b.stars).toBe(1);
    expect(b.debrief.starsText).toMatch(/V = k x l/); expect(b.debrief.starsText).toMatch(/r = R \(l1 \/ l2 - 1\)/); expect(b.debrief.starsText).not.toMatch(/KCL/);
  });
  it('1-5 at one star still says KCL', () => {
    const e = open('1-5', ['1-4']); runRef(e, '1-5'); const pr = (e.q('ticketCard', []) as any).predictions;
    for (const p of pr) ok(e, 'predict', p.id, 99); const b = bench(e); expect(b.stars).toBe(1); expect(b.debrief.starsText).toMatch(/KCL/);
  });
  it('an exam stamped FIXED under 3 stars offers to try again: retryExam clears the predictions and refuses a bench until they are rewritten', () => {
    const e = sitExam('2-4', { pgrad: 0.0205, pemf: 1.5, pr: 0.5 }); const b = bench(e);
    expect(b.stars).toBe(2); expect(b.retry).toBe(true); expect(b.debrief.retry).toBe(true); expect(b.debrief.retryText).toMatch(/Try again for more stars/);
    ok(e, 'retryExam'); const c = q(e, 'ticketCard'); expect(c.predictions.map((p: any) => p.entered)).toEqual([null, null, null]); expect(c.examHidden).toBe(true);
    expect(texts(bench(e))).toMatch(/prediction/i); expect(q(e, 'benchResult').pass).toBe(false);
    for (const [k, v] of Object.entries({ pgrad: 0.02, pemf: 1.5, pr: 0.5 })) ok(e, 'predict', k, v);
    const b2 = bench(e); expect(b2.pass).toBe(true); expect(b2.stars).toBe(3); expect(b2.retry).toBe(false);
    expect(q(open('2-1', ['1-4']), 'ticketCard').examHidden).toBe(false); expect(open('2-1', ['1-4']).act('retryExam', []).ok).toBe(false);
  });
});

describe('2-1 says exactly what is missing and quotes the real value', () => {
  const place = (e: Engine<NodeState>, r1: number, r2: number | null) => {
    ok(e, 'placePart', 'res-cf', r1, '0.25W', 4, 2, 0, false); if (r2 !== null) ok(e, 'placePart', 'res-cf', r2, '0.25W', 8, 4, 1, false);
  };
  it('a bottom resistor that is not tied to GND: "OUT is just following the top", with the real number', () => {
    const e = open('2-1', ['1-4']); place(e, 1800, 1200);
    for (const w of [[[2, 2], [4, 2]], [[8, 2], [14, 2]], [[8, 4], [8, 2]]]) ok(e, 'addWire', w);   // the bottom resistor reaches OUT but not GND
    const b = bench(e); expect(b.pass).toBe(false); const t = texts(b);
    expect(t).toMatch(/bottom resistor isn't connected to GND/); expect(t).toMatch(/OUT is just following the top resistor/); expect(t).toMatch(/7\.63 V/); expect(t).not.toMatch(/Check each resistor value/);
  });
  it('only a top resistor: asks for the bottom one; a floating bottom is not blamed on the ADC load once it is wired', () => {
    const e = open('2-1', ['1-4']); place(e, 1800, null); for (const w of [[[2, 2], [4, 2]], [[8, 2], [14, 2]]]) ok(e, 'addWire', w);
    expect(texts(bench(e))).toMatch(/no bottom resistor from OUT to GND yet/);
    const f = open('2-1', ['1-4']); place(f, 5600, 3300); for (const w of [[[2, 2], [4, 2]], [[8, 2], [14, 2]], [[8, 4], [8, 2]], [[8, 8], [14, 8]]]) ok(f, 'addWire', w);
    expect(texts(bench(f))).toMatch(/parallel/);
  });
  it('the thank-you quotes the value the engine measured: 1.8 k over 1.2 k (with the 10 k ADC) reads 3.358 V on the DMM and on the bench', () => {
    const e = open('2-1', ['1-4']); place(e, 1800, 1200); for (const w of [[[2, 2], [4, 2]], [[8, 2], [14, 2]], [[8, 4], [8, 2]], [[8, 8], [14, 8]]]) ok(e, 'addWire', w);
    ok(e, 'power', true); ok(e, 'advance', 3); ok(e, 'dmmLead', 'red', [14, 2]); ok(e, 'dmmLead', 'black', [14, 8]); ok(e, 'dmmDial', 'dcv');
    const meter = q(e, 'dmm').display.value as number; const par = (1200 * 1e4) / (1200 + 1e4), exact = (9 * par) / (1800 + par);
    expect(meter).toBeCloseTo(exact, 3); expect(exact).toBeCloseTo(3.3582, 3);
    const b = bench(e); expect(b.pass).toBe(true); expect(b.measured.vout).toBeCloseTo(exact, 3);
    expect(b.thanks).toBe('In the band: 3.358 volts.');   // 1.8 % off 3.30: inside the band, not "dead on"
  });
  it('a divider within 1 % of 3.30 V is "Dead on", with the value; the ref (3.355 V) says so honestly; a failed bench has no thank-you', () => {
    const e = open('2-1', ['1-4']); place(e, 4700, 3900); for (const w of [[[2, 2], [4, 2]], [[8, 2], [14, 2]], [[8, 4], [8, 2]], [[8, 8], [14, 8]]]) ok(e, 'addWire', w);
    const b = bench(e); expect(b.measured.vout).toBeCloseTo(3.364, 3); expect(b.thanks).toBe('In the band: 3.364 volts.');
    const g = open('2-1', ['1-4']); place(g, 15000, 68000); for (const w of [[[2, 2], [4, 2]], [[8, 2], [14, 2]], [[8, 4], [8, 2]], [[8, 8], [14, 8]]]) ok(g, 'addWire', w);
    const b2 = bench(g); expect(b2.measured.vout).toBeCloseTo(3.3063, 3); expect(b2.thanks).toBe('Dead on: 3.306 volts.');
    const h = open('2-1', ['1-4']); place(h, 5600, 3300); for (const w of [[[2, 2], [4, 2]], [[8, 2], [14, 2]], [[8, 4], [8, 2]], [[8, 8], [14, 8]]]) ok(h, 'addWire', w);
    expect(bench(h).thanks).toBe('');
  });
  it('the chit prints the band explicitly', () => {
    expect(q(open('2-1', ['1-4']), 'ticketCard').specShort).toBe('OUT 3.23-3.37 V, ADC attached');
  });
});

describe('2-3 coach does not fall back to "switch the power on"', () => {
  it('once the box has been measured, switching the power off leaves the notes on the next step', () => {
    const e = open('2-3', ['1-4', '2-1']); ok(e, 'power', true); ok(e, 'dmmDial', 'dcv'); ok(e, 'dmmLead', 'red', [2, 12]); ok(e, 'dmmLead', 'black', [14, 8]);
    expect(q(e, 'coach').active).toBe('supply'); const n = q(e, 'coach').stepNo;
    ok(e, 'power', false); const c = q(e, 'coach'); expect(c.active).toBe('supply'); expect(c.stepNo).toBe(n); expect(c.steps.find((s: any) => s.id === 'power').done).toBe(true);
  });
});
