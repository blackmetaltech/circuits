// Live frame pipeline (DESIGN §3.11, §8.6): compileIfDirty (the rig memo) → topologyCheck → dcopIfNeeded → transientAdvance(frame) →
// thermalAdvance(wallDt × thermalSpeed) → ratingsAndSmoke → scopeCapture(decimate). Pure and deterministic: no clock (one frame is a FIXED
// sim-time quantum `frameSim` and a FIXED thermal quantum), the persisted state is plain JSON, and resuming from a JSON round trip of
// `LiveLike` is bit-identical to carrying on in memory (advance(a); advance(b) from a save equals the uninterrupted run).
//
// ASSUMPTIONS (reported): the rig is rebuilt each call (compile is memoised by netlist hash); each frame starts a fresh TranState whose tStop
// is the frame end, so frame boundaries are step boundaries; instant failures (§3.9) are evaluated over the steps of ONE frame, so a 50 ms
// dwell rule accumulates only within a frame; ratings warnings are not stored (the `ratings` query recomputes them from the saved solution).
import { solveOp } from './mna/op';
import { makeProbe, tranAdvance, tranInit, tranWork, type TranState } from './mna/tran';
import { interpAt } from './bench/measure';
import { instantFailures } from './smoke';
import { partPower, ratingProbes, stepThermal, thetaTotal, type Window } from './thermal';
import { explainSolve, sig } from './explain';
import type { Rig, RigIssue } from './rig';

/** Wall time of one live frame (30 Hz). Thermal runs thermalSpeed times faster than this. */
export const LIVE_FRAME_WALL_DT = 1 / 30;
/** One scope screen (10 divisions) holds this many points; the ring holds two screens. */
export const SCOPE_SCREEN_POINTS = 256;

export interface LiveCfg { frameSim: number; h: number; thermalSpeed: number; ambientC: number; xCap: number; histCap: number; scopeCap: number; timePerDiv: number }
export interface LiveLike {
  powered: boolean; frame: number; t: number; x: number[]; hist: number[]; temps: Record<string, number>; smoked: string[];
  status: 'ok' | 'float' | 'noconv' | 'loop' | 'big'; h: number; be: number;
  scope: { ch1: number[]; ch2: number[]; t0: number; dt: number };
}
export interface LiveEvent { part: string; key: string; vars: Record<string, string | number> }
export interface AdvanceOut { events: LiveEvent[]; issues: RigIssue[]; frames: number }

const q2 = (v: number): number => Math.round(v * 100) / 100;
const q5 = (v: number): number => (Number.isFinite(v) ? Math.round(v * 1e5) / 1e5 : 0);

/** Parts cool (or heat) toward ambient with P = power(uid); `power` null = unpowered (P = 0). */
function thermalStep(live: LiveLike, rig: Rig, cfg: LiveCfg, power: ((uid: string) => number) | null, out: LiveEvent[]): void {
  const dt = LIVE_FRAME_WALL_DT * cfg.thermalSpeed, ta = cfg.ambientC;
  for (const part of rig.rated) {
    if (live.smoked.includes(part.id)) { delete live.temps[part.id]; continue; }
    const P = power ? power(part.id) : 0;
    const T0 = live.temps[part.id] ?? ta;
    if (!power && live.temps[part.id] === undefined) continue;
    const T = q2(stepThermal(T0, P, dt, part.thermal, ta, thetaTotal(part.thermal, part.heatsink)));
    if (T > part.thermal.tFail) {
      live.smoked.push(part.id); delete live.temps[part.id];
      const rated = part.ratings.P ?? part.ratings.Pd ?? 0;
      if (part.kind === 'R') out.push({ part: part.id, key: 'smoke.resistor', vars: { part: part.id, P: sig(P), Prated: rated, ratio: rated > 0 ? sig(P / rated) : 0, T: sig(T), tFail: part.thermal.tFail } });
      else out.push({ part: part.id, key: 'smoke.thermal', vars: { part: part.id, P: sig(P), T: sig(T), tFail: part.thermal.tFail } });
    } else if (Math.abs(T - ta) < 0.5 && P === 0) delete live.temps[part.id];
    else live.temps[part.id] = T;
  }
}

function clearScope(live: LiveLike): void { live.scope.ch1 = []; live.scope.ch2 = []; live.scope.dt = 0; live.scope.t0 = 0; }

function capture(live: LiveLike, cfg: LiveCfg, ts: number[], y1: number[], y2: number[], tEnd: number): void {
  const dt = (10 * cfg.timePerDiv) / SCOPE_SCREEN_POINTS, sc = live.scope;
  if (sc.dt !== dt || sc.ch1.length === 0) {
    sc.ch1 = []; sc.ch2 = []; sc.dt = dt;
    let k = 0; while (k * dt < ts[0]! - 1e-12) k++;   // first grid point at or after the frame start (loop, no Math.ceil on a quotient)
    sc.t0 = k * dt;
  }
  for (;;) {
    const tq = sc.t0 + sc.ch1.length * dt;
    if (tq > tEnd + 1e-12) break;
    sc.ch1.push(q5(y1.length ? interpAt(ts, y1, tq) : 0)); sc.ch2.push(q5(y2.length ? interpAt(ts, y2, tq) : 0));
  }
  const over = sc.ch1.length - cfg.scopeCap;
  if (over > 0) { sc.ch1.splice(0, over); sc.ch2.splice(0, over); sc.t0 += over * dt; }
}

