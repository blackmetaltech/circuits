# Changelog

All notable changes to CIRCUITS (called NODE until v0.1.0). The release workflow publishes the section whose heading contains `[x.y.z]`.

## [0.3.0] - 2026-11-23 · "Workbench"
A new look: a 3D repair bench. Chapter 1 and the 5-1 fan repair play in it; chapters 2 to 5 stay in the classic 2D stall behind a labelled switch on both title screens. Saves from 0.2.0 load unchanged.

### Added
- The workbench: a lamp-lit desk with an oscilloscope, bench supply, multimeter and parts drawers, real 3D parts (resistors with colour bands, LEDs that light, a PP3 battery, an aquarium heater, transistors, diodes), wires with stripped ends, a scope trace that runs live, smoke and scorch when a part burns. Camera views on keys 1 to 5; right drag orbits, wheel zooms.
- Repair tickets: 1-1 torch, 1-2 bike light, 1-3 heater, 1-4 toy car and 5-1 fan arrive as the customer's faulty device in a case. Open it, probe the old work, fix it, close it and hand it back. The customer's words and thanks are on the paper ticket.
- Burnt parts cost money: a part you burn is billed at its price and comes out of the job's pay (the ticket shows the bill). Parts that arrived burnt are free.
- Free bench: any part from the catalogue on an open board, the supply, scope and meter; save and load builds in three slots.
- Instrument-style controls: a paper repair ticket, a bench control plate with LCD readouts, a parts tray of labelled 3D renders, and a tool rail of keycaps.
- Quality tiers: high (RTX class: shadows, SSR, SSIL, fog, TAA and 4x MSAA), medium, low (integrated GPUs: Compatibility renderer, 75 % 3D scale, FXAA). Measured at 1920x1080 on an RTX 4090, high: chapter 1 powered 5.4 to 5.8 ms; 5-1 unpowered 7.5 ms, 5-1 powered and switching at 100 Hz 23 to 28 ms (the live simulation, not the GPU; measured with other work loading the machine). Ryzen 9900X iGPU, low, 1280x800, 1-1: 15.0 ms avg, 18.9 ms p95. A Graphics row on the title picks the tier and remembers it.
- Saves: chapter 1 progress and the wallet are saved after each job in the new look and continue next time; the new look and the classic stall share one save.
- A Quit key on the new-look title.
- The site (circuits.blackmetal.tech) shows the workbench, and a player wiki is generated from the game's own text (`src/wiki.ts`; a test fails when it is stale): every ticket, its specs, its parts and what a repair arrives with, plus the controls.
- Tests: `src/engine/repair.test.ts`, `src/engine/bench-memo.test.ts`, `src/look2-textures.test.ts`, `src/wiki.test.ts`, `godot/tests/look2_ch1_flow.gd` (chapter 1 end to end in the new look, 67 checks), `godot/tests/look2_save_flow.gd` (save and continue). CI runs both flows; the release smoke check now also opens 1-1 on the workbench.

### Changed
- Level search is about 17x faster on 5-1 and 2x on 4-4: the bench result is memoised exactly, and a board missing a part the specs measure fails without simulating. The whole test suite runs in about 7 minutes on 4 workers (was about 30).
- A bench on an incomplete board names only the missing parts (no rating lines, no smoke). The two 0-0 idle trajectory goldens were regenerated for this, in their own commit.
- Every 3D texture is mipmapped and VRAM-compressed; the screen-space roughness limiter is on.

### Fixed
- The meter read "-305 V" for -305 mV (the prefix was dropped) in both looks.
- From the art and fun reviews: burnt parts are drawn as cold char on every surface (a burnt resistor kept its colour bands); the burn bill shows the moment a part burns; power and meter readouts no longer share one line on the free bench; the case tag and plates no longer glow under the lamp; the arrival tag leaves the desk once the case is open; the work camera shows more of the room.

