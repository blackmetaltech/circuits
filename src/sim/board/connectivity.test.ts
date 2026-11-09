// Board connectivity: table-driven hand-made boards (DESIGN §3.1). Grid pitch 1; wires connect only at path endpoints.
import { describe, expect, it } from 'vitest';
import type { Board, Connector, Pad, PlacedPart, Rot, Wire } from './types';
import type { PartDef } from '../../data/parts/types';
import { buildConnectivity, validateBoard, validateWire } from './connectivity';
import { pinPads } from './footprints';

const def = (id: string, footprint: PartDef['footprint'], pins: string[], kind: PartDef['kind'] = 'MISC'): PartDef => ({
  id, kind, nameKey: id, footprint, pins, variants: [], model: {}, source: { doc: 'test' }, verified: false, scope: 'sandbox',
});
const DEFS: Record<string, PartDef> = {
  res: def('res', 'axial2', ['A', 'B'], 'R'), cap: def('cap', 'radial2', ['+', '-']), bjt: def('bjt', 'to92', ['C', 'B', 'E']),
  dip: def('dip', 'dip8', ['1', '2', '3', '4', '5', '6', '7', '8']), pot: def('pot', 'pot3', ['A', 'W', 'B']),
  xf: def('xf', 'xfmr4', ['P1', 'P2', 'S1', 'S2']), rly: def('rly', 'relay5', ['C1', 'C2', 'COM', 'NO', 'NC']), blk: def('blk', 'block2', ['+', '-']),
};
const getDef = (id: string) => DEFS[id];
let n = 0;
const part = (uid: string, partId: string, x: number, y: number, rot: Rot = 0, flip = false): PlacedPart => ({ uid, partId, value: null, variant: '', x, y, rot, flip });
const wire = (...path: Pad[]): Wire => ({ wid: 'w' + ++n, path });
const conn = (id: string, x: number, y: number, role: Connector['role'] = 'probe'): Connector => ({ id, pad: [x, y], role });
const GND = (x = 19, y = 19) => conn('GND', x, y, 'ground');
const board = (connectors: Connector[], parts: PlacedPart[], wires: Wire[]): Board => ({ w: 20, h: 20, connectors, parts, wires });

