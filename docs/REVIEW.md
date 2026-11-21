# CIRCUITS: level-1 design review (2026-11-09/10)

Reviewer: level-1 design reviewer + build planner (Opus). Inputs: PROGRAM.md (with user decisions 1-5), RESEARCH.md, the GIGAWATT skill and its
references, `DESIGN.md` (1313 lines as received; a pristine copy of it is kept outside the repo), CORE.md and the real `cobanana-core/ts` APIs
(kit, numerics, regions, i18n, solution, verify), and the `cobanana-scores` contract (`docs/API.md`, `src/verify/types.ts`, Godot addon).

**Workers used:** Sonnet ×3 (oracle re-solve, datasheet verification, nonlinear ticket re-simulation) and Haiku ×1 (price lookup). A fourth Sonnet run
(ticket refs + 60 Hz pack) was killed by the usage limit. Its partial scripts were reused, and the reviewer finished that work directly (ngspice +
python). I audited every worker result before applying it: one of the Haiku's LCSC snippets was implausible (2N3904 at "$0.97 @50"), so all prices were
classed as game values.

Verdict: **ship-ready design after the fixes below.** The physics is sound (all 57 textbook oracles reproduce; 3 had wording ambiguities and 2 had wrong
claims), and the hook is strong. The real problems were engineering-contract mismatches with the core (determinism, wall-clock live mode, state
shape, the startLevel/autosave semantics), wrong LED data driving the first two tickets, and missing user-decision items (regions, leaderboards,
strings). All of these are fixed in DESIGN.md, except the items marked *deferred*.

## 1. Findings

Severity: **B** blocker · **M** major · **m** minor. "Fixed" means DESIGN.md was edited (section in brackets).

### 1.1 User decisions applied
| # | Sev | Finding | Action |
|---|---|---|---|
| U1 | B | The India-first framing (Signal Gully, Meera Aunty, Diwali, rickshaw, chai, ₹, CEA mains) was throughout the doc | Fixed. Neutral `global` pack: Stall 14, Lantern Lane (a covered repair arcade in a fictional harbour city) and the mentor **Wren**, who keeps the notebook, the cat Rezzy and the voice. Customers renamed (Lio, Ash, Mr. Brook, Bo, Kaya, Sami, Mrs. Dale, Iris, Juno; the Lantern Night street fair). All original content is preserved verbatim as the **draft `in` pack** in Appendix A, with a name map and pack parameters [§1.2, §2.8, §5, App. A] |
| U2 | B | ₹ everywhere (wallet, cost metric, ×84 rate) | Fixed. Pack currency, US$ in `global` as integer cents; ₹ is only in the `in` pack [§2.3, §2.4, §2.6, §4.0] |
| U3 | M | IS/CEA references | Fixed. IEC 60038 (mains), IEC 60063 (E-series) and IEC 60384-14 (X2) in `global`; CEA moved to the `in` pack and marked unverified [§4.4, §10.4] |
| U4 | B | Online leaderboards missing; histograms were "simulated bot populations" | Fixed. New §11: what has a board, integer metrics, a canonical solution code on the core CB1 envelope, `verify = makeVerifier(GAME)` + cobanana-scores adapter, offline-first client via the shared Godot addon, histogram UI, and the labelled "practice population (simulated)" **only as an empty-state fallback**. Par stays fixed in level files so stars are stable offline [§2.6, §11] |
| U5 | B | Region packs (decision 5, mid-review) | Fixed. New §12: `global` (ships), `in` (draft), `na` (test-only, 120 V 60 Hz). Mains, prices, availability, names, EB sets and syllabus map are pack data; the transformer primary follows the pack; `refByRuleset`; pack-switch solvability, leak, schema, ruleset-in-code and formatting tests. Aligned with core `defineRegion`, `rulesetId` and `expectNoRegionLeaks` [§12, §2.9, §9.12] |
| U6 | M | Strings not externalised | Fixed. `src/locales/en.ts` via core `createI18n`; regional words in pack `strings`; Godot chrome via a CSV; lint + `checkLocales` + `missingKeys()` tests [§7.5] |
| U7 | m | Mains tickets: user kept them | Fixed. Strengthened safety framing: a non-skippable first-view card, a visible isolation-transformer object, a keep-out silkscreen, a "simulated mains: do not try this at home" ribbon on Bench Cards, and the Codex page unlocked first [§1.2, §10.5] |
| U8 | M | Differentiate from GRID; GRID's reviewer set a binding boundary (grid DESIGN §2.8) | Fixed. New CIRCUITS §1.8 mirrors it: CIRCUITS owns reactance as a part property, series LCR/Q/bandwidth, filters, rectifiers, the wall-wart transformer, op-amps; GRID owns feeder power factor, network transformers, 3-phase, grid resonance. No CIRCUITS ticket teaches PF correction or taps; shared phasor wording (φ = angle by which V leads I). Cast checked against GRID (Ada Moreno, Tobi Hart, Commissioner Vance, Nia), LENSCRAFT (Noor, Pip) and EQUILIBRIUM (Mara Quinn, Tomas Brandt, Victor Hale, Noor Haddad): mentor is **Wren**, and Pip/Theo/Hale were renamed Lio/Ash/Brook [header, §1.2, §1.8, §7.4] |

