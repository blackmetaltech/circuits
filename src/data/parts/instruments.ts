// Bench instruments (DESIGN §4.4). Game instruments are NOT catalogue parts: they have no datasheet, never go in a ticket bin and carry no price,
// so they live here as plain data (a separate list from PARTS), each marked with where its numbers come from. Values are SI.
export interface InstrumentDef {
  id: 'inst-psu' | 'inst-fgen' | 'inst-dmm' | 'inst-probe';
  nameKey: string;
  /** Every number below is a game definition ("game instrument") or a typical handheld value [R]; none is a datasheet number. */
  basis: 'game-defined' | 'typical-handheld-R' | 'probe-convention';
  model: Record<string, number>;
}

export const INSTRUMENTS: InstrumentDef[] = [
  { id: 'inst-psu', nameKey: 'part.inst-psu.name', basis: 'game-defined',
    model: { vMin: 0, vMax: 15, iLimMin: 0, iLimMax: 1, vStep: 0.01, iStep: 1e-3 } },
  { id: 'inst-fgen', nameKey: 'part.inst-fgen.name', basis: 'game-defined',
    model: { fMin: 0.1, fMax: 1e6, vppMin: 0, vppMax: 10, rOut: 50 } },
  { id: 'inst-dmm', nameKey: 'part.inst-dmm.name', basis: 'typical-handheld-R',
    model: { rinVolts: 10e6, burdenAmps: 0.1, burdenAmps10A: 0.01, fuseAmps: 0.4, ohmsTestCurrent: 1e-3 } },
  { id: 'inst-probe', nameKey: 'part.inst-probe.name', basis: 'probe-convention', model: { rin: 10e6 } },
];
