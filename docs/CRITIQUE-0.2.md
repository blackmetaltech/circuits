# CRITIQUE 0.2: "Switches & Gain" (2026-11-22)
Rounds tested against the gate in CRITIQUE-0.1. Findings are in the CHANGELOG (Fixed) and the notes below; shots are in `docs/screens/ch5` (1920x1080 and 1280x800, every chapter 5 ticket with its reference and its designed failures) and `docs/readme`.
Fix rounds: A (the seven 0.1 findings), B (chapter 5 build and a screenshot read), C (a hand play-test through the desktop harness, below).
Tested by the build agent only: no fresh human. Hand-played through pointer and keys (desk slot, 1920x1080): ticket 1-1 from a fresh save (a burn, undo, resistor, bench pass), 5-1 from a prepared save with every earlier ticket passed (naive no-diode build that burned, fix, bench pass) and 4-2 opened and looked at; at 1280x800 the title and 4-2 were opened and looked at. Chapter 3 was not hand-played; chapters 3 to 5 are otherwise covered by the engine flows through the same UI layer.

## The gate
| Gate item (from CRITIQUE-0.1) | Result |
|---|---|
| A fresh novice wins 1-1 and one ticket per chapter from in-game guidance, and a diploma-level tester wins chapter 4 | **Not met.** One agent (not a novice) played 1-1 and 5-1 from the on-screen guidance and won both; no chapter 3 or 4 hand play; no second tester. |
| The coach holds the "add a limiting part" step after an undo | **Met.** `burned` coach atom, engine test, flow check and seen in the real build (1-1 after Ctrl+Z points at the resistor). 5-1 gets the same treatment for the flyback diode. |
| Map text 16 px or more; cable and slip overlaps removed, each with a layout_flow check | **Met.** layout_flow audits the notebook cards (size, overlap, "locked"), the customer, every coach slip and the lead cables (under the chit) for 23 tickets at both sizes. Not audited: toasts. |
| A listen through the audio, and a gamepad pass at 1280x800 | **Not met.** Nobody listened; no gamepad. |
| Plan the layer from expansion, functionality and playability | **Mostly.** Expansion (chapter 5) and playability fixes done; functionality (gamepad) not started. |

**Verdict:** chapter 5 is built to the chapter 4 standard and the 0.1 findings are fixed and guarded, but the build still has one tester (the agent), no human, no gamepad, no audio listen, and a stack of 40 Codex pages that the notebook can only show 26 tabs of.

## Owner-concerns audit (games-bible 05)
| Group | Pass/Fail | Evidence |
|---|---|---|
| A game not SaaS | Pass | World on screen at every step; drawers and slips over the bench. Read in every screenshot. |
| B soul | Pass | Same stall, Wren's notebook, hand-drawn sketches; nothing shared with other games but plumbing. Not compared side by side this layer. |
| C realism | Mostly | New part art (fan with turning blades, strip, TO-220, legs labelled); no reference-photo comparison. |
| D readability | Mostly | 16 px floor audited on the map cards; transistor legs now labelled. Codex index tabs were unreadable at 40 pages: a sliding 26-tab window now; the 1280x800 notebook was not re-read. |
| E controls work | Mostly | ch5 flow clicks every ticket's switches (PIN, THRESHOLD, INPUT A / B, TRANSISTOR GAIN), rocker, GO and predictions. No sweep of every button. |
| F scroll/input | Mostly | A one-frame press-move-release now always places the part (drag_flow); tray scroll untouched. |
| G devices | Fail | Desktop and 1280x800 only; no phone, no real Deck, no gamepad. |
| H learnable | Mostly | 1-1 and 5-1 won from the coach by the agent. Found and fixed: the coach sent the player back to the switch after a 5-1 burn, "Optional: Optional:", a "?" paper in the hands of every chapter 4 customer. Unverified with a newcomer. |
| I logic | Pass | Engine suites and flows green; no new interaction-graph walk. |
| J depth | Mostly | Five chapters reach switching transistors, MOSFET thresholds, gates and a CE stage; op-amps and filters are still designed only. |
| K fun | Not checked | No fun-critic round. |
| L perf | Not checked | Software GL only. The 5-1 live PWM runs 80 steps per frame. |
| M sound | Fail | Cues exist; nobody has listened. |
| N saves | Pass | A prepared 0.1-era save loaded and continued in the harness; save-migrate flow green. |
| O hygiene | Pass | No absolute paths or serials in tracked files; CHANGELOG, README with 1600 px shots. |
| P status | Pass | This table says what was not checked. |
| Q cost | Pass | One agent, no parallel workers; machine load was 6 to 30 from other sessions. |
| R story | Mostly | Customers and chapter pages; no endings. |
| S cute | Pass | Cute mode on by default; the fan, strip and gadgets show the current. |

## Scores (per tester, 0-10)
Only the build agent tested; a score from the builder would not be honest, so none is given.

## What works
- 1-1 from a fresh save: burn, undo, resistor, pass, with the coach holding the right step.
- 5-1: the no-diode build burns the transistor on screen at 100 Hz and the note names the coil, the 2000 V and the 40 V limit; the diode fixes it.
- Every designed chapter 5 failure fails for its stated reason with a number the scope or bench can show (Rb 8.2 k: fan 6.5 V; 2N7000: 45 mA, 0.46 W and smoke; no pull-down: the reset test lights the strip; NAND without level shifters: OUT collapses; no RE: THD 38 %).
- The exam slip leaks no answer before the predictions are locked and works the card, the real junction and the beta swap afterwards.

## What still fails (harsh, ranked)
1. No fresh human has played any of it; chapters 3 and 4 were not hand-played this layer.
2. No gamepad, no phone, no audio listen, no Windows or macOS run.
3. The notebook index at 40 pages is a sliding window, not a design; the Codex wants chapters, not a number strip.
4. 5-4's scope shows the sine but its LOCK only checks the gain; the THD lives in the formal bench.
5. The 2N2222A and BC547B rows are unverified, and a one-pad-apart wire end snaps to a leg (the chapter 5 references avoid it; a newcomer will meet it).
6. The shoebox for a 40-part chapter has no search or grouping.

## Gate for 0.2 → 0.3
- A human novice wins 1-1 and one ticket per chapter 1 to 5 from the in-game guidance alone, and a diploma-level tester wins chapter 5.
- Gamepad focus and A/B actions work through the title, map and bench at 1280x800; a listen through the audio; a real Deck or phone pass.
- The notebook index becomes chapters (a chapter strip, then pages); the shoebox groups parts by kind.
- Chapter 6 (op-amps) planned from expansion, functionality and playability; the scope shows steady-state AC with the THD in the LOCK.
- 2N2222A / BC547B rows verified from a reachable datasheet or kept as blockers with the ticket noted.
