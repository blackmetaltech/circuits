import { describe, expect, it } from 'vitest';
import { compileNetlist } from './compile';
import { parseNetlist } from './netlist';
import { makeWorkspace, solveOp } from './op';
import { elementCurrent, elementPower, nodeVoltage } from './stamp';
import { DEVICES } from './devices';
import type { Device } from './types';

const circ = (t: string) => { const r = compileNetlist(parseNetlist(t)); if (!r.ok) throw new Error(JSON.stringify(r.errors)); return r.circuit; };

describe('linear DC operating point', () => {
  it('divider', () => {
    const c = circ('V1 a 0 10\nR1 a b 3k\nR2 b 0 1k'); const op = solveOp(c);
    expect(op).toMatchObject({ ok: true, strategy: 'linear', iterations: 1 });
    expect(nodeVoltage(op.x, c.nodeIndex.b)).toBeCloseTo(2.5, 6);
    expect(elementCurrent(c, op.x, 'R1')).toBeCloseTo(2.5e-3, 9);
    expect(elementPower(c, op.x, 'V1')).toBeCloseTo(-0.025, 8);
  });
  it('source scale lambda and workspace reuse', () => {
    const c = circ('V1 a 0 10\nR1 a 0 1k'); const ws = makeWorkspace(c);
    expect(solveOp(c, { lambda: 0.5, ws }).x[0]).toBeCloseTo(5, 6);
    expect(solveOp(c, { ws }).x[0]).toBeCloseTo(10, 6);
  });
  it('current source sign: I1 0 n pushes current INTO n', () => {
    const c = circ('I1 0 n 2m\nR1 n 0 1k'); expect(solveOp(c).x[0]).toBeCloseTo(2, 6);
  });
  it('battery with internal resistance and the bench supply as elements', () => {
    const nl = parseNetlist('R1 a 0 8.3');
    nl.elements.push({ id: 'B1', kind: 'BAT', owner: 'p1', nodes: [1, 0], p: { emf: 9, r: 1.7 } });
    const r = compileNetlist(nl); if (!r.ok) throw new Error(); const op = solveOp(r.circuit);
    expect(op.x[0]).toBeCloseTo(9 * 8.3 / 10, 6);
    expect(elementCurrent(r.circuit, op.x, 'B1')).toBeCloseTo(-0.9, 6);
    expect(elementPower(r.circuit, op.x, 'B1')).toBeCloseTo(-6.723, 5);
  });
  it('singular matrix from a voltage loop that slipped past topology gives a named explanation, not a throw', () => {
    // force the singular path: a custom device declaring no ideal edges but stamping a short branch twice
    const dup: Device = { ...DEVICES.V, kind: 'W', topo: () => ({ dc: [[0, 1]], ideal: [], forced: [] }) };
    const nl = parseNetlist('V1 a 0 5\nV2 a 0 5\nR1 a 0 1k'); nl.elements.forEach((e) => { if (e.id !== 'R1') e.kind = 'W'; });
    const r = compileNetlist(nl, { ...DEVICES, W: dup }); if (!r.ok) throw new Error();
    const op = solveOp(r.circuit);
    expect(op.ok).toBe(false);
    expect(op.failure).toMatchObject({ code: 'singular', key: 'solve.singular' });
    expect(op.failure!.elements.sort()).toEqual(['V1', 'V2']);
  });
  it('nonlinear slot: Newton converges on a test device i = g·v³', () => {
    const cube: Device = { kind: 'K', terminals: 2, isLinear: false, branches: () => 0, internalNodes: () => 0,
      stampDC(e, c) { const v = c.v(e.nodes[0]) - c.v(e.nodes[1]), g = 1e-3, gd = 3 * g * v * v, i = g * v * v * v; c.g(e.nodes[0], e.nodes[1], gd); c.i(e.nodes[0], e.nodes[1], i - gd * v); },
      terminalCurrents(e, x) { const v = (e.nodes[0] < 0 ? 0 : x[e.nodes[0]]) - (e.nodes[1] < 0 ? 0 : x[e.nodes[1]]); const i = 1e-3 * v * v * v; return [i, -i]; }, topo: () => ({ dc: [[0, 1]], ideal: [], forced: [] }) };
    const nl = parseNetlist('V1 a 0 2\nR1 a b 1\nR2 b 0 1'); nl.elements[2].kind = 'K';
    const r = compileNetlist(nl, { ...DEVICES, K: cube }); if (!r.ok) throw new Error();
    const op = solveOp(r.circuit, { x0: Float64Array.from([2, 1, 0]) });
    expect(op).toMatchObject({ ok: true, strategy: 'newton' });
    const vb = op.x[1]; expect(Math.abs((2 - vb) / 1 - 1e-3 * vb * vb * vb)).toBeLessThan(1e-8);
  });
});