interface Case {
  name: string; b: Board;
  same?: string[][];       // labels that must share a node ('p1.0' = pin 0 of p1, 'c:A' = connector A)
  apart?: string[][];      // pairs that must NOT share a node
  ground?: string[];       // labels on node 0
  nodes?: number;          // number of non-ground nodes
  islands?: number;        // floating islands
  unconnected?: string[];  // unconnected pin labels
}
const cases: Case[] = [
  { name: 'empty board, GND only', b: board([GND()], [], []), nodes: 0, islands: 0, ground: ['c:GND'] },
  { name: 'lone resistor, no ground', b: board([], [part('p1', 'res', 2, 2)], []), nodes: 2, islands: 1, unconnected: ['p1.0', 'p1.1'] },
  { name: 'resistor pin on ground connector', b: board([GND(6, 2)], [part('p1', 'res', 2, 2)], []), nodes: 1, islands: 0, ground: ['p1.1', 'c:GND'], unconnected: ['p1.0'] },
  { name: 'two resistors sharing a pad', b: board([GND(10, 2)], [part('p1', 'res', 2, 2), part('p2', 'res', 6, 2)], []), same: [['p1.1', 'p2.0']], ground: ['p2.1'], nodes: 2, unconnected: ['p1.0'] },
  { name: 'wire joins two pins', b: board([GND(0, 0)], [part('p1', 'res', 2, 2), part('p2', 'res', 2, 6)], [wire([6, 2], [6, 6])]), same: [['p1.1', 'p2.1']], apart: [['p1.0', 'p2.0']], nodes: 3, islands: 1 },
  { name: 'crossing wires do not connect', b: board([GND(), conn('A', 0, 5), conn('B', 10, 5), conn('C', 5, 0), conn('D', 5, 10)], [], [wire([0, 5], [10, 5]), wire([5, 0], [5, 10])]), same: [['c:A', 'c:B'], ['c:C', 'c:D']], apart: [['c:A', 'c:C']], nodes: 2 },
  { name: 'T-junction on a wire interior does not connect', b: board([GND(), conn('A', 0, 5), conn('B', 10, 5), conn('C', 5, 0)], [], [wire([0, 5], [10, 5]), wire([5, 5], [5, 0])]), same: [['c:A', 'c:B']], apart: [['c:A', 'c:C']], nodes: 2 },
  { name: 'wires chained end to end', b: board([GND(), conn('A', 0, 0), conn('B', 5, 5)], [], [wire([0, 0], [5, 0]), wire([5, 0], [5, 5])]), same: [['c:A', 'c:B']], nodes: 1 },
  { name: 'part pin on a wire corner (interior) is unconnected', b: board([GND(), conn('A', 0, 0), conn('B', 5, 5)], [part('p1', 'res', 5, 0)], [wire([0, 0], [5, 0], [5, 5])]), same: [['c:A', 'c:B']], apart: [['p1.0', 'c:A']], unconnected: ['p1.0', 'p1.1'], nodes: 3, islands: 2 },
  { name: 'three wires meet at one pad', b: board([GND(), conn('A', 0, 5), conn('B', 10, 5), conn('C', 5, 0)], [], [wire([0, 5], [5, 5]), wire([10, 5], [5, 5]), wire([5, 0], [5, 5])]), same: [['c:A', 'c:B', 'c:C']], nodes: 1 },
  { name: 'two ground connectors are one node', b: board([GND(0, 0), conn('GND2', 5, 5, 'ground')], [], []), ground: ['c:GND', 'c:GND2'], nodes: 0 },
  { name: 'wire from connector to ground connector merges into node 0', b: board([GND(0, 0), conn('A', 5, 0)], [], [wire([0, 0], [5, 0])]), ground: ['c:A'], nodes: 0 },
  { name: 'rot 1 resistor pins (x, y+4)', b: board([GND(2, 6)], [part('p1', 'res', 2, 2, 1)], []), ground: ['p1.1'], unconnected: ['p1.0'], nodes: 1 },
  { name: 'rot 2 resistor pins (x-4, y)', b: board([GND(2, 6)], [part('p1', 'res', 6, 6, 2)], []), ground: ['p1.1'], nodes: 1 },
  { name: 'rot 3 resistor pins (x, y-4)', b: board([GND(2, 2)], [part('p1', 'res', 2, 6, 3)], []), ground: ['p1.1'], nodes: 1 },
  { name: 'flip mirrors x', b: board([GND(2, 6)], [part('p1', 'res', 6, 6, 0, true)], []), ground: ['p1.1'], nodes: 1 },
  { name: 'flip + rot 1', b: board([GND(2, 2)], [part('p1', 'res', 2, 6, 1, true)], []), ground: ['p1.1'], nodes: 1 },
  { name: 'divider: battery + two resistors', b: board([GND(1, 10)], [part('p1', 'blk', 1, 2), part('p2', 'res', 8, 2), part('p3', 'res', 12, 2)], [wire([7, 2], [8, 2]), wire([16, 2], [16, 10], [1, 10])]),
    same: [['p1.1', 'p2.0'], ['p2.1', 'p3.0']], ground: ['p3.1', 'c:GND'], nodes: 3, unconnected: ['p1.0'] },
  { name: 'a part chain hanging off a grounded part is not an island', b: board([GND(0, 0)], [part('p1', 'res', 2, 2), part('p2', 'res', 2, 8)], [wire([2, 2], [0, 2], [0, 0]), wire([6, 2], [6, 8])]), same: [['p1.1', 'p2.1']], ground: ['p1.0'], islands: 0, nodes: 2 },
  { name: 'two floating islands', b: board([GND(0, 0)], [part('p1', 'res', 2, 2), part('p2', 'res', 2, 8)], []), islands: 2, nodes: 4, unconnected: ['p1.0', 'p1.1', 'p2.0', 'p2.1'] },
  { name: 'BJT to92 pins in a row', b: board([GND(2, 4)], [part('q1', 'bjt', 2, 2)], [wire([2, 2], [2, 4])]), ground: ['q1.0'], apart: [['q1.1', 'q1.2']], nodes: 2, unconnected: ['q1.1', 'q1.2'] },
  { name: 'dip8: pin 4 (0,3) and pin 5 (3,3) on the bottom row', b: board([GND()], [part('u1', 'dip', 2, 2)], [wire([2, 5], [5, 5])]), same: [['u1.3', 'u1.4']], nodes: 7, unconnected: ['u1.0', 'u1.1', 'u1.2', 'u1.5', 'u1.6', 'u1.7'] },
  { name: 'dip8: pin 1 and pin 8 on the top row', b: board([GND()], [part('u1', 'dip', 2, 2)], [wire([2, 2], [5, 2])]), same: [['u1.0', 'u1.7']], apart: [['u1.3', 'u1.4']], nodes: 7 },
  { name: 'pot3: wiper in the middle', b: board([GND(2, 4)], [part('r1', 'pot', 2, 2)], [wire([2, 2], [2, 4])]), ground: ['r1.0'], nodes: 2, apart: [['r1.1', 'r1.2']] },
  { name: 'xfmr4 windings are separate nodes until a wire joins them', b: board([GND(0, 0)], [part('t1', 'xf', 2, 2)], []), nodes: 4, islands: 1, apart: [['t1.0', 't1.2']] },
  { name: 'xfmr4 secondary referenced to ground', b: board([GND(2, 6)], [part('t1', 'xf', 2, 2)], []), nodes: 3, islands: 0, ground: ['t1.1'] },
  { name: 'relay5 coil and contact', b: board([GND(2, 6)], [part('k1', 'rly', 2, 2)], [wire([2, 2], [1, 2], [1, 6], [2, 6])]), same: [['k1.0', 'k1.1']], ground: ['k1.0'], apart: [['k1.2', 'k1.3']], nodes: 3 },
  { name: 'parallel resistors on the same pads', b: board([GND(6, 2)], [part('p1', 'res', 2, 2), part('p2', 'res', 2, 2)], []), same: [['p1.0', 'p2.0']], ground: ['p1.1', 'p2.1'], nodes: 1 },
  { name: 'node numbering follows pad order (row-major)', b: board([GND(), conn('A', 9, 1), conn('B', 1, 2)], [], []), nodes: 2 },
  { name: 'closed wire ring', b: board([GND(), conn('A', 0, 0), conn('B', 5, 5)], [], [wire([0, 0], [5, 0]), wire([5, 0], [5, 5]), wire([5, 5], [0, 5]), wire([0, 5], [0, 0])]), same: [['c:A', 'c:B']], nodes: 1 },
  { name: 'part pin on a connector pad', b: board([GND(), conn('A', 2, 2)], [part('p1', 'res', 2, 2)], []), same: [['p1.0', 'c:A']], unconnected: ['p1.1'], nodes: 2 },
  { name: 'pin under a wire interior stays apart from the wire ends', b: board([GND(), conn('A', 0, 2), conn('B', 10, 2)], [part('p1', 'res', 2, 2)], [wire([0, 2], [10, 2])]), same: [['c:A', 'c:B']], apart: [['p1.0', 'c:A']], unconnected: ['p1.0', 'p1.1'], nodes: 3, islands: 2 },
  { name: 'dangling wire is a node but no island', b: board([GND(), conn('A', 0, 0)], [], [wire([0, 0], [4, 0])]), nodes: 1, islands: 1 },
  { name: 'wire from a pin to ground', b: board([GND(0, 0)], [part('p1', 'res', 4, 4)], [wire([4, 4], [0, 4], [0, 0])]), ground: ['p1.0'], unconnected: ['p1.1'], nodes: 1 },
  { name: 'cap radial2 pitch 2', b: board([GND(4, 2)], [part('c1', 'cap', 2, 2)], []), ground: ['c1.1'], unconnected: ['c1.0'], nodes: 1 },
];

