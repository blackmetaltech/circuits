// Chapter 6 "Op-Amp Alley" (tickets 6-1 .. 6-7): every repair arrives faulty and fails for the reason its card gives (with the engine's own numbers in the words), every ref passes and pays,
// each named wrong build fails for the right reason, the degenerate boards (nothing, a wire from IN to OUT) never pass, bands have margins, and the coach and hints answer. DESIGN §2.8 chapter 6;
// the circuits are the ones of oracles OA-10 .. OA-15.
import { describe, expect, it } from 'vitest';
import { Engine } from '@core/kit';
import { GAME } from '../game';
import { LEVEL_DEFS } from '../data/levels';
import { clearFaultActions, refActions } from './replay';
import { newTicketProgress, type NodeState } from './state';

const def = (id: string) => LEVEL_DEFS.find((d) => d.id === id)!;
const CH6 = ['6-1', '6-2', '6-3', '6-4', '6-5', '6-6', '6-7'];
/** The ticket opened with everything before it passed; `clear` takes the arrived board apart first (the build tests start from the cleared board). */
function open(id: string, clear = true): Engine<NodeState> {
  const e = new Engine(GAME, { mode: 'learner' }); e.autosave = false;
  const st = structuredClone(e.state) as NodeState;
  for (const d of LEVEL_DEFS) { if (d.id === id) break; st.progress.tickets[d.id] = { ...newTicketProgress(), passed: true, stars: 1 }; }
  e.setState(st);
  expect(e.act('openTicket', [id]).ok, `open ${id}`).toBe(true);
  if (clear) for (const a of clearFaultActions(def(id))) expect(e.act(a.name, a.args ?? []).ok, `${a.name} ${String(a.args)}`).toBe(true);
  return e;
}
const ok = (e: Engine<NodeState>, name: string, ...args: unknown[]) => { const r = e.act(name, args); expect(r.ok, `${name} ${JSON.stringify(args)}: ${r.message}`).toBe(true); return r; };
const q = (e: Engine<NodeState>, name: string, ...args: unknown[]) => e.q(name, args) as any;
const bench = (e: Engine<NodeState>) => { ok(e, 'runBench'); return q(e, 'benchResult'); };
const spec = (b: any, id: string) => b.specs.find((x: any) => x.id === id);
const texts = (b: any): string => b.failures.map((f: any) => f.text).join(' | ');
type Part = [string, number | null, string, number, number, number, boolean?];
const refOf = (id: string) => ({ parts: def(id).ref.parts.map((p) => [p.partId, p.value, p.variant, p.x, p.y, p.rot, p.flip] as Part), wires: def(id).ref.wires.map((w) => w.map((c) => [...c])) });
function build(id: string, parts: Part[], wires: number[][][]) {
  const e = open(id);
  for (const p of parts) ok(e, 'placePart', p[0], p[1], p[2], p[3], p[4], p[5], p[6] ?? false);
  for (const w of wires) ok(e, 'addWire', w);
  return e;
}
const mk = (id: string, edit: (parts: Part[], wires: number[][][]) => void = () => {}) => { const r = refOf(id); edit(r.parts, r.wires); return build(id, r.parts, r.wires); };
const cut = (w: number[][][], a: number[], b: number[]) => { const i = w.findIndex((x) => (x[0]!.join() === a.join() && x[x.length - 1]!.join() === b.join()) || (x[0]!.join() === b.join() && x[x.length - 1]!.join() === a.join())); expect(i, `wire ${a}-${b}`).toBeGreaterThanOrEqual(0); w.splice(i, 1); };
/** The board as it arrives, powered and benched. */
const arrival = (id: string) => { const e = open(id, false); ok(e, 'power', true); ok(e, 'advance', 4); return { e, b: bench(e) }; };
/** The ref replayed from the arrival (exactly the expert persona's actions). */
const refRun = (id: string) => { const e = open(id, false); for (const a of refActions(def(id))) ok(e, a.name, ...(a.args ?? [])); return { e, b: q(e, 'benchResult') }; };
/** Nothing on the board but a wire from IN to OUT (and the rails' pads untouched). */
const straight = (id: string) => bench(build(id, [], [[[2, 8], [22, 8]]]));

