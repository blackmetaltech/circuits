// Linear regulator macro (7805 / LM317, DESIGN §3.7). Kind 'REG'. Terminals [IN, REF, OUT] (REF = GND for the 7805, ADJ for the LM317); state
// [dT, off] (junction rise over Ta, °C; thermal-shutdown latch 0 = running). No internal nodes, no branches.
//   pass       a source-only element (it cannot sink): ip = en·Ilim·tanh(softplus_1mA(e/Rout)/Ilim), e = softmin(Vreg + v_REF, v_IN − Vdo) − v_OUT,
//              so the output regulates v_OUT − v_REF → Vreg, is limited by dropout (v_OUT ≤ v_IN − Vdo) and by the current limit.
//   quiescent  iqgnd + iadj leave through REF (7805: Iq 5 mA to GND; LM317: Iadj 50 µA out of ADJ); iqout is INJECTED INTO OUT (LM317: 3.5 mA),
//              fading out as v_OUT approaches v_IN. Because ip ≥ 0, a load smaller than iqout lets OUT rise: the minimum load EMERGES.
//              All quiescent terms fade to zero below Vdo of headroom (device off).
//   thermal    lumped first-order Tj = Ta + dT, tau·d(dT)/dt = P·θJA − dT, P = Σ v·i (package power); integrated exactly per accepted step
//              (dT ← dT·e^(−h/τ) + P·θ(1 − e^(−h/τ))). EVENT: running → off at Tj ≥ Tshut (150 °C), off → running at Tj ≤ Tshut − Thyst (135 °C):
//              an overheated regulator visibly cycles. Live mode will drive the same latch from the §3.9 part thermal model (M1-C2); p.thermal = 0
//              disables this internal one.
import { dmath } from '@core/numerics';
import type { CElem, Device, Element } from '../types';
import { sg, sp, th } from './smooth';

const SD = 0.05, SI = 1e-3;
const vOf = (x: ArrayLike<number>, k: number): number => (k < 0 ? 0 : x[k]);

interface Cur { ip: number; iqo: number; iqg: number; e: number; dip: { vin: number; vref: number; vout: number }; dqo: { vin: number; vref: number; vout: number }; dqg: { vin: number; vref: number } }

function evalReg(e: CElem, x: ArrayLike<number>, state: number[]): Cur {
  const p = e.el.p, [nin, nref, nout] = e.nodes, vin = vOf(x, nin), vref = vOf(x, nref), vout = vOf(x, nout);
  const en = (state[e.so + 1] ?? 0) >= 0.5 ? 0 : 1;
  const a = p.vreg + vref, b = vin - p.vdo, z = (b - a) / SD, sz = sg(z), soft = b - SD * sp(z);
  const err = soft - vout, de = { vin: 1 - sz, vref: sz, vout: -1 };
  const w = err / p.rout, q = (SI * sp(w / SI)) / p.ilim, tq = th(q);
  const ip = en * p.ilim * tq.t, k = (en * tq.d * sg(w / SI)) / p.rout;
  // power-on factor for the quiescent terms, headroom factor for the injection into OUT
  const zp = (vin - vref - p.vdo) / 0.5, pw = 0.5 * (1 + th(zp).t), dpw = (0.5 * th(zp).d) / 0.5;
  const zh = (vin - vout - 0.3) / 0.1, hr = sg(zh), dhr = (hr * (1 - hr)) / 0.1;
  const iqo = p.iqout * pw * hr, iqg = (p.iqgnd + p.iadj) * pw;
  return {
    ip, iqo, iqg, e: err,
    dip: { vin: k * de.vin, vref: k * de.vref, vout: k * de.vout },
    dqo: { vin: p.iqout * (dpw * hr + pw * dhr), vref: -p.iqout * dpw * hr, vout: -p.iqout * pw * dhr },
    dqg: { vin: (p.iqgnd + p.iadj) * dpw, vref: -(p.iqgnd + p.iadj) * dpw },
  };
}

const power = (e: CElem, x: ArrayLike<number>, state: number[]): number => {
  const [nin, nref, nout] = e.nodes, c = evalReg(e, x, state), vin = vOf(x, nin), vref = vOf(x, nref), vout = vOf(x, nout);
  return (vin - vout) * (c.ip + c.iqo) + (vin - vref) * c.iqg;
};
/** Junction rise after a step of h seconds from the stored rise. */
const rise = (e: CElem, x: ArrayLike<number>, state: number[], h: number): number => {
  const p = e.el.p, d = h <= 0 ? 1 : dmath.exp(-h / p.tau);
  return (state[e.so] ?? 0) * d + Math.max(0, power(e, x, state)) * p.thetaja * (1 - d);
};

export const REG: Device = {
  kind: 'REG', terminals: 3, isLinear: false,
  branches: () => 0, internalNodes: () => 0, stateSize: () => 2,
  validate(el: Element) { const p = el.p; return p.vreg > 0 && p.vdo >= 0 && p.ilim > 0 && p.rout > 0 && p.tau > 0 && p.thetaja > 0 ? null : `${el.id}: regulator parameters are not usable`; },
  stampDC(e, c) {
    const [nin, nref, nout] = e.nodes, r = evalReg(e, c.x, c.state);
    const vin = c.v(nin), vref = c.v(nref), vout = c.v(nout);
    // device currents INTO the pins: IN: ip + iqo + iqg, OUT: −(ip + iqo), REF: −iqg  (each a function of vin, vref, vout)
    const rowOf = (row: number, sign: number, F0: number, dIn: number, dRef: number, dOut: number): void => {
      c.m(row, nin, sign * dIn); c.m(row, nref, sign * dRef); c.m(row, nout, sign * dOut);
      c.r(row, sign * (dIn * vin + dRef * vref + dOut * vout - F0));
    };
    const tin = r.dip.vin + r.dqo.vin + r.dqg.vin, tref = r.dip.vref + r.dqo.vref + r.dqg.vref, tout = r.dip.vout + r.dqo.vout;
    rowOf(nin, 1, r.ip + r.iqo + r.iqg, tin, tref, tout);
    rowOf(nout, -1, r.ip + r.iqo, r.dip.vin + r.dqo.vin, r.dip.vref + r.dqo.vref, r.dip.vout + r.dqo.vout);
    rowOf(nref, -1, r.iqg, r.dqg.vin, r.dqg.vref, 0);
  },
  update(e, x, state, _m, h) { if (e.el.p.thermal) state[e.so] = rise(e, x, state, h); },
  eventValue(e, x, state, h) {
    const p = e.el.p;
    if (!p.thermal) return 1;
    const dT = rise(e, x, state, h);
    return (state[e.so + 1] ?? 0) >= 0.5 ? dT - (p.tshut - p.thyst - p.ta) : p.tshut - p.ta - dT;
  },
  fire(e, _x, state) { state[e.so + 1] = state[e.so + 1] >= 0.5 ? 0 : 1; },
  terminalCurrents(e, x, state) {
    const r = evalReg(e, x, state);
    return [r.ip + r.iqo + r.iqg, -r.iqg, -(r.ip + r.iqo)];
  },
  topo: () => ({ dc: [[0, 1], [0, 2]], ideal: [], forced: [] }),
};
