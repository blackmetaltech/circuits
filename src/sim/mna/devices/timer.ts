// 555 timer macro (NE555, DESIGN §3.7). Kind 'TMR'. Terminals in catalogue order [GND, TRIG, OUT, RESET, CTRL, THR, DIS, VCC]; one internal node (the
// lower divider tap); state [q] (SR flip-flop output: 1 = OUT high, discharge switch off). Everything is referred to the GND pin.
//   divider    3 × 5 kΩ: VCC–CTRL, CTRL–mid, mid–GND. Upper threshold = v(CTRL), lower = v(mid) (so the CTRL pin works).
//   flip-flop  q = 1 → 0 when THR ≥ upper (or RESET below 0.7 V);  q = 0 → 1 when TRIG ≤ lower and RESET is high.  These are EVENTS (§3.5):
//              g = min(upper − THR, RESET − 0.7) when q = 1, g = max(TRIG − lower, 0.7 − RESET) when q = 0 (g ≤ 0 = crossed).
//   discharge  DIS → GND through Ron 5 Ω (macros.ts) while q = 0 (open otherwise).
//   output     Thevenin source (Ro 10 Ω) between OUT and the reference: q = 1: VCC − 1.7 V (reference VCC); q = 0: GND + 0.1 V.
//   supply     Icc(V) from VCC to GND: 2 mA at 5 V rising linearly to 9 mA at 15 V (below 5 V: proportional to V; above 15 V: same slope).
// Not modelled (flagged): the ±200 mA output current limit, input bias currents, THR/TRIG overlap priority beyond RESET.
import type { Device, Element } from '../types';

const GND = 0, TRIG = 1, OUT = 2, RST = 3, CTRL = 4, THR = 5, DIS = 6, VCC = 7;
const vOf = (x: ArrayLike<number>, k: number): number => (k < 0 ? 0 : x[k]);

const icc = (p: Element['p'], v: number): { i: number; g: number } => {
  const s = (p.icc15 - p.icc5) / 10;
  return v < 5 ? { i: (p.icc5 * v) / 5, g: p.icc5 / 5 } : { i: p.icc5 + s * (v - 5), g: s };
};

export const TMR: Device = {
  kind: 'TMR', terminals: 8, isLinear: false,
  branches: () => 0, internalNodes: () => 1, stateSize: () => 1,
  validate(el: Element) { const p = el.p; return p.rdiv > 0 && p.ro > 0 && p.ron > 0 ? null : `${el.id}: 555 parameters are not usable`; },
  stampDC(e, c) {
    const p = e.el.p, n = e.nodes, mid = e.internal[0], q = c.state[e.so] >= 0.5, gd = 1 / p.rdiv, go = 1 / p.ro;
    c.g(n[VCC], n[CTRL], gd); c.g(n[CTRL], mid, gd); c.g(mid, n[GND], gd);
    c.g(n[DIS], n[GND], q ? 1e-9 : 1 / p.ron);
    const ref = q ? n[VCC] : n[GND], k = q ? -p.vohdrop : p.vol;
    c.g(n[OUT], ref, go); c.i(ref, n[OUT], go * k);
    const f = icc(p, c.v(n[VCC]) - c.v(n[GND]));
    c.g(n[VCC], n[GND], f.g); c.i(n[VCC], n[GND], f.i - f.g * (c.v(n[VCC]) - c.v(n[GND])));
  },
  eventValue(e, x, state) {
    const p = e.el.p, n = e.nodes, g0 = vOf(x, n[GND]), rst = vOf(x, n[RST]) - g0 - p.vreset;
    if (state[e.so] >= 0.5) return Math.min(vOf(x, n[CTRL]) - vOf(x, n[THR]), rst);
    return Math.max(vOf(x, n[TRIG]) - vOf(x, e.internal[0]), -rst);
  },
  fire(e, _x, state) { state[e.so] = state[e.so] >= 0.5 ? 0 : 1; },
  terminalCurrents(e, x, state) {
    const p = e.el.p, n = e.nodes, mid = e.internal[0], q = (state[e.so] ?? 0) >= 0.5, gd = 1 / p.rdiv;
    const v = (k: number): number => vOf(x, k);
    const cur = new Array<number>(8).fill(0);
    // divider: VCC→CTRL→mid→GND; the mid node is internal, its current passes through CTRL's resistor chain: account at the pins
    const i1 = gd * (v(n[VCC]) - v(n[CTRL])), i2 = gd * (v(n[CTRL]) - v(mid)), i3 = gd * (v(mid) - v(n[GND]));
    cur[VCC] += i1; cur[CTRL] += -i1 + i2; cur[GND] += -i3;
    cur[DIS] += (q ? 1e-9 : 1 / p.ron) * (v(n[DIS]) - v(n[GND])); cur[GND] -= (q ? 1e-9 : 1 / p.ron) * (v(n[DIS]) - v(n[GND]));
    const io = (v(n[OUT]) - (q ? v(n[VCC]) - p.vohdrop : v(n[GND]) + p.vol)) / p.ro;     // into the device at OUT
    cur[OUT] += io; if (q) cur[VCC] -= io; else cur[GND] -= io;
    const ic = icc(p, v(n[VCC]) - v(n[GND])).i; cur[VCC] += ic; cur[GND] -= ic;
    return cur;
  },
  topo: () => ({ dc: [[VCC, GND], [CTRL, GND], [OUT, GND], [OUT, VCC], [DIS, GND]], ideal: [], forced: [] }),
};