// ---------------------------------------------------------------- the chapter map and the unlock chain
describe('chapter 6 unlocks after chapter 5 and runs 6-1, then the repairs, then the exam', () => {
  it('the map has seven chits, the lock chain and short chit lines', () => {
    const e = new Engine(GAME, { mode: 'learner' }); e.autosave = false;
    const set = (ids: string[]) => { const s = structuredClone(e.state) as NodeState; s.progress.tickets = {}; for (const d of ids) s.progress.tickets[d] = { ...newTicketProgress(), passed: true, stars: 1 }; e.setState(s); };
    const m0 = q(e, 'chapterMap', 6); expect(m0.title).toBe('Op-Amp Alley');
    expect(m0.tickets.map((t: any) => t.title)).toEqual(['Mic Preamp', 'Sensor Buffer', 'Studio Preamp', 'Big Swing', 'Thermostat', 'Ramp', 'Exam: Summing Amp']);
    set(['5-4']); expect(q(e, 'chapterMap', 6).tickets.map((t: any) => t.state)).toEqual(['open', 'locked', 'locked', 'locked', 'locked', 'locked', 'locked']);
    set(['5-4', '6-1']); expect(q(e, 'chapterMap', 6).tickets.map((t: any) => t.state)).toEqual(['passed', 'open', 'open', 'locked', 'open', 'open', 'locked']);
    set(['5-4', '6-1', '6-3']); expect(q(e, 'chapterMap', 6).tickets.map((t: any) => t.state)).toEqual(['passed', 'open', 'passed', 'open', 'open', 'open', 'open']);
    for (const t of q(e, 'chapterMap', 6).tickets) { expect(t.spec.length, `${t.id} chit line`).toBeLessThanOrEqual(84); expect(t.chit.x).toBeGreaterThan(0); }
    expect(q(e, 'chapterMap', 6).tickets[6].eb).toBe(true);
  });
  it('every repair ticket arrives with a faulty board; the exam does not; every rail is a fixed bench supply (the player cannot over-volt an op-amp)', () => {
    for (const id of CH6) {
      const d = def(id); expect(!!d.fault, id).toBe(id !== '6-7');
      for (const s of d.supplies) if (s.kind === 'bench') expect(s.fixed, `${id} ${s.id}`).toBeGreaterThan(0);
      if (id !== '6-7') expect(d.onBoard, id).toBeTruthy();
    }
  });
});

