// Engine tests of the §8.4 actions on the sample ticket 0-0 and the test tickets: teaching failures, quantisation, undo/redo, the live
// frame (smoke, thermal, scope), the bench, hints, save round trip, determinism, protocol, personas and level solvability.
import { describe, expect, it } from 'vitest';
import { Engine, Env, MemoryKV, checkAllLevels, createProtocol, hashOf, play } from '@core/kit';
import { makeGame } from '../game';
import { GAME } from '../game';
import { LEVEL_DEFS } from '../data/levels';
import { UNDO_CAP, type NodeState } from './state';
import { refActions } from './replay';
import { T1, T2 } from './testlevel.fixture';

const GAME2 = makeGame([...LEVEL_DEFS, T1, T2]);
const fresh = (g = GAME, mode = 'learner', ticket = '0-0'): Engine<NodeState> => {
  const e = new Engine(g, { mode }); e.autosave = false;
  expect(e.act('openTicket', [ticket]).ok).toBe(true);
  return e;
};
const st = (e: Engine<NodeState>): NodeState => e.state as NodeState;
const ok = (e: Engine<NodeState>, name: string, ...args: unknown[]) => { const r = e.act(name, args); expect(r.ok, `${name}: ${r.message}`).toBe(true); return r; };
const bad = (e: Engine<NodeState>, name: string, ...args: unknown[]) => { const r = e.act(name, args); expect(r.ok, `${name} should be refused`).toBe(false); return r.message; };
const build = (e: Engine<NodeState>, v = 470): void => {
  ok(e, 'placePart', 'res-cf', v, '0.25W', 2, 5, 0, false); ok(e, 'placePart', 'led-red-5mm', null, '5mm', 8, 5, 0, false);
  ok(e, 'addWire', [[2, 2], [2, 5]]); ok(e, 'addWire', [[6, 5], [8, 5]]); ok(e, 'addWire', [[10, 5], [10, 2], [8, 2]]);
};

describe('ticket 0-0: open, build, bench, stars', () => {
  it('opens with the fixed battery, connectors, presets; the snapshot hides the hidden params', () => {
    const e = fresh(); const tk = st(e).ticket!;
    expect(tk.board.parts.map((p) => [p.uid, p.fixed])).toEqual([['f1', true]]);
    expect(tk.board.connectors.map((c) => c.id)).toEqual(['VP', 'GND']);
    expect(JSON.stringify(e.snapshot())).not.toContain('"hidden"');
    const card = e.q('ticketCard') as any; expect(card.specs).toEqual([{ id: 'led', name: 'LED current between 10 mA and 20 mA', probe: 'i(@led-red-5mm#1)', unit: 'A' }]); expect(card.brief).toContain('Lio');
  });
  it('the reference passes the bench with ★2 (cost at par) and records progress', () => {
    const e = fresh();
    for (const a of refActions(LEVEL_DEFS[0]!)) ok(e, a.name, ...(a.args ?? []));
    const b = e.q('benchResult') as any;
    expect(b.pass).toBe(true); expect(b.stars).toBe(2); expect(b.metrics).toMatchObject({ cost: 5, parts: 2, area: 36 }); expect(b.metrics.power).toBeGreaterThan(100000);
    expect(b.specs.map((x: any) => [x.id, x.pass])).toEqual([['led', true], ['ratings', true]]);
    const p = (e.q('progress') as any).tickets['0-0']; expect(p).toMatchObject({ passed: true, stars: 2, attempts: 1 });
    expect(p.best).toEqual(b.metrics);
    expect((e.q('metrics') as any)).toEqual(b.metrics);
  });
  it('an LED straight on the battery smokes instantly with an explainer using the player\'s numbers; the bench then refuses the burnt part', () => {
    const e = fresh();
    ok(e, 'placePart', 'led-red-5mm', null, '5mm', 4, 5, 0, false);
    ok(e, 'addWire', [[2, 2], [2, 5], [4, 5]]); ok(e, 'addWire', [[6, 5], [6, 2], [8, 2]]);
    ok(e, 'power', true);
    const r = ok(e, 'advance', 3);
    expect(r.smoked).toEqual(['p1']); expect(r.message).toMatch(/burned/i);
    const log = e.q('failureLog') as any[]; expect(log).toHaveLength(1);
    const ex = e.q('explain', [log[0].id]) as any; expect(ex.key).toBe('explain.led.overcurrent.bare.first'); expect(ex.text).toMatch(/LED/);
    expect((e.q('thermal') as any).parts.find((p: any) => p.uid === 'p1').state).toBe('smoke');
    expect((e.q('liveStatus') as any).smoked).toEqual(['p1']);
    ok(e, 'runBench');
    const b = e.q('benchResult') as any; expect(b.pass).toBe(false); expect(b.failures.some((f: any) => f.key === 'smoke.refused')).toBe(true);
    ok(e, 'replaceSmoked', 'p1'); expect(st(e).ticket!.live.smoked).toEqual([]);
    expect(bad(e, 'replaceSmoked', 'p1')).toMatch(/has not smoked/);
    expect((e.q('progress') as any).tickets['0-0'].smokes).toBeGreaterThanOrEqual(1);
  });
  it('a 100 ohm resistor overheats the LED over thermal time (not instantly), a 1k resistor is too dim for the bench', () => {
    const e = fresh(); build(e, 100); ok(e, 'power', true);
    let smoked = false;
    for (let i = 0; i < 40 && !smoked; i++) smoked = (ok(e, 'advance', 8).smoked as string[]).length > 0;
    expect(smoked).toBe(true); expect(st(e).ticket!.live.frame).toBeGreaterThan(8);   // not on the first call
    const e2 = fresh(); build(e2, 1000); ok(e2, 'runBench');
    const b = e2.q('benchResult') as any; expect(b.pass).toBe(false); expect(b.failures[0].key).toBe('bench.level.fail');
    expect(b.failures[0].text).toMatch(/Too little current through the LED: 7\.\d+ mA, but it needs 10 to 20 mA/);
  });
  it('idle (empty board) fails the bench with teaching failures for the missing LED; an empty board is not a win', () => {
    const e = fresh(); ok(e, 'runBench'); const b = e.q('benchResult') as any;
    expect(b.pass).toBe(false); expect(b.failures.map((f: any) => f.key)).toContain('bench.part.missing');
    expect(b.failures[0].text).toMatch(/not on the board yet/);
  });
  it('editing the board clears the stale bench verdict (a pass belongs to the board that passed)', () => {
    const e = fresh(); for (const a of refActions(LEVEL_DEFS[0]!)) ok(e, a.name, ...(a.args ?? []));
    expect(st(e).ticket!.lastBench!.pass).toBe(true);
    ok(e, 'setValue', 'p1', 220); expect(st(e).ticket!.lastBench).toBeNull();
  });
});