### 1.2 Fun critic
| # | Sev | Finding | Action |
|---|---|---|---|
| F1 | — | Minute-1 hook (torch smoke → resistor → band lock → histogram) is excellent and clip-worthy | Kept. Made measurable: §1.7 juice checklist (smoke within 40 s, CRT warm-up, camera shake, lock chime) |
| F2 | M | Chapters gated on finishing everything, with EBs on the critical path, felt like homework | Fixed. The next chapter unlocks after any 3 passes; EBs are optional; any chapter can be skipped into by passing its EB [§2.7] |
| F2b | m | 2-2 "Mystery Resistor" was a bare lab exercise | Fixed. Reframed as **Cable Fault** (a bridge measures the loop resistance to a buried short, answered as a distance, then the crew digs). Same physics [§2.8] |
| F3 | M | 40 tickets + 8 music tracks + encores + video is too much for a high-quality v0.1 | Fixed. **35 must-ship**, 5 stretch (6-4, 6-6, 7-4, 8-2, 8-3), 4 music tracks must-ship; encores, video, Hall of Smoke and cosmetics are stretch [§2.7, §10.1] |
| F4 | m | No explicit "reason for hour 2" or clip list | Fixed in §1.7 (missed stars, live histogram rank, EB skip, synth in Sandbox; four named clip moments) |
| F5 | m | Every chapter needs a physical payoff object | Fixed. Rule added in §1.7 (fan, relay, radio station through hiss, synth) |