const label = (b: Board, lab: string, c: ReturnType<typeof buildConnectivity>): number => {
  if (lab.startsWith('c:')) return c.connectorNodes[lab.slice(2)];
  const [uid, i] = lab.split('.'); return c.pinNodes[uid][Number(i)];
};

describe('board connectivity (hand-made boards)', () => {
  it('has at least 30 cases', () => expect(cases.length).toBeGreaterThanOrEqual(30));
  for (const k of cases) {
    it(k.name, () => {
      const c = buildConnectivity(k.b, getDef);
      const L = (s: string) => label(k.b, s, c);
      for (const g of k.same ?? []) for (const s of g) expect(L(s), `${s} ~ ${g[0]}`).toBe(L(g[0]));
      for (const [a, b] of k.apart ?? []) expect(L(a), `${a} !~ ${b}`).not.toBe(L(b));
      for (const s of k.ground ?? []) expect(L(s), `${s} is ground`).toBe(0);
      if (k.nodes !== undefined) expect(c.nodes.length - 1).toBe(k.nodes);
      if (k.islands !== undefined) expect(c.islands.length).toBe(k.islands);
      if (k.unconnected) expect(c.unconnectedPins.map((u) => `${u.uid}.${u.pin}`).sort()).toEqual([...k.unconnected].sort());
      // determinism: node ids sorted by min pad, ids dense
      c.nodes.forEach((nd, i) => expect(nd.id).toBe(i));
      for (let i = 2; i < c.nodes.length; i++) {
        const a = c.nodes[i - 1].pads[0], b = c.nodes[i].pads[0];
        expect(a[1] < b[1] || (a[1] === b[1] && a[0] < b[0])).toBe(true);
      }
    });
  }
  it('numbers nodes by row-major pad order', () => {
    const c = buildConnectivity(cases.find((k) => k.name.startsWith('node numbering'))!.b, getDef);
    expect(c.connectorNodes.A).toBe(1); expect(c.connectorNodes.B).toBe(2); expect(c.connectorNodes.GND).toBe(0);
  });
  it('is independent of part / wire / connector order', () => {
    const b = cases.find((k) => k.name === 'divider: battery + two resistors')!.b;
    const r: Board = { ...b, parts: [...b.parts].reverse(), wires: [...b.wires].reverse(), connectors: [...b.connectors].reverse() };
    const a = buildConnectivity(b, getDef), z = buildConnectivity(r, getDef);
    expect(z.pinNodes).toEqual(a.pinNodes); expect(z.nodes.map((x) => x.pads)).toEqual(a.nodes.map((x) => x.pads));
  });
  it('reports a missing part definition', () => {
    const c = buildConnectivity(board([GND()], [part('p1', 'nope', 1, 1)], []), getDef);
    expect(c.errors.map((e) => e.code)).toEqual(['noDef']);
  });
  it('hasGround', () => {
    expect(buildConnectivity(board([], [], []), getDef).hasGround).toBe(false);
    expect(buildConnectivity(board([GND()], [], []), getDef).hasGround).toBe(true);
  });
});

