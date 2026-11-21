// Chapter 4 "Mains & Rectifiers" (tickets 4-1 .. 4-5): every naive build fails for the stated reason, every ref passes, bands have margins, the safety gate and the keep-out hold, the live switches and the scope's two channels
// come from the real engine, and the UI queries answer. DESIGN §2.8, docs/API-CH4.md.
import { describe, expect, it } from 'vitest';
import { Engine } from '@core/kit';
import { GAME } from '../game';
import { LEVEL_DEFS } from '../data/levels';
import { refActions } from './replay';
import { newTicketProgress, type NodeState } from './state';

const def = (id: string) => LEVEL_DEFS.find((d) => d.id === id)!;
function open(id: string, passed: string[] = ['3-3', '4-1', '4-2', '4-3'], mode = 'learner', safety = true): Engine<NodeState> {
  const e = new Engine(GAME, { mode }); e.autosave = false;
  const st = structuredClone(e.state) as NodeState;
  for (const d of passed.filter((x) => x !== id)) st.progress.tickets[d] = { ...newTicketProgress(), passed: true, stars: 1 };
  e.setState(st);
  expect(e.act('openTicket', [id]).ok, `open ${id}`).toBe(true);
  if (safety && def(id).mains) expect(e.act('readSafety', []).ok).toBe(true);
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
/** The 4-1 board with the ref wiring but other parts: `mod` edits the part list placed (uids p1..p5). */
function build41(over: { cap?: [number, string]; diode?: string; skip?: number[] } = {}) {
  const e = open('4-1'), d = def('4-1');
  d.ref.parts.forEach((p, i) => {
    if (over.skip?.includes(i)) return;
    const isCap = p.partId === 'cap-el', part = isCap && over.cap ? { ...p, value: over.cap[0], variant: over.cap[1] } : !isCap && over.diode ? { ...p, partId: over.diode, variant: over.diode === '1n4148' ? 'DO35' : p.variant } : p;
    ok(e, 'placePart', part.partId, part.value, part.variant, part.x, part.y, part.rot, part.flip);
  });
  for (const w of d.ref.wires) { const r = e.act('addWire', [w]); if (!r.ok && !over.skip) expect(r.ok, r.message).toBe(true); }
  return e;
}

// ---------------------------------------------------------------- the chapter map and the unlock chain
describe('chapter 4 unlocks after chapter 3 and runs 4-1, then 4-2, then 4-3 / 4-4, then the exam', () => {
  it('the map has five chits, 11 stars, and the lock chain', () => {
    const e = new Engine(GAME, { mode: 'learner' }); e.autosave = false;
    expect(bad(e, 'openTicket', '4-1')).toMatch(/3-3 or 3-4/);
    const set = (ids: string[]) => { const s = structuredClone(e.state) as NodeState; s.progress.tickets = {}; for (const d of ids) s.progress.tickets[d] = { ...newTicketProgress(), passed: true, stars: 1 }; e.setState(s); };
    const m0 = q(e, 'chapterMap', 4); expect(m0.title).toBe('Mains & Rectifiers'); expect(m0.starsTotal).toBe(11); expect(m0.tickets.map((t: any) => t.title)).toEqual(['Wall Wart', 'Zener Shunt', 'Hot Regulator', 'Bench Supply', 'Exam: Zener Regulator']);
    set(['3-4']); expect(q(e, 'chapterMap', 4).tickets.map((t: any) => t.state)).toEqual(['open', 'locked', 'locked', 'locked', 'locked']);
    set(['3-3', '4-1']); expect(q(e, 'chapterMap', 4).tickets.map((t: any) => t.state)).toEqual(['passed', 'open', 'locked', 'locked', 'locked']);
    set(['3-3', '4-1', '4-2']); expect(q(e, 'chapterMap', 4).tickets.map((t: any) => t.state)).toEqual(['passed', 'passed', 'open', 'open', 'locked']);
    set(['3-3', '4-1', '4-2', '4-4']); expect(q(e, 'chapterMap', 4).tickets[4].state).toBe('open');
    expect(q(e, 'chapterMap', 4).tickets.every((t: any) => t.spec !== '' && t.chit.x > 0)).toBe(true); expect(q(e, 'chapterMap', 4).tickets[4].eb).toBe(true);
  });
});

// ---------------------------------------------------------------- mains safety (DESIGN §1.2, user decision 4)
describe('mains safety: the card, the gate, the isolation transformer, the keep-out', () => {
  it('the safety card is on the ticket card in Wren\'s words; the bench stays off until it is read; reading it unlocks the Codex flag', () => {
    const e = open('4-1', ['3-3'], 'learner', false); const c = q(e, 'ticketCard');
    expect(c.mains).toMatchObject({ safetyRead: false, firstView: true, vrms: 230, hz: 50 }); expect(c.mains.ribbon).toMatch(/do not try this at home/); expect(c.mains.lines[0]).toMatch(/training, an isolation transformer and a second person/); expect(c.mains.lines[1]).toMatch(/Here the bench is simulated/);
    expect(c.mains.keepOut).toBe('HIGH VOLTAGE'); expect(c.mains.isolation).toMatch(/isolation transformer/);
    expect(bad(e, 'power', true)).toMatch(/Read the safety card first/); expect(bad(e, 'runBench')).toMatch(/Read the safety card first/);
    ok(e, 'readSafety'); const c2 = q(e, 'ticketCard'); expect(c2.mains.safetyRead).toBe(true); expect(e.state.progress.codexSeen).toContain('mains-safety'); ok(e, 'power', true);
    const e2 = open('4-1', ['3-3'], 'learner', false); ok(e2, 'closeTicket'); expect((e2.state.progress.codexSeen ?? []).includes('mains-safety')).toBe(false);
  });
  it('a ticket that is not a mains ticket has no card; later cards open with firstView false', () => {
    const e = open('4-2'); expect(q(e, 'ticketCard').mains).toBe(null); expect(bad(e, 'readSafety')).toMatch(/not a mains ticket/);
    const e1 = open('4-1', ['3-3']); const s = structuredClone(e1.state) as NodeState; s.progress.codexSeen = ['mains-safety']; e1.setState(s); expect(q(e1, 'ticketCard').mains.firstView).toBe(false);
  });
  it('the primary is soldered inside the keep-out; no part and no wire of the player may enter it', () => {
    const e = open('4-1'); const b = q(e, 'bench');
    expect(b.keepOut).toEqual([{ x: 0, y: 0, w: 10, h: 8 }]); expect(b.connectors.filter((c: any) => c.role === 'mains').map((c: any) => c.id)).toEqual(['L', 'N']);
    expect(b.parts.find((p: any) => p.partId === 'xfmr-12')).toMatchObject({ fixed: true, x: 8, y: 2 });
    expect(bad(e, 'placePart', '1n4007', null, 'DO41', 4, 4, 0, false)).toMatch(/red hatched keep-out/);
    expect(bad(e, 'placePart', '1n4007', null, 'DO41', 6, 6, 0, false)).toMatch(/keep-out/);
    expect(bad(e, 'wire', [12, 2], [2, 6])).toMatch(/keep-out|route/); expect(bad(e, 'addWire', [[12, 2], [12, 0], [4, 0], [4, 1]])).toMatch(/keep-out/);
    expect(bad(e, 'unwire', 'fw1')).toMatch(/fixed|soldered|cannot/i);
    ok(e, 'placePart', '1n4007', null, 'DO41', 14, 2, 0, false);   // outside it is fine
  });
  it('the mains source is isolated: only a 100 Mohm insulation resistance ties the floating primary to ground, and the live circuit shows 12 V rms on the secondary', () => {
    const e = build41(); const nl = q(e, 'netlist'); expect(nl.elements.some((x: any) => x.id === 'mains.iso' && x.p.r === 1e8)).toBe(true);
    ok(e, 'attachProbe', 1, [22, 2]); ok(e, 'power', true); frames(e, 104); const sc = q(e, 'scope');
    expect(sc.trace.v2.length).toBe(256); const pk = Math.max(...sc.trace.v2.map(Math.abs)); expect(pk).toBeGreaterThan(16.2); expect(pk).toBeLessThan(17.1);   // 12 V rms x 1.414 = 17 V less the winding drop
  });
});

// ---------------------------------------------------------------- 4-1
describe('4-1 Wall Wart', () => {
  it('the ref (4 x 1N4007 + 1000 uF 25 V) passes with 2 stars at par cost 26 c; the fee and the star bonus are paid', () => {
    const e = open('4-1', ['3-3']); runRef(e, '4-1'); const b = bench(e);
    expect(b.pass).toBe(true); expect(b.stars).toBe(2); expect(b.metrics).toMatchObject({ cost: 26, parts: 5 }); expect(b.pay).toBe(1000 + 2 * 250); expect(spec(b, 'ripple').margin).toBeGreaterThan(0.2); expect(spec(b, 'mean').margin).toBeGreaterThan(0.5);
    expect(q(e, 'ticketCard').conditions).toHaveLength(6); expect(b.measured.ripple).toBeLessThan(1); expect(b.measured.mean).toBeGreaterThan(12);
  });
  it('680 uF gives 1.1 V of ripple and fails; the first miss gives the cause, the repeat the working with the charge and the capacitance you need', () => {
    const e = build41({ cap: [680e-6, '25V'] }); const b1 = bench(e);
    expect(b1.pass).toBe(false); expect(spec(b1, 'ripple').pass).toBe(false); expect(spec(b1, 'mean').pass).toBe(true); expect(texts(b1)).toMatch(/ripples 1\.1 V peak to peak/); expect(texts(b1)).toMatch(/680 µF capacitor alone feeds the 100 mA load/);
    const b2 = bench(e); expect(texts(b2)).toMatch(/charge = I x t = 100 mA x 10 ms = 1000 µC/); expect(texts(b2)).toMatch(/dV = 1\.5 V|dV = 1\.4 V/); expect(texts(b2)).toMatch(/C of about 1\.0[0-9]* mF or more|1 mF/);
  });
  it('half-wave: one diode and 1000 uF ripples twice as much (the 20 ms gap) and says so; one diode and 2200 uF 25 V passes (25 c)', () => {
    const half = (c: number) => { const e = open('4-1', ['3-3']); ok(e, 'placePart', '1n4007', null, 'DO41', 14, 2, 0, false); ok(e, 'placePart', 'cap-el', c, '25V', 20, 6, 1, false); for (const w of [[[12, 2], [14, 2]], [[18, 2], [20, 2]], [[20, 2], [22, 2]], [[20, 6], [20, 2]], [[20, 8], [22, 14]], [[12, 6], [22, 14]]]) ok(e, 'wire', w[0], w[1]); return e; };
    const b = bench(half(1000e-6)); expect(b.pass).toBe(false); expect(texts(b)).toMatch(/single diode refills it only once per cycle, every 20 ms/);
    const g = bench(half(2200e-6)); expect(g.pass).toBe(true); expect(g.metrics.cost).toBe(25);
  });
  it('a 16 V capacitor is over its rating at 253 V (17.5 V peak at no load) and the bench says "over its rating", not "vented"; a 10 V part really vents; 25 V and 35 V pass', () => {
    const b16 = bench(build41({ cap: [1000e-6, '16V'] })); expect(b16.pass).toBe(false); expect(b16.smoked).toEqual([]); expect(texts(b16)).toMatch(/over its rating/); expect(texts(b16)).toMatch(/vent above 19\.2 V/); expect(texts(b16)).not.toMatch(/vent above their rating/); expect(texts(b16)).toMatch(/Pick a 25 V part|Pick a 35 V part/);
    const b10 = bench(build41({ cap: [1000e-6, '10V'] })); expect(b10.pass).toBe(false); expect(b10.smoked).toHaveLength(1); expect(texts(b10)).toMatch(/Pick a/);
    expect(bench(build41({ cap: [1000e-6, '35V'] })).pass).toBe(true);
  });
  it('1N4148 diodes in the bridge exceed their repetitive peak current (the charging pulses), not their average; 1 x 1N4148 half-wave does not make the bridge', () => {
    const b = bench(build41({ diode: '1n4148' })); expect(b.pass).toBe(false); expect(texts(b)).toMatch(/pulses of 0\.5\d* A/); expect(texts(b)).toMatch(/repetitive peak rating is 0\.5 A, even though its average is only/); expect(texts(b)).toMatch(/1N4007/);
  });
  it('a diode the wrong way round shorts two diodes across the winding: no output, the diodes carry amps, and the transformer winding overheats (explained)', () => {
    const e = open('4-1', ['3-3']), d = def('4-1');
    d.ref.parts.forEach((p, i) => ok(e, 'placePart', p.partId, p.value, p.variant, i === 0 ? 18 : p.x, p.y, i === 0 ? 2 : p.rot, p.flip));
    for (const w of d.ref.wires) ok(e, 'addWire', w);
    const b = bench(e); expect(b.pass).toBe(false); expect(texts(b)).toMatch(/average but is rated 1 A/); expect(texts(b)).toMatch(/wrong way round|band/); expect(b.smoked.length).toBeGreaterThan(0);
    expect(texts(b)).toMatch(/transformer winding made [\d.]+ W and overheated/);
  });
  it('no capacitor at all: the mean is under 12 V and the ripple is huge (a diode bridge alone gives raw humps)', () => {
    const e = build41({ skip: [4] }); const b = bench(e); expect(b.pass).toBe(false); expect(spec(b, 'ripple').pass).toBe(false);
  });
  it('LIVE scope: two channels (OUT green, the secondary amber), the sweep forms in 100 frames, LOCK needs the capacitor charged and the specs on the settled part; AC coupling data (dc) comes from the engine', () => {
    const e = build41(); ok(e, 'power', true); let sc = q(e, 'scope');
    expect(sc.target).toMatchObject({ mode: 'trace', label: 'OUT', clipped: false, second: { label: 'SEC' }, vdivs: [5, 2, 1, 0.5, 0.2], ac: true, timePerDiv: 0.02 }); expect(sc.lock).toBe(false);
    ok(e, 'attachProbe', 1, [22, 2]); frames(e, 48); sc = q(e, 'scope'); expect(sc.trace.complete).toBe(false); expect(sc.trace.v2.length).toBeGreaterThan(100);
    frames(e, 60); sc = q(e, 'scope'); expect(sc.trace.complete).toBe(true); expect(sc.lock).toBe(true); expect(sc.sweepText).toMatch(/Locked/); expect(sc.trace.dc).toBeGreaterThan(13.5); expect(sc.trace.dc).toBeLessThan(14.6);
    const last = sc.trace.v.slice(200); expect(Math.max(...last) - Math.min(...last)).toBeLessThan(1);
    expect(sc.trace.v[0]).toBeLessThan(1); expect(Math.max(...sc.trace.v2)).toBeGreaterThan(16);
  });
  it('LIVE switches: MAINS 207 / 230 / 253 V and LOAD 100 mA / none restart the sweep and change what the scope shows; the no-load peak is the capacitor rating problem (17.5 V at 253 V)', () => {
    const e = build41({ cap: [1000e-6, '16V'] }); ok(e, 'attachProbe', 1, [22, 2]); const sel = q(e, 'bench').selectors; expect(sel.map((s: any) => s.id)).toEqual(['mains', 'load']); expect(sel[0]).toMatchObject({ label: 'MAINS', options: ['207 V', '230 V', '253 V'], index: 1 }); expect(sel[1]).toMatchObject({ options: ['100 mA', 'none'], index: 0 });
    ok(e, 'power', true); frames(e, 104); const nom = q(e, 'scope').trace.dc; ok(e, 'setSelector', 'mains', 2); expect(q(e, 'scope').trace.v).toHaveLength(0); ok(e, 'setSelector', 'load', 1); frames(e, 104);
    const hi = q(e, 'scope').trace; expect(Math.max(...hi.v)).toBeGreaterThan(17.2); expect(hi.dc).toBeGreaterThan(nom + 2);
    const cp = q(e, 'liveFrame').parts.find((p: any) => p.cap); expect(cp.cap.vrated).toBe(16); expect(cp.ratio).toBeGreaterThan(1);
    expect(bad(e, 'setSelector', 'nope', 0)).toMatch(/no switch/); expect(bad(e, 'setSelector', 'mains', 7)).toMatch(/positions 0 to 2/);
  });
  it('LIVE: a 10 V capacitor vents on the live bench at high mains (over 1.2 x for 50 ms); the engine explains', () => {
    const e = build41({ cap: [1000e-6, '10V'] }); ok(e, 'attachProbe', 1, [22, 2]); ok(e, 'power', true); let n = 0; while (n < 120 && q(e, 'liveFrame').events.length === 0) { ok(e, 'advance', 1); n++; }
    const ev = q(e, 'liveFrame').events[0]; expect(ev).toMatchObject({ kind: 'vent' }); expect(ev.text).toMatch(/Pick a/);
  });
  it('the coach, the shoebox (4 x 1N4007, 1N4148, the verified electrolytics 220 uF - 2200 uF in four ratings, one bleeder), the hint ladder and the thermal camera flag', () => {
    const e = open('4-1', ['3-3']); let c = q(e, 'coach'); expect(c.active).toBe('place'); expect(c.text).toMatch(/Mrs\. Dale/); expect(c.text).toMatch(/keep-out/); runRef(e, '4-1'); expect(q(e, 'coach').active).toBe('power'); ok(e, 'power', true); expect(q(e, 'coach').active).toBe('clip');
    const card = q(e, 'ticketCard'), cap = card.shoebox.find((f: any) => f.partId === 'cap-el'); expect(cap.values).toEqual([220e-6, 470e-6, 680e-6, 1000e-6, 1500e-6, 2200e-6]); expect(cap.variants.map((v: any) => v.id)).toEqual(['10V', '16V', '25V', '35V']);
    expect(card.shoebox.find((f: any) => f.partId === '1n4007').max).toBe(4); expect(card.camera).toBe(true); expect(card.selectors).toHaveLength(2);
    ok(e, 'hint'); const h = ok(e, 'hint'); expect(h.message).toMatch(/12 V x 1\.414 = 17 V|1\.414/);
  });
});

// ---------------------------------------------------------------- 4-2
describe('4-2 Zener Shunt', () => {
  const build = (r: number, w: string, z = '1n4733a') => { const e = open('4-2'); ok(e, 'placePart', 'res-cf', r, w, 4, 2, 0, false); ok(e, 'placePart', z, null, z === 'bzx55c5v1' ? 'DO35' : 'DO41', 12, 8, 3, false); for (const wr of def('4-2').ref.wires) ok(e, 'addWire', wr); return e; };
  it('the ref (180 ohm 1 W + 1N4733A) holds OUT inside 4.845 - 5.355 V in all four tests and passes with 2 stars at 11 c', () => {
    const e = open('4-2'); runRef(e, '4-2'); const b = bench(e); expect(b.pass).toBe(true); expect(b.stars).toBe(2); expect(b.metrics.cost).toBe(11); expect(spec(b, 'vout').margin).toBeGreaterThan(0.03); expect(b.measured.vout).toBeGreaterThan(5.1);
  });
  it('220 ohm (the paper maximum) drops out at 13 V and 30 mA: the real Zener sags; the repeat gives the worked limit; 470 ohm collapses', () => {
    const e = build(220, '1W'); const b1 = bench(e); expect(b1.pass).toBe(false); expect(texts(b1)).toMatch(/13 V, 30 mA test OUT fell to 4\.78 V/); expect(texts(b1)).toMatch(/Zener 5\.9 mA of the 36\.\d mA|leaving the Zener 5\.9 mA/);
    const b2 = bench(e); expect(texts(b2)).toMatch(/R <= \(13 - 5\.1\) \/ \(30 mA \+ 5 mA\) = 226 ohm/); expect(texts(b2)).toMatch(/180 ohm/);
    expect(bench(build(470, '1W')).pass).toBe(false);
  });
  it('100 ohm: OUT is high at 17 V and the resistor makes 1.3 W in a 1 W part; a 1/4 W resistor smokes (0.8 W); the BZX55 climbs to 6.6 V at 17 V with no load (its 25 ohm slope)', () => {
    const b = bench(build(100, '1W')); expect(b.pass).toBe(false); expect(texts(b)).toMatch(/dissipated 1\.3\d* W but is rated 1 W/);
    const q4 = bench(build(180, '0.25W')); expect(q4.pass).toBe(false); expect(q4.smoked).toHaveLength(1);
    const z = bench(build(180, '1W', 'bzx55c5v1')); expect(z.pass).toBe(false); expect(texts(z)).toMatch(/17 V, no load test OUT rose to 6\.[56]\d* V/); expect(texts(z)).toMatch(/slope is 25 ohm/);
  });
  it('LIVE: the INPUT and LOAD switches move the bench to the worst cases; the gauge locks for the ref in all four', () => {
    const e = open('4-2'); runRef(e, '4-2'); ok(e, 'attachProbe', 1, [22, 2]); ok(e, 'power', true); frames(e, 8); expect(q(e, 'scope').lock).toBe(true);
    for (const [a, b2] of [[0, 1], [1, 0], [1, 1]]) { ok(e, 'setSelector', 'input', a); ok(e, 'setSelector', 'load', b2); frames(e, 8); expect(q(e, 'scope').lock, `${a}${b2}`).toBe(true); }
    const e2 = build(220, '1W'); ok(e2, 'attachProbe', 1, [22, 2]); ok(e2, 'power', true); frames(e2, 8); expect(q(e2, 'scope').lock).toBe(false); expect(q(e2, 'scope').gauge.value).toBeLessThan(4.845);
  });
});

// ---------------------------------------------------------------- 4-3
describe('4-3 Hot Regulator', () => {
  const build = (sink: string, r: number | null) => {
    const e = open('4-3'), d = def('4-3');
    if (r !== null) { ok(e, 'placePart', 'res-ww5', r, '5W', 4, 2, 0, false); } ok(e, 'placePart', 'lm7805', null, sink, 10, 6, 0, false);
    if (r !== null) { ok(e, 'addWire', [[2, 2], [4, 2]]); ok(e, 'addWire', [[8, 2], [10, 2], [10, 6]]); } else ok(e, 'wire', [2, 2], [10, 6]);
    for (const w of d.ref.wires.slice(2)) ok(e, 'addWire', w);
    return e;
  };
  it('the ref (10 ohm 5 W + the 15 C/W sink): 5 V on the resistor, 10 V into the chip, Tj = 88.8 C; it passes with 2 stars at 69 c; 8 C/W alone is not needed but the 25 C/W sink + 10 ohm is the cheapest pass', () => {
    const e = open('4-3'); runRef(e, '4-3'); const b = bench(e); expect(b.pass).toBe(true); expect(b.stars).toBe(2); expect(b.metrics.cost).toBe(69); expect(b.measured.vmin).toBeGreaterThan(4.95);
    const cheap = bench(build('TO220-25', 10)); expect(cheap.pass).toBe(true); expect(cheap.metrics.cost).toBe(63);
  });
  it('a bare chip at 0.5 A (5 W) shuts itself off over and over: OUT blinks, the bench says so with the junction arithmetic; the 15 C/W sink alone makes 137.5 C and fails the 125 C limit; 8 C/W alone passes (102.5 C)', () => {
    const bare = bench(build('TO220', null)); expect(bare.pass).toBe(false); expect(texts(bare)).toMatch(/shut itself off, cooled to 135 degrees and switched on again/); expect(texts(bare)).toMatch(/5 W/); expect(texts(bare)).toMatch(/40 \+ 5 x 54 = 310 degrees/);
    const s15 = bench(build('TO220-15', null)); expect(s15.pass).toBe(false); expect(texts(s15)).toMatch(/Ta \+ P x theta = 40 \+ 5 x 19\.5 = 138|137\.5|138 degrees/); expect(texts(s15)).toMatch(/theta of at most \(125 - 40\) \/ 5 = 17 degrees per watt/);
    const s8 = bench(build('TO220-8', null)); expect(s8.pass).toBe(true);
  });
  it('a 22 ohm pre-drop starves the chip at 0.5 A (4 V in: dropout) and its resistor overheats; a 2.2 ohm one with the 15 C/W sink is still too hot (128 C)', () => {
    const b = bench(build('TO220-15', 22)); expect(b.pass).toBe(false); expect(texts(b)).toMatch(/needs its input to be at least 2 V above its output/); expect(texts(b)).toMatch(/only sees 4 V/);
    const b2 = bench(build('TO220-15', 2.2)); expect(b2.pass).toBe(false); expect(texts(b2)).toMatch(/degrees, over the 125 degree limit/);
  });
  it('LIVE: the bare chip makes OUT cycle on the scope (the engine\'s own shutdown latch), the camera reads its junction, and the ref locks; the regulator never smokes', () => {
    const e = build('TO220', null); ok(e, 'attachProbe', 1, [22, 2]); ok(e, 'power', true); let off = 0, hot = 0, maxT = 0;
    for (let i = 0; i < 160; i++) { ok(e, 'advance', 1); const f = q(e, 'liveFrame'), r = f.parts.find((p: any) => p.reg); if (r?.reg.off) off++; maxT = Math.max(maxT, r?.temp ?? 0); if (f.events.length) hot++; }
    expect(off).toBeGreaterThan(5); expect(maxT).toBeGreaterThan(130); expect(maxT).toBeLessThan(152); expect(hot).toBe(0); const sc = q(e, 'scope'); expect(sc.lock).toBe(false); expect(Math.min(...sc.trace.v)).toBeLessThan(1);
    const g = open('4-3'); runRef(g, '4-3'); ok(g, 'attachProbe', 1, [22, 2]); ok(g, 'power', true); frames(g, 104); expect(q(g, 'scope').lock).toBe(true); expect(q(g, 'liveFrame').parts.find((p: any) => p.reg).reg.off).toBe(false);
  });
  it('the shoebox: the chip in four versions (bare and three heatsinks, priced 15 / 23 / 29 / 75 c) and E3 power resistors; the thermal camera flag', () => {
    const e = open('4-3'); const sb = q(e, 'ticketCard').shoebox; const reg = sb.find((f: any) => f.partId === 'lm7805'); expect(reg.variants.map((v: any) => [v.id, v.price])).toEqual([['TO220', 15], ['TO220-25', 23], ['TO220-15', 29], ['TO220-8', 75]]);
    expect(sb.find((f: any) => f.partId === 'res-ww5').values).toEqual([2.2, 4.7, 10, 22]); expect(q(e, 'ticketCard').camera).toBe(true); expect(q(e, 'ticketCard').selectors[0].options).toEqual(['0.1 A', '0.5 A']);
  });
});

// ---------------------------------------------------------------- 4-4
describe('4-4 Bench Supply', () => {
  const build = (r1: number, r2: number) => { const e = open('4-4', ['3-3', '4-1', '4-2']), d = def('4-4'); ok(e, 'placePart', 'lm317', null, 'TO220', 10, 8, 0, false); ok(e, 'placePart', 'res-cf', r1, '0.25W', 12, 12, 0, false); ok(e, 'placePart', 'res-cf', r2, '0.25W', 4, 12, 0, false); for (const w of d.ref.wires) ok(e, 'addWire', w); return e; };
  it('the ref (R1 240, R2 390) gives 3.29 V at every load and passes with 2 stars; 330 / 510 reads 3.19 V', () => {
    const e = open('4-4', ['3-3', '4-1', '4-2']); runRef(e, '4-4'); const b = bench(e); expect(b.pass).toBe(true); expect(b.stars).toBe(2); expect(b.metrics.parts).toBe(3); expect(b.measured.vout).toBeCloseTo(3.287, 2);
    const w = bench(build(330, 510)); expect(w.pass).toBe(false); expect(texts(w)).toMatch(/Vout = 1\.25 x \(1 \+ 510 Ω \/ 330 Ω\)/);
  });
  it('large resistors (2.4 k / 3.9 k) starve the minimum load: OUT runs away at no load and the explainer says so; the formula miss gets its worked repeat', () => {
    const b = bench(build(2400, 3900)); expect(b.pass).toBe(false); expect(texts(b)).toMatch(/needs about 3\.5 mA|3\.5 mA of load/); expect(texts(b)).toMatch(/1\.25 V \/ 240 ohm = 5\.2 mA/);
    const e = build(120, 200); expect(bench(e).pass).toBe(false); expect(texts(bench(e))).toMatch(/R2 should be about/);
  });
  it('LIVE: the LOAD switch tries 10 mA, none and 500 mA; the gauge locks for the ref at all three', () => {
    const e = open('4-4', ['3-3', '4-1', '4-2']); runRef(e, '4-4'); ok(e, 'attachProbe', 1, [22, 2]); ok(e, 'power', true); frames(e, 8); expect(q(e, 'scope').lock).toBe(true);
    for (const i of [1, 2]) { ok(e, 'setSelector', 'load', i); frames(e, 8); expect(q(e, 'scope').lock, `load ${i}`).toBe(true); }
    const f = q(e, 'liveFrame').parts.find((p: any) => p.reg); expect(f.temp).toBeGreaterThan(25);
  });
});

// ---------------------------------------------------------------- 4-5
describe('4-5 EB: Zener Regulator', () => {
  const preds = (e: Engine<NodeState>, v: number[]) => { ok(e, 'predict', 'piz', v[0]); ok(e, 'predict', 'prl', v[1]); ok(e, 'predict', 'ppz', v[2]); };
  it('the slip hides the numbers until the predictions are in; exact predictions and the ref build give 3 stars and the debrief works the card', () => {
    const e = open('4-5', ['3-3', '4-1', '4-2', '4-3']); const c0 = q(e, 'ticketCard'); expect(c0.examHidden).toBe(true); expect(c0.predictions.map((p: any) => [p.id, p.unit])).toEqual([['piz', 'mA'], ['prl', 'Ω'], ['ppz', 'mW']]); expect(c0.figure.kind).toBe('zener');
    runRef(e, '4-5'); const b = bench(e); expect(b.pass).toBe(true); expect(b.stars).toBe(3); expect(b.predictions.map((p: any) => p.grade)).toEqual(['exact', 'exact', 'exact']);
    const d = q(e, 'benchResult').debrief; expect(d.node).toBe('zener'); expect(d.working).toHaveLength(5); expect(d.working.join(' ')).toMatch(/20 mA/); expect(d.working.join(' ')).toMatch(/333 ohm/); expect(d.working.join(' ')).toMatch(/120 mW/); expect(d.working[4]).toMatch(/7 ohm.*0\.126 V/); expect(d.answer).toMatch(/Iz = 14 mA, RL\(min\) = 333/);
  });
  it('a wrong prediction costs a star and the debrief says what to fix; the wrong Rs (330) fails the 20 mA check and names the value', () => {
    const e = open('4-5', ['3-3', '4-1', '4-2', '4-3']); runRef(e, '4-5'); preds(e, [14, 300, 120]); const b = bench(e); expect(b.pass).toBe(true); expect(b.stars).toBe(2); expect(b.predictions[1].grade).toBe('miss' === b.predictions[1].grade ? 'miss' : 'close');
    const e2 = open('4-5', ['3-3', '4-1', '4-2', '4-3']); ok(e2, 'placePart', 'res-exact', 330, 'ideal', 4, 2, 0, false); ok(e2, 'placePart', 'zener-6v-ideal', null, 'ideal', 12, 6, 3, false); for (const w of def('4-5').ref.wires) ok(e2, 'addWire', w); preds(e2, [14, 333.33, 120]);
    const bw = bench(e2); expect(bw.pass).toBe(false); expect(texts(bw)).toMatch(/18\.2 mA|0\.0182|18 mA/);
    expect(ok(e2, 'retryExam').ok).toBe(true);
  });
});