### 1.3 Educator
| # | Sev | Finding | Action |
|---|---|---|---|
| E1 | B | The red-LED model (N 2.79, Is 1.82e-14, Rs 15 Ω) is 0.16-0.31 V too high against the Kingbright WP7113ID curve, so the 1-1/1-2 refs and the "0.41 A" smoke number were wrong | Fixed. Refit N 2.0, Is 1.19e-17 A, Rs 9.9 Ω (residuals ≤ 24 mV). 1-1: 470 Ω → 14.95 mA, direct → 0.60 A. **1-2 ref changed 120 → 150 Ω** (19.65/16.13 mA; 120 Ω now fails fresh at 23.4 mA). The tight band is flagged for calibrate-levels [§1.3, §2.8, §4.2, §7.3] |
| E2 | M | 2N7000 failure story in 5-2 was wrong ("Rds 12 Ω, 1 W"): with the verified 2.4 Ω-typ fit it saturates at ≈ 38 mA, ≈ 0.40 W, Tj ≈ 165 °C | Fixed (the ticket and the explainer template) [§2.8, §7.3] |
| E3 | M | 7-2 spec "−3 dB crossing 3.23-3.57 kHz" fails the ref if measured absolutely (3.21 kHz, because the 100 k load costs 0.4 dB) | Fixed. Defined relative to the 20 Hz gain; ref 3.545 kHz, with a thin 0.7 % margin flagged [§2.8] |
| E4 | M | 6-3 two-stage loss was −0.34 dB (one stage), it is −0.68 dB → 39.32 dB, 0.32 dB margin | Fixed. Numbers corrected; calibrate-levels must confirm, else widen the mask to 38.5 dB [§2.8] |
| E5 | M | 4-1 ripple ≈ 1.0 V was an I/(2fC) estimate; ngspice gives 0.75 Vpp. "16 V cap vents at 17.1 V" is wrong under the doc's own 1.2× instant rule | Fixed. Real numbers; the 16 V capacitor fails the rating check ("over rating", not "vented"). `na` ref 680 µF [§2.8] |
| E6 | M | 7-1 capacitive dropper has no single-capacitor answer at 120 V 60 Hz with the 9-12 mA band | Fixed. Band 8.5-12.0 mA; `global` 0.15 µF and `na` 0.22 µF each uniquely pass (ngspice) [§2.8] |
| E7 | m | OA-08 claim "15 kHz output < 60 %" is wrong (slew-limited triangle peaks at SR·T/4 = 8.33 V, 83 %) | Fixed [§9.1] |
| E8 | m | OS-02 closed-loop 31R oscillates at 634 Hz (−2.4 %), outside its ±2 % | Fixed. 634 Hz ±1.5 %, circuit wording completed [§9.1] |
| E9 | m | Wording ambiguities: OA-09 divider orientation, NC-07 sign/galvanometer, NC-08(b) missing E and shunt, CA-03 which resistor is on top, OA-04 input sides, SD-02 gain definition, CAP-01 bleed placement | Fixed (each restated unambiguously) [§9.1] |
| E10 | m | Rounding: SD-01/SC-03 Vd 0.69249 → 0.69254; SC-04 EM VBE 0.67272 → 0.67277 | Fixed [§9.1] |
| E11 | m | 2-1 "lowest power 15k/68k" → actually 15k/82k (3.355 V, 3.39 mW); 7-3 rejection 5.5/12.3 dB (not 5.4/12.1) | Fixed [§2.8] |
| E12 | m | Datasheet corrections: 1N5819 Vf 0.60 V max at 1 A (not 0.45), 1N4148 θJA 350, BZX55 rzj < 35 Ω, 2N2222A TO-92 625 mW/200 °C/W (drop "800 mA peak"), 2N7000 2.4 Ω typ, LM393 sink 6 min/21 typ mA, LM7805 Isc 2.1 A (+ the θJA table-vs-text conflict), TL072 SR 20 V/µs typ, NE5532 12 MHz/5 V/µs resolved, LM741 GBW "typical, not specified", LED IFP 160 mA, PP3 r 1.7-2.1 Ω (Duracell), CR2032 ≈ 25-40 Ω, Yageo CFR ⅙ W (no ⅛ W), Bourns 3386 0.5 W ≤ 85 °C | Fixed [§4] |
| E13 | m | Syllabus coverage: moving-coil galvanometer → ammeter/voltmeter conversion (NCERT XII ch4, a JEE staple) is absent although the game *has* meters | Deferred: a stretch ticket "Meter Maker" (shunt + multiplier on the galvanometer from 2-2) for v0.2 or M3 stretch; Codex entry added to the content list in BUILD-PLAN |
| E14 | m | Ch7 AC (reactance, RMS) comes after ch4 already uses RMS | Accepted: ch4 introduces RMS vs peak at the bench, ch7 formalises reactance. The Codex RMS page unlocks in ch4 |
| E15 | M | Nonlinear tickets re-simulated (Sonnet, ngspice): **8-5 ref ran an MCP6002 (6 V max) on 9 V** and its filter passed the −15 dB H3 spec by only 0.4 dB; **5-1 "Rb 2.2 kΩ → active region" was false** (still saturates; active needs ≥ 5.6 kΩ); **5-4 gain was 10.5 but is 9.4-9.6** (the 600 Ω source was ignored); 5-3's missing-diode failure never shows with ideal 0 V inputs; 3-2 had no topology; 6-5 100 kΩ passes but 82 kΩ is centred | Fixed: 8-5 Zener-fed 5.1 V op-amp rail, 12k + 10k trimmer, 16k/5.1k + 100 nF filter (−16.8 dB); 5-1 text; 5-4 band 8.5-11 + real numbers; 5-3 input low 0.4 V condition; 3-2 topology + ref 47k + 330 nF; 6-5 ref 82 kΩ [§2.8] |

