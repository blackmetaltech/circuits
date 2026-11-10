// Live frame pipeline and the ticket bench: deterministic fixed-step frames, bit-identical resume from a JSON round trip, scope decimation,
// thermal smoke, blocking topology explained, pure bench (inputs untouched), cost gate, conditions.
import { describe, expect, it } from 'vitest';
import { getDef } from '../engine/board';
import { refBoard } from '../engine/tickets';
import { newLive } from '../engine/state';
import { L0_0 } from '../data/levels/0-0';
import { T1 } from '../engine/testlevel.fixture';
import { advanceLive, type LiveCfg } from './live';
import { buildRig, type RigBoard, type RigGen } from './rig';
import { runTicketBench, type TicketBenchInput } from './bench/ticket';
import type { Board } from './board/types';

const GEN: RigGen = { shape: 'sine', f: 1000, vpp: 1, offset: 0 };
const asRig = (b: Board): RigBoard => ({ ...b, probes: [], meter: { mode: 'off', pads: [] } });
const rigOf = (b: Board, extra: Partial<Parameters<typeof buildRig>[0]> = {}) => buildRig({ board: asRig(b), getDef, supplies: [], supply: { v: 0, ilim: 0.1 }, gen: GEN, instruments: true, ...extra });
const CFG: LiveCfg = { frameSim: 0.02, h: 2e-3, thermalSpeed: 4, ambientC: 25, xCap: 48, histCap: 96, scopeCap: 512, timePerDiv: 1e-3 };
const t1board = (): Board => ({ w: 24, h: 16, connectors: structuredClone(T1.board.connectors), parts: structuredClone(T1.fixed), wires: [] }) as Board;
const powered = () => { const l = newLive(); l.powered = true; return l; };

describe('advanceLive', () => {
  it('is deterministic and a JSON round trip of the live state between frames changes nothing', () => {
    const rig = rigOf(refBoard(L0_0));
    const a = powered(), b = powered();
    advanceLive(a, rig, CFG, 5);
    for (let i = 0; i < 5; i++) { advanceLive(b, rig, CFG, 1); Object.assign(b, JSON.parse(JSON.stringify(b))); }
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.t).toBeCloseTo(0.1, 12); expect(a.frame).toBe(5); expect(a.status).toBe('ok');
    expect(a.x.length).toBe(rig.circuit!.dim);
  });
  it('captures the scope on a fixed grid, at most scopeCap points, oldest dropped', () => {
    const b = refBoard(L0_0);
    const rig = buildRig({ board: { ...b, probes: [{ ch: 1, pad: [6, 5] }], meter: { mode: 'off', pads: [] } }, getDef, supplies: [], supply: { v: 0, ilim: 0.1 }, gen: GEN, instruments: true });
    const l = powered(); advanceLive(l, rig, { ...CFG, timePerDiv: 1e-4 }, 8);   // dt = 3.9 us, 160 ms of sim: far more than 512 points
    expect(l.scope.ch1.length).toBe(512); expect(l.scope.dt).toBeCloseTo(1e-3 / 256, 12);
    expect(l.scope.t0).toBeGreaterThan(0.05); expect(l.scope.ch1[511]).toBeCloseTo(1.94, 1);   // the LED anode node of the ref circuit
    expect(l.scope.ch2.every((v) => v === 0)).toBe(true);
  });
  it('an unpowered rig does not simulate; parts cool; no ground and blocking loops are explained, not solved', () => {
    const b = refBoard(L0_0); const l = newLive(); advanceLive(l, rigOf(b), CFG, 3);
    expect(l.x).toEqual([]); expect(l.t).toBe(0); expect(l.frame).toBe(3);
    const noGnd = rigOf({ ...b, connectors: b.connectors.filter((c) => c.role !== 'ground') }); const p = powered();
    expect(advanceLive(p, noGnd, CFG, 1).issues[0]!.key).toBe('rig.noGround'); expect(p.status).toBe('float');
    const loop = rigOf(t1board(), { supplies: [{ id: 'psu', kind: 'bench', plus: 'IN', minus: 'GND' }, { id: 'psu2', kind: 'bench', plus: 'IN', minus: 'GND' }], supply: { v: 5, ilim: 0.1 } });
    const l2 = powered(); const o = advanceLive(l2, loop, CFG, 1); expect(l2.status).toBe('loop'); expect(o.issues[0]!.key).toBe('topo.vloop');
  });
  it('too big for the live caps says so (status big)', () => {
    const l = powered(); const out = advanceLive(l, rigOf(refBoard(L0_0)), { ...CFG, xCap: 2 }, 1);
    expect(l.status).toBe('big'); expect(out.issues[0]!.key).toBe('live.big');
  });
  it('smokes a part when its temperature passes tFail, then stops the call and reports it', () => {
    const b = refBoard(L0_0); b.parts.find((p) => p.partId === 'res-cf')!.value = 4.7;   // 4.7 ohm: ~1.7 W in a 0.25 W part
    const l = powered(); let out = advanceLive(l, rigOf(b), CFG, 8), calls = 1;
    while (out.events.length === 0 && calls < 40) { out = advanceLive(l, rigOf(b), CFG, 8); calls++; }
    expect(out.events.length).toBeGreaterThan(0); expect(out.frames).toBeLessThanOrEqual(8); expect(l.smoked.length).toBeGreaterThan(0);
  });
});

