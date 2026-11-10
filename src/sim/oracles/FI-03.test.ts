import { describe, it } from 'vitest';
describe('FI-03 Sallen-Key low-pass unity gain, 10k/10k, C1 20 nF, C2 10 nF', () => {
  // Needs the op-amp macro (another task). Enable when it lands.
  it.todo('fc 1125.4 Hz; Q 0.70711; |H(fc)| 0.70711 at −90°; |H(10fc)| −40.00 dB');
});
