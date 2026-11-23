import { describe, expect, it } from 'vitest';
import { PARTS } from '../../data/parts';
import { solveCards, near } from '../oracles/util';
import { compileNetlist } from './compile';
import { fetlim, limvds, pnjlim, vcritOf } from './limit';
import { EXPANDERS, darlingtonHfe, parseNetlist } from './netlist';
import { solveOp } from './op';
import { elementPower, terminalCurrents } from './stamp';
import type { Netlist } from './types';

describe('limiters (SPICE3)', () => {
  it('fetlim: ON, big upward step capped at vtsthi; crossing Vt downward held at vto - 0.5; OFF step capped near vto + 0.5', () => {
    expect(fetlim(10, 2, 1)).toBe(5);                                                // vold ON, below vtox: min(vnew, vto + 4)
    expect(fetlim(-5, 2, 1)).toBe(0.5);                                              // down through Vt: max(vnew, vto - 0.5)
    expect(fetlim(5, -1, 1)).toBeCloseTo(1.5, 12);                                   // OFF, jumping up: vto + 0.5
    expect(fetlim(1.2, 1.1, 1)).toBe(1.2);                                           // small step untouched
  });
  it('limvds: caps growth near the 3.5 V knee', () => {
    expect(limvds(100, 5)).toBe(17); expect(limvds(100, 1)).toBe(4); expect(limvds(-9, 1)).toBe(-0.5); expect(limvds(2, 5)).toBe(2);
  });
  it('pnjlim for a BJT junction compresses a huge forward step', () => {
    const vc = vcritOf(0.025852, 1e-14), v = pnjlim(5, 0.6, 0.025852, vc);
    expect(v).toBeGreaterThan(0.6); expect(v).toBeLessThan(0.9);
  });
});

describe('BJT', () => {
  it('PNP mirrors NPN exactly (all voltages and currents negated)', () => {
    const n = solveCards('V1 vcc 0 12\nRB vcc b 200k\nRC c 0 2k\nQ1 c b 0 N\n.model N npn(is=1e-14 bf=150 br=2 vaf=80)');
    const p = solveCards('V1 vcc 0 -12\nRB vcc b 200k\nRC c 0 2k\nQ1 c b 0 P\n.model P pnp(is=1e-14 bf=150 br=2 vaf=80)');
    for (const k of ['b', 'c']) expect(p.v(k)).toBeCloseTo(-n.v(k), 9);
    expect(p.i('Q1')).toBeCloseTo(-n.i('Q1'), 12);
  });
  it('Early effect raises IC with VCE: IC(vaf 50) > IC(no vaf) at VCE = 8', () => {
    const run = (m: string) => solveCards(`V1 vcc 0 10\nIB 0 b 20u\nRC vcc c 250\nQ1 c b 0 N\n.model N npn(is=1e-14 bf=100 ${m})`);
    const a = run(''), b = run('vaf=50'); expect(b.i('Q1')).toBeGreaterThan(a.i('Q1'));
    near(b.i('Q1') / a.i('Q1'), 1 + 8 / 50, 0.05);
  });
  it('saturation: IC < beta IB and VCE small; terminal currents sum to zero; power = V*I', () => {
    const s = solveCards('V1 vcc 0 5\nRB vcc b 10k\nRC vcc c 1k\nQ1 c b 0 N\n.model N npn(is=1e-14 bf=100 br=1)');
    expect(s.v('c')).toBeLessThan(0.3);
    const tc = terminalCurrents(s.ckt.elements[s.ckt.elementIndex.Q1], s.x); expect(Math.abs(tc[0] + tc[1] + tc[2])).toBeLessThan(1e-12);
    near(s.p('Q1'), s.v('c') * tc[0] + s.v('b') * tc[1], 1e-9);
  });
  it('Darlington (2 stages + 8k / 120 ohm): composite beta ~ hFE; emitter follower works', () => {
    const nl = parseNetlist('V1 vcc 0 12\nIB 0 b 1m\nRC vcc c 20');   // the DAR is added below
    const id = (n: string) => nl.nodeNames.indexOf(n);
    nl.elements.push({ id: 'Q1', kind: 'DAR', owner: 'p1', nodes: [id('c'), id('b'), 0], p: { is: 1e-12, bf: 31, rb: 8000, re: 120 } });
    const r = compileNetlist(nl); if (!r.ok) throw new Error(JSON.stringify(r.errors));
    const op = solveOp(r.circuit); expect(op.ok).toBe(true);
    const tc = terminalCurrents(r.circuit.elements[r.circuit.elementIndex.Q1], op.x);
    expect(Math.abs(tc[0] + tc[1] + tc[2])).toBeLessThan(1e-9);
    expect(tc[0] / tc[1]).toBeGreaterThan(300);                // beta of a Darlington is far above a single stage (shunts bleed the first stage at low current)
  });
});

