// Oracle helpers: cards → compile → DC OP, with named accessors. (Test support, not a test.)
import { expect } from 'vitest';
import { parseNetlist } from '../mna/netlist';
import { compileNetlist } from '../mna/compile';
import { solveOp } from '../mna/op';
import { elementCurrent, elementPower, nodeVoltage } from '../mna/stamp';

export function solveCards(cards: string) {
  const nl = parseNetlist(cards);
  const r = compileNetlist(nl);
  if (!r.ok) throw new Error(JSON.stringify(r.errors));
  const ckt = r.circuit, op = solveOp(ckt);
  if (!op.ok) throw new Error('OP failed: ' + JSON.stringify(op.failure));
  const id = (n: string): number => { const k = ckt.nodeIndex[n.toLowerCase()]; if (n === '0' || n.toLowerCase() === 'gnd') return 0; if (k === undefined) throw new Error('no node ' + n); return k; };
  return { ckt, x: op.x, v: (n: string) => nodeVoltage(op.x, id(n)), i: (e: string) => elementCurrent(ckt, op.x, e), p: (e: string) => elementPower(ckt, op.x, e) };
}
/** Relative closeness (absolute when expected is 0). */
export function near(actual: number, expected: number, tol = 1e-3): void {
  const err = expected === 0 ? Math.abs(actual) : Math.abs(actual - expected) / Math.abs(expected);
  if (process.env.ORACLE_LOG) console.log(`MEASURED got ${actual} want ${expected} relerr ${err.toExponential(2)} [${expect.getState().currentTestName}]`);
  expect(err, `got ${actual}, want ${expected}`).toBeLessThanOrEqual(tol);
}
export const log = (id: string, what: string, v: number): void => { if (process.env.ORACLE_LOG) console.log(`${id} ${what} = ${v}`); };
