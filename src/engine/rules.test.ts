// Unit tests of the engine's pure helpers: quantisation, wire normalisation, value snapping, ordering, prices per region, and string coverage.
import { describe, expect, it } from 'vitest';
import { Engine, Env, play } from '@core/kit';
import { GAME } from '../game';
import { i18n } from '../i18n';
import { REGIONS } from '../regions';
import { partById } from '../data/parts';
import { allowedValues, nextId, normalisePath, snapValue, sortParts, uidCmp } from './board';
import { q, snap125 } from './quant';
import { boardMetrics, partPrice } from './metrics';
import { refBoard } from './tickets';
import { LEVEL_DEFS } from '../data/levels';

describe('quantisation (DESIGN §8.4)', () => {
  it('pot alpha to 1/1000, supply to 10 mV / 1 mA, jockey to 0.1 mm, generator to 3 significant figures', () => {
    expect(q.alpha(0.12345)).toBe(0.123); expect(q.volts(4.996)).toBe(5); expect(q.amps(0.12345)).toBe(0.123); expect(q.mm(12.345)).toBe(12.3);
    expect(q.sig3(1234.5)).toBe(1230); expect(q.sig3(0.0123456)).toBe(0.0123);
  });
  it('1-2-5 snapping stays inside its range and picks the nearest by ratio', () => {
    expect(snap125(0.0013, 1e-6, 1)).toBe(0.001); expect(snap125(0.0016, 1e-6, 1)).toBe(0.002); expect(snap125(3.4, 1e-3, 50)).toBe(5); expect(snap125(2e-9, 1e-6, 1)).toBe(1e-6);
  });
});

describe('board helpers', () => {
  it('wire paths lose collinear middle points (one encoding per wire)', () => {
    expect(normalisePath([[0, 0], [0, 2], [0, 5], [3, 5], [6, 5]])).toEqual([[0, 0], [0, 5], [6, 5]]);
    expect(normalisePath([[1, 1], [4, 1]])).toEqual([[1, 1], [4, 1]]);
  });
  it('uids sort numerically, fixed fixtures first, and ids are never reused while a higher one exists', () => {
    expect(['p10', 'p2', 'f1', 'p1'].sort(uidCmp)).toEqual(['f1', 'p1', 'p2', 'p10']);
    expect(nextId('p', ['p1', 'p3'])).toBe('p4'); expect(nextId('w', [])).toBe('w1');
    const b = { parts: [{ uid: 'p10' }, { uid: 'p2' }] } as any; sortParts(b); expect(b.parts.map((p: any) => p.uid)).toEqual(['p2', 'p10']);
  });
  it('values snap to the allowed list or name the neighbours; E12 filters the E24 catalogue', () => {
    const d = partById('res-cf'), e12 = allowedValues(d, { partId: 'res-cf', values: 'E12' })!;
    expect(e12).toContain(470); expect(e12).not.toContain(510); expect(e12.length).toBeLessThan(d.values!.length);
    expect(snapValue(d, e12, 470.0000001)).toEqual({ value: 470 });
    expect(snapValue(d, e12, 500)).toMatchObject({ key: 'err.value.notAllowed' }); expect(snapValue(d, e12, -1)).toMatchObject({ key: 'err.value.number' }); expect(snapValue(d, e12, NaN)).toMatchObject({ key: 'err.value.number' });
  });
});

describe('metrics and prices per region', () => {
  it('cost of the ref in each pack is the pack price table (in = global x 84); integers', () => {
    for (const [id, f] of [['global', 1], ['in', 84], ['na', 1]] as const) {
      const m = boardMetrics(refBoard(LEVEL_DEFS[0]!), REGIONS.get(id)); expect(m.cost).toBe(5 * f); expect(Number.isInteger(m.cost)).toBe(true);
    }
  });
  it('electrolytics add the value surcharge scaled by the pack factor; unknown / free parts cost nothing', () => {
    const g = partPrice(REGIONS.get('global'), 'cap-el', '25V', 1000e-6), n = partPrice(REGIONS.get('in'), 'cap-el', '25V', 1000e-6);
    expect(g).toBe(7 + 11); expect(n).toBe(g * 84); expect(partPrice(REGIONS.get('global'), 'ideal-vsource', 'ideal', null)).toBe(0);
  });
  it('area is the bounding box in pads, 0 for an empty board; fixed parts are not counted', () => {
    const b = refBoard(LEVEL_DEFS[0]!); expect(boardMetrics({ ...b, parts: b.parts.filter((p) => p.fixed), wires: [] }, REGIONS.get('global')).area).toBe(0);
  });
});

describe('strings', () => {
  it('a persona run, errors and queries ask for no missing key or variable', () => {
    i18n.clearMissing();
    for (const persona of ['idle', 'expert', 'monkey']) { play(GAME, { persona, seed: 2, ticks: 25, level: '0-0' }); play(GAME, { persona, seed: 3, ticks: 15 }); }
    const e = new Engine(GAME); e.autosave = false; e.act('openTicket', ['0-0']);
    for (const q2 of ['board', 'netlist', 'nodes', 'currents', 'thermal', 'ratings', 'scope', 'meter', 'liveStatus', 'benchResult', 'failureLog', 'parts', 'tickets', 'ticketCard']) e.q(q2);
    e.act('hint'); e.act('hint'); e.act('hint'); e.act('runBench'); e.q('benchResult'); e.act('placePart', ['nope']); e.act('addWire', [[0, 0]]); e.act('setMeter', ['ohm']);
    const env = new Env(GAME); env.reset({ seed: 1, level: '0-0' }); env.legalActions(true);
    expect(i18n.missingKeys()).toEqual([]); expect(i18n.missingVars()).toEqual([]);
  });
});