describe('MOSFET', () => {
  const M = '.model N nmos(vt=2 kp=0.05 lambda=0.02)';
  it('channel-length modulation: Id = Kp/2 (Vgs-Vt)^2 (1 + lambda Vds) in saturation', () => {
    const s = solveCards(`V1 vcc 0 10\nVG g 0 4\nRD vcc d 50\nM1 d g 0 N\n${M}`);
    const vds = s.v('d'); near(s.i('M1'), 0.025 * 4 * (1 + 0.02 * vds), 1e-6);
  });
  it('PMOS high-side switch mirrors an NMOS low-side one', () => {
    const n = solveCards(`V1 vcc 0 10\nVG g 0 4\nRD vcc d 100\nM1 d g 0 N\n${M}`);
    const p = solveCards(`V1 vcc 0 -10\nVG g 0 -4\nRD vcc d 100\nM1 d g 0 P\n.model P pmos(vt=2 kp=0.05 lambda=0.02)`);
    near(p.v('d'), -n.v('d'), 1e-9); near(p.i('M1'), -n.i('M1'), 1e-9);
  });
  it('body diode conducts source -> drain when the drain is pulled below the source; the channel is symmetric', () => {
    const s = solveCards(`V1 a 0 -5\nR1 a d 100\nM1 d g 0 N\nRG g 0 1k\n${M}`);   // gate off, drain at -5 V behind 100: diode ON
    expect(s.v('d')).toBeGreaterThan(-0.9); expect(s.v('d')).toBeLessThan(-0.5); expect(s.i('M1')).toBeLessThan(-0.04);
    const t = solveCards(`V1 a 0 -1\nVG g 0 8\nR1 a d 100\nM1 d g 0 N\n${M}`);    // gate on, reverse: channel conducts (triode, swapped)
    expect(t.i('M1')).toBeLessThan(0); expect(t.v('d')).toBeGreaterThan(-1); expect(t.v('d')).toBeLessThan(-0.02);
  });
  it('floating gate (only gmin): solves, device off', () => {
    const s = solveCards(`V1 vcc 0 5\nRD vcc d 1k\nM1 d g 0 N\n${M}`); near(s.v('d'), 5, 1e-6);
  });
  it('power and terminal currents', () => {
    const s = solveCards(`V1 vcc 0 10\nVG g 0 4\nRD vcc d 100\nM1 d g 0 N\n${M}`);
    near(s.p('M1'), s.v('d') * s.i('M1'), 1e-9);
    const tc = terminalCurrents(s.ckt.elements[s.ckt.elementIndex.M1], s.x); expect(tc[1]).toBe(0); expect(tc[0] + tc[2]).toBeCloseTo(0, 15);
    void elementPower;
  });
});

describe('catalogue hookup (netlist expanders)', () => {
  const part = (uid: string) => ({ uid, partId: '', value: null, variant: '', x: 0, y: 0, rot: 0 as const, flip: false });
  const pin = (id: string, nodes: Record<string, number>) => {
    const def = PARTS.find((d) => d.id === id)!; return EXPANDERS[def.kind]!({ part: part('p1'), def, nodes: def.pins.map((n) => nodes[n]) });
  };
  it('2N3904 (pins C B E) -> Q [C,B,E] with Is/Bf/Br/Vaf; 2N2222A (pins E B C) is reordered by pin NAME', () => {
    const a = pin('2n3904', { C: 1, B: 2, E: 3 })[0]; expect(a).toMatchObject({ kind: 'Q', owner: 'p1', nodes: [1, 2, 3] }); expect(a.p).toMatchObject({ is: 6.734e-15, bf: 200, br: 0.7371, vaf: 74.03, pol: 1 });
    expect(pin('2n2222a', { C: 1, B: 2, E: 3 })[0].nodes).toEqual([1, 2, 3]);
    expect(pin('2n3906', { C: 1, B: 2, E: 3 })[0].p.pol).toBe(-1);
  });
  it('MOSFET pins S G D -> M [D,G,S]; IRLZ44N pins G D S', () => {
    expect(pin('2n7000', { D: 1, G: 2, S: 3 })[0]).toMatchObject({ kind: 'M', nodes: [1, 2, 3], p: { vt: 2.1, kp: 0.0527, lambda: 0.02, pol: 1 } });
    expect(pin('irlz44n', { D: 1, G: 2, S: 3 })[0].nodes).toEqual([1, 2, 3]);
  });
  it('TIP120 -> one DAR macro with the internal 8k / 120 ohm and per-stage beta solved so the composite (shunts included) is hFE 1000 at 0.5 A, VCE 3 V', () => {
    const e = pin('tip120', { C: 1, B: 2, E: 3 })[0]; expect(e).toMatchObject({ kind: 'DAR', nodes: [1, 2, 3] });
    expect(e.p.rb).toBe(8000); expect(e.p.re).toBe(120);
    near(darlingtonHfe(e.p.bf, e.p.is, 8000, 120, 0.5, 3), 1000, 1e-5);
    expect(e.p.bf * (e.p.bf + 1)).toBeGreaterThan(1600);          // the old rule bf(bf + 1) = 1000 ignored the shunts and gave 681 (see tip120.test.ts)
  });
  it('every catalogue transistor compiles and solves in a bias circuit', () => {
    for (const d of PARTS.filter((x) => ['NPN', 'PNP', 'DARLINGTON', 'NMOS'].includes(x.kind))) {
      const els = pin(d.id, { C: 1, B: 2, E: 0, D: 1, G: 2, S: 0 });
      const nl: Netlist = { nodeNames: ['0', 'c', 'b'], modelTypes: {}, models: {}, elements: [...els,
        { id: 'V1', kind: 'V', owner: '', nodes: [3, 0], p: { v: d.kind === 'PNP' ? -9 : 9 } },
        { id: 'RC', kind: 'R', owner: '', nodes: [3, 1], p: { r: 470 } }, { id: 'RB', kind: 'R', owner: '', nodes: [3, 2], p: { r: 47e3 } }] };
      nl.nodeNames.push('vcc');
      const r = compileNetlist(nl); if (!r.ok) throw new Error(d.id + JSON.stringify(r.errors));
      expect(solveOp(r.circuit).ok, d.id).toBe(true);
    }
  });
});
