// Chapter 3 "Charge" (tickets 3-1 .. 3-4): every naive build fails for the stated reason, every ref passes, bands are calibrated with margins, the scope's time trace and its tube come from the
// real engine, and the UI queries answer. DESIGN §2.8, docs/API-CH3.md.
import { describe, expect, it } from 'vitest';
import { Engine } from '@core/kit';
import { GAME } from '../game';
import { LEVEL_DEFS } from '../data/levels';
import { getDef } from './board';
import { runTicketBench } from '../sim/bench/ticket';
import { refActions } from './replay';
import { refBoard } from './tickets';
import { newTicketProgress, type NodeState } from './state';

const def = (id: string) => LEVEL_DEFS.find((d) => d.id === id)!;
/** A fresh engine with the earlier tickets passed (so `id` is unlocked), the ticket open. */
function open(id: string, passed: string[] = ['1-4', '2-3', '3-1', '3-2'], mode = 'learner'): Engine<NodeState> {
  const e = new Engine(GAME, { mode }); e.autosave = false;
  const st = structuredClone(e.state) as NodeState;
  for (const d of passed) st.progress.tickets[d] = { ...newTicketProgress(), passed: true, stars: 1 };
  e.setState(st);
  expect(e.act('openTicket', [id]).ok, `open ${id}`).toBe(true);
  return e;
}
const ok = (e: Engine<NodeState>, name: string, ...args: unknown[]) => { const r = e.act(name, args); expect(r.ok, `${name} ${JSON.stringify(args)}: ${r.message}`).toBe(true); return r; };
const bad = (e: Engine<NodeState>, name: string, ...args: unknown[]) => { const r = e.act(name, args); expect(r.ok, `${name} should be refused`).toBe(false); return r.message; };
const q = (e: Engine<NodeState>, name: string, ...args: unknown[]) => e.q(name, args) as any;
const bench = (e: Engine<NodeState>) => { ok(e, 'runBench'); return q(e, 'benchResult'); };
const spec = (b: any, id: string) => b.specs.find((x: any) => x.id === id);
const runRef = (e: Engine<NodeState>, id: string) => { for (const a of refActions(def(id)).filter((x) => x.name !== 'runBench' && x.name !== 'power' && x.name !== 'advance')) ok(e, a.name, ...(a.args ?? [])); };
const texts = (b: any): string => b.failures.map((f: any) => f.text).join(' | ');
const frames = (e: Engine<NodeState>, n: number) => { for (let i = 0; i < n; i += 8) ok(e, 'advance', Math.min(8, n - i)); };

// ---------------------------------------------------------------- unlocking and the chapter map
describe('chapter 3 unlocks after the last chapter-2 build ticket or the slide-wire exam', () => {
  it('3-1 is locked on a fresh save and opens after 2-3 alone or after 2-4 alone; 3-2 and 3-3 follow 3-1; the exam needs 3-1 and one more', () => {
    const e = new Engine(GAME, { mode: 'learner' }); e.autosave = false;
    expect(bad(e, 'openTicket', '3-1')).toMatch(/2-3 or 2-4/);
    for (const id of ['2-3', '2-4']) { const x = open('3-1', [id]); expect(x.state.ticket!.id).toBe('3-1'); }
    const set = (ids: string[]) => { const s = structuredClone(e.state) as NodeState; s.progress.tickets = {}; for (const d of ids) s.progress.tickets[d] = { ...newTicketProgress(), passed: true, stars: 1 }; e.setState(s); };
    set(['2-3']); expect(q(e, 'chapterMap', 3).tickets.map((t: any) => t.state)).toEqual(['open', 'locked', 'locked', 'locked']);
    set(['2-3', '3-1']); expect(q(e, 'chapterMap', 3).tickets.map((t: any) => t.state)).toEqual(['passed', 'open', 'open', 'locked']);
    set(['2-3', '3-1', '3-3']); expect(q(e, 'chapterMap', 3).tickets.map((t: any) => t.state)).toEqual(['passed', 'open', 'passed', 'open']);
    set(['2-3', '3-1']); expect(bad(e, 'openTicket', '3-4')).toMatch(/Pass 3-2 or 3-3 first/);
    const m = q(e, 'chapterMap', 3); expect(m.title).toBe('Charge'); expect(m.blurb).toMatch(/time comes in/); expect(m.starsTotal).toBe(2 + 2 + 2 + 3);
    expect(m.tickets.map((t: any) => t.title)).toEqual(['Flash Timer', 'Debounce', 'Relay Pull-in', 'Exam: Capacitor Bank']);
    expect(m.tickets[3].eb).toBe(true); expect(m.tickets.every((t: any) => t.spec !== '' && t.chit.x > 0 && t.payText.includes('per new star'))).toBe(true);
  });
});