// ---------------------------------------------------------------- 6-1
describe('6-1 Mic Preamp', () => {
  it('arrives latched: the feedback is on the + input, OUT sits on the -10.5 V swing limit and swings nothing; the words name the + input', () => {
    const { b } = arrival('6-1');
    expect(b.pass).toBe(false); expect(spec(b, 'gain').pass).toBe(false); expect(spec(b, 'centre').pass).toBe(false);
    expect(Math.abs(b.measured.centre)).toBeCloseTo(10.5, 2); expect(b.measured.gain).toBeLessThan(1e-3);
    expect(texts(b)).toMatch(/sat at a rail/); expect(texts(b)).toMatch(/\+ input \(pin 3\)/); expect(b.failures).toHaveLength(1);
  });
  it('the ref (470k / 10k, inverting) passes from the arrival: 0.926 Vpp (gain 46.3 with the mic\'s 150 ohm), centred, 2 stars, paid', () => {
    const { e, b } = refRun('6-1');
    expect(b.pass, texts(b)).toBe(true); expect(b.measured.gain).toBeCloseTo(0.9258, 3); expect(Math.abs(b.measured.centre)).toBeLessThan(1e-3);
    expect(spec(b, 'gain').margin).toBeGreaterThan(0.03); expect(b.stars).toBe(2); expect(b.pay).toBe(1400 + 2 * 300);
    expect((e.state as NodeState).progress.tickets['6-1']!.passed).toBe(true);
  });
  it('100k / 2.2k reads gain 42.5 (the mic adds 150 ohm to Rin) and fails; the words give the gain and the formula', () => {
    const b = bench(mk('6-1', (p) => { p[1]![1] = 2.2e3; p[2]![1] = 100e3; }));
    expect(b.pass).toBe(false); expect(b.measured.gain / 0.02).toBeCloseTo(42.5, 0); expect(texts(b)).toMatch(/a gain of 42\.\d/); expect(texts(b)).toMatch(/Rin \+ the source's 150 Ω/);
  });
  it('the degenerate boards fail: nothing on the board, a wire from IN to OUT (the bench sees IN and OUT joined)', () => {
    const e0 = open('6-1'); const b0 = bench(e0); expect(b0.pass).toBe(false);
    const b1 = straight('6-1'); expect(b1.pass).toBe(false); expect(texts(b1)).toMatch(/IN|joined|same/);
  });
  it('the coach starts at the power switch and then points at pin 2; the hint gives the formula with the mic', () => {
    const e = open('6-1', false); expect(q(e, 'coach').active).toBe('power'); ok(e, 'power', true); ok(e, 'advance', 2);
    const c = q(e, 'coach'); expect(['clip', 'fix']).toContain(c.active); expect(c.text.length).toBeGreaterThan(10);
    ok(e, 'hint'); const h = ok(e, 'hint'); expect(h.message).toMatch(/470 k|470000|470k/);
  });
  it('the scope locks on the live sine of the ref', () => {
    const { e } = refRun('6-1'); ok(e, 'attachProbe', 1, [22, 8]); for (let i = 0; i < 120 && !q(e, 'scope').trace?.complete; i++) ok(e, 'advance', 8);
    const sc = q(e, 'scope'); expect(sc.trace.complete).toBe(true); expect(Math.max(...sc.trace.v)).toBeGreaterThan(0.44); expect(sc.lock).toBe(true);
  });
});

// ---------------------------------------------------------------- 6-2
describe('6-2 Sensor Buffer', () => {
  it('arrives inverting with 10k / 20k behind the probe\'s 100k: it reads -0.182 x the EMF (9 %), and the words say the probe\'s 100 kohm eats it', () => {
    const { b } = arrival('6-2');
    expect(b.pass).toBe(false); expect(b.measured.out10).toBeCloseTo(-0.1818, 3); expect(b.measured.out02).toBeCloseTo(-0.0364, 3);
    expect(texts(b)).toMatch(/9\.1 % of what it should be/); expect(texts(b)).toMatch(/100 kΩ feeds your input resistor \(10 kΩ\)/);
  });
  it('the ref (non-inverting 10k / 10k) passes at 0.2, 0.6 and 1.0 V: 2.0000 x EMF, and pays', () => {
    const { b } = refRun('6-2');
    expect(b.pass, texts(b)).toBe(true); expect(b.measured.out10).toBeCloseTo(2.0, 4); expect(b.measured.out02).toBeCloseTo(0.4, 4); expect(spec(b, 'out02').margin).toBeGreaterThan(0.0035); expect(b.pay).toBeGreaterThan(1200);
  });
  it('inverting 10k / 220k reads -2 x EMF (220k / (10k + 100k): the right size, the wrong sign) and fails with words that say so; a follower reads 1 x', () => {
    const inv = def('6-2').fault!;
    const b = bench(build('6-2', inv.parts.map((p, i) => [p.partId, i === 2 ? 220e3 : p.value, p.variant, p.x, p.y, p.rot, p.flip] as Part), inv.wires.map((x) => x.map((c) => [...c]))));
    expect(b.pass).toBe(false); expect(b.measured.out10).toBeCloseTo(-2.0, 3); expect(texts(b)).toMatch(/the right size, the wrong sign/);
    const f = bench(build('6-2', [['tl072', null, 'DIP8', 12, 6, 0]], [[[2, 8], [12, 8]], [[12, 7], [12, 6]], [[12, 6], [11, 6], [11, 3], [22, 3], [22, 8]], [[12, 9], [12, 11], [6, 11], [6, 14], [2, 14]], [[15, 6], [15, 1], [2, 1]]]));
    expect(f.pass).toBe(false); expect(f.measured.out10).toBeCloseTo(1.0, 3); expect(texts(f)).toMatch(/1 times the probe; the meter wants 2 times/);
  });
  it('the degenerate boards fail: nothing, and a wire from IN to OUT', () => {
    expect(bench(open('6-2')).pass).toBe(false);
    const b = straight('6-2'); expect(b.pass).toBe(false);
  });
  it('the PROBE switch has three positions and the coach starts at the power switch', () => {
    const e = open('6-2', false); expect(q(e, 'ticketCard').selectors.map((s: any) => [s.id, s.options])).toEqual([['emf', ['1.0 V', '0.6 V', '0.2 V']]]); expect(q(e, 'coach').active).toBe('power');
  });
});

// ---------------------------------------------------------------- 6-3
describe('6-3 Studio Preamp', () => {
  it('arrives as one LM358 stage at -100: 30.3 dB at 20 kHz against the 38.5 dB floor; the words give GBW / gain = 6.9 kHz and the two-stage cure', () => {
    const { b } = arrival('6-3');
    expect(b.pass).toBe(false); expect(spec(b, 'flat').pass).toBe(false); expect(spec(b, 'tone').pass).toBe(true);
    expect(texts(b)).toMatch(/At 20000 Hz the gain was only 30\.\d dB/); expect(texts(b)).toMatch(/bandwidth is 6\.9\d* kHz/); expect(texts(b)).toMatch(/Two stages of gain 10/);
  });
  it('the ref (both halves, 10k / 100k twice) passes with 0.67 dB to spare at 20 kHz (39.17 dB, the fallback mask 38.5 - 41 dB) and pays', () => {
    const { b } = refRun('6-3');
    expect(b.pass, texts(b)).toBe(true); expect(spec(b, 'flat').margin).toBeCloseTo(0.67, 1); expect(b.pay).toBeGreaterThan(1500);
  });
  it('the ref would sit only 0.17 dB inside DESIGN\'s 39 dB floor (why the ticket uses the fallback): a 39 - 41 dB mask on the same board reads 39.17 dB at 20 kHz', async () => {
    const { checkMask } = await import('../sim/bench/mask');
    const { liveRig } = await import('./ticket-run');
    const { e } = refRun('6-3'); const st = e.state as NodeState; const rig = liveRig(st.ticket!, def('6-3'));
    const r = checkMask(rig.circuit!, 'x', 'out', 'in', [{ f1: 20, f2: 20e3, lo: 39, hi: 41 }]);
    expect(r.ok).toBe(true); expect(r.worst).toBeGreaterThan(0.15); expect(r.worst).toBeLessThan(0.2);
  });
  it('one NE5532 stage at -100 (GBW 12 MHz) passes; one LM358 stage at -10 gives 20 dB and fails', () => {
    const b1 = bench(build('6-3', [['ne5532', null, 'DIP8', 12, 6, 0], ['res-cf', 1e3, '0.25W', 5, 7, 0], ['res-cf', 100e3, '0.25W', 7, 4, 0]], def('6-3').fault!.wires.map((x) => x.map((c) => [...c]))));
    expect(b1.pass, texts(b1)).toBe(true);
    const b2 = bench(build('6-3', [['lm358', null, 'DIP8', 12, 6, 0], ['res-cf', 10e3, '0.25W', 5, 7, 0], ['res-cf', 100e3, '0.25W', 7, 4, 0]], def('6-3').fault!.wires.map((x) => x.map((c) => [...c]))));
    expect(b2.pass).toBe(false); expect(texts(b2)).toMatch(/gain was (only )?(19|20)\.\d dB/);
  });
  it('the degenerate boards fail: nothing, a wire from IN to OUT', () => { expect(bench(open('6-3')).pass).toBe(false); expect(straight('6-3').pass).toBe(false); });
});

// ---------------------------------------------------------------- 6-4
describe('6-4 Big Swing', () => {
  it('arrives on an LM741: a 4.9 Vpp triangle (THD 12 %) instead of 20 Vpp; the words give its 0.5 V/us against the 3.14 V/us the sine needs', () => {
    const { b } = arrival('6-4');
    expect(b.pass).toBe(false); expect(b.measured.swing).toBeLessThan(5.5); expect(b.measured.swing).toBeGreaterThan(4.5); expect(b.measured.thd).toBeGreaterThan(10);
    expect(texts(b)).toMatch(/only 0\.5 V per microsecond/); expect(texts(b)).toMatch(/3\.14 V per microsecond/); expect(b.failures).toHaveLength(1);
  });
  it('the ref (TL072, 33k / 8.2k) passes: 20.07 Vpp, THD 0.01 %, and pays', () => {
    const { b } = refRun('6-4');
    expect(b.pass, texts(b)).toBe(true); expect(b.measured.swing).toBeCloseTo(20.07, 1); expect(b.measured.thd).toBeLessThan(0.5); expect(spec(b, 'swing').margin).toBeGreaterThan(0.9); expect(b.pay).toBeGreaterThan(1400);
  });
  it('the degenerate boards fail: nothing, a wire from IN to OUT', () => {
    expect(bench(open('6-4')).pass).toBe(false);
    const b = straight('6-4'); expect(b.pass).toBe(false);
  });
});

// ---------------------------------------------------------------- 6-5
describe('6-5 Thermostat', () => {
  it('arrives without hysteresis: OUT chatters (8 switchings in the run), the first off at 49.7 C; the words count the switchings and name the feedback cure', () => {
    const { b } = arrival('6-5');
    expect(b.pass).toBe(false); expect(b.measured.flips).toBe(8); expect(spec(b, 'flips').pass).toBe(false);
    expect(texts(b)).toMatch(/OUT switched 8 times/); expect(texts(b)).toMatch(/two switch points/); expect(texts(b)).toMatch(/went off at 49\.\d C/);
  });
  it('the ref (82 kohm from OUT to +) passes: off at 52.7 C rising, on at 47.2 C falling (OA-14: 52.8 / 47.0 without noise), OUT 4.87 V on', () => {
    const { b } = refRun('6-5');
    expect(b.pass, texts(b)).toBe(true); expect(b.measured.flips).toBe(2);
    const tOff = 40 + b.measured.off * 1000, tOn = 60 - (b.measured.on - 0.02) * 1000;
    expect(Math.abs(tOff - 52.82)).toBeLessThan(0.45); expect(Math.abs(tOn - 46.97)).toBeLessThan(0.45); expect(b.measured.high).toBeCloseTo(4.87, 2); expect(b.pay).toBeGreaterThan(1500);
  });
  it('100 kohm also passes; 1 Mohm (too little hysteresis for the noise, or too narrow) and 22 kohm (too wide) fail', () => {
    const rh = (r: number) => bench(mk('6-5', (p) => { p[5]![1] = r; }));
    expect(rh(100e3).pass).toBe(true);
    const wide = rh(22e3); expect(wide.pass).toBe(false); expect(texts(wide)).toMatch(/went off at 5\d\.\d C|came back on at 4\d\.\d C/);
  });
  it('without the pull-up OUT never reads high (about 2.5 V): the words say the open collector can only pull down', () => {
    const b = bench(mk('6-5', (p, w) => { p.splice(4, 1); cut(w, [20, 2], [16, 0]); }));
    expect(b.pass).toBe(false); expect(b.measured.high).toBeLessThan(2.7); expect(b.measured.high).toBeGreaterThan(2.3); expect(texts(b)).toMatch(/can only pull down/);
  });
  it('the degenerate board (nothing placed) fails', () => { expect(bench(open('6-5')).pass).toBe(false); });
  it('the live scope sweeps the whole run from power-on and locks on the ref', () => {
    const { e } = refRun('6-5'); ok(e, 'attachProbe', 1, [22, 8]); for (let i = 0; i < 200 && !q(e, 'scope').trace?.complete; i++) ok(e, 'advance', 8);
    const sc = q(e, 'scope'); expect(sc.trace.complete).toBe(true); expect(Math.max(...sc.trace.v)).toBeGreaterThan(4.5); expect(Math.min(...sc.trace.v)).toBeLessThan(0.3); expect(sc.lock).toBe(true);
  });
});

// ---------------------------------------------------------------- 6-6
describe('6-6 Ramp', () => {
  it('arrives with no resistor across C: the 50 mV offset runs OUT down to the -10.5 V limit, where the triangle rides clipped (average -9.9 V); the words say the DC adds up', () => {
    const { b } = arrival('6-6');
    expect(b.pass).toBe(false); expect(spec(b, 'centre').pass).toBe(false); expect(b.measured.centre).toBeLessThan(-9.5); expect(b.measured.centre).toBeGreaterThan(-10.5);
    expect(texts(b)).toMatch(/ran down to the -10\.5 V rail|ran down to the rail/); expect(texts(b)).toMatch(/adds DC up for ever/);
  });
  it('the ref (11k, 22 nF, 56k across) passes: 2.03 Vpp (2.038 by the formula; the generator\'s 50 ohm adds to Rin), centred at -0.243 V (the pin\'s square is high 1 us less than low: 48 mV of DC, not 50)', () => {
    const { b } = refRun('6-6');
    expect(b.pass, texts(b)).toBe(true); expect(b.measured.vpp).toBeCloseTo(2.03, 1); expect(Math.abs(b.measured.vpp - 2.038 * 11 / 11.05)).toBeLessThan(0.01); expect(b.measured.centre).toBeCloseTo(-0.2433, 3); expect(b.pay).toBeGreaterThan(1400);
  });
  it('Rf 10 kohm rounds the triangle to about 1.48 Vpp and fails with the tanh formula', () => {
    const b = bench(mk('6-6', (p) => { p[3]![1] = 10e3; }));
    expect(b.pass).toBe(false); expect(b.measured.vpp).toBeCloseTo(1.48, 1); expect(texts(b)).toMatch(/tanh/);
  });
  it('the degenerate boards fail: nothing, a wire from IN to OUT', () => { expect(bench(open('6-6')).pass).toBe(false); expect(straight('6-6').pass).toBe(false); });
  it('the arrival with the chip pulled fails: 11 k and 22 nF alone hand the 2 Vpp square straight to OUT, and the shape check sees a square (THD 42.9 %), not a triangle (12.1 %)', () => {
    const e = open('6-6', false); ok(e, 'deletePart', 'x1'); const b = bench(e);
    expect(b.pass).toBe(false); expect(spec(b, 'shape').pass).toBe(false); expect(b.measured.shape).toBeGreaterThan(40);
  });
  it('the ref\'s triangle is a triangle by the shape check: THD 12 to 14 % (an ideal triangle is 12.1 %)', () => {
    const { b } = refRun('6-6'); expect(b.measured.shape).toBeGreaterThan(11.5); expect(b.measured.shape).toBeLessThan(14);
  });
});

// ---------------------------------------------------------------- 6-7
describe('6-7 EB: Summing Amp', () => {
  const R = def('6-7').ref;
  const exam = (preds: Record<string, number>, edit: (p: Part[]) => void = () => {}) => {
    const e = open('6-7'); const parts = R.parts.map((p) => [p.partId, p.value, p.variant, p.x, p.y, p.rot, p.flip] as Part); edit(parts);
    for (const p of parts) ok(e, 'placePart', ...p); for (const w of R.wires) ok(e, 'addWire', w); for (const [k, v] of Object.entries(preds)) ok(e, 'predict', k, v); return e;
  };
  it('no answer shows before the prediction; the ref with exact predictions passes with 3 stars; the debrief works the card and the TL072 clip', () => {
    const c = q(open('6-7'), 'ticketCard'); expect(JSON.stringify(c)).not.toMatch(/4\.75|9\.5\b|14\.25/);
    const b = bench(exam(R.predictions!)); expect(b.pass, texts(b)).toBe(true); expect(b.stars).toBe(3);
    expect(b.measured.v1).toBeCloseTo(-4.75, 3); expect(b.measured.v3).toBeCloseTo(-14.25, 2);
    const w = b.debrief.working.join(' '); expect(b.debrief.node).toBe('sum');
    expect(w).toMatch(/0\.475 mA/); expect(w).toMatch(/= -4\.75 V/); expect(w).toMatch(/-14\.25 V, still inside the \+-15 V rails/); expect(w).toMatch(/stops near -13\.5 V/);
  });
  it('wrong predictions still pass the build with one star; a wrong input resistor fails the build with the formula', () => {
    const b1 = bench(exam({ pv1: -1, pv2: -2, pv3: -3 })); expect(b1.pass).toBe(true); expect(b1.stars).toBe(1);
    const b2 = bench(exam(R.predictions!, (p) => { p[1]![1] = 10e3; })); expect(b2.pass).toBe(false); expect(texts(b2)).toMatch(/OUT = -Rf x \(V1\/R1 \+ V2\/R2 \+ V3\/R3\)/);
  });
  it('the degenerate board (nothing placed, predictions entered) fails', () => { const e = open('6-7'); for (const [k, v] of Object.entries(R.predictions!)) ok(e, 'predict', k, v); expect(bench(e).pass).toBe(false); });
});