describe('teaching failures (every rejection is a plain-words message with the fix)', () => {
  const e0 = fresh();
  it('no ticket open', () => {
    const e = new Engine(GAME); e.autosave = false;
    for (const a of ['placePart', 'runBench', 'advance', 'power', 'undo', 'hint']) expect(e.act(a, []).message).toMatch(/No ticket is open/);
  });
  it('parts: bin, values, ratings, pads, counts', () => {
    const e = fresh();
    expect(bad(e, 'placePart', 'nope', null, null, 1, 1, 0, false)).toMatch(/no part 'nope'/);
    expect(bad(e, 'placePart', '2n3904', null, null, 1, 1, 0, false)).toMatch(/not in this ticket's bin.*led-red-5mm/);
    expect(bad(e, 'placePart', 'res-cf', 4700, '0.25W', 3, 8, 0, false)).toMatch(/4\.7 kΩ is not a value this bin has.*1 kΩ/);
    expect(bad(e, 'placePart', 'res-cf', 470, '2W', 3, 8, 0, false)).toMatch(/no 2W version of res-cf.*0\.25W/);
    expect(bad(e, 'placePart', 'res-cf', null, '0.25W', 3, 8, 0, false)).toMatch(/positive number for its value/);
    expect(bad(e, 'placePart', 'led-red-5mm', 5, '5mm', 3, 8, 0, false)).toMatch(/no value to set/);
    expect(bad(e, 'placePart', 'res-cf', 470, '0.25W', 3.5, 8, 0, false)).toMatch(/x must be a whole number/);
    expect(bad(e, 'placePart', 'res-cf', 470, '0.25W', 22, 8, 0, false)).toMatch(/off the edge of the board/);
    expect(bad(e, 'placePart', 'res-cf', 470, '0.25W', 3, 8, 5, false)).toMatch(/0, 1, 2 or 3/);
    ok(e, 'placePart', 'led-red-5mm', null, '5mm', 3, 8, 0, false);
    expect(bad(e, 'placePart', 'led-red-5mm', null, '5mm', 12, 8, 0, false)).toMatch(/has only 1 of led-red-5mm/);
    expect(bad(e, 'placePart', 'res-cf', 470, '0.25W', 5, 8, 0, false)).toMatch(/That hole is already taken by a pin of the LED/);
    expect(bad(e, 'placePart', 'res-cf', 470, '0.25W', 2, 2, 0, false)).toMatch(/already taken by a pin of the battery/);
  });
  it('the part limit and sandbox mode', () => {
    const e = fresh();
    for (let i = 0; i < 6; i++) ok(e, 'placePart', 'res-cf', 100, '0.25W', 2, 4 + i, 0, false);
    expect(bad(e, 'placePart', 'res-cf', 100, '0.25W', 2, 12, 0, false)).toMatch(/at most 6 parts/);
    const s = fresh(GAME, 'sandbox'); ok(s, 'placePart', '2n3904', null, 'TO92', 3, 8, 0, false); ok(s, 'placePart', 'res-cf', 4700, '2W', 9, 8, 0, false);
  });
  it('wires: orthogonal, in bounds, connect only at ends', () => {
    const e = fresh(); build(e);
    expect(bad(e, 'addWire', [[2, 2]])).toMatch(/at least two pads/);
    expect(bad(e, 'addWire', [[0, 0], [3, 3]])).toMatch(/rows and columns only/);
    expect(bad(e, 'addWire', [[0, 0], [0, 0]])).toMatch(/same pad/);
    expect(bad(e, 'addWire', [[0, 0], [30, 0]])).toMatch(/off the board/);
    expect(bad(e, 'addWire', [[0, 0], [0, 4], [4, 4], [4, 0], [0, 0]])).toMatch(/start and end on the same pad/);
    expect(bad(e, 'addWire', [[0.5, 0], [3, 0]])).toMatch(/whole number/);
    expect(bad(e, 'addWire', [[0, 5], [12, 5]])).toMatch(/pass over a pin of the [^ ]+( [^ ]+)* resistor/);
    expect(bad(e, 'addWire', [[2, 2], [2, 5]])).toMatch(/already joined by a wire/);
  });
  it('a wire may cross another (insulated jumper) but not end on its middle or run over its end', () => {
    const e = fresh(); ok(e, 'addWire', [[12, 2], [12, 10]]);
    ok(e, 'addWire', [[10, 6], [14, 6]]);               // crossing at 12,6: legal jumper
    expect(bad(e, 'addWire', [[12, 6], [12, 12]]).length).toBeGreaterThan(0);
    const e2 = fresh(); ok(e2, 'addWire', [[12, 2], [12, 10]]);
    expect(bad(e2, 'addWire', [[12, 6], [16, 6]])).toMatch(/ends on the middle of another wire/);
    expect(bad(e2, 'addWire', [[12, 0], [12, 12]])).toMatch(/pass over the end of another wire/);
    expect(bad(e2, 'placePart', 'res-cf', 100, '0.25W', 12, 6, 0, false)).toMatch(/already runs through that hole/);
  });
  it('fixed parts and unknown ids', () => {
    const e = fresh();
    expect(bad(e, 'deletePart', 'f1')).toMatch(/part of the ticket and cannot be moved/);
    expect(bad(e, 'movePart', 'f1', 5, 5)).toMatch(/cannot be moved/);
    expect(bad(e, 'rotatePart', 'p9')).toMatch(/no part 'p9'/);
    expect(bad(e, 'deleteWire', 'w9')).toMatch(/no wire 'w9'/);
    expect(bad(e, 'setValue', 'f1', 5)).toMatch(/cannot be moved, changed/);
  });
  it('instruments: probes, meter, supply, generator, scope, pot, jockey', () => {
    const e = fresh(); build(e);
    expect(bad(e, 'attachProbe', 3, [2, 2])).toMatch(/channels 1 and 2/);
    expect(bad(e, 'attachProbe', 1, [15, 12])).toMatch(/isn.t connected to anything/);
    expect(bad(e, 'attachProbe', 1, [99, 1])).toMatch(/off the board/);
    expect(bad(e, 'detachProbe', 2)).toMatch(/no probe to remove/);
    expect(bad(e, 'setMeter', 'amps', [[2, 2]])).toMatch(/no 'amps' range/);
    expect(bad(e, 'setMeter', 'dcv', [])).toMatch(/one or two pads/);
    expect(bad(e, 'setMeter', 'dca', [[2, 2]])).toMatch(/both leads/);
    expect(bad(e, 'setMeter', 'dcv', [[2, 2], [2, 5]])).toMatch(/same wire network/);
    expect(bad(e, 'setSupply', 5)).toMatch(/does not have a supply/);
    expect(bad(e, 'setGen', 'sine', 100, 1)).toMatch(/does not have a gen/);
    expect(bad(e, 'setPot', 'p1', 0.5)).toMatch(/not a potentiometer/);
    expect(bad(e, 'setJockey', 'p1', 5)).toMatch(/not a slide wire/);
    expect(bad(e, 'advance', 9)).toMatch(/1 to 8 frames/);
    expect(bad(e, 'power', 'yes')).toMatch(/true or false/);
    expect(bad(e, 'setScope', 5)).toMatch(/takes an object/);
    expect(bad(e, 'setScope', { timePerDiv: 10 })).toMatch(/1 microsecond to 1 second/);
    expect(bad(e, 'predict', 'x', 1)).toMatch(/no prediction 'x'/);
    expect(bad(fresh(), 'undo')).toMatch(/Nothing to undo/);
  });
  it('the bench supply, generator, pot and jockey have ranges, and quantise on entry', () => {
    const e = fresh(GAME2, 'learner', 'T-1');
    expect(bad(e, 'setSupply', 20)).toMatch(/0 V to 15 V; 20 V is out of range/);
    expect(bad(e, 'setSupply', 5, 5)).toMatch(/current limit goes from 0 A to 1 A/);
    ok(e, 'setSupply', 5.004, 0.1234); expect(st(e).ticket!.instruments.supply).toMatchObject({ v: 5, ilim: 0.123 });
    expect(bad(e, 'setGen', 'saw', 100, 1)).toMatch(/no 'saw' wave/);
    expect(bad(e, 'setGen', 'sine', 1e9, 1)).toMatch(/Hz is out of range/);
    expect(bad(e, 'setGen', 'sine', 100, 99)).toMatch(/peak to peak/);
    ok(e, 'setGen', 'square', 1234.567, 1.23456, 0.1); expect(st(e).ticket!.instruments.gen).toMatchObject({ shape: 'square', f: 1230, vpp: 1.23, offset: 0.1 });
    ok(e, 'setScope', { timePerDiv: 0.0013, voltsPerDiv: [0.7, 3], trigger: { level: 0.123, edge: 'fall', mode: 'normal', source: 2 } });
    expect(st(e).ticket!.instruments.scope).toMatchObject({ timePerDiv: 0.001, voltsPerDiv: [0.5, 2], trigger: { level: 0.12, edge: 'fall', mode: 'normal', source: 2 } });
    expect(bad(e, 'setScope', { trigger: { edge: 'up' } })).toMatch(/'rise' or 'fall'/);
    ok(e, 'placePart', 'pot-trim', 10000, null, 6, 8, 0, false);
    expect(st(e).ticket!.board.parts.find((p) => p.uid === 'p1')!.pos).toBe(0.5);
    expect(bad(e, 'setPot', 'p1', 0.001)).toMatch(/only travels from 0.005 to 0.995/);
    ok(e, 'setPot', 'p1', 0.33349); expect(st(e).ticket!.board.parts.find((p) => p.uid === 'p1')!.pos).toBe(0.333);
    ok(e, 'placePart', 'slidewire', null, null, 6, 12, 0, false);
    expect(bad(e, 'setJockey', 'p2', 2000)).toMatch(/0 to 1000 mm/);
    ok(e, 'setJockey', 'p2', 333.33); expect(st(e).ticket!.board.parts.find((p) => p.uid === 'p2')!.pos).toBeCloseTo(0.3333, 9);
  });
  it('values snap to the catalogue exactly, so there is one encoding per board', () => {
    const e = fresh(); const r = ok(e, 'placePart', 'res-cf', 470.0000000001, null, 3, 8, 0, false);
    expect(r.value).toBe(470); expect(r.variant).toBe('0.25W');
  });
  void e0;
});

describe('undo / redo', () => {
  it('walks back and forth through every edit kind and restores the exact board', () => {
    const e = fresh(); const snap = () => JSON.stringify(st(e).ticket!.board);
    const states = [snap()];
    ok(e, 'placePart', 'res-cf', 470, null, 2, 5, 0, false); states.push(snap());
    ok(e, 'placePart', 'led-red-5mm', null, null, 8, 5, 0, false); states.push(snap());
    ok(e, 'addWire', [[2, 2], [2, 5]]); states.push(snap());
    ok(e, 'movePart', 'p2', 9, 6); states.push(snap());
    ok(e, 'rotatePart', 'p2'); states.push(snap());
    ok(e, 'setValue', 'p1', 220); states.push(snap());
    ok(e, 'swapVariant', 'p2', '5mm'); // no change: still fine, records nothing
    ok(e, 'deleteWire', 'w1'); states.push(snap());
    ok(e, 'deletePart', 'p1'); states.push(snap());
    for (let i = states.length - 1; i > 0; i--) { ok(e, 'undo'); expect(snap()).toBe(states[i - 1]); }
    expect(bad(e, 'undo')).toMatch(/Nothing to undo/);
    for (let i = 1; i < states.length; i++) { ok(e, 'redo'); expect(snap()).toBe(states[i]); }
    expect(bad(e, 'redo')).toMatch(/Nothing to redo/);
    ok(e, 'undo'); ok(e, 'addWire', [[4, 4], [4, 9]]); expect(bad(e, 'redo')).toMatch(/Nothing to redo/);   // a new edit clears redo
  });
  it('is capped at 40 entries and keeps the newest', () => {
    const e = fresh(); ok(e, 'placePart', 'res-cf', 470, null, 2, 5, 0, false);
    for (let i = 0; i < 70; i++) ok(e, 'movePart', 'p1', 2 + (i % 2), 5);
    expect(st(e).ticket!.undo.length).toBeLessThanOrEqual(UNDO_CAP);
    for (let i = 0; i < 40; i++) ok(e, 'undo');
    expect(bad(e, 'undo')).toMatch(/Nothing to undo/);
  });
  it('undoing a deleted smoked part drops the smoke record consistently (no ghost smoked uids)', () => {
    const e = fresh(); ok(e, 'placePart', 'led-red-5mm', null, null, 4, 5, 0, false); ok(e, 'addWire', [[2, 2], [2, 5], [4, 5]]); ok(e, 'addWire', [[6, 5], [6, 2], [8, 2]]);
    ok(e, 'power', true); ok(e, 'advance', 2); expect(st(e).ticket!.live.smoked).toEqual(['p1']);
    ok(e, 'deletePart', 'p1'); expect(st(e).ticket!.live.smoked).toEqual([]);
    ok(e, 'undo'); expect(st(e).ticket!.live.smoked).toEqual([]);
  });
});

describe('queries on a live board', () => {
  it('nodes: voltages and colour scalar; currents conserve KCL; board, netlist, parts', () => {
    const e = fresh(); build(e); ok(e, 'power', true); ok(e, 'advance', 4);
    const n = e.q('nodes') as any; expect(n.valid).toBe(true);
    const vp = n.nodes.find((x: any) => x.connectors.includes('VP')); expect(vp.v).toBeGreaterThan(8.9); expect(vp.norm).toBe(1);
    const c = e.q('currents') as any; expect(c.valid).toBe(true);
    const i = c.wires.map((w: any) => w.mag); for (const x of i) expect(x).toBeCloseTo(0.01495, 4);
    const sum = c.parts.flatMap((p: any) => p.pins.map((q: any) => q.i)).reduce((a: number, b: number) => a + b, 0); expect(Math.abs(sum)).toBeLessThan(1e-9);
    // direction: current runs + terminal -> R -> LED -> GND, i.e. down wire w1 (path 2,2 -> 2,5) is positive
    expect(c.wires.find((w: any) => w.wid === 'w1').i).toBeGreaterThan(0);
    const b = e.q('board') as any; expect(b.parts.find((p: any) => p.uid === 'p2')).toMatchObject({ name: 'Red LED 5 mm', kind: 'LED' }); expect(b.parts[1].pins).toHaveLength(2);
    const nl = e.q('netlist') as any; expect(nl.elements.map((x: any) => x.kind)).toEqual(['BAT', 'R', 'D']); expect(nl.errors).toEqual([]);
    const parts = e.q('parts') as any[]; expect(parts.map((p) => p.id)).toEqual(['res-cf', 'led-red-5mm']); expect(parts[0].values).toEqual([100, 220, 470, 1000]);
    expect(parts[0].variants[0]).toMatchObject({ id: '0.25W', price: 2, priceText: '$0.02' });
    expect((e.q('parts', [false]) as any[]).length).toBeGreaterThan(30);
    const r = e.q('ratings') as any; expect(r.parts.find((p: any) => p.uid === 'p1').ratio).toBeCloseTo(0.42, 1);
    const tk = e.q('tickets') as any[]; expect(tk[0]).toEqual(expect.objectContaining({ id: '0-0', unlocked: true, passed: false })); expect(tk.map((x) => [x.id, x.unlocked])).toEqual([['0-0', true], ['1-1', true], ['1-2', false], ['1-3', false], ['1-4', false], ['1-5', false], ['2-1', false], ['2-2', false], ['2-3', false], ['2-4', false], ['3-1', false], ['3-2', false], ['3-3', false], ['3-4', false], ['4-1', false], ['4-2', false], ['4-3', false], ['4-4', false], ['4-5', false], ['5-1', false], ['5-2', false], ['5-3', false], ['5-4', false], ['5-5', false], ['6-1', false], ['6-2', false], ['6-3', false], ['6-4', false], ['6-5', false], ['6-6', false], ['6-7', false]]);
  });
  it('scope: attached probe captures the node, decimated into a ring of at most 512 points, trigger-aligned window', () => {
    const e = fresh(GAME2, 'learner', 'T-1');
    ok(e, 'addWire', [[2, 2], [14, 2]]);   // IN -> OUT directly: 12 V on OUT through the 50 ohm heater
    ok(e, 'attachProbe', 1, [14, 2]); ok(e, 'attachProbe', 2, [2, 8]);
    ok(e, 'setScope', { timePerDiv: 2e-3 });   // 10 divisions = 20 ms per screen = 2 frames
    ok(e, 'setGen', 'sine', 100, 2, 0); ok(e, 'power', true);
    for (let i = 0; i < 60; i++) ok(e, 'advance', 8);
    const tk = st(e).ticket!; expect(tk.live.scope.ch1.length).toBeLessThanOrEqual(512); expect(tk.live.scope.ch1.length).toBe(tk.live.scope.ch2.length);
    const s1 = e.q('scope', [1]) as any; expect(s1.attached).toBe(true); expect(s1.v).toHaveLength(256);
    for (const v of s1.v) expect(v).toBeCloseTo(12, 1);
    const s2 = e.q('scope', [2, 256]) as any; expect(s2.v).toHaveLength(256);
    expect(Math.max(...s2.v)).toBeGreaterThan(0.5); expect(Math.min(...s2.v)).toBeLessThan(-0.5);   // the generator's 100 Hz sine, probed on SIG
    expect(JSON.stringify(e.snapshot())).not.toContain('"ch1"');
  });
  it('meter: dcv, dca, ohm; acv is declared unavailable', () => {
    const e = fresh(); build(e); ok(e, 'power', true);
    ok(e, 'setMeter', 'dcv', [[2, 5], [6, 5]]); ok(e, 'advance', 4);
    const v = e.q('meter') as any; expect(v.value).toBeGreaterThan(6.9); expect(v.value).toBeLessThan(7.2); expect(v.unit).toBe('V'); expect(v.text).toMatch(/V$/);
    expect(bad(e, 'setMeter', 'dca', [[2, 2], [2, 5]])).toMatch(/same wire network/);   // 2,2 and 2,5 are joined by wire w1
  });
  it('meter dca across two different nodes and ohm', () => {
    const e = fresh(); ok(e, 'placePart', 'res-cf', 470, null, 2, 5, 0, false); ok(e, 'placePart', 'led-red-5mm', null, null, 8, 5, 0, false);
    ok(e, 'addWire', [[6, 5], [8, 5]]); ok(e, 'addWire', [[10, 5], [10, 2], [8, 2]]);
    ok(e, 'power', true); ok(e, 'setMeter', 'dca', [[2, 2], [2, 5]]); ok(e, 'advance', 4);   // meter between VP and the resistor: no wire between them yet
    const a = e.q('meter') as any; expect(a.unit).toBe('A'); expect(a.value).toBeGreaterThan(0.0149); expect(a.value).toBeLessThan(0.0151);
    ok(e, 'power', false); ok(e, 'setMeter', 'ohm', [[2, 5], [6, 5]]);
    const o = e.q('meter') as any; expect(o.unit).toBe('Ω'); expect(o.value).toBeCloseTo(470, 0);
    ok(e, 'setMeter', 'acv', [[2, 5], [6, 5]]); expect((e.q('meter') as any).value).toBeNull();
    ok(e, 'setMeter', 'off'); expect((e.q('meter') as any).mode).toBe('off');
  });
  it('topology problems are explained, not crashes: floating nodes, no ground, shorts', () => {
    const e = fresh(); ok(e, 'placePart', 'res-cf', 470, null, 12, 5, 0, false); ok(e, 'power', true); ok(e, 'advance', 1);
    const ls = e.q('liveStatus') as any; expect(ls.status).toBe('float'); expect(ls.issues[0].text).toMatch(/not connected to the ground/);
    const e2 = fresh(); ok(e2, 'power', true); ok(e2, 'advance', 2); expect((e2.q('liveStatus') as any).status).toBe('ok');
  });
});

describe('the test ticket T-1: conditions, hidden parameters, hints, predictions, loadBoard / exportSolution', () => {
  it('the ref passes in BOTH conditions; the 0.25 W resistor fails the rating spec; hidden r follows the mode', () => {
    const e = fresh(GAME2, 'learner', 'T-1'); expect(st(e).ticket!.hidden).toEqual({ rh: 50 });
    ok(e, 'predict', 'vguess', 8.3);
    const t1 = new Engine(GAME2); t1.autosave = false; t1.act('openTicket', ['T-1']);
    for (const a of refActions(T1)) ok(t1, a.name, ...(a.args ?? []));
    ok(t1, 'predict', 'vguess', 8.33); ok(t1, 'runBench');
    const b = t1.q('benchResult') as any; expect(b.pass).toBe(true); expect(b.predictions[0]).toMatchObject({ id: 'vguess', grade: 'exact' });
    const eng = new Engine(GAME2, { mode: 'engineer', seed: 3 }); eng.autosave = false; eng.act('openTicket', ['T-1']);
    const h = st(eng).ticket!.hidden.rh!; expect(h).toBeGreaterThanOrEqual(45); expect(h).toBeLessThanOrEqual(55); expect(h).not.toBe(50);
    const eng2 = new Engine(GAME2, { mode: 'engineer', seed: 3 }); eng2.autosave = false; eng2.act('openTicket', ['T-1']); expect(st(eng2).ticket!.hidden.rh).toBe(h);
    const w = fresh(GAME2, 'learner', 'T-1');
    ok(w, 'placePart', 'res-cf', 22, '0.25W', 4, 2, 0, false); ok(w, 'addWire', [[2, 2], [4, 2]]); ok(w, 'addWire', [[8, 2], [14, 2]]); ok(w, 'predict', 'vguess', 1); ok(w, 'runBench');
    const wb = w.q('benchResult') as any; expect(wb.pass).toBe(false); expect(wb.failures.some((f: any) => f.key === 'rating.resistor.power')).toBe(true);
    expect(wb.failures.find((f: any) => f.key === 'rating.resistor.power').text).toMatch(/dissipated/);
    expect(wb.failures.find((f: any) => f.key === 'rating.resistor.power').text).toMatch(/V²\/R|times its rating|rated/);
  });
  it('loadBoard validates like the live actions, is one undo step, and exportSolution needs a pass', () => {
    const e = fresh(GAME2, 'learner', 'T-1');
    expect(bad(e, 'exportSolution')).toMatch(/Pass the bench with this board first/);
    ok(e, 'loadBoard', { parts: [{ partId: 'res-cf', value: 22, variant: '1W', x: 4, y: 2, rot: 0, flip: false }], wires: [{ path: [[2, 2], [4, 2]] }, { path: [[8, 2], [14, 2]] }] });
    expect(st(e).ticket!.board.parts.map((p) => p.uid)).toEqual(['f1', 'p1']); expect(st(e).ticket!.undo).toHaveLength(1);
    expect(bad(e, 'loadBoard', { parts: [{ partId: 'res-cf', value: 33, variant: '1W', x: 4, y: 2, rot: 0, flip: false }], wires: [] })).toMatch(/not a value this bin has/);
    expect(st(e).ticket!.board.parts).toHaveLength(2);   // atomic
    ok(e, 'predict', 'vguess', 8.3); ok(e, 'runBench'); const x = ok(e, 'exportSolution');
    expect(x.ticket).toBe('T-1'); expect((x.board as any).parts).toHaveLength(1); expect(x.code).toBeNull(); expect((x.metrics as any).cost).toBe(7);
    ok(e, 'undo'); expect(st(e).ticket!.board.parts).toHaveLength(1);
    expect(bad(e, 'loadBoard', 5)).toMatch(/object with a list of parts/);
  });
  it('the hint ladder: nudge, equation with the live numbers, then a ghost part (and "assisted" in engineer)', () => {
    const e = fresh();
    const h1 = ok(e, 'hint'); expect(h1.rung).toBe(1); expect(h1.message).toMatch(/limit its current/);
    const h2 = ok(e, 'hint'); expect(h2.rung).toBe(2); expect(h2.message).toMatch(/R = \(battery 9 V - LED 1\.9\d? V\) \/ 0\.015 A, about 4\d\d ohm/);
    const h3 = ok(e, 'hint'); expect(h3.rung).toBe(3); expect((h3.ghost as any).partId).toBe('res-cf'); expect(h3.message).toMatch(/res-cf|Carbon/i);
    build(e); const h4 = ok(e, 'hint'); expect(h4.message).toMatch(/All the parts/);
    expect((e.q('progress') as any).tickets['0-0']?.assisted ?? false).toBe(false);
    const g = fresh(GAME, 'engineer'); ok(g, 'hint'); expect((g.q('progress') as any).tickets['0-0'].assisted).toBe(true);
    expect(bad(fresh(GAME2, 'learner', 'T-2'), 'hint')).toMatch(/no hints/);
  });
  it('tickets can be locked behind others (data-only)', () => {
    const g = makeGame([...LEVEL_DEFS, { ...T2, id: 'T-3', after: ['0-0'] }]); const e = new Engine(g); e.autosave = false;
    expect(e.act('openTicket', ['T-3']).message).toMatch(/Ticket T-3 is locked. Pass 0-0 first/);
    expect((e.q('tickets') as any[]).find((x) => x.id === 'T-3').unlocked).toBe(false);
  });
});

describe('determinism, save round trip, protocol', () => {
  const script = (e: Engine<NodeState>, upTo = 99): void => {
    const acts = [...refActions(LEVEL_DEFS[0]!).slice(0, -2), { name: 'advance', args: [3] }, { name: 'attachProbe', args: [1, [6, 5]] }, { name: 'advance', args: [5] }, { name: 'runBench' }].slice(0, upTo);
    for (const a of acts) ok(e, a.name, ...(a.args ?? []));
  };
  it('the same actions give a bit-identical state (hash), including the live solution and scope', () => {
    const a = fresh(), b = fresh(); script(a); script(b);
    expect(hashOf(a.state)).toBe(hashOf(b.state)); expect(st(a).ticket!.live.t).toBeGreaterThan(0.1); expect(st(a).ticket!.live.scope.ch1.length).toBeGreaterThan(0);
  });
  it('advance(2) equals advance(1) twice, and a save in the middle does not change the future', () => {
    const a = fresh(), b = fresh(); build(a); build(b); ok(a, 'power', true); ok(b, 'power', true);
    ok(a, 'advance', 2); ok(b, 'advance', 1); ok(b, 'advance', 1);
    expect(hashOf(a.state)).toBe(hashOf(b.state));
    const kv = new MemoryKV(); const c = new Engine(GAME, { storage: kv }); c.autosave = false; c.act('openTicket', ['0-0']); build(c); ok(c, 'power', true); ok(c, 'advance', 3);
    ok(c, 'save', 'slot2'); ok(c, 'advance', 4);
    const d = new Engine(GAME, { storage: kv }); d.autosave = false; ok(d, 'load', 'slot2'); ok(d, 'advance', 4);
    expect(JSON.stringify(d.state)).toBe(JSON.stringify(c.state));
  });
  it('save and load round-trip a ticket with undo stacks, probes, live state and a bench result', () => {
    const kv = new MemoryKV(); const e = new Engine(GAME, { storage: kv }); e.autosave = false; e.act('openTicket', ['0-0']);
    script(e); const before = JSON.stringify(e.state);
    ok(e, 'save', 'slot3'); e.act('closeTicket'); expect(e.state.ticket).toBeNull();
    ok(e, 'load', 'slot3'); expect(JSON.stringify(e.state)).toBe(before);
    const e2 = new Engine(GAME, { storage: kv }); ok(e2, 'load', 'slot3'); expect(st(e2).ticket!.lastBench!.pass).toBe(true); expect(e2.q('currents')).toEqual(e.q('currents'));
    expect(e2.q('saves')).toEqual(expect.arrayContaining([expect.objectContaining({ slot: 'slot3' })]));
    expect(GAME.validateSave!({ ...structuredClone(e.state), ticket: { id: 'zz' } })).toMatch(/damaged open ticket/);
  });
  it('protocol: init lists every action and query; act returns a slim snapshot; queries answer', () => {
    const h = createProtocol(new Engine(GAME));
    const init = (h({ id: 1, fn: 'init' }).result as any);
    for (const a of ['openTicket', 'closeTicket', 'placePart', 'movePart', 'rotatePart', 'deletePart', 'setValue', 'swapVariant', 'addWire', 'deleteWire', 'attachProbe', 'detachProbe', 'setMeter', 'setSupply', 'setGen', 'setScope', 'setPot', 'setJockey', 'power', 'advance', 'runBench', 'undo', 'redo', 'hint', 'predict', 'loadBoard', 'exportSolution', 'replaceSmoked']) expect(init.actions, a).toContain(a);
    for (const q of ['board', 'netlist', 'nodes', 'currents', 'thermal', 'ratings', 'scope', 'meter', 'liveStatus', 'benchResult', 'explain', 'ticketCard', 'tickets', 'progress', 'parts', 'legalActions']) expect(init.queries, q).toContain(q);
    expect(h({ id: 2, fn: 'act', name: 'openTicket', args: ['0-0'] }).ok).toBe(true);
    const r = h({ id: 3, fn: 'act', name: 'placePart', args: ['res-cf', 470, '0.25W', 2, 5, 0, false] });
    expect((r.result as any).ok).toBe(true); expect(JSON.stringify(r.game)).not.toMatch(/"(undo|redo|ch1|failureLog|hist|hidden)"/);
    expect((r.game as any).ticket.board.parts).toHaveLength(2); expect((r.game as any).ticket.undoDepth).toBe(1);
    expect((h({ id: 4, fn: 'q', name: 'board' }).result as any).parts).toHaveLength(2);
    const bad1 = h({ id: 5, fn: 'act', name: 'placePart', args: ['res-cf', 5, '0.25W', 2, 7, 0, false] });
    expect(bad1.ok).toBe(true); expect((bad1.result as any).ok).toBe(false); expect((bad1.result as any).message).toMatch(/not a value/);
    expect(h({ id: 6, fn: 'q', name: 'nope' }).error).toMatch(/Unknown query 'nope'/);
    expect(JSON.stringify(h({ id: 7, fn: 'act', name: 'power', args: [true] }).game).length).toBeLessThan(16 * 1024);
  });
  it('legalActions: candidates are non-empty at the counter and in a ticket, and probe-filtered', () => {
    const env = new Env(GAME); env.reset({ seed: 1 });
    expect(env.legalActions().map((a) => a.name)).toContain('openTicket');
    env.step({ name: 'openTicket', args: ['0-0'] });
    const names = new Set(env.legalActions().map((a) => a.name)); for (const n of ['placePart', 'power', 'advance', 'runBench', 'hint', 'closeTicket']) expect(names.has(n), n).toBe(true);
    expect(names.has('undo')).toBe(false);
    expect((env.engine.q('legalActions') as any[]).length).toBeGreaterThan(10);
  });
});

describe('personas, invariants and levels', () => {
  it('idle and monkey play with zero invariant violations (campaign free play and the core level)', () => {
    for (const seed of [1, 2, 3]) for (const persona of ['idle', 'monkey']) {
      expect(play(GAME, { persona, seed, ticks: 30 }).violations, `${persona} ${seed}`).toEqual([]);
      expect(play(GAME, { persona, seed, ticks: 30, level: '0-0' }).violations, `${persona} ${seed} level`).toEqual([]);
    }
  });
  it('the monkey, with a ticket open, really exercises the engine (many actions succeed) and idle never passes', () => {
    const r = play(GAME, { persona: 'monkey', seed: 5, ticks: 40, level: '0-0' }); expect(r.actionsOk).toBeGreaterThan(30);
    const i = play(GAME, { persona: 'idle', seed: 1, ticks: 20, level: '0-0' }); expect(i.status).toBe('lost'); expect(i.violations).toEqual([]);
  });
  it('the monkey on the test tickets (supply, generator, pot, slide wire) also breaks nothing', () => {
    for (const lvl of ['T-1', 'T-2']) expect(play(GAME2, { persona: 'monkey', seed: 7, ticks: 25, level: lvl }).violations, lvl).toEqual([]);
  });
  it('the expert replays the ref and wins the core level; checkAllLevels is clean for 0-0 and the test tickets', () => {
    expect(play(GAME, { persona: 'expert', seed: 1, ticks: 5, level: '0-0' }).status).toBe('won');
    for (const g of [GAME, GAME2]) for (const r of checkAllLevels(g, { seed: 1 }).filter((x) => g === GAME || x.level !== 'T-2')) expect(r.problems, r.level).toEqual([]);
  });
  it('the core level and the campaign ticket run the same code: same metrics', () => {
    const lv = new Env(GAME); lv.reset({ seed: 1, level: '0-0' });
    for (const a of refActions(LEVEL_DEFS[0]!)) lv.step(a);
    expect(lv.state.status).toBe('won'); const c = fresh(); for (const a of refActions(LEVEL_DEFS[0]!)) ok(c, a.name, ...(a.args ?? []));
    expect(lv.engine.q('metrics')).toEqual(c.q('metrics')); expect((lv.engine.q('solutionCode') as string)).toMatch(/^CB1\./);
  });
});
