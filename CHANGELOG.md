# Changelog

All notable changes to NODE. The release workflow publishes the section whose heading contains `[x.y.z]`.

## [0.1.0] - unreleased
### Novice play-test round N2
- 1-5 exam: the printed problem slip draws the circuit (E1 10 V + R1 2 ohm, E2 5 V + R2 3 ohm into node A, R3 6 ohm to ground, A labelled); the slip stays on the bench as a card you can tap to reopen after "later"; the supply panel lists the textbook sources instead of a 0.0 V bench display; a CH1 clip anywhere on node A counts as clipped on A (it read 0 V on any pad but the brass one).
- Every message names parts ("the LED", "the 100 Ω ¼ W resistor", "LED 2"), never p1/p3. Burn text follows the live circuit and the teaching cadence (first burn: cause + KVL; repeat: worked formula); the 1-1 codex now teaches the LED's 2 V drop (14.9 mA, not 19).
- Coach names a burnt part; measuring steps are optional (1-1, 1-2, 1-3, 1-5) or required (1-4: the bench says "Measure it first"). FIXED tickets reopen to replay; the chit explains the payout. Shoebox scroll arrows. Title spacing. Script errors on the empty-ticket title/notebook path are gone (boot_flow test with an error trap).
### Added
- Project scaffolded from cobanana-core: engine, Godot front-end, CI, Android build.
### Known gaps
- Everything game-specific.