describe('runTicketBench', () => {
  const input = (b: Board, over: Partial<TicketBenchInput> = {}): TicketBenchInput => ({
    board: asRig(b), getDef, supplies: T1.supplies, plan: T1.bench, hidden: [], supply: { v: 12, ilim: 0.5 }, gen: GEN, smoked: [], predictions: { vguess: 8.33 }, ...over,
  });
  const t1ref = (): Board => { const b = { w: 24, h: 16, connectors: structuredClone(T1.board.connectors), parts: structuredClone(T1.fixed), wires: [] } as Board; b.parts.push({ uid: 'p1', partId: 'res-cf', value: 22, variant: '1W', x: 4, y: 2, rot: 0, flip: false }); b.wires.push({ wid: 'w1', path: [[2, 2], [4, 2]] }, { wid: 'w2', path: [[8, 2], [14, 2]] }); return b; };
  const deepFreeze = <X>(o: X): X => { if (o && typeof o === 'object') { Object.freeze(o); for (const v of Object.values(o)) deepFreeze(v); } return o; };
  it('is pure: frozen inputs, identical outputs, every condition run, supply power averaged', () => {
    const i = deepFreeze(input(t1ref())); const a = runTicketBench(i), b = runTicketBench(i);
    expect(a).toEqual(b); expect(a.pass).toBe(true);
    expect(a.rows.map((r) => r.id)).toEqual(['vout', 'ratings', 'vguess']);
    expect(a.supplyPowerW).toBeCloseTo((12 * 12 / 72 + 11 * 11 / 72) / 2, 2);
  });
  it('conditions bite: a supply of 9 V in the second condition fails it and the failure names the condition', () => {
    const plan = { ...T1.bench, conditions: [{ id: 'nominal' }, { id: 'sag', set: [{ target: 'psu', key: 'v', value: 9 }] }] };
    const r = runTicketBench(input(t1ref(), { plan }));
    expect(r.pass).toBe(false); expect(r.failures[0]!.vars.cond).toBe('sag'); expect(r.failures[0]!.key).toBe('bench.level.fail');
  });
  it('hidden parameters change the physics; the cost gate refuses a bench that is too big, with a teaching key', () => {
    const lo = runTicketBench(input(t1ref(), { hidden: [{ target: 'f1', key: 'r', value: 5 }] }));
    expect(lo.pass).toBe(false);
    const big = runTicketBench(input(t1ref(), { plan: { ...T1.bench, h: 1e-9, window: 1 } }));
    expect(big.failures.some((f) => f.key === 'bench.cost.too-big')).toBe(true); expect(big.pass).toBe(false);
  });
  it('burnt parts are refused before anything runs; unresolved parts and missing predictions fail their specs with keys', () => {
    const r = runTicketBench(input(t1ref(), { smoked: ['p1'] })); expect(r.failures).toEqual([{ key: 'smoke.refused', vars: { part: 'p1' } }]);
    const e = runTicketBench(input({ ...t1ref(), parts: t1ref().parts.filter((p) => p.fixed), wires: [] }, { predictions: {} }));
    expect(e.failures.map((f) => f.key)).toEqual(expect.arrayContaining(['bench.predict.missing']));
  });
});
