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