### 1.4 Lead engineer
| # | Sev | Finding | Action |
|---|---|---|---|
| L1 | B | Determinism: the doc accepted `Math.exp` drift with 1e-9 waveform goldens. Core mandates `dmath`, and leaderboard verify compares metrics bit-for-bit | Fixed. dmath everywhere, exact goldens including waveforms, a Node 18 + Node 22 golden job [§3.11, §9.8] |
| L2 | B | Live mode `advance(maxMs)` and thermal "wall time × speed" made results depend on device speed | Fixed. `advance(frames)` with a fixed sim quantum per frame and a fixed thermal step per frame; Godot only chooses the count [§3.9, §3.11, §8.4] |
| L3 | B | GameState used `Float64Array` (not plain JSON) and kept derived live data loosely | Fixed. `NodeState extends BaseState`, plain arrays, capped undo/redo/failure log, a 64 KB size budget, a compile memo outside the state (tested equal with the cache off), slim `snapshot` [§8.3] |
| L4 | B | Core `startLevel` wipes progress and freezes the state on win; core autosaves on every `tick`, which at 30 Hz would write the save 30×/s | Fixed. The campaign uses `openTicket` with `level = null`; the same setup is registered as core Levels for `checkAllLevels`/verify; live frames are a game action (not `tick`); autosave is debounced on edits/bench/pause [§8.3] |
| L5 | M | Phone budget understated: ⅔n³ at n = 30 is 18 k flops (not 9 k); 25 k steps × Newton × n = 64 dense LU blows the 5 s Pixel budget | Fixed. MNA dim ≤ 48 in campaign, a CIRCUITS-side flat `Float64Array` LU (core LU allocates `number[][]`), a `bench-cost` flop gate (≤ 1.5e9 per bench) on ref + worst novice board, a Pixel factor measured in M2 [§3.11] |
| L6 | M | Stretch tickets 8-2 (≈ 40 k steps) and 8-3 (≈ 200 k steps) exceed the 25 k step cap | Fixed. Averaged-model pre-charge (8-3) or dt = T/100; both are stretch anyway [§3.11] |
| L7 | M | The Monte Carlo was "asynchronous" in a synchronous engine | Fixed. Chunked `runTolerance(k)` with progress in the state; the seed is derived from (ruleset, ticket, board hash) so client and server agree [§3.11, §8.4] |
| L8 | M | The solution code was "base64 netlist + layout" with no versioning, ruleset or canonical form | Fixed. Core CB1 envelope + canonical two-action replay (`loadBoard`, `runBench`); all action arguments quantised on entry so a board has exactly one encoding [§8.4, §11.2] |
| L9 | M | Leaderboard metrics must be bit-exact; floats like mW and % invite drift | Fixed. Integer metrics (cents, µW, 0.01 %, pads², counts); no Monte Carlo in verify; verify ≤ 1000 ms per must-ship worst board [§11.1, §11.3] |
| L10 | m | Level schema had literal names/briefs and no ruleset hooks | Fixed. `titleKey`/`briefKey`/`customer` ids, `refByRuleset`, `mainsDependent`, `leaderboard`, `scope` [§2.9] |
| L11 | m | Leaderboard queue proposed inside engine state | Fixed. It lives in the shared Godot `cobanana_scores` addon; QA uses `CB_SCORES=mock` [§11.4, §6.5] |
| L12 | m | Core `makeVerifier` has no cooperative CPU budget | Deferred to core (request logged): optional `budget()` in `VerifyOpts`. Mitigated by the 1000 ms perf test |
| L13 | m | Prices unverifiable by scripted fetch (403/timeouts) | Decided: prices are labelled game values until a browser-based data-entry task (BUILD-PLAN M3-D2); a test enforces relative price orderings; physics parameters must be `verified` |

