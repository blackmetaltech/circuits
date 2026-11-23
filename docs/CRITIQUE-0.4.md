# CRITIQUE 0.4: "On the Bench" (2026-11-23)
Phase C of the new look (factory `briefs/LOOK2.md`): the bench controls onto the instruments, stakes, chapter 2 on the bench, first passes at sound, gamepad and Cute mode, a systems review of the cost constants, a Windows build in the release, hand play on a GPU window. Lead: Ingrid Solheim. Product call (chapter 2, not 4): Priya, recorded as D-ch2-bench.

Testers: Noor (playtester persona, 15) by hand on a GPU-backed window (Forward+ on the RTX 4090, 1280x800, 30 fps cap, real speed), one session of about 40 minutes; Sigrid (art director) once, from stills; Tomasz (systems engineer) on the cost constants. No human has played, heard or held a pad on the new look.

## The gate (0.3 → 0.4, written in CRITIQUE-0.3)
| Gate item | Result |
|---|---|
| A human novice plays chapter 1 in the new look and says what confused them | **Not met.** No human played. Noor, an agent persona, played 1-1 and 2-1 by hand on a GPU window at real speed for the first time (before: software rendering at 15 fps). |
| The bottom panels become bench objects; Sigrid scores UI 7 | **Not met: UI 6.** Objects: done. The control plate and the 2D tray are gone. Power and Test are keys on the bench supply, the parts sit in a 3D sorting box, the ticket is the only paper, and the hover tip and meter reading have their own small plate. |
| Sound and gamepad in the new look; Cute mode decided | **First pass met; untested by humans.** Procedural sound on the bench's events, Sound on/off (ASSETS.md: no human has listened). Gamepad as a cursor ring plus the bench's own keys, `look2_pad_flow` (13 checks); no real controller tried. Cute mode decided and built (D-cute-bench): current beads on live wires, on by default. |
| Chapter 2 in the new look, with a repair that needs the meter before any change | **Met for 2-1 and 2-3 (the recorded cut line).** 2-1 arrives faulty (the unloaded divider, 2.76 V) and refuses the bench until OUT is metered; 2-3 refuses until the sealed box is metered and needs the new VOLTAGE knob. 2-2 and the 2-4 exam stay classic, said on the title. |
| The live simulation of 5-1 under 10 ms a frame on the desktop | **Not met, not worked on.** The layer's time went to the coordinator's list; 5-1 was not re-measured. |

## The coordinator's list
| Item | Result |
|---|---|
| 1. Site and README: one or two short sentences, no classic shots above the fold | **Met.** Cut in fbd25d9; this layer's shots replace 0.3's stills. The lead GIFs are still 0.3 recordings of 5-1 (see What still fails). |
| 2. Bench controls onto the instruments (Sigrid) | **Met.** e18a869. |
| 3. Stakes (Dagny) | **Mostly.** A burnt part is a rush order: price plus US$1.50 (D-burn-rush). Removing a part names its wires and Ctrl+Z puts them back. Dead pads show red before the click. The exam is marked on the ticket with "Show the working". Cut and written: deadlines and reputation. Legs under tall parts are still hard to hit (Noor). |
| 4. Chapter 2 on the bench, devices that arrive faulty | **Met at the cut line** (above). |
| 5. Sound and gamepad on the bench; Cute decision recorded | **Met as a first pass** (above). |
| 6. Tomasz reviews D-cost-linear; Windows build in the release | **Met.** Tomasz passed the constants; his two fixes landed (the flop limit covers the whole bench, a dim-12 ladder joined the gate boards at ratio 1.31). release.yml now adds CI's Windows and macOS archives to the locally smoke-tested release, never replacing one. |
| 7. Hand play on a GPU window at real speed | **Met.** `scripts/gpu-desk.sh`: one window at a time under the shared lock, frame cap, released on stop. |

### Hand play (Noor, GPU window, 1280x800, 30 fps cap)
| Found | Status |
|---|---|
| The torch's LED "burnt on first power-up" of a correct circuit. Cause: the LED arrived burnt at the spot the fix uses; kept, the first powered frame re-announced the customer's burn as hers. | **Fixed** in both looks; flow check on 1-1. |
| Click, then click does not draw a wire; only drag works, with no message. | **Fixed**; flow check. |
| 2-1's ticket showed "3.27 W" for a voltage. | **Fixed**: units come from the engine; flow check. |
| 2-1 did not enforce measuring first. | **Fixed**: the bench refuses until OUT is metered. |
| The VOLTAGE knob is out of frame in the default view. | **Half**: the open line points at key 4. The view still cuts the supply. |
| Legs under tall parts hard to hit; the wire-end note is a wall of text; replacing a part means re-wiring it. | **Open.** |
| The sorting box and the pads do not fit one view; left labels clip at the window edge. | **Open.** |
| The schematic shows OUT 2.76 V before the meter is used. | **Open** (design question: hide node voltages until probed on measure-first tickets). |
| The 3D meter's display looked blank in view 4. | **Not reproduced**; the reading plate showed 2.76 V in the same session. |
| Cute beads are small and do not show direction or size clearly. | **Partly**: beads enlarged after GPU shots; direction and size still weak. |

