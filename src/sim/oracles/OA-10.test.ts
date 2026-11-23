import { describe, expect, it } from 'vitest';
import { parseNetlist } from '../mna/netlist';
import { sine } from '../mna/waveforms';
import { tranNetlist } from './tranUtil';
import { acCards, mag, nearDeg, phaseDeg } from './acUtil';
import { near } from './util';
import { partModel, rails } from './oaUtil';
import { tl072 } from '../../data/parts/ics';
// Chapter 6-1 (Mic Preamp): inverting amplifier Rin 10k, Rf 470k, TL072 on ±12 V, 10 mV peak at 1 kHz.
// Hand: TL072 A0 2e5, GBW 5.25 MHz (SLOS080W §5.8), so the open-loop pole is fp = GBW/A0 = 26.25 Hz and A(jf) = A0/(1 + jf/fp).
//   Noise gain NG = 1 + 470/10 = 48. H = −47 / (1 + NG/A) with NG/A = 48/2e5 + j·48·1000/5.25e6 = 2.4e-4 + j·9.1429e-3,
//   |1 + NG/A| = 1.000282, so |H| = 46.9868 and the phase is −180° − 0.524°. Out peak = 0.469868 V, far inside the ±10.5 V swing.
//   (Ro 75 Ω [E] sees 470k: a 1.6e-4 loss of loop gain, < 1e-6 on |H|.)
const AMP = 'R1 in inv 10k\nRf out inv 470k\nU1 0 inv out vp vn m' + rails(12) + partModel(tl072);
describe('OA-10 inverting gain −47 (10k / 470k), TL072 macro, ±12 V, 1 kHz', () => {
  it('AC: |H(1 kHz)| 46.987 at −180.52°', () => {
    const h = acCards('V1 in 0 0 ac 1\n' + AMP).solve(1e3).transfer('out', 'in');
    near(mag(h), 46.9868, 1e-4);
    nearDeg(phaseDeg(h) < 0 ? phaseDeg(h) + 360 : phaseDeg(h), 180 - 0.524, 0.02);
  });
  it('transient: 10 mV peak in gives 0.4699 V peak out, inverted', () => {
    const nl = parseNetlist('V1 in 0 0\n' + AMP);
    nl.elements = nl.elements.map((e) => (e.id === 'V1' ? { ...e, wave: sine(0.01, 1e3) } : e));
    const r = tranNetlist(nl, { h: 1e-6, tStop: 4e-3, probes: ['v(out)'] });
    near(Math.max(...r.y('v(out)').filter((_, k) => r.t[k] > 2e-3)), 0.469868, 1e-3);
    near(r.at('v(out)', 3.25e-3), -0.469868 * Math.cos(0.524 / 57.29578), 2e-3);   // input peak at 3.25 ms; output trough lags 0.52°
  });
  // Fail state of 6-1: the feedback goes to the + input (Rin and Rf to +, − to ground). Positive feedback: β = 10/480, loop gain β·A0 ≈ 4200 > 1,
  // so the output runs to a rail within microseconds (growth rate β·2π·GBW ≈ 6.9e5 /s) and stays there: the swing limit is V+ − 1.5 V = 10.5 V.
  // To flip back the input would have to reach 10.5·10k/470k = 0.223 V; the 10 mV signal never does, so the output is a flat 10.5 V.
  it('feedback to the + input latches the output to a rail (10.5 V) and the 10 mV signal never moves it', () => {
    const nl = parseNetlist('V1 in 0 0\nR1 in ip 10k\nRf out ip 470k\nU1 ip 0 out vp vn m' + rails(12) + partModel(tl072));
    nl.elements = nl.elements.map((e) => (e.id === 'V1' ? { ...e, wave: sine(0.01, 1e3) } : e));
    const r = tranNetlist(nl, { h: 1e-6, tStop: 4e-3, probes: ['v(out)'] });
    const y = r.y('v(out)').filter((_, k) => r.t[k] > 1e-4);
    for (const v of y) near(Math.abs(v), 10.5, 2e-3);
    expect(new Set(y.map(Math.sign)).size).toBe(1);
  });
});