### 1.5 Deferred / open (not fixed in the doc)
- Upgrading the `in` pack's NCERT/JEE citations needs the physical books (or a verified source); the pack is draft-only.
- CEA mains tolerance for the `in` pack is unverified (likely +10/−6 %).
- Colour-LED (yellow/green/blue/white) Vf data is unverified, so those LEDs are Sandbox-only until verified.
- Yageo MFR derating was not re-fetched (the CFR knee was verified).
- Thermal time constants τ_th stay engineering estimates (Codex "estimate").
- 1N4007/1N4148/2N3904 SPICE model lines are from recall (ratings verified); the M1 data task re-sources them from vendor model files.

## 2. Oracle spot-check

**Reviewer's own computation** (python3, independent of the workers): 46 assertions across 27 oracles. All agree within tolerance.
**Sonnet re-solve**: all 57 oracles, about 195 comparisons. 2 mismatches (OA-08, OS-02) and 7 wording ambiguities were found and fixed.

| Oracle | Quantity | Doc | Reviewer | Rel. err | OK |
|---|---|---|---|---|---|
| NC-04 | V(A); I into E2 | 6.6667 V; 0.55556 A | 6.66667; 0.555556 | 5e-6 | ✓ |
| NC-06 | V(A), V(B), Ig, Is | 6.1538, 5.3846, 0.076923, 0.84615 | identical to 5 s.f. | ≤ 8e-6 | ✓ |
| NC-09 | cube Req | 5.0000 Ω | 5.0000 | 2e-16 | ✓ |
| NC-10 | φ-terminated ladder Req | 1.6180340 | 1.6180340 | 7e-9 | ✓ |
| CAP-05 | τ; V(τ) | 23.333 ms; 5.0570 V | 23.3333; 5.05696 | 1e-5 | ✓ |
| CAP-07 | I(50 ms) | 0.73576 A | 0.735759 | 2e-6 | ✓ |
| AC-04 | \|Z\|, lead, VC | 50 Ω, 53.130°, 160 V | 49.9996, 53.1297, 159.999 | 9e-6 | ✓ |
| AC-05 | f0, Q, BW | 17.684 Hz, 45.045, 0.39258 Hz | 17.6839, 45.045, 0.392582 | 7e-6 | ✓ |
| TR-03 | ζ, overshoot, t_pk | 0.31623, 35.092 %, 1.0472 ms | 0.316228, 35.092, 1.0472 | 7e-6 | ✓ |
| TR-04 | −3 dB edges; \|V(f0/2)\| | 4953.97/5113.13 Hz; 0.02108 V | 4953.97/5113.13; 0.0210772 | 1.3e-4 | ✓ |
| FI-02 | \|H\|, phase at 500 Hz | 0.29972, 72.56° | 0.299717, 72.5594 | 1e-5 | ✓ |
| FI-03 | Sallen-Key LP fc, Q | 1125.4 Hz, 0.70711 | 1125.4, 0.707107 | 5e-6 | ✓ |
| FI-04 | Q, \|H(2f0)\| | 2.000, 0.31623 | 2.0, 0.316228 | 7e-6 | ✓ |
| SD-01 | Vd, Id | 0.69249 V, 4.3075 mA | **0.692544**, 4.30746 | 7.7e-5 | ✓ (rounded fix) |
| SC-01 | Vavg half-wave / bridge (0.7 V model) | 2.8409 / 5.0287 V | 2.8409 / 5.02869 | 2e-6 | ✓ |
| SC-04 | textbook Av; EM VBE, IC | −232.1; 0.67272 V, 2.0048 mA | −232.09; **0.672772**, 2.00482 | 8e-5 | ✓ (rounded fix) |
| SD-02 | IC, VCE, gain | 1.3212 mA, 7.7590 V, −112.44 | 1.32113, 7.75918, −112.43 | 1.1e-4 | ✓ |
| CA-03 | Vth, Rth | 0.95238 V, 2.3810 kΩ | 0.952381, 2.38095 | 2e-5 | ✓ (orientation clarified) |
| OS-01 | 555 f | 6870.0 Hz | 6869.98 | 3e-6 | ✓ |
| OS-02 | f0 = 1/(2π√6 RC) | 649.75 Hz | 649.747 | 4e-6 | ✓ (closed-loop claim fixed) |
| OS-03 | ΔIL, ΔV | 0.2250 A, 2.81 mV | 0.2250, 2.8125 | 9e-4 | ✓ |
| OA-09 | Schmitt thresholds | ±4.800 V | ±4.800 (15k out→+, 10k +→GND) | 0 | ✓ (wording fixed) |

