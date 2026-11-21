# NODE status (for the next director)

## Done (committed, CI green)
- M0-1 scaffold (core 2034140), CI workflows (ci/release/pages), smoke OK.
- M0-2 skeleton: NodeState, regions global/in(draft)/na(test-only), locales shards, placeholder ticket 0-0 + placeholder Godot bench view.
- GA-1 flat LU + `pnpm bench:lu`; GA-2 spike (`CB_SPIKE=scope` / `user://spike.cfg`, src/spike + godot/spike: DELETE after Gate A).
- M1-A1/A2 linear MNA, M1-A3 transient, M1-B1 diodes + homotopy, M1-D1 catalogue, M1-D2 ngspice refs.
- Oracles green: NC-01..10, CA-01..06, CAP-01..07, TR-01..03, SD-01, SC-01..03 (26 of 57). 335 tests.

## Gate A (Pixel 9a, 2026-11-10): CONDITIONAL GO
See docs/perf/pixel-factor.json + gatea-2026-11-10.log. Pass: 25k-step nonlinear bridge 78 ms (≤1.5 s), LU n48 0.051 ms (≤0.25),
round trip p95 10.8 ms (≤20), no thermal slowdown in 11 min, fps p95 55-60 (marginal). FAIL: in-loop live-frame engine p95 6.4 ms
(budget 4) although the isolated frame is 1.1 ms → investigate the live path (JSON of 2x512 floats, dispatch, GC; try k=100 and
`thread=1` in user://spike.cfg) before M2-7. Session script: /home/ixaxaar/src/ORGS/cobanana/.qa/node-circuits/gatea.sh (run under
phone.lock). Spike code (src/spike, godot/spike, spike queries in game.ts, _start_up hook in main.gd) is deleted after that re-check.

## In flight
Nothing (all workers stopped/landed; working tree clean at handoff).

