// Topology explainer cases (DESIGN §3.10): each is a test of the code, the elements named, and that the English exists.
import { describe, expect, it } from 'vitest';
import { checkTopology } from './topology';
import { parseNetlist } from './netlist';
import { compileNetlist } from './compile';
import { solveOp } from './op';
import { simEn } from '../../locales/sim.en';
import type { Netlist } from './types';
import { DEVICES } from './devices';
import type { Device } from './types';

// capacitor stand-in for topology: open at DC
const CAP: Device = { kind: 'C', terminals: 2, isLinear: true, branches: () => 0, internalNodes: () => 0, stampDC() {}, terminalCurrents: () => [0, 0], topo: () => ({ dc: [], ideal: [], forced: [] }) };
const IND: Device = { ...CAP, kind: 'L', topo: () => ({ dc: [[0, 1]], ideal: [[0, 1]], forced: [] }) };
const REG = { ...DEVICES, C: CAP, L: IND };
const codes = (nl: Netlist) => checkTopology(nl, REG).filter((i) => i.severity !== 'info').map((i) => i.code);
const issue = (t: string, code: string) => checkTopology(parseNetlist(t), REG).find((i) => i.code === code);

describe('topology checks', () => {
  it('a healthy divider has none', () => expect(checkTopology(parseNetlist('V1 a 0 5\nR1 a b 1k\nR2 b 0 1k'), REG)).toEqual([]));
  it('floating island', () => {
    const i = issue('V1 a 0 5\nR1 a 0 1k\nR2 x y 1k\nR3 y x 1k', 'island')!;
    expect(i.nodes).toEqual(['x', 'y']); expect(i.elements).toEqual(['R2', 'R3']); expect(i.severity).toBe('warn');
  });
  it('DC-floating node behind a capacitor', () => {
    const i = issue('V1 a 0 5\nC1 a b 1u\nR1 b c 1k\nC2 c 0 1u', 'dcFloating')!;
    expect(i.nodes).toEqual(['b', 'c']); expect(codes(parseNetlist('V1 a 0 5\nC1 a b 1u\nR1 b c 1k\nC2 c 0 1u'))).toEqual(['dcFloating']);
  });
  it('voltage-source loop (two sources in parallel)', () => {
    const i = issue('V1 a 0 5\nV2 a 0 5\nR1 a 0 1k', 'vloop')!;
    expect(i.elements).toEqual(['V1', 'V2']); expect(i.severity).toBe('block');
  });
  it('voltage-source loop through an inductor and an ideal ammeter', () => {
    const nl = parseNetlist('V1 a 0 5\nL1 a b 1m\nR1 b 0 1k');
    nl.elements.push({ id: 'A1', kind: 'AM', owner: '', nodes: [2, 0], p: { r: 0 } });
    const i = checkTopology(nl, REG).find((x) => x.code === 'vloop')!;
    expect(i.elements).toEqual(['V1', 'L1', 'A1']);
  });
  it('a real ammeter (burden > 0) is not a loop', () => {
    const nl = parseNetlist('V1 a 0 5\nR1 a 0 1k');
    nl.elements.push({ id: 'A1', kind: 'AM', owner: '', nodes: [1, 0], p: { r: 0.1 } });
    expect(codes(nl)).toEqual([]);
  });
  it('shorted ideal source blocks, shorted real battery warns', () => {
    expect(issue('V1 a a 5\nR1 a 0 1k', 'shorted')).toMatchObject({ severity: 'block', elements: ['V1'], key: 'topo.shorted' });
    const nl = parseNetlist('R1 a 0 1k');
    nl.elements.push({ id: 'B1', kind: 'BAT', owner: 'p9', nodes: [1, 1], p: { emf: 9, r: 1.7 } });
    expect(checkTopology(nl, REG).find((i) => i.code === 'shorted')).toMatchObject({ severity: 'warn', key: 'topo.shortedReal' });
  });
  it('current-source cutset', () => {
    const i = issue('V1 a 0 5\nR1 a 0 1k\nI1 a b 1m\nC1 b 0 1u', 'cutset')!;
    expect(i.elements).toEqual(['I1']); expect(i.nodes).toEqual(['b']); expect(i.severity).toBe('block');
    expect(issue('I1 0 a 1m', 'cutset')).toBeDefined();
  });
  it('current source into a resistive path is fine', () => expect(codes(parseNetlist('I1 0 a 1m\nR1 a 0 1k'))).toEqual([]));
  it('unconnected pin', () => expect(issue('V1 a 0 5\nR1 a b 1k', 'unconnected')).toMatchObject({ severity: 'info', nodes: ['b'], elements: ['R1'] }));
  it('every key returned has English with matching placeholders', () => {
    const texts = ['V1 a 0 5\nR1 a 0 1k\nR2 x y 1k', 'V1 a 0 5\nV2 a 0 5', 'V1 a a 5', 'I1 0 a 1m', 'V1 a 0 5\nC1 a b 1u\nR1 b 0 1k\nR2 b c 1k\nC2 c 0 1u'];
    for (const t of texts) for (const i of checkTopology(parseNetlist(t), REG)) {
      const en = simEn[i.key]; expect(en, i.key).toBeTruthy();
      for (const m of en.matchAll(/\{(\w+)\}/g)) expect(i.vars[m[1]], `${i.key}.${m[1]}`).toBeDefined();
    }
  });
  it('op refuses blocking topologies with the explanation key and does not throw', () => {
    const r = compileNetlist(parseNetlist('V1 a 0 5\nV2 a 0 5\nR1 a 0 1k')); if (!r.ok) throw new Error();
    const op = solveOp(r.circuit);
    expect(op.ok).toBe(false); expect(op.failure).toMatchObject({ code: 'topology', key: 'topo.vloop', elements: ['V1', 'V2'] });
  });
  it('op solves islands and floating nodes through gmin and reports them', () => {
    const r = compileNetlist(parseNetlist('V1 a 0 5\nR1 a 0 1k\nR2 x y 1k')); if (!r.ok) throw new Error();
    const op = solveOp(r.circuit);
    expect(op.ok).toBe(true); expect(op.issues.some((i) => i.code === 'island')).toBe(true);
    expect(op.x[r.circuit.nodeIndex.x - 1]).toBeCloseTo(0, 9);
  });
});
