# NODE status (for the next director)

## Done (committed, CI green)
- M0-1 scaffold (core 2034140), CI workflows (ci/release/pages), smoke OK.
- M0-2 skeleton: NodeState, regions global/in(draft)/na(test-only), locales shards, placeholder ticket 0-0 + placeholder Godot bench view.
- GA-1 flat LU + `pnpm bench:lu`; GA-2 spike (`CB_SPIKE=scope` / `user://spike.cfg`, src/spike + godot/spike: DELETE after Gate A).
- M1-A1/A2 linear MNA, M1-A3 transient, M1-B1 diodes + homotopy, M1-D1 catalogue, M1-D2 ngspice refs.
- Oracles green: NC-01..10, CA-01..06, CAP-01..07, TR-01..03, SD-01, SC-01..03 (26 of 57). 335 tests.

## In flight
- Gate A Pixel run (`.qa/node-circuits/gatea.sh` under phone.lock): log at `.qa/node-circuits/gatea.log`.

## Next (queued: subagent slots were full)
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