## Next (exact order; briefs for the first four were written by the Opus director — reconstruct from BUILD-PLAN rows + docs/briefs/COMMON.md)
- M1-A4 AC (ac.ts + AC-01..07, TR-04, FI-01/02/04, Sallen-Key ref)
- M1-B2 BJT/MOSFET (SC-04, SD-02, SD-03, refs 06/07/08/13/15)
- M1-C1 bench spec engine (sim/bench/*)
- M1-D2b NODE-vs-ngspice diode decks 01-05, 09, 14; make tran reuse op.solveNewton; ideal transformer device
- then M1-B3 macros (needs tran events), C2 thermal/ratings/smoke, C3 explainers, E1 goldens/Node18, E2 bench-cost; M2 slice.

## Open issues
- cap-el (4-1 electrolytics) unverified: Nichicon/Panasonic PDFs fetched but need pdftotext; transformer xfmr-12 is a game-defined
  fixture (decide: label as game-defined level fixture, Codex note). See `CAMPAIGN_BLOCKERS` in src/data/parts/index.ts.
- Catalogue 1N4007 now uses the Vishay model line (Is 1.437e-8, N 1.808); ngspice decks use the DESIGN values: regenerate 4-1 refs with
  the catalogue model before calibrate-levels.
- Zener models: no forward Is/N in catalogue (compiler default Is 1e-14, N 1); D2 decks used estimated Zener/body-diode params (review).

## HALT (2026-11-10, user order) - WIP
M1 engine tasks A4, B2, B3, C1, C2, C3, D2b, E1, E2 committed and green. M2-4 Godot bench world committed. M2-1 engine wiring (src/engine/actions, queries, board, src/sim/live.ts, src/data/levels) is an UNFINISHED worker WIP commit (tests may be red; check pnpm test). Live-frame profiling on Pixel not yet read (spike logs solve/ser ms; .qa/node-circuits/liveframe.sh). M2-2/3/5/6/7 and gates not started.

## 2026-11-20 engine lane for chapter 1 (M2-1 wiring + M2-2 data)
Engine finished for the Godot rebuild: board/probe/DMM/run actions, `bench` `liveFrame` `coach` `scope` (band + lock) `dmm` `wallet` `chapterMap` `ghost` queries, tickets 1-1..1-5 with oracles/tests
(`src/engine/ch1.test.ts`), payment on pass, exam-bridge stars. Contract and examples: docs/API-CH1.md (incl. the deviations from DESIGN §2.8 that need director sign-off).
Not done: NiMH reality check for 1-5, tolerance star (runTolerance), M2-3 verify/board-code, Pixel profiling of the live frame.
- 1-3 prices fixed 11-20: 1 W resistor 7c, so Ref B (2× 47 Ω ½ W, 6c) is cheaper than Ref A (22 Ω 1 W, 7c); 1-3 cost par 6c.

## 2026-11-20 front end on the real engine (EngineBench)
`godot/stall/engine_bench.gd` drives the engine through the sidecar and is the default backend of the stall; `fixture_bench.gd` is a test double (`CB_FIXTURE=1`) and the fallback when the sidecar
cannot start. Every number on screen is an engine query result: LED current / scope trace / amber band / LOCK (`scope`), DMM LCD in V / mA / ohm (`dmm`), temperatures, heat glow, smoke events with the
engine's own explanation text, LED mood and bloom, dot and critter speed, node tint (`liveFrame`), shoebox prices and ratings (`ticketCard`), Wren's steps and arrow anchors (`coach`), wallet, stars and
the chapter map (`wallet`, `benchResult`, `chapterMap`). The widened fixture 1-3 band is gone (7.85-8.40 V, 50 C ambient).
New in the UI: DMM ohm mode, the scope's CH1 clip as a real lead to drag onto the pad (probe tickets 1-3 and 1-5 need it), the BENCH push key (the formal check; it also runs by itself when LOCK has
been held 1.2 s, except on the exam ticket), the 1-5 exam slip (type V(A) and I(E2), the engine grades them), the fresh / tired battery tag on 1-2 (the bench tests both), supply cables routed around the board.
Tests: `godot/tests/stall_flow.gd` (engine; `CB_FIXTURE=1` for the double), `godot/tests/ch1_engine_flow.gd` (all five tickets to LOCK with the reference designs, plus the naive 1-1 and 1-3 smokes and the 1-2 tired-battery bench fail).
Open: the 1-2 tired battery is shown and benched but cannot be switched live (the engine has no live condition switch); 1-5 NiMH swap and phone (2424x1080) shots not redone.

## 2026-11-20 chapter 2 "Divide & Measure" (engine + stall)
Tickets 2-1 Sensor Reference, 2-2 Cable Fault, 2-3 Black Box, 2-4 EB Slide-wire Potentiometer: data in `src/data/levels/2-*.ts` (each header lists its deviations from DESIGN §2.8), contract and what changed in docs/API-CH2.md,
tests `src/engine/ch2.test.ts` (36) and `godot/tests/ch2_engine_flow.gd` (every ticket through the UI with the reference designs and the naive fails, ErrorTrap zero). Screens in docs/screens/ch2/.
Open: the 2-4 reality check (driver cell with r = 0.3 ohm) is an engine test, not a UI action; Engineer's +-0.5 cm jockey reading resolution (2-2) and the 0.4 A meter fuse case (2-3) are not built (see the headers); the fixture bench (CB_FIXTURE=1) is chapter 1 only.

## 2026-11-21 chapter 3 "Charge" (engine + stall)
Tickets 3-1 Flash Timer, 3-2 Debounce, 3-3 Relay Pull-in, 3-4 EB Capacitor Bank: data in `src/data/levels/3-*.ts` (each header lists its numbers and deviations from DESIGN §2.8), contract in docs/API-CH3.md, tests `src/engine/ch3.test.ts` (27) and `godot/tests/ch3_engine_flow.gd`
(every ticket through the UI with the reference designs and the naive fails, ErrorTrap zero). The scope is a time trace from power-on against an amber tube (`scope().trace`). Screens in docs/screens/ch3/.
Open: the tolerance star (stars 3 on the build tickets) is still not built; 3-4's "vary R" reality check is the energy ledger, not a free resistor (see the 3-4 header); the cap-el values below 220 uF and the 6.3 V part are generic game values (CAMPAIGN_BLOCKERS); no phone (2424x1080) shots.

## 2026-11-21 chapter 4 "Mains & Rectifiers" (engine + stall)
Tickets 4-1 Wall Wart (simulated mains: safety card gate, isolation transformer, red keep-out), 4-2 Zener Shunt, 4-3 Hot Regulator (heatsink variants, shutdown cycling, thermal camera), 4-4 Bench Supply (LM317), 4-5 EB Zener Regulator: data in `src/data/levels/4-*.ts` (each header lists its numbers and deviations),
contract in docs/API-CH4.md, tests `src/engine/ch4.test.ts` and `godot/tests/ch4_engine_flow.gd`. Screens in docs/screens/ch4/. Solver changes: tran rescue pass tolerances, REG Newton limiter, new CCL device; catalogue: Zener BV corrected, xfmr-12 without Lm.
Open: the `na` (120 V / 60 Hz) ref of 4-1 (680 uF) needs a region-aware level; the 9 V transformer tap of 4-3 is not built; the tolerance star is still not built; no phone (2424x1080) shots.

## 2026-11-22 chapter 4 finished and verified
`ch4_engine_flow` green (66 checks, zero SCRIPT ERROR); all earlier flows green. Fixed on the way: the safety card's fourth line printed an unresolved `{mentor}`; the customer's constant-current load read "warm" on the 4-3 bench (40 C/W on a 2.5 W load) and held the auto-bench back, so it has no thermal limit now;
a rating explainer quotes the WORST condition (the number the scope shows), not the first one; the 4-1 chit and the instruments under it step down so no spec line spills onto a meter (chapter 4 chits only; the chapter 1-3 chits still run long); a map chit's FIXED stamp no longer covers its title or fee;
the four LM7805s in the shoebox are named by their heatsink; the 4-5 slip no longer prints "V(M) I(E2)" or overlaps its labels; the marked slip grows on a handheld; the scope's "SPEC NOT MET" no longer runs into the volts-per-division setting.
Honest limits: on a 1280x800 handheld the long first-miss explanation of 4-1's 680 uF build runs to four pages of the top slip (the page counter sits over its last line); the 1080 desktop layout leaves the 4-1 chit touching the top edge of the multimeter; the 4-4 naive 2.4 k / 3.9 k build shows the formula (Iadj term) first because it also misses the band at 10 mA, the minimum-load text is for the no-load condition.
