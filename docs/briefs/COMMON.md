# Rules for every CIRCUITS worker (read first)

Repo: this repository (CIRCUITS, formerly CIRCUITS; slug `node-circuits`). Core is the submodule `core/` (read-only for you).

Read before coding:
- the program contract `PROGRAM.md` (private program repo) (contract; "User decisions" are binding: neutral global setting, US$, region packs, all
  player-facing strings externalised, pure `verify`).
- `core/CORE.md` (how a game uses the core: state rules, dmath, regions, i18n, solution codes).
- `docs/DESIGN.md` sections named in your brief (the spec; authoritative), `docs/BUILD-PLAN.md` for your task row.
- The contract types: `src/data/parts/types.ts` (catalogue), `src/sim/board/types.ts` (board). Do not change them without saying why in your report.

Hard rules:
1. **TDD.** Write the test file first (oracle / property / unit), run it red, then implement until green. Never loosen a tolerance, never
   delete or skip a failing test to get green, never regenerate goldens (`GOLDEN_UPDATE`) unless the brief says so.
2. **Determinism.** In `src/`: no `Math.exp/log/sin/cos/tan/pow/atan2/tanh/sinh/cosh/hypot/cbrt/expm1/log1p/log10/log2/asin/acos/atan`, no `**`,
   no `Math.random`, no `Date.now`, no module-level mutable state (except a documented pure memo). Use `import { dmath } from '@core/numerics'`.
   `Math.sqrt/abs/floor/ceil/min/max/round` are fine. `src/determinism.test.ts` enforces this. Iterate arrays, not Map/Set insertion orders that
   depend on input order in solver paths.
3. **Units**: SI in the engine (V, A, Ω, F, H, s, W; temperatures in °C at the boundary). Data values are numbers (`4.7e3`), never `"4k7"`.
4. **No hard-coded player-facing strings** in `src/`: use i18n keys (`t('key', vars)` from `src/i18n.ts`). Simulator modules return
   `{ key, vars }` and their English lives in `src/locales/sim.en.ts`; part names in `src/locales/parts.en.ts`. No currency symbols,
   place or person names in rule code (those are region-pack data).
5. **Data provenance**: every physics number has a source (datasheet doc + url + accessed date) or is marked as an estimate. Never invent data.
6. Stay inside the files your brief lists. If you must touch another file, keep the change minimal and list it in your report.
7. Verify with `cd <repo root> && pnpm typecheck && pnpm test` (all tests, not just yours, must stay green).
8. **Do not commit** (the director reviews and commits). Do not push. Do not edit `core/`. If you find a core bug, describe it (problem, repro,
   proposed fix) in your report and work around it locally behind the same interface.
9. Shell: never `pkill -f` a pattern that appears in your own command line (use the bracket trick `pkill -f "[X]vfb :26x "`). Only use Xvfb
   displays your brief gives you (CIRCUITS owns :260-:279). Never touch the phone or the virtual pad unless your brief says so (locks in PROGRAM.md).
   Foreground `sleep` is blocked: poll with `until …; do sleep 2; done` inside a script or run long jobs in the background.
10. Report (your final message): files changed (with line counts), tests added (counts by kind), the full `pnpm test` summary line, anything
    you could not do, every assumption you made, and any number you could not source.
