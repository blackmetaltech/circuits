# NODE: game design document (v0.1 build spec)

| | |
|---|---|
| Repo / slug | `node-circuits` · title **NODE** · Android id `in.ixaxaar.cobanana.node` · engine port 47904 · Xvfb :260-:279 |
| Teaches | Current electricity, capacitors, inductors, AC and resonance, semiconductors and logic (Class 11-12 / pre-university physics: NCERT XII, JEE, A-level, AP Physics C, IB HL). ECE circuit analysis, op-amps, filters, oscillators, power basics, ratings and thermals |
| Stack | Deterministic TS engine (`src/`, MNA solver on `cobanana-core` numerics) behind the JSON-lines protocol, with a Godot 4.7 GDScript front-end, as in GIGAWATT |
| Author | Level-1 design director (Opus), 2026-11-09. Research workers: Sonnet ×4, Haiku ×1. Provenance is marked in §4 and §9 |
| Status | Build-ready after the level-1 review (2026-11-09, see `REVIEW.md` and `BUILD-PLAN.md`). Anything still marked **[R]** came from recall and must be checked against the cited datasheet before data entry (see §4.0) |
| Region packs | v0.1 ships the neutral **`global`** pack (US$, IEC 60038 230 V 50 Hz, neutral setting). The original India-first content is preserved as the draft **`in`** pack (Appendix A). A test-only **`na`** pack (120 V 60 Hz) proves the seam. See §12 |
| Scale | NODE is **component-scale** (a perfboard, parts, mA/V, µF, Ω; transients, waveforms, Bode sweeps). GRID is **system-scale** (buses, km-long lines, plants, MW/MVAr, kV, pu). The boundary is the binding table in `design/grid/DESIGN.md` §2.8, mirrored in §1.8 below |

Conventions: SI units everywhere in the engine. "Spec" means the customer's pass criteria. "Bench" means the formal test run. "Live" means the always-on simulation while building. A level id `3-2` means chapter 3, level 2. **EB** means exam bridge.

---

## 1. Pitch, fantasy, framing

### 1.1 One line
**Fix the city's gadgets with real components. Make the green trace sit inside the band, and don't let anything smoke.**

### 1.2 The fantasy and the frame
*(This is the `global` region pack's framing. The original India-first framing, Signal Gully and Meera Aunty, is preserved verbatim as the
draft `in` pack in Appendix A. Every name, place and flavour line below is region-pack data (§12), never engine code.)*

You inherit **Wren's repair stall, Stall 14, Lantern Lane**: a covered arcade of repair stalls in a fictional harbour city, a narrow
lane under tangled cables, hand-painted signs and rain awnings. Wren has retired to the coast. She left you her bench, her oscilloscope (a beautiful
old green-phosphor CRT), a shoebox of parts and her **notebook**, which is the game's Codex. Customers walk up to the counter with
broken or missing circuits: a dead torch, a guitar preamp, a wall-wart that hums, a radio that won't tune, a 3D printer's hot
end, a school science-fair thermostat, an e-bike workshop's 5 V rail, a street musician's synth. Every job is a **ticket**: a
spec card plus a **target band** drawn on your scope. You build on a perfboard, power it up, and watch.

Why this frame:
- It is a *game* and not a lab. You are someone who can fix anything, and every success has a face: the customer, their gadget and their reaction.
- Every spec is realistic: real gadgets with real loads, mains tolerance (the pack's mains: `global` = 230 V ±10 % 50 Hz, the IEC 60038 nominal used by most of the world), battery sag and heat inside a box.
- The repair stall is universal: every city has a lane of phone-and-radio fixers, and nobody needs a passport to read it. It is warm without being a postcard.
- It supports an upgrade loop that is also the syllabus: new instruments (2-channel scope, function generator, thermal camera,
  Bode plotter) arrive as the concepts that need them arrive.
- **Scale**: one bench, one gadget at a time. NODE is the component-scale sibling of GRID (which runs whole networks); a 12 V wall-wart is NODE, the substation feeding the street is GRID (§1.8).

Tone: warm, funny, slightly melancholic notebook voice ("Wren: *Every resistor is a promise about heat.*"). Customers have short
voices (as GIGAWATT's named customers did). There is no combat, no timer pressure in Learner mode, and no loot.

**Mains safety framing (user decision 4: mains tickets stay).** Every ticket that touches mains (4-1, 4-3's transformer, 7-1) opens with a
mandatory, non-skippable-on-first-view **safety card** in Wren's hand: "On a real bench, mains work needs training, an isolation transformer
and a second person. Here the bench is simulated, so you can learn what real engineers fear, without the risk." The isolation transformer is a
visible object on the bench for those tickets, the mains section of the board is drawn behind a red hatched keep-out with a "HIGH VOLTAGE" silkscreen,
and the Codex page "Mains safety and isolation" is unlocked before the first such ticket. No mains ticket ever instructs the player to build
anything at home; the Bench Card for a mains ticket carries a small "simulated mains: do not try this at home" ribbon.

### 1.3 The hook (first 60 seconds)
1. A kid at the counter: "My torch died." On the bench: a 9 V battery, a red LED and three resistors.
2. You drag the LED straight onto the battery, which almost everyone does. **Pop.** A puff of magic smoke rises, the LED goes black
   and the notebook opens: "*It drew 0.60 A. A red LED is rated for 0.03 A. Something has to limit the current: a resistor.*"
   The number is the real one from the Shockley model.
3. You add a 470 Ω resistor. Current dots start to flow along the traces, the LED glows, and the scope shows a flat line that settles inside
   the band. The register goes *ka-ching*.
4. The histogram slides in: your cost, part count and power against everyone's. "Could you do it cheaper?"

**Smoke, then understanding, then mastery, then sharing.** The equation (V = IR, P = I²R) is the only way to stop the smoke. The learning *is* the mechanic
(Habgood and Ainsworth); attempt first, explain after (productive failure, Sinha and Kapur 2021).

### 1.4 Why it is shareable
- **Histograms** after every ticket (cost US$, part count, power mW, board area), Zachtronics-style, from **real players' verified solutions** via the shared `cobanana-scores` service (§11). Offline or empty, the game shows a clearly labelled fallback (§11.5).
- **Bench Card**: a one-tap PNG of your board render, the scope trace locked in its band, and your stars and histogram markers. A 6-second
  WebM/GIF of the power-on (dots start to flow, the trace sweeps into the band) suits short-video platforms.
- **Hall of Smoke**: an auto-clip of your most spectacular failure, such as an electrolytic venting or a 7805 thermal-cycling, with the number that
  killed it ("P = 5.0 W into a TO-220 with no heatsink: 310 °C"). Fail clips spread faster than success clips.
- **Solution codes**: a compact, versioned code (§11.2) carrying the ruleset id, the ticket id and the board, shown as a QR code on the Bench Card. It loads into the same ticket (or Sandbox) and is what the leaderboard server re-verifies.
- **Audible circuits**: the 555 buzzer and the finale synth *sound* like the simulated waveform. "Tune it to A440" makes a natural clip.

### 1.5 Comparables and the gap
Shenzhen I/O, TIS-100, Turing Complete, nandgame, MHRD, Silicon Zeroes and Logic World are digital or programming games. Opus Magnum and SpaceChem
are optimisation puzzles with fictional rules. Falstad CircuitJS, EveryCircuit and PhET CCK are simulators without goals, stakes or
progression. *101 Circuits* (Steam, Oct 2026, $8.99) and *Oscilloscopia* are the closest: waveform-matching on a scope. Neither has a
smoke or ratings mechanic, a syllabus-mapped curriculum (JEE/NCERT in the `in` pack, generic pre-university tags in `global`), a mobile build or explanations tied to the player's own failure (the comparables scan found
no confirmed smoke mechanic anywhere). NODE's wedges are **ratings and thermals as the fail state**, **robustness (tolerance) as
mastery**, **exam bridges**, **verified online histograms**, and **phone + Deck + desktop parity**.

### 1.6 Session shapes
| Platform | Typical session | Shape |
|---|---|---|
| Desktop (1080p-4K, mouse) | 30-90 min | 4-8 tickets plus histogram chasing. The board is large and the scope and Bode plotter are docked side by side |
| Steam Deck (1280x800, pad) | 15-40 min | 2-5 tickets. Grid-snapping cursor, radial part picker, scope in a right drawer. Suspend and resume at any time (autosave on every action) |
| Phone (2424x1080 landscape, touch) | 3-8 min | One ticket per sitting: commute-sized. Each ticket fits in ≤ 15 parts and a board ≤ 20x12 pads. A finger-sized part picker sits at the bottom and the scope drawer on the right |

Every v0.1 ticket can be solved in under 10 minutes by someone who understands it. The median first-attempt time is targeted at 3-12 minutes (§9.10).

### 1.8 NODE vs GRID: the boundary (binding; mirrors `design/grid/DESIGN.md` §2.8)
| | **NODE** (this game) | **GRID** |
|---|---|---|
| Scale | component: one board, parts, mA/V, µF, Ω | system: buses, lines, plants, substations, MW/MVAr, kV, pu |
| Time scale | transients (RC/RL/LC ringing), waveforms, Bode sweeps | 50 Hz phasor steady state, electromechanical seconds, 15-min operation |
| AC content owned | reactance as a part property; **series LCR resonance, Q and bandwidth (7-3, 7-5)**; filters (7-2, 7-4); rectifiers and the **mains wall-wart transformer** (4-1); capacitive dropper (7-1); op-amps | power factor and capacitor banks at feeder scale; transformers as network elements (taps, %Z); 3-phase; grid harmonics/resonance; series compensation; generators, load flow, stability, protection |
| Shared, framed differently | phasors across parts on the scope; NCERT AC formulas as solver oracles (AC-0x stay in both games' test suites: shared physics, not shared content) | phasors at a bus, the power triangle |
Consequences for NODE: no NODE ticket teaches power-factor correction, transformer taps or 3-phase; the Codex "power factor & average power" entry is
framed at the part ("average power in an LCR is I²R; the capacitor and inductor only borrow energy") and links to GRID for feeder-scale correction.
Both Codexes use the same phasor wording: **φ = the angle by which V leads I** (so in 7-5 φ = −53.13°, "current leads"). Cast names do not overlap
with GRID (Ada Moreno, Tobi Hart, Commissioner Vance, Nia), LENSCRAFT (Noor, Pip) or EQUILIBRIUM (Mara Quinn, Tomas Brandt, Victor Hale, Noor Haddad):
NODE's mentor is **Wren** and its customers are Lio, Ash, Mr. Brook, Bo, Kaya, Sami, Mrs. Dale, Iris, Juno.

### 1.7 Juice and retention checklist (added by the review; each item is an M4 task with a screenshot or clip as evidence)
- **Minute 1** (1-1): the smoke must land within 40 s of opening the ticket; first power-on has a CRT warm-up (trace blooms from the centre, 0.4 s), dots
  accelerate in, LED bloom; smoke = pop + puff + char decal + a 120 ms camera shake (off with reduced motion); the notebook slides in with the real number.
- **Band lock** is the core reward: trace eases into the amber ribbon, ribbon turns green, VFD "LOCK" with a chime, a 1-frame phosphor flash. Every pass, not just the first.
- **Pass**: customer reaction stinger + ka-ching + coins counter-roll; stars stamp onto the paper ticket one by one (each with its own pitch); the histogram strip slides
  in with the player marker dropping onto it.
- **Fail** is never a wall of text: the failing trace samples flash red on the scope, the bench report names one thing first ("LED current 7.2 mA, wanted 10-20"), and the
  "Why?" link opens the explainer with your numbers.
- **10-second clips** (Bench Card capture targets): 1-1 smoke then fix; 4-3 regulator thermal cycling on the scope and thermal camera; 7-5 VC exceeding the supply on the
  scope; 8-5 synth tuned to A440 with the speaker playing.
- **Reason for hour 2**: the stars you missed (★2 par, ★3 tolerance), the live histogram ("top 31 %"), the chapter you skipped into via its EB, and the finale's
  synth you can play in Sandbox. Stretch: encore tickets.
- **Anti-homework rules**: no ticket opens with more than 3 lines of brief; EB tickets are optional for progression; every chapter has at least one ticket with a
  visible object payoff (a fan spins, a relay clacks, a radio station comes in through the hiss, a synth sings).

---

## 2. Loops, modes, campaign, levels

### 2.1 Core loop (per ticket, 2-15 min)
```
 read ticket (customer + spec card + target band on scope)
   → place parts from the bin onto the perfboard, wire pads, set values
   → LIVE: the circuit is always simulated. Current dots flow, nodes take voltage colours, parts warm up and the scope draws
   → probe nodes / tweak values / watch heat   ← smoke? → notebook explains with YOUR numbers → undo or replace part
   → RUN BENCH (formal test: several conditions, ratings check, settle, compare to band/metrics/masks)
   → pass → stars + histograms + payment + Bench Card     fail → bench report names the failing item with numbers
```

### 2.2 Secondary loops
- **Optimise**: re-enter a passed ticket to beat cost, part count, power or area. Each metric has its own histogram and its own best record.
  Optimising teaches real engineering trade-offs (series LEDs vs parallel, 1/8 W vs 1/4 W, dual op-amp package vs faster single, buck vs linear).
- **Robustness (tolerance star)**: a seeded Monte Carlo run with resistors ±5 % (±1 % if metal film is chosen), capacitors ±10 % (electrolytic −20/+20 %),
  BJT β across the datasheet min-max range, MOSFET Vth min-max and battery internal resistance fresh-to-tired. Pass all samples to earn the star. This
  is the "real engineer" layer that Learner hides and Engineer shows.
- **Exam bridge**: predict first, then build and probe (§2.5).
- **Encore tickets** (post-chapter): the same customer returns with a variant whose hidden parameters are seeded per save, such as a different battery
  internal resistance, a different black-box Thevenin network or a different load. Answers can't be looked up, which gives replayability.

### 2.3 Meta-progression
- **Wallet (US$ in `global`; the currency is pack data)**: tickets pay a fee (bigger for harder tickets, plus a bonus per star). It funds bench upgrades and cosmetic stall items. In Engineer mode, parts cost
  money and a smoked part is lost money. In Learner mode, money only buys upgrades and parts are free. Nobody can be soft-locked: the "Wren's shoebox"
  stash covers every reference solution.
- **Bench upgrades = syllabus pacing** (each unlocks with its chapter, can be bought early with money and comes with a short Codex lesson):

| Upgrade | Unlock | Does |
|---|---|---|
| Multimeter (DMM) | start | Volts, amps and ohms. 10 MΩ input; ammeter burden 0.1 Ω with a 400 mA fuse that you *can* blow |
| Oscilloscope CH1 | start | Single channel, 10x8 divisions, auto/normal trigger |
| Bench supply (CV/CC) | ch2 | 0-15 V adjustable with a current limit, the safe way to short things |
| Oscilloscope CH2 + cursors | ch3 | Second channel, Δt/ΔV cursors and measurements (freq, Vpp, mean, rise) |
| Function generator | ch3 | Sine/square/triangle/pulse, 0.1 Hz-1 MHz, 0-10 Vpp, 50 Ω output |
| Isolation transformer | ch4 | Lets you probe mains-derived circuits ("never without one on a real bench") |
| Thermal camera | ch4 | Overlay of part temperatures (always on in Learner) |
| Bode plotter | ch7 | Gain/phase sweep (AC analysis) with the spec mask |
| Frequency counter + speaker monitor | ch8 | 6-digit frequency readout. Hear any node |

- **Reputation**: each of the 8 customer families tracks stars earned. At thresholds you get their encore tickets and a postcard (cosmetic).
- **Stall cosmetics**: signage, lamps, a radio, the stall cat (Resistor, "Rezzy"), a tea mug that steams. Cosmetic only.

### 2.4 Modes
| | **Learner** | **Engineer** | **Sandbox** |
|---|---|---|---|
| Physics and spec tolerances | identical | identical | identical (no spec) |
| Coach | yes, steps from real state (§7.1) | off (toggle) | off |
| Readouts | hover any node or part for V, I, P and temperature; ratings bars on parts | only what your probes and meters measure; hover shows part name and value only | full |
| Smoke | Rewind 5 s free (time-scrub) | part destroyed; replacing costs money | free |
| Hints | 3-rung ladder: nudge → equation with your numbers → partial build | available; the result is marked "assisted" (no histogram entry) | n/a |
| Tolerance star | hidden | shown and required for 3 stars | optional run |
| Parts | E12, curated bin | E12 + E24 from ch4, full bin per level | everything unlocked, ≤ 80 parts / 64 nodes |
| Money | parts free | parts cost money, smoke costs money | free |

Learner never lowers the bar on physics. It adds scaffolding (in-game support d = 0.34; enhanced scaffolding +0.41, per RESEARCH.md).

### 2.5 Exam bridge (EB) mechanic: "predict, then probe"
One EB closes every chapter (8 in v0.1). The ticket is styled as a printed exam problem (serif type, figure, exam-style numbers). Which exam set is used is **region-pack data** (§12): `global` ships neutral pre-university exam-style cards (our own numbers, sources cited in the Codex); the draft `in` pack carries NCERT/JEE cards, where real NCERT/JEE quotes are allowed with sources (user decision 1).
1. **Predict**: enter 1-3 numbers (numeric keypad, units shown) before touching the board. Each prediction is scored: within 1 % earns ★, within 5 % is accepted, anything else is shown with the gap.
2. **Build**: wire the textbook circuit from a fixed **Textbook bin** of *ideal-model* parts that match the textbook's idealisation (ideal sources, constant-0.7 V
   diode, ideal Zener, ideal op-amp). The bench verifies the circuit's topology by measuring the asked quantities.
3. **Probe**: the scope or DMM shows the real answer. Your prediction is overlaid.
4. **Reality check** (one tap): swap to real-part models (1N4007 Shockley, 2N3904 Ebers-Moll, TL072 macro) and see how far the textbook idealisation is off.
   For example, SC-04: 0.7 V assumed vs 0.673 V real. This is explicit transfer between the exam answer and the real bench.
EB stars: ★ every prediction within 5 %, ★ every prediction within 1 %, ★ built correctly on the first bench run.

### 2.6 Stars, metrics, histograms
- **Stars per build ticket**: ★1 passes the bench. ★2 meets par on the ticket's *headline metric* (cost unless stated otherwise). ★3 passes the tolerance Monte Carlo.
- **Metrics** (all four recorded on every pass, each with a histogram):
  - **Cost (pack currency; US$ in `global`)**: sum of the pack's catalogue prices of the parts on the board (wires and the level's fixed connectors are free). `global` price = US$ at qty 100 from a named distributor listing, or a labelled game estimate where no listing could be verified (§4.0). Cost histograms are per ruleset, because prices are pack data.
  - **Parts**: count of placed components (wires and jumpers excluded).
  - **Power mW**: mean power drawn from all of the ticket's supplies, averaged over every bench condition. Lower is better. For power-delivery tickets, the
    headline metric is **efficiency %** instead.
  - **Area**: bounding box of all placed parts and wires in pads (w × h), like PCB size.
- **Histograms v0.1**: real, **online** per-ticket, per-metric histograms of verified solutions from the shared `cobanana-scores` service (user decision 2; full spec in §11). The player's marker is drawn on it. Offline, the last cached histogram is shown with its date; with no data at all, the labelled empty-state fallback of §11.5 is shown.
- **Par** per metric is fixed in the level file and does **not** move with the live population (stars must be stable and verifiable offline): par = the 35th percentile of the solver-bot population computed at build time by `scripts/calibrate-levels.ts` (§9.5), committed in the level file. Reference solutions must meet par. The live histogram is for bragging, the par is for stars.

### 2.7 Campaign: 8 chapters, 40 tickets designed (32 build + 8 EB); **35 must-ship** in v0.1
| Ch | Title (customer family) | Syllabus (generic tags; the `in` pack maps them to NCERT chapters) | Tickets (must-ship · *stretch*) | Instruments unlocked |
|---|---|---|---|---|
| 1 | **First Light** (neighbours, kids) | Ohm's law, series/parallel, power, LEDs, EMF and internal resistance, max power transfer, Kirchhoff | 1-1…1-5 | DMM, scope CH1 |
| 2 | **Divide & Measure** (college lab, sensor shop) | Dividers and loading, Wheatstone bridge (cable-fault locating), potentiometer, Thevenin/Norton (Hayt ch4-5) | 2-1…2-4 | bench supply |
| 3 | **Charge** (camera shop, relay board) | Capacitors, RC charging, energy, RL transients | 3-1…3-4 | CH2, function generator |
| 4 | **Mains & Rectifiers** (wall-wart repairs) | Transformers, RMS vs peak, diodes, bridge rectifiers, smoothing, Zener, linear regulators, thermals | 4-1…4-5 | isolation transformer, thermal camera |
| 5 | **Switches & Gain** (maker space) | BJT/MOSFET switches, flyback, logic gates, CE amplifier, bias stability (Sedra-Smith) | 5-1…5-5 | n/a |
| 6 | **Op-Amp Alley** (music shop) | Inverting/non-inverting, GBW, slew, rails, comparator and Schmitt trigger, integrator (Sedra-Smith ch2) | 6-1, 6-2, 6-3, 6-5, 6-7 · *6-4, 6-6* | n/a |
| 7 | **Tone & Resonance** (radio repair) | Reactance, RMS, RC filters and Bode, series LCR resonance and Q, active 2nd-order filters (Sedra-Smith ch17) | 7-1, 7-2, 7-3, 7-5 · *7-4* | Bode plotter |
| 8 | **Oscillate** (street musician, e-bike workshop) | 555 astable, RC phase-shift oscillator, buck converter, synth voice finale (Horowitz & Hill) | 8-1, 8-4, 8-5 · *8-2, 8-3* | frequency counter + speaker |

**Scope rule (review decision).** **Must-ship = 35 tickets** (27 build + all 8 EB; the finale 8-5 is a build ticket) that cover the whole
Class 11-12 current-electricity, capacitor, AC and semiconductor syllabus plus the op-amp basics, and that need **no** PWM driver, no oscillator
start-up kick and no 50 kHz switching. The **5 stretch tickets** (6-4 slew, 6-6 integrator, 7-4 Sallen-Key, 8-2 phase shift, 8-3 buck) are fully
specified here and are built in M3 only after the 35 must-ship tickets pass every gate; each is also a clean v0.2 drop. Title updated: "8 chapters,
40 tickets designed, 35 must-ship".

Unlocking (review decision, to stop the campaign feeling like homework): chapters unlock sequentially. Within a chapter the first ticket must be
passed, then the rest unlock together, so a stuck player has alternatives. The **next chapter unlocks after any three passes in the current
chapter** (the EB counts as one, but is never required). The EB unlocks when two build tickets in its chapter are passed. Any chapter can also
be unlocked early by passing its EB from the chapter select ("prove it" skip for players who already know the material).

### 2.8 Ticket catalogue (every v0.1 level)
Field legend. **Spec** is what the bench asserts on the level's *fixed connectors* (IN, OUT, GND, V+…, drawn as a brass edge connector the bench
clips onto, so the player cannot move the probe point). **Cond** lists the bench conditions; every spec must hold in every condition. **Bin** is the parts available
(E12 means a 10 Ω-1 MΩ E12 resistor family at ¼ W unless noted). **Fail** lists the designed failure modes. **Ref** is the reference solution the expert persona replays
(numbers checked by the director in Python or by the oracle workers). **Head** is the headline metric for ★2. Default bench ambient Ta = 25 °C. Scope probes
are modelled as 10 MΩ (as a real ×10 probe is) in every mode. Bands marked ~ are design targets that `calibrate-levels` must confirm solvable and
non-trivial (§9.5). A change of more than 10 % needs director sign-off.