## Owner-concerns audit (bible 05)
| Group | Pass/Fail | Evidence |
|---|---|---|
| A game not SaaS | Mostly | The dashboard band is gone: supply keys, a sorting box, a paper ticket. A keycap rail remains. |
| B soul | Pass | Customers' own devices; a sealed box nobody makes any more; a weather station sized wrong. |
| C realism | Mostly | New models: a potted sealed module, an ADC header. No reference-photo comparison. |
| D readability | Mostly | Units from the engine; tips on their own plate. Left sorting-box labels clip at 1280x800. |
| E controls work | Mostly | Flows drive every bench control, the pad and click-click wiring; no sweep of every button by hand. |
| F scroll and input | Mostly | Wheel over a compartment or the VOLTAGE knob steps values; pad events mapped through the window stretch. |
| G devices | Mostly | Gamepad first pass (headless flow only). 1280x800 shot. No phone, no real Deck, no real controller. |
| H learnable | Mostly | Noor won 1-1 and 2-1 by hand from the screen. The hint coach of the classic look is still not in the new look. |
| I logic | Pass | vitest green (full run before release below), Godot flows green (look2 119, pad 13, save 4, ch1 164, ch2 97), CI green. |
| J depth | Mostly | Chapter 1, 2-1, 2-3 and 5-1 in the new look; the rest classic. |
| K fun | Not re-scored | Dagny was not called this layer (budget). |
| L performance and settings | Mostly | Tiers unchanged; 5-1's 23 to 28 ms frame not addressed. |
| M sound | Mostly | Procedural cues on every bench event, a toggle. Nobody has listened. |
| N saves and quitting | Pass | Sound and Cute preferences saved; flows never write saves. |
| O hygiene | Pass | CHANGELOG, privacy grep before push. |
| P status | Pass | This file says what was not done. |
| Q cost and machine | Pass | One helper at a time; one GPU window at a time under the shared lock; frame caps. |
| R story | Mostly | Arrival and open lines per device. No arc. |
| S cute | Mostly | On by default, one element mapped to one band; the classic look's faces and critters are not ported. |
| U README and releases | Mostly | New stills; the GIFs are 0.3's (5-1), except where noted in the README. |
| V iteration effort | Pass | Expansion (chapter 2), functionality (pad, sound, knob), playability (GPU hand play and its fixes). |

## Scores
| Tester | Scores |
|---|---|
| Sigrid (round 4, from stills) | materials 7, composition 6, UI 5 → 6, place 7, 1280x800 5, low tier not re-shot, overall 6. She opposes passing the UI gate: the meter reading is still a floating plate instead of the meter's own face; the supply (TEST key, VOLTAGE) and the meter are cut by the right edge in view 1 at both sizes; the box labels float outside the box. Also: the trimmer is drawn as an axial resistor; white enclosures blow out; devices share one project box; Cute beads read as solder. Her "title is the Godot splash" finding came from a mislabelled still (the playtester's t1.png overwrote the lead's); the stock Godot boot splash does show for about 8 s (Noor saw it too), which stands. |
| Dagny | Not called this layer. Last: fun 7, clarity 7, tension 5, return 5, tech-wiz 7. |

## What still fails (ranked)
1. No human has played the new look, heard it or held a pad on it.
2. The UI gate: Sigrid scores 6. View 1 cuts the supply and the meter at both sizes; the reading floats on a plate instead of the meter; the box labels float.
3. Picking and wiring legs under tall parts is still fiddly, and replacing a part means re-wiring it.
4. The default view cannot show the sorting box, the board's pads and the supply together at 1280x800.
5. 2-2, the 2-4 exam and chapters 3 to 5 are classic only; 5-1 still costs 23 to 28 ms a frame.
6. The schematic gives away readings that measure-first tickets want from the meter.

## Gate for 0.4 → 0.5
- A human plays 1-1 and 2-1 in the new look; their confusions are written down.
- Swap a part's value in place (wires stay); legs under tall parts hit first time in a hand play.
- A default view that holds the box, the pads, the supply and the meter at 1280x800 and 1920x1080; the reading on the meter's face; Sigrid UI 7.
- A trimmer that looks like a trimmer; a CIRCUITS boot splash.
- 2-2 and the 2-4 exam on the bench, then chapter 3.
- 5-1 under 10 ms a frame.
