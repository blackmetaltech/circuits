# CIRCUITS chapter 3 "Charge": what is new in the engine contract

Everything in `docs/API-CH1.md` and `docs/API-CH2.md` still holds. This file lists only what chapter 3 added. Level data: `src/data/levels/3-*.ts` (each header lists its numbers and its deviations from DESIGN §2.8); tests:
`src/engine/ch3.test.ts` (engine, 27) and `godot/tests/ch3_engine_flow.gd` (every ticket through the stall UI with the reference designs and the naive fails, ErrorTrap zero). Screens: `docs/screens/ch3/`.
This is the first chapter where TIME matters: the scope shows the real transient from power-on.

## The four tickets

| id | customer | what the bench asserts | board | designed fail (tested) | ref |
|---|---|---|---|---|---|
| 3-1 Flash Timer | Ines (camera shop) | OUT crosses 6.32 V at 0.95 - 1.05 s after power-on, and the whole curve stays in the exp tube (+-0.10 V, +-50 ms) around 10 (1 - e^-t); window 5 s | bench supply 10 V (fixed), E12 1 k - 1 M, electrolytics 1 - 1000 uF in 6.3 / 16 / 25 V, scope clip on OUT | 1 M + 1 u: the 10 M scope probe loads it, crossing 1.08 s (the Thevenin explainer); 6.3 V cap vents; reversed cap vents; wrong RC says which way | 10 k + 100 u 16 V: 1.000 s, 10 c, 2 stars |
| 3-2 Debounce | Dex (arcade repair) | OUT crosses 2.5 V exactly once on the press and once on the release, each 5 - 20 ms after the first contact, in four bounce patterns | 5 V rail, fixed 10 k pull-up, fixed 1 M logic input, a bench contact SW-GND (press 10 ms, release 50 ms, 6 bounces of 0.1 - 0.4 ms each) | 1 k + 10 n: 13 crossings; 470 k + 1 u never crosses; 22 k + 220 n early; 68 k + 680 n late | 47 k + 330 n: 10.5 / 13 ms after first contact, 2 stars |
| 3-3 Relay Pull-in | Sami (greenhouse) | coil current crosses 40 mA within 0.40 ms, steady (peak) 50 - 66 mA, no part over its rating; window 20 ms | fixed relay (200 ohm, 100 mH), fixed rails V12 and V24, E12 47 - 560 + 200 ohm in 1/4, 1/2, 1 W | 12 V alone 0.549 ms (slow); 24 V alone 120 mA: the coil overheats; 24 V + 200 ohm 1/4 W: resistor over its rating; 100 ohm: 80 mA | 24 V + 200 ohm 1 W: 0.275 ms, 60 mA, 1.42 W (2 stars, par 1.5 W) |
| 3-4 EB: Capacitor Bank | the exam desk | predict Q = 180 uC, U = 9.9 mJ, V = 40 V, loss 12 mJ (1 % / 5 %); bench V(M) = 20.0 V, peak V(D) = 40.0 V, switch heat 12.0 mJ +-2 % | fixed 110 V source, fixed 4 uF at 100 V, a bench switch (10 ohm, 1 ms) B-D, exact capacitors 2 / 3 / 4 / 6 uF | missing 6 uF in parallel: M reads 44 V (explainer); wrong predictions: 1 star + the working | 2, 3, 6 uF + 6 uF: 3 stars |

