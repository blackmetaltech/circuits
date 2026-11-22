# CRITIQUE 0.3: "Workbench" (2026-11-23)
Phase B of the new look (factory `briefs/LOOK2.md`): round 3 on the slice, chapter 1 in the new look end to end, repair tickets (decision 10), a free bench, a faster test suite, and the release gate. Lead: Ingrid Solheim. Product call (chapter 1, not 5): Priya, recorded in the factory DECISIONS.

Testers: Sigrid (art director) and Dagny (fun critic) once each, from stills and clips; Noor (playtester persona, 15, never soldered) by hand through the desktop harness at 1280x800, low tier, four sessions. No human has played the new look.

## The gate (LOOK2.md phase B)
| Gate item | Result |
|---|---|
| Round 3 on the slice: instrument-style panels, labelled tray, readable parts, smoke, arrival tag, case; nothing covers the scope or the device | **Met, with a standing objection.** Faceplates, LCDs, keycaps, paper ticket, labelled tiles, a thin smoke wisp, a coloured case per device; views 3 and 4 fold the ticket and hide the tray. Sigrid: UI 4 → 5, overall 5 → 6. Her top finding stands: the bottom band of three panels still reads as a dashboard. |
| Decision 10 (a) and (b): repairs start from a faulty board you probe first; burnt parts cost money; the customer brings and collects the device | **Met.** 1-1, 1-2, 1-3, 1-4 and 5-1 arrive faulty in a case; `src/engine/repair.test.ts`; the burn bill comes out of the pay and shows the moment a part burns. Dagny: tension 5, unchanged: the bill is too small to hurt. |
| Chapter 1 in the new look, played end to end | **Met.** By hand: 1-1 to 1-4 in session 3 and the 1-5 exam in session 4 (3 stars), through the real mouse and keys. `look2_ch1_flow` (73 checks) plays all five tickets through the Workbench's own controls; `look2_save_flow` wins 1-1, quits and continues at 1-2. |
| Free bench: any part, power, probe, save and load | **Met.** Three slots; flow checks place, power, meter, save, clear, load and right-click removal. |
| Speed: the suite fits CI's 20 minutes without weakening a check | **Met.** CI 6 to 10 minutes per Node version (was cancelled at 20). Bench memo and a missing-part precondition: checkLevel 5-1 111 s → 6.5 s, reports byte-identical. |
| Pick up the new core | **Met.** Pointer bump only. |
| Hand play by a playtester persona through the real input path | **Met, by an agent persona, not a human.** Four sessions below; the whole chapter is won by hand across sessions 3 and 4, each on a build with the previous session's fixes. |
| Tests and flows green | **Met.** vitest 953 passed; 13 Godot flows green; CI green on both Node versions with the look2 flows and a smoke check that now opens 1-1 on the workbench. The bench-cost CI step had been red on master since 11-22: fixed by steadier timing and a linear-circuit cost term (D-cost-linear), tolerance unchanged. |
| Low tier usable on the iGPU | **Met.** Ryzen 9900X iGPU, Compatibility, 1280x800, 1-1: 15.0 ms avg, 18.9 ms p95. |
| CHANGELOG, CRITIQUE with the owner-concerns audit | This file; CHANGELOG 0.3.0. |
| Site, wiki, README shots and GIFs (the scope and a failure) | **Met.** circuits.blackmetal.tech rebuilt; `site/wiki` generated from the game's text with a staleness test; README leads with the failure GIF, plus the case opening and the live scope. |
| Merge, tag, release with a smoke-tested build, the blackmetal.tech card | Done after this file; see the release notes. |

### Hand play (Noor, 1280x800, low tier, 15 fps cap)
| Session | Result | What it found (all fixed unless marked) |
|---|---|---|
| 1 | 1-1 won, stuck 20 min on removing parts | No right-click on a body, Enter after a pass, LEDs lit with the power off, W key, text size. |
| 2 | 1-1 to 1-4 won; 1-5 blocked | Clicks landed 10 to 14 px low (the pick ray stopped at board level, behind standing parts); no box to answer the exam; hand-back key under the bench panel; failure text under the panels; meter showed only "----". |
| 3 | 1-1 to 1-4 won (4, 4, 2.5, 2.5 min); 1-5 not | Confirmed (a) to (d): body right-click, wire to a leg, meter readings, hand-back key. The exam ticket did not state the network; the verdict stayed stale after edits; a wire next to a part removed the part; source legs hidden under the bodies. |
| 4 | **1-5 won, 3 stars, $11.50, about 8 min**, predictions worked by hand (V(A) 6.667 V, 0.5556 A into E2, charging) and confirmed on the meter (6.67 V) | The tray arrows changed the label but not the part in hand (fixed, flow check). Not fixed: wires onto legs hidden under tall bodies still need several tries; removing a part removes its wires silently; the marked working is not shown on the workbench ticket (the classic stall shows it). |

