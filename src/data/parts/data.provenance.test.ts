import { describe, expect, it } from 'vitest';
import { dmath } from '@core/numerics';
import { PARTS, partById, findPart, nearMatches, CAMPAIGN_BLOCKERS } from './index';
import { partsEn } from '../../locales/parts.en';
import { eseries } from '../eseries';
import type { PartDef } from './types';

const VT = 0.025852; // DESIGN §3.3, 300 K
const campaign = PARTS.filter((p) => p.scope === 'campaign');

/** Solve V = N·Vt·ln(I/Is + 1) + I·Rs for the diode voltage at current i. */
function vf(m: Record<string, number>, i: number): number {
  return m.N * VT * dmath.log(i / m.Is + 1) + i * m.Rs;
}

describe('catalogue provenance (DESIGN §4.0)', () => {
  it('has unique part ids and variant ids, and at least one variant each', () => {
    const ids = PARTS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of PARTS) {
      expect(p.variants.length).toBeGreaterThan(0);
      const v = p.variants.map((x) => x.id);
      expect(new Set(v).size, p.id).toBe(v.length);
    }
  });

  it('every campaign part is verified and carries doc + url + accessed (definitional parts need only a doc)', () => {
    expect(campaign.length).toBeGreaterThan(20);
    for (const p of campaign) {
      expect(p.verified, `${p.id} must be verified`).toBe(true);
      expect(p.source.doc.length, p.id).toBeGreaterThan(5);
      if (p.source.definition) continue;
      expect(p.source.url, `${p.id} url`).toMatch(/^https:\/\//);
      expect(p.source.accessed, `${p.id} accessed`).toMatch(/^\d{4}-\d\d-\d\d$/);
    }
  });

  it('every non-verified part is sandbox-only and says so in source.note', () => {
    for (const p of PARTS.filter((x) => !x.verified)) {
      expect(p.scope, p.id).toBe('sandbox');
      expect(p.source.note ?? '', p.id).toMatch(/unverified|UNVERIFIED/);
    }
  });

  it('game-defined level fixtures are labelled as such (GAME-DEFINED note + doc, codex-note key) and stay sandbox-only and unverified', () => {
    const fixtures = PARTS.filter((p) => p.source.gameFixture);
    expect(fixtures.map((p) => p.id)).toContain('xfmr-12');
    for (const p of fixtures) {
      expect(p.source.doc, p.id).toContain('GAME-DEFINED');
      expect(p.source.note ?? '', p.id).toContain('GAME-DEFINED');
      expect(p.verified, p.id).toBe(false);
      expect(p.scope, p.id).toBe('sandbox');
      expect((p.simplifications ?? []).some((k) => /fixture/.test(k)), `${p.id} codex-note key`).toBe(true);
    }
  });

  it('every nameKey, description and simplification key exists in parts.en.ts', () => {
    for (const p of PARTS) {
      expect(partsEn[p.nameKey], p.nameKey).toBeTruthy();
      expect(p.nameKey).toBe(`part.${p.id}.name`);
      expect(partsEn[`part.${p.id}.desc`], `${p.id} desc`).toBeTruthy();
      for (const s of p.simplifications ?? []) expect(partsEn[s], s).toBeTruthy();
    }
  });

  it('keeps thermal data sane: tFail > tMax > 25, thetaJA and tauS positive, [R] on every tau note', () => {
    for (const p of PARTS) {
      for (const v of p.variants) {
        expect(v.thermal.thetaJA, `${p.id}:${v.id}`).toBeGreaterThan(0);
        expect(v.thermal.tauS).toBeGreaterThan(0);
        expect(v.thermal.tMax).toBeGreaterThan(25);
        expect(v.thermal.tFail).toBeGreaterThan(v.thermal.tMax);
      }
      expect(p.source.note ?? '', p.id).toContain('[R]');
    }
  });

  it('keeps every model and rating number finite, and in a plausible range per kind', () => {
    for (const p of PARTS) {
      for (const [k, x] of Object.entries(p.model)) expect(Number.isFinite(x), `${p.id}.model.${k}`).toBe(true);
      for (const v of p.variants) for (const [k, x] of Object.entries(v.ratings)) expect(Number.isFinite(x), `${p.id}:${v.id}.${k}`).toBe(true);
      for (const x of p.values ?? []) expect(x).toBeGreaterThan(0);
      const m = p.model;
      if (['D', 'LED', 'Z', 'SCHOTTKY'].includes(p.kind) && m.Is !== undefined) {
        expect(m.Is, p.id).toBeGreaterThan(1e-20);
        expect(m.Is, p.id).toBeLessThan(1e-6);
        expect(m.N, p.id).toBeGreaterThanOrEqual(1);
        expect(m.N, p.id).toBeLessThanOrEqual(3);
        expect(m.Rs, p.id).toBeGreaterThanOrEqual(0);
        expect(m.Rs, p.id).toBeLessThan(100);
      }
      if (p.kind === 'Z') {
        expect(m.BV, p.id).toBeGreaterThan(1);
        expect(m.Ibv, p.id).toBeGreaterThan(0);
      }
      if (p.kind === 'NPN' || p.kind === 'PNP') {
        expect(m.Is, p.id).toBeGreaterThan(1e-20);
        expect(m.Is, p.id).toBeLessThan(1e-9);
        expect(m.Bf, p.id).toBeGreaterThanOrEqual(10);
        expect(m.Bf, p.id).toBeLessThanOrEqual(2000);
        expect(m.Vaf, p.id).toBeGreaterThan(0);
        for (const v of p.variants) expect(v.ratings.Vceo, p.id).toBeGreaterThan(0);
      }
      if (p.kind === 'DARLINGTON') {
        expect(m.hFEmin, p.id).toBeGreaterThanOrEqual(10);
        for (const v of p.variants) expect(v.ratings.Vceo, p.id).toBeGreaterThan(0);
      }
      if (p.kind === 'NMOS') {
        expect(m.Vt, p.id).toBeGreaterThan(0);
        expect(m.Vt, p.id).toBeLessThan(6);
        expect(m.Kp, p.id).toBeGreaterThan(1e-3);
        expect(m.Kp, p.id).toBeLessThan(100);
        expect(m.lambda, p.id).toBeGreaterThanOrEqual(0);
        for (const v of p.variants) expect(v.ratings.Vds, p.id).toBeGreaterThan(0);
      }
      if (p.kind === 'OPAMP') {
        expect(m.GBW, p.id).toBeGreaterThan(1e4);
        expect(m.GBW, p.id).toBeLessThan(1e9);
        expect(m.SR, p.id).toBeGreaterThan(1e4);
        expect(m.SR, p.id).toBeLessThan(1e9);
        expect(m.vccMax, p.id).toBeGreaterThan(m.vccMin);
      }
      if (p.kind === 'R') for (const v of p.variants) expect(v.ratings.P ?? 1, p.id).toBeGreaterThan(0);
    }
  });

  it('keeps the E-series value lists of valued families (ordered, within the datasheet range)', () => {
    for (const p of PARTS.filter((x) => x.values)) {
      const v = p.values!;
      for (let i = 1; i < v.length; i++) expect(v[i], p.id).toBeGreaterThan(v[i - 1]);
    }
    expect(partById('res-cf').values).toEqual(expect.arrayContaining(eseries('E12', 10, 1e6)));
    expect(partById('res-mf').values!.length).toBe(121);
    expect(partById('res-ww5').values).toEqual(eseries('E12', 1, 100));
  });
});