Unlocking: 3-1 needs `2-3|2-4` (chapter 2's last build ticket or its exam); 3-2 and 3-3 need 3-1; 3-4 needs 3-1 and `3-2|3-3`.

## New engine pieces

- **Capacitors and coils expand** (`netlist.ts`): kinds `C`, `CE`, `L` now become `C` / `L` elements (value from the placed part, a fixture's `model.c` / `model.ic`, an optional `model.rbleed` parallel bleeder = the textbook 1 Gohm).
  New parts: `cap-ideal` (textbook, exact), `cap-charged` (4 uF at 100 V fixture), `pullup-10k`, `logic-in` (LOAD fixtures). The relay (`relay-12v`, RLY macro with pull-in event) is used as a fixed part.
- **`SWT` device** (`devices/swt.ts`): a time-controlled switch (PWL closedness, Ron / Roff). `SupplyDef` kind `contact` (`rig.ts` `contactWave`): the bouncing button (patterns per condition, `key: 'pattern'`) or a plain switch that closes once. `SupplyDef` kind `bench` may carry `fixed` (a rail that the supply keys do not move).
- **`energy` metric** (`measure.ts`): the integral of a probe over the window (`p(sw)` gives joules).
- **Single sweep trace** (`LevelDef.trace`, `TraceDef`, `src/engine/trace.ts`): the capture of a ticket with a trace is ONE screen (256 samples, 10 divisions) from power-on that forms over `SWEEP_FRAMES` = 100 live frames and then holds. Frame length is `10 x timePerDiv / 100`,
  step `frameSim / 4` (`ticket-run.ts` `liveCfg`); a changed circuit, probe, supply or time knob restarts the sweep (`LiveState.sweep` hash). `setScope({timePerDiv})` is the TIME knob (1-2-5 steps; the ticket's `trace.times` is the list the stall offers).
  `trace.mode: 'clip'` shows the CH1 clip's own node (the real 10 Mohm probe is in the circuit); `'auto'` is a built-in clamp on `trace.probe` (3-3's coil current, no clip needed).
- **The tube** (`TubeDef`): `exp` (a Minkowski ribbon around v0 -> vInf with time constant tau, +-dv, +-dt: the same tube as `band.ts`) or `windows` (gates in time and value). LOCK = the sweep is complete, every sample is in the tube, and the `trace.lockSpecs` (bench `metric` / `level` specs) hold on the captured sweep.
- **Capacitor vent across frames** (`live.ts`): the 50 ms over-rating and the 0.5 s reverse rules keep their dwell in `LiveState.dw`, so the live view vents (the bench already did).
- **Plain-words explainers** (`explain.ts`, `explain.*` in `sim.en.ts`): `rc` (loaded: the probe's Thevenin divider; too slow / too fast: the R x C you have and the one you need; first miss = the cause, repeat = the working), `debounce` (many crossings, never, early, late), `coil` (slow, steady, hot),
  `caps` (V(M), V(D), the heat). A burnt part's failure is shown first in `benchResult().failures`.

## New / changed queries

- `scope()` for a ticket with a trace: `trace: { v, t0, dt, progress, complete, bad, tube, inTube, specsOk, specsFail }` (display units: V or mA), `target: { mode: 'trace', unit, scale, vdiv, label, times, timePerDiv, clip, clipped }`, `gauge` (the last sample), `lock`, `lockSpecs`, `sweepText`.
  `tube` is `{ kind: 'exp', lo[256], hi[256] }` or `{ kind: 'windows', windows: [{ t0, t1, lo, hi }] }` (seconds; display units).
- `liveFrame()`: `contacts: [{ id, a, b, closed }]` (bench contacts: the arcade button, the 3-4 switch); a part of kind RELAY carries `relay: { operated, coil, mA }` (the armature, from the RLY state); capacitors carry `cap: { v, q, vrated, vfull }` (the vent top swells with it).
- `chapterMap(3)`: title "Charge", four chits (the exam has `eb`), `starsTotal` 9.
- `ticketCard()`: `supplies` carries `fixed`; an exam hides `level` AND `metric` specs until the predictions are locked; `figure.kind == 'caps'` with `figure.caps` (3-4's two cards). `benchResult()` debrief for 3-4: node `bank`, seven working lines, the energy ledger.
- Part names: `the relay`, `the 100 uF electrolytic capacitor`, `the 3 uF capacitor`.

## Front end (stall)

Code-drawn objects (`godot/world/part_art3.gd`): the electrolytic with its stripe, a vent top that domes as the engine's voltage climbs and pops into four petals, the relay with a clicking armature, the charged can with a level gauge, the exact capacitor, the pull-up, the logic chip,
the arcade button (stands on the board between SW and GND, goes down with the engine's contact) and the knife switch of 3-4. The scope has a time-trace mode (`scope_view.gd`): the engine's samples as phosphor with a fading ghost of the last sweep, the amber tube (green on LOCK),
red samples outside it, the time axis, TIME knob (click / wheel / `,` `.` keys) and VOLTS knob (the vertical scale only). The supply panel lists 3-3's two rails; the codex has nine new pages (capacitance, series and parallel, the time constant, the charging curve, the probe as a circuit part,
electrolytics, filtering a bounce, a coil's time constant, energy); the notebook has chapter tab 3 with its doodle; the customer's line follows the passed state (the ask until the bench passes, then the thanks quoting the measured value).

## Round C3-1 (play-test) additions

- `scope().trace.mark63` on RC / LR tickets (`TraceDef.mark63`): `{level, final, t}` = 63.2 % of the circuit's final value (display units), that final value, and when the sweep crosses it (s, `null` until it does). The scope draws a dashed level and a time cursor.
- 3-2's "never crossed" explainers (`explain.debounce.nopress`, `.norelease`) quote the scope's own sweep (`DebCtx`: start level, lowest during the press, level at the release, highest after it); before a sweep has run they use the exact RC response of the same circuit. The release path through the 10 k pull-up is named.
- 3-3 explainers and the pass note teach tau = L / R.
