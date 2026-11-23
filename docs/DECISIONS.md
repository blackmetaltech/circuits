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

- **D-plain-splash (2026-11-23, Ingrid Solheim, Game Lead).** The boot splash is the word CIRCUITS over blackmetal.tech on the
  bench's dark blue, shown for the engine's boot only. The coordinator asked for a short plain splash or none; plain is what
  shipped. Strongest argument against (Sigrid, 0.4.1 re-score): a stock sans on navy looks like every loading screen and is not
  ours. Answer: true, and a branded splash needs the studio's mark, which does not exist yet; the stock Godot logo for 8 s was the
  defect, and that is gone. Written down for 0.5: a splash with the house mark when there is one.

- **D-meter-upright (2026-11-23, Ingrid Solheim, Game Lead).** The meter's LCD digits are upright, not italic. The lean split the
  tall digits into two offset rows, and in 2-1 the reading is the lesson. The supply keeps its lean: its digits are short and
  read cleanly in every shot.

- **D-supply-stays (2026-11-23, Ingrid Solheim, Game Lead).** 0.5 brief: "the meter covering the supply's OUTPUT key (move the
  supply)". In the 0.4.1 build the meter covers neither OUTPUT, TEST nor VOLTAGE at 1280x800 or 1920x1080 (GPU crop of view 1,
  2-1; the red lead passes below OUTPUT). It hides the black post and the current knob, which the player never touches on this
  bench (the supply's only hits are VOLTAGE, OUTPUT and TEST). Moving the supply clear of the meter put it into the scope's
  cabinet or the scope's edge under the ticket in every placement tried. So the supply stays, and look2_frame_flow now guards
  what matters: the meter's tilted outline covers none of the three controls or their labels, and the scope and supply cabinets
  do not overlap on the bench. Strongest argument against (Sigrid): a hidden post reads as clutter. Answer: true; the fix is a
  smaller meter or a second view, not a layout that breaks two other checks.

- **D-bench-ch23 (2026-11-23, Kofi Mensah, Programmer; the lead's call, the choices below are mine).** Chapters 2 and 3 play on the
  bench: the campaign is 1-1 to 1-5, 2-1 to 2-4, 3-1 to 3-4 in the engine's order, and the title says chapters 4 and 5 stay classic.
  Choices: (1) 3-1 arrives with a 22 uF timing capacitor (10 k x 22 uF: the ready-light at 0.22 s against the 0.95 s floor) and 3-3
  with a 560 ohm series resistor on the 24 V rail (31.6 mA, under the 40 mA pull-in, so it never closes). Both are `LevelDef.fault`
  boards like 2-1's; the numbers are the engine's, and repair.test.ts shows each fails and that changing the one value repairs it.
  2-2, 3-2 and the two exams carry no fault: 2-2 arrives as the shorted cable it is, 3-2 with its bouncing contact and no filter.
  (2) The jockey is moved on the bench by a press or drag on the wire, by the wheel over it (the supply knob's pattern: the engine's
  step, Shift 0.1 mm, Ctrl 10 mm), by Left and Right, and J changes the step; on the pad A held on the wire with the stick drags,
  LB and RB step, and the right stick key is J. Why the fine step exists: one millimetre is about 16 uA at R = 5 ohm and the band is
  10 uA, so a coarse step cannot reach the null. (3) The galvanometer, slide wire, cells, rheostat, relay, cable reel, pull-up, logic
  input and the two capacitor kinds got models of their own (`parts_lab.gd`), the arcade button and knife switch are board props
  driven by the engine's `contacts` (`contact3d.gd`); a part that falls back to a plain labelled box now sets `generic` and the new
  flow fails on it. The meter, cell and cable models lie on their own pin row, because the tickets run wires round them. Strongest
  argument against (a classic-stall player): a 1 m slide wire drawn at 2x scale is mostly empty board. Answer: it is the part the
  lesson is about, and the ruler is what a student reads the balance length from. Not done: a way to change a placed part's value in
  place (a repair means removing the part and placing another), the same as 1-2's.

- **D-tip-waiting (2026-11-23, Ingrid Solheim, Game Lead).** Stakes for 0.5: the customer waits at the counter. Fixed on the first
  bench test (the player's own TEST key), they tip `service:tip` (US$2.00); each failed TEST before the pass takes
  `service:tipStep` (US$0.50) off, never below zero; the fee is never touched. The ticket says what the next passing test earns.
  Exams and the sandbox have no customer; a scripted bench run neither earns nor loses it. Why counted in tests, not minutes: a
  wall clock punishes the learner who measures before acting, which is the habit the game teaches; a test counter punishes
  guessing. Strongest argument against (Dagny's line of tension): a test count does not feel like someone tapping the counter.
  Answer: the tip line is on the ticket in the customer's name and changes on every failed test; a clock is still cut, written
  down for a later layer with a reputation score.

- **D-value-swap (2026-11-23, Ingrid Solheim, Game Lead).** The wheel over a placed part steps its value through what the box
  stocks, in place, wires kept (the engine's setValue). Kofi found that a repair otherwise meant removing the part and rebuilding
  its wires. The wheel over empty bench still zooms; over the box it still changes the tray value; over the supply knob it sets
  volts.

- **D-testbed (2026-11-23, Ingrid Solheim, Game Lead).** The owner asked for "a comfortable simulation testbed to learn how
  various appliances and devices work". 0.5 ships it on the free bench with three devices: the pocket torch (1-1), the weather
  station input (2-1) and the fan driver (5-1). Each loads with its working board in the engine's sandbox (no bin, no bill), so
  the schematic (Tab), the meter and the scope work as on a job. Each has two breaks, and every break is an edit the player could
  make by hand (a wire across a part, a part removed, a value swapped in place): the engine decides what happens, the testbed
  never scripts a result. K pauses and runs the simulation, L steps one frame (pad: left and right stick press). Cut, written
  down: the phone charger stage (4-1 is a mains ticket and needs the safety card flow on the free bench); free choice of fault
  (open, short, drift) on any part; a slow-motion speed control.

- **D-money-06 (2026-11-23, Ingrid Solheim, Game Lead; design by Mateo Arriaga, Game Designer).** Dagny's 0.5 line: "a fine on a
  wallet that buys nothing". (1) The waiting customer's tip is 40 % of the fee, to the nearest $0.25 ($3 → $1.25, $5 → $2.00,
  $9 → $3.50); each failed TEST takes 25 % of the starting tip, to the nearest $0.05. On 1-1, the first ticket, a failed test costs
  nothing and the customer says "First job? Take your time." I proposed 30 %; Mateo moved it to 40 % because 30 % paid the first
  tickets less than the old flat $2.00. (2) The wallet buys one thing: the condition dial, $15.00, reachable after three or four
  tickets even with every tip lost. It runs the live bench in any of the ticket's test conditions (1-2: fresh or tired battery;
  5-2: the MOSFET threshold corners), so the player can check before pressing TEST: money protects tips. The sandbox and the
  testbed have it free; learning stays free. (3) "Parts $x" left the money line: in Learner mode parts never leave the wallet. It is
  "Build cost", a score next to the pay terms. Strongest argument against (Mateo's own): paying to see how a device behaves locks
  part of the testbed behind money. Answer: the testbed and the free bench have the dial for nothing; only a customer's job charges
  for checking before the test. Cut, written down: the dial as a boxed object on the bench shelf (Mateo wants it bought on the
  bench, not in a menu; 0.6 puts a key on the paper ticket); the scope's second channel, MIN/MAX hold and a part organiser as
  purchases; two more tickets whose pass the live gauge cannot judge (1-3 at 13.8 V, 2-1 at the top of the battery's range) wait
  for Ravi to confirm the numbers, because they move goldens and the stars' par.

- **D-testbed-06 (2026-11-23, Ingrid Solheim, Game Lead).** The testbed grows from three devices to six: the phone charger stage that
  0.5 cut (4-1's board: transformer, bridge, 1000 uF; the safety card counts as read on the testbed's isolated bench), a lamp dimmer
  (a panel pot, a TIP120 and a 10 ohm emitter resistor driving 5-2's LED strip; the wheel over the knob turns it) and a relay timer
  (4.7 k into 220 uF, a TIP120 follower, the relay pulls in at about 2 s and switches 1-3's heater). A device that is not a ticket's
  own repair is a board on a host ticket's bench, kept in the engine (src/data/testbed.ts, the testbedBoard query) so the game and the
  engine test load the same parts. Building the relay timer found an engine bug: the sample taken at pull-in mixed the new armature
  with the old voltages and billed the relay kilowatts, so any load on its contacts burned it; fixed in relay.ts with a test. A break
  now lands paused, so Step shows the frame in which a part burns. Strongest argument against (a 5-2 player): the dimmer's strip
  already belongs to a ticket. Answer: the testbed is for how devices work; reusing a ticket's fixed parts keeps one model per part.
  Cut, written down: a dimmer for mains lamps (a triac; no triac model), a 555 timer device, free choice of fault on any part.

- **D-bench-ch45 (2026-11-23, Kofi Mensah, Programmer; the lead's call, the choices below are mine).** Chapters 4 and 5 play on
  the bench: the campaign is 1-1 to 5-5 in the engine's order, Next job runs through to the 5-5 exam, and the title offers the
  classic stall as an option ("Classic 2D look"). The engine owns every number; the bench only shows it. Choices: (1) 4-1's safety
  card is printed on the paper ticket with the engine's words and key (ticketCard().mains, readSafety). Until it is read the ticket
  shows nothing else, and Power, Space and TEST answer "Read the safety card on the ticket first" instead of doing nothing silently,
  which is what they did before. The card names "the grey box on the bench" and "the red hatched square", so both exist: an
  isolation transformer prop wired to L and N (brown and blue leads), and the engine's keep-out drawn as a hatched square with its
  HIGH VOLTAGE words. (2) The thermal camera (T, or a rail key on tickets whose card offers it) colours each part's body from the
  engine's temperature on a fixed iron scale (dark blue at 20 C, white at 150 C) and names the hottest part on the tip plate. It is
  a false-colour overlay, not a separate camera view, so the board stays where the player is working. (3) The five fixed parts
  that fell back to a plain box got models of their own: the EI-core mains transformer, the constant-current load module, the
  fan's soldered leads, the 12 V LED strip (it lights with the engine's strip current over its 0.3 A rating) and the amplifier
  input jack. The 7805's heatsink variants (TO220-25, -15, -8 C/W) now carry a clip-on sink sized by their rating, so the tray and
  the board show which sink was chosen; before, 4-3 drew every variant as a bare TO-220. The ch23 rule holds: look2_ch45_flow
  fails on any part drawn as a plain box. (4) The ch45 flow also fails when a
  device (the fan, the microcontroller, the isolation transformer, the case) stands between the work-view camera and an instrument
  display. It failed on 5-1, where the fan hid the bench supply's numbers; the fan moved left, to x 0.085, behind the board's right
  edge. The 1280x800 stills found two more overlaps the check cannot see: 5-1's scope screen sat partly under the paper ticket (the
  scope moves 5 cm right), and 4-1's isolation transformer stood mostly off the right edge (it moves in front of the supply, below
  its display). (5) 5-1 started from the title is still the showcase: it unlocks the tickets before it, so it never saves, its Next job
  returns to the title, and the next Jobs reloads the save. From the campaign it is an ordinary job. (6) Selector keys on the rail
  carry their selector's label, because 4-1 has two rows (MAINS 207/230/253 V, LOAD 100 mA/none) and "none" alone says nothing.
  Strongest argument against (2), from a domain engineer: a thermal camera sees surfaces, and the engine's number is the junction
  temperature, so the 7805's tab reads hotter on the bench than it would through a lens. Answer: the ticket's limit (125 C) is on
  the junction, and that is the number the player has to keep down, so showing it is the honest choice for this lesson. The palette
  is fixed, never auto-ranged, so a cooler build looks cooler. Cut, written down: no case-to-junction offset on the camera; the
  ch4/ch5 boards still arrive blank where the engine has no fault for them (4-1 to 4-4, 5-2 to 5-4; the brief and the empty board
  are the job); the strip's glow scales on its rated 0.3 A and does not model colour shift; the condition dial (D-money-06) is not
  exercised by the ch45 flow.

- **D-conditions-06 (2026-11-23, Ravi, Domain Engineer).** D-money-06 left two tickets the live gauge alone cannot judge for me to
  confirm: 1-3 also tested at 13.8 V, and 2-1 tested at the top of the battery's range. I checked both in the engine and add
  neither. (1) 1-3 at 13.8 V. A series resistor scales with its supply: Ref A (22 ohm 1 W) puts 9.58 V on the heater at 13.8 V, so
  the 7.85-8.40 V band cannot hold at both voltages with any resistor. Testing ratings only at 13.8 V does not bite either: power
  rises by (13.8/12)^2 = 1.32, so only a part running at 76-100 % of its rating at 12 V would fail, and the bin (22, 27, 47, 51,
  100 ohm at 1/4, 1/2, 1 W) has no passing build in that window. 22 ohm 1 W goes to 0.81 W, two 47 ohm 1/2 W to 0.41 W each, four
  100 ohm 1/4 W to 0.21 W each, and all three pass in the engine. The corner would cost a test run and teach nothing. An aquarium
  heater on a bench supply has no car battery either. (2) 2-1 at the top of the battery. A divider scales with its supply too. The
  band is 3.30 V +-2 %, and 9.3 V is already +3.3 %. At 9.3 V the engine fails the reference (15k/82k, 3.46 V) and passes only the two
  pairs that sit at the bottom of the band by luck (15k/56k, 2.7k/1.8k); at 9.6 V every pair fails. The level file already says this:
  the supply-sag lesson belongs to 4-2, where a Zener holds the output from 13 V to 17 V, and that ticket tests both. Strongest
  argument against: the dial ($15) then pays off in chapter 1 only on 1-2. Answer: twelve tickets already run more than one
  condition (1-2, 2-3, 2-4, 3-2, 4-1 to 4-4, 5-1 to 5-4), so the dial has work from the second ticket on. A first-chapter corner that
  no resistor can pass would be unfair, and one that nothing fails would be decoration. Found on the way: the 2-1 divider explainer
  quotes the 9 V numbers whatever condition failed (3.35 V in its text for a 3.46 V miss). That is harmless while 2-1 has one condition
  and must be fixed before it gets a second. The TIP120 model sets each stage's gain from bf(bf+1) = hFE and ignores the internal
  8 k and 120 ohm, so at Vce 3 V its composite gain is about 530 at 0.26 A, about 700 at 0.5 A and 960 at 3.8 A, under the datasheet
  minimum of 1000 at 0.5 A and 3 A. That is why 47 k in the relay timer never pulls the relay in (the coil stalls near 5 mA). The testbed break now swaps the
  capacitor instead (220 to 470 uF: 1.98 s to 4.22 s), because that result does not depend on the transistor's gain. Cut, written
  down: no new conditions on 1-3 or 2-1; the TIP120 gain fix (solve the stage gain so the composite meets 1000 at 0.5 A with the
  shunts in) moves every TIP120 golden and waits for the lead's call.

- **D-first-timer-07 (2026-11-24, Ingrid Solheim, Game Lead).** The five 1-1 blockers from Leo's 0.6 run, each fixed where it
  happened. (1) Esc also drops the lit part; the wheel cannot change it until the pointer leaves and comes back. (2) Right-click
  removes only what is lit, and a wire is named by its ends ("Removed the wire from IN to the heater leg. Ctrl+Z puts it back.").
  (3) Picking a part says what to do next, and a drag from the tray released over the board places it. (4) A wire end snaps one
  hole over only when exactly one leg or pad is that close; a wire that joins a source's plus straight to its minus is refused
  in the bench with the reason, before the release (the ring turns red). The engine only warns (an agent or a test may still
  draw it), because a refusal there would change what the solver accepts. (5) The key values of fixed parts are a ticket line
  at spec size ("On the board: a 50 ohm heater, OUT to GND. The supply gives 12 V at IN."). Strongest argument against (4)
  (nobody has made it yet; I write it down myself): a short is a lesson, and a refusal takes it away. Answer: the lesson the first chapter teaches is
  the current limit, and a short on a bench supply only trips its limit with no reading to learn from; 4-x keep their fuses
  for that lesson. Cut, written down: a confirmation before removing a part (undo is enough), a drag-to-place for parts already
  on the board (move stays click-then-click).

- **D-tools-07 (2026-11-24, Ingrid Solheim, Game Lead).** Dagny (0.6): "after the $15 dial the wallet buys nothing". A ladder of
  three bench tools, each changing a diagnosis: the condition dial ($15, 0.6), the thermal camera ($30: every job, not only
  chapter 4's; see a part heat before it burns) and the scope's second channel ($45: input and output on one screen, which
  chapter 6's gain, clipping and slew jobs are built to show). They are offered on the ticket after a job is paid (the moment
  the wallet has just grown), two at a time, greyed with the price while the money is short. The testbed and the free bench own
  them all; learning stays free. The second channel is gated in the bench only: the engine's attachProbe still takes channel 2
  in any mode (tests and agents use it), so the purchase buys the clip and the trace, not a solver feature. Strongest argument
  against (Mateo, D-money-06): tools should be objects bought at the bench, not keys on a ticket. Answer: agreed as the
  direction; the shelf objects need models and a place on the bench, and chapter 6 comes first. Cut, written down: Dagny's
  current clamp, part tester and organiser; tool boxes on a shelf; a price check by Mateo of $30 and $45 against the fees.

- **Note on D-conditions-06 (2026-11-24, Ingrid).** "About 700 at 0.5 A" is history: Ravi's 54486ba makes the TIP120's composite
  gain 1000 at 0.5 A and 1530 at 3 A (onsemi TIP120/D, hFE min 1000 at 0.5 A and 3 A); 1f0fb7c moved the testbed numbers
  (relay timer pull-in 1.86 s, 3.98 s with 470 uF; dimmer 0.101 A). No ticket changed pass or fail.

- **D-cuts-07 (2026-11-24, Ingrid Solheim, Game Lead).** Cut from 0.7, written here so nobody finds them by surprise:
  1. Chapter 6 is on the 3D bench only. The classic 2D stall does not list it (Kofi). The stall is the fallback renderer; nobody
     plays it by default since 0.5. Revisit if the low tier on an integrated GPU cannot carry the bench.
  2. An op-amp on more than its rated supply does not burn, and its inputs have no common-mode limit (Ravi). Every chapter-6 job
     fixes the supply at ±12 V, so no player can reach either today. They are needed before any job lets the player set the
     rails; chapter 7 must add both, with tests, before such a job.
  3. Sound (owner: later).
  The strongest argument against cut 2 (Ravi): a learner who reads the codex learns the rails as free. Answer: he is right, and
  there is none yet. The ±18 V limit is in the parts data (src/data/parts/ics.ts) but no text a player reads says it. Open item for 0.8:
  the op-amp's codex page states it, and the model enforces it once a job lets the player reach it.
