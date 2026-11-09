# NODE: build plan (v0.1)

> For the NODE build director (Opus, level 1). Implementation and serious testing go to Sonnet workers; volume work goes to Haiku.
> Spec: `DESIGN.md` (authoritative, revised by the review). Review: `REVIEW.md`. Contract: `PROGRAM.md` (user decisions 1-5), `cobanana-core/CORE.md`,
> `cobanana-scores/docs/API.md`.
> Repo: `/home/ixaxaar/src/ORGS/cobanana/node-circuits` · title NODE · app id `in.ixaxaar.cobanana.node` · port 47904 · Xvfb :260-:279
> (desk testers a..h :261-:268, shot1 :270, ph :271, titles :272, tour :273) · phone `flock …/.locks/phone.lock`, pad `…/.locks/pad.lock`.

## Rules for every task
- **Brief template** (the director fills it in for each worker):
  - Files to read: always the DESIGN.md sections the task names, CORE.md, and the `src/` files it touches.
  - The exact deliverable, and the **tests to write first**.
  - How to verify (`pnpm typecheck && pnpm test -- <pattern>`, Godot commands).
  - What to return: a diff summary, test counts and open questions.
  - Workers do not commit. The director reviews every diff, audits the physics and units, and commits with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **TDD**: the test file lands red, then the implementation turns it green, in the same task. Never loosen a tolerance or regenerate a golden to make a test pass.
  No `Math.exp/log/sin/pow/…` and no `**` in `src/` (the inherited determinism guard enforces this; use `dmath`).
- **Sizing**: one task is one worker, about 300-800 changed lines in one module family. Lanes run in parallel only when their files are disjoint.
- **Hardware**: only Gate A, M2 exit, phone QA and release touch the phone (≤ 30 min holds). Only one pad tester runs machine-wide.
- **Status**: append to `status/node-circuits.md` at each gate and milestone exit, with evidence (test counts, screenshot paths, Pixel numbers).
- **Must-ship first**: the 35 must-ship tickets pass every M5 gate before any stretch ticket (6-4, 6-6, 7-4, 8-2, 8-3) is built.

Model key: **S** = Sonnet, **H** = Haiku, **O** = the director (Opus).

---

## M0: scaffold from core (half a day)
| task | model | deliverable | acceptance |
|---|---|---|---|
| M0-1 | O | `cobanana-core/scaffold/new-game.sh node-circuits NODE in.ixaxaar.cobanana.node 47904`; set `qa.env` (`CB_DISP_BASE=260`); keep the template tank as a smoke fixture until M1 replaces it | `pnpm typecheck && pnpm test` green; `CB_SMOKE=1 godot --headless --path godot` prints `SMOKE OK`; first commit |
| M0-2 | S | Skeleton: `src/regions/{index,global,in,na}` (core `defineRegion`; `global` shipping, `in` draft with the Appendix A strings and `leakMarkers`, `na` test-only); `src/locales/en.ts`; the `NodeState` type (§8.3) with `newGame`, empty actions, a `snapshot` override; the `regions.test.ts` pattern from the template | Template region tests pass with three packs; leak test green; `state.size.test.ts` scaffolded |

## Gate 0: week-1 go/no-go spike (in parallel with M1 lane A; no M2 work starts until it is GO)
### Gate A: MNA on the Pixel
| task | model | deliverable |
|---|---|---|
| GA-1 | S | `src/sim/mna/lu.ts` flat `Float64Array` LU with partial pivoting + back-substitution + refactor-in-place, tested against core `solve` on 2000 random matrices (n 2-128) to 1e-12 relative; a microbenchmark `scripts/bench-lu.ts` (n = 8, 16, 24, 32, 48, 64; DC Newton with 3 diodes; 25 k TRAP steps of an RC ladder with n = 24, and of a nonlinear bridge rectifier with n = 12) |
| GA-2 | S | `advance(frames)` proto: a live frame that runs k transient steps of the bridge rectifier and returns a 512-point scope window over the bridge; a Godot spike scene drawing the trace with the phosphor shader at 60 fps and requesting frames at 30 Hz |
| GA-3 | O | Pixel run under `phone.lock` (`core/qa/buildapk.sh INSTALL=1`, 60 s plus a 10 min soak); the director reads the numbers and commits `docs/perf/pixel-factor.json` |

