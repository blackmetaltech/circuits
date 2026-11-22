// The region seam: the whole game must run, stay consistent and keep every regional token to itself in EVERY registered pack
// (drafts and the test-only pack included). Adding a pack to src/regions/index.ts puts it under all of these checks automatically.
import { describe, expect, it } from 'vitest';
import { Engine, Env, checkAllLevels, play } from '@core/kit';
import { expectNoRegionLeaks, findRegionLeaks, formatMoney, rulesetId } from '@core/regions';
import { GAME } from './game';
import { REGIONS } from './regions';
import { PRICES_GLOBAL_CENTS } from './regions/global/prices';
import { derivePrices, formatMinor, validateNodeData, type NodeRegionData } from './regions/data';
import { LAWS } from './sim/laws';

const PACKS = REGIONS.list({ includeDrafts: true });
const CUSTOMERS = ['kid_torch', 'cyclist', 'aquarium', 'toycar', 'weather', 'irrigation', 'wallwart', 'radio', 'musician', 'maker', 'strip', 'robotics'];

/** Everything a player can see for one region: init data, the region query, the ticket card, progress, formatted money, the log. */
function render(pack: { id: string }) {
  const e = new Engine(GAME, { region: pack.id }); e.autosave = false;
  const { regions: _r, drafts: _d, ...init } = e.init() as any;
  const p = REGIONS.get(pack.id);
  const out: Record<string, unknown> = { init, region: e.q('region'), saves: e.saves.list(), progress0: e.q('progress'), card0: e.q('ticketCard') };
  e.act('openTicket', ['0-0']);
  out.card = e.q('ticketCard'); out.progress = e.q('progress'); out.snapshot = e.snapshot(); out.log = e.state.log;
  out.money = [formatMoney(1234.5, p), formatMoney(1234567, p, { compact: true }), formatMinor(250, p), formatMinor(123456789, p), ...Object.values(p.data.prices).slice(0, 5).map((c) => formatMinor(c, p))];
  const lv = new Env(GAME); lv.reset({ seed: 1, level: '0-0', region: pack.id });
  for (let i = 0; i < 10 && lv.state.status === 'playing'; i++) lv.step({ name: 'tick' });
  out.level = { q: lv.engine.q('level'), card: lv.engine.q('ticketCard'), reason: lv.state.statusReason, log: lv.state.log, code: lv.engine.q('solutionCode') };
  e.act('openTicket', ['nope']); out.bad = e.act('openTicket', ['nope']).message;
  return out;
}

