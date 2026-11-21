// The scope's time trace for chapter 3 (docs/API-CH3.md): the engine's own single sweep from power-on, the amber tube it is held against, which samples are outside it, and LOCK.
// Everything here is read from the saved live state (`live.scope`), so a loaded save answers exactly as the running game did. The front end draws what this returns and computes nothing.
import { dmath } from '@core/numerics';
import type { LevelDef, TubeDef } from '../data/levels/types';
import { SCOPE_SCREEN_POINTS } from '../sim/live';
import { measure } from '../sim/bench/measure';
import { sig } from '../sim/explain';
import { liveRig, probeOn } from './ticket-run';
import { say } from './text';
import type { TicketState } from './state';
import { t } from '../i18n';
import { hashOf } from '@core/kit/hash';

const r4 = (x: number): number => (Number.isFinite(x) ? Math.round(x * 1e4) / 1e4 : 0);
const WINDOW_EPS = 1e-12;

/** The allowed band [lo, hi] (SI) of the tube at time `at`; null where the tube lets the trace go anywhere. */
export function tubeAt(tube: TubeDef, at: number): { lo: number; hi: number } | null {
  if (tube.kind === 'exp') {
    const y = (x: number): number => (x <= 0 ? tube.v0 : tube.vInf + (tube.v0 - tube.vInf) * dmath.exp(-x / tube.tau)), a = y(at - tube.dt), b = y(at + tube.dt);
    return { lo: Math.min(a, b) - tube.dv, hi: Math.max(a, b) + tube.dv };
  }
  let lo = -Infinity, hi = Infinity, any = false;
  for (const w of tube.windows) if (at >= w.t0 - WINDOW_EPS && at < w.t1 - WINDOW_EPS) { lo = Math.max(lo, w.lo); hi = Math.min(hi, w.hi); any = true; }
  return any ? { lo, hi } : null;
}

export interface TraceView {
  /** Samples of the sweep so far (display units), the grid they sit on, and how much of the sweep has formed (0..1). */
  v: number[]; t0: number; dt: number; progress: number; complete: boolean;
  /** Indices of the samples that are outside the tube. */
  bad: number[];
  /** The tube on the screen grid: `exp` gives lo / hi per grid point; `windows` gives the gates. Display units. */
  tube: { kind: 'exp'; lo: number[]; hi: number[] } | { kind: 'windows'; windows: { t0: number; t1: number; lo: number; hi: number }[] };
  inTube: boolean; specsOk: boolean;
  /** The specs that do not hold on the sweep yet (ids), for the readout. */
  specsFail: string[];
  /** RC / LR tickets: one time constant. `level` = 63.2 % of the circuit's final value (display units, the dashed line); `t` = when the trace crosses it (s, null until it does); `final` = the final value. */
  mark63: { level: number; final: number; t: number | null } | null;
}

