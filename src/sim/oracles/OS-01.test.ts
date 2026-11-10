import { describe, expect, it } from 'vitest';
import { tranCards, crossing } from './tranUtil';
import { near } from './util';
// 555 astable R1 1k, R2 10k, C 10 nF, 5 V (dt ≤ 0.2 µs, skip 3 cycles)
describe('OS-01 555 astable R1 1k, R2 10k, C 10 nF, 5 V', () => {
  it('f 6870.0 Hz ±1 %; duty 52.381 % (cross-checked)', () => {
    const r = tranCards('V1 vcc 0 5\nR1 vcc d 1k\nR2 d t 10k\nC1 t 0 10n\nU1 0 t out vcc cv t d vcc ne555\n.model ne555 555 ()', { h: 2e-7, tStop: 2.2e-3, probes: ['v(out)'] });
    const y = r.y('v(out)'), th = 2.5, up: number[] = [], dn: number[] = [];
    for (let k = 1; k < y.length; k++) {
      if (y[k - 1] < th && y[k] >= th) up.push(r.t[k - 1] + ((th - y[k - 1]) / (y[k] - y[k - 1])) * (r.t[k] - r.t[k - 1]));
      if (y[k - 1] >= th && y[k] < th) dn.push(r.t[k - 1] + ((th - y[k - 1]) / (y[k] - y[k - 1])) * (r.t[k] - r.t[k - 1]));
    }
    const u = up.slice(3);
    expect(u.length).toBeGreaterThan(8);
    const f = (u.length - 1) / (u[u.length - 1] - u[0]);
    near(f, 6870.0, 0.01);
    const d = dn.find((t) => t > u[0])!;
    near((d - u[0]) / (u[1] - u[0]), 0.52381, 0.01);
    void crossing;
  });
});