describe('footprints', () => {
  it('pinPads applies rotation and flip', () => {
    expect(pinPads(part('p', 'res', 5, 5), DEFS.res)).toEqual([[5, 5], [9, 5]]);
    expect(pinPads(part('p', 'res', 5, 5, 1), DEFS.res)).toEqual([[5, 5], [5, 9]]);
    expect(pinPads(part('p', 'res', 5, 5, 2), DEFS.res)).toEqual([[5, 5], [1, 5]]);
    expect(pinPads(part('p', 'res', 5, 5, 3), DEFS.res)).toEqual([[5, 5], [5, 1]]);
    expect(pinPads(part('p', 'res', 5, 5, 0, true), DEFS.res)).toEqual([[5, 5], [1, 5]]);
  });
  it('every footprint has as many pads as its def has pins and no coincident pins', () => {
    for (const d of Object.values(DEFS)) {
      const pads = pinPads(part('p', d.id, 3, 3), d);
      expect(pads.length).toBe(d.pins.length);
      expect(new Set(pads.map((p) => p.join(','))).size).toBe(pads.length);
    }
  });
});

describe('validation', () => {
  const B = { w: 10, h: 10 };
  const wcases: [string, Pad[], string | null][] = [
    ['ok straight', [[0, 0], [5, 0]], null], ['ok L', [[0, 0], [5, 0], [5, 5]], null], ['one pad', [[1, 1]], 'tooShort'], ['empty', [], 'tooShort'],
    ['diagonal', [[0, 0], [3, 3]], 'notOrthogonal'], ['zero length segment', [[0, 0], [0, 0], [3, 0]], 'zeroLength'],
    ['out of bounds x', [[0, 0], [10, 0]], 'outOfBounds'], ['negative', [[-1, 0], [3, 0]], 'outOfBounds'], ['fractional', [[0, 0.5], [3, 0.5]], 'nonInteger'],
    ['ends coincide', [[0, 0], [3, 0], [3, 3], [0, 3], [0, 0]], 'loop'],
  ];
  for (const [name, path, code] of wcases) it('wire ' + name, () => expect(validateWire({ wid: 'w', path }, B)?.code ?? null).toBe(code));
  it('validateBoard flags duplicates, bad pin counts and out-of-bounds pins', () => {
    const b = board([GND()], [part('p1', 'res', 18, 2), part('p1', 'res', 2, 2)], [{ wid: 'w1', path: [[0, 0], [1, 1]] }, { wid: 'w1', path: [[0, 0], [1, 0]] }]);
    const codes = validateBoard(b, getDef).map((e) => e.code).sort();
    expect(codes).toEqual(['dupUid', 'dupWid', 'notOrthogonal', 'pinOutOfBounds']);
    const bad = { ...DEFS.res, pins: ['A'] };
    expect(validateBoard(board([GND()], [part('p1', 'res', 2, 2)], []), () => bad).map((e) => e.code)).toEqual(['pinCount']);
  });
});