**Pass (Pixel 9a, after warm-up):**
- A 25 k-step nonlinear bench at n = 12 in ≤ 1.5 s.
- A dense LU at n = 48 in ≤ 0.25 ms.
- A live frame at the bridge-rectifier quantum in ≤ 4 ms p95.
- Bridge round trip p95 ≤ 20 ms; 60 fps p95 with the trace drawing.
- No thermal slowdown over 10 min.

**Fail →**, in order: lower the campaign MNA cap to 40, then add a banded/sparse solve for ladder-like boards, then increase `live.frameSim` and show "sim ×k".

## M1: engine core, TDD (oracles and properties first)
Exit: all **57 oracles** (≈ 220 assertions) green; 16 property families green (~12 000 cases); the convergence suite ≥ 95 % plain-Newton and 100 % solved-or-explained;
15 ngspice reference CSVs matched; the bench is a pure function; determinism and golden harness green on Node 18 and 22.

| lane | task | model | files | tests first | acceptance |
|---|---|---|---|---|---|
| A (solver) | M1-A1 netlist + union-find + compile | S | `sim/board/*`, `sim/mna/{netlist,compile}.ts` | the SPICE-like card parser; pads→nodes on 30 hand boards; floating-island detection | boards compile; the compile memo is equal with the cache on and off |
| A | M1-A2 linear stamps + DC solve + topology checks | S | `sim/mna/{stamp,topology,op}.ts`, `devices/{r,vsrc,isrc,battery,bench,meter}.ts` | **oracles NC-01..10, CA-01..06**; topology explainer cases (§3.10) | oracle tolerance 0.1 %; KCL/KVL/Tellegen/superposition/reciprocity/Thevenin properties |
| A | M1-A3 transient TRAP/BE + breakpoints + companions | S | `sim/mna/tran.ts`, `devices/{c,l}.ts` | **CAP-01..07, TR-01..03**; order of accuracy (TRAP ≈ 4×, BE ≈ 2×); energy; DC limit; charge conservation | fixed step, BE restarts at breakpoints |
| A | M1-A4 AC (core cLU) | S | `sim/mna/ac.ts` | **AC-01..07, TR-04, FI-01, FI-02, FI-04**; AC vs transient property; passivity | phase ±0.3° |
| B (devices) | M1-B1 diode/LED/Zener/Schottky + pnjlim + gmin/source/ptran homotopy (core `solveRobust` + NODE limiter) | S | `devices/diode.ts`, `sim/mna/op.ts` | **SD-01, SC-01, SC-02, SC-03**; device-consistency property; the convergence suite (§9.4) | the exponential guard; never hangs (2 s wall guard) |
| B | M1-B2 BJT EM-lite + Darlington, MOSFET Level-1 + fetlim + body diode | S | `devices/{bjt,mosfet}.ts` | **SC-04, SD-02, SD-03**; ngspice refs 6, 7, 8, 13 | |
| B | M1-B3 macros: op-amp, comparator, 555, regulators, logic pin, relay, fuse, NTC, pot, slide wire, transformer | S | `devices/*` | **OA-01..09, FI-03, OS-01, NC-07/08 (slide wire), AC-07**; regulator Iq/min-load emergence (4-4); thermal shutdown cycling | event mechanism with crossing refinement (§3.5) |
| C (bench) | M1-C1 spec engine: level/band/metric/mask/rating/safety/predict, DFT/THD, periodic settle | S | `sim/bench/*` | the band tube on square edges; THD of known Fourier series; mask edges; crossing count with hysteresis | `runBench` is pure and deterministic |
| C | M1-C2 thermal + ratings + smoke + failure behaviour | S | `sim/{thermal,ratings,smoke}.ts` | steady state Ta + Pθ; 2.6× resistor smoke; every instant-failure rule; smoked parts refused | |
| C | M1-C3 explainers + i18n keys | S | `sim/explain.ts`, `locales/en.ts` | every §7.3 template filled from a fixture state; `checkLocales`; the literal-string lint | |
| D (data) | M1-D1 part catalogue (physics only) | S | `data/parts/*.ts` | `data.provenance.test.ts` (campaign parts `verified: true` with source + url + accessed); the LED fit N 2.0 / Is 1.19e-17 / Rs 9.9; the REVIEW E12 corrections; re-sourced 1N4148/1N4007/1N5819/2N3904 model lines from vendor SPICE files | every [R] in §4.2-4.3 resolved or Sandbox-only |
| D | M1-D2 ngspice reference decks + CSVs | S | `scripts/ngspice-ref/*.cir`, `tests/ref/*.csv` | the comparison harness | 15 refs within 0.5 % / 0.1 dB |
| E (harness) | M1-E1 determinism + goldens + Node 18 job | S | `src/trajectory.golden.test.ts`, `.github/workflows` | bit-exact waveform hashes; a CI matrix on Node 18.20 and 22 | identical hashes on both |
| E | M1-E2 `bench-cost` + perf tests | S | `scripts/bench-cost.ts`, `bench.cost.test.ts` | the flop estimate vs measured time on 10 boards (within 2×) | the gate wired into CI |

