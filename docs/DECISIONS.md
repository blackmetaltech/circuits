# NODE build decisions (deviations from BUILD-PLAN.md, with reasons)

- 2026-11-10 (director): M1-A1 and M1-A2 run as one worker task (netlist/compile + linear stamps/DC/topology + NC/CA oracles):
  the device-stamp interface and its first users are designed together, which avoids an interface round trip between lanes.
- 2026-11-10 (director): the part catalogue and board contracts (`src/data/parts/types.ts`, `src/sim/board/types.ts`) were written by the
  director before the lanes started, so the catalogue, footprints and compiler agree on part kinds, footprints and pin order.
  Prices are region data (`src/regions/global/prices.ts`), not on PartDef (DESIGN §4.5 had `priceUSD`; user decision 5 moves it to packs).
- 2026-11-10 (director): `sim/mna/solver.ts` adapter wraps core LU until the flat `lu.ts` (GA-1) lands, then switches in one line.