let finalCache: { key: string; fin: number | null } | null = null;
/** The whole trace picture of the open ticket (null when the ticket has no time trace). */
export function traceView(tk: TicketState, def: LevelDef): TraceView | null {
  const tr = def.trace; if (!tr) return null;
  const sc = tk.live.scope, tpd = tk.instruments.scope.timePerDiv, n = SCOPE_SCREEN_POINTS, dt = (10 * tpd) / n;
  const pts = sc.dt === dt ? sc.ch1 : [];
  const ys = pts.slice(0, n), ts = ys.map((_, k) => sc.t0 + k * dt);
  const lo: number[] = [], hi: number[] = [], bad: number[] = [];
  for (let k = 0; k < n; k++) { const a = tubeAt(tr.tube, k * dt); if (tr.tube.kind === 'exp') { lo.push(r4((a?.lo ?? 0) * tr.scale)); hi.push(r4((a?.hi ?? 0) * tr.scale)); } }
  ys.forEach((y, k) => { const a = tubeAt(tr.tube, ts[k]!); if (a && (y < a.lo || y > a.hi)) bad.push(k); });
  const complete = ys.length >= n;
  // the bench's own specs, measured on the sweep the scope shows
  const specsFail: string[] = [];
  if (complete) {
    for (const id of tr.lockSpecs) {
      const sp = def.bench.specs.find((x) => x.id === id); if (!sp || (sp.kind !== 'metric' && sp.kind !== 'level')) continue;
      const sg = { t: ts, y: ys }, v = sp.kind === 'metric' ? measure(sp.metric, sg, sp.params) : measure('mean', sg);
      if (!(Number.isFinite(v) && v >= sp.lo && v <= sp.hi)) specsFail.push(id);
    }
  }
  const tube: TraceView['tube'] = tr.tube.kind === 'exp' ? { kind: 'exp', lo, hi } : { kind: 'windows', windows: tr.tube.windows.map((w) => ({ t0: w.t0, t1: w.t1, lo: r4(Math.max(w.lo, -1e6) * tr.scale), hi: r4(Math.min(w.hi, 1e6) * tr.scale) })) };
  // 63.2 % of the FINAL value of this circuit (found on a copy: the capacitor open / the coil a short), and where the sweep crosses it
  let mark63: TraceView['mark63'] = null;
  if (tr.mark63) {
    const key = hashOf({ id: def.id, p: tk.board.parts, w: tk.board.wires, v: tk.instruments.supply.v, h: tk.hidden });
    if (finalCache?.key !== key) finalCache = { key, fin: probeOn(tk.board, def, tk)(tr.probe) };
    const fin = finalCache.fin;
    if (fin !== null && Number.isFinite(fin) && Math.abs(fin) > 0) {
      const lvl = 0.632 * fin;
      let tc: number | null = null;
      for (let k = 1; k < ys.length && tc === null; k++) { const a = ys[k - 1]!, b = ys[k]!; if ((a - lvl) * (b - lvl) <= 0 && a !== b) tc = ts[k - 1]! + ((lvl - a) / (b - a)) * dt; }
      mark63 = { level: r4(lvl * tr.scale), final: r4(fin * tr.scale), t: tc === null ? null : Math.round(tc * 1e9) / 1e9 };
    }
  }
  return { v: ys.map((y) => r4(y * tr.scale)), t0: sc.t0, dt, progress: Math.min(1, ys.length / n), complete, bad, tube, inTube: bad.length === 0, specsOk: complete && specsFail.length === 0, specsFail, mark63 };
}

/** `scope().target / gauge / lock` for a ticket with a time trace. */
export function traceTarget(tk: TicketState, def: LevelDef): Record<string, unknown> {
  const tr = def.trace!, view = traceView(tk, def)!;
  const live = tk.live.powered && tk.live.status !== 'noconv' && tk.live.smoked.length === 0 && tk.live.x.length > 0;
  const c = tr.clip ? tk.board.connectors.find((x) => x.id === tr.clip) : undefined;
  let clipped = tr.mode === 'auto';
  if (tr.mode === 'clip' && c) { const conn = liveRig(tk, def).conn, want = conn.nodeOfPad(c.pad); clipped = tk.board.probes.some((p) => p.ch === 1 && ((p.pad[0] === c.pad[0] && p.pad[1] === c.pad[1]) || (want >= 0 && conn.nodeOfPad(p.pad) === want))); }
  const lock = live && clipped && view.complete && view.inTube && view.specsOk;
  const last = view.v.length > 0 ? view.v[view.v.length - 1]! : null;
  return {
    target: {
      spec: tr.lockSpecs[0] ?? '', name: tr.lockSpecs[0] && def.bench.names[tr.lockSpecs[0]] ? t(def.bench.names[tr.lockSpecs[0]]!) : '', quantity: tr.unit, unit: tr.unit, scale: tr.scale, lo: 0, hi: r4(tr.vdiv * 7),
      mode: 'trace', clip: c ? { connector: c.id, pad: c.pad } : null, clipped, vdiv: tr.vdiv, label: tr.label,
      times: tr.times, timePerDiv: tk.instruments.scope.timePerDiv,
    },
    gauge: { value: live && last !== null ? last : null, text: live && last !== null ? `${sig(last, 4)} ${tr.unit}` : '', unit: tr.unit, inBand: view.inTube },
    trace: view, lock, lockSpecs: Object.fromEntries(tr.lockSpecs.map((id) => [id, !view.specsFail.includes(id) && view.complete])),
    sweepText: say(view.complete ? (lock ? 'trace.locked' : view.inTube ? 'trace.done' : 'trace.outside') : 'trace.forming', { pct: Math.round(view.progress * 100) }),
  };
}