#### Chapter 1: First Light
**1-1 Torch** (tutorial; Lio, age 10). *Teaches:* KVL, Ohm's law, current limiting, LED forward voltage.
- Spec: LED current 10-20 mA (measured by the bench's internal ammeter in the LED leg). The LED visibly lit (I ≥ 2 mA) is cosmetic.
- Cond: 9 V PP3 alkaline battery (EMF 9.0 V, r = 1.7 Ω: Duracell MN1604, 1 kHz; review-verified range 1.7-2.1 Ω).
- Bin: red 5 mm LED; resistors 100, 220, 470, 1k (¼ W).
- Fail: LED straight on the battery draws 0.60 A, 20× its 30 mA absolute maximum, so the die cracks and smokes instantly. 100 Ω gives 64 mA, over the rating, and the LED smokes after a few seconds of thermal time;
  220 Ω gives 31 mA (just over the 30 mA rating: Warm glow, fails the 20 mA spec). 1k gives 7.2 mA and fails the spec ("too dim").
- Ref: 470 Ω, I = 14.95 mA (review refit of the red LED to the Kingbright WP7113ID I-V curve: N 2.0, Is 1.19e-17 A, Rs 9.9 Ω; battery r 1.7 Ω; reviewer-computed). 390 Ω (E12, not in this bin) gives 17.9 mA.
- Head: cost. Coach: 6 steps (§7.1).

**1-2 Tail-light** (Ash, cyclist). *Teaches:* series vs parallel, shared current, battery current.
- Spec: each of 3 red LEDs 14-20 mA. Battery current ≤ 25 mA (Engineer ★2 is power).
- Cond: 9 V battery, fresh (r 1.7 Ω) and tired (EMF 8.4 V, r 6 Ω).
- Bin: 3 red LEDs, E12 resistors ¼ W.
- Fail: three parallel LEDs on one resistor share it (identical fits in v0.1 share equally), but the battery current triples and fails the spec. Three resistor-LED branches pass the LED spec
  but fail the battery-current spec.
- Ref (review-recomputed with the refit LED): all three LEDs in series with **150 Ω** gives 19.65 mA fresh and 16.1 mA tired ✓. 120 Ω gives 23.4 mA fresh ✗; 180 Ω gives 14.0 mA tired ✗ (13.99, just under). The band is tight by design (E12 neighbours fail on both sides); `calibrate-levels` must confirm the 0.35 mA margin at 20 mA survives the final LED fit, else widen the spec to 13.5-20 mA.
- Head: power.

**1-3 Hot Resistor** (Mr. Brook's 12 V aquarium heater controller). *Teaches:* P = I²R = V²/R, power ratings, parallel sharing of dissipation.
- Spec: load (50 Ω heater element, fixed on the board) voltage 8.0 V ±0.3 V. No part over its rating.
- Cond: 12.0 V bench supply.
- Bin: 22, 27, 47, 51, 100 Ω, each in ¼ W, ½ W and 1 W (each rating is a different part with its own price).
- Fail: one 22 Ω ¼ W resistor gives 8.33 V but dissipates 0.61 W against 0.25 W rated. It glows, then smokes at about 2.6× rating (§3.9). 27 Ω gives 7.79 V (out of band).
- Ref A: 22 Ω 1 W (8.33 V, 0.61 W). Ref B (cheaper): two 47 Ω ½ W in parallel = 23.5 Ω (8.16 V, 0.31 W each).
- Head: cost. This is the first ticket where cost and rating conflict.

**1-4 Tired Battery** (Bo's toy-car battery tester). *Teaches:* EMF, internal resistance, terminal voltage, maximum power transfer.
- Spec: power into the heater load (your choice of resistor) ≥ 4.20 W.
- Cond: a "tired" 9 V pack, EMF 9.0 V, internal r **hidden** (Learner fixed at 4.7 Ω; Engineer and encore seeded in 3.3-8.2 Ω). The player measures open-circuit
  voltage and loaded voltage with the DMM to find r.
- Bin: power resistors 2.2-10 Ω E12, in 1 W (cheap) and 5 W.
- Fail: R far from r. At r = 4.7: 3.3 Ω gives 4.18 W ✗, 3.9 Ω gives 4.27 W ✓, 4.7 Ω gives 4.31 W (max), 5.6 Ω gives 4.28 W ✓, 6.8 Ω gives 4.16 W ✗ (director-checked).
  Using a 1 W resistor smokes it (4.3 W).
- Ref: R = nearest E12 to r, 5 W. Head: cost.

**1-5 EB: Two Batteries** (NC-04). Problem card: "E1 = 10 V with R1 = 2 Ω and E2 = 5 V with R2 = 3 Ω feed a common node A, with R3 = 6 Ω to ground. Find V(A) and the current
through E2. Is E2 charging or discharging?"
- Predict: V(A) = 6.667 V. I(E2) = 0.5556 A *into* E2 (charging).
- Build: Textbook bin (ideal sources, exact resistors). Bench checks V(A) ±0.1 % and I(R3) = 1.111 A.
- Reality check: replace E2 with a NiMH cell model (r = 0.1 Ω) and the currents shift.

#### Chapter 2: Divide & Measure
**2-1 Sensor Reference** (Kaya's weather-station ADC). *Teaches:* voltage divider, loading, Thevenin intuition, power vs accuracy.
- Spec: OUT = 3.30 V ±2 % into the ADC input (a fixed 10 kΩ load on the board).
- Cond: 9.0 V supply. (A divider's output scales with the supply, so a battery-sag condition is deliberately *not* used here. That lesson returns in 4-2 with the Zener.)
- Bin: E12 ¼ W.
- Fail: the unloaded divider formula ignores the 10 kΩ load. For example, 5.6k/3.3k is a correct ratio unloaded but gives 2.76 V loaded ✗. Very low R values waste power (Engineer ★2 = power).
- Ref: 17 E12 pairs pass (reviewer re-counted). The lowest power is R1 = 15 kΩ, R2 = 82 kΩ → 3.355 V at 3.39 mW (review fix; 15k/68k gives 3.308 V at 3.42 mW). The obvious 6.8k/6.8k gives 3.358 V at 7.5 mW, and 2.7k/1.8k gives 3.249 V at 19 mW. The load does most of the dividing,
  so the cheapest-power design puts a large R2 "in parallel with" the load.
- Head: power.

**2-2 Cable Fault** (the street's buried phone cable has shorted somewhere; the crew wants to know where to dig). *Teaches:* Wheatstone balance P/Q = R/S, metre bridge, null method.
*Review change (fun critic): same bridge physics as the original "Mystery Resistor" lab ticket, but X is now the loop resistance of the cable from the stall to the short (0.1 Ω per metre of cable, two conductors), so the answer is a distance and the payoff is the crew digging at your mark and finding the fault (or not).*
- Spec: enter the distance d = X / (0.1 Ω/m) within ±1 % (X within ±1 %), *and* at the submitted jockey position the galvanometer current must be |Ig| < 10 µA (proof that you balanced).
- Cond: X hidden (Learner 7.5 Ω; Engineer seeded 2-20 Ω). Fixed bin: 100 cm slide wire (10 Ω total), resistance box (1, 2, 5, 10, 20 Ω plugs), galvanometer
  (100 Ω, ±50 µA full scale, with a visible needle), 2 V cell with 1 Ω rheostat.
- Fail: a wrongly wired bridge never nulls (the needle always deflects one way). Choosing R so that the balance lands near one end amplifies reading error. Engineer adds ±0.5 cm jockey reading
  resolution, so a balance in the middle of the wire scores best (this teaches why lab manuals say "keep the null point near the middle").
- Ref: R = 5 Ω, balance at l = 40.0 cm, X = R(100−l)/l = 7.5 Ω (NC-07), so d = 75.0 m. Head: accuracy (score = |error|, leaderboard metric `accuracy_ppm`).

**2-3 Black Box** (sensor shop: "Replace this sealed module"). *Teaches:* Thevenin/Norton equivalents, open-circuit voltage, short-circuit current.
- Spec: your replacement (one adjustable source plus series resistance) must match the black box's OUT voltage within ±2 % at loads of 100 Ω, 1 kΩ, 10 kΩ and open.
- Cond: hidden network. Learner: 12 V, R1 = 1 kΩ series, R2 = 2 kΩ shunt, R3 = 470 Ω series out, so Vth = 8.000 V and Rth = 1136.7 Ω. Engineer and encore: seeded values.
  The player has the bench supply (0.01 V steps) and E24 resistors plus a 1 kΩ trimmer (unlocked for this ticket).
- Fail: matching only the open-circuit voltage passes "open" and fails 100 Ω. Measuring Isc with the DMM on the 10 A range is legal. Measuring it on the 400 mA range blows the meter fuse in a seeded case with Isc > 0.4 A.
- Ref: supply 8.00 V + 1.1 kΩ + 33 Ω (E24) = 1133 Ω (−0.3 %). Head: parts.

**2-4 EB: Slide-wire Potentiometer** (NC-08b). Problem card: "Driver cell 4 V, rheostat 10 Ω, wire 100 cm, 10 Ω. A cell balances at 75.0 cm on open circuit and at 67.5 cm
when shunted by 4.5 Ω. Find its internal resistance."
- Predict: wire gradient 0.02 V/cm, EMF 1.500 V, r = 0.500 Ω.
- Build: Textbook bin. The bench checks balance lengths ±0.1 cm.
- Reality check: an actual driver cell with r = 0.3 Ω. The gradient changes, but the ratio method still gives r (why the null method is robust).

#### Chapter 3: Charge
**3-1 Flash Timer** (camera shop: "the flash ready-light must come on after 1 s"). *Teaches:* RC charging, τ = RC, 63.2 % at t = τ.
- Spec: V(OUT) crosses 6.32 V at t = 1.00 s ±5 % after power-on (the 10 V supply steps at t = 0 and the capacitor starts at 0 V).
- Bin: E12 ¼ W; electrolytic capacitors 1, 2.2, 4.7, 10, 22, 47, 100, 220, 470, 1000 µF (16 V/25 V).
- Fail: R·C off by an E-series step. **Loading**: 1 MΩ with 1 µF looks correct (τ = 1 s), but the 10 MΩ scope probe forms a divider (Vth = 9.09 V, Rth = 0.909 MΩ), so the crossing is at 1.08 s ✗.
  This is a hidden lesson about input impedance. A 6.3 V capacitor overvolts at 10 V and vents.
- Ref: 10 kΩ + 100 µF 16 V (1.000 s). Also valid: 4.7k + 220 µ, 2.2k + 470 µ, 22k + 47 µ (each 1.034 s). Head: cost.

**3-2 Debounce** (arcade-button repair). *Teaches:* RC low-pass in time, threshold crossing, why bouncing contacts need filtering.
- Spec: OUT crosses the 2.5 V logic threshold exactly once on press and once on release (no re-crossings), and each crossing lands 5-20 ms after first contact.
- Cond: fixed on the board: a switch to GND with a 10 kΩ pull-up to 5 V (node SW); the player builds R from SW to OUT and C from OUT to GND (review: topology made explicit). The bench drives the switch with a bouncing contact (PWL: 6 bounces of 0.1-0.4 ms over 2 ms, then solid; release bounce mirrored; 4 seeded bounce patterns as conditions); logic input 1 MΩ.
- Bin: E12, ceramic and electrolytic capacitors 10 nF-10 µF, 1N4148 (optional asymmetric charge).
- Fail: τ too small passes every bounce through (multiple crossings). τ too large crosses after 20 ms.
- Ref (review ngspice): **47 kΩ + 330 nF**: press crosses at 10.6-11.5 ms, release at 13.7-14.7 ms (the pull-up adds to R only on release), ≥ 5.3 ms margin on both sides. 10 kΩ + 1 µF also passes (7.2-8.0 / 14.3-15.2 ms) but its release margin shrinks to ≈ 1 ms under component tolerance, so it fails ★3. Head: parts.

**3-3 Relay Pull-in** (Sami's greenhouse irrigation controller). *Teaches:* RL rise, τ = L/R, the "L/R drive" trick, power cost of speed.
- Spec: coil current reaches the pull-in current 40 mA within 0.40 ms of switch-on. Steady coil current 50-66 mA (coil rated 60 mA). No part over its rating.
- Cond: relay coil L = 100 mH, R = 200 Ω (fixed). The board offers 12 V and 24 V rails.
- Bin: E12 resistors in ¼ W, ½ W and 1 W.
- Fail: 12 V alone gives τ = 0.5 ms and pull-in at 0.549 ms ✗. 24 V alone gives 120 mA, so the coil overheats (smoke). 24 V + 200 Ω ¼ W makes the resistor smoke (0.72 W).
- Ref: 24 V + 200 Ω 1 W gives pull-in 0.275 ms and steady 60 mA. 24 V + 180 Ω 1 W gives 63.2 mA and 0.264 ms (director-checked). Head: power. Lesson: speed costs watts.

**3-4 EB: Capacitor Bank** (CAP-01 + CAP-02). Card (a): "2 µF in series with (3 µF ∥ 6 µF) across 110 V. Find the charge and the total energy." Card (b): "A 4 µF capacitor at 100 V is connected to
an uncharged 6 µF. Find the final voltage and the energy lost."
- Predict: Q = 180 µC, U = 9.90 mJ; V = 40.0 V, loss = 12.0 mJ.
- Build: Textbook bin (1 GΩ bleed resistors are built into the ideal capacitors for the DC operating point, see §3.4). The bench measures steady state and the energy ledger.
- Reality check: the energy ledger shows the loss turning up as heat in the switch resistance whatever R is (vary R to see it).

#### Chapter 4: Mains & Rectifiers
**4-1 Wall Wart** (Mrs. Dale's hum-y 12 V adapter). *Teaches:* transformer ratio, RMS vs peak, diodes, bridge rectifier, ripple ≈ I/(2fC), capacitor voltage ratings, mains tolerance.
- Spec: OUT ripple ≤ 1.0 Vpp and mean ≥ 12.0 V at a 100 mA load. Capacitor voltage within rating at no load.
- Cond: pack mains at −10 % / nominal / +10 % (`global`: 207 / 230 / 253 V rms 50 Hz) through a mains:12 V rms transformer (primary follows the pack, §12.3; ideal ratio + winding R 1.5 Ω). Loads: 100 mA (constant-current load), 0 mA.
- Bin: 1N4007 ×4, 1N4148, electrolytics 220-4700 µF in 10/16/25/35 V, a bleeder resistor (optional).
- Fail: half-wave needs about 2000 µF (2200 µF costs more). A diode backwards blocks the output or shorts the bridge (then the transformer winding overheats). A 16 V capacitor is over its rating at high mains: the no-load peak is 17.4 V (review ngspice run), so the bench fails it on the rating check and it shows Warm/bulging; it would vent only above 1.2 × 16 = 19.2 V, so the explainer says "over rating", not "vented" (review fix).
  1N4148s in the bridge exceed IF(AV) 150 mA during charging surges.
- Ref: 4×1N4007 bridge + 1000 µF 25 V. Review ngspice (doc's diode model, 1.5 Ω winding): mean 12.62 / 14.28 / 15.94 V and ripple 0.75-0.77 Vpp at 207 / 230 / 253 V (re-run 2026-11-10 with the catalogue Vishay 1N4007 model; the first run with the design values gave 12.54 / 14.20 / 15.86); the I/(2fC) = 1.0 V estimate is pessimistic because the capacitor discharges for less than a full half-period. 680 µF gives 1.10-1.13 Vpp ✗, so 1000 µF is the cheapest pass in `global`. **`na` (120 V 60 Hz) ref: 680 µF 25 V** (0.92-0.94 Vpp at 120 Hz ripple; mean 12.52 V at 108 V) as `refByRuleset`, with a Codex note on why 60 Hz needs less capacitance. Head: cost.

**4-2 Zener Shunt** (radio needs a 5.1 V rail). *Teaches:* Zener breakdown, series-resistor design for worst-case input and load, Zener power.
- Spec: OUT 5.1 V ±5 % for loads 0-30 mA.
- Cond: input 13 V and 17 V (DC), loads 0 and 30 mA.
- Bin: E12 resistors in ¼ W, ½ W and 1 W; 1N4733A (5.1 V, 1.3 W per Vishay), BZX55C5V1 (0.5 W).
- Fail: R too big drops out of regulation at 13 V and 30 mA. R too small overheats the Zener at 17 V and no load. A ¼ W series resistor smokes.
- Ref: R = 220 Ω (Rmax = (13−5.1)/(30+5 mA) = 225.7 Ω). Iz,min = 5.9 mA at 13 V/30 mA. Pz,max = 276 mW at 17 V/no load, so BZX55 is OK. P_R = 0.64 W, so a 1 W resistor is needed (checker-verified).
- Head: cost.

**4-3 Hot Regulator** (3D-printer controller board). *Teaches:* linear regulator dissipation (Vin−Vout)·I, θJA/θJC/θSA, heatsinks, pre-drop resistors, transformer taps.
- Spec: OUT 5.00 V ±4 % at 0.1-0.5 A. Tj ≤ 125 °C in steady state at **Ta = 40 °C** ("inside the printer").
- Cond: unregulated input from a 15 V DC rail (the 9 V tap can be selected instead: ≈ 11.1 V peak with ripple); loads 0.1 and 0.5 A.
- Bin: LM7805 (TO-220, θJA 54 °C/W, θJC 4 °C/W, shutdown above 150 °C, per TI LM340 SNOSBT0L), heatsinks θSA 25/15/8 °C/W (pad θCS 0.5), power resistors 2.2-22 Ω 5 W.
- Fail: no heatsink: P = 5 W gives Tj = 40 + 5·54 = 310 °C. In practice thermal shutdown at 150 °C makes the output **cycle on and off**, which you see on the scope and the thermal camera. The 15 °C/W heatsink gives 137.5 °C ✗ (checker: 142.5 with θJC 5). The 9 V tap dips below dropout (7 V) in the ripple troughs at 0.5 A.
- Ref A: 8 °C/W heatsink gives 102.5 °C. Ref B (cheaper, cost head): 10 Ω 5 W pre-drop + 15 °C/W heatsink gives 7805 Tj = 40 + 2.5·19.5 = 88.8 °C. The resistor dissipates 2.5 W, inside its 5 W rating. Head: cost.

**4-4 Bench Supply** (your own bench: set the LM317 to 3.3 V). *Teaches:* feedback regulation, Vout = 1.25(1 + R2/R1) + Iadj·R2, minimum load current.
- Spec: OUT 3.30 V ±1 % at loads 0, 10 and 500 mA.
- Cond: Vin 9 V. Ta 25 °C (the heatsink is fitted).
- Bin: LM317 (Vref 1.25 V, Iadj 50 µA, min load 3.5 mA typ, per TI SLVS044Z), E24 resistors.
- Fail: large resistors (for example 2.4k/3.9k) let the regulator's own quiescent current (which can't be sunk) raise OUT at 0 mA load. The model makes this emerge (§3.7), and it teaches why datasheets say R1 = 240 Ω. The formula without the Iadj term misses by about 0.6 % with large R2.
- Ref: R1 = 240 Ω, R2 = 390 Ω gives 3.3008 V (checker-verified). Head: parts.

**4-5 EB: Zener Regulator** (SC-02). Card: "12 V supply, Rs = 300 Ω, 6 V Zener with Iz,min = 2 mA. Find Iz at RL = 1 kΩ and the minimum RL."
- Predict: Iz = 14.0 mA, RL,min = 333 Ω (and Pz at no load = 120 mW).
- Build: Textbook bin (ideal Zener). The bench checks I(Rs) = 20 mA ±1 %.
- Reality check: 1N4733A-style Zzt = 7 Ω, so OUT now moves about 0.1 V across the load range.

#### Chapter 5: Switches & Gain
**5-1 Fan Driver** (maker space: a 5 V microcontroller pin must run a 12 V fan). *Teaches:* BJT as a saturated switch, forced β, base resistor, inductive kick, flyback diode.
- Spec: fan voltage ≥ 11.0 V when the pin is high and ≤ 0.5 V when low. Pin current ≤ 20 mA. No part over its rating at 100 Hz on/off.
- Cond: pin = 5 V source with 25 Ω output resistance (abs max 40 mA: "pin damaged"). Fan = 60 Ω + 10 mH (200 mA). PWM test 100 Hz 50 %.
- Bin: 2N2222A (Ic 600 mA), BC547B (Ic 100 mA), TIP120, 1N4007, 1N4148, E12.
- Fail: BC547B exceeds Ic 100 mA. Without a flyback diode the turn-off spike passes Vceo 40 V, so the transistor fails short (instant). Rb too large (**≥ 5.6 kΩ**; review ngspice: 2.2 kΩ still saturates the 2N2222A at forced β ≈ 105) leaves the transistor in its active region: at 5.6 kΩ Vce ≈ 3 V, P ≈ 0.43 W, fan ≈ 9 V ✗; at 8.2-10 kΩ P ≈ 0.6 W, over the 625 mW TO-92 rating,
  so it overheats. Rb too small exceeds the pin's 20 mA.
- Ref: 2N2222A, Rb = 220 Ω (pin current 17.2 mA, fan 11.96 V, Vce(sat) 44 mV, flyback-clamped peak 12.8 V; review ngspice), 1N4007 flyback across the fan. Alternative: TIP120 with Rb = 2.2 kΩ: Vce(sat) 0.83 V in the macro, fan 11.17 V, marginal by 0.17 V on the 11 V spec (the datasheet's 2.0 V is a max at 3 A, so a real part may fail: the Codex says so). Head: cost.

**5-2 3.3 V Gate** (LED strip from a 3.3 V board). *Teaches:* MOSFET threshold, Rds(on) vs Vgs, logic-level FETs, conduction loss I²·Rds.
- Spec: strip current ≥ 0.28 A (strip = 40 Ω at 12 V, so 0.3 A nominal). FET Tj ≤ 125 °C at Ta 40 °C. Gate-drive pin 3.3 V.
- Cond: Vth at its datasheet min, typ and max (the tolerance sweep is mandatory here as a *condition*, because this is the lesson).
- Bin: 2N7000 (Vth 0.8-3 V, 5 Ω max at 10 V, ID 0.2 A, PD 0.4 W, θJA 312.5 °C/W, per Vishay 70226), IRLZ44N (Vth 1-2 V, 25 mΩ at 5 V, 35 mΩ at 4 V, per Infineon), IRF540N
  (Vth 2-4 V, not logic level), gate resistors, 100 kΩ pull-down.
- Fail: 2N7000 at 3.3 V (review-recomputed with Kp refit to the verified 2.4 Ω typ at 10 V): at typical Vth 2.1 V it saturates at ≈ 38 mA (strip spec ✗) with ≈ 10.5 V across it, P ≈ 0.40 W → Tj ≈ 40 + 0.40 × 312.5 ≈ 165 °C, so it overheats and smokes; at Vth min (0.8 V) it passes ≈ 165 mA with P ≈ 0.9 W and smokes fast. IRF540N at max Vth barely conducts (fails the strip-current spec). A missing pull-down floats the gate,
  which is flagged as a DC-floating node and refused by the bench (§3.10).
- Ref: IRLZ44N + 100 Ω gate resistor + 100 kΩ pull-down. Rds ≈ 49 mΩ at 3.3 V (Level-1 fit), P ≈ 4 mW. Head: cost.

**5-3 Gate Builder** (school robotics club). *Teaches:* diode logic (OR, AND), transistor NOT, NAND as a universal gate, logic levels and fan-out (NCERT XII ch14; JEE syllabus).
- Spec: build Y = NOT(A AND B). For all four input vectors: VOH ≥ 4.0 V with 10 kΩ to GND (fan-out load) and VOL ≤ 0.4 V while sinking 1 mA.
- Cond: A, B ∈ {**0.4 V**, 5 V} driven by the bench (a real logic "0" is not 0 V; review: with ideal 0 V inputs the missing-diode failure never shows); Vcc 5 V.
- Bin: 1N4148 ×4, 2N3904, E12.
- Fail: missing level-shift diodes let a 0.4 V input low turn the transistor on (review ngspice: with 0 diodes OUT collapses already at a 0.2 V input; with 2 diodes VOH holds up to a 0.8 V input low). Pull-up too weak fails VOH under the 10 kΩ load. Base pull-down missing gives slow or weak turn-off.
- Ref (DTL): two input diodes to node P, 4.7 kΩ pull-up to P, two series 1N4148 to the base, 10 kΩ base to GND, 2N3904 with 2.2 kΩ collector pull-up. VOH = 5·10/12.2 = 4.10 V. Head: parts.

**5-4 Synth Preamp** (music shop: a synth line-out needs ×10). *Teaches:* CE amplifier, voltage-divider bias, emitter degeneration Av ≈ −RC/(RE + re), input impedance, coupling capacitors, headroom.
- Spec: gain from source EMF **8.5-11** (|Av|; review: widened from 9-11 so the ★3 Monte Carlo is passable with E12 parts), output not clipped (THD ≤ 5 %) at 100 mV peak 1 kHz, into a 47 kΩ load.
- Cond: 9 V single supply; source 600 Ω.
- Bin: 2N3904, BC547B, E12, capacitors 1-100 µF.
- Fail: RE = 0 gives huge gain and clipping. Base bias set by a single resistor gives a gain that wanders with β (the ★3 Monte Carlo over β 100-300 fails). Input impedance ignored gives the gain lost in the 600 Ω divider. Wrong polarity on the electrolytics (reverse > 1 V) vents them.
- Ref: R1 = 68k, R2 = 10k, RC = 4.7k, RE = 390, coupling 10 µF in/out. IC = 1.03 / 1.12 / 1.16 mA and gain from the source EMF **9.37 / 9.53 / 9.58** for β = 100 / 200 / 300 (review ngspice; the original 10.5 ignored the 600 Ω source against the ≈ 7.9 kΩ input impedance, which is exactly this ticket's lesson). THD 0.27 %. Monte Carlo (5 % R, β 100-300) 8.86-10.42 → ★3 passes the 8.5-11 band. Head: parts. ★3 requires the β sweep to pass.

**5-5 EB: CE Amplifier** (SC-04). Card: "VCC = 12 V, RB = 565 kΩ, RC = 3 kΩ, β = 100, VBE = 0.7 V. Find IB, IC, VCE and the voltage gain."
- Predict: IB = 20.0 µA, IC = 2.00 mA, VCE = 6.00 V, Av = −gm·RC = −232.
- Build: Textbook bin (fixed-0.7 V BJT model). Checks ±0.5 %.
- Reality check: Ebers-Moll gives VBE = 0.6727 V, IC = 2.005 mA, VCE = 5.986 V, gain −232.7 (oracle and checker agree). Also: "now swap β = 300": IC triples and the transistor saturates (why fixed bias is fragile).

#### Chapter 6: Op-Amp Alley
**6-1 Mic Preamp** (busker's mic). *Teaches:* inverting amplifier, virtual ground, Av = −Rf/Rin.
- Spec: gain −47 ±5 % at 1 kHz, 10 mV peak in. OUT unclipped.
- Cond: ±12 V; TL072.
- Bin: TL072, E12.
- Fail: feedback to the + input makes it latch to a rail (positive feedback). Rf/Rin = 47 needs an E12 pair: 100k/2.2k = 45.5 (−3.3 %) ✓, 470k/10k = 47 ✓.
- Ref: 470k/10k. Head: parts.

**6-2 Sensor Buffer** (pH probe with 100 kΩ source impedance). *Teaches:* non-inverting amplifier, input impedance, why followers exist.
- Spec: OUT = 2.00 × sensor EMF ±1 % (EMF 0.2-1.0 V DC).
- Cond: source impedance 100 kΩ. TL072 ±12 V.
- Fail: an inverting stage with Rin = 10 kΩ divides the signal by 11 first, giving 91 % error.
- Ref: non-inverting, 10k/10k. Head: cost. (v0.1 does not model input bias currents; Codex note.)

**6-3 Bandwidth** (studio mic preamp: 40 dB flat to 20 kHz). *Teaches:* GBW, closed-loop bandwidth = GBW/gain, cascading stages.
- Spec: Bode mask: 39-41 dB from 20 Hz to 20 kHz. Below 20 Hz it is unconstrained.
- Cond: ±12 V, AC analysis.
- Bin: LM358 (dual, GBW 0.7 MHz, SR 0.3 V/µs, per TI SLOS068AB), NE5532 (dual, GBW 12 MHz typ per TI SLOS075 Table B1, review-verified), E12, coupling capacitors.
- Fail: a single LM358 at gain 100 has −3 dB at 7 kHz (−9.6 dB at 20 kHz) ✗.
- Ref A (cost): both halves of one LM358, two inverting stages of gain −10 (10k/100k). BW 70 kHz each, −0.34 dB each, **total −0.68 dB** at 20 kHz → 39.32 dB ✓ (review-corrected: the original −0.34 counted one stage; the 0.32 dB margin is thin, so `calibrate-levels` must confirm with the macro and E12 tolerances, else widen the mask to 38.5-41 dB). Ref B: single NE5532 stage. Head: cost.

**6-4 Big Swing** (amp for a piezo actuator: 20 Vpp at 50 kHz). *Teaches:* slew rate, full-power bandwidth f = SR/(2πVp), output swing vs rails.
- Spec: OUT 20 Vpp ±5 % sine at 50 kHz, THD ≤ 3 %, from a 4 Vpp input (gain 5).
- Cond: ±15 V.
- Bin: LM741 (SR 0.5 V/µs), TL072 (SR 13 V/µs typ, 8 min per SLOS080W), NE5532, E12.
- Fail: LM741 turns the sine into a triangle (needs 3.14 V/µs) ✗. On ±12 V rails, swing headroom clips ✗ (cond offered in Engineer).
- Ref: TL072, 40k/10k (E24: 39k + 1k, or 47k ∥ 270k). Head: cost.

**6-5 Thermostat** (science-fair incubator: heater on below 47 °C, off above 53 °C). *Teaches:* comparator, NTC thermistor, positive feedback, hysteresis (Schmitt trigger).
- Spec: as temperature sweeps 40 → 60 → 40 °C with 20 mV noise on the sensor, OUT toggles **exactly once** each way: off between 51 and 55 °C rising, on between 45 and 49 °C falling.
- Cond: NTC 10 kΩ at 25 °C, B = 3950 (R(47) = 4.02 k, R(50) = 3.59 k, R(53) = 3.21 k, review-confirmed). LM393 open-collector comparator, 5 V.
- Bin: NTC, LM393, E12, 10 kΩ trimmer.
- Fail: no hysteresis chatters dozens of times in the noise ✗. A missing pull-up on the open collector leaves OUT stuck low.
- Ref (review ngspice): NTC on top, 3.6 kΩ to GND, sensor to the − input (OUT high = heater on), 10k/10k reference to + with **82 kΩ** positive feedback from OUT, 4.7 kΩ pull-up: off at 52.8 °C rising, on at 47.0 °C falling (≈ 2 K margin each side); 100 kΩ also passes (52.3 / 47.5 °C). With 5 % parts both drift out, so ★3 needs metal-film or the trimmer. Head: parts.

**6-6 Ramp** (function generator repair: square to triangle). *Teaches:* integrator, Vpp = Vin·T/(2RC), DC drift, why a resistor across C.
- Spec: OUT triangle 2.0 Vpp ±10 % at 1 kHz, centred 0 V ±0.3 V, steady after 50 ms.
- Cond: IN square ±1 V **with +50 mV DC offset** (a sloppy generator). TL072 ±12 V.
- Fail: a pure integrator drifts into a rail because of the offset ✗.
- Ref: Rin = 11 kΩ (E24), C = 22 nF, Rf = 56 kΩ across C. DC gain −5.1, so the output offset is 0.255 V ✓. The corner at 129 Hz is well below 1 kHz, so the output is a
  near-triangle of exponential segments: Vpp = 2·Vin·(Rf/Rin)·tanh(T/(4RfC)) = 2.04 V ✓ (director-checked). Without Rf the offset drifts into the rail ✗. With Rf ≤ 22 kΩ the shape rounds and fails the band. Head: parts.

**6-7 EB: Summing Amp** (OA-03 + saturation). Card: "Inputs 1.0 V/10 kΩ, 2.0 V/5 kΩ, −0.5 V/20 kΩ; Rf = 10 kΩ; ±15 V supply. Find Vout. What if every input doubles? Triples?"
- Predict: −4.750 V; −9.50 V; −14.25 V. The ideal model says −14.25 V; with ±15 V rails and TL072 swing the real answer clips at about −13.5 V.
- Build: Textbook (ideal op-amp with ±15 V rails). Reality check: the TL072 macro clips about 1.5 V from each rail.

#### Chapter 7: Tone & Resonance
**7-1 Nightlight** (capacitive-dropper LED nightlight, the two-dollar market-stall classic). *Teaches:* capacitive reactance Xc = 1/(2πfC), RMS current, mains safety rules.
- Spec: dropper current **8.5-12.0 mA rms** in every mains condition (review: widened from 9-12 so the `na` pack at 120 V 60 Hz also has exactly one passing E-series capacitor). LED average ≥ 3 mA. **Safety inspector** rules: bleeder ≥ 470 kΩ across the capacitor, X2-rated capacitor (275 VAC), surge resistor ≥ 47 Ω ½ W.
- Cond: pack mains −10 % / nominal / +10 % (`global`: 207/230/253 V rms 50 Hz), *through the isolation transformer* (the ticket opens with the mandatory mains safety card of §1.2).
- Bin: X2 film 0.1/0.15/0.22/0.33/0.47 µF (275 VAC), LEDs, 1N4148/1N4007 (anti-parallel), resistors.
- Fail: 0.33 µF gives 23.8 mA and LED overcurrent. A ceramic 50 V capacitor at mains peak fails (instant). No reverse diode means the LED takes the full reverse mains peak (−325 V in `global`), breaks down and fails.
- Ref (`global`): 0.15 µF X2 (Xc = 21.2 kΩ): review ngspice gives 9.75 / 10.84 / 11.92 mA rms and LED average 4.4-5.4 mA at 207/230/253 V; 0.1 µF gives 6.5-8.0 ✗ and 0.22 µF 14.3-17.5 ✗. 1 MΩ bleeder, 100 Ω ½ W surge resistor, LED + anti-parallel 1N4148.
  **`na` ref (120 V 60 Hz)**: 0.22 µF: 8.95 / 9.95 / 10.94 mA rms, LED average 4.0-4.9 mA ✓ (0.15 µF 6.1-7.5 ✗, 0.33 µF 13.4-16.4 ✗). Head: cost.

**7-2 Hiss Cut** (cassette deck: telephone-band low-pass). *Teaches:* RC low-pass, fc = 1/(2πRC), −3 dB and −45°, Bode plot reading, loading.
- Spec: Bode mask: 20 Hz-1 kHz within −1…+0.5 dB; the −3 dB crossing **relative to the 20 Hz gain** between 3.23 and 3.57 kHz (review: made explicit; measured absolutely the crossing is 3.21 kHz and would fail); ≥ 34 kHz below −19 dB.
- Cond: OUT feeds a 100 kΩ amplifier input.
- Bin: E12, ceramic capacitors E6.
- Ref: 4.7 kΩ + 10 nF. Rth = 4.49 kΩ, fc (relative) = 3.545 kHz (margin 0.7 % to the 3.57 kHz edge), passband −0.40 dB at 20 Hz and −0.73 dB at 1 kHz, −20.1 dB at 34 kHz (reviewer-computed). Head: cost.

**7-3 AM Tuner** (Iris brings in her grandad's transistor radio). *Teaches:* series LCR resonance f0 = 1/(2π√LC), Q = ω0L/R, bandwidth, selectivity.
- Spec: response peak at 1.000 MHz ±1 %. Neighbour station at 1.020 MHz at least 6 dB down.
- Cond: antenna source with 10 Ω; output across C into a high-impedance detector.
- Bin: variable capacitor 10-365 pF (dial), coils: "cheap" 220 µH with ESR 25 Ω, "litz" 220 µH with ESR 4 Ω (costs more), resistors.
- Fail: the cheap coil gives total R 35 Ω, Q = 39.5 and only 5.5 dB rejection ✗. The litz coil gives R 14 Ω, Q = 98.7 and 12.3 dB rejection ✓ (reviewer re-computed, output across C). Tuning C wrong misses f0.
- Ref: litz coil, C = 115.1 pF. Head: cost.

**7-4 Hum Killer** (guitar amp hum: −30 dB at 50 Hz). *Teaches:* 2nd-order active high-pass (Sallen-Key), Butterworth Q = 0.707, 40 dB/decade.
- Spec: Bode mask: ≤ −30 dB at 50 Hz; −1…+0.5 dB from 1 kHz to 10 kHz.
- Cond: TL072 ±12 V.
- Fail: a first-order RC can't meet both (the corner would have to sit exactly at about 500 Hz; with E12 it is impossible) ✗. Wrong Q gives a peaky response that breaks the +0.5 dB ceiling.
- Ref: unity-gain Sallen-Key HP with C = 100 nF ×2, R1 = 3.9 kΩ (to output), R2 = 7.5 kΩ (to ground) (E24), fc ≈ 300 Hz, Q ≈ 0.69. calibrate-levels confirms. Head: parts.

**7-5 EB: Series LCR** (AC-04). Card: "100 V rms, 50 Hz; R = 30 Ω, XL = 40 Ω, XC = 80 Ω. Find |Z|, I, the phase, VL and VC, and the average power."
- Predict: 50 Ω, 2.00 A, current leads by 53.13°, VL = 80 V, **VC = 160 V (more than the supply!)**, P = 120 W (checker-verified).
- Build: Textbook bin. Probe VC on the scope and watch it exceed the source amplitude.
- Reality check: a real capacitor rated 100 VAC would fail here. Ratings matter even in theory problems.

#### Chapter 8: Oscillate
**8-1 Blinker** (cargo-trike turn indicator). *Teaches:* 555 astable, t_high = 0.693(R1+R2)C, t_low = 0.693·R2·C, duty cycle.
- Spec: f = 2.00 Hz ±5 %, duty 60-70 %, LED current 10-20 mA.
- Cond: 9 V and 12 V supply (the 555 timing is ratiometric, so both pass, which is a Codex lesson).
- Bin: NE555 (4.5-16 V, ±200 mA output, per TI), E24 resistors, electrolytics, LEDs.
- Ref: R1 = 22k, R2 = 24k, C = 10 µF gives 2.061 Hz and duty 65.7 % (director-checked), plus 470 Ω LED resistor. Head: cost.

**8-2 Phase Shift** (sine source for a tuning fork demo). *Teaches:* Barkhausen criterion, RC ladder phase, f = 1/(2π√6·RC), gain 29.
- Spec: sustained oscillation at 1.00 kHz ±5 %, ≥ 2 Vpp, THD ≤ 10 %, steady within 200 ms of power-on.
- Cond: TL072 ±12 V. Start-up: the engine injects a deterministic 1 mV impulse at t = 0+ on the op-amp's input node (documented in the Codex: "real oscillators start from noise").
- Fail: Rf < 29R decays to nothing ✗. Rf ≫ 29R gives a square-ish waveform and THD fails ✗.
- Ref: R = 10 kΩ, C = 6.8 nF (f = 955.5 Hz, −4.4 %), Rf = 330 kΩ (gain 33) with soft clipping by anti-parallel 1N4148s across part of Rf. calibrate-levels checks THD. Head: parts.

**8-3 Buck** (EV workshop: 5 V for the dashboard from 12 V, efficiently). *Teaches:* switching converter, D ≈ Vout/Vin, ΔI = (Vin−Vout)·D/(f·L), output ripple, efficiency vs linear.
- Spec: OUT 5.0 V ±3 % at 0.25 and 0.5 A. Ripple ≤ 100 mVpp. **Efficiency ≥ 80 %** (headline). Inductor current below Isat.
- Cond: 12 V; a "PWM driver" part (fixed 50 kHz, duty set by a 10-turn dial, ideal floating gate drive, a named simplification).
- Bin: IRLZ44N, 1N5819 Schottky, 1N4007 (slow: in v0.1 its loss shows up only as its forward drop; reverse recovery isn't modelled, which is flagged), inductors 47/100/220 µH with Isat 0.5/1.0/1.5 A, electrolytics.
- Fail: 100 µH gives ΔI = 0.58 A, so the peak 0.79 A exceeds the 0.5 A-Isat part ✗ (saturation is a ratings failure in v0.1). A 7805 alternative reaches 41.7 % efficiency ✗ (and the chapter-4 Codex callback lands).
- Ref: 220 µH/1.5 A (ΔI = 0.265 A), 100 µF low-ESR, 1N5819, D ≈ 0.44. Head: efficiency.

**8-4 EB: 555 Timer** (OS-01). Card: "555 astable, R1 = 1 kΩ, R2 = 10 kΩ, C = 10 nF. Find f and the duty cycle."
- Predict: f = 6.87 kHz (6857 Hz with the 1.44 formula; both are accepted within 1 %), duty 52.4 %.
- Build: Textbook bin (ideal 555). Reality check: the NE555's discharge saturation and output stage shift f by < 1 %.

**8-5 FINALE: Synth Voice** (Juno, the street musician whose synth died the week before the Lantern Night street fair). *Teaches:* integration of the whole campaign: oscillator → filter → buffer. Plus tuning by ear.
- Spec: f = 440.0 Hz ±0.5 % (A4). 3rd harmonic ≤ −15 dB relative to the fundamental (a softened square). OUT 1-2 Vpp into a 10 kΩ line input. Supply 9 V single. No part outside its supply rating.
- Bin: NE555, TL072, MCP6002 (rail-to-rail, **1.8-6 V only**), 1N4733A 5.1 V Zener, 10 kΩ trimmer, E24, capacitors.
- Fail: E-series alone can't hit ±0.5 % (R2 = 15.9 kΩ needed with C = 100 nF, R1 = 1 kΩ), so a trimmer is required. A raw square has 3rd harmonic −9.5 dB ✗. TL072 at 9 V single supply has rail headroom issues; **MCP6002 straight on 9 V exceeds its 6 V rating** (review catch: the original ref did this) and smokes, so it needs its own 5.1 V Zener rail (a deliberate callback to 4-2).
- Ref (review ngspice): 555 (R1 1k, R2 **12k + 10k trimmer set ≈ 3.9k**, C 100 nF; exact R2 15.894 kΩ, duty 51.5 %) → divider + low-pass **16 kΩ / 5.1 kΩ + 100 nF** (fc 411 Hz, gain 0.242; 3rd harmonic −16.8 dB, still −16.3 dB at fc +16 %) → MCP6002 follower on a 5.1 V rail (1N4733A + 470 Ω from 9 V, ≈ 8 mA) → 1 µF coupling into 10 kΩ: 1.56 Vpp. (The original fc ≈ 600 Hz passes by only 0.4 dB.) The speaker monitor plays the actual simulated period.
- Ending: Juno plays at the Lantern Night street fair. The end card shows campaign totals, your best and worst smoke, and a copyable summary (GIGAWATT's end-screen pattern).

#### 2.9 Ticket data schema (each ticket is one `src/data/levels/<id>.ts`)
```ts
interface LevelDef {
  id: string; chapter: 1|2|3|4|5|6|7|8; titleKey: string; teaches: ConceptId[];
  board: { w: number; h: number; connectors: { id: 'IN'|'OUT'|'GND'|'VP'|'VN'|string; pad: [number, number]; role: 'source'|'load'|'probe'|'rail' }[] };
  fixed: FixedPart[];               // pre-placed, non-removable (loads, sensors, black boxes, transformer)
  supplies: SourceDef[];            // battery | bench(CV/CC) | mains | funcgen | pin | pwm
  bin: { partId: string; values?: number[] | 'E12' | 'E24'; ratings?: string[]; max?: number }[];
  constraints?: { maxParts?: number; forbid?: string[]; requireSafety?: SafetyRule[] };
  bench: {
    analyses: ('op'|'tran'|'ac')[]; dt: number; tStop: number; settle: number | 'periodic';
    conditions: Condition[];        // supply/load/temperature/parameter overrides; every spec must pass in every condition
    specs: Spec[];                  // band | metric | mask | rating (implicit, always on) | predict (EB)
    ambientC: number;
  };
  stars: { head: 'cost'|'parts'|'power'|'area'|'efficiency'|'accuracy'; par: Record<Metric, number>; tolerance?: MonteCarloDef };
  examBridge?: { card: string; predictions: { id: string; label: string; unit: string; value: number; tol: number }[]; textbookModels: true };
  hidden?: { param: string; learner: number; seeded: [number, number] }[];
  coach?: CoachStep[]; codexUnlocks: string[];
  ref: { parts: PlacedPart[]; wires: Wire[] };   // must pass; replayed by the expert persona
  refByRuleset?: Record<RulesetId, { parts: PlacedPart[]; wires: Wire[] }>;   // review: per-pack ref when the best answer differs (4-1, 7-1)
  customer: CustomerId; briefKey: string;         // review: names/briefs are region-pack strings (§12), never literals here
  mainsDependent?: boolean;                       // conditions use { mains: 'low'|'nominal'|'high' } resolved from the active pack
  leaderboard: { metrics: MetricId[]; epoch: string } | null;   // §11.1; null for EB/encore
  scope: 'must' | 'stretch';                      // §2.7
}
```

---

## 3. Simulation model

The engine is a small, deterministic, SPICE-class simulator written for the game. It is not a SPICE port. **The equation is the rule**: every
pixel of glow, every dot speed and every pass or fail comes from this solver.

### 3.1 From board to netlist
1. **Pads to nodes.** The board is a grid of pads (pitch 1 unit, drawn at 0.1"). Wires are orthogonal polylines between pads, and they connect *only at their endpoints*.
   Crossing wires are insulated jumpers. Union-find over (wire endpoints, part pins, rails) gives the **electrical nodes**. GND is node 0, and every ticket has a GND
   connector. Connector pads are fixed nodes with stable names (IN, OUT…).
2. **Parts to elements.** Each placed part expands into one or more primitive elements (a pot becomes 2 resistors, a 555 becomes a macro with internal nodes, a battery becomes a source + r).
3. **Topology check** (§3.10) runs before every solve and gives explanations, not crashes.
4. **Compile.** Assign MNA indices: n node voltages (excluding ground) plus m branch currents (voltage sources, inductors, VCVS, ammeters, op-amp outputs). Pre-allocate
   matrices. Classify the circuit as *linear* or *nonlinear*, and *time-invariant* or not, which decides whether the LU factorisation can be reused (§3.11).
   The netlist is recompiled only when the board changes (`dirty` flag). A value edit only restamps.

### 3.2 Modified Nodal Analysis
Unknown vector x = [v₁…vₙ, i₁…iₘ]. The system is G·x = b (real, DC/transient) or Y(jω)·x = b (complex, AC). Stamps (standard; Ho, Ruehli & Brennan 1975; Vlach & Singhal):
| Element | Stamp |
|---|---|
| Resistor/conductance g between a, b | G[a,a] += g, G[b,b] += g, G[a,b] −= g, G[b,a] −= g |
| Current source I from a to b (through element) | b[a] −= I, b[b] += I |
| Voltage source V (a+, b−), branch k | G[a,k] = G[k,a] = 1, G[b,k] = G[k,b] = −1, b[k] = V |
| VCVS E·(vc − vd) | branch row: v_a − v_b − E·(v_c − v_d) = 0 |
| VCCS gm·(vc − vd) into a→b | G[a,c] += gm, G[a,d] −= gm, G[b,c] −= gm, G[b,d] += gm |
| Inductor (branch k) | DC: a 0 V source (short). Transient: companion (§3.5). AC: branch row v_a − v_b − jωL·i_k = 0 |
| Capacitor | DC: open (+ gmin, §3.4). Transient: companion (§3.5). AC: admittance jωC |
| Ideal transformer n:1 (branches p, s) | v_p − n·v_s = 0; i_p + i_s/n = 0. Plus winding R (series resistors) and magnetising L (parallel inductor on the primary) as separate elements |
| Nonlinear device | linearised companion at the Newton iterate: conductances + current source (§3.3) |

Ground row and column are dropped. Units: SI base (V, A, Ω, F, H, s, W, K internally with °C at the UI). Every value in data is SI (`4.7e3`, never `"4k7"`). The UI parses
engineering notation and shows it back.

### 3.3 DC operating point (Newton-Raphson)
**Device models** (v0.1; parameters per part in §4):
- **Diode** (incl. LED, Zener, Schottky): Shockley I = Is·(e^(Vd/(N·Vt)) − 1) with series Rs (as a separate internal node when Rs > 0) plus reverse breakdown for Zeners:
  I_bv = −Ibv·e^(−(Vd + BV)/(Nbv·Vt)). Vt = kT/q = 25.852 mV at 300 K (T fixed at 300 K for electrical Vt in v0.1. Temperature dependence of Is and Vt is a v0.2 item, flagged).
  The Zener's dynamic resistance comes from Rs fitted to Zzt. Junction capacitance is **off** in v0.1 (flagged; it matters above ~1 MHz, and 7-3 uses an ideal detector instead).
- **BJT**: **Ebers-Moll transport model** ("EM-lite") with optional Early effect: Ic = Is(e^(Vbe/Vt) − e^(Vbc/Vt))(1 + Vce/Vaf) − (Is/Br)(e^(Vbc/Vt) − 1); Ib = (Is/Bf)(e^(Vbe/Vt) − 1) + (Is/Br)(e^(Vbc/Vt) − 1).
  Bf = the datasheet's typical hFE at the working current (not the Gummel-Poon ideal Bf), Br from the model. No Ikf/Ise high-injection terms, no capacitances, no Rb/Rc/Re (flagged).
  PNP by sign reversal. Darlington (TIP120) as two internal NPNs + the internal 8 kΩ/120 Ω base-emitter resistors.
- **MOSFET**: Shichman-Hodges **Level-1 square law** with channel-length modulation. Cutoff Id = 0. Triode Id = Kp[(Vgs−Vt)Vds − Vds²/2](1+λVds). Saturation Id = (Kp/2)(Vgs−Vt)²(1+λVds).
  Plus a body diode (Shockley, D→S reverse). No subthreshold conduction and no capacitances (flagged). Kp is fitted so that triode resistance 1/(Kp(Vgs−Vt)) equals the datasheet Rds(on) at the
  datasheet's *logic-level* Vgs for logic-level parts (IRLZ44N at 5 V) and at 10 V for others.
- **Behavioural macros**: op-amp (§3.7), comparator, 555, regulators, logic pin, PWM driver, relay, fuse, thermistor.

**Newton loop** (`sim/mna/op.ts`, using `core.numerics.lu` and a NODE-side damped Newton):
```
x ← initial guess (previous solution if any, else zeros with diode/BE junctions at 0.6 V)
repeat k = 1..maxIter (DC 150, transient step 25):
  stamp linear elements (cached) + each nonlinear device's companion at x
  solve J·x_new = b            (LU with partial pivoting; refactor every iteration)
  limit junction steps: pnjlim (SPICE3: if Vnew > vcrit and |Vnew−Vold| > 2·N·Vt then log-compress), vcrit = N·Vt·ln(N·Vt/(√2·Is))
  limit MOSFET steps: fetlim (Vgs change capped at max(0.5 V, 2|Vgs−Vt|), restricted crossing of Vt), Vds limited per SPICE3 limvds (steps capped near the 3.5 V knee)
  converged if  ∀i |x_new−x|_i ≤ reltol·max(|x_new|,|x|)_i + abstol_i  AND  KCL residual ≤ 1e-9 A + reltol·|largest branch current|
     with reltol 1e-4 (tighter than SPICE's 1e-3, because oracle tests assert 0.1 %), vntol 1e-6 V, abstol 1e-12 A
  damping: if ‖residual‖₂ grew by > 2× vs last iteration, halve the step (≤ 6 halvings) before accepting
```
- **Exponential guard**: for argument x > 80, use e^80·(1 + (x − 80)) (linear continuation) so nothing overflows to Inf.
- **gmin**: 1e-12 S across every PN junction and from every node to ground (§3.4).
- **Homotopy chain** when plain Newton fails: (1) **gmin stepping**: node-to-ground shunt 1e-2 → 1e-12 S, one decade per stage, each stage seeded by the last.
  (2) **Source stepping**: scale every independent source by λ = 0 → 1, with adaptive steps (start 0.1, double on success, halve on failure, min 1e-4).
  (3) **Pseudo-transient**: add 1 µF from each node to ground and run backward Euler to steady state (≤ 2000 steps). (4) Failure: stop, keep the last good state,
  highlight the node with the largest residual, and show the convergence explainer ("The solver couldn't settle this circuit. Usually: a loop of diodes with no resistance, or a
  latch with two stable states and nothing to pick one. Try adding a resistor here ↗"). Which strategy worked is logged in debug builds and counted in tests.
- **Bistable circuits** (latches, Schmitt triggers) converge to whichever state the deterministic initial guess leads to. Tickets that need a defined start state get it from
  the power-on transient instead (all states start at 0 at t = 0).

### 3.4 Floating DC nodes and gmin
Every node gets gmin = 1e-12 S to ground, so the matrix is never structurally singular because of capacitor-only or gate-only nodes. That is numerics, not physics,
so the topology check (§3.10) **detects DC-floating nodes** (no DC path to ground once capacitors are opened and MOSFET gates treated as open) and:
- in live mode, shows a hollow-ring node marker and the note "No DC path: its voltage is decided by leakage, which a real circuit doesn't promise";
- at the bench, **refuses to pass** if any DC-floating node connects to a MOSFET gate, a CMOS/op-amp input or a comparator input (real parts would do anything).
- Textbook-bin capacitors (EB) include a 1 GΩ internal bleed (shown in the Codex) so EB 3-4 has a defined DC solution with < 0.5 % error (CAP-01 note).

### 3.5 Transient analysis (decision: fixed step, trapezoidal, with BE restarts)
- **Integrator**: **trapezoidal** (2nd order, A-stable, no numerical damping, so LC ringing is preserved and resonance looks right). **Backward Euler** for the first step
  after t = 0 and after every breakpoint (source edge, switch event, 555 or comparator toggle, relay toggle), which kills trapezoidal's spurious ringing
  ("trap ringing") on discontinuities. This is the classic SPICE remedy.
- **Companion models** (h = step, n = previous accepted step):
  - Capacitor, TRAP: i = Geq·v + Ieq with Geq = 2C/h and Ieq = −(2C/h)·vₙ − iₙ. BE: Geq = C/h, Ieq = −(C/h)·vₙ. The capacitor current is stored as state.
  - Inductor (MNA branch), TRAP: v_{n+1} − (2L/h)·i_{n+1} = −vₙ − (2L/h)·iₙ. BE: v_{n+1} − (L/h)·i_{n+1} = −(L/h)·iₙ.
- **Step policy: fixed base step h₀ per ticket** (`bench.dt`, chosen by the designer: ≤ T/200 for periodic signals, ≤ τ_min/20 for transients; listed in each level file).
  Fixed steps make bench results reproducible, make the phone budget predictable and keep scope sampling uniform. Adaptive LTE control is a v0.2 option behind a flag.
  - **Breakpoints**: sources publish their edge times. The stepper shortens the step to land exactly on each breakpoint, then restarts with BE.
  - **Events** (comparator, 555, relay, fuse, thermal shutdown): evaluated at step ends. When a threshold is crossed, linear interpolation locates the crossing time. The step is
    rejected and redone to the crossing (one bisection refinement), the state is toggled and the stepper restarts with BE. This gives exact timing for 555 frequencies (OS-01 to 1 %).
  - **Newton failure** at a step: halve h (up to 10 times, min h₀/1024) and continue, then grow back ×2 per successful step up to h₀. A failure at min h stops the run with the explainer.
- **Initial conditions**: the default is **power-on from zero** (all capacitor voltages and inductor currents 0, sources step at t = 0⁺ with a 1 µs linear ramp to avoid an
  infinite di/dt, then BE). Tickets may instead request "start from DC OP" (for example the 7-x filters when run in transient). EB tickets may set explicit IC (CAP-02: C1 at 100 V).
- **Oscillator start-up**: tickets with oscillators set `kick: {node, amplitude: 1e-3, at: 0}` (a one-step current impulse). This is deterministic and documented in the Codex.

### 3.6 AC small-signal analysis (Bode)
1. Solve the DC OP. 2. Linearise every nonlinear device at the OP (diode gd = dI/dV; BJT gm, gπ, go; MOSFET gm, gds; op-amp macro linear part). 3. For each frequency on a log grid
(20 points/decade by default, plus mask-edge frequencies, plus refinement near detected peaks/notches: golden-section on |H| to 1e-4 relative), assemble Y(jω) and solve with
**complex LU** (`core.numerics.clu`). 4. H(f) = V(out)/V(in) for the ticket's AC source of magnitude 1.
- If any op-amp output sits within 0.5 V of a rail at the OP, or any BJT is saturated, the Bode plotter shows a warning ("small-signal plot is meaningless: your amp is clipped
  at DC") and the bench fails AC specs with that reason. This stops cheese and teaches something real.
- Cross-check property (§9.3): for linear circuits, steady-state transient amplitude at f equals |H(f)| within 1 %.

### 3.7 Behavioural macro-models
**Op-amp** (one model, parameterised per part; pins in+, in−, out, V+, V−; internal node x):
```
 input:      Rin between in+ and in− (2 MΩ LM741; 1e12 Ω JFET/CMOS)            [no bias current, no offset in v0.1: flagged]
 gain stage: VCCS  i₁ = Imax·tanh(gm·(v+ − v−)/Imax)  into node x; x has R1 = 1 MΩ and C1 to the midpoint ref
             gm = A0/R1;  C1 = A0/(2π·GBW·R1)  (dominant pole fp = GBW/A0)
             Imax = SR·C1  → output slew is limited to ±SR (single-pole slew model, the classic macro)
 clamps:     x limited to [V− + foot, V+ − head] by soft diodes (Is 1e-15, N 1), so rails clip and recover realistically (no windup)
 output:     VCVS y = x; then output resistance Ro and short-circuit limit: i_out = Isc·tanh((y − v_out)/(Isc·Ro))
 supply:     Iq from V+ to V− always; output current is drawn from V+ when sourcing and V− when sinking (softplus blend), so op-amp self-heating
             P = (V+ − v_out)·i_src + (v_out − V−)·i_snk + (V+ − V−)·Iq is correct, and a shorted output can overheat the package
 checks:     input common-mode outside [V− + cmLo, V+ − cmHi] → live warning + bench fail on linear specs (phase reversal not modelled: flagged)
 "ideal" variant (Textbook bin): A0 = 1e6, no pole, rails ±15 V hard clamps, Ro = 0
```
**Comparator (LM393)**: the same input stage with A0 = 2e5 and a fast pole (response 1.3 µs), open-collector output (an NPN switch to V−, Ron 50 Ω, sink limit 16 mA). Needs a pull-up.
**555 (NE555)**: the real internal structure at block level. 3×5 kΩ divider (so CV works), two comparators (event-driven, thresholds 2/3 and 1/3 of Vcc via the divider), SR flip-flop state,
reset pin, discharge = switch to GND (Ron 10 Ω) when Q = 0, output = VCVS to Vcc−1.7 V (high) or 0.1 V (low) with Ro 10 Ω and a ±200 mA limit, supply current 2 mA (5 V)…9 mA (15 V)
interpolated (TI NE555 datasheet). Comparator events use the event mechanism of §3.5.
**Linear regulator (7805, LM317)**: a pass element that only sources current (diode-isolated, it cannot sink). It regulates V(out) − V(ref) toward Vreg (7805: ref = GND, 5.00 V;
LM317: ref = ADJ, 1.25 V), limited by dropout: V(out) ≤ V(in) − Vdo (2.0 V). Quiescent current Iq (7805: 5 mA to GND; LM317: 3.5 mA *injected into OUT*, which is why the minimum load emerges),
Iadj = 50 µA out of ADJ. Current limit 2.2 A (7805) / 1.5 A (LM317). **Thermal shutdown**: when Tj > 150 °C the output is disabled until Tj < 135 °C (hysteresis), so overheated regulators visibly cycle.
**Logic pin / PWM driver**: a voltage source + Ro (25 Ω pin), abs-max current monitor. The PWM driver has an ideal floating gate drive (v0.1 simplification, flagged).
**Relay**: coil (R + L) + contact (switch Ron 50 mΩ / Roff 1e9) that closes when |I_coil| > I_pull and opens when < I_drop (event).
**Fuse**: resistor R_cold, with an I²t accumulator over a 50 ms window. Exceeding the rated I²t opens it (event + "fuse blown" FX).
**Thermistor (NTC)**: R(T) = R25·exp(B(1/T − 1/298.15)); T is a ticket condition parameter or a live "heat gun" slider. Self-heating is ignored (flagged).
**Pot / trimmer**: two resistors with wiper position α ∈ [0.005, 0.995] (the 0.5 % end resistance stops a 0 Ω exploit). Wiper current and power are rated.
**Slide wire (metre bridge/potentiometer)**: resistive wire ρ·l with a continuous jockey tap; the galvanometer is an ammeter (100 Ω) with needle dynamics as cosmetics only.
**Battery**: EMF + internal r (capacity not modelled in v0.1). **Bench supply**: CV/CC. It regulates the set voltage until the current reaches the set limit, then holds the current (smooth min).
Ideal sources exist only in Textbook bins.
**Inductor saturation**: the inductance stays linear. |I| > Isat is a *rating* failure ("core saturated"), not a nonlinear L (v0.2: L(i) curve). Flagged.

### 3.8 Power, energy and ratings
- Instantaneous element power p = v·i for every element (sources included). It is averaged over the bench window and over a live **sliding window** = the last scope sweep or 50 ms, whichever is longer.
- **Rating checks** (bench, every condition, after settling): resistor P_avg ≤ P_rated; capacitor |V|peak ≤ V_rated and electrolytic V ≥ −0.5 V; diode I_avg ≤ IF(AV), V_rev,peak ≤ VRRM;
  LED I_avg ≤ IF, I_peak ≤ IFP; Zener P_avg ≤ Pd; BJT V_ce,peak ≤ Vceo, I_c,peak ≤ Ic,max, V_eb,rev ≤ 6 V; MOSFET V_ds,peak ≤ Vds, |V_gs| ≤ 20 V, I_d,avg ≤ Id; every semiconductor and
  IC Tj,steady ≤ Tj,max (or the ticket's stricter spec); inductor |I|peak ≤ Isat; meter fuse; logic pin abs max.

### 3.9 Thermal model and smoke
- **Per part**: a first-order thermal RC. C_th·dT/dt = P_avg − (T − Ta)/θ, with θ = θJA (or θJC + θCS + θSA with a heatsink). Resistors: θ = 85/P_rated °C/W (full rating to 70 °C, zero at 155 °C, per
  Yageo MFR derating, verified). Thermal time constants τ_th = θ·C_th per package class: 0805/axial ¼ W 8 s, ½-1 W 15 s, 5 W 40 s, TO-92 30 s, DO-41 20 s, TO-220 bare 60 s, TO-220 + heatsink
  180 s, LED 10 s **[R: engineering estimates; no datasheet gives these; Codex-flagged]**.
- **Multi-rate**: electrical time is µs-ms; thermal time is seconds. Live mode advances thermal state by a **fixed thermal step per live frame**
  (Δt_th = (1/30 s) × `thermalSpeed`, default 4×, Settings 1-16×), driven by the electrical sliding-window P_avg. Wall-clock time never enters the rules:
  Godot decides only *how many* frames to request (`advance(frames)`, §8.4), so a replay of the same action list is bit-identical (review fix: the original
  "wall time" wording broke determinism). So a part takes a few real seconds to glow and then smoke, which is readable and dramatic. The **bench never waits**:
  it computes steady-state T = Ta + P_avg·θ.
- **States and visuals**: Normal → **Warm** (P > rating or T > T_max·0.9: amber glow, faint tick sound) → **Hot** (T > T_max: orange/yellow glow, shimmer, sizzle) → **Smoke** (T > T_fail: the part fails).
  T_max and T_fail: resistor 155/250 °C (paint scorches; at Ta = 25 °C smoke arrives at about 2.6× rated power), semiconductor Tj,max/Tj,max + 25 °C, electrolytic 105/125 °C.
- **Instant failures** (no thermal delay, within one sweep): MOSFET |Vgs| > 20 V (gate oxide punch-through); BJT Vce > 1.2·Vceo while conducting (avalanche); capacitor V > 1.2·V_rated for > 50 ms
  (electrolytic vents, ceramic cracks short); electrolytic reverse > 1 V for > 0.5 s (vents); LED/diode reverse > VRRM with current (breakdown); LED I > 3·IF,abs (die cracks); fuse I²t; meter fuse.
- **Failure behaviour** (the board keeps working with the dead part, so the failure itself is a lesson): resistor goes open (1e9 Ω); ceramic capacitor shorts (0.1 Ω); electrolytic vents open; diode/LED: diode
  short (0.5 Ω), LED open; BJT C-E short (0.5 Ω); MOSFET D-S-G short; op-amp output high-Z and supply draws 50 mA; regulator open. Smoked parts are charred on the board and are **never accepted by the bench**
  ("the customer won't take burnt parts"), which stops anyone using a dead short as a free wire.

### 3.10 Topology checks (pre-solve, explained)
| Check | Detection | Response |
|---|---|---|
| Floating island | union-find component without GND | grey "unpowered island" tint; note; excluded from the matrix (or tied to GND via gmin) |
| DC-floating node | graph with capacitors and gates removed: no path to GND | hollow marker; bench refusal rule (§3.4) |
| Voltage-source loop | cycle in graph of {ideal V sources, inductors (DC), ammeters} | blocking explainer: "These sources fight each other: infinite current". Only possible with Textbook ideal sources. Real batteries and bench supplies have r or CC limit |
| Shorted source | V-source with both terminals on one node | real battery: huge current through r, so battery heats and smokes; bench supply: goes CC (LED indicator); ideal: blocking explainer |
| Current-source cutset | current source whose node set has no other path | explainer: "That current has nowhere to go" |
| Unconnected pins | part pin on a pad with no other connection | small red pin dot; harmless |
| Op-amp without negative feedback in a linear-spec ticket | DC OP saturated + no path out → in− | hint, not refusal (comparators are legitimate) |
| Singular matrix after all of the above | LU pivot < 1e-14·max | generic explainer + the node with the zero pivot highlighted; logged as a test failure in fuzz |

### 3.11 Performance and the phone budget
- **Caps**: campaign boards ≤ 40 parts and ≤ 32 electrical nodes, **MNA dimension ≤ 48** including branch currents and macro internal nodes
  (review: tightened from 64 so the dense-LU bench budget below holds on the phone). Sandbox ≤ 80 parts, ≤ 64 nodes (dim ≤ 128; Sandbox benches may be slow and say so).
- **Dense LU** (n ≤ 128) is the right tool: an LU costs ≈ ⅔n³ flops: n = 20 ≈ 5.3k, n = 30 ≈ 18k, n = 48 ≈ 74k (review: the original "9k at n = 30" was
  low by 2×). NODE implements its own **flat `Float64Array` in-place LU with partial pivoting** in `sim/mna/lu.ts` (the core `luDecompose` works on
  `number[][]` and allocates per call, which is too slow in the transient inner loop); it is property-tested against core `solve`, and core
  `singularityReport` is still used for the player-facing explanation. AC uses core `cLuDecompose` (≤ 200 frequencies, allocation is fine there).
  A sparse solver is a v0.2 option.
- **Reuse**: linear, time-invariant circuits at fixed h factorise once and only back-substitute per step (most chapter 1-3 and 7 boards). **Device bypass**: skip restamping a nonlinear device whose
  terminal voltages changed < 1e-6 V since the last stamp (SPICE "bypass"); a test asserts bypass-on and bypass-off results agree to 1e-9 relative on every ref board.
- **Work budget, not just a step budget**: each level file declares `bench.dt` and `tStop`; `scripts/bench-cost.ts` computes
  steps × (mean Newton iterations) × ⅔n³ for the ref board **and** for the worst novice-persona board, and CI fails a must-ship ticket whose
  estimate exceeds 1.5 × 10⁹ flops per full bench (≈ 2 s on a desktop Node, ≈ 5 s measured on the Pixel 9a; the Pixel factor is measured once in M2 and committed).
- **Live mode budget**: the sidecar advances a whole number of live frames per `advance(frames)` call; each frame is a ticket-defined
  sim-time quantum (`live.frameSim`, chosen so one frame costs ≤ 4 ms on the Pixel 9a and ≤ 8 ms on desktop), at 30 Hz live updates (Godot interpolates
  dots and glow at 60-120 Hz). Godot asks for fewer frames when it falls behind, never for "as much as fits in N ms" (that would make results depend on device speed).
  If real time can't be reached (a 50 kHz buck needs 1e7 steps/s), the sim runs slower than real time and the HUD shows "sim ×0.003". Periodic tickets still look live because the scope
  triggers on each new period. Scope samples are decimated in the engine to ≤ 1024 points/channel/frame.
- **Bench budget**: each condition ≤ 25 000 steps (designer-checked in the level file and enforced by `bench-cost`); a full bench ≤ 2.0 s desktop / ≤ 5 s Pixel 9a, shown as a diegetic "bench running" animation (relay clicks per condition).
  The tolerance Monte Carlo (16 samples × conditions) runs **after a pass, in chunks**: Godot calls `runTolerance(k)` (k samples per call) in idle frames, progress is
  part of the state, and the ★3 lights when the last chunk finishes. The Monte Carlo seed is derived from (ruleset, ticket id, board hash), never the save
  seed, so the client and the leaderboard server get the same samples.
- **Periodic steady state cost** (review): mains tickets settle with `settle: 'periodic'` (≤ 50 periods); at 50 Hz with dt = T/200 that is ≤ 10 000 steps. Stretch tickets with long settling
  (8-2 phase shift ≈ 200 ms at 1 kHz; 8-3 buck LC settling ≈ 10-20 ms at 50 kHz) exceed 25 000 steps as written, so they **start from an averaged-model steady state**
  (8-3: inductor current and output capacitor pre-set from the averaged buck solution; named in the Codex) or use dt = T/100; `bench-cost` decides.
- **Audio from the sim**: the speaker monitor plays the steady-state period from the bench (or the last two live sweeps), resampled to 48 kHz and looped with crossfade. It never needs real-time electrical simulation.
- **Determinism (review fix, binding)**: all rule code uses core `dmath` (fdlibm) for exp/log/sin/cos/pow/tanh/atan2 and never `Math.exp`/`**`
  (`src/determinism.test.ts` enforces it), so results are **bit-identical** on desktop Node 22, nodejs-mobile 18 on Android and the leaderboard server. Same inputs,
  same step sequence, same iteration order, no wall clock, no `Map` iteration over unordered keys in solver paths. Goldens therefore hash **everything exactly**,
  waveforms included (hash of the Float64 bit patterns of the decimated scope windows); the original 1e-9 tolerance is dropped. This is what makes
  `verify()` (§11.3) trustworthy.

### 3.12 Bench: comparing the probe to the spec
For every condition: run the analyses → discard `settle` (fixed seconds, or `'periodic'`: until two consecutive periods differ by < 0.5 % RMS of amplitude, max 50 periods) → evaluate specs on the window.
| Spec kind | Definition | Pass rule |
|---|---|---|
| `level` | DC value of a connector voltage or branch current (mean over the window) | lo ≤ value ≤ hi |
| `band` | a target waveform y*(t) (sine, square, triangle, exp, PWL, or "reference circuit output") with tolerance box (±ΔV, ±Δt) | **every** window sample (t, y) has a target point within [t−Δt, t+Δt] that is within ±ΔV. This is the Minkowski "tube", robust at square-wave edges. If `phaseFree`, first align the target by trigger (rising mid-level crossing with 5 % hysteresis) and refine the shift ±5 % of a period to minimise max error |
| `metric` | freq (interpolated zero crossings), duty, Vpp, mean, RMS, rise time 10-90 %, overshoot %, settling time, crossing time, crossing count, THD and harmonic ratios (DFT over an integer number of periods, resampled to 2ⁿ points) | lo ≤ value ≤ hi |
| `mask` | AC magnitude (dB) / phase (°) regions (f₁, f₂, lo, hi) | every grid point (plus mask edges) inside |
| `rating` | §3.8, always on | no violation and no smoked part |
| `safety` | ticket rules (bleeder present ≥ X, capacitor class X2, …) | rule holds on the netlist |
| `predict` (EB) | player-entered number vs the solver's value | scored, not pass/fail |

Every failed item yields a **bench report line** with the measured number, the limit, the condition and a link to the explainer (§7.3). The scope overlays the band in amber and paints failing samples red.

### 3.13 Simplifications (each becomes a Codex "What we simplified" note)
Fixed Vt (300 K) for junctions; no junction or device capacitances; EM-lite BJT (no Ikf/Ise/Rb); Level-1 MOSFET (no subthreshold); single-pole op-amp (no second pole, no bias currents, no offset,
no phase reversal); ideal floating gate drive in the buck; linear inductors (saturation as a rating); no reverse recovery; no electrolytic leakage or ESR (v0.2: ESR on); no wire resistance (v0.2 option:
copper traces); thermal RC per part with estimated τ; transformer ideal + winding R + magnetising L; NTC without self-heating; batteries without capacity.

---

## 4. Data catalogues

### 4.0 Provenance rules (from GIGAWATT's "always verify worker data")
- Each catalogue entry carries `source: {doc, url, accessed}` and `verified: boolean`. **[V]** below means a worker fetched and read the cited datasheet in this design pass
  (2026-11-09). **[R]** means it is from recall and must be verified before it ships, because data-entry workers must fetch the PDF. The CI test `data.provenance.test.ts` fails if a shipped campaign part has
  `verified: false`. Sandbox-only parts may ship unverified with an in-game "unverified" tag (GIGAWATT precedent).
- Prices (`global` pack): integer US cents at qty 100 from a named distributor listing with the access date (`priceSource: {distributor, mpn, url, accessed}`).
  **Review status (2026-11-09):** a second scripted pricing pass also failed (DigiKey and Tayda return 403, Mouser times out, LCSC pages show no tiers,
  aggregator snippets disagree with each other); only 1N4007 ≈ $0.05 @100 (DigiKey listing, Diotec/Lumimax) and LM7805 TO-220 ≈ $0.58-1.55 @100 (Mouser via aggregator) came back.
  Decision: every price below is a **game value** (`priceSource: 'game-estimate-2026'`), shown in the Codex as "approximate distributor price, qty 100",
  until the M3 data-entry task records real listings **through a browser** (BUILD-PLAN task M3-D2). Prices only drive the cost metric and the wallet; relative
  order matters more than cents (a 1 W resistor must cost more than a ¼ W one; a litz coil more than a plain one; an IRLZ44N more than a 2N7000), and a
  test asserts those orderings. The `in` pack's prices derive from the same table (× its stated rate). Physics parameters are never game values: those must be `verified`.
- Disagreements between a vendor's product page and its datasheet go to the **datasheet**, with the conflict noted (for example NE5532).

### 4.1 Passive families (v0.1 entry counts)
| Family | Values | Ratings / variants | Model params | Source | Count |
|---|---|---|---|---|---|
| Resistor, carbon film 5 % | E12, 10 Ω-1 MΩ (+1 Ω-8.2 Ω and 1.2-10 MΩ in Sandbox) | ⅙ (Yageo CFR has no ⅛ W), ¼, ½, 1, 2 W; 5 W ceramic wirewound (1-100 Ω) | R; θ = 85/P_rated; V_max 150/250/350/400/500 V (CFR-12…2 W, review-verified) | IEC 60063 (E-series); Yageo CFR/MFR (derating 70 → 155 °C [V]) | 61 values × 6 ratings, priced per rating |
| Resistor, metal film 1 % | E24 (unlocks ch4 / Engineer) | ¼ W | same; tolerance ±1 % in Monte Carlo | IEC 60063; Yageo MFR [V] | 121 |
| Trimmer / pot | 1k, 10k, 100k, 500k | 0.5 W trimmer at ≤ 85 °C, 300 V (Bourns 3386 [V]); 0.25 W panel pot [R] | α ∈ [0.005, 0.995] | Bourns 3386 [V] | 4 × 2 |
| Ceramic capacitor C0G/X7R | E6, 10 pF-1 µF | 50 V | C; X7R DC-bias loss **not modelled** (flagged) | Murata/TDK [R] | 31 |
| Film X2 capacitor | 0.1, 0.15, 0.22, 0.33, 0.47 µF | 275 VAC | C | [R] | 5 |
| Aluminium electrolytic | E3/E6, 1-4700 µF | 6.3, 10, 16, 25, 35, 50 V | C, polarity, (ESR v0.2) | Panasonic FR / Nichicon [R] | ~40 |
| Inductor (axial / shielded power) | E6, 10 µH-100 mH | Isat 0.1-1.5 A, DCR | L + series DCR, Isat rating | Bourns 78F / RLB, Würth WE-PD [R] | ~22 |
| Variable capacitor (tuning) | 10-365 pF | n/a | C(dial) | classic AM gang [R] | 1 |
| Transformer | 230:12 V rms (+9 V tap), 230:12-0-12 | 6 VA, winding R 1.5 Ω, Lm 10 H | ideal n:1 + R + Lm | generic [R] | 3 |
| Relay | 12 V coil, 200 Ω, 100 mH, pull-in 40 mA, drop-out 15 mA | contact 5 A | coil R+L, contact switch | generic [R] | 1 |
| Speaker 8 Ω, piezo, DC fan/motor, heater element, NTC 10k B3950, slide wire, galvanometer, fuse 400 mA/1 A | n/a | n/a | R / R+L / C+R models | generic [R] | 10 |

### 4.2 Semiconductors (v0.1 campaign set: 24 parts)
| Part | Key ratings | Model parameters | Source | Status | ~USD |
|---|---|---|---|---|---|
| 1N4148 | VRRM 100 V, IF 300 mA cont., IF(AV) 150 mA, IFRM 500 mA, Ptot 500 mW, DO-35 θJA 350 °C/W (review-verified) | Is 2.52 nA, N 1.752, Rs 0.568 Ω | Vishay 81857 [V ratings]; model line LTspice standard.dio (seen quoted on a forum only) | ratings V, model R | 0.02 |
| 1N4007 | VRRM 1000 V, IF(AV) 1 A, IFSM 30 A, DO-41 | Is 76.9 pA, N 1.45, Rs 42 mΩ, BV 1000 | Vishay 88503 [V]; model Diodes Inc. [R] | ratings V, model R | 0.02 |
| 1N5819 | VR 40 V, IF(AV) 1 A, **Vf 0.60 V max at 1 A** (0.45 V is the 1N5817 column; review-corrected) | refit (Is, N, Rs) to 0.60 V at 1 A on data entry (the old 0.45 V fit makes the buck optimistic) | Vishay 88525 [V] | V ratings | 0.04 |
| 1N4733A | Vz 5.1 V at Izt 49 mA, Zzt 7 Ω, Ptot 1.3 W | BV 5.1, Ibv 49 mA, Rs fit to Zzt | Vishay 85816 [V] | V | 0.04 |
| 1N4742A | Vz 12 V at 21 mA, Zzt 9 Ω, 1.3 W | same family | Vishay 85816 [V] | V | 0.04 |
| 1N4728A | Vz 3.3 V at 76 mA, Zzt 10 Ω, 1.3 W, θJA 110 K/W | same family | Vishay 85816 [V] | V | 0.04 |
| BZX55C5V1 | 4.8/5.1/5.4 V at 5 mA, Ptot 0.5 W, θJA 300 K/W, rzj < 35 Ω at 5 mA | BV 5.1, Ibv 5 mA, Rs ≈ 25 Ω (fit under the 35 Ω max; review-corrected from 60) | Vishay 85604 [V] | V | 0.03 |
| LED red 5 mm (Kingbright WP7113ID) | IF 30 mA abs (20 mA working), IFP 160 mA (1/10 duty, 0.1 ms), VR 5 V, PD 75 mW; VF 1.9 typ / 2.3 max at 10 mA; curve ≈ 1.70 V @ 2 mA, 1.90 @ 10 mA, 2.00 @ 20 mA (graph read ±0.03 V) | **review refit: N 2.0, Is 1.19e-17 A, Rs 9.9 Ω** (residuals ≤ 0.024 V; a free 3-point fit gives an unphysical N 4.4, so N is pinned at 2) | Kingbright DSAF0012 Rev V.14A [V] | V | 0.03 |
| LED yellow / green / blue / white 5 mm | Vf ≈ 2.1/2.2/3.1/3.1 V at 20 mA [R] | fit per colour on data entry | Kingbright WP7113 family [R] | R (Sandbox-only until verified) | 0.03 |
| 2N3904 | hFE 100-300 at 10 mA, Vceo 40 V, Ic 200 mA, Ptot 625 mW, θJA 200 °C/W | Is 6.734 fA, Bf 200 (typ hFE), Br 0.737, Vaf 74 | ST/onsemi 2N3904 [V ratings]; model Fairchild classic [R] | ratings V | 0.03 |
| 2N3906 | −40 V, −200 mA, 625 mW, θJA 200 °C/W | Is 1.41 fA, Bf 180, Br 4.98, Vaf 18.7 (model values, not datasheet items) | ST 2N3906 [V ratings] | ratings V | 0.03 |
| 2N2222A (TO-92, P2N2222A) | Vceo 40 V, Ic 600 mA, Pd 625 mW at 25 °C, θJA 200 °C/W, θJC 83.3 (the "800 mA peak" was the SOT-23 MMBT2222A figure: dropped) | Is 1e-14, Bf 200, Br 3, Vaf 100 | onsemi P2N2222A/D [V] | V ratings | 0.04 |
| BC547B | hFE 200-450, Ic 100 mA, Vceo 45 V, Pc 500 mW | Is 1.8e-14, Bf 290, Vaf 80 [R fit] | BC546-550 sheet [V ratings] | ratings V | 0.03 |
| TIP120 | hFE ≥ 1000 at 0.5 A and 3 A; Vce(sat) 2.0 V **max** at 3 A / IB 12 mA; 5 A (8 A peak); 65 W at Tc 25 °C, 2 W free air; Vceo 60 V; θJC 1.92 | 2 NPN + ≈ 8 kΩ / ≈ 120 Ω | onsemi TIP120/D Rev 9 [V] | V | 0.25 |
| 2N7000 | Vds 60 V, Id 0.2 A, Pd 0.4 W, Vgs(th) 0.8-3 V, Rds(on) ≤ 5 Ω at 10 V, θJA 312.5 °C/W | Vt 2.1 (typ), Kp fit to **Rds 2.4 Ω typ at 10 V** (review-corrected from 1.8; 4.5 Ω typ at 4.5 V), λ 0.02 | Vishay 70226 [V] | V | 0.05 |
| IRLZ44N | Vds 55 V, Id 47 A, Pd 110 W, Vgs(th) 1-2 V, Rds(on) 22 mΩ at 10 V, 25 mΩ at 5 V, 35 mΩ at 4 V (all **max** values), θJA 62, θJC 1.4 | Vt 1.5, Kp 11.4 A/V² (fit 25 mΩ at 5 V: a worst-case fit, named in the Codex), λ 0.01 | Infineon IRLZ44N [V] | V | 0.50 |
| IRF540N | Vds 100 V, Id 33 A, Vgs(th) 2-4 V, Rds(on) 44 mΩ max at 10 V | Vt 3.0, Kp fit at 10 V | Infineon IRF540NPbF [V] | V | 0.45 |

### 4.3 ICs (8 parts)
| Part | Ratings / key parameters used by the macro | Source | Status | ~USD |
|---|---|---|---|---|
| LM741 | ±5…±18 V; A0 200 V/mV typ; SR 0.5 V/µs; GBW 1 MHz (**typical, not specified** by TI for the LM741; the LM741A row gives 0.437-1.5 MHz; review-resolved); swing ±13 V into 2 kΩ at ±15 V; Isc 25 mA; Rin 2 MΩ | TI SNOSC25D [V] | V (GBW tagged typical) | 0.15 |
| LM358 (dual) | 3-32 V; GBW 0.7 MHz; SR 0.3 V/µs; high swing V+−1.5 V (Vs ≤ 10 V), V+−2 V above; low ≈ 5 mV; CM range V− … V+−1.5 V (includes ground); Isc 40 mA; Iq 0.7 mA | TI SLOS068AB [V] | V | 0.08 |
| TL072 (dual) | ±5…±18 V; GBW 5.25 MHz (3 MHz for NS/PS/M variants; game uses 5.25); SR **20 V/µs typ, 8 min** (current SLOS080W table; 13 was an older revision; review-corrected); swing ±13.5 V typ into 10 kΩ at ±15 V; CM ±11 V min; Isc 40 mA; Rin 1e12 | TI SLOS080W [V] | V | 0.15 |
| NE5532 (dual) | ±3…±20 V; GBW 12 MHz and SR 5 V/µs (Table B1; the revision history confirms 10→12 MHz and 9→5 V/µs; review-resolved) | TI SLOS075 [V] | V | 0.25 |
| MCP6002 (dual) | 1.8-6 V; GBW 1 MHz; SR 0.6 V/µs; rail-to-rail in/out (≈ 25 mV); Isc ±23 mA at 5.5 V | Microchip DS20001733L [V] | V | 0.20 |
| LM393 (dual comparator) | 2-36 V; open collector, sink 6 mA min / 21 mA typ at VOL 1.5 V (VOL 0.4 V max at 4 mA); response 1.3 µs; CM V− … V+−1.5 V (V+−2 V over temperature) | TI SLCS005AH [V] | V | 0.08 |
| NE555 | 4.5-16 V; output ±200 mA; VOH ≈ Vcc − 1.7 V typ at 100 mA (5 V); Icc 2 mA (5 V) … 9 mA (15 V) typ, output high, no load; thresholds 2/3 and 1/3 Vcc | TI NE555 SLFS022 [V] | V | 0.10 |
| LM7805 (LM340) | 5.0 V ±4 %; dropout 2 V at 1 A; θJA 54 °C/W TO-220; θJC 4 °C/W; thermal shutdown > 150 °C; short-circuit 2.1 A, peak 2.4 A (review-corrected); note: SNOSBT0L's JEDEC table gives RθJA 23.9 °C/W for TO-220 (NDE) vs 54 in the application text; the game uses 54 (free-air, no copper, the realistic hobby case) and says so in the Codex | TI LM340 SNOSBT0L [V] | V | 0.15 |
| LM317 | Vref 1.25 V (1.2-1.3); Iadj 50 µA typ (100 max); min load 3.5 mA typ (10 max); dropout ≈ 2 V; 1.5 A | TI SLVS044Z [V] | V | 0.25 |

### 4.4 Sources and instruments
| Item | Model | Source |
|---|---|---|
| AA alkaline | 1.5 V, r 0.146 Ω fresh (0.3 Ω part-used, game value) | Energizer EN91 [V] |
| 9 V PP3 alkaline | 9.0 V, r 1.7 Ω fresh (1.7-2.1 Ω at 1 kHz across makers), "tired" 8.4 V/6 Ω (game-defined) | Duracell MN1604 [V, search summary]; Energizer 522 lists none |
| CR2032 | 3.0 V, r ≈ 25 Ω fresh, 40 Ω late (graph read of 20-35 Ω → 40 Ω) | Energizer CR2032 [V graph read] |
| Bench supply | 0-15 V, CC 0-1 A, 10 mV / 1 mA steps | game instrument |
| Function generator | 0.1 Hz-1 MHz, 0-10 Vpp, 50 Ω out | game instrument |
| Mains | **pack data** (§12): `global` 230 V rms, 50 Hz, ticket conditions ±10 % (IEC 60038 nominal; the ±10 % band is the common supply tolerance, secondary sources, standard paywalled); `na` 120 V 60 Hz (ANSI C84.1 range A is ±5 %, the game uses ±10 % for uniform tickets: named in the Codex); `in` 230 V 50 Hz per CEA regulations [R: tolerance unverified, likely +10/−6 %] | IEC 60038 (secondary sources) |
| DMM | V 10 MΩ; A burden 0.1 Ω, 400 mA fuse / 10 A range 0.01 Ω; Ω (1 mA test current) | typical handheld [R] |
| Scope probe | 10 MΩ ∥ (capacitance off in v0.1) | ×10 probe convention |

**Entry counts v0.1:** 24 semiconductor parts, 9 ICs, about 380 passive SKUs (values × ratings), 12 misc parts, 4 sources, 4 instruments. **Verified now:** 33 parameters across 17 parts. **To verify in data entry:** every
[R] above, all prices, all LED data and the thermal τ estimates (which stay "estimate" in the Codex).

### 4.5 Catalogue schema
```ts
interface PartDef { id: string; kind: 'R'|'C'|'L'|'D'|'LED'|'Z'|'NPN'|'PNP'|'NMOS'|'OPAMP'|'CMP'|'555'|'REG'|'XFMR'|'MISC';
  name: string; footprint: FootprintId; values?: number[]; ratings: Record<string, number>; model: Record<string, number>;
  thermal: { thetaJA: number; tauS: number; tMax: number; tFail: number; heatsinkable?: boolean };
  priceUSD: number; source: { doc: string; url?: string; accessed?: string }; verified: boolean; codex: string; simplifications?: string[] }
```

---

## 5. World view and art direction

**Rule:** the bench is the world. It stays visible behind every drawer, as GIGAWATT's hall did. Nothing looks like a SPICE GUI: no schematic symbols on the main view, no grey
dialogs, no tables over the board. Data appears *on* objects: glow, dots, needles and phosphor.

### 5.1 Camera and rendering
- **2.5D**, Godot `CanvasItem` 2D with shader layers (normal-mapped sprites drawn procedurally in code, GIGAWATT's "motherboard drawn in code" approach, so there is no external art pipeline). Top-down
  with a 12° perspective tilt via a skew shader on the board layer. Parts have fake height (drop shadows, specular strip), so a TO-220 visibly stands taller than a resistor.
- **Scene**, back to front: the stall wall (the arcade lane through a window strip at the top edge: time of day per chapter, rain on the awnings in ch4, hand-painted and neon signs, a passing tram silhouette; every backdrop element is a `godot/regions/<id>/` asset slot so a pack can swap it) → the walnut
  workbench with mat, solder stains, a tea mug, Wren's notebook and Rezzy the cat (idle animations) → the **perfboard** (matte black solder mask, gold ENIG pads, a silkscreen grid, the brass edge connector
  with engraved IN/OUT/GND) → parts and wires → overlays → the instruments docked on the right (the oscilloscope as a physical CRT bezel).
- **Board camera**: pan and zoom (fit, 1×, 2×, 4×), snapping to the pad grid. On phones the board auto-fits the ticket's board size.

### 5.2 Living circuit overlays (all physics-driven)
| Overlay | Encoding | Source |
|---|---|---|
| **Node voltage** | traces and pads tinted on a diverging map: −15 V deep cyan → 0 V neutral slate → +15 V amber → magenta above. The map auto-scales to the ticket's supply range | node voltages |
| **Current dots** | bright particles along wires and through parts. Speed ∝ log₁₀(|I|/1 µA) clamped to [0.2, 6] pads/s, density fixed, direction = conventional current (Settings: electron flow). They pause when the sim pauses. AC shows as oscillating dots | branch currents |
| **Heat** | blackbody ramp on the part body (dull red ~400 K-equivalent visual at Warm → orange → yellow-white at Hot) + a heat-shimmer refraction shader + rising wisps above Hot | thermal state |
| **Smoke** | particle burst (grey-blue, rises with curl noise), a char decal on the part and board, the part blackens; electrolytic: the vent top bulges and pops; LED: a crack line | failure event |
| **Ratings bars** (Learner) | tiny bars on each part: P/Prated, I/Imax, V/Vmax; green → amber → red | rating ratios |
| **Light** | LEDs emit coloured bloom ∝ current (log), lamps glow, the 7-segment counter lights | device current |
| **Motion** | fans spin ∝ voltage, relays click and the contact flips, galvanometer needles swing with damped motion | device state |

### 5.3 Hero instruments
- **Oscilloscope** (always visible: a right column on desktop, a drawer with a peek strip on phone/Deck): a CRT bezel with knobs. Phosphor P31 green trace (CH1) and P7-ish amber-white (CH2), additive
  blending, bloom, persistence decay (0.15 s), a slight barrel curvature and scanline shader. Graticule 10×8 divisions. **Target band**: a translucent amber ribbon (the ±ΔV, ±Δt tube from §3.12).
  When the trace sits entirely in the band, the band **locks**: a soft chime, the band turns green, and "LOCK" lights on a small VFD. Failing samples flash red at bench time. Readouts in a VFD font:
  V/div, s/div, trigger, measurements.
- **Bode plotter** (ch7): an amber vector-display look. Magnitude and phase curves, the mask as hatched forbidden regions, a cursor readout.
- **DMM**: a chunky yellow handheld with an LCD and a rotary dial. The probes are real objects dragged to pads; the dial clicks.
- **Bench supply / function generator**: seven-segment red displays and knobs (mouse wheel, pad stick or touch drag to turn).
- **Thermal camera** (ch4): a false-colour overlay toggle with °C labels on hot parts.

### 5.4 Palette and type
| Token | Hex | Use |
|---|---|---|
| bench-walnut | `#3B2A20` | world background |
| mask-black | `#14161A` | board |
| pad-gold | `#D4A74A` | pads, connector |
| phosphor-green | `#7CFF6B` | CH1, success |
| phosphor-amber | `#FFB547` | band, CH2, warnings |
| node-cyan | `#38D6FF` | negative voltage |
| node-slate | `#5B6573` | 0 V |
| node-magenta | `#FF4FA3` | high voltage |
| heat-red / heat-white | `#FF3B1F` / `#FFF4D6` | thermal ramp |
| smoke-grey | `#8C96A3` | smoke |
| notebook-paper / ink | `#F3EAD3` / `#2B3A67` | Codex, coach cards |
| NODE accent (kit theme) | `#7CFF6B` | cobanana kit accent for this game |

Type: a VFD/LCD-style mono for instruments (an OFL font such as "Share Tech Mono"), a warm handwritten face for Wren's notes (OFL "Kalam": it also covers Devanagari, so a future Hindi locale needs no font swap), and a clean grotesk for UI (OFL "Inter").
Colour is never the only signal: voltage colour is paired with hover/probe numbers, heat with icons, and pass/fail with icons and text (accessibility, §6.6).

### 5.5 Audio
- **Ambience** (pack asset slot): market-arcade bed (distant traffic, chatter, a kettle whistle at random, a tram bell), with a ch4 rain layer.
- **Bench**: the CRT's soft mains hum (pitch = the pack's mains frequency: 50 Hz in `global`) + faint flyback hiss (low volume, a toggle); a relay click on power on/off; a thunk on part placement; a wire "zip"; a pot scratch; knob detents; the DMM beep on continuity.
- **Physics sounds**: a warm part ticks; a hot part sizzles (filtered noise ∝ temperature); smoke is a **pop** (resistor), a **bang + hiss** (electrolytic vent) or a sharp **crack** (LED); a fuse goes *tink*; the regulator ticks
  on each thermal shutdown cycle; the relay clacks.
- **Success**: the band-lock chime, then a cash-register *ka-ching* and the customer's reaction stinger.
- **Circuit audio**: the speaker, buzzer and finale synth play the simulated waveform (§3.11). The speaker monitor (ch8) can listen to any node, so you *hear* clipping, slew distortion and filter sweeps.
- **Music**: 8 tracks, one per chapter, varied in structure (the GIGAWATT user rejected samey tracks): lo-fi market beats with hand percussion and a Rhodes-style keys bed (pack asset slot: a pack may ship its own variants); a ch6 jazz-funk track for the music shop; ch8 analog-synth
  arpeggios. Adaptive: the drums drop out while the bench runs, and a filter sweep plays on lock. Ducking under dialogue barks.

---

## 6. Screens, drawers and input map

### 6.1 Screen list
| Screen | Kind | Content |
|---|---|---|
| Title | full | animated bench, NODE neon sign, Continue / New / Load / Settings / Codex / Quit (two-column on short screens, GIGAWATT lesson B5) |
| Lane map (ticket select) | full, diegetic | the arcade lane with customer stalls as chapter clusters; tickets as paper slips with stars; encore slips glow |
| **Bench** (main) | world + drawers | board centre-left, scope right, parts tray bottom, ticket card top-left (collapsible), HUD top-right (power, bench, undo/redo, menu) |
| Parts tray | bottom drawer | category tabs (R C L D LED Q FET IC Src Misc), value picker, price and rating chips |
| Instruments | right drawer tabs | Scope · DMM · Supply/Gen · Bode · Thermal |
| Bench report | modal sheet over the board (board stays visible) | per-condition results, failing items with numbers + "Why?" links, stars, histograms, Bench Card share |
| Exam card (EB) | modal | printed problem, prediction entry, then dismissed to the board |
| Codex (Wren's notebook) | full-screen workshop (like GIGAWATT's Codex) | concepts, parts, simplifications, your failures log, mini interactive plots |
| Sandbox | bench variant | no ticket; draw-your-own band; share codes |
| Settings | modal | display, UI scale, text boost, theme, audio, thermalSpeed, current-dot convention, input glyphs, reduced motion, colour-blind palette |
| Pause | modal | resume, restart ticket, settings, codex, save & quit (desktop only) |

**Modal discipline** (`core` kit): one `modal()` query. Hotkeys and board clicks are inert behind modals. Esc/B/Back closes one layer. Never quit without autosave (GIGAWATT B1-B7).

### 6.2 Interaction inventory and full input map
| Interaction | Mouse + keyboard | Controller (Steam Deck, `CB_PAD=1`) | Touch |
|---|---|---|---|
| Move cursor / hover | mouse | left stick (accelerated, pad-snapped) / D-pad (1 pad per press, repeat) | n/a (tap) |
| Pick a part from the tray | click a tray item (or keys 1-9 for category, ←/→ to cycle) | **hold LT → radial picker**: right stick picks a category wedge, release opens a value wheel (stick up/down steps E-series, LB/RB decade), A takes the part | tap a tray item: the part attaches to the finger with a ghost **48 px above** the touch point |
| Place a part | click a pad (the ghost previews snap and pins) | A | lift the finger over the pad (the ghost shows the snap); a tap elsewhere cancels |
| Rotate | R (or wheel while holding a part) | X | the rotate button on the action ring, or a two-finger twist while holding |
| Flip | F | hold X 0.5 s | ring button |
| Select part | click | A on a part | tap a part (opens the **action ring**: rotate, value, swap, delete, info) |
| Move part | drag | A on a part → move cursor → A | press and drag the part |
| Delete | Del / Backspace | **hold Y 0.6 s** (ring fills) | ring → trash, or drag to the tray |
| Edit value | double-click (wheel steps E-series, type "4k7", Enter) | Y → value wheel (up/down step, left/right decade, A confirm, B cancel) | ring → value: a wheel picker with large ±; keyboard entry optional |
| Swap variant (rating / package) | Alt+wheel on a part | in the value wheel, LB/RB cycles the rating | ring → swap: chips |
| Start a wire | press on a pad and drag | A on an empty pad starts, the cursor routes | **long-press 250 ms** on a pad, then drag (a loupe magnifier appears offset from the finger) |
| Route / elbow | auto L-route; Shift toggles the elbow; click intermediate pads to add bends | X toggles the elbow; A on an intermediate pad adds a bend | drag through intermediate pads to bend |
| Finish a wire | release on a pad | A on the target pad | lift on the pad |
| Cancel | Esc / right-click | B | lift off-board or tap ✕ |
| Delete a wire | click the wire + Del, or right-click → delete | A on the wire → hold Y | tap the wire → ring trash |
| Probe CH1 / CH2 / DMM | drag the probe tip from the scope/DMM to a pad; or P then click (cycles CH1→CH2→DMM) | **hold RT** (probe mode): A = CH1, X = CH2, Y = DMM, B = remove the probe under the cursor | tap the CH1/CH2/DMM chip on the scope, then tap a pad |
| Hover readout (Learner) | hover | cursor dwell 0.3 s | press and hold on a node/part (tooltip above the finger) |
| Scope timebase / volts / trigger | wheel over the knobs; [ ] = s/div, ; ' = V/div, T = trigger level, A = auto-set | scope drawer focused: D-pad selects a knob, left/right turns it; R3 = auto-set | drag knobs; an "Auto" button |
| Power on/off | Space | **View (⧉)** button | big power button (HUD) |
| Run bench | Enter / B key | in the HUD: A on "Run bench"; also **Menu-hold 0.5 s** | "Run bench" button |
| Undo / redo | Ctrl+Z / Ctrl+Y | L4 / R4 back buttons (Deck); otherwise the pause menu | HUD ↶ ↷ buttons |
| Pan board | middle-drag, Space+drag, WASD / arrows | right stick | one-finger drag on empty board, two-finger drag anywhere |
| Zoom | wheel, + / − | R3 cycles fit / 1× / 2× / 4×; hold R3 + right stick for smooth zoom | pinch; double-tap empty board = fit |
| Overlays | V voltage, I current dots, H heat, G ratings bars | L3 cycles none → V → I → heat | overlay chip in the HUD |
| Drawers | Tab / Shift+Tab cycle; C Codex; 1-5 instruments with Ctrl | LB / RB previous/next drawer | edge tabs; drag the divider to resize; tap the divider to fold |
| Rewind (Learner) | Ctrl+Backspace or a ⟲ button | hold LB+RB | ⟲ button (scrub bar) |
| Hint ladder | F2 | in the ticket card: A on "Hint" | "Hint" on the ticket card |
| Ticket card | Q toggles | Select-hold / ticket drawer | tap the card tab |
| Settings | F1 | pause → Settings | pause → Settings |
| Pause / back | Esc (closes the top layer first) | Start (menu) / B | Android Back: closes the top dialog → drawer → pause menu (never quits, GIGAWATT B3) |

Controller specifics: focus rings on every control type (sliders, knobs and the value wheel included). The cursor never leaves the board while the board is focused, and LB/RB is the only way into drawers, so there are no focus traps
(GIGAWATT B4). The radial picker shows button glyphs drawn as icons, not font glyphs (GIGAWATT lesson). The pan stick speed is tuned so the full board width takes 1.2 s.

### 6.3 Keyboard-only play
All interactions are reachable without a mouse: arrow keys move a pad cursor (as on the pad), Enter acts as A, Esc as B, R/X rotate, Del deletes, P probes, Space powers. Tab navigation works from the first frame, not
only after pad use (GIGAWATT gap).

### 6.4 Layout targets (core layout system)
| Layout | Board | Scope | Tray | Ticket |
|---|---|---|---|---|
| Desktop ≥ 1600 w | 62 % width | docked right 38 %, Bode as a tab | bottom 120 px strip | top-left card |
| Desktop 1280-1600 / Deck (handheld) | 64 % | right drawer 36 %, peek strip when folded | bottom strip 96 px | collapsible chip |
| Phone 2424x1080 + insets | full width minus a 72 px rail | right drawer (30 % default, resizable), a 2-line peek of the trace when folded (LOCK light always visible) | bottom sheet, 52 px targets | top chip |
Audit: zero squeezed or overflowing controls at 1280x720, 1280x800, 1920x1080, 2560x1440, 3440x1440, 3840x2160 and phone 2424x1080 with insets (PROGRAM.md quality bar 5).

### 6.5 Env hooks (game-specific additions to `CB_*`)
`CB_LEVEL=3-2` opens the ticket. `CB_BOARD=<solution code>` preloads a board. `CB_POWER=1` powers on. `CB_BENCH=1` runs the bench at start. `CB_OVERLAY=v|i|heat`. `CB_SMOKEDEMO=<partId>` forces a smoke for screenshots.
`CB_THERMAL_SPEED=n`. `CB_REGION=global|in|na` selects the region pack (default `global`; `in` and `na` exist only in debug builds in v0.1). `CB_SCORES=off|mock|<url>` points the leaderboard client at no server, the in-process mock or a URL (QA never hits production). These come on top of the PROGRAM.md list.

### 6.6 Accessibility
Colour-blind-safe voltage map option (viridis-like); "reduced motion" turns off shimmer, scanline and smoke particle density; text boost; every numeric overlay can be read by hover/probe/tap; audio cues have visual pairs (lock
light, smoke icon); scope trace thickness setting.

---

## 7. Teaching

### 7.1 Coach (from real state, 1-1 Torch example)
Steps advance on **engine queries**, never on timers (GIGAWATT pattern). Text follows the input device.
| # | Shown when | Text (mouse; touch/pad variants auto-swap verbs) | Advances when |
|---|---|---|---|
| 1 | ticket open | "Lio's torch: light the LED without burning it. Drag the **LED** onto the board." | an LED is on the board |
| 2 | LED placed | "LEDs have a + leg (longer). Wire the **battery +** to the LED's long leg, and its short leg to **GND**." | the LED is in a closed loop with the battery (with or without R) |
| 3 | loop closed, no resistor | "Press **Space** to power on." | power on |
| 4a | the LED smoked | (the explainer opens, §7.3) "Undo with ⟲, then try again with a resistor in the loop." | the board has R in series |
| 4b | the LED is lit with R | "See the dots? Their speed is the current. Hover the LED: 14 mA." | hover/probe on the LED leg |
| 5 | current known | "The ticket wants 10-20 mA. Press **Enter** to run the bench." | bench run |
| 6 | pass | "That's the job. The histogram shows how cheap others did it." | dismiss |
Every ticket in chapters 1-2 has 3-6 coach steps, chapters 3-8 have 1-3 (first-use of new instruments only). Coach text is data (`level.coach`) with condition ids resolved by `src/coach.ts` queries.

### 7.2 Hint ladder (Learner; "assisted" in Engineer)
1. **Nudge** (concept): "The LED needs something to limit current."
2. **Equation with your numbers**: "R = (V_battery − V_LED)/I = (9 − 2.0)/0.015 ≈ 467 Ω." The numbers come from the live solver (your battery, your LED).
3. **Partial build**: the ghost of one missing part placed at a suggested pad, which the player must confirm. Hints are generated from the ticket's `ref` and live state, never a full auto-solve in campaign.

### 7.3 Explain-after-failure (productive failure tied to *your* numbers)
Each failure class has an explainer template filled from the engine's state at the moment of failure. It opens as Wren's notebook page beside the board, with the smoked part highlighted and a mini plot
(P vs time, the I-V curve with the operating point, the scope band with failing samples). Templates (`src/sim/explain.ts`):
| Failure | Template (example values filled) |
|---|---|
| Resistor overpower | "**R2 dissipated 0.61 W but is rated 0.25 W.** P = V²/R = (3.67 V)²/22 Ω. At 2.6× its rating its surface passed 250 °C and the paint burned. Use a 1 W part, or split the heat: two 47 Ω ½ W in parallel share it (0.31 W each)." |
| LED overcurrent | "**The LED took 0.60 A; it's rated 0.03 A.** With nothing else in the loop, only the battery's 1.7 Ω and the LED's own ~10 Ω limited the current. Add a series resistor: R = (9 − 2.0)/0.015 ≈ 470 Ω." |
| Electrolytic overvoltage | "**C1 (16 V) saw 17.1 V** at high mains (253 V × 12/230 × √2 − 2 diode drops). Electrolytics vent above their rating. Pick 25 V: give ~30 % margin." |
| Electrolytic reversed | "**C3 had −4.2 V across it.** The stripe marks the − leg. Reverse voltage grows gas inside until the vent pops." |
| Transistor active-region heating | "**Q1 sat at Vce = 3.1 V while carrying 0.2 A → 0.62 W** (rated 0.5 W). It wasn't saturated: the base got 4 mA but needed ≥ 20 mA (forced β 10). Lower Rb." |
| Inductive kick | "**Q1's collector spiked to 64 V** (Vceo 40 V) when it turned off: the fan's inductance keeps current flowing (v = L·di/dt). A diode across the fan gives that current a path." |
| MOSFET under-driven | "**Q1 had 3.3 V on its gate; its threshold is 2.1 V, so it could only pass 38 mA and dropped 10.5 V doing it → 0.40 W in a part that sheds 312 °C per watt.** 'Logic-level' FETs (IRLZ44N: 25 mΩ at 5 V) turn fully on from microcontroller pins." |
| Regulator thermal | "**U1 burned 5.0 W:** (15 − 5) V × 0.5 A. With no heatsink: Tj = 40 + 5 × 54 = 310 °C, so it kept shutting down at 150 °C (that's the flicker). θ_total must be ≤ (125 − 40)/5 = 17 °C/W." |
| Op-amp slew | "**The output could only move 0.5 V/µs; your 10 V peak at 50 kHz needs 3.14 V/µs** (2π·f·Vp). That's why it turned into a triangle." |
| GBW | "**At gain 100 the LM358's bandwidth is 0.7 MHz / 100 = 7 kHz**: 20 kHz is −9.6 dB. Split the gain across two stages (each 70 kHz)." |
| Loading | "**Your 5.6k/3.3k divider gives 3.34 V unloaded, but the 10 kΩ load sits in parallel with R2**, so the output drops to 2.76 V. Thevenin: the load sees R1 ∥ R2." |
| Saturated at DC (AC spec) | "The Bode plot needs the amp to sit mid-rail. Your OUT is stuck at +10.5 V because the + input is above the − input with no feedback." |
| Oscillator dies | "Loop gain at 955 Hz is 0.83 (needs ≥ 1): the RC ladder attenuates by 29, your amp gains 24. Raise Rf to ≥ 29 × R." |
| Band miss | "OUT crossed 6.32 V at **1.08 s** (spec 0.95-1.05 s). τ looks right (1 MΩ × 1 µF), but the scope probe's 10 MΩ makes a divider: Thevenin R = 0.91 MΩ, final V = 9.09 V. Use smaller R, bigger C." |
| Floating gate / node | "Q1's gate isn't connected to anything with a DC path. A real FET's gate holds random charge and could be on or off. Add a pull-down (100 kΩ)." |
| Convergence | "The solver couldn't settle. Two diodes back-to-back across a source with no resistance have no finite answer. Add a resistor." |
Explainers are written in plain words first, then the equation. The full Codex page is one tap away. **The failure log** in the Codex keeps every explainer you have triggered (with replay), so the player's own mistakes become
their study notes.

### 7.4 Codex (Wren's notebook): v0.1 entries
Each entry has: what (2 lines), the equation, why it matters, **"you saw this when…"** (links to the player's own failures), a mini interactive plot (slider → curve), "What we simplified", and syllabus tags
(generic topic tags + university text chapter, e.g. Sedra-Smith/Hayt; the **syllabus map is region-pack data**: the `in` pack maps tags to NCERT chapter/section and JEE topic, a future `uk`/`us` pack to A-level/AP). 48 entries in v0.1; cross-links to GRID per §1.8 (feeder-scale power factor, network transformers):
- **Electricity**: current & charge; voltage & EMF; Ohm's law; resistivity & resistors (E-series, tolerance, colour code); series/parallel; power & ratings (derating curve); internal resistance & terminal voltage; max power transfer;
  Kirchhoff's laws; cells in series/parallel; Wheatstone bridge; metre bridge; potentiometer; nodal analysis; mesh analysis; superposition; Thevenin & Norton.
- **Fields & storage**: capacitance; capacitors in networks; energy stored & charge sharing; RC charging/discharging; inductance; RL transients; energy in inductors & flyback.
- **AC**: AC & RMS; reactance; impedance & phasors; series LCR & resonance; Q and bandwidth; power factor & average power; transformers; Bode plots & decibels.
- **Semiconductors**: diodes & the Shockley equation; rectifiers & ripple; Zener regulation; LEDs; BJT operation (cutoff/active/saturation); BJT switch & amplifier; MOSFET switch; logic gates (diode, transistor, NAND universality).
- **Op-amps & systems**: the ideal op-amp & virtual short; inverting/non-inverting; GBW & slew; rails & headroom; comparators & hysteresis; integrators; active filters (Sallen-Key); oscillators (Barkhausen, phase shift, 555);
  linear vs switching regulators; thermal resistance & heatsinks.
- **Bench craft**: probes and loading (10 MΩ), meters and fuses, tolerances & Monte Carlo, mains safety and isolation.
- **What we simplified**: one page per §3.13 item (honesty is a feature).

### 7.5 Plain-words rule
Every UI string goes through a "plain words" pass: no unexplained jargon, glossary chips on first use (as GIGAWATT's "WORDS"), units always shown, numbers rounded to 3 significant figures in prose and full precision on probe readouts.
**Strings are externalised (user decision 3: English-only v0.1).** No player-facing literal lives in rule or UI code:
- Engine side: `src/locales/en.ts` (core `createI18n`; teaching messages, explainers, bench report lines, coach, hints, Codex, ticket briefs) resolved by `t(key, {vars})`;
  every `fail()`/`need()` message is `t('err.<id>', {...})`. Regional flavour (customer names, places, mentor voice lines, ticket briefs that name
  people) lives in the region pack's `strings` (core `defineRegion`), so **region ≠ language**.
- Godot side: chrome strings (buttons, settings, menus) in `godot/i18n/en.csv` via `TranslationServer`; engine strings arrive already resolved.
- Numbers and money are formatted by core `formatMoney`/`formatNumber` with the pack (`global`: `$1.25`, `1,234.5`; `in`: `₹105`, lakh grouping `1,23,456`).
- Tests: a lint test fails on any string literal passed to `fail`/`need`/`ok`/`log` in `src/` (except `t(...)`); a key-coverage test checks every key
  used exists in `en` and every `en` key is used (core `checkLocales`, `missingKeys()` empty after every persona run); the region leak test (§12.4) checks no `in` names or ₹ appear in the `global` build.
- Hindi is a v0.2 locale target (the notebook font already covers Devanagari).

---

## 8. Engine architecture (on cobanana-core)

### 8.1 Layout (mirrors GIGAWATT; PROGRAM.md layout)
```
src/
  engine/  protocol.ts (core kit) · state.ts · persistence.ts · actions/{board,wire,values,probe,instruments,bench,session,sandbox}.ts
           queries/{board,live,scope,bode,bench,explain,codex,progress,histogram}.ts
  sim/     board/{grid,footprints,connectivity}.ts      pads → nodes (union-find)
           mna/{netlist,compile,stamp,topology,op,tran,ac,events,bypass}.ts
           mna/devices/{r,c,l,vsrc,isrc,battery,bench,diode,bjt,mosfet,opamp,comparator,t555,regulator,xfmr,switch,relay,fuse,ntc,pot,slidewire,meter,pin,pwm}.ts
           thermal.ts · ratings.ts · smoke.ts · explain.ts
           bench/{spec,run,compare,metrics,dft,mask,montecarlo,score}.ts
           live.ts        (frame advance: compile-if-dirty → topology → op-if-needed → tran advance → thermal → ratings/smoke → scope capture → coach)
  data/    parts/*.ts (catalogue §4, region-independent physics: ratings + models) · levels/<id>.ts (§2.9) · codex.ts · par/<id>.json (generated by calibrate-levels)
  regions/ index.ts (registry) · <id>/index.ts (`defineRegion`: currency, numbers, standards, strings, leakMarkers) + <id>/data.ts (mains, prices, availability, customers, examBridge, syllabus)   (§12; global ships, in = draft, na = test-only)
  locales/ en.ts  (engine strings, §7.5)
  verify.ts  board-code.ts   (core `makeVerifier` + scores adapter; the canonical board payload codec, §11; no Node APIs)
  (the leaderboard client is the shared Godot addon `cobanana_scores` from the cobanana-scores repo: offline queue, histogram cache, first-run notice, §11.4)
  env/     env.ts · agents.ts · scenarios.ts      (Gym API, core)
  playtest/ personas.ts · invariants.ts · run.ts
  coach.ts · concepts.ts
scripts/   calibrate-levels.ts (solver-bot population → par + histograms) · ngspice-ref/ (decks + committed CSVs) · build-wiki.mjs
godot/     main.gd shell (core addon) · world/bench_view.gd · ui/{scope,bode,dmm,tray,ticket,report,codex,exam}.gd · fx/{dots,heat,smoke,phosphor}.gdshader
```
Rules (GIGAWATT ARCHITECTURE.md): `sim/` and `data/` never import `engine/`. Every player command is an action returning `{ok, message}` with a teaching message. Everything the UI shows is a query.

### 8.2 What NODE needs from cobanana-core numerics (request to the core director)
| Core API | Used for | Notes |
|---|---|---|
| `lu(A: Float64Array, n)` → factor with partial pivoting, `solve(f, b)`, `refactorInPlace` | DC/transient | must expose the pivot magnitudes (singular detection) and allow factor reuse |
| `clu(Are, Aim, n)` complex LU + solve | AC | split real/imag arrays, no object-per-complex |
| `dampedNewton({residual, jacobianSolve, limit?: (xNew, xOld) => x, maxIter, tol})` | DC OP | the **`limit` hook** is required for pnjlim/fetlim. NODE keeps its own MNA-specific loop if the core's signature can't take it |
| `integrators`: BE/TRAP coefficient helpers | companions | trivial. NODE's companions stay in NODE |
| `rng(seed)` | Monte Carlo, encore seeds, kicks | seeded, splittable |
| `roots.brent`, `goldenSection` | Bode peak refinement, oracle tests | |
| `units` parse/format with engineering prefixes | UI and data | "4k7", "100n", "2.2µ" |
| protocol kit, persistence, env, golden helper, persona runner | as all games | |
GRID shares the complex LU (load flow). EQUILIBRIUM shares Newton. Any change there needs a core version bump.

### 8.3 GameState (review: rewritten to fit the core contract)
The core `Engine` clones the whole state on every action (clone-and-commit) and requires plain JSON (no `Float64Array`, `Map`, `undefined` tricks).
The original sketch used typed arrays and a wall-clock `advance(maxMs)`; both are fixed here.
```ts
interface NodeState extends BaseState {                     // BaseState: game, seed, rng, tick, mode, level, levelStart, status, statusReason, missionsDone, log, saveVersion
  // BaseState carries the region id (core `baseState(game, seed, mode, region)`); the ruleset id is derived (core `rulesetFor`)
  progress: { tickets: Record<LevelId, { best: Metrics | null; stars: 0|1|2|3; passed: boolean; assisted: boolean; attempts: number; smokes: number; bestCode: string | null }>;
              wallet: number;                                // integer cents of the pack currency (no float money)
              upgrades: UpgradeId[]; reputation: Record<CustomerId, number>; codexSeen: string[];
              failureLog: FailureRecord[] };                 // capped at 200, oldest dropped (the leaderboard queue lives in the Godot scores addon, §11.4)
  ticket: null | {
    id: LevelId; hidden: Record<string, number>;             // seeded hidden params (encore / engineer); Learner uses the level's fixed values
    board: { parts: PlacedPart[]; wires: Wire[]; probes: Probe[]; meter: MeterState };
    instruments: { supply: SupplyState; gen: GenState; scope: ScopeSettings; bode: BodeSettings | null };
    live: { powered: boolean; frame: number; t: number;     // sim seconds
            x: number[];                                     // MNA unknowns at the last accepted step (≤ 48 numbers)
            hist: number[];                                  // companion history (capacitor currents, inductor voltages)
            temps: Record<PartUid, number>; smoked: PartUid[]; status: 'ok'|'float'|'noconv'|'loop';
            scope: { ch1: number[]; ch2: number[]; t0: number; dt: number } };   // decimated ring buffer, ≤ 512 points per channel
    undo: BoardSnapshot[]; redo: BoardSnapshot[];           // each capped at 40 (parts + wires + values only)
    predictions: Record<string, number>; lastBench: BenchResult | null; tolerance: { done: number; total: number; failures: number } | null };
}
```
- State size budget: ≤ 64 KB serialised with full undo stacks (asserted in a test); a clone costs well under 1 ms, so 30 `advance` calls per second are fine.
- The **compiled netlist / LU symbolic data** are *not* in the state: they are a pure-function memo (`compile(boardHash)` LRU, 8 entries) in `sim/mna/compile.ts`.
  This is the only permitted module-level cache; a test asserts results are identical with the cache disabled.
- `GAME.snapshot` is overridden: after each act Godot receives a slim view (no undo/redo, no scope ring buffer, no failure log); scope, nodes, currents
  and thermal come through queries. This keeps the bridge traffic per live frame ≤ 16 KB.
- **Campaign vs core levels.** The core `startLevel` builds a fresh `newGame` state (it would wipe campaign progress) and marks the level won/lost,
  after which the engine refuses further actions. So the campaign never uses `startLevel`: `openTicket(id)` opens a ticket inside the campaign state
  with `s.level = null`. The same ticket setup function is registered as a core `Level` (`setup` = open the ticket on a fresh state, `goal` = bench passed,
  `solver` = the ref replay) so `checkAllLevels` and the persona runner exercise exactly the campaign code path.
- **Autosave.** The core autosaves after every built-in `tick`; NODE does not use `tick` for live simulation (it would write the autosave 30×/s).
  Live frames use the game action `advance(frames)`; Godot calls `save('auto')` after board edits (debounced 2 s), after every bench, on pause, focus
  loss, Android pause and quit. `systems` is empty.
- Saves: `saveVersion` starts at 1 with a migration table from day one; a save from another region pack loads only into that pack (the pack id is checked in `validateSave`).

### 8.4 Actions (all through the protocol; same set for the UI, the env and personas)
`openTicket(id)`, `closeTicket()`, `placePart(partId, value, rating, x, y, rot, flip)`, `movePart(uid, x, y)`, `rotatePart(uid)`, `deletePart(uid)`, `setValue(uid, value)`, `swapVariant(uid, rating|package)`,
`addWire(path: Pad[])`, `deleteWire(wid)`, `attachProbe(ch, pad)`, `detachProbe(ch)`, `setMeter(mode, pads)`, `setSupply(v, ilim)`, `setGen(shape, f, vpp, offset)`, `setScope(...)`, `setPot(uid, α)`, `setJockey(uid, l)`,
`power(on)`, `advance(frames)` (1-8 live frames; deterministic), `runBench()`, `runTolerance(k)` (k Monte Carlo samples per call), `rewind(frames)` (Learner; restores a snapshot of `live` kept for the last 150 frames, which is *not* persisted), `undo()`, `redo()`, `hint()`, `predict(id, value)` (EB), `submitMeasurement(id, value)` (2-2), `realityCheck(on)` (EB), `replaceSmoked(uid)`,
`buyUpgrade(id)`, `setMode(mode)`, `loadBoard(payload)` (the solution-code action, §11.2), `loadSolution(code)` (decodes a CB1 code and calls loadBoard after the ticket/ruleset checks), `exportSolution()` (returns the code and the exact metrics to submit, §11), `sandboxSetBand(...)`.
All numeric arguments are quantised on entry (values must be catalogue values; pot α to 1/1000; supply to 10 mV / 1 mA; jockey to 0.1 mm; generator to 3 significant figures), so every board state has exactly one solution-code encoding.
Validation messages teach ("That pad is under the 7805's heatsink", "An electrolytic has a polarity: its stripe leg is −", "This ticket's bin has no 2 W resistors: try two in parallel") and are i18n keys (§7.5).

### 8.5 Queries
`board`, `netlist` (debug/agents), `nodes` (voltage per pad set + colour scalar), `currents` (per wire segment: magnitude, direction for dots), `thermal`, `ratings` (ratios), `scope(ch, window)`, `bode`, `meter`, `liveStatus`,
`benchResult`, `explain(failureId)`, `coachStep`, `ticketCard`, `levels`, `progress`, `histogram(id, metric)`, `codex(id)`, `failureLog`, `parts(binOnly)`, `legalActions`.

### 8.6 Systems (live frame pipeline, `sim/live.ts`)
`compileIfDirty → topologyCheck → dcopIfNeeded → transientAdvance(budget) → thermalAdvance(wallDt × thermalSpeed) → ratingsAndSmoke → scopeCapture(decimate) → coachEvaluate`.
The bench (`sim/bench/run.ts`) is a **pure function** `(board, level, hidden, mode) → BenchResult`, independent of live state. That makes it trivially testable and runnable by bots in parallel.

### 8.7 Agent environment (core Gym API)
- `reset({seed, level, mode})` → obs. `step(action)` → `{obs, reward, done, truncated, info}`. `legalActions({full})` dry-runs candidate actions. `hash()`.
- **Obs**: ticket spec (structured), bin, board (parts, wires) + derived netlist, last bench result (per-spec margins), live summary (node V, part temps, smoked), an EB prediction slot. Text `describe()` for LLM agents
  (netlist in SPICE-like cards + spec + bench report).
- **Action space**: (a) **board level**: the §8.4 actions with pad coordinates (for UI-faithful agents and personas); (b) **netlist level**: `submitNetlist(cards)` → the auto-placer realises it on the board (deterministic left-to-right
  placement, orthogonal router). It fails with a teaching message if the board is too small. Solver bots and RL use (b).
- **Reward**: +1 on the first pass, +0.3 per star, −0.05 per smoke, −0.001 per action, 0 otherwise. `done` on pass or after 400 actions (`truncated`).
- **Personas** (`src/playtest/personas.ts`), each run on every ticket × modes × 5 seeds:
| Persona | Behaviour | Must |
|---|---|---|
| **idle** | opens the ticket, powers on, runs the bench, nothing else | **fail every build ticket** (no ticket passes with the empty board or fixed parts only) |
| **expert** | replays `level.ref`, then tries the tolerance Monte Carlo | pass 40/40 with ★1+★2 on every build ticket; ★3 where the ref claims it |
| **novice** | places bin parts with heuristics from the hint ladder (rung 1-2 text only), random values within the bin, ≤ 60 actions | pass ≥ 80 % of ch1-2 tickets in Learner; median smokes per ticket 0.5-3 (smoke is supposed to happen) |
| **cheese-seeker** | runs the exploit catalogue (§9.6) | **never passes** with an exploit; every attempt yields a named reason |
| **smoker** | maximises damage (shorts, reversed parts, overvoltage) | engine never throws; no NaN; every smoke has an explainer; frame time within budget |
| **monkey** | random legal actions, 2000 steps | no crash, no NaN/Inf in any query, memory flat, live frame ≤ budget |

---

## 9. Test plan (quality is the jewel)

All engine tests are `vitest` under `src/**/*.test.ts`; the CI gate is everything green + `tsc --noEmit`. Test-first per rule module (PROGRAM.md TDD). Counts below are the v0.1 floor.

### 9.1 Textbook oracles (57 problems, asserted against the solver)
Provenance is honest. "-style (adapted)" means a textbook-type problem with our own numbers. "NCERT XII ch7 exercise (type recalled, number unverified)" marks the 4 problems recalled from NCERT whose numbering
was not verified. **No JEE paper or shift is cited**, because none could be verified. A source-checking worker with the physical books should upgrade citations in v0.2.
Each oracle lives in `src/sim/oracles/<id>.test.ts` as a netlist (SPICE-like cards parsed by `netlist.ts`) + analysis + assertion + model setting (`textbook` = ideal-diode-0.7 V, ideal op-amp, ideal sources; `real` = Shockley/EM/macro).
**Cross-check:** 17 of the 57 were re-solved from scratch by an independent worker. 15 agreed to ≥ 4 significant figures. 2 disagreed and were **resolved by the director**: NC-10's original netlist had an extra series resistor (fixed below; the corrected netlist gives exactly φ); for
SC-01 the checker used peak/π, and the original conduction-angle averages are correct (director-verified).

**Current electricity (NCERT XII ch3 style), linear DC, tol 0.1 %**
| ID | Circuit (cards abbreviated) | Assert |
|---|---|---|
| NC-01 | V 12; R1 4 in→a; R2 6, R3 12 a→0 | I = 1.500 A; V(a) = 6.000 V; P(R1) = 9.000 W |
| NC-02 | 3 cells (1.5 V, 0.5 Ω) series → 2 Ω; parallel → 2 Ω | (a) 1.2857 A, 2.5714 V (b) 0.69231 A, 1.3846 V |
| NC-03 | E 10, r 5, RL ∈ {5, 2, 10} | P = 5.000 / 4.0816 / 4.4444 W; η(5 Ω) = 50 %; sweep argmax at RL = r ±1 % |
| NC-04 | E1 10 + R1 2 → A; E2 5 + R2 3 → A; R3 6 A→0 | V(A) 6.6667; I1 1.6667; I2 −0.55556; I3 1.1111 (cross-checked) |
| NC-05 | balanced bridge 10/20, 15/30, Rg 50, 9 V | |Ig| < 1 nA; V(A) = V(B) = 6.000; I = 0.5000 A |
| NC-06 | bridge 10/20, 10/10, Rg 10, 10 V | V(A) 6.1538; V(B) 5.3846; Ig 0.076923 A; Is 0.84615 A (cross-checked) |
| NC-07 | metre bridge, wire 10 Ω, jockey 40 cm, R 5, S 7.5, 6 V; galvanometer 100 Ω from J (jockey) to K (R-S junction), Ig positive J→K | |Ig| < 1 nA; V(J) = V(K) = 3.600; perturb S = 8.5 → V(K) unloaded 3.778 V, Ig flows K→J (negative), magnitude from the solver |
| NC-08 | potentiometer: driver 4 V + rheostat 10 Ω + wire 10 Ω/100 cm; (b) test cell E = 1.5 V, r = 0.5 Ω, shunted by 4.5 Ω | V(50 cm) 1.000; V(75 cm) 1.500; (b) V(out) 1.3500, balance 67.5 cm, r = 0.5000 Ω |
| NC-09 | cube of 12 × 6 Ω, opposite corners, 10 V | Req 5.0000 Ω; I 2.0000 A (cross-checked) |
| NC-10 | ladder: 4 sections (series 1 Ω, shunt 1 Ω), **terminated with φ = 1.6180339887 Ω across the last shunt node** (no extra series R), 10 V | Req 1.6180340 Ω; I 6.180340 A (director-corrected) |

**Capacitance and RC/RL (NCERT ch2, ch6 style), transient, tol 0.5-1 %**
| ID | Circuit | Assert |
|---|---|---|
| CAP-01 | 110 V; 2 µF series (3 µF ∥ 6 µF); 1 GΩ bleed across each capacitor (Textbook-bin internal) | Ceq 1.6364 µF; Q 180.00 µC; V(a) 20.000 V; U 9.900 mJ (cross-checked) |
| CAP-02 | C1 4 µF @100 V → 10 Ω switch → C2 6 µF @0 | Vf 40.000 V; loss 12.000 mJ in R (energy ledger); τ 24 µs; loss independent of R (run R = 1, 10, 100) |
| CAP-03 | 12 V step, 10 kΩ, 100 µF | V(1 s) 7.5854 V; t(9 V) 1.3863 s; dt ≤ τ/200 |
| CAP-04 | 1000 µF @10 V, 2 kΩ discharge | V(3 s) 2.2313 V; t½ 1.3863 s; I(0) 5.000 mA |
| CAP-05 | 12 V; 2k in→m; 4k m→0; 1k m→c; 10 µF c→0 | V∞ 8.0000; Q 80.000 µC; τ 23.333 ms; V(τ) 5.0570 V (cross-checked) |
| CAP-06 | 12 V step, 6 Ω, 0.3 H | τ 50 ms; I(τ) 1.2642 A; t(1.5 A) 69.315 ms; I∞ 2.000 A |
| CAP-07 | 0.5 H @2 A → 10 Ω | I(50 ms) 0.73576 A; |V(0)| 20.000 V; energy dissipated 1.0000 J |

**AC (NCERT ch7 style), AC analysis or steady-state transient, tol 0.5 %, phase ±0.3°**
| ID | Circuit | Assert |
|---|---|---|
| AC-01 | 311.127 V pk 50 Hz, 100 Ω (NCERT ch7 exercise; type recalled, number unverified) | Irms 2.2000 A; Ipk 3.1113 A; P 484.00 W |
| AC-02 | 220 V rms 50 Hz, 44 mH (same caveat) | XL 13.823 Ω; Irms 15.915 A; lag 90.00°; P 0 |
| AC-03 | 110 V rms 60 Hz, 60 µF (same caveat) | XC 44.210 Ω; Irms 2.4881 A; lead 90.00° |
| AC-04 | 100 V rms 50 Hz; 30 Ω, 0.127324 H, 39.789 µF | |Z| 50.000; I 2.0000; lead 53.130°; VL 80.0; VC 160.0; PF 0.600; P 120.00 W (cross-checked) |
| AC-05 | 7.4 Ω, 3 H, 27 µF (same caveat) | f0 17.684 Hz; Q 45.045; BW 0.39258 Hz (fine sweep); I(f0) 0.135135 A/V (cross-checked) |
| AC-06 | 100 V rms 50 Hz; 10 Ω + 31.831 mH | |Z| 14.142; I 7.0711; lag 45.000°; P 500.00 W; S 707.11 VA |
| AC-07 | 220 V rms; ideal transformer 10:1; 4.4 Ω | Vs 22.000 V; Is 5.0000 A; Ip 0.50000 A; P 110.00 W (ideal primitive; tol 0.1 %); coupled-L variant with Lm 1000 H: tol 1 % |

**Semiconductors (NCERT ch14 style)**
| ID | Circuit | Model | Assert |
|---|---|---|---|
| SC-01 | 10 V pk 50 Hz; (a) one diode → 1 kΩ (b) bridge → 1 kΩ | textbook 0.7 V | (a) f 50 Hz, Vpk 9.300, Vavg 2.8409 (b) f 100 Hz, Vpk 8.600, Vavg 5.0287 (conduction-angle formula; director-verified). tol 1 % peaks, 2 % averages. With `real` diodes: peaks ±5 %, averages ±8 % |
| SC-02 | 12 V, Rs 300, 6 V Zener, RL ∈ {1k, 333.33, ∞} | ideal Zener | IRs 20.000 mA; Iz 14.000 / 2.000 / 20.000 mA; Pz(∞) 120.00 mW; tol 1 % |
| SC-03 | 5 V, 1 kΩ, Si diode; then −5 V | both | textbook: V 0.7000, I 4.3000 mA, P 3.010 mW. Shockley (Is 1e-14, N 1): Vd 0.69254, Id 4.3075 mA; reverse |I| < 1 µA |
| SC-04 | VCC 12, RB 565k, RC 3k, NPN β 100 | both | textbook: IB 20.000 µA, IC 2.000 mA, VCE 6.000 V, Av −232.1. EM (Is 1e-14): VBE 0.67277, IB 20.048 µA, IC 2.0048 mA, VCE 5.9855 V, Av −232.67 (cross-checked); tol 0.5 % DC, 2 % gain |

**Circuit analysis (Hayt & Kemmerly style, adapted), tol 0.1 %**
| ID | Circuit | Assert |
|---|---|---|
| CA-01 | V 12 → 2k → n1; 2k n1→0; 1k n1→n2; 3k n2→0; 5 mA into n1 | V(n1) 8.800; V(n2) 6.600 |
| CA-02 | 12 V → 2k → n2; 4k n2→0; VCVS n3 = 0.5·V(n2); 2k n2→n3 | V(n2) 6.000; V(n3) 3.000; I(R3) 1.500 mA |
| CA-03 | bridge from 10 V: 1k (top) / 2k (bottom) → a; 3k (top) / 4k (bottom) → b | Vth 0.95238 V; Rth 2.3810 kΩ (1 mA injection); I(RL = 5k) 0.12903 mA |
| CA-04 | 20 V → 2k → a; 3k a→0; 4 mA into a | Isc 14.000 mA; Rn 1.2000 kΩ; Voc 16.800 V |
| CA-05 | CA-04 + RL sweep | P(1.2k) 58.800 mW (max); P(1k) 58.314 mW; argmax at 1.2k ±1 % |
| CA-06 | V1 10 → 1k → x; V2 5 → 2k → x; 3k x→0 | V(x) 6.8182 V; superposition parts 5.4545 + 1.3636 (run each source alone) |

**Transients (Hayt style), TRAP, dt as stated**
| ID | Circuit | Assert |
|---|---|---|
| TR-01 | 5 V step, 10k, 100 nF (dt 1 µs) | V(1 ms) 3.1606; V(2 ms) 4.3233; tol 0.5 % |
| TR-02 | 10 V step, 50 Ω, 10 mH (dt 0.2 µs) | I(0.2 ms) 126.42 mA; I(0.4 ms) 172.9 mA |
| TR-03 | 10 V step, 20 Ω, 10 mH, 10 µF (dt 1 µs) | ζ 0.31623; ω0 3162.3 rad/s; overshoot 35.092 %; Vpk 13.509 V at 1.0472 ms; tol 0.5 % (cross-checked) |
| TR-04 | 1 mA AC into R 1k ∥ L 1 mH ∥ C 1 µF | f0 5032.9 Hz; |V(f0)| 1.0000 V; Q 31.623; −3 dB 4953.97 / 5113.13 Hz; |V(f0/2)| 0.02108 V; tol 1 % |

**Op-amps (Sedra & Smith style, adapted)**
| ID | Circuit | Model | Assert |
|---|---|---|---|
| OA-01 | inverting 1k/10k, 0.5 V in | ideal | −5.000 V |
| OA-02 | non-inverting 10k/47k, 0.2 V | ideal | 1.1400 V |
| OA-03 | summing 1 V/10k, 2 V/5k, −0.5 V/20k, Rf 10k | ideal | −4.750 V |
| OA-04 | difference 10k/100k, V1 1.0 V on the inverting side, V2 1.2 V on the non-inverting side | ideal | 2.000 V |
| OA-05 | integrator 10k, 10 nF; 0.5 V step / 1 kHz AC | ideal | V(1 ms) −5.000 V (dt 1 µs, tol 0.5 %); |H(1 kHz)| 1.5915, +90° (with 100 MΩ DC path; < 0.1 % effect) |
| OA-06 | inverting LP: 10k in, 100k ∥ 1.6 nF | ideal | fc 994.72 Hz; DC gain −10; |H(fc)| 7.0711 at 135°; |H(10fc)| 0.9950 |
| OA-07 | non-inv gain 10 (1k/9k) | macro A0 1e5, GBW 1 MHz | −3 dB at 100.01 kHz ±2 %; DC gain 9.999 (cross-checked) |
| OA-08 | follower | macro SR 0.5 V/µs, GBW 10 MHz | step slope 0.500 V/µs ±2 %; 0→5 V in 10 µs ±5 %; 5 kHz 10 Vpk undistorted; 15 kHz 10 Vpk: triangular, peak 8.33 V ±3 % (= SR·T/4; review-corrected from "< 60 %") |
| OA-09 | Schmitt: − = in; Rfb 15k from out to +, Rg 10k from + to GND; ±12 V sat | macro A0 1e5, fast | thresholds +4.800 / −4.800 V ±1 % |

**Filters (AC), tol 1 %, phase ±0.5°**
| ID | Circuit | Assert |
|---|---|---|
| FI-01 | RC LP 10k, 10 nF | fc 1591.5 Hz; |H(fc)| 0.70711; −45.00°; |H(10fc)| −20.04 dB |
| FI-02 | RC HP 100 nF, 1k; at 500 Hz | |H| 0.29972 (−10.466 dB); +72.56° |
| FI-03 | Sallen-Key LP unity, 10k/10k, C1 20 nF (to out), C2 10 nF | fc 1125.4 Hz; Q 0.70711; |H(fc)| 0.70711 at −90°; |H(10fc)| −40.00 dB (cross-checked) |
| FI-04 | series RLC BP: 10 mH, 1 µF, 50 Ω out | f0 1591.5 Hz; Q 2.000; BW 795.77 Hz; −3 dB 1242.64/2038.42 Hz; |H(f0)| 1.0000; |H(2f0)| 0.31623 |

**Devices (Sedra & Smith style)**
| ID | Circuit | Assert |
|---|---|---|
| SD-01 | 5 V, 1k, diode Is 1e-14, N 1, gmin ≤ 1e-15 | Vd 0.69254 V; Id 4.3075 mA; tol 0.1 % (cross-checked) |
| SD-02 | 12 V; 47k/10k divider; RC 2.2k; RE 1k; NPN Is 1e-14, β 100 | VBE 0.66194; IC 1.3212 mA; VCE 7.7590 V; AC gain vb→vc (RE ideally bypassed, no ro, no source R) −gm·RC = −112.44; tol 0.5 % / 2 % (cross-checked) |
| SD-03 | 9 V; 200k/100k; RD 2k; NMOS Vt 1, Kp 1 mA/V², λ 0 | ID 2.000 mA; VD 5.000 V; gm 2.000 mS; Av −4.000 |

**Oscillators and power (Horowitz & Hill style)**
| ID | Circuit | Assert |
|---|---|---|
| OS-01 | 555 astable R1 1k, R2 10k, C 10 nF, 5 V (dt ≤ 0.2 µs, skip 3 cycles) | f 6870.0 Hz ±1 %; duty 52.381 % (cross-checked) |
| OS-02 | RC phase shift R 10k, C 10 nF; inverting amp, the last ladder R returns to the virtual-ground input; Rf 29R (loop broken) / 31R (closed) | f0 649.75 Hz ±1 %; loop gain 1.000 at f0; closed loop (31R, ±12 V clamp) oscillates at 634 Hz ±1.5 % (review-corrected: the growing loop's frequency sits 2.4 % below f0) |
| OS-03 | ideal buck 12 V, D 0.25, 100 kHz, 100 µH, 100 µF, 3 Ω | Vout 3.000 V ±1 %; ΔIL 0.2250 A ±1 %; ΔV 2.81 mV ±5 % (cross-checked) |

**Ticket reference checks (review-recomputed 2026-11-09, also oracles; `global` unless noted):** 1-1 I(470 Ω) 14.95 mA (refit LED); 1-2 I(150 Ω) 19.65/16.13 mA; 1-4 P(R = r) 4.3085 W; 2-1 15k/82k → 3.355 V (3.39 mW); 3-3 pull-in 0.2747 ms; 4-1 (ngspice, catalogue 1N4007) mean 12.62 V and ripple 0.75 Vpp at 207 V, no-load peak 17.5 V at 253 V; `na` 680 µF ripple 0.93 Vpp; 4-2 Rmax 225.71 Ω, Pz 275.86 mW;
4-3 Tj 102.5/88.75 °C; 4-4 Vout 3.3008 V; 5-4 IC(β 200) 1.12 mA, gain from EMF 9.53; 3-2 47k+330n 10.6-11.5 / 13.7-14.7 ms; 5-1 pin 17.2 mA, fan 11.96 V; 5-3 VOH 4.098 V; 6-5 82k → 52.8/47.0 °C; 8-5 R2 15.894 kΩ, H3 −16.8 dB; 6-3 −0.68 dB at 20 kHz; 6-6 Vpp 2.038 V; 7-1 0.15 µF 9.75-11.92 mA rms (`na` 0.22 µF 8.95-10.94); 7-2 fc(rel) 3545 Hz; 7-3 rejection 5.5/12.3 dB; 7-4 fc 294 Hz, Q 0.693, −30.8 dB at 50 Hz; 8-1 2.061 Hz, 65.7 %. Total oracle assertions ≈ 220.

### 9.2 Reference circuits against SPICE
`scripts/ngspice-ref/*.cir`: decks that use only models NODE implements identically (`D(Is N Rs BV IBV)`, `NPN(Is Bf Br Vaf)`, `NMOS level=1`, linear elements, ideal switches via `sw`), run in **ngspice 42+**
offline. CSVs are committed (`tests/ref/*.csv`), so CI needs no ngspice. Comparisons resample to a common grid; tolerance max |Δ| ≤ 0.5 % of signal range (transient) and 0.1 dB / 0.5° (AC):
1 diode clipper (±0.7 V sine 5 V) · 2 half-wave + 470 µF + 1 kΩ · 3 Shockley bridge + 1000 µF + 150 Ω (ripple, peak, inrush) · 4 Zener shunt with breakdown model, Vin sweep 0-20 V (DC sweep) · 5 LED + R I-V sweep ·
6 CE amp transient 1 kHz 100 mV (distortion visible) · 7 MOSFET inverter VTC (DC sweep) · 8 NMOS switch with an RL load and flyback diode (turn-off spike) · 9 RLC step (TR-03) · 10 Sallen-Key LP AC · 11 Wien/phase-shift startup (frequency only) ·
12 buck with ideal switch + Shockley diode (steady-state ripple) · 13 BJT astable multivibrator (frequency ±2 %) · 14 diode bridge + transformer (ideal) · 15 CMOS-less DTL NAND DC transfer.
The op-amp macro and 555 are compared against **analytic** oracles (OA-, OS-01), not ngspice vendor macros, because those differ by design.

### 9.3 Property tests (seeded fuzz, `fast-check`-style generators)
Generators: random connected linear networks (3-20 nodes, R/C/L/V/I/VCVS/VCCS with values log-uniform in sensible ranges), random nonlinear boards (diodes/BJTs/MOSFETs in random-but-sane topologies), and random ticket boards from the novice persona.
| Property | Statement | Cases |
|---|---|---|
| KCL | at every node, Σ branch currents ≤ 1e-9 A + 1e-6·max|I| (DC and every accepted transient step) | 2000 |
| KVL | for random loops in the element graph, Σ branch voltages (from the element equations, not node differences) ≤ 1e-9 V + 1e-6·max|V| | 1000 |
| Tellegen | Σ_k v_k·i_k = 0 over all branches incl. sources (DC; each transient step; AC: Σ V·I* = 0) | 2000 |
| Energy (RC/RL/RLC) | E_sources = E_resistors + ΔE_C + ΔE_L over a transient within 0.5 % (TRAP) / 2 % (BE) | 500 |
| Superposition / linearity | linear nets: x(a·s₁ + b·s₂) = a·x(s₁) + b·x(s₂) to 1e-9 relative | 500 |
| Reciprocity | linear R/C/L networks: transfer impedance Z₁₂ = Z₂₁ (DC and AC) | 500 |
| Passivity | random R/L/C one-ports: Re{Z(jω)} ≥ −1e-12 at 50 frequencies | 500 |
| Thevenin consistency | Voc/Isc = R_in seen by a 1 A test source | 500 |
| AC vs transient | for linear nets, steady-state sine amplitude/phase from transient = |H|, ∠H within 1 % / 1° | 200 |
| Order of accuracy | TRAP error ratio ≈ 4 (±1) when dt halves on smooth RC/RLC; BE ≈ 2 | 50 |
| DC limit | transient to t = 20 τ_max ends within 0.1 % of the DC OP | 300 |
| Charge conservation | capacitor-only charge sharing conserves Σ Q to 1e-9 relative | 300 |
| Device consistency | diode/BJT/MOSFET stamped currents equal model equations at the converged point (1e-12 A) | 1000 |
| Thermal steady state | live thermal converges to Ta + P·θ within 0.5 °C | 100 |
| No NaN/Inf | every query on every fuzz board | all |
| Determinism | same seed + actions → identical discrete-state hash; waveform equal to 1e-9 relative | 200 |

### 9.4 Convergence suite (`src/sim/mna/convergence.test.ts`)
Must converge (≤ the stated homotopy stage) or fail *gracefully* with the right explainer, never hang (wall-clock guard 2 s per case):
diode directly across a 9 V battery (r 1.7 Ω) · anti-parallel diodes across a source with 0.1 Ω · 10 diodes in series from 12 V · Zener stepped 0 → 50 V · LED array 8×3 · BJT cross-coupled latch (deterministic state) ·
BJT Schmitt trigger · 3-stage BJT ring oscillator (transient) · MOSFET with a floating gate (expect the floating explainer) · op-amp comparator with positive feedback · op-amp with no feedback at DC (saturation) · 555 with C = 100 pF (fast events) ·
high-Q LCR (Q 500) transient · stiff board (τ 1 ns and 1 s together) · the buck at 50 kHz for 10 ms · Darlington with 8k/120 Ω · transformer + bridge at mains switch-on · every ticket's ref solution and 20 novice-persona boards per ticket.
Metric: % solved by plain Newton / gmin stepping / source stepping / pseudo-transient. Target: ≥ 95 % plain, 100 % solved or explained.

### 9.5 Solvability bot (`scripts/calibrate-levels.ts`, also a test)
Per ticket: (1) replay `ref` → must pass, and meet the claimed stars; (2) **search**: a per-ticket topology grammar (2-6 candidate topologies from the designer, e.g. "R in series", "R pair parallel", "divider") ×
value search over the bin (exhaustive for ≤ 2 free values, else coordinate descent with 8 restarts, then a small GA: 40 × 30) with netlist-level actions → the auto-placer; record every passing solution; (3) ≥ 1 pass found
independently of `ref` (else the ticket is flagged "only the ref solves it": a design smell); (4) **population**: 400 sampled solutions at mixed skill (search budget drawn from a distribution) → histograms + par (35th percentile) → `data/histograms/`;
(5) **band calibration**: report the margin of the nearest-failing E-series neighbour of the ref. Bands with a margin < 0.5 % are flagged for the director (too tight or too lucky). CI runs (1) and (3) for every ticket; the full population runs nightly or on demand.

### 9.6 Cheese search (dominant-strategy search, `src/playtest/cheese.test.ts`)
Each exploit is attempted on every ticket where it applies. Expected outcome: **no pass**, with a named reason.
| Exploit | Defence |
|---|---|
| Empty board / only fixed parts | idle persona: every spec fails |
| Wire straight from source to OUT | ratings, other conditions (multi-condition specs) or spec bands exclude the source value |
| 0 Ω tricks (pot at an end, wire as resistor, smoked part as short) | pot end resistance 0.5 %; wires are ideal but merge nodes (they can't be "resistors"); smoked parts are refused |
| Tune to a single condition | every ticket with a tunable spec has ≥ 2 conditions or hidden seeded parameters |
| Exceed a rating briefly | ratings use both averages and peaks + instant-failure rules |
| Use the meter as a part | the bench strips instruments; the DMM ammeter isn't a circuit element at bench time |
| Probe placement | the bench probes fixed connectors only |
| Ideal-part exploitation | ideal parts exist only in EB Textbook bins, and EB scoring is predictions + topology checks |
| Floating-gate MOSFET "works" via gmin | DC-floating refusal rule |
| Op-amp open loop as a "gain of 200 000" | saturation detection for AC specs; THD and band for transient specs |
| Huge capacitor as a battery | all states start at zero; no pre-charge except EB |
| Timestep aliasing (oscillator at a dt multiple) | dt ≤ T/200, interpolated crossings, a frequency metric cross-checked with DFT |
| Reverse electrolytic at low voltage | rule: V ≥ −0.5 V |
| Bench supply CC mode as a "current limiter" | allowed only where the ticket's supply is the bench supply and the spec is met in every condition (legitimate engineering); flagged in 1-x by making the supply a battery |
| Over-budget part count via giant boards (area) | area metric + board size cap per ticket |
| Exploit the event engine (comparator chatter at dt) | crossing-count specs use hysteresis-aware counting; chatter faster than 10·dt fails "single transition" |
| Negative / absurd values via the API | values must be in the catalogue; the action validator rejects anything else |
| Sandbox solution codes loaded into campaign | codes carry the ticket id + bin hash; a foreign part refuses to load |

### 9.7 Balance targets (asserted)
- Idle fails every build ticket (27 must-ship, 32 with stretch). Expert passes every ticket with ★2 on every build ticket, under every region pack (§12.4).
- Novice persona in Learner: ≥ 80 % of ch1-2 tickets pass in ≤ 60 actions; ≥ 50 % of ch3-4. A ticket below 20 % is flagged as a difficulty spike.
- Par: ref ≤ par on its headline metric; par = 35th percentile of the population (so a typical first pass is ★1, and ★2 needs a second look).
- Every bench ≤ 2 s desktop (CI-measured on the runner, scaled); live frame ≤ 4 ms phone-equivalent (a microbenchmark × the Pixel factor measured once on device).
- Each smoke explainer fires at least once across personas (coverage of failure classes).

### 9.8 Golden trajectories
`src/trajectory.golden.test.ts`: for 10 tickets × {expert, novice seed 1, smoker seed 1}: the action script → per-action state hash (board, live unknowns, smoked, bench pass/fail, stars) **exact**, and waveforms (decimated scope windows) hashed **bit-exactly** (dmath makes this possible; review fix). A CI job runs the goldens on Node 18 (nodejs-mobile's version) as well as Node 22. `GOLDEN_UPDATE=1` regenerates only for deliberate rule changes, and the commit says so (PROGRAM.md).

### 9.9 UI tests (Godot)
`CB_SMOKE=1` builds every screen and opens every ticket with its ref board powered (asserts no script errors, `SMOKE OK`). `CB_AUDIT=1` layout audit at the PROGRAM.md resolutions plus phone with insets. A parity matrix test (code reviewer persona) checks every
§6.2 row has mouse, keyboard, pad and touch bindings registered. Screenshot tour (`tour.sh`) per release. Shader fallbacks on GLES3/Vulkan Mobile (smoke, phosphor) are verified on the Pixel. Touch: the drag-ghost offset, loupe and long-press wire. Pad: the radial picker,
probe mode, value wheel and no focus traps. The audio test (`AUDIO OK`) includes circuit audio from the 8-1 and 8-5 refs.

### 9.10 Fun-test hypotheses (run with the fun-critic and novice testers; each is falsifiable)
| When | Hypothesis | Measure | Kill/fix if |
|---|---|---|---|
| Minute 1 | The torch smoke makes players laugh and *want* to try the resistor | novice tester narrative; time to second attempt < 20 s | they quit or call it unfair → soften (warning glow before smoke in Learner) |
| Minute 10 | After 3-4 tickets players open a histogram unprompted and retry one for ★2 | % who re-enter a passed ticket | < 30 % → stronger histogram reveal, ★2 rewards |
| Minute 30 | Players predict before probing (they start reasoning with V = IR without being asked) | hover-before-power ratio; hint usage falling | hints climbing → scaffold more in ch2 |
| Minute 60 | The black-box (2-3) or relay (3-3) "aha" lands; players say "I finally get Thevenin / L/R" | educator and fun critic verdicts | "feels like homework" → more customer banter, shorter tickets |
| Session | The phone ticket fits a commute (≤ 8 min median) | phone tester timing | > 12 min → split tickets |
| Educator | A JEE / A-level / AP teacher would set EB tickets as homework | educator critic | no → revise EB card styling/numbers with the teacher's notes |

### 9.11 Counts (definition of done for engine v0.1)
≥ 57 oracle files (≈ 220 assertions) · 15 ngspice references · 16 property families (~12 000 generated cases) · ≥ 20 convergence cases · 35 solvability checks × 3 region packs · ≥ 17 exploit families × applicable tickets · 6 personas × 35 tickets × 3 modes ×
5 seeds · 30 goldens (Node 18 + 22) · verify samples + perf · solution-code round trip · region leak + schema · i18n lint + key coverage · state-size · `data.provenance` · UI smoke + audit.

### 9.12 Tests added by the review (determinism, leaderboards, regions, strings)
| Test | Statement |
|---|---|
| `determinism.test.ts` (core) | no `Math.exp/log/pow/sin/…` or `**` in `src/` |
| `board-code.test.ts` | encode∘decode of the board payload (inside the core CB1 envelope) is identity on every ref board and 1000 novice boards; canonical (shuffled part/wire order gives the same code); CRC catches every single-character change; foreign part / wrong ruleset / wrong level → teaching error, never a throw (fuzzed with 10 000 random strings) |
| `verify.test.ts` | for every must-ship build ticket: verify(ref code) ok with metrics equal (Object.is) to the in-game bench; 2 failing codes per ticket → ok:false with the first failing line; region ≠ code region and stale ruleset → ok:false; the committed `samples` reproduce exactly; epoch bump required when sample metrics change |
| `verify.perf.test.ts` | worst novice board per must-ship ticket verifies in ≤ 1000 ms on the CI runner (the server cap is 2000 ms) |
| `verify.bundle.test.ts` | esbuild bundle of `src/verify.ts` for a browser/worker target has no Node built-ins and no top-level side effects |
| `regions.switch.test.ts` | §12.4 (1): every pack × every level: loads, ref passes with claimed stars, idle fails, solvability bot finds an independent pass |
| `regions.leak.test.ts` | §12.4 (2)-(3), via the core leak helper |
| `i18n.test.ts` | no literal strings in `fail/need/ok/log` calls; every used key exists in `en`; no unused keys; placeholders in each string match the params passed |
| `state.size.test.ts` | serialised state ≤ 64 KB after 2000 monkey actions with full undo stacks |
| `bench.cost.test.ts` | flop estimate per must-ship ticket (ref + worst novice board) ≤ 1.5e9 (§3.11) |
| `cache.test.ts` | compile memo and device bypass on/off give identical results on every ref board |

---

## 10. Scope, cut lines, risks

### 10.1 v0.1 must-ship vs stretch (review decision: quality over quantity)
**Must-ship**
- Engine: DC OP with homotopy, fixed-step TRAP/BE transient with events, AC; devices: R, C, L, sources (battery, bench CV/CC, mains+transformer, function
  generator, logic pin), diode/LED/Zener/Schottky, BJT (EM-lite), MOSFET (Level-1), op-amp macro, LM393 comparator, NE555, 7805/LM317 regulators, pot/trimmer,
  slide wire + galvanometer, NTC, relay, fuse, meter; thermal + smoke; the bench with all spec kinds; explainers; topology checks.
- **35 tickets** (§2.7), 8 chapters, Learner/Engineer/Sandbox, EB mechanic (global exam-style set), coach for ch1-2 + first-use steps, hint ladder,
  48 Codex entries, **online histograms via cobanana-scores** with the labelled practice-population fallback, solution codes + `verify`, Bench Card PNG,
  the `global` region pack, all strings externalised (English), the region seam tested with `in` (draft) and `na` (test-only).
- Front-end: bench world, scope (band lock), Bode, DMM, supply/gen, thermal overlay, tray, ticket card, bench report with histograms, Codex, Lane map, title,
  settings (incl. online scores row), pause. Input parity (mouse/kb, pad, touch). Desktop ×3 OS + Android APK.
- Audio: sfx set (place, wire, power, relay, smoke pop/bang/crack, sizzle, lock chime, ka-ching), **4 music tracks** (varied structure; one per two chapters),
  circuit audio for 8-1 and 8-5.

**Stretch (built only after must-ship passes every M5 gate, in this order)**
1. 7-4 Sallen-Key (needs no new device). 2. 6-6 integrator. 3. 6-4 slew. 4. 8-2 phase-shift (needs the oscillator kick). 5. 8-3 buck (needs the PWM driver + averaged pre-charge).
6. Music tracks 5-8. 7. Encore tickets (1 per chapter). 8. Bench Card video (WebM/GIF). 9. Hall of Smoke auto-clip. 10. Stall cosmetics shop.

### 10.2 Cut lines (if must-ship itself slips, in order)
1. Thermal camera as an upgrade (fold it into the Learner overlay only).
2. Lane map → a plain ticket list styled as paper slips.
3. ngspice references 13-15.
4. Bench supply / function generator as draggable instruments → fixed per-ticket sources with a knob in the ticket card.
**Never cut**: oracles, property tests, determinism + verify, smoke + explainers, the scope band lock, input parity, EB tickets, the region seam tests, online histograms with the offline fallback.

### 10.3 Later (v0.2+)
Stretch items not reached · adaptive timestep (LTE) · junction/device capacitances (RF levels, 1N4148 recovery) · temperature-dependent Is/Vt (thermal runaway, a great lesson) · electrolytic ESR/leakage · non-linear inductor saturation ·
op-amp offset/bias currents/second pole (stability and phase-margin levels) · boost converter and closed-loop buck (LM2596-like) · copper trace resistance (PCB layout level) · a schematic view toggle · Hindi locale · the `in` pack shipped (NCERT/JEE EB set sourced from the books) and other packs (`uk`, `us`) · chapters 9-10 (sensors & ADCs, audio power amps:
class A/B, crossover distortion) · user-made tickets shared via codes · leaderboards for encore/Engineer seeds · iOS.

### 10.4 User decisions (resolved 2026-11-09; see PROGRAM.md "User decisions")
1. **Online histograms**: yes, in v0.1, via the shared `cobanana-scores` service (§11). Simulated histograms survive only as the labelled empty-state fallback.
2. **Mains-powered tickets**: kept (4-1, 4-3, 7-1) with the safety framing of §1.2.
3. **Framing**: neutral `global` pack ships (Lantern Lane, Wren); Signal Gully / Meera Aunty preserved as the draft `in` pack (Appendix A).
4. **Currency** US$; **codes**: IEC 60038 for mains, IEC 60063 for E-series, IEC 60384-14 for X2 capacitors; no IS codes are used anywhere in the global pack.

### 10.5 Top risks and mitigations
| Risk | Why it bites | Mitigation |
|---|---|---|
| **Solver convergence / numerical surprises on player-built nonsense** | players build everything, including circuits SPICE hates | pnjlim/fetlim, damped Newton, the 4-stage homotopy, topology pre-checks with explanations, a convergence suite + monkey/smoker personas, a wall-clock guard, "keep last good state" |
| **"SPICE GUI" feel** | analog sims look like engineering tools | the world-first bench, no schematic on the main view, living overlays (dots/heat/smoke/phosphor), customers and notebook voice, a fun critic in every playtest round, the band-lock moment as the core reward |
| **Depth vs approachability** | ECE topics (GBW, Sallen-Key) may wall off Class-12 players; experts may find ch1 slow | chapters 1-5 are Class-12-complete on their own; Learner scaffolding; skip-ahead for any chapter via its EB ("prove it" unlock); Engineer tolerance stars add depth to early tickets |
| **Phone performance** (Monte Carlo, dense LU at n = 48) | the sidecar on Android is slower | MNA dim ≤ 48, flop-budget gate per ticket (`bench-cost`), flat Float64Array LU, LU reuse, device bypass, chunked Monte Carlo, live "sim ×k" indicator, measured on the Pixel in M2 (vertical slice) |
| **Data accuracy** (prices, LED fits, thermal τ, some op-amp specs) | recall-sourced numbers creep in | `verified` flag + CI provenance test; datasheet-wins rule; Codex "estimate" labels |
| **Band/par tuning** | E-series granularity makes bands accidentally impossible or trivial | calibrate-levels margin report; director sign-off for > 10 % changes; the solvability bot in CI |
| **Teaching correctness** (textbook idealisation vs real models) | students may see "0.6925 V, not 0.7 V" as wrong | EB "Reality check" makes the gap the lesson; model setting explicit in every oracle; educator critic each round |
| **Determinism across platforms** | `Math.exp` differences would break goldens, replays and server verification | dmath everywhere (determinism test), exact goldens on waveforms, verify `samples` checked by the server registry test, a Node-18-vs-Node-22 CI job running the goldens |
| **Leaderboard verify cost** | the server caps verification at 2000 ms CPU | verify perf test ≤ 1000 ms per must-ship ticket's worst board; no Monte Carlo in verify; verification cache by solution hash on the server |
| **Region seam rots** (only `global` ships) | untested seams break silently | pack-switch solvability + leak tests in CI on every commit (§12.4) |
| **Mains content sensitivity** | depicting mains circuits for teenagers | kept by user decision; non-skippable first-view safety card, isolation transformer object, keep-out silkscreen, "do not try this at home" ribbon on mains Bench Cards, Codex mains-safety page |

---

## 11. Online leaderboards (user decision 2; added by the level-1 review)

NODE uses the shared `cobanana-scores` service (repo `cobanana-scores`, contract in its `docs/API.md` and `src/verify/types.ts`). The game never trusts
itself: it submits a **solution code** plus the metrics it computed; the server re-runs NODE's deterministic bench and accepts the score only if the
recomputed metrics are **bit-identical** (`Object.is` per value). Determinism (§3.11, dmath) is therefore a hard requirement, not a nicety.

### 11.1 What has a leaderboard
| Ticket kind | Boards (metric ids) | Notes |
|---|---|---|
| Build ticket (Learner fixed hidden values = the canonical ticket) | `cost` (US$ cents, lower), `parts` (integer, lower), `power_mw` (lower) or `efficiency_pct` (higher, power tickets), `area` (pads², integer, lower); 2-2 adds `accuracy_ppm` (lower) | one board per metric; physics is identical across modes, so Learner and Engineer passes share boards |
| Assisted pass (hint rung 3 used) | none | the client does not submit (the server cannot tell; it is honour-based and labelled "assisted" locally) |
| Engineer seeded hidden params, encore tickets | none in v0.1 | the hidden values differ per save, so scores are not comparable |
| Exam bridge | none | predictions are typed numbers, trivially copied; EB stars stay local |
| Sandbox | none | |
Metric values are **integers or exact decimal-safe numbers** chosen so that the client and server agree bit for bit: cost in integer cents (sum of integer
pack prices), parts and area integers, power in µW rounded half-even to an integer, efficiency in 0.01 % units as an integer. ★3 (tolerance) is not a
leaderboard metric (the Monte Carlo is too heavy for the 2000 ms server cap on every submission); it is shown locally only.

### 11.2 Solution-code format (on the core `kit/solution` envelope)
The core envelope is `CB1.<base64url JSON>.<crc32 hex8>` carrying `{game, level, ruleset, seed, mode, actions}`, with
`ruleset = node-circuits:<region>@<packVersion>.<gameVersion>` (core `rulesetId`). The core's default records every action a player took; for NODE
that log is long and noisy (live frames, probes, undo), so NODE emits a **canonical two-action code** instead:
```
actions = [ ["loadBoard", ["<board payload>"]], ["runBench", []] ]          seed = 1, mode = 'learner' (the canonical ticket)
<board payload> = base64url (no padding) of a binary record, integers as unsigned LEB128 varints:
  partCount, then per part: catalogueIndex (into the ruleset's sorted part-id list), valueIndex (into the part's value list), ratingIndex, x, y, rot(0-3) | flip<<2
  wireCount, then per wire: padCount, then pad x, y pairs (orthogonal polyline)
  settingCount, then per setting: kind (pot α in 1/1000, supply mV, supply mA, jockey 0.1 mm, gen shape/f/Vpp/offset quantised), target part index, value
```
- `loadBoard(payload)` is an ordinary game action (also used by "load a friend's code"): it validates the board against the ticket's bin for the active
  ruleset and replaces the board, with a teaching error on foreign/overlapping/off-board parts; `runBench()` sets the level status to won on a pass
  (core `Level.goal`), which is what core `makeVerifier` requires.
- The payload is **canonical**: parts sorted by (y, x, catalogueIndex), wires normalised (endpoint order, collinear points removed) and sorted, so the same
  board always yields the same code and the server's solution hash deduplicates. Probes, meters, scope settings and undo are not encoded.
- Size: a 15-part, 25-wire board ≈ 120 bytes of payload ≈ 300 characters of code with the JSON envelope (QR version 10 at level M; fine on a Bench Card).
- `exportSolution()` returns the code **and** the metrics computed by running `verify` on it in-process, so the client always submits exactly what the server
  will recompute.

### 11.3 `src/verify.ts`
```ts
export const verify = makeVerifier(GAME);           // core kit/verify: decode → ruleset/region check → startLevel → replay → must be won → GAME.metrics(state)
export const nodeVerifier: GameVerifier = adaptForScores(verify, { // thin adapter in NODE (cobanana-scores contract, src/verify/types.ts)
  game: 'node-circuits', rulesVersion: '1.0.0', gameVersions: ['0.1.0'], regionRulesets: ['global'],
  levels: { global: levelSpecsFromLevelFiles() },   // metric specs + epoch per ticket with a leaderboard (§11.1)
  samples: committedSamples,                        // every must-ship build ticket's ref code + 2 failing codes (from goldens)
});
```
- `GAME.metrics(state)` returns the §11.1 integers from `state.ticket.lastBench`.
- **Pure**: no Node APIs, no I/O, no `Date`, no `Math.random`, no globals mutated; imports only `src/sim`, `src/data`, `src/regions`, `src/locales`, `@core/*`.
  A test bundles `verify.ts` with esbuild for a Workers-like target and fails on any Node built-in import.
- Cost: the core verifier has no cooperative budget hook; the scores server's Node adapter hard-kills at 2000 ms and Workers relies on the platform limit.
  So NODE asserts in `verify.perf.test.ts` that the worst novice board of every must-ship ticket verifies in ≤ 1000 ms on the CI runner (half the cap).
  (A request to core: pass an optional `budget()` through `VerifyOpts` to `GameDef` actions; logged in REVIEW.md, not blocking.)
- Epochs: any rule, catalogue-price or level change that can move a metric for a ticket bumps that ticket's `epoch` (and the pack's `rulesetVersion` for pack
  data changes); a test compares committed `samples` metrics with a fresh run and fails if they changed without a bump.

### 11.4 Client: offline-first, never blocking
- The Godot side uses the shared addon `cobanana_scores` (`CbScoresClient`, autoload `Scores`): first-run privacy notice, Settings row (on/off, nickname,
  "delete my online data"), a persistent **offline queue** with retry and backoff, a histogram cache, signals only (never blocks gameplay). NODE adds no
  networking code of its own.
- Flow on a pass: `exportSolution()` → `Scores.submit(levelId, code, metrics)` → the bench report shows the local result immediately; the histogram fills in
  when `histogram_ready` arrives (cached first, then fresh). Offline is silent: a small "queued" chip on the report, sent later.
- `region_ruleset` = the active pack id; `game_version` = `config/version`. QA and CI use `CB_SCORES=mock` (the addon's in-process mock) and never touch a
  real server.

### 11.5 Histogram UI and the empty-state fallback
- The bench report has a strip of four mini-histograms (one per metric) with the player's marker, the par line (from the level file) and "top N%" text;
  tapping one opens the full histogram and the top-10 list (nicknames optional). Bars use the phosphor palette on the CRT style; colour is not the only cue
  (marker + text).
- **Empty state / offline with no cache**: the strip shows the **solver-bot population** distribution from `data/par/<id>.json` (the same data that sets par),
  drawn hatched and labelled **"Practice population (simulated). Online scores appear when available."** It is never mixed with real data and never shown
  as if it were players (this replaces the original "simulated bot histograms" as the primary feature).
- With fewer than 20 real players on a board the real histogram is shown with the label "Early days: N players".

---

## 12. Region packs (user decision 5; added by the level-1 review)

Physics and engine rules are region-independent. Everything regional is data in a **region pack**, loaded through the core region-pack framework
(loader, schema validation, number/currency formatting, leak-test helper).

### 12.1 Packs
| Pack | Status in v0.1 | Setting | Currency | Mains | Exam-bridge set | Syllabus map |
|---|---|---|---|---|---|---|
| `global` | **ships, default** | Lantern Lane, Wren (§1.2) | US$ (`$1.25`, `1,234.5`) | 230 V ±10 %, 50 Hz (IEC 60038) | neutral exam-style cards (§2.5, §2.8 EB tickets as written) | generic topic tags |
| `in` | **draft, not shipped** (debug builds only) | Signal Gully, Meera Aunty (Appendix A) | ₹ (USD × 84 at the pack's stated rate; lakh grouping) | 230 V ±10 %, 50 Hz (CEA regulations) | NCERT/JEE cards (real quotes allowed with sources; to be sourced in v0.2) | NCERT XII chapters + JEE topics |
| `na` | **test-only** (never shipped) | `global` names | US$ | 120 V, 60 Hz (ANSI C84.1 range A: 114-126 V; the ticket conditions use ±10 % like the others) | `global` set | generic |

### 12.2 What lives in a pack (`src/regions/<id>/index.ts` via core `defineRegion` + `data.ts`; `godot/regions/<id>/`)
- `index.ts`: id, status (`shipping`/`draft`), `rulesetVersion`, currency, numbers, standards (IEC 60038/60063/60384-14 in `global`), `strings`, `leakMarkers`, and a `validateData` that rejects any pack trying to change a law or constant (only scenario parameters may vary).
- `data.mains`: nominal voltage, tolerance, frequency. Mains-dependent tickets (4-1, 4-3, 7-1) and the isolation transformer read it; the ticket's
  transformer primary rating **follows the pack's mains** (a 12 V wall-wart transformer is "mains:12 V" whatever the mains is), so secondary-side specs stay identical.
- `data.prices`: price per part id (integer minor units) and its source/date; `data.availability`: which part ids exist in this pack's bins (a pack may hide or
  substitute a part; substitutes must be electrically equivalent or the ticket's ref must be re-proven).
- `strings` + `data.customers`: customer names, mentor name and voice lines, places, ticket briefs, end-card text. Engine code refers only to
  customer ids (`kid_torch`, `cyclist`, …).
- `data.examBridge`: the EB ticket set (cards, numbers, predictions, sources). Each pack's EB set must contain one EB per chapter with the same `teaches` ids.
- `data.syllabus`: concept id → syllabus labels shown in the Codex.
- `godot/regions/<id>/`: optional art/audio variants (backdrop strip, ambience bed, music variants) behind fixed asset slots; `global` provides the defaults.

### 12.3 Tickets and refs per pack
- A level file is region-independent. Values that differ per pack are expressed as **pack parameters** (`{mains: 'nominal'}`, `{mains: 'low'}`), never as
  literal 230 V. A level may give `refByRuleset` overrides when the best ref differs (7-1's dropper capacitor at 120 V 60 Hz, see §2.8); the expert
  persona uses the override for that pack.
- **Specs stay the same in every pack** so that a ticket teaches the same thing everywhere; bins are widened where needed so every pack has a
  solvable, non-trivial answer (review decision; 7-1's bin includes 0.47 µF for that reason).

### 12.4 Tests (the seam is tested even though only `global` ships)
1. **Pack-switch solvability**: for every pack (`global`, `in`, `na`) the whole campaign loads, every level's ref (or `refByRuleset`) passes the bench with
   the claimed stars, the idle persona fails, and the solvability bot finds ≥ 1 independent pass.
2. **Leak test** (core helper): the `global` build's strings, catalogues, level data and the Godot `global` assets contain none of the `in` pack's names,
   places, currency symbol or syllabus labels (list generated from the `in` pack's string table) and no `₹`.
3. **Schema**: every pack validates against the core pack schema; every customer id used by a level has a name in every pack's `en` table; every EB set has 8
   cards with matching `teaches` ids.
4. **Solution codes carry the ruleset** (`node-circuits:<region>@<packVersion>.<gameVersion>`): a code made under `in` refuses to load or verify under `global` with a teaching message; verify rejects a
   region/code ruleset mismatch (core `makeVerifier` does this; NODE tests it).
5. **Formatting**: `global` renders `$1,234.50`; `in` renders `₹1,03,698`; the mains readout shows the pack's V and Hz.


---

## Appendix A. Draft `in` region pack (India-first content, preserved; NOT shipped in v0.1)

> **Status: DRAFT region pack `in`.** This is the designer's original India-first framing, kept verbatim per user decision 5 so that an Indian
> edition can ship later. It is loaded only in debug builds (`CB_REGION=in`) and by the region-seam tests (§12.4). Nothing here may leak into the
> `global` pack (enforced by `regions.leak.test.ts`). Data layout: `src/regions/in/{index,data}.ts` and `godot/regions/in/` (BUILD-PLAN M3, lane R).

#### A.1 Framing (original §1.2, verbatim)
You inherit **Meera Aunty's repair stall, Stall 14, Signal Gully**: a fictional electronics bazaar in an Indian city, a narrow lane of
stalls under tangled wires, neon and monsoon tarps. Meera retired to Goa. She left you her bench, her oscilloscope (a beautiful
old green-phosphor CRT), a shoebox of parts and her **notebook**, which is the game's Codex. Customers walk up to the counter with
broken or missing circuits: a dead torch, a guitar preamp, a wall-wart that hums, a radio that won't tune, a 3D printer's hot
end, a school science-fair thermostat, an EV charger's sense circuit, a street musician's synth. Every job is a **ticket**: a
spec card plus a **target band** drawn on your scope. You build on a perfboard, power it up, and watch.

Why this frame:
- It is a *game* and not a lab. You are someone who can fix anything, and every success has a face: the customer, their gadget and their reaction.
- Every spec is realistic: real gadgets with real loads, mains tolerance (230 V ±10 %, as in India), battery sag and heat inside a box.
- It is relatable for the core Indian audience: everyone knows a Lamington Road or Nehru Place stall, and the capacitive-dropper
  nightlight and the 7805 wall-wart are things they have seen. It still reads as charming and exotic to the global Steam audience.
- It supports an upgrade loop that is also the syllabus: new instruments (2-channel scope, function generator, thermal camera,
  Bode plotter) arrive as the concepts that need them arrive.

Tone: warm, funny, slightly melancholic notebook voice ("Meera: *Every resistor is a promise about heat.*"). Customers have short
voices (as GIGAWATT's named customers did). There is no combat, no timer pressure in Learner mode, and no loot.

#### A.2 Name and flavour map (`src/regions/in/` strings + `data.customers`)
| Customer / place id | `global` | `in` (original) |
|---|---|---|
| mentor | Wren (retired to the coast) | Meera Aunty (retired to Goa) |
| place | Stall 14, Lantern Lane (covered arcade, harbour city) | Stall 14, Signal Gully (fictional electronics bazaar, Indian city) |
| `kid_torch` (1-1) | Lio, age 10 | Priya, age 10 |
| `cyclist` (1-2) | Ash | Arjun |
| `aquarium` (1-3) | Mr. Brook | Mr. Iyer |
| `toycar` (1-4) | Bo | Bunty |
| `weather` (2-1) | Kaya | Kavya |
| `irrigation` (3-3) | Sami (greenhouse) | Ravi |
| `wallwart` (4-1) | Mrs. Dale | Mrs. D'Souza |
| `nightlight` (7-1) | "the two-dollar market-stall classic" | "the ₹40 bazaar classic" |
| `radio` (7-3) | Iris's grandad's radio | Abba's transistor radio |
| `indicator` (8-1) | cargo-trike turn indicator | auto-rickshaw indicator |
| `musician` (8-5) | Juno, Lantern Night street fair | Lata, the Diwali mela |
| `ev` (8-3) | e-bike workshop | EV workshop |
| cosmetics | tea mug | chai glass |
| backdrop | arcade lane, rain on awnings, tram silhouette | bazaar strip, monsoon tarps, cycle-rickshaw silhouette |
| ambience | market arcade, kettle whistle, tram bell | bazaar bed, pressure-cooker whistle, monsoon layer |
| music | lo-fi market beats, hand percussion, Rhodes keys | lo-fi bazaar beats with tabla and harmonium-synth |

#### A.3 Pack parameters
- Currency ₹, integer rupees, lakh/crore grouping (`1,23,456`); price = US$ (qty 100, same source as `global`) × 84 ₹/$ (the original design's fixed rate;
  the pack states the rate and its date in the Codex). Cost leaderboards are separate per ruleset.
- Mains: 230 V rms ±10 %, 50 Hz ±1 %, per the CEA (Measures relating to Safety and Electric Supply) Regulations **[R: citation to be verified before the pack ships]**.
- Exam-bridge set: NCERT XII / JEE cards. User decision 1 allows real NCERT/JEE quotes with sources; the v0.1 cards are "NCERT-style (adapted)" with our own
  numbers, and four AC oracles are "NCERT XII ch7 exercise (type recalled, number unverified)". A source-checking pass with the physical books is
  required before this pack ships.
- Syllabus map: concept ids → NCERT Physics XII chapter/section (ch2 capacitance, ch3 current electricity, ch6 EMI, ch7 AC, ch14 semiconductors) and JEE Main topics.
- Locale plan: English first; Hindi is a locale (not a pack) in v0.2; the notebook font Kalam already covers Devanagari.

#### A.4 Why the designer recommended India-first (kept for the record)
"It is relatable for the core Indian audience: everyone knows a Lamington Road or Nehru Place stall, and the capacitive-dropper nightlight and the 7805
wall-wart are things they have seen. It still reads as charming and exotic to the global Steam audience." The user chose the neutral `global` pack as the
v0.1 default (decisions 1 and 5); this pack keeps the option open.

---

*End of design. The binding implementation plan is `BUILD-PLAN.md` (it supersedes this note). Original suggested order: core numerics → MNA linear + oracles NC/CA/TR/FI → nonlinear devices + SD/SC oracles + convergence suite → transient events + 555/op-amp
macros + OA/OS oracles → bench + specs → thermal/smoke/explainers → level data ch1-2 + calibrate-levels → Godot bench view + scope → input parity → ch3-8 → personas, goldens, critique rounds.*