Parallelism: A1 → (A2 ∥ B1 ∥ D1 ∥ D2) → (A3 ∥ A4 ∥ B2) → (B3 ∥ C1) → (C2 ∥ C3 ∥ E1 ∥ E2). About 16 tasks.

## M2: vertical slice: chapter 1 "First Light" (5 tickets) + 4-1 Wall Wart, fully playable on desktop, phone and pad
Why 4-1 is in the slice: it proves mains region-pack parameters, the safety card, the periodic settle, the thermal camera and the `na` refByRuleset path early.

| task | model | deliverable | acceptance |
|---|---|---|---|
| M2-1 | S | Game wiring: actions §8.4 (board, wire, values, probe, instruments, power, `advance`, bench, undo/redo, hint, openTicket, `loadBoard`, `exportSolution`), queries §8.5, the campaign-vs-Level split (§8.3), debounced autosave hooks | engine tests: teaching failures, save round trip, the protocol; `checkAllLevels` passes for the slice; personas idle/expert/novice/smoker/monkey with zero invariant violations |
| M2-2 | S | Level files 1-1…1-5, 4-1 (+ coach for ch1, hints, explainers, EB 1-5 card) + `scripts/calibrate-levels.ts` (topology grammar, search, population → `data/par/*.json`, margin report) | ref passes ★1+★2; an independent pass found; idle fails; band margins reported (1-2's 0.35 mA margin is reviewed by the director) |
| M2-3 | S | `src/verify.ts` + scores adapter + `board-code.ts` + tests (§9.12) | verify(ref) equals the in-game metrics (Object.is); bundle test (no Node built-ins); ≤ 1000 ms |
| M2-4 | S | Godot bench world: perfboard, parts drawn in code, wires, the node-voltage tint, current dots, heat glow, smoke FX, the LED bloom | `CB_LEVEL=1-1 CB_BOARD=<ref> CB_POWER=1` screenshot shows the lit LED + dots; `CB_SMOKEDEMO=led` shows smoke |
| M2-5 | S | Scope (CRT shader, band ribbon, lock), DMM, ticket card, bench report with histograms (wired to `CbScoresClient` with `CB_SCORES=mock`, plus the fallback), the Lane-map ticket list, the mains safety card, thermal overlay | report screenshots online, offline-cached and empty-fallback (labelled) |
| M2-6 | S | Input parity for the slice: mouse/kb, pad (radial picker, probe mode, value wheel), touch (ghost offset, loupe, long-press wire), Android Back | parity matrix test rows for every §6.2 interaction used by ch1 |
| M2-7 | O+S | Device pass: desktop 1080p + 1280x800 handheld + Pixel (`phone.lock`) + virtual pad (`pad.lock`); the director plays 1-1 to 1-5 and 4-1 on each | evidence: 3 screenshot sets; the Pixel bench time of 4-1 ≤ 5 s; live frame ≤ 4 ms p95; a 30-second clip of 1-1 smoke→fix |

**M2 exit**: the slice is playable start to finish on desktop, Deck layout + pad, and the Pixel. Smoke and audit are clean at all 7 resolutions for the slice
screens. The `global`/`in`/`na` switch tests pass for the slice levels. A mini fun-critic run (Opus) on the slice says "hook lands", or the director fixes it before M3.
About 7 tasks.

## M3: full campaign and content (35 must-ship, then stretch)
| lane | task | model | deliverable |
|---|---|---|---|
| L (levels) | M3-L1…L6 | S ×6 | one task per chapter 2, 3, 4 (rest), 5, 6, 7+8: level files, coach first-use steps, hints, explainers, EB card (global set), calibrate-levels run, margin report; the 3-2 debounce topology fixed per REVIEW addendum |
| L | M3-L7 | S | encore/hidden-param plumbing (Engineer seeds for 1-4, 2-2, 2-3) and the tolerance Monte Carlo `runTolerance(k)` + ★3 for every build ticket |
| D (data) | M3-D1 | H | bulk data entry of passive families (E12/E24 × ratings, capacitors, inductors) from the verified family rules; the director spot-checks 10 % |
| D | M3-D2 | S (with browser skill) | **prices through a browser** (DigiKey/Mouser/LCSC), qty 100, with url + date, into `regions/global/data.ts`; whatever cannot be verified stays `game-estimate-2026`; the price-ordering test |
| R (regions) | M3-R1 | S | full `in` draft pack (Appendix A strings, ₹ formatting, the NCERT/JEE syllabus map, the EB set as "NCERT-style (adapted)"), the `na` pack, the `refByRuleset` for 4-1 and 7-1; `regions.switch.test.ts` + leak + schema over all 35 tickets |
| C (codex) | M3-C1, C2 | S ×2 | 48 Codex entries (24 each) with mini interactive plots, syllabus tags from the pack, "What we simplified" pages; + "Moving-coil meters" (REVIEW E13) as an entry |
| U (UI) | M3-U1 | S | Bode plotter, supply/generator, frequency counter + speaker monitor (circuit audio for 8-1/8-5), the exam card + prediction entry + reality check |
| U | M3-U2 | S | Sandbox (draw-your-own band, share codes), pause, settings incl. the online-scores row (addon), Codex screen, end card |
| X (stretch, only after M5 round 1 is green on must-ship) | M3-X1…X5 | S ×5 | 7-4, 6-6, 6-4, 8-2 (oscillator kick), 8-3 (PWM driver + averaged pre-charge) |

**M3 exit**: 35 tickets. `checkAllLevels` problems = `[]` in all 3 packs. The novice persona passes ≥ 80 % of ch1-2 and ≥ 50 % of ch3-4. No ticket is
below a 20 % novice pass. Every explainer has fired at least once across personas. Verify samples are committed for 27 build tickets. About 16 tasks (+5 stretch).

## M4: polish (audio, juice, Codex, settings, leaderboard client)
| task | model | deliverable |
|---|---|---|
| M4-1 | S | Juice checklist §1.7 items 1-4 (CRT warm-up, shake, star stamps, coin roll, red failing samples), reduced-motion variants |
| M4-2 | S | Audio: the sfx set (§5.5), 4 music tracks with varied structure (adaptive drum drop on bench, lock filter sweep), ambience bed, mains-hum pitch from the pack; `AUDIO OK` test |
| M4-3 | S | Leaderboard client integration: first-run notice, nickname, delete-my-data, queued chip, the top-10 view, the "Early days: N players" state; `CB_SCORES=mock` tests for offline→online transitions |
| M4-4 | S | Bench Card PNG with QR (solution code), the "do not try this at home" ribbon on mains tickets |
| M4-5 | S | Accessibility: the viridis voltage map, text boost, trace thickness, colour-not-alone audit |
| M4-6 | H | Screenshot tour of every screen × theme × layout (`tour.sh`), reading each and reporting clipping |
| M4-7 | S | Lane-map art (or the cut-line paper-slip list), title bench animation, Rezzy idle loops, the `godot/regions/global` asset slots |

**M4 exit**: smoke and audit clean at 1280x720, 1280x800, 1920x1080, 2560x1440, 3440x1440, 3840x2160 and the phone with insets. Audio test OK.
The four §1.7 clips are recorded. About 7 tasks.

## M5: QA rounds (PROGRAM rule 8; briefs from the skill's `references/tester-prompts.md`, adapted to NODE)
Round 1 (in parallel; each tester has an isolated display and `XDG_DATA_HOME`, uses `CB_SCORES=mock`, and must Read every screenshot):
| tester | model | surface | NODE-specific checks |
|---|---|---|---|
| novice | S | Learner, 1920x1080, ≥ 150 actions | first-minute smoke, coach, hint ladder, does Thevenin (2-3) or L/R (3-3) "land" |
| form factors + settings | S | 3440x1440, 2560x1080, 4K, 1366x768, 1280x720 | scope readability, tray wrap, every setting persists |
| phone | S | Pixel (`phone.lock`) | long-press wire, the ghost offset, the loupe, scope drawer peek, Back semantics, bench time |
| pad | S | 1280x800 handheld, virtual pad only (`pad.lock`) | the radial picker, probe mode, value wheel, no focus traps |
| monkey | H | desktop, ≥ 250 actions + long soaks | `SCRIPT ERROR`, NaN in readouts, frame spikes, smoke spam |
| code reviewer | S (read-only) | source | input parity matrix, determinism leaks, verify purity, region leaks, i18n literals, save safety |
| **fun critic** | O | desktop + phone | hook in minute 1, hour 2, homework feel, clip-worthiness (DESIGN §9.10 hypotheses) |
| **educator** | O | desktop | every ticket's physics, units, honesty of simplifications, syllabus coverage, would a JEE/A-level teacher set the EBs |

Then: fix in batches, re-run the suites and soaks, then Round 2 "verify these N fixes, then play for real". Critique goes to `docs/CRITIQUE-0.1.md`. About 10 tester runs + 4-6 fix tasks.

## M6: release
| task | model | deliverable |
|---|---|---|
| M6-1 | O | Version bumps (package.json, project.godot, export presets), CHANGELOG, README with fresh 4K-downsampled screenshots, the Pages site |
| M6-2 | O | Register the NODE verifier bundle in `cobanana-scores` (`gameVersions: ['0.1.0']`, samples), and run its registry test |
| M6-3 | O | Tag → CI release (Linux/Windows/macOS), the signed APK by hand + SHA256SUMS, then verify the assets |
About 3 tasks.

---

## Testing matrix (targets at v0.1)
| layer | what | target | where |
|---|---|---|---|
| unit | every `sim/` module, actions, queries | ≥ 600 tests; `tsc --noEmit` clean | `src/**/*.test.ts` |
| oracle | 57 textbook problems (book/chapter in titles) + ≈ 25 ticket refs | ≈ 245 assertions, tolerances per §9.1 | `src/sim/oracles/` |
| SPICE reference | 15 ngspice decks | ≤ 0.5 % range / 0.1 dB / 0.5° | `tests/ref/` |
| property / fuzz | 16 families (§9.3) | ~12 000 seeded cases, 0 failures | `src/sim/**/*.prop.test.ts` |
| convergence | §9.4 suite + ref boards + 20 novice boards per ticket | ≥ 95 % plain Newton, 100 % solved or explained, ≤ 2 s each | `convergence.test.ts` |
| golden | 10 tickets × expert/novice/smoker | bit-exact, Node 18 + 22 | `trajectory.golden.test.ts` |
| persona | idle, expert, novice, cheese-seeker, smoker, monkey × 35 tickets × 3 modes × 5 seeds | 0 invariant violations; idle fails all build tickets; expert ★2 everywhere | `src/playtest/` |
| solvability | `checkAllLevels` + calibrate-levels independent pass | `problems = []` in `global`, `in`, `na` | `levels.test.ts`, `regions.switch.test.ts` |
| cheese | 17 exploit families × applicable tickets | 0 passes, each with a named reason | `cheese.test.ts` |
| verify / codes | §9.12 | ref codes verify exactly; ≤ 1000 ms; bundle pure; 10 000 fuzzed codes never throw | `verify*.test.ts`, `board-code.test.ts` |
| regions / i18n | leak, schema, formatting, `checkLocales`, literal lint | 0 leaks, 0 missing keys | `regions.*.test.ts`, `i18n.test.ts` |
| perf | `bench-cost` gate; Pixel factor; live frame | ≤ 1.5e9 flops/bench; Pixel bench ≤ 5 s; live ≤ 4 ms p95 | CI + Gate A/M2-7 |
| smoke | `CB_SMOKE=1` every screen × theme × layout + every ticket's ref board powered | `SMOKE OK` | CI |
| layout audit | `CB_AUDIT=1` at 7 resolutions + phone insets | 0 squeezed/overflowing | `ph.sh`, CI |
| phone | Pixel session per M2-7 and M5 | no blockers; bench and frame budgets met | `phone.sh` |
| pad | virtual pad, handheld | every interaction operable; no focus traps | `padrun.sh` |
| monkey | Haiku | ≥ 250 actions, 0 script errors | M5 |
| fun | Opus fun critic | the §9.10 hypotheses hold, or are fixed and re-verified | `docs/CRITIQUE-0.1.md` |
| educator | Opus educator | 0 physics errors open; EB cards endorsed | `docs/CRITIQUE-0.1.md` |

## Worker-task estimate
| milestone | tasks (S / H / O) |
|---|---|
| M0 | 2 (1 S, 1 O) |
| Gate A | 3 (2 S, 1 O) |
| M1 | 16 (16 S) |
| M2 | 7 (6 S, 1 O+S) |
| M3 | 16 must + 5 stretch (19 S incl. stretch, 1 H, data spot-checks by O) |
| M4 | 7 (6 S, 1 H) |
| M5 | ~16 (6 S testers + 1 H monkey + 2 O critics, ×2 rounds partly; 4-6 S fix tasks) |
| M6 | 3 (O) |
| **total** | **≈ 70 worker tasks (≈ 60 Sonnet, ≈ 4 Haiku, ≈ 8 director-run)** |

## Risks the director watches
1. **Convergence on player nonsense** → the convergence suite and smoker/monkey personas from M1; never ship an un-explained solver failure.
2. **Phone budget** → Gate A before M2; the `bench-cost` CI gate; lower the MNA cap before cutting content.
3. **Bit-exact verify drift** (client vs server) → `exportSolution` uses `verify` itself; the Node 18/22 golden job; the scores registry test on samples.
4. **Tight bands** (1-2, 6-3, 7-2, 7-4 margins < 1 dB / 2 %) → the calibrate-levels margin report reviewed by the director; widen per REVIEW notes rather than tune refs to luck.
5. **Data provenance** (prices, LED fits, model lines) → the provenance test; browser data entry (M3-D2); Sandbox-only for unverified parts.
6. **"SPICE GUI" feel** → the M2 mini fun-critic gate; the world view always visible; the juice checklist.
7. **Region seam rot** → switch/leak tests on every commit, not only before release.
