// Engine-level tests of the NODE skeleton: actions teach on failure, determinism, saves, protocol, slim snapshot, personas, goldens.
import { describe, expect, it } from 'vitest';
import { Engine, Env, MemoryKV, createProtocol, play } from '@core/kit';
import { goldenFile, trajectory } from '@core/kit/golden';
import { GAME } from './game';
import { REGIONS } from './regions';
import { UNDO_CAP, pushUndo, type NodeState } from './engine/state';

describe('NODE skeleton', () => {
  it('the game definition: id, title, versions, empty systems', () => {
    expect(GAME.id).toBe('node-circuits'); expect(GAME.title).toBe('NODE'); expect(GAME.saveVersion).toBe(1); expect(GAME.rulesetVersion).toBe(1);
    expect(GAME.systems).toEqual([]);
  });
  it.each(REGIONS.ids().map((r) => [r]))('newGame in %s builds the campaign state: no ticket open, empty progress, the pack\'s ruleset', (region) => {
    const e = new Engine(GAME, { region: region! }); const s = e.state as NodeState;
    expect(s.game).toBe('node-circuits'); expect(s.region).toBe(region); expect(s.ticket).toBeNull(); expect(s.level).toBeNull();
    expect(s.progress).toMatchObject({ tickets: {}, wallet: 0, upgrades: [], reputation: {}, codexSeen: [], failureLog: [] });
    expect(s.log.length).toBeGreaterThan(0);
    expect(s.log[0]!.text).toContain(REGIONS.get(region!).strings.mentor!);
  });
  it('openTicket opens a ticket inside the campaign state (level stays null) and closeTicket closes it', () => {
    const e = new Engine(GAME); const r = e.act('openTicket', ['0-0']);
    expect(r.ok).toBe(true); expect(r.message).toMatch(/Ticket 0-0/);
    const s = e.state as NodeState;
    expect(s.level).toBeNull(); expect(s.ticket!.id).toBe('0-0'); expect(s.ticket!.board.parts.map((p) => p.uid)).toEqual(['f1']); expect(s.ticket!.board.connectors.map((c) => c.id)).toEqual(['VP', 'GND']);
    expect(s.ticket!.undo).toEqual([]); expect(s.ticket!.lastBench).toBeNull();
    expect(e.act('closeTicket').ok).toBe(true); expect(e.state.ticket).toBeNull();
  });
  it('openTicket / closeTicket teach on bad input', () => {
    const e = new Engine(GAME);
    const unknown = e.act('openTicket', ['9-9']); expect(unknown.ok).toBe(false); expect(unknown.message).toMatch(/no ticket '9-9'.*0-0/i);
    expect(e.act('openTicket', []).message).toMatch(/ticket id/i); expect(e.act('openTicket', [42]).ok).toBe(false);
    expect(e.act('closeTicket').message).toMatch(/no ticket is open/i);
    e.act('openTicket', ['0-0']);
    expect(e.act('openTicket', ['0-0']).message).toMatch(/already open.*close/i);
    expect(e.state.ticket!.id).toBe('0-0');
  });
  it('actions of later milestones (upgrades, tolerance Monte Carlo, rewind, EB measurement, code loading) are not implemented yet and say so through the engine (unknown action)', () => {
    const e = new Engine(GAME);
    for (const a of ['buyUpgrade', 'runTolerance', 'rewind', 'submitMeasurement', 'realityCheck', 'loadSolution']) expect(e.act(a, []).message).toMatch(/Unknown action/);
  });
  it('same seed, same game', () => {
    const run = (seed: number) => { const env = new Env(GAME); env.reset({ seed }); env.step({ name: 'openTicket', args: ['0-0'] }); env.step({ name: 'tick' }); env.step({ name: 'closeTicket' }); return env.hash(); };
    expect(run(9)).toBe(run(9));
  });
  it('save and load round-trip through storage, ticket included', () => {
    const kv = new MemoryKV(); const e = new Engine(GAME, { storage: kv });
    e.act('openTicket', ['0-0']);
    const before = JSON.stringify(e.state);
    expect(e.act('save', ['slot2']).ok).toBe(true);
    e.act('closeTicket'); expect(e.state.ticket).toBeNull();
    expect(e.act('load', ['slot2']).ok).toBe(true); expect(JSON.stringify(e.state)).toBe(before);
    const e2 = new Engine(GAME, { storage: kv });
    expect((e2.q('saves') as any[]).map((x) => x.slot)).toContain('slot2');
    expect(e2.act('load', ['slot2']).ok).toBe(true); expect(e2.state.ticket!.id).toBe('0-0');
  });
  it('a save without a progress block is refused with a reason', () => {
    const kv = new MemoryKV(); const e = new Engine(GAME, { storage: kv });
    expect(GAME.validateSave!({ progress: null })).toMatch(/progress/); expect(GAME.validateSave!(structuredClone(e.state))).toBeNull();
  });
  it('the snapshot is slim: no undo/redo stacks, no scope ring buffer, no failure log', () => {
    const e = new Engine(GAME); e.act('openTicket', ['0-0']);
    const st = structuredClone(e.state) as NodeState;
    for (let i = 0; i < UNDO_CAP; i++) { pushUndo(st.ticket!.undo, { key: 'move', parts: { p1: { uid: 'p1', partId: 'resistor', value: 1e3, variant: '0.25W', x: i, y: 1, rot: 0, flip: false } }, wires: {} }); pushUndo(st.ticket!.redo, { key: 'move', parts: {}, wires: {} }); }
    st.ticket!.live.scope.ch1 = Array.from({ length: 512 }, (_, i) => i / 1000); st.ticket!.live.scope.ch2 = st.ticket!.live.scope.ch1.slice();
    st.progress.failureLog = Array.from({ length: 50 }, (_, i) => ({ id: i, ticket: '0-0', tick: i, kind: 'k', vars: {} }));
    e.setState(st);
    const snap = e.snapshot() as any; const text = JSON.stringify(snap);
    for (const banned of ['"undo"', '"redo"', '"ch1"', '"ch2"', '"failureLog"']) expect(text, banned).not.toContain(banned);
    expect(snap.ticket.undoDepth).toBe(st.ticket!.undo.length); expect(snap.ticket.redoDepth).toBe(st.ticket!.redo.length);
    expect(snap.ticket.id).toBe('0-0'); expect(snap.progress.wallet).toBe(0); expect(snap.progress.failureCount).toBe(50);
    expect(text.length).toBeLessThan(4000);
    expect(JSON.stringify(e.state).length).toBeGreaterThan(text.length * 3);   // the real state is much bigger than what Godot gets
  });
  it('queries: progress (wallet text per region), ticketCard (null with no ticket)', () => {
    const e = new Engine(GAME); expect(e.q('ticketCard')).toBeNull();
    const p = e.q('progress') as any; expect(p.wallet).toBe(0); expect(p.walletText).toBe('$0.00'); expect(p.tickets).toEqual({});
    const n = new Engine(GAME, { region: 'in' }); expect((n.q('progress') as any).walletText).toBe('₹0.00');
  });
  it('protocol: init lists the implemented actions and queries; unknown query teaches', () => {
    const h = createProtocol(new Engine(GAME));
    const init = h({ id: 1, fn: 'init' }); expect(init.ok).toBe(true);
    expect((init.result as any).actions).toEqual(expect.arrayContaining(['openTicket', 'closeTicket', 'placePart', 'runBench', 'advance']));
    expect((init.result as any).queries).toEqual(expect.arrayContaining(['progress', 'ticketCard', 'region']));
    expect(h({ id: 2, fn: 'act', name: 'openTicket', args: ['0-0'] }).ok).toBe(true);
    expect((h({ id: 3, fn: 'q', name: 'ticketCard' }).result as any).id).toBe('0-0');
    expect(h({ id: 4, fn: 'q', name: 'nope' }).error).toMatch(/Unknown query 'nope'/);
    const snap = h({ id: 5, fn: 'act', name: 'closeTicket', args: [] });
    expect(JSON.stringify(snap)).not.toContain('"failureLog"');
  });
  it('personas play without violations', () => {
    for (const seed of [1, 2]) expect(play(GAME, { persona: 'idle', seed, ticks: 40 }).violations, `idle/${seed}`).toEqual([]);
    expect(play(GAME, { persona: 'idle', seed: 1, ticks: 40, level: '0-0' }).status).toBe('lost');
  });
  it('golden trajectories are unchanged (GOLDEN_UPDATE=1 to regenerate deliberately)', () => {
    const g = goldenFile(new URL('./__golden__/trajectories.json', import.meta.url).pathname);
    g.check('idle-1', trajectory(GAME, { seed: 1, ticks: 20, persona: 'idle' }));
    g.check('script-open-close-2', trajectory(GAME, { seed: 2, ticks: 6, script: [[{ name: 'openTicket', args: ['0-0'] }], [], [{ name: 'closeTicket' }]] }));
    g.check('level-0-0', trajectory(GAME, { seed: 1, ticks: 10, persona: 'idle', level: '0-0' }));
    g.check('level-0-0-in', trajectory(GAME, { seed: 1, ticks: 10, persona: 'idle', level: '0-0', region: 'in' }));
  });
});
