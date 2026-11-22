// N3: player-facing strings use plain words: no hole coordinates, no internal ids, no "wire(s)".
import { describe, expect, it } from 'vitest';
import { Engine } from '@core/kit';
import { GAME } from '../game';
import { clearFaultActions } from './replay';
import { LEVEL_DEFS } from '../data/levels';
import { en } from '../locales/en';
import { simEn } from '../locales/sim.en';
import { newTicketProgress, type NodeState } from './state';

function open(id: string): Engine<NodeState> {
  const e = new Engine(GAME, { mode: 'learner' }); e.autosave = false;
  const st = structuredClone(e.state) as NodeState;
  for (const d of LEVEL_DEFS.filter((x) => x.chapter === 1)) { if (d.id === id) break; st.progress.tickets[d.id] = { ...newTicketProgress(), passed: true, stars: 1 }; }
  e.setState(st);
  expect(e.act('openTicket', [id]).ok).toBe(true);
  for (const a of clearFaultActions(LEVEL_DEFS.find((d) => d.id === id)!)) expect(e.act(a.name, a.args ?? []).ok).toBe(true);   // these build tests start from the cleared board (repair.test.ts covers the arrival)
  return e;
}
const ok = (e: Engine<NodeState>, name: string, ...args: unknown[]) => { const r = e.act(name, args); expect(r.ok, `${name} ${JSON.stringify(args)}: ${r.message}`).toBe(true); return r; };

describe('N3: plain words', () => {
  const agentOnly = new Set(['err.pot.kind', 'err.jockey.kind', 'pot.set', 'jockey.set', 'err.part.none', 'err.wire.none', 'err.arg.pad', 'name.part']);
  it('no locale string carries a {pad}/{uid}/{wid}/{wire} placeholder, "pad 12,3" or "wire(s)"', () => {
    const all = { ...en, ...simEn } as Record<string, string>;
    for (const [k, v] of Object.entries(all)) {
      if (agentOnly.has(k)) continue;
      expect(v, k).not.toMatch(/\{(pad|uid|wid|wire)\}/);
      expect(v, k).not.toMatch(/\(s\)/);
      expect(v, k).not.toMatch(/\bpad \d+,\d+|\bat \d+,\d+/);
    }
  });
  it('refusals and confirmations never show hole coordinates or ids', () => {
    const e = open('1-1'); const msgs: string[] = [];
    const run = (n: string, ...a: unknown[]) => { const r = e.act(n, a); msgs.push(String(r.message)); return r; };
    run('attachProbe', 1, [15, 11]); run('setMeter', 'dcv', [[15, 11], [2, 2]]); run('placePart', 'res-cf', 470, '0.25W', 30, 30, 0, false);
    run('placePart', 'res-cf', 470, '0.25W', 2, 5, 0, false); run('addWire', [[0, 5], [12, 5]]); run('addWire', [[2, 2], [2, 5]]); run('unwire', [3, 3]); run('dmmLead', 'red', [2, 2]);
    for (const m of msgs) { expect(m).not.toMatch(/\b\d+,\d+\b/); expect(m).not.toMatch(/\bw\d+\b|\bp\d+\b/); expect(m).not.toMatch(/\(s\)/); }
    expect(msgs[0]).toBe("That hole isn't connected to anything — drop the probe on a part's leg or a wire.");
  });
  it('wire counts use proper singular and plural', () => {
    const e = open('1-1'); ok(e, 'placePart', 'res-cf', 470, '0.25W', 2, 5, 0, false); ok(e, 'addWire', [[2, 2], [2, 5]]);
    const one = ok(e, 'deletePart', 'p1').message as string; expect(one).toMatch(/1 wire that only its legs/); expect(one).not.toMatch(/wires/);
    const f = open('1-1'); ok(f, 'placePart', 'res-cf', 470, '0.25W', 2, 5, 0, false); ok(f, 'addWire', [[2, 2], [2, 5]]); ok(f, 'addWire', [[6, 5], [8, 5]]);
    expect(ok(f, 'deletePart', 'p1').message as string).toMatch(/2 wires that only/);
  });
});
