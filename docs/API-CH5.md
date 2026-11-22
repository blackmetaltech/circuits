# CIRCUITS chapter 5 "Switches & Gain": what is new in the engine contract

Everything in `docs/API-CH1.md` .. `API-CH4.md` still holds. Level data: `src/data/levels/5-*.ts` (each header lists its numbers and its deviations from DESIGN §2.8); tests: `src/engine/ch5.test.ts` (engine) and `godot/tests/ch5_engine_flow.gd`
(every ticket through the stall UI with the reference designs and designed naive builds, ErrorTrap zero). Screens: `docs/screens/ch5/`.

## The five tickets

| id | customer | what the bench asserts | designed fails (tested) | ref |
|---|---|---|---|---|
| 5-1 Fan Driver | Kit (maker space) | fan >= 11.0 V with the pin high, <= 0.5 V low, pin <= 20 mA, ratings in the 100 Hz test | no flyback diode (collector 2000 V, transistor fails short); BC547B (0.2 A over 100 mA); Rb 8.2 k / 5.6 k (active region, fan 6.5 / 9.2 V); Rb 47 ohm (58 mA) | 2N2222A + 220 ohm + 1N4007, 8 c, 2 stars (Rb 2.2 k and the TIP120 also pass) |
| 5-2 3.3 V Gate | Tess | strip >= 0.28 A at Vth min / typ / max, FET Tj <= 125 C at 40 C, strip < 50 mA while the pin floats at 1.8 V | 2N7000 (45 mA typical, 0.18 A minimum, 2.9 mA maximum; 0.46 W smokes it); IRF540N (0.15 A, then nothing at 4 V); no pull-down (reset lights the strip) | IRLZ44N + 100 ohm + 100 kohm, 0.30 A |
| 5-3 Gate Builder | Dev (robotics club) | NAND truth table with 0.4 V lows: VOH >= 4.0 V into 10 kohm (3 vectors), VOL <= 0.4 V at 1 mA (A = B = 5 V) | no level-shift diodes (OUT 0.05 V); 47 kohm collector pull-up (0.88 V into the load); no base pull-down (3.95 V) | DTL NAND: 4 x 1N4148, 2N3904, 4.7 k + 10 k + 2.2 k: VOH 4.10 V |
| 5-4 Synth Preamp | Juno (music shop) | gain 8.5 - 11 from the source (output 1.7 - 2.2 Vpp), THD <= 5 %, at beta 100 / 200 / 300 | no RE (THD 38 %); one bias resistor (gain wanders, clips); electrolytics reversed (vent) | 68 k / 10 k, RC 4.7 k, RE 390, 10 uF x 2, 2N3904 or BC547B: gain 9.56, THD 0.26 % |
| 5-5 EB: CE Amplifier | exam desk | predict IB 20 uA, IC 2.00 mA, VCE 6.00 V, Av -232; IC and VCE of the build +-1 % | wrong RB (470 k: IC 2.4 mA) with the arithmetic; wrong predictions: 1 star + the working | 565 k + 3 k + textbook NPN: 3 stars |

Unlocking: 5-1 needs `4-3|4-4`; 5-2, 5-3, 5-4 need 5-1; 5-5 needs 5-1 and one of 5-2 / 5-3 / 5-4. `chapterMap(5)`: "Switches & Gain", 11 stars.

## New engine pieces

- **`SupplyDef` kind `pin`** (`{ id, plus, minus, v, rOut, f?, duty?, sine? }`): the customer's driven pin behind its output resistance (a logic low is NOT 0 V). A condition or selector sets `v`, `r` (the output resistance, `{ target: 'pin', key: 'r' }`),
  `pwm: 1` (switch between `v` and 0 V at `f` with `duty`: the 100 Hz test) or `sine` (a sine of that peak about `v`: the synth line-out).
- **Tolerance conditions**: `{ target: '*tol', key: 'Vt' | 'Bf', value: -1 | 0 | 1 }` puts every placed part that has that datasheet range at its minimum, nominal or maximum (5-2, 5-4).
- **`BenchPlan.only`** (spec id -> condition ids): a spec that applies in some conditions only (5-1 pin high / low, 5-2 reset, 5-3 high and low outputs). `SelectorDef.options[].cond` names the condition a live switch position stands for; the live LOCK and gauge use only the specs that apply there (`liveCond`).
- **`L` with `rs`** (winding resistance, one branch): the `fan-dc` part (kind `MOTOR`, 60 ohm + 10 mH). The stored inductor voltage excludes the resistor's drop.
- **Textbook NPN** `npn-textbook` (the transistor device's `ideal` mode: Vbe 0.700 V, beta 100, Vce(sat) 0.2 V). Fixtures `led-strip` (40 ohm), `amp-load` (47 kohm).
- **Ratings**: an inductive kick counts as an avalanche failure when the transistor was conducting one sample before the spike (`smoke.bjt.avalanche`).
- Explainers (`explain.sw.*`, `explain.fet.*`, `explain.gate.*`, `explain.amp.*`, `explain.ceexam.miss`; the existing `explain.inductiveKick`, `explain.bjt.active`, `explain.mosfet.underdriven`): first miss = the cause, repeat = the working. Debrief node `amp` (6 working lines: the card, the Ebers-Moll reality check, the beta 300 swap).

## Front end (stall)

The bench supply panel carries the live switches (PIN high / low / 100 Hz, THRESHOLD, INPUT A / B, TRANSISTOR GAIN); the fan (blades turn with the winding current), the LED strip (dots glow with the current), TO-220 transistors; four new customers' gadgets (fan, strip, NAND board, synth);
the CE exam figure; the notebook's chapter 5 page (a large hand-drawn sketch and the star total) and eight new Codex pages (a transistor as a switch first).