describe('region packs of CIRCUITS', () => {
  it('there are three packs: global ships (default), in is a draft, na is a test-only draft', () => {
    expect(REGIONS.ids()).toEqual(['global', 'in', 'na']);
    expect(REGIONS.defaultId).toBe('global');
    expect(REGIONS.get('global').status).toBe('shipping'); expect(REGIONS.get('in').status).toBe('draft'); expect(REGIONS.get('na').status).toBe('draft');
    const init = new Engine(GAME).init() as any;
    expect(init.regions.map((r: any) => r.id)).toEqual(['global']); expect(init.drafts.map((r: any) => r.id)).toEqual(['in', 'na']);
  });
  it('global: US$, western grouping, IEC 60038 mains 230 V 50 Hz +-10 %, IEC 60063 E-series, IEC 60384-14 X2, Wren at Stall 14, Lantern Lane', () => {
    const g = REGIONS.get('global');
    expect(g.currency.code).toBe('USD'); expect(g.currency.symbol).toBe('$'); expect(g.numbers.grouping).toBe('western');
    expect(g.data.mains).toEqual({ volts: 230, hz: 50, tolerance: 0.1 });
    expect(Object.values(g.standards).join(' | ')).toMatch(/IEC 60038/); expect(Object.values(g.standards).join(' | ')).toMatch(/IEC 60063/); expect(Object.values(g.standards).join(' | ')).toMatch(/IEC 60384-14 X2/);
    expect(g.strings).toMatchObject({ stall: 'Stall 14', lane: 'Lantern Lane', mentor: 'Wren', cat: 'Rezzy' });
    expect(g.data.examBridge.set).toBe('global');
    expect(g.data.prices).toBe(PRICES_GLOBAL_CENTS);
    const names = CUSTOMERS.map((c) => g.strings[`customer.${c}`]);
    expect(names).toEqual(['Lio', 'Ash', 'Mr. Brook', 'Bo', 'Kaya', 'Sami', 'Mrs. Dale', 'Iris', 'Juno', 'Kit', 'Tess', 'Dev']);
  });
  it('in: rupees with Indian grouping, 230 V 50 Hz, its own names; na: 120 V 60 Hz, US$', () => {
    const n = REGIONS.get('in'), a = REGIONS.get('na');
    expect(n.currency.symbol).toBe('₹'); expect(n.numbers.grouping).toBe('indian'); expect(n.data.mains).toEqual({ volts: 230, hz: 50, tolerance: 0.1 });
    expect(n.strings).toMatchObject({ lane: 'Signal Gully', mentor: 'Meera Aunty', stall: 'Stall 14' });
    expect(formatMinor(123456789, n)).toBe('₹12,34,567.89');
    expect(a.currency.code).toBe('USD'); expect(a.data.mains).toEqual({ volts: 120, hz: 60, tolerance: 0.1 });
    expect(formatMinor(123456789, REGIONS.get('global'))).toBe('$1,234,567.89');
  });
  it('prices: in = global x 84 (paise per cent), na = global; always integers', () => {
    expect(derivePrices({ 'a:b': 7, 'c:d': 100 }, 84)).toEqual({ 'a:b': 588, 'c:d': 8400 });
    for (const [k, c] of Object.entries(PRICES_GLOBAL_CENTS)) { expect(REGIONS.get('in').data.prices[k]).toBe(c * 84); expect(REGIONS.get('na').data.prices[k]).toBe(c); }
    expect(() => derivePrices({ x: 1 }, 0.5)).toThrow(/integer/);
  });
  it('no pack touches the physics: every pack carries the engine constant, and a tampered pack is rejected', () => {
    for (const p of PACKS) expect(p.data.vtAt300K, p.id).toBe(LAWS.vtAt300K);
    const good: NodeRegionData = REGIONS.get('global').data;
    expect(validateNodeData(good)).toEqual([]);
    const bad = (patch: object) => validateNodeData({ ...good, ...patch } as any).join(' | ');
    expect(bad({ vtAt300K: 0.026 })).toMatch(/vtAt300K must be 0\.025852/);
    expect(bad({ mains: { volts: -230, hz: 50, tolerance: 0.1 } })).toMatch(/mains\.volts/);
    expect(bad({ mains: { volts: 0, hz: 50, tolerance: 0.1 } })).toMatch(/mains\.volts/);
    expect(bad({ mains: { volts: 230, hz: 55, tolerance: 0.1 } })).toMatch(/mains\.hz/);
    expect(bad({ mains: { volts: 230, hz: 50, tolerance: 0.5 } })).toMatch(/mains\.tolerance/);
    expect(bad({ mains: { volts: 230, hz: 50, tolerance: -0.01 } })).toMatch(/mains\.tolerance/);
    expect(bad({ prices: { 'r:1': -1 } })).toMatch(/prices\['r:1'\]/);
    expect(bad({ prices: { 'r:1': 1.5 } })).toMatch(/prices\['r:1'\]/);
    expect(bad({ g: 9.9 })).toMatch(/unknown field 'g'/);          // a pack may not smuggle in a constant of nature
    expect(bad({ boltzmann: 1 })).toMatch(/unknown field 'boltzmann'/);
    expect(validateNodeData(null as any)).toEqual(['must be an object']);
    // the registry applies the validator on register
    expect(() => REGIONS.register({ ...REGIONS.get('na'), id: 'xx', data: { ...good, vtAt300K: 0.03 } } as any)).toThrow(/vtAt300K/);
  });
  it.each(PACKS.map((p) => [p.id]))('region %s: the game starts in the pack, opens ticket 0-0 and plays without violations', (id) => {
    const e = new Engine(GAME, { region: id! });
    expect(e.state.region).toBe(id); expect(e.state.ruleset).toBe(rulesetId(GAME.id, REGIONS.get(id!), GAME.rulesetVersion ?? 1));
    expect(e.state.ticket).toBeNull();
    expect(e.act('openTicket', ['0-0']).ok).toBe(true);
    const card = e.q('ticketCard') as any;
    expect(card.customer).toBe(REGIONS.get(id!).strings['customer.kid_torch']); expect(card.stall).toBe(REGIONS.get(id!).strings.stall); expect(card.mentor).toBe(REGIONS.get(id!).strings.mentor);
    expect(e.act('closeTicket').ok).toBe(true);
    expect(play(GAME, { persona: 'idle', seed: 2, ticks: 20, region: id }).violations, id).toEqual([]);
    // every level (the sample ticket 0-0 and chapter 1) is solvable in every pack, idle does not pass, and nothing degenerate wins
    const reports = checkAllLevels(GAME, { seed: 1, region: id });
    expect(reports.map((r) => r.level)).toEqual(['0-0', '1-1', '1-2', '1-3', '1-4', '1-5', '2-1', '2-2', '2-3', '2-4', '3-1', '3-2', '3-3', '3-4', '4-1', '4-2', '4-3', '4-4', '4-5', '5-1', '5-2', '5-3', '5-4', '5-5']);
    for (const r of reports) expect(r.problems, r.level).toEqual([]);
  });
  it('mains differ by pack but physics-facing engine data does not', () => {
    expect(PACKS.map((p) => [p.id, p.data.mains.volts, p.data.mains.hz])).toEqual([['global', 230, 50], ['in', 230, 50], ['na', 120, 60]]);
  });
  it('no regional token leaks between packs (init, region query, ticket card, progress, formatted money, snapshot, log, level, code)', () => {
    expectNoRegionLeaks(PACKS, render);
  });
  it('the leak test is live: it would catch a planted leak', () => {
    const hits = findRegionLeaks(PACKS, (p) => (p.id === 'global' ? { ...render(p), oops: `${formatMoney(5, REGIONS.get('in'))} at Signal Gully with Meera Aunty` } : render(p)));
    const m = hits.map((h) => h.marker);
    expect(m).toContain('₹'); expect(m).toContain('Signal Gully'); expect(m).toContain('Meera Aunty');
  });
  it('unknown regions teach', () => {
    expect(() => new Engine(GAME, { region: 'mars' })).toThrow(/Unknown region 'mars'.*global, in, na/);
    expect(new Engine(GAME).act('newGame', [1, 'learner', 'mars']).message).toMatch(/Available regions: global, in, na/);
  });
});
