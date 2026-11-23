// Op-amp and comparator catalogue rows pinned to the datasheet tables (layer 0.7 audit for chapter 6, Op-Amp Alley). Each expectation names the
// table it was read from; the PDFs are the revisions in each part's source.doc (TI SNOSC25D, SLOS068AB, SLOS080W, SLOS075K, SLCS005AH;
// Microchip DS20001733L), re-read 2026-11-24. Only the values a table prints are pinned here; the macro defaults that stand in for absent
// rows are engineering estimates and are listed in sim/mna/devices/macros.ts.
import { describe, expect, it } from 'vitest';
import { lm741, lm358, tl072, ne5532, mcp6002, lm393 } from './ics';
import { EXPANDERS, type ExpandCtx } from '../../sim/mna/netlist';
import type { PartDef } from './types';
import type { PlacedPart } from '../../sim/board/types';

const tjMax = (d: PartDef): number => d.variants[0].thermal!.tMax;
const absMax = (d: PartDef): number => d.variants[0].ratings.VsMaxAbs;
const chan = (d: PartDef) => EXPANDERS[d.kind === 'CMP' ? 'CMP' : 'OPAMP']!({ part: { uid: 'u', partId: d.id, value: null, variant: d.variants[0].id, x: 0, y: 0, rot: 0, flip: false } as PlacedPart, def: d, nodes: [1, 2, 3, 4, 5, 6, 7, 8] } as ExpandCtx);
const pkgIq = (d: PartDef): number => chan(d).reduce((s, e) => s + e.p.iq, 0);

describe('LM741 (the PDIP part is the LM741C: TI orders it as LM741CN), SNOSC25D', () => {
  it('§6.1: supply ±18 V abs max, TJ max 100 °C (LM741C rows; ±22 V / 150 °C are the military LM741/LM741A)', () => {
    expect(absMax(lm741)).toBe(36); expect(tjMax(lm741)).toBe(100);
  });
  it('§6.3: recommended supply ±10 .. ±18 V (LM741C)', () => { expect(lm741.model.vccMin).toBe(20); expect(lm741.model.vccMax).toBe(36); });
  it('§6.7: AOL 200 V/mV typ, SR 0.5 V/µs, Rin 2 MΩ, Isc 25 mA, swing ±13 V into 2 kΩ at ±15 V, input range ±12 V min, supply current 1.7 mA typ', () => {
    expect(chan(lm741)[0].p).toMatchObject({ a0: 2e5, sr: 0.5e6, rin: 2e6, isc: 0.025, headhi: 2, headlo: 2 });
    expect(lm741.model).toMatchObject({ cmLo: 3, cmHi: 3 });
    expect(pkgIq(lm741)).toBeCloseTo(1.7e-3, 12);
  });
});

describe('LM358 (non-B), SLOS068AB', () => {
  it('§5.1 abs max 32 V; §5.3 recommended 3 .. 30 V', () => { expect(absMax(lm358)).toBe(32); expect(lm358.model.vccMin).toBe(3); expect(lm358.model.vccMax).toBe(30); });
  it('§5.7: AOL 100 V/mV typ, GBW 0.7 MHz, SR 0.3 V/µs, Isc ±40 mA typ, Iq 350 µA per amplifier typ (5 V), CM V− .. V+ − 1.5 V', () => {
    expect(chan(lm358)[0].p).toMatchObject({ a0: 1e5, gbw: 0.7e6, sr: 0.3e6, isc: 0.04 });
    expect(pkgIq(lm358)).toBeCloseTo(0.7e-3, 12);
    expect(lm358.model).toMatchObject({ cmLo: 0, cmHi: 1.5 });
  });
});

