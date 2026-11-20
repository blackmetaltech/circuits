# NODE chapter 2 "Divide & Measure": what is new in the engine contract

Everything in `docs/API-CH1.md` still holds. This file lists only what chapter 2 added. Level data: `src/data/levels/2-*.ts` (each header documents its deviations from DESIGN §2.8); tests: `src/engine/ch2.test.ts`
(engine) and `godot/tests/ch2_engine_flow.gd` (the stall, through the UI layer).

## The four tickets

| id | customer | what the bench asserts | board | designed fail (tested) | ref |
|---|---|---|---|---|---|
| 2-1 Sensor Reference | Kaya | OUT 3.234-3.366 V (3.30 +-2 %) with the fixed 10 kohm ADC attached; 9.0 V supply | bench supply IN/GND, fixed `adc-in` between OUT and GND, E12 1 k-100 k in 1/4 W | the unloaded divider 5.6 k / 3.3 k reads 2.76 V; the explainer names the load in parallel with the bottom resistor | 15 k over 82 k: 3.355 V at 3.39 mW (2 stars, power par 5 mW) |
| 2-2 Cable Fault | the cable crew | galvanometer within 10 uA of zero at the jockey position the part holds, and the entered distance within 1 % of X / 0.1 ohm per metre | fixed 2 V cell + 1 ohm (fixture), fixed cable loop X (hidden), fixed 100 cm slide wire (A, J, B pads), bin: resistance-box plugs 1 2 5 10 20 (max 2) and the galvanometer | a wrongly wired bridge never nulls; the formula inverted passes the null and fails the distance | R 5 ohm, jockey 400.0 mm, answer 75 m (accuracy 0 ppm, 2 stars) |
| 2-3 Black Box | the sensor shop | your OUT within 2 % of the sealed box's OUT with no load, 100 ohm, 1 kohm, 10 kohm (bench-only test loads on both outputs) | adjustable bench supply (10 mV steps), fixed `blackbox` (hidden EMF and r), E24 10 ohm - 5.1 kohm and a 1 kohm trimmer | matching only the open-circuit voltage passes "open" and fails every loaded test; the bench refuses until the meter has been used | 8.00 V + 1.1 k + 33 ohm (1133 ohm, worst error 0.3 %) |
| 2-4 EB Slide-wire Potentiometer | the exam desk | galvanometer within 19.5 uA of zero at 75.0 cm (open) and at 67.5 cm (4.5 ohm shunt on the cell); three predictions graded 1 % / 5 % | fixed 4 V driver, fixed test cell (1.5 V, 0.5 ohm), fixed slide wire; bin: rheostat 5/10/20 (textbook) and the galvanometer | wrong rheostat changes the gradient and misses both marks | 10 ohm rheostat; gradient 0.02 V/cm, EMF 1.5 V, r 0.5 ohm |

Unlocking (`LevelDef.after`): an entry `a|b` is met by passing either. 2-1 needs `1-4|1-5`; 2-2 and 2-3 need 2-1; 2-4 needs 2-1 and `2-2|2-3`. `ticket.locked` says "Pass 1-4 or 1-5 first".

## New / changed queries

- `chapterMap(2)`: the same shape as chapter 1 (title "Divide & Measure", blurb, four chits with `eb`, `state`, `fee`, `payText`).
- `ticketCard()`: `specShort` (one line for the chit), `answers: [{id, name, unit, entered}]` (numbers the player works out: 2-2's distance), `predictions[].unit` may now be `V/cm` or `ohm`,
  `figure.kind == 'pot'` with `figure.pot` (driverV, rheostat, wireCm, wireOhm, l1Cm, l2Cm, shunt) for the 2-4 slip.
- `bench()`: parts of kind `SLIDEWIRE` carry `pos` (jockey, 0..1 from end A; `null` until first set), `LOAD` (adc-in, cable-loop), `METER` (galvanometer). The slide wire's pins are A, J, B (footprint `slide3`).
- `liveFrame().parts[]`: a galvanometer carries `galvo: {i, uA, needle, fs}` (`needle` = signed current in units of the 50 uA full scale, clamped to +-1.15; positive = current into the + pin).
- `scope()`: the 2-2 / 2-4 gauge is a null detector: `target.unit == 'µA'`, `lo 0`, `hi` the band, `gauge.value` the magnitude (`GaugeDef.abs`); `lock` is the live view of the `ig` spec. 2-3 has no `target` (the bench test decides).
- `coach()`: anchors `jockey` and `supplyv` (the bench supply's voltage keys); coach conditions `answered`, `jockey`, `shorted` (DMM on mA with both leads), `supplyset`, `link:<a>~<b>` (two pins / connectors on one node, `uid.pin` or connector id), `shared:<uid.pin>` (another leg on that pin's node).
- `benchResult()`: `metrics.accuracy` (ppm, 2-2 only), failures `bench.answer.missing` / `bench.answer.fail` (the working with your R and l, never the answer), `bench.match.fail` (explained: the box's output against yours, which way the series resistance is off).
  `debrief` for 2-4: `node: 'wire'`, five working lines (current, gradient, EMF, shunted volts, r), `answer: 'r = 0.5 ohm'`.

## New actions / behaviour

- `setJockey(uid, mm)` (existing) now drives FIXED slide wires too; `predict(id, value)` also takes an answer id (`dist`). `setSupply(v, ilim)` is the 2-3 voltage control (10 mV steps).
- A bench condition may set `key: 'pos'` on a fixed slide wire (2-4 balances at 75.0 and 67.5 cm); `bench.testLoads` adds resistors that exist only in the formal bench run (2-3: the same load on both outputs; 2-4: the shunt across the cell, written `@cell-test#1.+`).
- `runBench(true)`: a ticket with `measureFirst` uses its own refusal key (`measureFirstKey`), 2-3 says "Measure the sealed box first".

## Front end (stall)

Code-drawn objects (godot/world/part_art2.gd): the ADC chip, cable reel, dry cell, galvanometer (needle from `galvo.needle`), the metre slide wire (rule, constantan wire, posts A / B / J, jockey with its flag "40.00 cm" and a flexible lead, the `[-] [step] [+]` keys under the rule),
the sealed module, resistance-box plug, rheostat, trimmer. The bench supply grows `[-] [step] [+]` keys, a two-decimal display and wheel / arrow-key control on 2-3. A foreman's slip on the bench takes the 2-2 distance. The notebook map has chapter tabs; the codex has pages for the divider, loading, Thevenin / Norton, the bridge, null methods and the potentiometer.
