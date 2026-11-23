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
- 2026-11-23 (Ingrid, decision 10b, owner's go-ahead 11-22): repair tickets. `LevelDef.fault` is the customer's faulty board
  as it arrives (removable parts x1.., wires xw.., and which parts came in burnt). Five tickets: 1-1 torch (LED straight on
  the PP3, dead), 1-2 tail light (1 k resistor, dim), 1-3 heater (link wire, full 12 V), 1-4 toy car (burnt 1 W load),
  5-1 fan (Q1 burnt, no flyback diode). The ref replay clears the faulty board first (`clearFaultActions`), so checkLevel
  and the expert persona play the repair. Burnt parts cost money: a part the player burns adds its regional price to the
  ticket's burn bill, which comes out of the pay on a pass (never below zero; fixed parts and the sandbox are free;
  arrived-burnt parts are free). Build tests that start from a bare board clear the faulty board in their `open` helper
  (the same assertions); `src/engine/repair.test.ts` covers the arrival, the ref from the arrival, the 1-2 one-value fix
  and the burn bill. No golden moved (the trajectory goldens play ticket 0-0, which is not a repair).

- **D-cost-linear (2026-11-23, Ingrid Solheim, Game Lead).** The CI bench-cost gate (estimate within 2x of measured time on 10
  boards) had been red on master since 2026-11-22 01:26, before phase B, on rc-step and regulator-7805; locally it failed on other
  boards. Cause: each board was timed 5 times after one warm-up, so a 0.1 to 3 ms board was JIT and GC noise (rc-step read 0.26 on
  CI and 0.86 here on the same code). Fix in two parts, tolerance and flop limit unchanged:
  (1) `scripts/bench-cost.ts` times each board after three warm-ups until it has 5 runs and 250 ms, and takes the lower quartile;
  (2) with steady timing the two linear boards ran 5 to 6x faster per estimated flop than every nonlinear board, a real estimator
  error: linear elements stamp constants. `src/sim/bench/cost.ts` charges linear circuits `ASM_ELEM_LINEAR` = 20 per element and
  `STEP_OVERHEAD_LINEAR` = 60 per step (nonlinear constants unchanged). Three runs: all 10 boards within 2x (ratios 0.94 to 1.03 for
  the linear pair). Effect in play: a linear bench is estimated closer to its real time, so the 1.5e9 refusal still means about 2 s
  on a desktop. Disagreement on record: this is a model change made by the lead, not the systems engineer; a systems review of the
  constants belongs in the next layer.

- **D-ch2-bench (2026-11-23, Ingrid Solheim, Game Lead; product call by Priya Nair).** Chapter 2 is the next chapter on the bench,
  not chapter 4. Why: a player who finishes chapter 1 drops straight into the old look otherwise; 2-1 and 2-3 need only the meter
  and resistors we already have; chapter 4 (transformer, safety card, ripple, heatsinks, thermal camera) is a layer of its own.
  Strongest argument against (game designer, Dagny behind): chapter 4 is the fantasy, and 2-2 and 2-4 are lab apparatus. Answer:
  every chapter 2 ticket arrives as a customer's broken thing that must be measured before any change: 2-1 Kaya's weather station
  reads low (divider sized unloaded, 2.76 V at the 10 k ADC); 2-2 a reel of buried cable with a fault somewhere (loop resistance
  first; Tomasz checks the meter-resolution claim); 2-3 a dead sealed module (open-circuit volts and short-circuit amps first);
  2-4 the exam rig's slide wire with the wrong rheostat (volts across the wire first). Cut line, written now: if the layer slips,
  2-1 and 2-3 ship on the bench and 2-2 and 2-4 stay classic, labelled.

- **D-burn-rush (2026-11-23, Ingrid Solheim, Game Lead).** A part the player burns on a customer's job is billed as a rush
  replacement: its price plus a courier fee (`service:rush`, US$1.50 in the global pack, converted in derived packs), per burnt
  part, out of the pay. Why: Dagny scored tension 5 because a $0.04 transistor against a $10 job does not hurt. One burn on 1-1
  now costs $1.53 of a $5 job; three burns eat most of it. The ticket says so the moment it happens. Cut, written down: customer
  deadlines and a reputation score were considered and left out of this layer (both need a campaign clock and a save field);
  they go to the next layer's list. The sandbox still never bills; arrived-burnt parts are still free.

- **D-bench-ch2 delivered (2026-11-23, Ingrid Solheim, Game Lead).** The cut line held: 2-1 and 2-3 play on the bench after 1-5;
  2-2 (cable bridge) and the 2-4 exam stay on the classic stall, said on the title. 2-1 now arrives faulty in both looks (the
  `fault` board: 5.6 k over 3.3 k, 3.34 V open, 2.76 V on the 10 k ADC); the 2-1 tests clear the customer's board first, as the
  chapter 1 repair tests do, and the replay test still plays the whole path from the arrived board. 2-3 needed a control the bench
  did not have: the VOLTAGE knob on the supply (wheel 0.1 V, Shift 0.01 V, Ctrl 1 V). The sealed box and the ADC header got their
  own models instead of terminal blocks.

- **D-cute-bench (2026-11-23, Ingrid Solheim, Game Lead).** The new look gets a Cute mode, on by default (owner concern S), with one
  element this layer: amber beads ride every wire that carries current, at the engine's own dot speed, in the direction of
  conventional current; a wire with no current carries none. It maps to one band (is current flowing here, and how much) and fakes
  no number. Toggle: C, or "Cute on/off" on the title; saved. Strongest argument against (art direction, from the phase B look
  notes): the bench is meant to read as a real repair bench, and glowing beads are not real. Answer: they are off with one key,
  and they answer the question a 14-year-old asks first ("is anything happening?") without a meter. Cut and written down: the
  classic look's cat, part faces and electron-flow option are not ported this layer.

- **D-pad-first-pass (2026-11-23, Ingrid Solheim, Game Lead).** Gamepad on the bench is a cursor, not a second UI: the left stick
  drives a ring, A and B are left and right click at the ring, the bumpers are the wheel, and X, Y, D-pad, Back and Start send the
  bench's own keys. One input language, and every pad action is a mouse or key action the flows already test. Found on the way:
  parsed mouse events are in window pixels, so the ring is mapped through the window's stretch; without it every pad click lands
  off target on a window not at the base size. Not done: pad navigation of the paper ticket's keys (they are reached with the
  ring), rumble, and a hand test with a real controller; no human has held a pad on this build.
