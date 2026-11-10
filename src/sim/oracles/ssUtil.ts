// Small-signal helpers for the transistor oracles (test support, not a test): the device's own stampAC linearisation read back
// from an AcCtx, and a finite-difference gain from the DC solution (independent of mna/ac.ts).
import { compileNetlist } from '../mna/compile';
import { parseNetlist } from '../mna/netlist';
import { solveOp } from '../mna/op';
import { AcCtx, nodeVoltage } from '../mna/stamp';

/** Real part of the element's stampAC matrix (dim x dim) at the operating point x, ω = 1 rad/s (transistors have no capacitances). */
export function acMatrix(ckt: import('../mna/types').Circuit, x: Float64Array, id: string): { Re: Float64Array; dim: number } {
  const e = ckt.elements[ckt.elementIndex[id]], c = new AcCtx(ckt.dim);
  c.x.set(x); e.dev.stampAC!(e, c, 1);
  return { Re: c.Re, dim: ckt.dim };
}
/** Node voltage at the DC OP of cards. */
export function dcNode(cards: string, node: string): number {
  const r = compileNetlist(parseNetlist(cards)); if (!r.ok) throw new Error(JSON.stringify(r.errors));
  const op = solveOp(r.circuit); if (!op.ok) throw new Error('OP failed');
  return nodeVoltage(op.x, r.circuit.nodeIndex[node]);
}
/** Central finite-difference gain d v(out) / d (source value) of a card deck with `{IN}` replaced by the source value. */
export function fdGain(deck: string, vin: number, out: string, h = 1e-5): number {
  return (dcNode(deck.replace('{IN}', String(vin + h)), out) - dcNode(deck.replace('{IN}', String(vin - h)), out)) / (2 * h);
}
