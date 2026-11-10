// Thermal model: steady state Ta + P*theta, first-order RC integration, states, powers from an OP (DESIGN §3.9).
import { describe, expect, it } from 'vitest';
import { parseNetlist } from './mna/netlist';
import { compileNetlist } from './mna/compile';
import { solveOp } from './mna/op';
import type { Thermal } from '../data/parts/types';
import { resistorThermal } from '../data/parts/util';
import { steadyT, thetaTotal, stepThermal, integrateThermal, thermalState, elementPowers, type RatedPart } from './thermal';

const th: Thermal = { thetaJA: 100, tauS: 10, tMax: 125, tFail: 150 };

describe('steady state and RC step', () => {
  it('T = Ta + P*theta', () => { expect(steadyT(25, 0.5, 100)).toBe(75); expect(steadyT(40, 5, 54)).toBe(310); });
  it('theta total: heatsink replaces thetaJA by thetaJC + thetaCS + thetaSA', () => {
    expect(thetaTotal(th)).toBe(100);
    expect(thetaTotal({ ...th, thetaJC: 4, heatsinkable: true }, { thetaCS: 1, thetaSA: 10 })).toBe(15);
    expect(thetaTotal({ ...th, thetaJC: 4 }, { thetaCS: 1, thetaSA: 10 })).toBe(100);   // not heatsinkable
  });
  it('resistor theta from the catalogue is 85/P', () => { expect(thetaTotal(resistorThermal(0.25, 8))).toBeCloseTo(340, 9); });
  it('one backward-Euler step moves a fraction dt/(tau+dt) of the way', () => {
    const T1 = stepThermal(25, 1, 10, th, 25);   // target 125
    expect(T1).toBeCloseTo(25 + 100 * (10 / 20), 9);
  });
  it('integration converges to the steady state, monotonically, and is unconditionally stable', () => {
    const tr = Array.from({ length: 2000 }, () => ({ dt: 0.5, P: 1 }));
    const out = integrateThermal(tr, th, 25);
    expect(out.T[out.T.length - 1]).toBeCloseTo(125, 1);
    for (let i = 1; i < out.T.length; i++) expect(out.T[i]).toBeGreaterThanOrEqual(out.T[i - 1]);
    expect(stepThermal(25, 1, 1e9, th, 25)).toBeLessThanOrEqual(125 + 1e-6);
  });
  it('cools back down when the power drops', () => {
    const out = integrateThermal([{ dt: 100, P: 1 }, { dt: 100, P: 0 }], th, 25, 40);
    expect(out.T[1]).toBeLessThan(out.T[0]);
  });
});

describe('states', () => {
  const R: RatedPart = { id: 'R1', kind: 'R', ratings: { P: 0.25 }, thermal: resistorThermal(0.25, 8) };
  it('normal / warm (P > rating or T > 0.9 Tmax) / hot / smoke', () => {
    expect(thermalState(R, 0.1, 30)).toBe('normal');
    expect(thermalState(R, 0.3, 30)).toBe('warm');
    expect(thermalState(R, 0.1, 140)).toBe('warm');
    expect(thermalState(R, 0.1, 160)).toBe('hot');
    expect(thermalState(R, 0.1, 251)).toBe('smoke');
  });
});

describe('power per element from a DC solution', () => {
  it('sums to the source power (Tellegen) and attributes by owner', () => {
    const nl = parseNetlist('V1 a 0 10\nR1 a b 100\nR2 b 0 100');
    nl.elements.forEach((e) => { e.owner = e.id === 'V1' ? '' : e.id; });
    const r = compileNetlist(nl); if (!r.ok) throw new Error('compile');
    const op = solveOp(r.circuit); expect(op.ok).toBe(true);
    const p = elementPowers(r.circuit, op.x, new Array(r.circuit.stateSize).fill(0));
    expect(p.R1).toBeCloseTo(0.25, 6); expect(p.R2).toBeCloseTo(0.25, 6);
    expect(p.V1).toBeCloseTo(-0.5, 6);   // owner '' falls back to the element id; sources deliver (p < 0)
  });
});
