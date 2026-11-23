# CRITIQUE 0.5: "Whole Chapters" (2026-11-23)
Phase C continued: the open UI defects, chapters 2 and 3 on the bench, a testbed of known devices, stakes, sound and pad, the public docs sweep, hand play on a GPU window. Lead: Ingrid Solheim. Chapter 2 and 3 cases and flows: Kofi (programmer).

Testers: Noor (playtester persona, 15) by hand on a GPU window, mouse and a virtual Xbox pad, about 17 minutes of wall time and 236 actions. Dagny (fun critic) once, from evidence, without the game running. No human has played, heard or held a pad on this build. Sigrid did not score this layer: one critic per layer, and tension was the open score.

## The gate (0.4 → 0.5, written in CRITIQUE-0.4)
| Gate item | Result |
|---|---|
| A human plays 1-1 and 2-1; confusions written down | **Not met.** No human played. Noor (an agent persona) played 1-1, 1-2 and part of 1-3 by hand. Her confusions are below. |
| Swap a value in place, wires stay; legs under tall parts hit first time | **Half met.** The wheel over a placed part steps its value in place (D-value-swap, `look2_swap_flow` 13). Legs: **not met.** Noor lost about 20 minutes on 1-1 finding the battery's ground lead and quit 1-3 hunting the heater's leg. Target rings and pad tips landed after her session and are not re-played. |
| Default view at 1280x800 and 1920x1080; Sigrid UI 7 | **Met in 0.4.1** (Sigrid UI 7). The meter no longer covers any supply control (frame test, D-supply-stays). |
| A trimmer that looks like a trimmer; a boot splash | **Not worked on.** Carried. |
| 2-2 and 2-4 on the bench, then chapter 3 | **Met.** 2-2, 2-4 and 3-1 to 3-4 on the bench; 3-1 and 3-3 arrive faulty (`look2_ch23_flow` 123). No chapter is half classic. |
| 5-1 under 10 ms a frame | **Not measured.** Carried for the third layer. That is now a pattern, and I am writing it down as one. |

## The coordinator's list
| Item | Result |
|---|---|
| 1. Meter over OUTPUT; two small texts at 1280x800; the ticket wrap | **Met.** Supply stays, meter clear of OUTPUT, TEST and VOLTAGE (frame test). The scope's screen text is 16 px on screen; the tab price line moved to the tip; numbers and units no longer wrap apart. Not fixed: the engraved labels on the scope's front panel are still small. They are panel art, not screen text. |
| 2. Chapter 2 finished, chapter 3 over, faulty where a repair | **Met** (above). |
| 3. Testbed, three devices | **Met.** Torch, weather station input and fan driver, two breaks each, pause and step (`look2_testbed_flow` 21, D-testbed). Phone charger stage cut and written down. |
| 4. Stakes; Dagny re-scores tension | **Met. Tension 5 → 6.** The waiting customer's tip (D-tip-waiting). |
| 5. Sound and pad improved; nobody has listened | **Met as a pass.** Filtered clicks, room tail, pitch jitter (`sfx_flow` 42). Pad: aim slowdown, rumble, A in menus. **Nobody has listened to the sound or held a pad.** |
| 6. Public docs: the word sweep, nothing private | **Met.** README, DESIGN, STATUS and LOOK2 have no player-facing use of the word. DESIGN keeps `real` as the name of a model setting in two technical lines (1182, 1225); it is an identifier, not copy. No emails, paths or secrets found. |
| 7. Hand play on the GPU, mouse and pad | **Met, and it found the worst bug of the layer:** the pad could not press any menu button. Fixed and tested. |

## Hand play (Noor)
| Found | Status |
|---|---|
| A on the pad pressed nothing on the title (ui_accept had no joypad button). | **Fixed**; pad flow check (A starts Jobs). |
| The battery's ground lead and the heater's leg are hidden and unlabelled. | **Fixed in part:** with a wire, meter or probe tool every connectable pad shows a ring, and the pad under the cursor names itself ("GND: ground, the supply's minus"). Frame checks. Not re-played. |
| Testbed breaks that burn a part said nothing about the burn. | **Fixed:** the engine's explanation shows on the card. |
| "2000 V peak" and smoke carried from the testbed into 1-1. | **Fixed:** opening a board clears the capture and the smoke. Flow check. |
| Long ticket text runs off the bottom at 1078 px wide. | **Open.** A scrolling ticket was tried and reverted the same hour: the scroller sized the paper 2043 px wide and ate the wheel over the board. `look2_swap_flow` caught it after two commits had been pushed. |
| Unexplained $1.53 burn charge after Ctrl+Z through a removal. | **Open, not reproduced.** |
| 1-2 shows unequal LED currents on a series chain; battery current reads negative. | **Open.** Needs Ravi (domain engineer). |
| Stale hover tip after a wheel step; tip carried to the next ticket. | **Open.** |
| The torch burns in the first frame, so Step cannot show the current rising. | **Open, known.** |

## Dagny (from evidence)
Fun 7, clarity 6 (down from 7), tension 6 (up from 5), return tomorrow 5. "The waiting customer changed how one playtester behaved, which is more than the burn bill ever did. But it is a fine on a wallet that buys nothing." Her ranked raises: more tickets with a condition the live gauge cannot show (the 1-2 tired-battery pattern) and a bench control to check it; the tip as a share of the fee, not a flat $2.00; one thing to buy with the wallet. She agrees the waiting customer beat scarce parts, and that a clock would punish measuring.

## Rule slip
Kofi ran `pkill -f` once during the chapter 3 work. It matched only his own shell. It is against the machine rule and is written here.

## Gate for 0.5 → 0.6
- A human plays 1-1 to 1-3 by hand; the ground lead and the heater leg found without help.
- The tip scales with the fee; the wallet buys one bench upgrade.
- Two more tickets whose pass condition the live gauge cannot show.
- 5-1 measured under 10 ms a frame, or the target dropped in writing.
- The ticket fits at 1078x800 without a scroller that eats the wheel.
- A fourth testbed device.