### Known gaps
- Chapters 2 to 5 are not yet in the new look (classic only; 5-1 is the one showcase).
- No sound in the new look. No gamepad in the new look.
- The meter shows the instant value on a switching node (a real meter averages).
- One hand play by an agent persona; no human has played the new look.
- The bench control plate, parts tray and tool rail still sit as a band of panels across the bottom of the screen (the art review's top finding); they should become objects on the bench.
- The burn bill is small next to the pay (a $0.04 transistor against a $10 job): it informs but does not yet hurt.
- 5-1 switching at 100 Hz costs 23 to 28 ms a frame on a fast desktop: the live simulation needs work before chapter 5 moves to the new look.

## [0.2.0] - 2026-11-22 · "Switches & Gain"
Chapter 5 (five tickets) and the fixes from the 0.1 play-test and screenshot review. Saves from 0.1.0 load unchanged (chapter 5 is simply unlocked by chapter 4).

### Added
- Chapter 5 "Switches & Gain", 23 tickets in all: 5-1 Fan Driver (a 5 V pin drives a 12 V fan through a transistor: forced gain, base resistor, the turn-off kick and the flyback diode), 5-2 3.3 V Gate (a MOSFET lighting a 12 V strip; the bench runs the threshold at its minimum, typical and maximum, then a reset with the pin floating), 5-3 Gate Builder (a NAND from diodes and one transistor, with real 0.4 V logic lows, fan-out and a 1 mA sink), 5-4 Synth Preamp (a common-emitter stage, gain 8.5 to 11 at transistor gains of 100, 200 and 300), 5-5 EB: CE Amplifier (predict IB, IC, VCE and the gain, then build it; the slip works the card out, checks the real junction with the engine's own Ebers-Moll law and swaps beta for 300).
- Engine: a driven pin source (`SupplyDef` kind `pin`: level, output resistance, 100 Hz switching, a sine), tolerance conditions (`*tol`: Vt, beta at their datasheet minimum, typical and maximum), per-condition specs (`BenchPlan.only`) with the live switches knowing which condition they stand for, a winding resistance on the inductor (the fan), the textbook NPN, the LED strip and amplifier-input fixtures. A voltage kick on a transistor that was conducting a sample before is a failure that burns it.
- Plain-words explainers with the engine's own arithmetic for every designed failure of chapter 5 (first miss the cause, repeat the working); eight Codex pages (a transistor as a switch first); a 40-page notebook with a sliding index window.
- Front end: the fan (blades turn with the winding current), the LED strip, TO-220 transistors and FETs, C / B / E legs written under every transistor, customers' gadgets for chapters 4 and 5, the CE exam figure, a larger hand-drawn sketch and the star total on the chapter page.
- Tests: `src/engine/ch5.test.ts` (31), `godot/tests/ch5_engine_flow.gd` (46 checks through the stall UI), `godot/tests/drag_flow.gd` (one-frame drags), layout_flow now also audits the notebook's ticket cards, the customer and every coach slip; docs/API-CH5.md; chapter 5 screens in docs/screens/ch5.

### Changed
- The customer is fully readable (face and the paper or gadget in the hands) at 1920x1080 and 1280x800 and clear of every control.
- Map page ticket cards are 16 px or more with no overlap (the "locked" tag has its own corner); the chapter page's left side holds Wren's note, a large sketch of the chapter's idea, the star key and the stars earned.
- The coach slip never covers the perfboard: a long step writes on a slightly wider paper, then in a smaller hand (never under the text floor); a handheld slip sits lower.
- The scope's lead cables lie under the ticket chit instead of across its text.
- Version shown on the title: v0.2.0.

### Fixed
- After a burn and an undo the coach points at what limits the current (ticket 1-1: the resistor) instead of the power switch; after a 5-1 burn it points at the flyback diode. `burned` is a coach condition.
- A fast press-move-release in the shoebox always places the part: the press now finds its own row (it used to rely on an earlier motion event) and a single motion sample that leaves the box lifts the part even when it is steeper than the scroll rule.
- The headless smoke check (`CB_SMOKE=1`) waits by wall clock for the engine (up to 30 s), stops the engine before quitting and has a 90 s hard stop. The exported 0.2.0 build smoke-runs in about 2 s here (also with six busy loops and piped output), so no hang was reproduced; what could hang before was waiting a fixed number of frames, which headless runs unthrottled.
- A bench or live transient that keeps rejecting steps now ends in a convergence failure (a random 5-1 board made the 100 Hz transient crawl for minutes in the level search).
- The "burned" coach line names a voltage spike or heat as well as current for transistors and FETs.
- The 1-2 coach step is shorter so no step needs more than a handheld slip can hold.

### Known gaps
- Phone layout, a physical gamepad, a human listening to the audio, and Windows and macOS builds were not checked. The chapter 5 parts 2N2222A and BC547B are unverified catalogue rows (the manufacturer's site refuses scripted fetches), listed with the other campaign blockers.
- 5-4's THD is checked by the formal bench only (the scope's LOCK uses the gain). A notebook with 40 Codex pages shows 26 index tabs at a time.
- The three-star tolerance run on build tickets is still not built.

## [0.1.0] - 2026-11-22 · "Four chapters on Lantern Lane"
The first release: the stall, the circuit engine and chapters 1 to 4 (18 tickets). The game was called NODE until this release.

### Added
- Chapters 1 to 4: First Light, Divide & Measure, Charge, Mains & Rectifiers (Wall Wart, Zener Shunt, Hot Regulator, Bench Supply, Exam: Zener Regulator), with a mains safety card, an isolation transformer, a thermal camera and heatsink variants.
- `godot/tests/layout_flow.gd`: a layout audit of all 18 tickets at 1920x1080 and 1280x800 (bubble clear of GO, instruments, tin, exam card and perfboard; chit paper holds its text; coin total inside the window; shoebox names fit; reference designs on screen).
- `godot/tests/save_migrate_flow.gd` and `SaveMigrate`: a save folder from the NODE era is carried over on first start.
- `CB_SMOKE=1` headless check (title, then ticket 1-1: prints SMOKE OK); `scripts/release-local.sh`; the release workflow skips publishing when a release for the tag already exists.
- The version (v0.1.0) is shown on the title screen.

### Changed
- Renamed NODE to CIRCUITS: neon title sign, Godot project name and window title, package name, export presets, app id `in.ixaxaar.cobanana.circuits`, README, docs, site. The repo slug `node-circuits` (engine id, saves, QA harness) and the local folder keep the old name for now.
- Layout: long messages on a handheld are a wide four-line card with its page counter in its own row (none needs more than two pages); the speech bubble sits above the customer's head in a band that touches nothing; the customer sits lower; the coin total stays inside the window; the key hints moved to the top of the board (desktop only); the board view zooms to the used region on seven small tickets; every chit grows to hold its spec (fee line dropped when it would not fit); no text under 16 px on screen; shoebox names step down in size, then use a short name.
- The V+ and GND brass bars on one row no longer cover each other's engraved names.
- The FIXED stamp hangs below the last line instead of over it.

### Fixed (play-test rounds before the release)
### Play-test round C3-1 (diploma student, chapters 2 and 3)
- Wires (rule unchanged and now shown): a wire joins ONLY at its two ends. A wire passing over or alongside another never joins it. `bench()` carries `crossings` (hop-overs, drawn as an arch over a gap) and `joins` (two or more ends on one hole: a silver solder dot); `addWire` / `wire` say "passes over another one: they do NOT touch", "runs alongside", "two wires end on the same hole: joined". Tests: `src/engine/c31.test.ts`.
- 2-2 / 2-4 null detectors (`LevelDef.nullCheck`, `src/engine/nullcheck.ts`): the jockey is swept on a copy of the board; a bench pass needs a REAL sign change of the galvanometer current. A dead bridge (zero everywhere, or one sign everywhere) fails with "The bridge has no balance ..." plus the likely miswiring (cell not across A-B, galvanometer not on the jockey / C); `scope().gauge` gets `slide: 'dead'`, `deadText`, and LOCK stays off; the coach says the same. "Balances at l" is only printed when a null exists. The slip's formula (`ticketCard().answers[].formula`) and the failure working follow the side R is wired on (`X = R (100 - l) / l` or `X = R l / (100 - l)`).
- 3-2: the "never crossed 2.5 V" text is computed from the scope's own sweep (the level OUT fell to, where it stood at the release) and explains the release path: the capacitor recharges through R plus the 10 k pull-up.
- 3-3: tau = L / R teaching (a bigger R rises faster but needs more volts) in the slow explainers and the pass note.
- Scope: RC / LR tickets (`TraceDef.mark63`) draw a dashed 63 % level and a time cursor with its readout (`trace.mark63 {level, final, t}`); the CH1 clip and DMM leads land with a magnet (1.7 pads, 2.3 on a handheld).
- Stall: chit moved clear of the scope readout, the customer bubble grows to fit its sentence, FIXED stamp stays on the chit, tray "more parts below" on an opaque strip, legible scope knob labels on a handheld, exam fields keep every key (echo-flagged or unicode-less), polar capacitor note fixed (the stripe leg is MINUS and goes to the LOWER voltage).
### Chapter 3 "Charge" (tickets 3-1 .. 3-4)
- Four tickets: 3-1 Flash Timer (an RC timer to 6.32 V at 1 s, with the scope probe's 10 Mohm as the hidden lesson), 3-2 Debounce (an RC filter for a bouncing arcade button, four bounce patterns, one crossing per press and per release), 3-3 Relay Pull-in (L/R with a 12 V and a 24 V rail: speed costs watts), 3-4 EB Capacitor Bank (series / parallel, Q = CV, U = 1/2 CV squared, charge sharing and the 12 mJ that heats the switch, with an energy ledger).
- The scope shows the real transient: one sweep from power-on that forms over about three seconds of play and holds, against an amber TUBE (an exp ribbon or allowed windows) that turns green on LOCK; failing samples go red; a working TIME knob (click, wheel, `,` `.`) restarts the sweep on the new scale; a fading ghost of the last sweep; engine-side `scope().trace`, `src/engine/trace.ts`.
- Engine: capacitors / coils expand into the netlist, a time-controlled switch device (the bouncing contact, the charge-sharing switch), contact bounce patterns as bench conditions, fixed rails, an `energy` metric, capacitor vent rules that accumulate across live frames, plain-words explainers for the RC probe loading, the debounce filter, the coil and the capacitor exam, a relay armature and capacitor voltage in the live frame. Details and every deviation from DESIGN §2.8 are in `docs/API-CH3.md` and the level file headers.
- Stall: code-drawn electrolytic (stripe, a vent top that domes with the voltage and pops), relay with a clicking armature, charged can with a level gauge, exact capacitor, pull-up, logic chip, arcade button and knife switch on the board; nine new codex pages; chapter tab 3; the customer's line follows the passed state (the carry-over from chapter 2).
- Tests: `src/engine/ch3.test.ts`, `godot/tests/ch3_engine_flow.gd`, screens in `docs/screens/ch3/`.
### Chapter 2 "Divide & Measure" (tickets 2-1 .. 2-4)
- Four tickets on the engine and the stall, built to the chapter-1 standard (tickets with prices, plain-word fails, coach steps with anchors, exam slip with graded predictions and a debrief, codex pages, stars and fees): 2-1 Sensor Reference (a divider that has to count its 10 kohm ADC load), 2-2 Cable Fault (a metre bridge: slide wire, jockey, galvanometer, resistance box; the answer is a distance in metres), 2-3 Black Box (copy a sealed module with one source and a series resistance, tested at four loads), 2-4 EB Slide-wire Potentiometer (gradient, EMF, internal resistance; two balance marks).
- Engine: `match` and `answer` checks, bench-only test loads, per-condition jockey positions, `LOAD` fixtures, a `slide3` footprint, `accuracy` metric, `a|b` unlock lists (chapter 2 opens after 1-4 or the 1-5 exam), galvanometer needle in the live frame, coach conditions `link` / `shared` / `answered` / `jockey` / `shorted` / `supplyset`. Details and every deviation from DESIGN §2.8 are in `docs/API-CH2.md` and the level file headers.
- Stall: code-drawn slide wire with a jockey you drag (and nudge with keys, arrows and the wheel, 0.1 mm), galvanometer, sealed module, ADC chip, cable reel, resistance-box plug, rheostat, trimmer, dry cell; the bench supply gets voltage keys on 2-3; a crew slip for the 2-2 distance; the notebook map has chapter tabs; six new codex pages.
- Tests: `src/engine/ch2.test.ts`, `godot/tests/ch2_engine_flow.gd`.
### Novice play-test round N4 (impatient 13-year-old, handheld 1280x800)
- 1-5 is about the prediction, not the wiring: E1 and E2 arrive with their minus ends already soldered to the GND pad (`fixedWires`, ids fw1 / fw2, not removable: right-click says "soldered in place"); the player places R1 R2 R3 and draws 6 wires. The A and GND pads are engraved on their brass bars in large dark letters (GND with a ground symbol, A with a cyan ring); the sources read "E1 10 V" / "E2 5 V".
- The bench never tests a dark bench: GO with the power switch off switches it on (engine `runBench(true)` -> `autoPowered`; click, toast "the power was off: I switched it on"), tested in vitest and in the Godot flow.
- Wires: a Dijkstra fallback router crosses wires (hop-overs) and goes around legs and wire ends, so "no clean route ... draw it in two steps" is gone; pads take any number of wires; the two refusals no route can fix (same two pads already joined; an end under another wire's middle) have their own plain sentences. A drag that starts on a part's lead (between its leg and its body) always draws a wire; only the body drags the part. Finger-sized reach on handheld.
- Burn text is frozen at the instant of the burn (`live.notes`): adding a resistor afterwards no longer rewrites the note with the new resistor and the old milliamps (the "604 mA with a 220 ohm" note). Ctrl+Z (and replace) after a burn brings the part back fresh with the power OFF, so "Burned again" only fires once the power is on again. Undo / redo toasts are plain words ("Undid: placed the 470 Ω ¼ W resistor."); "Ctrl+2" typo fixed.
- Shoebox: one list of rows (value + watt rating on one line, price and stock under it), scrolled by wheel, drag and swipe (with inertia), thin track and fades; no paging tabs.
- Teaching: 1-3 says the heater is a fixed 50 ohm element needing 7.85 to 8.4 V and a required coach step has the player measure it with the DMM; the 1/4 W burn note explains P = I²R in the series resistor; the 1-2 tired-battery fail explains why a smaller resistor helps.
- Handheld (window under 1500 px wide, or CB_LAYOUT=handheld): all ticket, tray, part, notebook and toast text is raised to 16 screen px (`StallStyle.min_font`), bigger chit, 54 px tray rows, fatter leg and lead-tip reach, larger rocker hit area. Notebook: one tap opens it, Esc / the X / a click outside closes it, a click inside the book does not; Esc on the bench no longer opens it.
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
- Saves: a NODE-era save folder is copied to the new name on first start (nothing deleted); a copy that already exists is never overwritten.
- After Ctrl+Z of a burn the coach goes back to "flip the power switch" instead of staying on "add a limiting part".
- A very fast press-move-release (one frame) can drop a part drag; slow drags work. Seen under heavy load only.
- The scope lead and supply cable can lie across the chit text; a long coach slip (six lines) covers the bottom board rows; map chit text is under 16 px.
- No phone build, no gamepad pass, nobody has listened to the audio, no Windows or macOS build was run. Tolerance star not built. Chapter 4 has had no fresh tester.

