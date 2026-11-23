// 0.6 testbed devices (D-testbed-06): the relay timer and the lamp dimmer load on their host tickets in the sandbox and behave as their
// cards say; the phone charger stage is 4-1's own board. Also the relay power fix: a load switched by the relay's contacts no longer
// bills the relay a sample of kilowatts at pull-in (it smoked, "203 W").
import { describe, expect, it } from 'vitest';
import { Engine } from '@core/kit';
import { GAME } from '../game';
import type { NodeState } from './state';
import { TESTBED_BOARDS } from '../data/testbed';

function load(id: string) {
  const b = TESTBED_BOARDS[id]!;
  const e = new Engine(GAME, { mode: 'learner' }); e.autosave = false;
  expect(e.act('newGame', [1, 'sandbox']).ok).toBe(true);
  expect(e.act('openTicket', [b.host]).ok).toBe(true);
  const tk = () => (e.state as NodeState).ticket!;
  for (const p of tk().board.parts.filter((p) => !p.fixed)) e.act('deletePart', [p.uid]);
  for (const w of tk().board.wires.filter((w) => !w.fixed)) e.act('deleteWire', [w.wid]);
  const r = e.act('loadBoard', [{ parts: b.parts, wires: b.wires }]); expect(r.ok, r.message).toBe(true);
  for (const pt of b.pots ?? []) expect(e.act('setPot', [tk().board.parts.find((p) => p.partId === pt.partId)!.uid, pt.alpha]).ok).toBe(true);
  return { e, tk, frame: () => e.q('liveFrame') as any };
}

describe('testbed devices (0.6)', () => {
  it('the query lists the boards and returns one by id', () => {
    const e = new Engine(GAME);
    expect(e.q('testbedBoard', [])).toEqual(['relay_timer', 'dimmer']);
    expect((e.q('testbedBoard', ['dimmer']) as any).host).toBe('5-2');
  });
  it('relay timer: the relay pulls in between 1.5 and 2.5 s, the heater then takes 2.9 W, and nothing burns', () => {
    const { e, tk, frame } = load('relay_timer');
    e.act('power', [true]);
    let tPull = -1;
    for (let i = 0; i < 160 && tPull < 0; i++) { const a = e.act('advance', [1]); expect(a.message).not.toMatch(/burn|smok/i); const f = frame(); if (f.parts.find((p: any) => p.relay)?.relay.operated) tPull = f.t; }
    expect(tPull).toBeGreaterThan(1.5); expect(tPull).toBeLessThan(2.5);
    for (let i = 0; i < 20; i++) e.act('advance', [1]);
    const f = frame();
    expect(f.parts.find((p: any) => p.uid === 'f1').power).toBeCloseTo(2.88, 1);
    expect(tk().live.smoked).toEqual([]);
  });
  it('relay timer, capacitor removed: the relay pulls in at once', () => {
    const { e, tk, frame } = load('relay_timer');
    e.act('deletePart', [tk().board.parts.find((p) => p.partId === 'cap-el')!.uid]);
    e.act('power', [true]); for (let i = 0; i < 5; i++) e.act('advance', [1]);
    expect(frame().parts.find((p: any) => p.relay).relay.operated).toBe(true);
  });
  it('relay timer, 220 uF swapped for 470 uF in place (the testbed break): the pull-in time scales with C, about 2.0 s to about 4.2 s', () => {
    const t = (c: number | null) => {
      const { e, tk, frame } = load('relay_timer');
      if (c !== null) expect(e.act('setValue', [tk().board.parts.find((p) => p.partId === 'cap-el')!.uid, c]).ok).toBe(true);
      e.act('power', [true]);
      for (let i = 0; i < 400; i++) { e.act('advance', [1]); const f = frame(); if (f.parts.find((p: any) => p.relay)?.relay.operated) { expect(tk().live.smoked).toEqual([]); return f.t as number; } }
      return -1;
    };
    const t1 = t(null), t2 = t(470e-6);
    expect(t1).toBeGreaterThan(1.8); expect(t1).toBeLessThan(2.2);
    expect(t2).toBeGreaterThan(4.0); expect(t2).toBeLessThan(4.4);
    expect(t2 / t1).toBeGreaterThan(0.95 * 470 / 220); expect(t2 / t1).toBeLessThan(1.05 * 470 / 220);
  });
  it('dimmer, emitter resistor shorted (the testbed break): the transistor saturates and the strip takes about 0.28 A, above the 0.225 A the knob gives at its top', () => {
    const { e, tk, frame } = load('dimmer');
    const pot = tk().board.parts.find((p) => p.partId === 'pot-panel')!.uid;
    const run = () => { for (let k = 0; k < 10; k++) e.act('advance', [8]); return frame(); };
    const strip = (f: any) => Math.abs(f.parts.find((p: any) => p.uid === 'f1').pins[0].i);
    e.act('power', [true]);
    expect(e.act('setPot', [pot, 0.005]).ok).toBe(true);
    const top = strip(run());
    expect(top).toBeGreaterThan(0.22); expect(top).toBeLessThan(0.23);
    expect(e.act('setPot', [pot, 0.75]).ok).toBe(true);
    const before = strip(run());
    expect(e.act('addWire', [[[18, 12], [22, 12]]]).ok).toBe(true);
    const f = run(), after = strip(f);
    expect(before).toBeLessThan(0.1);
    expect(after).toBeGreaterThan(0.26); expect(after).toBeLessThan(0.30);
    const q = f.parts.find((p: any) => p.uid === tk().board.parts.find((p) => p.partId === 'tip120')!.uid);
    expect(q.power / after).toBeLessThan(1.0);                           // Vce = P / I under 1 V: saturated, so the gain no longer sets the current
    expect(tk().live.smoked).toEqual([]);
  });
  it('dimmer: the strip current rises as the wiper moves toward the 12 V end, up to about 0.22 A, and nothing burns', () => {
    const { e, tk, frame } = load('dimmer');
    const pot = tk().board.parts.find((p) => p.partId === 'pot-panel')!.uid;
    e.act('power', [true]);
    const at = (a: number) => { e.act('setPot', [pot, a]); for (let k = 0; k < 10; k++) e.act('advance', [8]); return Math.abs(frame().parts.find((p: any) => p.uid === 'f1').pins[0].i); };
    const xs = [0.95, 0.85, 0.75, 0.7, 0.6].map(at);
    expect(xs[0]).toBeLessThan(0.005);
    for (let k = 1; k < xs.length; k++) expect(xs[k]).toBeGreaterThan(xs[k - 1]!);
    expect(xs[4]).toBeGreaterThan(0.2); expect(xs[4]).toBeLessThan(0.25);
    expect(tk().live.smoked).toEqual([]);
  });
});
