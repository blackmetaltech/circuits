// 0.7 tool ladder (Dagny, CRITIQUE-0.6: "after the $15 dial the wallet buys nothing"; D-tools-07). Three bench tools, each changing a
// diagnosis: the condition dial (check the tired battery before the test), the thermal camera (see a part heating before it burns,
// on every job, not only chapter 4's) and the scope's second channel (input and output on one screen: gain, clipping, phase).
// The testbed and the free bench have them all; only a customer's job asks the wallet.
import { describe, expect, it } from 'vitest';
import { Engine } from '@core/kit';
import { GAME } from '../game';
import { LEVEL_DEFS } from '../data/levels';
import { newTicketProgress, type NodeState } from './state';

function open(id: string, mode = 'learner'): Engine<NodeState> {
  const e = new Engine(GAME, { mode }); e.autosave = false;
  const st = structuredClone(e.state) as NodeState;
  for (const d of LEVEL_DEFS) { if (d.id === id) break; st.progress.tickets[d.id] = { ...newTicketProgress(), passed: true, stars: 1 }; }
  e.setState(st);
  expect(e.act('openTicket', [id]).ok).toBe(true);
  return e;
}
const wallet = (e: Engine<NodeState>, minor: number, upgrades: string[] = []) => { const st = structuredClone(e.state) as NodeState; st.progress.wallet = minor; st.progress.upgrades = upgrades; e.setState(st); };
const tools = (e: Engine<NodeState>) => e.q('tools', []) as { id: string; name: string; what: string; price: number; priceText: string; owned: boolean }[];

describe('the bench tool ladder (0.7)', () => {
  it('lists three tools in price order, each with a name, what it does and a price', () => {
    const e = open('1-3');
    const t = tools(e);
    expect(t.map((x) => x.id)).toEqual(['condition-dial', 'thermal-camera', 'scope-ch2']);
    expect(t.map((x) => x.price)).toEqual([...t.map((x) => x.price)].sort((a, b) => a - b));
    for (const x of t) { expect(x.name.length).toBeGreaterThan(3); expect(x.what.length).toBeGreaterThan(10); expect(x.priceText).toMatch(/^\$\d+\.\d\d$/); expect(x.owned).toBe(false); }
  });
  it('the camera and the second channel are bought like the dial: refused with the price when short, once, from the wallet', () => {
    const e = open('1-3');
    for (const id of ['thermal-camera', 'scope-ch2']) {
      const price = tools(e).find((x) => x.id === id)!.price;
      wallet(e, price - 1);
      const no = e.act('buyUpgrade', [id]);
      expect(no.ok).toBe(false); expect(no.message).toContain(tools(e).find((x) => x.id === id)!.priceText);
      wallet(e, price + 100);
      expect(e.act('buyUpgrade', [id]).ok).toBe(true);
      expect((e.state as NodeState).progress.wallet).toBe(100);
      expect(tools(e).find((x) => x.id === id)!.owned).toBe(true);
      expect(e.act('buyUpgrade', [id]).ok).toBe(false);
    }
    expect(e.act('buyUpgrade', ['laser-sword']).ok).toBe(false);
  });
  it('1-3: the ticket offers the thermal camera only once it is bought (chapter 4 always has it)', () => {
    const e = open('1-3');
    expect((e.q('ticketCard', []) as any).camera).toBe(false);
    wallet(e, 0, ['thermal-camera']);
    expect((e.q('ticketCard', []) as any).camera).toBe(true);
    expect((open('4-3').q('ticketCard', []) as any).camera).toBe(true);
  });
  it('the sandbox has every tool for nothing', () => {
    const e = new Engine(GAME, { mode: 'sandbox' }); e.autosave = false;
    expect(tools(e).every((x) => x.owned)).toBe(true);
  });
});