// ---------------------------------------------------------------- 3-1
describe('3-1 Flash Timer', () => {
  const build = (r: number, c: number, v = '16V') => {
    const e = open('3-1', ['1-4', '2-3']);
    ok(e, 'placePart', 'res-cf', r, '0.25W', 4, 2, 0, false); ok(e, 'placePart', 'cap-el', c, v, 14, 4, 1, false);
    for (const w of [[[2, 2], [4, 2]], [[8, 2], [14, 2]], [[14, 2], [14, 4]], [[14, 6], [14, 8]]]) ok(e, 'addWire', w);
    return e;
  };
  it('the ref (10 kohm + 100 uF 16 V) crosses 6.32 V at 1.000 s and passes with 2 stars at par cost; the fee plus the star bonus is paid', () => {
    const e = open('3-1', ['1-4', '2-3']); runRef(e, '3-1'); const b = bench(e);
    expect(b.pass).toBe(true); expect(b.stars).toBe(2); expect(b.metrics).toMatchObject({ parts: 2, cost: 10 }); expect(b.measured.tcross).toBeCloseTo(0.9997, 2);
    expect(spec(b, 'tcross').margin).toBeGreaterThan(0.04); expect(b.pay).toBe(700 + 2 * 200); expect(q(e, 'wallet').minor).toBe(1100);
    expect(b.thanks).toBe('');
  });
  it('the E-series pairs of the design pass: 4.7k + 220u, 2.2k + 470u, 22k + 47u (all 1.034 s) and 100k + 10u (1.006 s, the cheapest); 1M + 1u, 220k + 4.7u, 10k + 10u and 47k + 100u fail', () => {
    for (const [r, c, t] of [[4.7e3, 220e-6, 1.034], [2.2e3, 470e-6, 1.034], [22e3, 47e-6, 1.034], [100e3, 10e-6, 1.006]] as [number, number, number][]) {
      const b = bench(build(r, c, '25V')); expect(b.pass, `${r} ${c}`).toBe(true); expect(b.measured.tcross).toBeCloseTo(t, 2);
    }
    const cheap = bench(build(100e3, 10e-6)); expect(cheap.metrics.cost).toBe(8); expect(cheap.metrics.cost).toBeLessThan(10);
    for (const [r, c] of [[1e6, 1e-6], [220e3, 4.7e-6], [10e3, 10e-6], [47e3, 100e-6]] as [number, number][]) expect(bench(build(r, c)).pass, `${r} ${c}`).toBe(false);
  });
  it('1 Mohm + 1 uF looks right (tau = 1 s) but the 10 Mohm scope probe loads it: crossing at 1.08 s; the first miss names the probe, the second works the Thevenin divider (9.09 V behind 0.909 Mohm)', () => {
    const e = build(1e6, 1e-6); const b1 = bench(e);
    expect(b1.pass).toBe(false); expect(b1.measured.tcross).toBeCloseTo(1.08, 2); expect(spec(b1, 'tcross').pass).toBe(false); expect(spec(b1, 'tube').pass).toBe(false);
    expect(texts(b1)).toMatch(/1 MΩ and 1 µF make a time constant of 1 s/); expect(texts(b1)).toMatch(/scope probe is 10 MΩ/); expect(texts(b1)).not.toMatch(/Thevenin/);
    const b2 = bench(e); expect(texts(b2)).toMatch(/Thevenin/); expect(texts(b2)).toMatch(/9\.09 V behind 909 kΩ/); expect(texts(b2)).toMatch(/1\.08 s/);
    expect(b1.failures.length).toBe(1);   // the crossing and the tube say the same thing once
  });
  it('a wrong R x C says which way: 10 k + 10 u is too quick (0.100 s), 47 k + 100 u too slow (4.71 s), and the repeat gives the R and C you need', () => {
    const e = build(10e3, 10e-6); expect(texts(bench(e))).toMatch(/after only 100 ms.*too short/);
    expect(texts(bench(e))).toMatch(/you need R x C = 1 s.*the resistor should be 100 kΩ.*capacitor should be 100 µF/);
    expect(texts(bench(build(47e3, 100e-6)))).toMatch(/took 4\.71 s.*too long/);
  });
  it('a 6.3 V capacitor on 10 V vents (over 1.2 x its rating for 50 ms) and says to take 16 V; a reversed electrolytic vents too', () => {
    const e = build(10e3, 100e-6, '6.3V'); const b = bench(e);
    expect(b.pass).toBe(false); expect(b.smoked).toHaveLength(1); expect(texts(b)).toMatch(/100 µF electrolytic capacitor \(6\.3 V\) saw/); expect(texts(b)).toMatch(/Pick a 16 V part/);
    const r = open('3-1', ['1-4', '2-3']); ok(r, 'placePart', 'res-cf', 10e3, '0.25W', 4, 2, 0, false); ok(r, 'placePart', 'cap-el', 100e-6, '16V', 14, 8, 3, false);
    for (const w of [[[2, 2], [4, 2]], [[8, 2], [14, 2]], [[14, 2], [14, 6]]]) ok(r, 'addWire', w);
    const br = bench(r); expect(br.pass).toBe(false); expect(texts(br)).toMatch(/the wrong way round/); expect(texts(br)).toMatch(/stripe marks the minus leg/);
  });
  it('LIVE: the 6.3 V capacitor vents about 1.5 s into the sweep (frame 75-90); the electrolytic reversed vents inside the sweep too; the vent event is the engine\'s', () => {
    const e = build(10e3, 100e-6, '6.3V'); ok(e, 'attachProbe', 1, [14, 2]); ok(e, 'power', true);
    let n = 0; while (n < 200 && q(e, 'liveFrame').events.length === 0) { ok(e, 'advance', 1); n++; }
    expect(n).toBeGreaterThan(70); expect(n).toBeLessThan(95);
    const ref = build(10e3, 100e-6, '6.3V'); ok(ref, 'attachProbe', 1, [14, 2]); ok(ref, 'power', true); frames(ref, 66); const cp = q(ref, 'liveFrame').parts.find((x: any) => x.cap); expect(cp.cap.v).toBeGreaterThan(6.3); expect(cp.ratio).toBeGreaterThan(1);   // swelling before it pops
    const ev = q(e, 'liveFrame').events[0]; expect(ev).toMatchObject({ kind: 'vent', key: 'smoke.cap.over' }); expect(ev.text).toMatch(/16 V part/);
    expect(q(e, 'liveFrame').parts.find((x: any) => x.cap).cap.vrated).toBe(6.3);
    expect(q(e, 'scope').lock).toBe(false);
  });
  it('LIVE scope: the sweep forms over 100 frames (256 samples), the tube is drawn on the same grid, LOCK appears when the whole curve is in it; the clip is needed', () => {
    const e = build(10e3, 100e-6); ok(e, 'power', true); let sc = q(e, 'scope');
    expect(sc.trace.v).toHaveLength(0); expect(sc.target).toMatchObject({ mode: 'trace', unit: 'V', clipped: false, label: 'OUT', timePerDiv: 0.2, clip: { connector: 'OUT' } }); expect(sc.lock).toBe(false);
    ok(e, 'attachProbe', 1, [14, 2]); expect(q(e, 'scope').target.clipped).toBe(true);
    frames(e, 48); sc = q(e, 'scope');
    expect(sc.trace.v.length).toBeGreaterThan(100); expect(sc.trace.v.length).toBeLessThan(140); expect(sc.trace.complete).toBe(false); expect(sc.lock).toBe(false); expect(sc.sweepText).toMatch(/forming/);
    expect(sc.trace.tube.kind).toBe('exp'); expect(sc.trace.tube.lo).toHaveLength(256); expect(sc.trace.tube.hi).toHaveLength(256);
    frames(e, 56); sc = q(e, 'scope');
    expect(sc.trace.v).toHaveLength(256); expect(sc.trace.complete).toBe(true); expect(sc.trace.bad).toEqual([]); expect(sc.lock).toBe(true); expect(sc.sweepText).toMatch(/Locked/);
    expect(sc.t0).toBe(0); expect(sc.dt).toBeCloseTo(2 / 256, 6); expect(sc.trace.v[0]).toBe(0); expect(sc.trace.v[255]).toBeCloseTo(8.63, 1);   // 10 (1 - e^-2) = 8.647 at 2 s, the scope's 10 divisions
    expect(sc.trace.v.every((y: number, k: number) => y >= sc.trace.tube.lo[k] && y <= sc.trace.tube.hi[k])).toBe(true);
    frames(e, 40); expect(q(e, 'scope').trace.v).toHaveLength(256);   // the sweep holds once it is complete
  });
  it('LIVE scope: the loaded 1 M + 1 uF never locks (the curve leaves the tube: red samples), and a changed circuit, probe or time knob starts the sweep again', () => {
    const e = build(1e6, 1e-6); ok(e, 'attachProbe', 1, [14, 2]); ok(e, 'power', true); frames(e, 104);
    let sc = q(e, 'scope'); expect(sc.trace.complete).toBe(true); expect(sc.trace.bad.length).toBeGreaterThan(20); expect(sc.lock).toBe(false); expect(sc.sweepText).toMatch(/left the amber tube|not met/);
    // the time knob: 0.5 s per division is a 5 s sweep, restarted from power-on; the tube follows
    ok(e, 'setScope', { timePerDiv: 0.5 }); sc = q(e, 'scope'); expect(sc.trace.v).toHaveLength(0); expect(sc.target.timePerDiv).toBe(0.5);
    frames(e, 8); sc = q(e, 'scope'); expect(sc.dt).toBeCloseTo(5 / 256, 6); expect(sc.trace.v.length).toBeGreaterThan(5); expect(sc.trace.v.length).toBeLessThan(40);
    ok(e, 'deletePart', 'p1'); ok(e, 'placePart', 'res-cf', 10e3, '0.25W', 4, 2, 0, false); ok(e, 'addWire', [[2, 2], [4, 2]]); ok(e, 'addWire', [[8, 2], [14, 2]]); frames(e, 8); sc = q(e, 'scope'); expect(sc.trace.v.length).toBeLessThan(40);
    bad(e, 'setScope', { timePerDiv: 5 });
  });
  it('the coach asks for the parts, the wiring (polarity), power, the scope clip, then the bench; the shoebox lists E12 1 k - 1 M and 10 caps in three ratings', () => {
    const e = open('3-1', ['1-4', '2-3']); let c = q(e, 'coach'); expect(c.active).toBe('place'); expect(c.anchor).toMatchObject({ target: 'bin', partId: 'cap-el' }); expect(c.text).toMatch(/Ines/); expect(c.text).toMatch(/stripe marks its minus leg/);
    runRef(e, '3-1'); c = q(e, 'coach'); expect(c.active).toBe('power');
    ok(e, 'power', true); c = q(e, 'coach'); expect(c.active).toBe('clip'); expect(c.anchor.target).toBe('scope'); expect(c.text).toMatch(/TIME knob/);
    ok(e, 'attachProbe', 1, [14, 2]); c = q(e, 'coach'); expect(c.active).toBe('run-bench'); expect(c.text).toMatch(/0\.95 and 1\.05 s/);
    const card = q(e, 'ticketCard'), res = card.shoebox.find((f: any) => f.partId === 'res-cf'), cap = card.shoebox.find((f: any) => f.partId === 'cap-el');
    expect(res.values).toHaveLength(37); expect(res.values[0]).toBe(1e3); expect(res.values[36]).toBe(1e6); expect(cap.values).toHaveLength(10); expect(cap.variants.map((v: any) => v.id)).toEqual(['6.3V', '16V', '25V']);
    expect(cap.variants.map((v: any) => v.price)).toEqual([3, 5, 7]);
    expect(card.specs.map((s: any) => s.id)).toEqual(['tcross', 'tube']); expect(card.hasHints).toBe(true);
  });
  it('the hint ladder: a nudge, then the equation with the live numbers', () => {
    const e = open('3-1', ['1-4', '2-3']); ok(e, 'hint'); expect(q(e, 'ticketCard').hintRung).toBe(1); const h = ok(e, 'hint'); expect(h.message).toMatch(/63\.2 %/); expect(h.message).toMatch(/R x C = 1 s/);
  });
});