describe('TL072 (TL072CP: PDIP, not an NS / PS / M device), SLOS080W', () => {
  it('§5.1 abs max 42 V for "all other devices" (36 V is the NS / PS / M row); §5.3 recommended 4.5 .. 40 V', () => {
    expect(absMax(tl072)).toBe(42); expect(tl072.model.vccMin).toBe(4.5); expect(tl072.model.vccMax).toBe(40);
  });
  it('§5.8: AOL 200 V/mV typ (TL07xC), GBW 5.25 MHz, RID 1 TΩ, VOM ±13.5 V typ into 10 kΩ, VCM ±11 V min, IQ 1.4 mA per amplifier typ; §5.9 SR 20 V/µs typ', () => {
    expect(chan(tl072)[0].p).toMatchObject({ a0: 2e5, gbw: 5.25e6, sr: 20e6, rin: 1e12, headhi: 1.5, headlo: 1.5 });
    expect(pkgIq(tl072)).toBeCloseTo(2.8e-3, 12);
    expect(tl072.model).toMatchObject({ cmLo: 4, cmHi: 4, SRmin: 8e6 });
  });
  it('§5.7: the only short-circuit current SLOS080W prints is ±26 mA typ (TL07xH); the TL07xC table has none', () => { expect(chan(tl072)[0].p.isc).toBe(0.026); });
});

describe('NE5532, SLOS075K', () => {
  it('§5.1 supply ±18 V abs max (36 V; the revision history: 22 V changed to 18 V); §5.3 recommended ±5 .. ±15 V', () => {
    expect(absMax(ne5532)).toBe(36); expect(ne5532.model.vccMin).toBe(10); expect(ne5532.model.vccMax).toBe(30);
  });
  it('§5.5: AVD 100 V/mV typ (RL ≥ 2 kΩ), B1 12 MHz, ri 300 kΩ typ, IOS 38 mA, ICC 6 mA total typ, VICR ±12 V min; §5.6 SR 5 V/µs', () => {
    expect(chan(ne5532)[0].p).toMatchObject({ a0: 1e5, gbw: 12e6, sr: 5e6, rin: 3e5, isc: 0.038 });
    expect(pkgIq(ne5532)).toBeCloseTo(6e-3, 12);
    expect(ne5532.model).toMatchObject({ cmLo: 3, cmHi: 3 });
  });
});

describe('MCP6002, DS20001733L', () => {
  it('abs max VDD − VSS 7.0 V; supply 1.8 .. 6.0 V', () => { expect(absMax(mcp6002)).toBe(7); expect(mcp6002.model.vccMin).toBe(1.8); expect(mcp6002.model.vccMax).toBe(6); });
  it('DC table: AOL 112 dB typ, ZDIFF 1e13 Ω, swing VSS + 25 mV .. VDD − 25 mV, ISC ±23 mA (5.5 V), IQ 100 µA per amplifier typ; AC table: GBWP 1 MHz, SR 0.6 V/µs', () => {
    expect(chan(mcp6002)[0].p).toMatchObject({ gbw: 1e6, sr: 0.6e6, rin: 1e13, isc: 0.023, headhi: 0.025, headlo: 0.025 });
    expect(Math.abs(chan(mcp6002)[0].p.a0 / 10 ** (112 / 20) - 1)).toBeLessThan(1e-3);   // 112 dB = 3.981e5, given to 3 digits
    expect(pkgIq(mcp6002)).toBeCloseTo(2e-4, 12);
    expect(mcp6002.model).toMatchObject({ cmLo: -0.3, cmHi: -0.3 });
  });
});

describe('LM393 (non-B), SLCS005AH', () => {
  it('§5.1 abs max 36 V (non-B); §5.2 recommended 2 .. 30 V (non-V, non-B; 36 V is the B row)', () => { expect(absMax(lm393)).toBe(36); expect(lm393.model.vccMin).toBe(2); expect(lm393.model.vccMax).toBe(30); });
  it('§5.8: AVD 200 V/mV typ, ICC 0.45 mA typ at 5 V (LM393 column), VICR 0 .. VCC − 1.5 V; §5.11 response 1.3 µs', () => {
    expect(chan(lm393)[0].p).toMatchObject({ a0: 2e5, tresp: 1.3e-6 });
    expect(pkgIq(lm393)).toBeCloseTo(0.45e-3, 12);
    expect(lm393.model).toMatchObject({ cmLo: 0, cmHi: 1.5 });
  });
});
