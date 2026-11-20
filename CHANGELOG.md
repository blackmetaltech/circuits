# Changelog

All notable changes to NODE. The release workflow publishes the section whose heading contains `[x.y.z]`.

## [0.1.0] - unreleased
### Novice play-test round N3
- 1-5 "reads 0.00005 V": a circuit whose return net never reaches the GND pad is a floating island; the DMM reads between its two leads (6.67 V) while the bench measures from GND (only leakage). The bench now says "your circuit isn't tied to the GND pad" instead of a meaningless number (and hides the prediction truth), the meter notes a floating circuit, and the 1-5 coach has a "tie it to GND" step. Invariant tests: bench V(A) == DMM(A, GND) within 1e-6 relative on every 1-5 build.
- 1-4: the battery holder's terminals take the meter leads (red + / black GND side); the lead tips have a generous grab disc; the coach words match. The customer smiles and the car moves only on a passed bench (a held live band is a neutral "let's see" face).
- DMM LCD: four fixed digit cells (9.000 V, 5.320 V, 14.96 mA, 4.700 ohm), ghost segments aligned. Power: ON / OFF lamp word on the holder and a "Power off." toast.
- Plain words everywhere: no hole coordinates, wire ids or "wire(s)"; proper singular / plural. Tray: a "more" tab on the fold while parts hide below; the 1-2 bench-test tag no longer sits on the battery label. Codex: the critters' speed shows how much current flows (speed follows log current, spacing fixed: verified, DESIGN 5.2).
### Novice play-test round N2
- 1-5 exam: the printed problem slip draws the circuit (E1 10 V + R1 2 ohm, E2 5 V + R2 3 ohm into node A, R3 6 ohm to ground, A labelled); the slip stays on the bench as a card you can tap to reopen after "later"; the supply panel lists the textbook sources instead of a 0.0 V bench display; a CH1 clip anywhere on node A counts as clipped on A (it read 0 V on any pad but the brass one).
- Every message names parts ("the LED", "the 100 Ω ¼ W resistor", "LED 2"), never p1/p3. Burn text follows the live circuit and the teaching cadence (first burn: cause + KVL; repeat: worked formula); the 1-1 codex now teaches the LED's 2 V drop (14.9 mA, not 19).
- Coach names a burnt part; measuring steps are optional (1-1, 1-2, 1-3, 1-5) or required (1-4: the bench says "Measure it first"). FIXED tickets reopen to replay; the chit explains the payout. Shoebox scroll arrows. Title spacing. Script errors on the empty-ticket title/notebook path are gone (boot_flow test with an error trap).
### Added
- Project scaffolded from cobanana-core: engine, Godot front-end, CI, Android build.
### Known gaps
- Everything game-specific.