describe('red LED refit (REVIEW E1): N 2.0, Is 1.19e-17 A, Rs 9.9 ohm, Kingbright WP7113ID DSAF0012', () => {
  const led = partById('led-red-5mm');
  it('pins the review numbers exactly', () => {
    expect(led.model).toMatchObject({ N: 2.0, Is: 1.19e-17, Rs: 9.9 });
    expect(led.kind).toBe('LED');
    expect(led.variants[0].ratings).toMatchObject({ IF: 0.03, IFP: 0.16, VR: 5, PD: 0.075 });
  });
  it('reproduces the datasheet curve within 0.03 V', () => {
    expect(Math.abs(vf(led.model, 2e-3) - 1.7)).toBeLessThan(0.03);
    expect(Math.abs(vf(led.model, 10e-3) - 1.9)).toBeLessThan(0.03);
    expect(Math.abs(vf(led.model, 20e-3) - 2.0)).toBeLessThan(0.03);
  });
  it('other colours are sandbox-only and unverified', () => {
    for (const c of ['yellow', 'green', 'blue', 'white']) {
      const p = partById(`led-${c}-5mm`);
      expect(p.scope).toBe('sandbox');
      expect(p.verified).toBe(false);
    }
  });
});

describe('re-sourced SPICE model lines (REVIEW 1.5)', () => {
  it('1N4007 equals the Vishay-published model line (doc 89789): Is 1.43733e-8, N 1.80829, Rs 0.0414712, BV 1100', () => {
    const p = partById('1n4007');
    expect(p.model).toMatchObject({ Is: 1.43733e-8, N: 1.80829, Rs: 0.0414712, BV: 1100, Ibv: 10 });
    expect(p.source.note).toContain('.model d1n4007 d is = 1.43733E-008 n = 1.80829 rs = 0.0414712');
    expect(p.source.note).toContain('https://www.vishay.com/docs/89789/1n4007.txt');
    expect(p.verified).toBe(true);
  });
  it('2N3904 takes Is, Vaf, Br from the Fairchild datasheet model line; Bf is the 100-300 midpoint', () => {
    const p = partById('2n3904');
    expect(p.model).toMatchObject({ Is: 6.734e-15, Vaf: 74.03, Br: 0.7371, Bf: 200 });
    expect(p.tolerance?.Bf).toEqual([100, 300]);
    expect(p.source.note).toContain('NPN (Is=6.734f Xti=3 Eg=1.11 Vaf=74.03 Bf=416.4');
    expect(p.verified).toBe(true);
  });
  it('1N5819 is fitted to the datasheet: 0.60 V at 1 A and 0.90 V at 3.1 A (Vishay 88525 maxima), residuals shown', () => {
    const p = partById('1n5819');
    const r1 = vf(p.model, 1.0) - 0.6;
    const r2 = vf(p.model, 3.1) - 0.9;
    expect(Math.abs(r1)).toBeLessThan(0.002);
    expect(Math.abs(r2)).toBeLessThan(0.002);
    expect(p.model.N).toBe(1.3);
    // the old 0.45 V fit (REVIEW E12) must be gone: at 1 A the model is NOT near 0.45 V
    expect(vf(p.model, 1.0)).toBeGreaterThan(0.55);
  });
  it('1N4148 is fitted to the Vishay 81857 Fig. 1 curve at 25 C (graph read, residual <= 0.02 V)', () => {
    const p = partById('1n4148');
    const read: [number, number][] = [[1e-4, 0.5], [1e-3, 0.61], [1e-2, 0.73], [1e-1, 0.875]];
    for (const [i, v] of read) expect(Math.abs(vf(p.model, i) - v)).toBeLessThan(0.02);
    expect(vf(p.model, 10e-3)).toBeLessThan(1.0); // datasheet maximum VF 1 V at 10 mA
  });
});

