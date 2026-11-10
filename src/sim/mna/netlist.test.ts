import { describe, expect, it } from 'vitest';
import { boardToNetlist, parseNetlist, parseValue, NetlistError } from './netlist';
import type { Board } from '../board/types';
import type { PartDef } from '../../data/parts/types';

describe('parseValue', () => {
  const cases: [string, number][] = [['4', 4], ['4k', 4000], ['4.7k', 4700], ['1e-3', 1e-3], ['10meg', 1e7], ['2m', 2e-3], ['1u', 1e-6], ['1µ', 1e-6], ['100n', 1e-7], ['5p', 5e-12], ['1g', 1e9], ['10kohm', 1e4], ['-3.3', -3.3], ['.5', 0.5], ['1.5e3k', 1.5e6], ['1f', 1e-15], ['2t', 2e12]];
  for (const [s, v] of cases) it(s, () => expect(parseValue(s)).toBe(v));
  it('rejects garbage', () => { expect(() => parseValue('abc')).toThrow(NetlistError); expect(() => parseValue('')).toThrow(); });
});

describe('parseNetlist', () => {
  it('parses every card kind, comments, continuation and ground aliases', () => {
    const nl = parseNetlist(`* title\nV1 in 0 DC 12 AC 1\nR1 in a 4k ; trailing\nI1 a GND 0.5\nE1 b 0 a 0 2\nG1 b 0\n+ a 0 1e-3\nC1 a 0 1u\nL1 a b 1m\nD1 a k dmod\n.model dmod D (Is=1e-14 N=1)\n.end\nR9 x y 1`);
    expect(nl.elements.map((e) => e.kind)).toEqual(['V', 'R', 'I', 'E', 'G', 'C', 'L', 'D']);
    expect(nl.elements[0].p).toEqual({ v: 12, ac: 1 });
    expect(nl.nodeNames).toEqual(['0', 'in', 'a', 'b', 'k']);
    expect(nl.elements[2].nodes).toEqual([2, 0]);
    expect(nl.models.dmod).toEqual({ is: 1e-14, n: 1 }); expect(nl.modelTypes.dmod).toBe('d');
    expect(nl.elements[7].model).toBe('dmod');
  });
  it('errors', () => {
    for (const bad of ['Q1 a b c', 'R1 a b', 'R1 a b x', 'R1 a b 1\nR1 a b 2', '.foo']) expect(() => parseNetlist(bad)).toThrow(NetlistError);
  });
});

const def = (id: string, kind: PartDef['kind'], footprint: PartDef['footprint'], pins: string[], model: Record<string, number> = {}): PartDef =>
  ({ id, kind, nameKey: id, footprint, pins, variants: [], model, source: { doc: 't' }, verified: false, scope: 'sandbox' });
const DEFS: Record<string, PartDef> = {
  r: def('r', 'R', 'axial2', ['A', 'B']), bat: def('bat', 'MISC', 'block2', ['+', '-'], { emf: 9, r: 1.7 }), pot: def('pot', 'POT', 'pot3', ['A', 'W', 'B']),
  dmm: def('dmm', 'METER', 'block2', ['+', '-']), dmmA: def('dmmA', 'METER', 'block2', ['+', '-'], { burden: 0.1 }), bench: def('bench', 'MISC', 'block2', ['+', '-'], { bench: 1, ilim: 0.5 }), relay: def('relay', 'NOPE' as PartDef['kind'], 'radial2', ['A', 'K']),
};
const P = (uid: string, partId: string, x: number, y: number, extra: object = {}) => ({ uid, partId, value: null, variant: '', x, y, rot: 0 as const, flip: false, ...extra });

describe('boardToNetlist', () => {
  const b: Board = { w: 30, h: 20, connectors: [{ id: 'GND', pad: [0, 0], role: 'ground' }], wires: [{ wid: 'w1', path: [[6, 2], [6, 0], [0, 0]] }],
    parts: [P('p1', 'bat', 0, 2, { value: null }), P('p2', 'r', 6, 2, { value: 330 })] };
  it('expands a battery and a resistor with owners and nodes', () => {
    const { netlist, errors } = boardToNetlist({ ...b, wires: [{ wid: 'w1', path: [[0, 2], [0, 0]] }] }, (id) => DEFS[id]);
    expect(errors).toEqual([]);
    expect(netlist.elements.map((e) => [e.id, e.kind, e.owner])).toEqual([['p1', 'BAT', 'p1'], ['p2', 'R', 'p2']]);
    expect(netlist.elements[0].p).toEqual({ emf: 9, r: 1.7 }); expect(netlist.elements[1].p).toEqual({ r: 330 });
    expect(netlist.elements[0].nodes[0]).toBe(0);
  });
  it('pot, meters, bench', () => {
    const board: Board = { w: 30, h: 20, connectors: [{ id: 'GND', pad: [0, 0], role: 'ground' }], wires: [],
      parts: [P('p1', 'pot', 2, 2, { value: 1000, pos: 0.25 }), P('m1', 'dmm', 2, 6), P('m2', 'dmmA', 2, 8), P('s1', 'bench', 2, 10, { value: 5 })] };
    const { netlist, errors } = boardToNetlist(board, (id) => DEFS[id]);
    expect(errors).toEqual([]);
    const byId = Object.fromEntries(netlist.elements.map((e) => [e.id, e]));
    expect(byId['p1.aw'].p.r).toBe(250); expect(byId['p1.wb'].p.r).toBe(750);
    expect(byId.m1).toMatchObject({ kind: 'R', p: { r: 10e6 } }); expect(byId.m2).toMatchObject({ kind: 'AM', p: { r: 0.1 } });
    expect(byId.s1).toMatchObject({ kind: 'BENCH', p: { v: 5, ilim: 0.5 } });
  });
  it('reports unsupported kinds and a missing ground', () => {
    const { errors } = boardToNetlist({ w: 10, h: 10, connectors: [], wires: [], parts: [P('d1', 'relay', 1, 1)] }, (id) => DEFS[id]);
    expect(errors.map((e) => e.code).sort()).toEqual(['noExpander', 'noGround']);
  });
});
