// TIP120 composite DC current gain against onsemi TIP120/D Rev 10 (June 2024), ON CHARACTERISTICS: hFE >= 1000 at IC 0.5 A and at IC 3.0 A,
// VCE 3.0 V (pulse test). The part is built by the game's expander from the catalogue row, so this measures what a placed TIP120 does.
// Bench: VCE held at 3 V by a source, emitter grounded, the base voltage bisected until IC is the test current; hFE = IC / IB, where IB is the
// whole base-pin current (Q1's base plus the internal 8 k shunt), as a curve tracer would read it.
// Before the 0.7 fix each stage had bf(bf + 1) = 1000 and the 8 k / 120 ohm shunts ate the drive: 681 at 0.5 A, 945 at 3 A.
import { describe, expect, it } from 'vitest';
import { EXPANDERS } from './netlist';
import { compileNetlist } from './compile';
import { solveOp } from './op';
import { elementCurrent } from './stamp';
import { qTip120 } from '../../data/parts/transistors';
import type { Netlist } from './types';
import type { PlacedPart } from '../board/types';

function hfeAt(ic: number): { hfe: number; vbe: number } {
  const els = EXPANDERS.DARLINGTON!({ part: { uid: 'q', partId: 'tip120', value: null, variant: 'TO220', x: 0, y: 0, rot: 0, flip: false } as PlacedPart, def: qTip120, nodes: qTip120.pins.map((n) => ({ C: 1, B: 2, E: 0 })[n]!) });
  let lo = 0.8, hi = 2.5, out = { hfe: NaN, vbe: NaN };
  for (let k = 0; k < 60; k++) {
    const vb = (lo + hi) / 2;
    const nl: Netlist = { nodeNames: ['0', 'c', 'b'], modelTypes: {}, models: {}, elements: [...els,
      { id: 'Vc', kind: 'V', owner: '', nodes: [1, 0], p: { v: 3 } }, { id: 'Vb', kind: 'V', owner: '', nodes: [2, 0], p: { v: vb } }] };
    const c = compileNetlist(nl); if (!c.ok) throw new Error(JSON.stringify(c.errors));
    const op = solveOp(c.circuit); if (!op.ok) throw new Error('OP failed at ' + vb);
    const icm = -elementCurrent(c.circuit, op.x, 'Vc'), ib = -elementCurrent(c.circuit, op.x, 'Vb');
    out = { hfe: icm / ib, vbe: vb };
    if (icm > ic) hi = vb; else lo = vb;
  }
  return out;
}

describe('TIP120 composite hFE (onsemi TIP120/D Rev 10, VCE 3 V)', () => {
  it('IC 0.5 A: hFE 1000 (the datasheet minimum, +1 % at most: the model is set AT the minimum)', () => {
    const h = hfeAt(0.5).hfe;
    expect(h).toBeGreaterThanOrEqual(1000); expect(h).toBeLessThan(1010);
  });
  it('IC 3.0 A: hFE at least 1000 (the shunts matter less: about 1530), VBE under the 2.5 V maximum', () => {
    const r = hfeAt(3);
    expect(r.hfe).toBeGreaterThanOrEqual(1000); expect(r.hfe).toBeLessThan(1600);
    expect(r.vbe).toBeLessThan(2.5);
  });
});