// ---------------------------------------------------------------- 3-2
describe('3-2 Debounce', () => {
  const build = (r: number, c: number, cv = 'cap-cer') => {
    const e = open('3-2', ['1-4', '2-3', '3-1']);
    ok(e, 'placePart', 'res-cf', r, '0.25W', 4, 8, 0, false);
    if (cv === 'cap-cer') { ok(e, 'placePart', 'cap-cer', c, '50V', 14, 9, 1, false); for (const w of [[[2, 8], [4, 8]], [[8, 8], [14, 8]], [[14, 8], [14, 9]]]) ok(e, 'addWire', w); }
    else { ok(e, 'placePart', 'cap-el', c, '16V', 14, 9, 1, false); for (const w of [[[2, 8], [4, 8]], [[8, 8], [14, 8]], [[14, 8], [14, 9]], [[14, 11], [14, 13]]]) ok(e, 'addWire', w); }
    return e;
  };
  it('the ref (47 kohm + 330 nF) crosses once on the press (10.5 ms after first contact) and once on the release (13 ms) in all four bounce patterns, with 5 ms of margin on every side', () => {
    const e = open('3-2', ['1-4', '2-3', '3-1']); runRef(e, '3-2'); const b = bench(e);
    expect(b.pass).toBe(true); expect(b.stars).toBe(2); expect(q(e, 'ticketCard').conditions).toHaveLength(4);
    expect(b.measured.npress).toBe(1); expect(b.measured.nrelease).toBe(1);
    const press = b.measured.press - 0.01, release = b.measured.release - 0.05;
    expect(press).toBeGreaterThan(0.0102); expect(press).toBeLessThan(0.0112); expect(release).toBeGreaterThan(0.0125); expect(release).toBeLessThan(0.0145);
    expect(spec(b, 'press').margin).toBeGreaterThan(0.0053); expect(spec(b, 'release').margin).toBeGreaterThan(0.0065);
    expect(b.pay).toBe(800 + 2 * 200);
  });
  it('the filter that is too weak lets the bounce through (13 crossings: 1 k + 10 nF), one far too strong never gets there (470 k + 1 uF), a slow one lands late (68 k + 680 nF: 47 ms), a quick one early (22 k + 220 nF: 14.4 ms)', () => {
    const weak = bench(build(1e3, 10e-9)); expect(weak.pass).toBe(false); expect(weak.measured.npress).toBeGreaterThan(5); expect(texts(weak)).toMatch(/crossed 2\.5 V \d+ times/); expect(texts(weak)).toMatch(/shorter than the 2 ms of chatter/);
    const strong = bench(build(470e3, 1e-6, 'cap-el')); expect(strong.pass).toBe(false); expect(texts(strong)).toMatch(/never crossed 2\.5 V/); expect(texts(strong)).toMatch(/far too long/);
    const late = bench(build(68e3, 680e-9)); expect(late.pass).toBe(false); expect(texts(late)).toMatch(/too long/);
    const early = bench(build(22e3, 220e-9)); expect(early.pass).toBe(false); expect(early.measured.npress).toBe(1); expect(texts(early)).toMatch(/before 15 ms|too quick/);
    expect(bench(build(100e3, 1e-6, 'cap-el')).pass).toBe(false);
    expect(bench(build(68e3, 470e-9)).pass).toBe(true);   // inside the band (29.3 ms), though with less than a millisecond to spare
  });
  it('LIVE: the test finger presses at 10 ms and lets go at 50 ms; the contact is closed in the liveFrame while it is down; the sweep locks for the ref', () => {
    const e = open('3-2', ['1-4', '2-3', '3-1']); runRef(e, '3-2'); ok(e, 'attachProbe', 1, [14, 8]); ok(e, 'power', true);
    expect(q(e, 'liveFrame').contacts).toEqual([{ id: 'btn', a: 'SW', b: 'GND', closed: false }]);
    frames(e, 16); let f = q(e, 'liveFrame'); expect(f.contacts[0].closed).toBe(true);   // 16 frames of 1 ms: the first contact was at 10 ms
    frames(e, 8); expect(q(e, 'liveFrame').t).toBeGreaterThan(0.023); expect(q(e, 'scope').lock).toBe(false);
    frames(e, 84); const sc = q(e, 'scope'); expect(sc.trace.complete).toBe(true); expect(sc.trace.tube.kind).toBe('windows'); expect(sc.trace.tube.windows).toHaveLength(3);
    expect(sc.trace.bad).toEqual([]); expect(sc.lock).toBe(true); expect(sc.trace.v[0]).toBeCloseTo(4.73, 1);
    expect(sc.trace.v[Math.round(48 / 0.390625)]).toBeLessThan(1); expect(sc.trace.v[255]).toBeGreaterThan(3.5); expect(sc.dt).toBeCloseTo(0.1 / 256, 7);
  });
  it('LIVE: with no filter at all the trace follows the bounce and leaves the amber gates', () => {
    const e = open('3-2', ['1-4', '2-3', '3-1']); ok(e, 'placePart', 'res-cf', 1e3, '0.25W', 4, 8, 0, false); for (const w of [[[2, 8], [4, 8]], [[8, 8], [14, 8]]]) ok(e, 'addWire', w);
    ok(e, 'attachProbe', 1, [14, 8]); ok(e, 'power', true); frames(e, 104); const sc = q(e, 'scope'); expect(sc.lock).toBe(false); expect(sc.trace.bad.length).toBeGreaterThan(5);
  });
  it('the coach points at the bin, the SW / OUT wiring, power, the clip and the bench; the shoebox offers E12 resistors, ceramic 10 nF - 1 uF, four electrolytics and two 1N4148', () => {
    const e = open('3-2', ['1-4', '2-3', '3-1']); let c = q(e, 'coach'); expect(c.active).toBe('place'); expect(c.text).toMatch(/Dex/);
    runRef(e, '3-2'); expect(q(e, 'coach').active).toBe('power'); ok(e, 'power', true); expect(q(e, 'coach').active).toBe('clip');
    const sb = q(e, 'ticketCard').shoebox; expect(sb.map((f: any) => f.partId)).toEqual(['res-cf', 'cap-cer', 'cap-el', '1n4148']);
    expect(sb[1].values).toHaveLength(13); expect(sb[1].values[0]).toBeCloseTo(10e-9, 12); expect(sb[2].values).toEqual([1e-6, 2.2e-6, 4.7e-6, 10e-6]); expect(sb[3].max).toBe(2);
    const bench0 = q(e, 'bench'); expect(bench0.parts.filter((p: any) => p.fixed).map((p: any) => p.partId)).toEqual(['pullup-10k', 'logic-in']);
    c = q(e, 'coach'); expect(c.text).toMatch(/Clip the scope on OUT/);
  });
});

