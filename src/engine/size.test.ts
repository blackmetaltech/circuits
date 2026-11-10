// State size budget driven through the real actions (DESIGN §8.3): a 40-part, 66-wire board with full undo, probes, a full scope ring, a bench
// result and a failure log serialises to <= 64 KB, and the per-act snapshot to Godot stays <= 16 KB.
import { describe, expect, it } from 'vitest';
import { Engine } from '@core/kit';
import { makeGame } from '../game';
import { LEVEL_DEFS } from '../data/levels';
import { T2 } from './testlevel.fixture';
import { MAX_WIRES, SCOPE_POINTS_CAP, UNDO_CAP, type NodeState } from './state';

describe('state size through the engine', () => {
  const g = makeGame([...LEVEL_DEFS, T2]);
  it('40 parts, 66 wires, full undo, full scope ring: <= 64 KB; snapshot <= 16 KB', () => {
    const e = new Engine(g); e.autosave = false; e.act('openTicket', ['T-2']);
    const ok = (n: string, ...a: unknown[]): void => { const r = e.act(n, a); if (!r.ok) throw new Error(`${n}: ${r.message}`); };
    for (let i = 0; i < 40; i++) ok('placePart', 'res-cf', 4700, '0.25W', 3 + (i % 10) * 5, 3 + Math.floor(i / 10) * 8, 0, false);
    for (let i = 0; i < 40; i++) if (i % 10 !== 9) ok('addWire', [[7 + (i % 10) * 5, 3 + Math.floor(i / 10) * 8], [8 + (i % 10) * 5, 3 + Math.floor(i / 10) * 8]]);
    for (let c = 0; c < 10; c++) for (let r = 0; r < 3; r++) ok('addWire', [[3 + c * 5, 11 + r * 8], [3 + c * 5, 3 + r * 8]]);
    ok('addWire', [[3, 3], [3, 1], [0, 1], [0, 0]]); ok('addWire', [[3, 27], [3, 38], [0, 38], [0, 39]]);
    const s0 = e.state as NodeState; expect(s0.ticket!.board.wires.length).toBeGreaterThanOrEqual(60); expect(s0.ticket!.board.wires.length).toBeLessThanOrEqual(MAX_WIRES);
    for (let i = 0; i < 45; i++) ok('movePart', 'p40', 48 + (i % 2 === 0 ? 1 : 0), 27);
    ok('attachProbe', 1, [3, 3]); ok('attachProbe', 2, [8, 3]); ok('power', true);
    for (let i = 0; i < 50; i++) ok('advance', 8);
    ok('runBench');
    const s = e.state as NodeState;
    expect(s.ticket!.undo.length).toBeLessThanOrEqual(UNDO_CAP); expect(s.ticket!.live.scope.ch1.length).toBe(SCOPE_POINTS_CAP);
    const kb = JSON.stringify(s).length / 1024; expect(kb).toBeLessThanOrEqual(64);
    expect(JSON.stringify(e.snapshot()).length / 1024).toBeLessThanOrEqual(16);
    for (let i = 0; i < 25; i++) ok('undo'); expect(JSON.stringify(e.state).length / 1024).toBeLessThanOrEqual(64);
    console.log(`state size with a full board: ${kb.toFixed(1)} KB; snapshot ${(JSON.stringify(e.snapshot()).length / 1024).toFixed(1)} KB`);
  });
});