Nonlinear tickets re-simulated by a Sonnet worker in ngspice and audited by the reviewer: 3-2, 5-1, 5-3, 5-4, 6-5, 8-5 (all fixed per E15).
Ticket references re-checked by the reviewer: 1-1, 1-2 (changed), 1-3, 1-4, 2-1 (fixed), 2-3, 3-1 (probe loading 1.080 s ✓), 3-3 (0.2747/0.2640 ms ✓),
4-1 (ngspice, fixed), 4-2, 4-3 (310/137.5/102.5/88.75 °C ✓), 4-4 (3.3008 V ✓), 6-3 (fixed), 6-6 (2.038 Vpp ✓), 7-1 (ngspice, both packs), 7-2 (fixed),
7-3 (fixed), 7-4 (fc 294 Hz, Q 0.693, −30.8 dB at 50 Hz ✓, 0.8 dB margin), 8-1 (2.061 Hz, 65.7 % ✓), 8-3 (ΔI 0.265/0.583 A ✓). EB cards 1-5, 2-4, 3-4,
4-5, 5-5, 6-7, 7-5 and 8-4 were recomputed by hand and all are ✓.

## 3. Decisions made by the reviewer (binding for the build)
1. `global` mains = 230 V 50 Hz ±10 % conditions; `na` (test-only) = 120 V 60 Hz ±10 %; the transformer primary follows the pack.
2. 35 must-ship tickets, 5 stretch; 4 music tracks must-ship.
3. Chapter unlock = any 3 passes; EBs optional; "prove it" skip via the EB.
4. Leaderboards on build tickets only (canonical Learner hidden values); no boards for EB, encore, Engineer seeds, assisted passes. Integer metrics. Par fixed in level files.
5. Solution code = core CB1 envelope with a canonical `[loadBoard, runBench]` replay; `verify = makeVerifier(GAME)` + scores adapter.
6. Live sim = `advance(frames)` game action with fixed quanta; the core `tick` is not used; autosave is debounced by Godot.
7. CIRCUITS owns a flat `Float64Array` LU for DC/transient; core cLU for AC; core `singularityReport` for explanations.
8. MNA dim ≤ 48 in the campaign; `bench-cost` flop gate ≤ 1.5e9 per bench; verify ≤ 1000 ms per worst board.
9. Red LED model N 2.0, Is 1.19e-17 A, Rs 9.9 Ω until data entry refits it (a test pins 1-1/1-2 margins).
10. Prices are game values (`game-estimate-2026`) until browser data entry; price orderings are tested.
11. 2-2 becomes Cable Fault; 7-1 band 8.5-12.0 mA; 7-2 −3 dB is relative; 1-2 ref 150 Ω; 5-4 band 8.5-11; 3-2 ref 47k + 330 nF; 6-5 ref 82 kΩ; 8-5 op-amp on a Zener 5.1 V rail.
12. CIRCUITS/GRID boundary per grid DESIGN §2.8 (CIRCUITS §1.8); cast names unique across the five games.

## 4. Requests to other directors
- **Core**: optional cooperative `budget()` in `VerifyOpts` (not blocking). Expose `luDecompose` on flat arrays if other games want it (CIRCUITS will carry its own otherwise).
- **cobanana-scores**: register `node-circuits` metric specs (`cost` US$ cents lower, `parts` integer lower, `power_mw` lower [µW integer, displayed as mW], `efficiency_pct` higher [0.01 % units], `area` integer lower, `accuracy_ppm` lower).
- **GRID**: agree the Codex cross-links (transformer, RMS, power factor) and keep the scale split (component vs system).
