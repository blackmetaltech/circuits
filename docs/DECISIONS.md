# CIRCUITS build decisions (deviations from BUILD-PLAN.md, with reasons)

- 2026-11-10 (director): M1-A1 and M1-A2 run as one worker task (netlist/compile + linear stamps/DC/topology + NC/CA oracles):
  the device-stamp interface and its first users are designed together, which avoids an interface round trip between lanes.
- 2026-11-10 (director): the part catalogue and board contracts (`src/data/parts/types.ts`, `src/sim/board/types.ts`) were written by the
  director before the lanes started, so the catalogue, footprints and compiler agree on part kinds, footprints and pin order.
  Prices are region data (`src/regions/global/prices.ts`), not on PartDef (DESIGN §4.5 had `priceUSD`; user decision 5 moves it to packs).
- 2026-11-10 (director): `sim/mna/solver.ts` adapter wraps core LU until the flat `lu.ts` (GA-1) lands, then switches in one line.
- 2026-11-10 (M0-2): undo/redo snapshots are **deltas** (the touched parts/wires with their previous versions), not full board copies:
  80 full copies of a 40-part board exceed the 64 KB state budget (§8.3). Capped at 40 entries and 40 touched items per stack.
- 2026-11-10 (director): constants of nature live in `src/sim/laws.ts` (sim must not import engine/); region packs keep copies that
  `validateNodeData` requires to be equal (tamper test).
- 2026-11-10 (director, Gate A): CONDITIONAL GO (docs/perf/pixel-factor.json). Solver budgets pass by >10x on the Pixel; the in-loop
  live-frame engine time (p95 6.4 ms vs 4 ms) fails although the isolated frame is 1.1 ms, so the fix is in the live path
  (serialisation/dispatch, quantum size), not the MNA cap. M1 continues; M2 live mode must re-measure before M2-7.
- 2026-11-23 (Ingrid, LOOK2 phase B, "D-bench-missing" and the bench memo): level search spent 91 % of its time in `runBench`
  probes. Two changes, measured on `checkLevel(seed 1)` with reports byte-identical before and after (hash of the JSON report):
  1. `benchTicket` is memoised on every input the bench reads (region, board, supply, generator, smoked parts, predictions,
     hidden values, selectors), per level def, 64 entries; each caller gets a deep copy. Exact by construction; a test
     compares it with `benchTicketRaw` on edited, burnt and passed boards. 4-4: 132 s -> 61 s.
  2. Before any simulation the bench checks, netlist only, that every spec probe resolves in every condition. If one does not
     (a part the specs measure is not on the board), the bench fails with "part missing" and simulates nothing. Before, it
     still ran the other conditions, and a half-built 5-1 board could chatter the stepper to its give-up limit for 60 s,
     to report a fail that was certain. 5-1: 111 s -> 6.5 s. Player-visible change: an incomplete board's failure list now
     names only the missing parts (no rating or convergence lines, no smoke from a bench on an incomplete board). No golden
     moved; the solvability, idle and random-play checks are unchanged (an incomplete board could never pass).
  Rejected: not offering runBench as a candidate (changes the search), cutting rollout counts (weakens the check), a core
  probe hook (core change; not needed after 1 and 2).
