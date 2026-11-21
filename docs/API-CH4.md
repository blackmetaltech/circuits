# CIRCUITS chapter 4 "Mains & Rectifiers": what is new in the engine contract

Everything in `docs/API-CH1.md` .. `API-CH3.md` still holds. Level data: `src/data/levels/4-*.ts` (each header lists its numbers and its deviations from DESIGN §2.8); tests: `src/engine/ch4.test.ts` (engine) and `godot/tests/ch4_engine_flow.gd`
(every ticket through the stall UI with the reference designs and the naive fails, ErrorTrap zero). Screens: `docs/screens/ch4/`.

## The five tickets

| id | customer | what the bench asserts | designed fails (tested) | ref |
|---|---|---|---|---|
| 4-1 Wall Wart (MAINS) | Mrs. Dale | OUT mean >= 12.0 V and ripple <= 1.0 Vpp at 100 mA, mains 207 / 230 / 253 V (and no load), capacitor inside its rating | 680 uF ripples 1.1 V; half-wave 1000 uF (20 ms gap); 16 V cap over its rating at 253 V no load (17.5 V), 10 V cap vents; 1N4148 over its repetitive peak current; a reversed diode shorts the winding | 4 x 1N4007 + 1000 uF 25 V, 26 c, 2 stars |
| 4-2 Zener Shunt | Iris | OUT 4.845 - 5.355 V at 13 / 17 V in and 0 / 30 mA out, ratings | R 220 (paper limit) sags to 4.78 V; R 470 collapses; R 100 / 1/4 W overheat; BZX55 climbs to 6.6 V | 180 ohm 1 W + 1N4733A, 11 c |
| 4-3 Hot Regulator | Jun | OUT 4.8 - 5.2 V at 0.1 / 0.5 A, Tj <= 125 C at Ta 40 C | bare chip cycles (shutdown); 15 C/W alone 137.5 C; 22 ohm pre-drop dropout; 2.2 ohm + 15 C/W 128 C | 10 ohm 5 W + LM7805 with the 15 C/W sink, 69 c (25 C/W + 10 ohm passes at 63 c) |
| 4-4 Bench Supply | your bench | OUT 3.267 - 3.333 V at 0, 10, 500 mA | 2.4 k / 3.9 k (minimum load: OUT runs away at no load); formula misses (120/200, 330/510) | LM317 + 240 + 390, 3 parts |
| 4-5 EB: Zener Regulator | exam desk | predict Iz 14.0 mA, RL(min) 333 ohm, Pz(no load) 120 mW; I(Rs) = 20 mA +-1 % | wrong Rs; wrong predictions: fewer stars + the working | 300 ohm + ideal 6 V Zener: 3 stars |

Unlocking: 4-1 needs `3-3|3-4`; 4-2 needs 4-1; 4-3 and 4-4 need 4-2; 4-5 needs 4-2 and `4-3|4-4`. `chapterMap(4)`: "Mains & Rectifiers", 11 stars.

## Mains safety (DESIGN §1.2, user decision 4)

- `LevelDef.mains` marks a mains ticket (4-1). `ticketCard().mains` = `{ safetyRead, firstView, vrms, hz, ribbon, title, lines[4], button, keepOut, isolation }`. The action `readSafety` records the read (and `progress.codexSeen` gets `mains-safety`, the Codex page "Mains safety and isolation").
  `power(true)` and `runBench` are refused until it is read. The front end shows the card before anything else; on the first view (`firstView`) it cannot be dismissed for six seconds and only by its own button.
- The wall socket is `SupplyDef` kind `mains` (`vrms`, `f`; conditions and selectors set `vrms`): a sine between two connectors (role `mains`), FLOATING (only a 100 Mohm insulation resistor ties it to ground). It is the isolation transformer, a bench object (`SupplyView` kind "mains").
- `Board.keepOut` (rectangles of pads, from `LevelDef.board.keepOut`): `placePart` / `addWire` / `wire` refuse anything touching it (`err.keepout.*`); `bench().keepOut` lets the board draw the red hatch and the HIGH VOLTAGE silkscreen. The transformer primary and the L / N pads are inside it.
- The ticket chit carries the red ribbon (`mains.ribbon`: "simulated mains: do not try this at home").

## New engine pieces

- **Live switches** (`LevelDef.selectors`, `TicketState.sel`, action `setSelector(id, index)`): positions are sets of overrides like a bench condition (mains tolerance, load, input voltage). `bench().selectors` / `ticketCard().selectors` = `[{ id, label, options[], index }]`.
  The live circuit restarts from power-on; the formal bench still runs every condition of the plan.
- **Constant-current load** (`load-cc`, device `CCL`): the customer's equipment; its current is the placed part's value (A), overridden by key `i`; it switches on 30 ms after power-on and fades below 1 V (a resistor of 1 V / I there), so a collapsed rail does not stall the solver.
- **Parts**: `zener-6v-ideal` (textbook, piecewise-linear); the LM7805 in four versions (bare and the 25 / 15 / 8 C/W sinks: thetaJA 54 / 29.5 / 19.5 / 12.5); the catalogue Zeners' BV is now Vz - Izt x Rs (terminal voltage at Izt = Vz); `xfmr-12` has no magnetising inductance (see the part note) and a 100 Mohm secondary-to-ground insulation.
- **Ratings**: diodes check the repetitive peak current (`IFRM`, key `rating.diode.peak`); `BenchPlan.tjLimit` tightens the junction limit (4-3: 125 C); a regulator never smokes from heat (its own shutdown latch cycles); `BenchPlan.regTau` compresses the regulator's thermal clock (0.4 s for a bare chip, longer with a sink).
- **Scope for AC** (`TraceDef.second`, `settleFrom`, `h`, `vdivs`, `ac`, `acBand`): `scope().trace.v2` = the transformer's secondary (amber CH2, 10 V/div), `trace.dc` = the mean of the settled part (AC coupling), `target.vdivs` / `.ac` / `.acBand`; the lock specs are measured from `settleFrom` on.
- `liveFrame()`: a regulator carries `reg: { off, tj, shut }` (the shutdown latch from the saved solution; `temp` is the junction); thermal camera flag `ticketCard().camera`.
- Explainers (`explain.rect.*`, `explain.cap.overrating`, `explain.diode.peak`, `explain.xfmr.hot`, `explain.zener.*`, `explain.reg.*`, `explain.lm317.*`): first miss = the cause, repeat = the working; debrief node `zener` (5 working lines, the real Zener's slope).

## Front end (stall)

The red keep-out with its silkscreen and the L / N pads; the isolation transformer panel with the MAINS and LOAD key banks (and the same banks on the bench supply of 4-2 .. 4-4); the scope's amber CH2, AC coupling (A key or the third knob) and the VOLTS list; the thermal camera (T key or the chip above the board:
false colours and degrees on the engine's temperatures); TO-220 art with heatsink fins and a shutdown lamp, the load box, the Zener bar; the safety card page; the Zener exam figure; the notebook's chapter 4 page and nine new Codex pages (mains safety first); rain on the awnings.