## Owner-concerns audit (bible 05)
| Group | Pass/Fail | Evidence |
|---|---|---|
| A game not SaaS | Mostly | The bench fills the frame; instruments, paper and keycaps instead of cards. Sigrid: the bottom band of three panels still reads as a dashboard. Site is a dark, image-led game page. |
| B soul | Pass | A night bench with the customer's own device; nothing shared with the other games beyond plumbing. |
| C realism | Mostly | PBR parts with colour bands, a PP3, a heater, a TO-92 that cracks; mipmapped textures. No side-by-side with reference photos this layer. |
| D readability | Mostly | 16 px floor; tray tiles named with value and wattage; LCD readouts. Noor still found long failure text crowding the panels at 1280x800 after the trims. |
| E controls work | Mostly | Flows drive every Workbench control the chapter needs, the title's Quit and graphics keys, and right-click through the real mouse path (`look2/dev/pick_test.gd`). No sweep of every button. |
| F scroll and input | Mostly | Wheel over the panels does not zoom; picking fixed at two sizes. Noor saw the wheel zoom jump back to the default several times; not reproduced or fixed. |
| G devices | Fail | Desktop and 1280x800 only. No gamepad, phone or real Deck in the new look. |
| H learnable | Mostly | A first-timer persona won 1-1 to 1-4 by hand from the screen. The exam needed two fixes; the hint system of the classic stall (Wren's coach) is not in the new look. |
| I logic | Pass | Engine suites, goldens, repair tests and flows green; the bench verdict now follows the board. |
| J depth | Mostly | Five chapters exist; only chapter 1 and 5-1 are in the new look. |
| K fun | Mostly | Dagny: fun 7, clarity 7, tension 5, return 5, tech-wiz 7. |
| L performance and settings | Pass | Measured on the 4090 and the iGPU; tier auto-detected, now also chosen and remembered on the title. 5-1 switching at 100 Hz costs 23 to 28 ms a frame (simulation-bound). |
| M sound | Fail | No sound in the new look. |
| N saves and quitting | Pass | Save after each job, continue next time (`look2_save_flow`); Quit on the title; testers and shots never touch the save. |
| O hygiene | Pass | CHANGELOG; README and site carry no history; privacy grep clean; shots taken at 1920x1080 and compressed. |
| P status | Pass | This file says what was not done. |
| Q cost and machine | Pass | One helper at a time; desk harness at the low tier with a 15 fps cap, slot stopped after each session. |
| R story | Mostly | Customers, their devices and words on the ticket; no story arc in the new look. |
| S cute | Not in the new look | Cute mode lives in the classic stall only. |
| U README and releases | Pass | README shots and GIFs refreshed; a release per layer. |
| V iteration effort | Mostly | Expansion (repairs, free bench) and playability (four hand plays); functionality (gamepad) not started. |

## Scores
| Tester | Scores |
|---|---|
| Sigrid (round 3, from stills) | materials 7, composition 6, UI 5, place 7, 1280x800 5, low tier 5, overall 6 |
| Dagny (from stills and clips) | fun 7, clarity 7, tension 5, return tomorrow 5, tech-wiz 7 |

## What still fails (ranked)
1. No human has played the new look; every hand play is an agent persona at 15 fps in software rendering.
2. The bench control plate, parts tray and tool rail are a dashboard band across the bottom (Sigrid). They should become objects on the bench: the supply's keys, a sorting box.
3. No sound, no gamepad and no Cute mode in the new look.
4. The burn bill does not hurt (Dagny); there is one decision per ticket.
5. Chapters 2 to 5 are classic only; 5-1 switching at 100 Hz costs 23 to 28 ms a frame.
6. Removing a part removes its wires without saying so; legs under tall bodies are hard to hit; the exam's marked working is not shown in the new look (Noor).

## Gate for 0.3 → 0.4
- A human novice plays chapter 1 in the new look and says what confused them.
- The bottom panels become bench objects; Sigrid scores UI 7.
- Sound and gamepad in the new look; Cute mode decided for the new look.
- Chapter 2 in the new look, with a repair that needs the meter before any change.
- The live simulation of 5-1 under 10 ms a frame on the desktop.