/** Advance `frames` live frames in place. */
export function advanceLive(live: LiveLike, rig: Rig, cfg: LiveCfg, frames: number): AdvanceOut {
  const out: AdvanceOut = { events: [], issues: [], frames: 0 };
  const ckt = rig.circuit;
  for (let f = 0; f < frames; f++) {
    live.frame += 1; out.frames++;
    out.issues = [];
    if (!live.powered) { thermalStep(live, rig, cfg, null, out.events); live.status = 'ok'; continue; }
    // ---- topology check (blocking problems are explained, never solved)
    const blocks = ckt ? ckt.issues.filter((i) => i.severity === 'block').map((i) => ({ key: i.key, vars: i.vars })) : [];
    if (rig.errors.length > 0 || blocks.length > 0 || !ckt) {
      out.issues = rig.errors.length > 0 ? rig.errors : blocks;
      live.status = rig.errors.some((e) => e.key === 'rig.noGround') ? 'float' : 'loop'; live.x = []; live.hist = []; live.h = 0; live.be = 0;
      thermalStep(live, rig, cfg, null, out.events); continue;
    }
    if (ckt.dim > cfg.xCap || ckt.stateSize > cfg.histCap) {
      out.issues = [{ key: 'live.big', vars: { dim: ckt.dim, cap: cfg.xCap } }]; live.status = 'big'; live.x = []; live.hist = []; live.h = 0; live.be = 0;
      thermalStep(live, rig, cfg, null, out.events); continue;
    }
    const warns = ckt.issues.filter((i) => i.severity === 'warn').map((i) => ({ key: i.key, vars: i.vars }));
    if (ckt.dim === 0) { live.t += cfg.frameSim; live.status = 'ok'; thermalStep(live, rig, cfg, () => 0, out.events); continue; }

    // ---- DC operating point (first frame after power-on or after the circuit's shape changed), then the transient from power-on
    let st: TranState;
    if (live.x.length !== ckt.dim || live.hist.length !== ckt.stateSize || !(live.h > 0)) {
      const op = solveOp(ckt);
      if (!op.ok) {
        const ex = op.failure ? explainSolve(op.failure) : { key: 'solve.noConverge', vars: {} };
        out.issues = [{ key: ex.key, vars: ex.vars }]; live.status = 'noconv'; thermalStep(live, rig, cfg, null, out.events); continue;
      }
      clearScope(live); live.t = 0;
      const init = tranInit(ckt, { h: cfg.h, tStop: cfg.frameSim, ic: 'zero' });
      if (!init.ok) {
        const ex = init.failure ? explainSolve(init.failure) : { key: 'solve.noConverge', vars: {} };
        out.issues = [{ key: ex.key, vars: ex.vars }]; live.status = 'noconv'; thermalStep(live, rig, cfg, null, out.events); continue;
      }
      st = init.st;
    } else {
      st = { t: live.t, h: live.h, h0: cfg.h, tStop: live.t + cfg.frameSim, x: live.x.slice(), state: live.hist.slice(), be: live.be, method: 'auto', ramp: false, gmin: 1e-12, done: false, stats: { steps: 0, newtonIters: 0, rejected: 0 } };
    }
    // ---- transient advance, recording the probes the ratings and the scope need
    const names = ratingProbes(rig, rig.rated);
    const fns = names.map((n) => makeProbe(ckt, n));
    const sf = rig.scope.map((e) => (e ? makeProbe(ckt, e) : null));
    const ts: number[] = [st.t], series: Record<string, number[]> = {}, y1: number[] = [], y2: number[] = [];
    const x0 = Float64Array.from(st.x);
    names.forEach((n, i) => { series[n] = [fns[i]!(x0, st.state)]; });
    if (sf[0]) y1.push(sf[0](x0, st.state)); if (sf[1]) y2.push(sf[1](x0, st.state));
    const r = tranAdvance(tranWork(ckt, st, true), st, Infinity, (s) => {
      ts.push(s.t); names.forEach((n, i) => series[n]!.push(fns[i]!(s.x, s.state)));
      if (sf[0]) y1.push(sf[0](s.x, s.state)); if (sf[1]) y2.push(sf[1](s.x, s.state));
    });
    live.x = st.x.slice(); live.hist = st.state; live.h = st.h; live.be = st.be; live.t = st.t;
    if (r.failure) {
      const ex = explainSolve(r.failure); out.issues = [{ key: ex.key, vars: ex.vars }]; live.status = 'noconv';
    } else { live.status = warns.length > 0 ? 'float' : 'ok'; out.issues = warns; }
    capture(live, cfg, ts, y1, y2, st.t);
    // ---- thermal advance and ratings / smoke
    const w: Window = { t: ts, series };
    thermalStep(live, rig, cfg, (uid) => { const p = rig.rated.find((x) => x.id === uid)!; return Math.max(0, partPower(rig, p, w).avg); }, out.events);
    const alive = rig.rated.filter((p) => !live.smoked.includes(p.id));
    for (const f2 of instantFailures(rig, alive, w)) {
      if (live.smoked.includes(f2.part)) continue;
      live.smoked.push(f2.part); delete live.temps[f2.part];
      const vars: Record<string, string | number> = {}; for (const [k, v] of Object.entries(f2.vars)) vars[k] = typeof v === 'number' ? sig(v) : v;
      out.events.push({ part: f2.part, key: f2.key, vars });
    }
    if (out.events.length > 0) break;   // stop at a smoke so the player sees it (the explainer opens)
  }
  return out;
}