describe('teaching lookup', () => {
  it('partById finds parts and throws a teaching error with near matches on unknown ids', () => {
    expect(partById('2n3904').id).toBe('2n3904');
    expect(findPart('nope')).toBeUndefined();
    expect(nearMatches('2n3094')).toContain('2n3904');
    expect(() => partById('2n3094')).toThrow(/2n3904/);
    expect(() => partById('res')).toThrow(/res-cf/);
  });
});

describe('every part a DESIGN bin names exists (ch1 + 4-1)', () => {
  const has = (id: string) => expect(findPart(id), id).toBeDefined();
  const vals = (id: string, wanted: number[]) => { for (const w of wanted) expect(partById(id).values, `${id} ${w}`).toContain(w); };
  const variants = (id: string, wanted: string[]) => { const have = partById(id).variants.map((v) => v.id); for (const w of wanted) expect(have, `${id} ${w}`).toContain(w); };

  it('1-1 Torch: red LED, res-cf 100/220/470/1k at 1/4 W, PP3 battery', () => {
    has('led-red-5mm'); has('bat-pp3');
    vals('res-cf', [100, 220, 470, 1000]); variants('res-cf', ['0.25W']);
  });
  it('1-2 Tail-light: 3 red LEDs + E12 (150 ohm reference), PP3 fresh and tired', () => {
    vals('res-cf', eseries('E12', 10, 1e6)); has('bat-pp3-tired');
  });
  it('1-3 Hot Resistor: 22/27/47/51/100 ohm at 1/4, 1/2, 1 W; 50 ohm heater element', () => {
    vals('res-cf', [22, 27, 47, 51, 100]); variants('res-cf', ['0.25W', '0.5W', '1W']); has('heater');
  });
  it('1-4 Tired Battery: 2.2-10 ohm E12 in 1 W and 5 W', () => {
    vals('res-cf', [2.2, 2.7, 3.3, 3.9, 4.7, 5.6, 6.8, 8.2, 10]); variants('res-cf', ['1W']);
    vals('res-ww5', [2.2, 2.7, 3.3, 3.9, 4.7, 5.6, 6.8, 8.2, 10]); variants('res-ww5', ['5W']);
  });
  it('1-5 EB textbook bin: ideal sources and exact resistors', () => { has('ideal-vsource'); has('ideal-isource'); has('res-exact'); });
  it('4-1 Wall Wart: 1N4007, 1N4148, electrolytics 220-4700 uF at 10/16/25/35 V, 12 V transformer with 1.5 ohm winding', () => {
    has('1n4007'); has('1n4148');
    vals('cap-el', [220e-6, 330e-6, 470e-6, 680e-6, 1000e-6, 1500e-6, 2200e-6, 3300e-6, 4700e-6]); variants('cap-el', ['10V', '16V', '25V', '35V']);
    const x = partById('xfmr-12');
    expect(x.model).toMatchObject({ secRms: 12, Rw: 1.5, Lm: 10, VA: 6, primaryNominal: 230 });
  });
});

describe('CAMPAIGN_BLOCKERS: parts a must-ship ticket needs but this task could not verify', () => {
  it('lists only existing, sandbox-only, unverified parts with a reason', () => {
    expect(CAMPAIGN_BLOCKERS.length).toBeGreaterThan(0);
    for (const b of CAMPAIGN_BLOCKERS) {
      const p: PartDef = partById(b.partId);
      expect(p.verified, b.partId).toBe(false);
      expect(p.scope, b.partId).toBe('sandbox');
      expect(b.tickets.length).toBeGreaterThan(0);
      expect(b.reason.length).toBeGreaterThan(10);
    }
  });
});
