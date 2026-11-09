// State size budget (DESIGN §8.3): the whole NodeState, serialised, stays <= 64 KB with FULL undo/redo stacks of a 40-part board.
// The core engine clones the state on every action and the bridge may ship it, so this is a hard budget, not a hope.
import { describe, expect, it } from 'vitest';
import { baseState } from '@core/kit';
import { GAME } from './game';
import type { Board, PlacedPart, Wire } from './sim/board/types';
import {
  FAILURE_LOG_CAP, LIVE_X_CAP, SCOPE_POINTS_CAP, UNDO_CAP, UNDO_ITEM_BUDGET,
  newNodeState, newTicketState, pushFailure, pushScope, pushUndo, quantiseSample, type BoardSnapshot, type NodeState,
} from './engine/state';

const FAMILIES = ['resistor', 'capacitor-film', 'diode-1n4007', 'bjt-2n3904', 'led-red'];

/** 40 parts and 60 wires on a 60x40 board: the largest board a ticket allows (DESIGN §2.4 sandbox: <= 80 parts; tickets <= 40 in practice). */
function bigBoard(): Board {
  const parts: PlacedPart[] = Array.from({ length: 40 }, (_, i) => ({
    uid: `p${i + 1}`, partId: FAMILIES[i % FAMILIES.length]!, value: i % 5 === 0 ? 4700 : null, variant: '0.25W',
    x: 3 + (i % 10) * 5, y: 3 + Math.floor(i / 10) * 8, rot: (i % 4) as 0 | 1 | 2 | 3, flip: i % 7 === 0,
  }));
  const wires: Wire[] = Array.from({ length: 60 }, (_, i) => ({ wid: `w${i + 1}`, path: [[2 + (i % 10) * 5, 2 + Math.floor(i / 10) * 6], [2 + (i % 10) * 5, 5 + Math.floor(i / 10) * 6], [6 + (i % 10) * 5, 5 + Math.floor(i / 10) * 6]] }));
  return { w: 60, h: 40, connectors: [{ id: 'IN', pad: [0, 4], role: 'source' }, { id: 'OUT', pad: [59, 4], role: 'load' }, { id: 'GND', pad: [0, 36], role: 'ground' }], parts, wires };
}

/** One realistic edit: it touches a part and the wires attached to it. */
function edit(b: Board, i: number): BoardSnapshot {
  return { key: 'move', parts: { [b.parts[i % 40]!.uid]: b.parts[i % 40]! }, wires: { [b.wires[i % 60]!.wid]: b.wires[i % 60]!, [b.wires[(i + 7) % 60]!.wid]: b.wires[(i + 7) % 60]! } };
}

function fullState(): NodeState {
  const s = newNodeState(baseState('node-circuits', 1, 'learner', 'global'));
  const board = bigBoard();
  const t = newTicketState('0-0', board);
  for (let i = 0; i < 2 * UNDO_CAP + 20; i++) { pushUndo(t.undo, edit(board, i)); pushUndo(t.redo, edit(board, i + 3)); }
  for (let i = 0; i < 80; i++) t.live.temps[`p${(i % 40) + 1}`] = Math.round((25.123456 + i) * 100) / 100;
  for (let i = 0; i < LIVE_X_CAP; i++) t.live.x.push(Math.round((i * 0.123456789 + 0.1) * 1e5) / 1e5);
  for (let i = 0; i < 40; i++) t.live.hist.push(Math.round((i * 0.00123456789 + 0.1) * 1e5) / 1e5);
  for (let i = 0; i < SCOPE_POINTS_CAP + 100; i++) { pushScope(t.live.scope, 1, quantiseSample(i * 0.0123456789)); pushScope(t.live.scope, 2, quantiseSample(-i * 0.0098765432)); }
  s.ticket = t;
  for (let i = 0; i < 35; i++) s.progress.tickets[`${1 + (i >> 2)}-${(i % 5) + 1}`] = { best: { cost: 12345, parts: 12, power: 123456, area: 400 }, stars: 3, passed: true, assisted: false, attempts: 7, smokes: 2, bestCode: 'CB1.' + 'A'.repeat(250) + '.deadbeef' };
  for (let i = 0; i < FAILURE_LOG_CAP + 50; i++) pushFailure(s.progress, { id: i, ticket: '1-1', tick: i * 30, kind: 'sim.smoke.overpower', vars: { part: `p${(i % 40) + 1}`, w: 1.25 } });
  for (let i = 0; i < GAME.logCap!; i++) s.log.push({ tick: i, level: 'info', text: 'Wren: that resistor is getting warm, check the power rating of R3.' });
  return s;
}

describe('state size and caps', () => {
  it('a full state (40 parts, 60 wires, full undo/redo, full scope, failure log, long log) serialises to <= 64 KB', () => {
    const s = fullState();
    const kb = JSON.stringify(s).length / 1024;
    expect(kb).toBeLessThanOrEqual(64);
  });
  it('the caps hold: undo/redo <= 40 entries, failure log <= 200, scope <= 512 points per channel, live x <= 48', () => {
    const s = fullState(); const t = s.ticket!;
    expect(t.undo.length).toBeLessThanOrEqual(UNDO_CAP); expect(t.redo.length).toBeLessThanOrEqual(UNDO_CAP);
    expect(s.progress.failureLog.length).toBe(FAILURE_LOG_CAP);
    expect(s.progress.failureLog[0]!.id).toBe(50);   // oldest dropped
    expect(t.live.scope.ch1.length).toBe(SCOPE_POINTS_CAP); expect(t.live.scope.ch2.length).toBe(SCOPE_POINTS_CAP);
    expect(t.live.x.length).toBeLessThanOrEqual(LIVE_X_CAP);
  });
  it('the undo item budget drops the oldest entries first and keeps the newest', () => {
    const b = bigBoard(); const stack: BoardSnapshot[] = [];
    const bulk = (n: number): BoardSnapshot => ({ key: 'loadBoard', parts: Object.fromEntries(b.parts.slice(0, n).map((p) => [p.uid, p])), wires: {} });
    for (let i = 0; i < 10; i++) pushUndo(stack, bulk(40));
    expect(stack.reduce((a, e) => a + Object.keys(e.parts).length + Object.keys(e.wires).length, 0)).toBeLessThanOrEqual(UNDO_ITEM_BUDGET);
    pushUndo(stack, { key: 'last', parts: {}, wires: {} });
    expect(stack[stack.length - 1]!.key).toBe('last');
  });
  it('quantiseSample keeps 1e-5 and is finite-safe', () => {
    expect(quantiseSample(0.1234567891)).toBe(0.12346); expect(quantiseSample(NaN)).toBe(0); expect(quantiseSample(Infinity)).toBe(0);
  });
});