// ---------------------------------------------------------------- 3-3
describe('3-3 Relay Pull-in', () => {
  const build = (rail: 'V12' | 'V24', r: number | null, w = '1W') => {
    const e = open('3-3', ['1-4', '2-3', '3-1']), y = rail === 'V12' ? 2 : 5;
    if (r !== null) { ok(e, 'placePart', 'res-cf', r, w, 6, y, 0, false); ok(e, 'addWire', [[2, y], [6, y]]); ok(e, 'addWire', [[10, y], [12, y], [12, 4]]); }
    else ok(e, 'addWire', [[2, y], [12, y], [12, 4]]);
    return e;
  };
  it('the ref (24 V + 200 ohm 1 W) pulls in at 0.275 ms with 60 mA steady and 2 stars; 24 V + 180 ohm gives 63.2 mA and 0.264 ms; 24 V + 270 ohm 51.1 mA and 0.326 ms', () => {
    const e = open('3-3', ['1-4', '2-3', '3-1']); runRef(e, '3-3'); const b = bench(e);
    expect(b.pass).toBe(true); expect(b.stars).toBe(2); expect(b.measured.tpull).toBeCloseTo(0.000275, 6); expect(b.measured.isteady).toBeCloseTo(0.06, 4); expect(b.metrics.power).toBeGreaterThan(1.40e6); expect(b.metrics.power).toBeLessThan(1.50e6);
    expect(spec(b, 'tpull').margin).toBeGreaterThan(0.00012); expect(b.pay).toBe(900 + 2 * 200);
    const b2 = bench(build('V24', 180)); expect(b2.pass).toBe(true); expect(b2.measured.tpull).toBeCloseTo(0.000264, 6); expect(b2.measured.isteady).toBeCloseTo(0.0632, 4);
    const b3 = bench(build('V24', 270)); expect(b3.pass).toBe(true); expect(b3.measured.tpull).toBeCloseTo(0.000326, 6); expect(b3.measured.isteady).toBeCloseTo(0.0511, 4);
  });
  it('12 V alone is too slow (0.549 ms), 24 V alone makes 2.9 W in the coil and it overheats, 24 V + 200 ohm 1/4 W smokes the resistor, 100 ohm gives 80 mA', () => {
    const slow = bench(build('V12', null)); expect(slow.pass).toBe(false); expect(slow.measured.tpull).toBeCloseTo(0.000549, 6);
    expect(texts(slow)).toMatch(/reached the 40 mA pull-in at 549 µs; the ticket wants it within 400 µs/); expect(texts(slow)).toMatch(/time constant L \/ R is 500 µs/); expect(texts(slow)).not.toMatch(/ln\(/);
    const again = bench(build('V12', null)); void again;
    const e = build('V12', null); bench(e); expect(texts(bench(e))).toMatch(/Imax = 12 \/ 200 Ω = 60 mA/);
    const hot = bench(build('V24', null)); expect(hot.pass).toBe(false); expect(hot.smoked).toHaveLength(1); expect(texts(hot)).toMatch(/relay's coil carried 11\d mA/); expect(texts(hot)).toMatch(/2\.8\d W/); expect(hot.failures[0].text).toMatch(/relay's coil carried/);   // the burnt coil is named first
    const smoke = bench(build('V24', 200, '0.25W')); expect(smoke.pass).toBe(false); expect(texts(smoke)).toMatch(/200 Ω ¼ W resistor dissipated 0\.7\d+ W/);
    const big = bench(build('V24', 100)); expect(big.pass).toBe(false); expect(texts(big)).toMatch(/steady coil current is 80 mA/); expect(texts(big)).toMatch(/414 Ω/);
    expect(bench(build('V24', 220, '0.5W')).pass).toBe(false);
  });
  it('LIVE: the scope shows the coil current from switch-on with no clip; the tube is two gates; the relay pulls in at about 0.27 ms; the ref locks, 12 V alone does not', () => {
    const e = open('3-3', ['1-4', '2-3', '3-1']); runRef(e, '3-3'); ok(e, 'power', true);
    let sc = q(e, 'scope'); expect(sc.target).toMatchObject({ mode: 'trace', unit: 'mA', clipped: true, label: 'COIL', timePerDiv: 0.0002 }); expect(sc.trace.tube.windows).toHaveLength(2);
    let relay = q(e, 'liveFrame').parts.find((p: any) => p.relay).relay; expect(relay.operated).toBe(false);
    frames(e, 13); expect(q(e, 'liveFrame').parts.find((p: any) => p.relay).relay.operated).toBe(false);   // 13 frames of 20 us = 0.26 ms: the armature is still out (it pulls in at 0.275 ms)
    frames(e, 2); relay = q(e, 'liveFrame').parts.find((p: any) => p.relay).relay; expect(relay.operated).toBe(true); expect(relay.mA).toBeGreaterThan(40);
    frames(e, 90); sc = q(e, 'scope'); expect(sc.trace.complete).toBe(true); expect(sc.trace.bad).toEqual([]); expect(sc.lock).toBe(true); expect(sc.trace.v[0]).toBe(0); expect(sc.trace.v[255]).toBeGreaterThan(58); expect(sc.trace.v[255]).toBeLessThan(60.5);
    expect(q(e, 'liveFrame').status).toBe('ok');
    const slow = build('V12', null); ok(slow, 'power', true); frames(slow, 104); sc = q(slow, 'scope'); expect(sc.lock).toBe(false); expect(sc.trace.bad.length).toBeGreaterThan(5);
    // the time knob restarts the sweep and re-scales it
    ok(slow, 'setScope', { timePerDiv: 0.0005 }); sc = q(slow, 'scope'); expect(sc.trace.v).toHaveLength(0); frames(slow, 104); expect(q(slow, 'scope').dt).toBeCloseTo(0.005 / 256, 8);
  });
  it('LIVE: 24 V straight on the coil overheats it in the live view (the engine\'s smoke event, not a bench result)', () => {
    const e = build('V24', null); ok(e, 'power', true); let n = 0; while (n < 400 && q(e, 'liveFrame').events.length === 0) { ok(e, 'advance', 8); n += 8; }
    expect(n).toBeLessThan(400); expect(q(e, 'liveFrame').events[0].text).toMatch(/relay's coil carried 11\d mA/); expect(q(e, 'coach').active).toBe('burned');
  });
  it('the coach: wire a rail to COIL, power, watch, bench; the shoebox has 15 values in three powers; the rails are fixed supplies', () => {
    const e = open('3-3', ['1-4', '2-3', '3-1']); let c = q(e, 'coach'); expect(c.active).toBe('rail'); expect(c.anchor).toMatchObject({ target: 'part', partId: 'relay-12v', pin: 'C1' }); expect(c.text).toMatch(/Sami/);
    runRef(e, '3-3'); expect(q(e, 'coach').active).toBe('power'); ok(e, 'power', true); c = q(e, 'coach'); expect(c.active).toBe('watch'); expect(c.text).toMatch(/relay clicks/);
    const card = q(e, 'ticketCard'); expect(card.shoebox[0].values).toHaveLength(15); expect(card.shoebox[0].variants.map((v: any) => v.id)).toEqual(['0.25W', '0.5W', '1W']);
    expect(card.supplies.map((s: any) => [s.id, s.fixed])).toEqual([['psu12', 12], ['psu24', 24]]);
    expect(q(e, 'bench').parts.find((p: any) => p.partId === 'relay-12v')).toMatchObject({ fixed: true, kind: 'RELAY', pins: [{ pad: [16, 4] }, { pad: [16, 8] }, { pad: [20, 4] }, { pad: [20, 6] }, { pad: [20, 8] }] });
  });
});

// ---------------------------------------------------------------- 3-4
describe('3-4 EB: Capacitor Bank', () => {
  const place = (e: Engine<NodeState>, parts: [number, number, number][] = [[2e-6, 4, 2], [3e-6, 8, 4], [6e-6, 10, 4], [6e-6, 20, 4]]) => {
    for (const [c, x, y] of parts) ok(e, 'placePart', 'cap-ideal', c, 'ideal', x, y, c === 2e-6 ? 0 : 1, false);
  };
  const wires: number[][][] = [[[2, 2], [4, 2]], [[8, 2], [8, 4]], [[8, 2], [10, 2], [10, 4]], [[8, 8], [8, 12], [10, 12]], [[10, 8], [10, 12]], [[20, 2], [20, 4]], [[20, 8], [20, 12], [10, 12]]];
  const predict = (e: Engine<NodeState>, v: Record<string, number> = { pq: 180, pu: 9.9, pv: 40, pl: 12 }) => { for (const [k, x] of Object.entries(v)) ok(e, 'predict', k, x); };
  it('exact predictions and the right build: 3 stars; the bench measures V(M) = 20.0 V, the shared 40.0 V and 12.1 mJ of heat in the switch; the debrief works both cards', () => {
    const e = open('3-4', ['1-4', '2-3', '3-1', '3-2']); runRef(e, '3-4'); const b = bench(e);
    expect(b.pass).toBe(true); expect(b.stars).toBe(3); expect(b.pay).toBe(900 + 3 * 150); expect(b.measured.vm).toBeCloseTo(20, 1); expect(b.measured.vd).toBeCloseTo(40, 1); expect(b.measured.heat * 1e3).toBeGreaterThan(11.9); expect(b.measured.heat * 1e3).toBeLessThan(12.15);
    expect(b.predictions.map((p: any) => [p.id, p.truth, p.grade])).toEqual([['pq', 180, 'exact'], ['pu', 9.9, 'exact'], ['pv', 40, 'exact'], ['pl', 12, 'exact']]);
    const d = b.debrief; expect(d.node).toBe('bank'); expect(d.working).toHaveLength(7); expect(d.working.join(' ')).toMatch(/bank is 1\.636 µF/); expect(d.working.join(' ')).toMatch(/Q = C V = 1\.636 µF x 110 V = 180 µC/); expect(d.working.join(' ')).toMatch(/whatever its resistance/);
    expect(d.answer).toBe('Q = 180 µC, U = 9.9 mJ, V = 40 V, loss = 12 mJ'); expect(d.retry).toBe(false);
  });
  it('a prediction within 5 % earns 2 stars and offers the retry; a wrong one (card (b) loss as the energy lost = 20 mJ) only 1 star with the working', () => {
    const e = open('3-4', ['1-4', '2-3', '3-1', '3-2']); place(e); for (const w of wires) ok(e, 'addWire', w); predict(e, { pq: 185, pu: 9.9, pv: 40, pl: 12 });
    let b = bench(e); expect(b.pass).toBe(true); expect(b.stars).toBe(2); expect(b.retry).toBe(true); expect(b.debrief.retry).toBe(true);
    ok(e, 'retryExam'); expect(q(e, 'ticketCard').predictions.every((p: any) => p.entered === null)).toBe(true); predict(e, { pq: 180, pu: 9.9, pv: 40, pl: 20 }); b = bench(e);
    expect(b.stars).toBe(1); expect(b.debrief.starsText).toMatch(/charge is conserved, not the energy/); expect(b.debrief.rows.find((r: any) => r.id === 'pl').ok).toBe(false);
  });
  it('the bench refuses without predictions; the printed numbers stay hidden (specs, targets) until every prediction is locked; no unit is a leak', () => {
    const e = open('3-4', ['1-4', '2-3', '3-1', '3-2']); place(e); for (const w of wires) ok(e, 'addWire', w);
    let card = q(e, 'ticketCard'); expect(card.examHidden).toBe(true); expect(card.specs.map((s: any) => s.id)).toEqual(['pq', 'pu', 'pv', 'pl'].filter((id) => card.specs.some((s: any) => s.id === id)));
    expect(JSON.stringify(card.specs)).not.toMatch(/20\.0 V|40\.0 V|12\.0 mJ/); expect(card.predictions.map((p: any) => p.unit)).toEqual(['µC', 'mJ', 'V', 'mJ']);
    const r = bench(e); expect(r.pass).toBe(false); expect(r.failures[0].text).not.toMatch(/\b(20|40|180)\b/);
    predict(e); card = q(e, 'ticketCard'); expect(card.examHidden).toBe(false); expect(card.specs.map((s: any) => s.id)).toContain('vm');
  });
  it('a wrong build fails with its plain-words cause: without the 6 uF in parallel M reads 44 V (3 uF alone) and the explainer says the pair sits M to GND; no 6 uF on D leaves the switch with nothing to share with', () => {
    const e = open('3-4', ['1-4', '2-3', '3-1', '3-2']); place(e, [[2e-6, 4, 2], [3e-6, 8, 4], [6e-6, 20, 4]]); for (const w of wires.filter((x) => x[0][0] !== 10 && !(x.length === 3 && x[1][0] === 10 && x[1][1] === 2))) ok(e, 'addWire', w); predict(e);
    const b = bench(e); expect(b.pass).toBe(false); expect(texts(b)).toMatch(/The point M reads 4\d(\.\d)? V; it should be 19\.8 to 20\.2 V/); expect(texts(b)).toMatch(/110 V x 9 \/ 11 = 90 V/);
    const e2 = open('3-4', ['1-4', '2-3', '3-1', '3-2']); place(e2, [[2e-6, 4, 2], [3e-6, 8, 4], [6e-6, 10, 4]]); for (const w of wires.slice(0, 5)) ok(e2, 'addWire', w); ok(e2, 'addWire', [[20, 2], [20, 12], [10, 12]]); predict(e2);
    const b2 = bench(e2); expect(b2.pass).toBe(false);
  });
  it('the energy lost in the switch is 12 mJ whatever its resistance: the same ledger for 1 ohm, 10 ohm and 1 kohm (the bench is pure: the switch is changed in a copy of the ticket)', () => {
    const d = def('3-4'), board = { ...refBoard(d), probes: [], meter: { mode: 'off', pads: [] as [number, number][] } };
    const heats: number[] = [];
    for (const ron of [1, 10, 1000]) {
      const out = runTicketBench({ board, getDef, supplies: d.supplies.map((s) => (s.kind === 'contact' ? { ...s, ron } : s)), plan: { ...d.bench, h: ron === 1 ? 2e-7 : ron === 1000 ? 2e-5 : 2e-6, window: ron === 1000 ? 0.04 : 0.008 }, hidden: [], supply: { v: 0, ilim: 0.1 }, gen: { shape: 'sine', f: 1000, vpp: 1, offset: 0 }, smoked: [], predictions: { pq: 180, pu: 9.9, pv: 40, pl: 12 } });
      heats.push(out.values.heat! * 1e3);
    }
    for (const h of heats) { expect(h).toBeGreaterThan(11.8); expect(h).toBeLessThan(12.2); }
  });
  it('the coach: predict, build, wire (M and D), ground, bench; the shoebox holds exact capacitors 2, 3, 4, 6 uF (max 4 parts); the sources panel lists the fixed 110 V', () => {
    const e = open('3-4', ['1-4', '2-3', '3-1', '3-2']); expect(q(e, 'coach').active).toBe('predict'); predict(e); expect(q(e, 'coach').active).toBe('build');
    const card = q(e, 'ticketCard'); expect(card.shoebox).toHaveLength(1); expect(card.shoebox[0].values).toEqual([2e-6, 3e-6, 4e-6, 6e-6]); expect(card.shoebox[0].max).toBe(4);
    expect(card.sources).toEqual([{ uid: 'f1', partId: 'ideal-vsource', name: 'Ideal voltage source', volts: 110, hidden: false }]); expect(card.figure.kind).toBe('caps');
    const fixed = q(e, 'bench').parts.filter((p: any) => p.fixed); expect(fixed.map((p: any) => p.partId)).toEqual(['ideal-vsource', 'cap-charged']);
  });
});
