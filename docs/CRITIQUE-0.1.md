# CRITIQUE 0.1: "Four chapters on Lantern Lane" (2026-11-22)
First layer, so there is no earlier gate. Tested by the owner's screenshot review (docs/screens/ch4, docs/readme), a fix round, and one fresh-eyes playtest by the build agent
(ticket 1-1 played by hand from a fresh save; 2-1 played to its first failed bench; 3-1 and 4-1 only opened and looked at, the latter at 1280x800). Shots: docs/screens/.

## The gate
| Gate item | Result |
|---|---|
| No message needs more than two pages at 1280x800 | **Met.** Cards are 880 design px wide, four lines a page; the longest message any flow produced is 6 to 7 lines (asserted in all four chapter flows). |
| Shoebox names fit in every chapter | **Met** for all 18 tickets (layout_flow). Four names use a short form ("1N4007 diode"). |
| The speech bubble never touches a control or instrument | **Met** in layout_flow at both sizes, both lines (ask and thanks). It also no longer covers the perfboard. Not checked: tooltips, toasts. |
| Coin total not clipped at 1280x800 | **Met** (asserted). |
| Small tickets use the board | **Mostly.** Seven tickets zoom to the used region; the other eleven show the whole 24x16 board because their reference designs or fixed parts span it. |
| Text 16 px or more at 1080p and 1280x800 | **Mostly.** Floor enforced in the stall UI; the map page's ticket cards still draw about 14 px. |

**Verdict:** the review round is fixed and guarded by a layout test, but the build has had one tester (the agent), no fresh human, and chapter 4 has never been played by a newcomer.

## Owner-concerns audit (games-bible 05)
| Group | Pass/Fail | Evidence |
|---|---|---|
| A game not SaaS | Pass | The stall bench with drawers over it; screenshots read. |
| B soul | Pass | Night-market stall, Wren's notebook; nothing shared with other games but plumbing. Not compared side by side this layer. |
| C realism | Mostly | Part art is code-drawn; no reference-photo comparison this layer. |
| D readability | Mostly | 16 px floor; map cards, a cable over the chit, and a six-line coach slip over the board bottom still fail. |
| E controls work | Mostly | Flows click every ticket's controls; no sweep of every "take me there" this layer. |
| F scroll/input | Not checked | Tray scroll untouched this layer; a one-frame drag can drop a part under load. |
| G devices | Fail | Desktop and 1280x800 only. No phone, no real Deck, no gamepad. |
| H learnable | Mostly | Novice 1-1 win in the build agent's run with the coach; coach regresses after an undo. No fresh human. |
| I logic | Pass | Engine suites (897 tests) and flows green; no interaction-graph walk added. |
| J depth | Mostly | Four chapters to rectifiers and regulators; chapters 5 to 8 only designed. |
| K fun | Not checked | No fun-critic round. |
| L perf | Not checked | Software GL only in this run. |
| M sound | Fail | Cues exist; nobody has listened. |
| N saves | Pass | Save-folder migration tested; save and continue not re-tested by hand. |
| O hygiene | Pass | No absolute paths; CHANGELOG, README with 1600 px shots. |
| P status | Pass | This table says what was not checked. |
| Q cost | Pass | One agent, no parallel workers; machine load was 20 to 60 from other sessions. |
| R story | Mostly | Customers and chapter cards; no endings. |
| S cute | Pass | Cute mode on by default; not changed this layer. |

## What works
- Burn, undo, resistor, lock: ticket 1-1 played end to end with the coach; the burn note quotes the circuit's own numbers.
- A failed 2-1 divider explains the ADC load with the real 4.29 V.
- The layout is now machine-checked at two window sizes for all 18 tickets.

## What still fails (harsh, ranked)
1. No fresh human has played chapter 4 or the 0.1 build; one agent run is not a tester panel.
2. Coach regresses to "flip the power switch" after Ctrl+Z of a burn, which sends the player into the same burn.
3. Real input: a press-move-release inside one frame dropped a part (harness under load); needs a check on a slow machine and the Deck.
4. Map page text under 16 px; long coach slips and instrument cables overlap content.
5. No audio listen, no gamepad, no phone, no Windows or macOS build run by hand.

## Gate for 0.1 to 0.2
- A fresh novice wins 1-1 and one ticket per chapter from in-game guidance, and a diploma-level tester wins chapter 4.
- The coach holds the "add a limiting part" step after an undo; map text 16 px or more; cable and slip overlaps removed, each with a layout_flow check.
- A listen through the audio, and a gamepad pass at 1280x800.
- Plan the layer from all three of expansion (chapter 5), functionality (gamepad) and playability.
