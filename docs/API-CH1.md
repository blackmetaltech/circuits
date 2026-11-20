# NODE chapter 1: engine contract for the Godot world

Everything the bench world draws or says comes from these queries; everything the player does is one of these actions. The engine owns every number
(dot speed, LED bloom, rating ratios, band, lock, payment); the UI computes none. All values are SI (V, A, W, ohm, s, deg C) unless a field says
`mA` / `text`. Pads are `[x, y]` integer grid coordinates (the perfboard is 24 x 16). Strings are already English (and regional: `Lio` / `Wren` / `Stall 14`
come from the region pack). Examples below are real output (1-3 "Hot Resistor" built with the ref and powered; rounding trimmed).

Calling: via the sidecar protocol `{"fn":"act","name":"placePart","args":[...]}` -> `{ok, message, ...extra}`; `{"fn":"q","name":"liveFrame","args":[]}` -> JSON.
A refused action returns `ok:false` with a teaching `message`. Queries never mutate. Build the sidecar with `npx vite build -c vite.bridge.config.ts`.

## Loop the UI runs

1. Counter: `chapterMap()` shows the notebook page. `act openTicket <id>` on a chit (`unlocked`).
2. Bench: draw once with `bench()`, `ticketCard()`, `coach()`. After every action re-read `bench()` (cheap) and `coach()`.
3. Power on (`act power true`). Each 1/30 s while powered and not paused: `act advance 1..8` then `q liveFrame()` then (if a scope probe or the gauge is shown) `q scope()`.
   Never ask for "as much as fits in N ms" (determinism, DESIGN §3.9). `advance` returns `{frames, smoked:[uid], status}`; `smoked` is non-empty on the frame a part fails.
4. Probe: `act attachProbe <ch> <pad>`, `act dmmLead red|black <pad>`, `act dmmDial dcv|dca|ohm|off`; read `scope()` / `dmm()`.
5. `act runBench`: result via `benchResult()`; on a pass `act runBench` returns `pay` and `wallet()` grows (coin tin ka-ching: `wallet().lastPay`).

## Actions (all refuse with a teaching message)

| Action | Args | Notes |
|---|---|---|
| `openTicket` / `closeTicket` | `id` | `ticket.locked` message if the previous chapter-1 ticket is unpassed |
| `placePart` | `partId, value|null, rating|null, x, y, rot(0-3), flip` | `x,y` = pin 1's pad; the part's other pins follow `ghost()`. Result `{uid, value, variant}` |
| `movePart` / `rotatePart` / `deletePart` | `uid, x, y` / `uid[, flip]` / `uid` | fixed parts (battery, heater, textbook sources) refuse |
| `setValue` / `swapVariant` | `uid, value` / `uid, rating` | value must be in the bin list; rating is the shoebox variant (`0.25W`) |
| `wire` | `padA, padB` | engine picks a clean orthogonal route; result `{wid, path}`. Refuses if no route |
| `addWire` | `path` (list of pads) | explicit route (what click-drag with bends sends) |
| `unwire` | `wid` or `pad` | by id, or every wire ending on that pad (right-click / drag back to the box) |
| `power` | `on` | the rocker switch; resets the live run. Powering on or off also un-pauses |
| `setRunning` | `on` | run / pause (`false` makes `advance` a no-op `{frames:0, paused:true}`) |
| `advance` | `frames 1..8` | see above |
| `attachProbe` / `detachProbe` | `ch 1|2, pad` / `ch` | scope CH1 / CH2 clip on a pad that has a node |
| `dmmLead` | `'red'|'black', pad|null` | drag a lead tip onto a pad (null = take it off). First lead turns the dial from off to `dcv`. Reading needs both leads |
| `dmmDial` | `'off'|'dcv'|'dca'|'ohm'` | V / mA / ohm. `dca` puts a 0.1 ohm burden in the leg (the DMM is in series between its leads) |
| `setSupply` | `v, ilim` | bench supply (1-3); `setScope` for time/div, volts/div |
| `predict` | `id, value` | exam bridge (1-5): enter before benching |
| `runBench` | `[coached]` | formal test (all conditions). `{pass, stars, metrics, pay}`. The player's own bench button passes `true`: a ticket with `measureFirst` (1-4) then refuses with "Measure it first..." until the meter leads or the scope clip have been on the board once (`tk.probed`) |
| `undo` / `redo` / `replaceSmoked` / `hint` | `[uid]` | hint rungs: nudge, equation with your numbers, ghost part |

## Queries

### `chapterMap(chapter = 1)` - Wren's notebook page
```json
{"chapter":1,"title":"First Light","blurb":"Wren's first page: five tickets at Stall 14, Lantern Lane. ...",
 "tickets":[{"id":"1-1","title":"Torch","customerId":"kid_torch","customer":"Lio","eb":false,"teaches":["ohm","kvl","led","current-limit"],
   "scope":"must","unlocked":true,"passed":false,"stars":0,"attempts":0,"state":"open","fee":300,"feeText":"$3.00","spec":"LED current between 10 mA and 20 mA","after":[],
   "chit":{"x":0.2,"y":0.3},"best":null}, ...],
 "starsEarned":0,"starsTotal":11,"complete":false,"open":null}
```
`state`: `locked | open | passed | done` (done = 2+ stars). `chit` is the pin position on the page (0..1). `best` = `{cost,parts,power,area,costText}` of the best pass.

### `ticketCard()` - the paper chit and the shoebox
Customer, brief, spec names, `targets` (`level` bands as numbers), `conditions` (e.g. `fresh` / `tired` battery as `{id, set:[{target,key,value}], ambientC}`),
`fee`, `eb`, `predictions` (`[{id,name,unit:'V'|'A',entered}]`), `gauge` and `stars` `{head, par}`. **`shoebox`** is the bin as a box of parts:
```json
{"id":"1-3","title":"Hot Resistor","customer":"Mr. Brook","mentor":"Wren","stall":"Stall 14","lane":"Lantern Lane","brief":"Mr. Brook's aquarium heater ...",
 "specs":[{"id":"vout","name":"Heater voltage between 7.85 V and 8.40 V, no part over its rating"}],
 "targets":[{"id":"vout","name":"...","lo":7.85,"hi":8.4}],
 "conditions":[{"id":"nominal","set":[{"target":"psu","key":"v","value":12}],"ambientC":50}],
 "shoebox":[{"partId":"res-cf","name":"Carbon-film resistor 5 %","kind":"R","footprint":"axial2","pins":["1","2"],"values":[22,27,47,51,100],"unit":"Ω","max":null,"placed":0,
   "variants":[{"id":"0.25W","ratings":{"P":0.25,"Vmax":250,"Tamb":70},"price":2,"priceText":"$0.02"},
               {"id":"0.5W","ratings":{"P":0.5},"price":3,"priceText":"$0.03"},{"id":"1W","ratings":{"P":1},"price":7,"priceText":"$0.07"}]}],
 "eb":false,"fee":500,"feeText":"$5.00","instruments":{"supply":true,"gen":false,"scope":true},"gauge":{"spec":"vout","unit":"V","clip":"OUT"},"chit":{"x":0.7,"y":0.3},"ambientC":50}
```
`price` is integer minor units (cents); `priceText` is formatted for the region. Drag a shoebox item with `placePart(partId, value, variant, x, y, rot, flip)`.

### `ghost(partId, x, y, rot, flip)` - the leads before release
`{ok, partId, pins:[{name,pad}], problem}`; `problem` is the teaching text when it does not fit (pad taken, off the board).

### `bench()` - the static board
```json
{"ticket":"1-3","w":24,"h":16,"connectors":[{"id":"IN","pad":[2,2],"role":"source"},{"id":"OUT","pad":[14,2],"role":"load"},{"id":"GND","pad":[14,8],"role":"ground"}],
 "parts":[{"uid":"f1","partId":"heater","name":"Heater element","kind":"HEATER","x":14,"y":2,"rot":1,"flip":false,"fixed":true,"value":null,"valueText":"","variant":"12V","pos":null,"ratings":{"P":3},"smoked":false,
           "pins":[{"name":"1","pad":[14,2]},{"name":"2","pad":[14,8]}]},
          {"uid":"p1","partId":"res-cf","name":"Carbon-film resistor 5 %","kind":"R","x":4,"y":2,"rot":0,"flip":false,"fixed":false,"value":22,"valueText":"22 Ω","variant":"1W","ratings":{"P":1,"Vmax":400},"smoked":false,
           "pins":[{"name":"1","pad":[4,2]},{"name":"2","pad":[8,2]}]}],
 "wires":[{"wid":"w1","path":[[2,2],[4,2]]},{"wid":"w2","path":[[8,2],[14,2]]}],
 "instruments":{"powered":true,"paused":false,"supply":{"on":true,"v":12,"ilim":0.5},"gen":null,
   "scope":{"timePerDiv":0.001,"voltsPerDiv":[2,1],"trigger":{"source":1,"level":0,"edge":"rise","mode":"auto"},"probes":[{"ch":1,"pad":[14,2]}]},
   "dmm":{"mode":"dcv","label":"V","red":[14,2],"black":[14,8]}},
 "status":"ok","issues":[],"boardErrors":[],"undoDepth":3,"redoDepth":0,"benched":null}
```
`instruments.supply` / `gen` / `scope` are `null` when the ticket has none (the bench supply exists in 1-3 only). `status`: `ok | float | noconv | loop | big`; `issues` / `boardErrors` carry teaching text
(e.g. "no ground"). `parts[].pins[].pad` are the pads the leads land on after rotation. Tint, current, heat and failures are NOT here: use `liveFrame()`.

### `liveFrame()` - once per frame (measured ~0.1 ms query, 0.4 ms `advance(1)` on desktop; the 4 ms Pixel budget is checked on the phone in M2-7)
```json
{"valid":true,"powered":true,"paused":false,"frame":3,"t":0.06,"status":"ok","issues":[],"vmin":0,"vmax":12,"ambient":50,
 "nodes":[{"id":0,"name":"0","v":0,"norm":0,"pads":[[14,8]],"connectors":["GND"]},
          {"id":1,"name":"in","v":12,"norm":1,"pads":[[2,2],[4,2]],"connectors":["IN"]},
          {"id":2,"name":"out","v":8.3333,"norm":0.6944,"pads":[[8,2],[14,2]],"connectors":["OUT"]}],
 "parts":[{"uid":"p1","temp":52.02,"power":0.6111,"state":"normal","smoked":false,"ratio":0.6111,"rated":1,"violations":[],
           "pins":[{"name":"1","pad":[4,2],"i":0.16667,"speed":5.2478},{"name":"2","pad":[8,2],"i":-0.16667,"speed":-5.2478}]}],
 "wires":[{"wid":"w1","i":0.16667,"speed":5.2478}],
 "events":[]}
```
- `nodes[].norm` 0..1 is the tint scalar of the diverging map; tint every pad in `pads`.
- `wires[].i` is signed along `path[0] -> path[last]` (A). `speed` is the dot speed in pads/s, signed the same way: 0 below 1 nA, else clamped to [0.2, 6] growing with log10(|I|/1 uA). Direction = conventional current.
  Cute-mode critters use the same `speed`.
- `parts[].pins[].i` is current INTO the part at that pin; `speed` likewise (negative = out of the part).
- `parts[].state`: `normal | warm | hot | smoke`; `temp` deg C; `power` W; `ratio` = power / rated power (or the worst rating ratio); `violations` list each broken rating with plain text.
  Heat glow: `warm` and `hot` (resistors hot above 155 C), shimmer at `hot`. Rating bars: draw `ratio`.
- LEDs also carry `led: {i, mA, bloom, mood}`: `bloom` 0..1 (log current, 10 uA .. 30 mA), `mood` `sleepy` (< 2 mA) | `happy` (2-20 mA) | `sweating` (> 20 mA) | `cracked` (failed).
- `events` lists every smoked part still on the board (until `replaceSmoked` / `undo`): `{part, kind:'crack'|'smoke'|'vent', failureId, key, text}` - `crack` = semiconductor die, `smoke` = resistor etc., `vent` = electrolytic.
  Fire the FX the first time a `part` appears (or on `advance`'s `smoked`). `text` is the explainer with the player's own numbers (the notebook opens it, or `explain(failureId)`).
  1-1 "LED straight on the PP3": the first `advance` after `power true` returns `smoked:["p1"]` and `kind:"crack"` ("The LED p1 took 0.604 A, more than 3 times its 0.03 A rating: the die cracked.").
  1-3 / 1-4: the part first goes `warm` -> `hot` over a few real seconds (thermal time), then `smoke`.

### `scope(ch = 1, window = 256)` - CRT trace, amber band, LOCK
```json
{"ch":1,"attached":true,"triggered":false,"t0":0.0591,"dt":3.9e-05,"v":[8.33331, "..."],"voltsPerDiv":2,"timePerDiv":0.001,"trigger":{"source":1,"level":0,"edge":"rise","mode":"auto"},
 "unit":"V","badSamples":{},
 "target":{"spec":"vout","name":"Heater voltage between 7.85 V and 8.40 V, ...","quantity":"V","unit":"V","scale":1,"lo":7.85,"hi":8.4,"mode":"probe",
           "clip":{"connector":"OUT","pad":[14,2]},"clipped":true},
 "gauge":{"value":8.3333,"unit":"V","text":"8.3333 V","inBand":true,"v":[8.3333, "..."]},
 "lock":true,"lockSpecs":{"vout":true}}
```
- `v` = trace samples of the clipped channel (volts), `t0`, `dt` give their times; draw `volts/div`, `time/div` as given. `attached:false` = no probe on that channel.
- `target` = the amber band for the ticket's headline spec in display units (`unit`, `scale` = SI to display, `lo`/`hi`); `null` if none.
  `mode:'probe'`: the quantity is a node voltage (1-3 OUT, 1-5 A): clip CH1 on `target.clip.pad` (the arrow's target) and draw `v` against the band; `clipped` says whether it is.
  `mode:'gauge'`: the quantity is a branch current or power (1-1, 1-2 LED mA, 1-4 watts) that a probe tip cannot show: draw `gauge.v` (flat trace at the live value, DC tickets) against the band.
  `gauge` is `null` until powered. All chapter-1 specs are DC levels, so the trace is flat once settled.
- `lock` = every `level` spec of the ticket is inside its band on the live solution, powered and nothing smoked: band turns green, chime, VFD "LOCK". `lockSpecs` per spec.
  `lock` is the live view, the formal verdict is the bench (1-2 also needs the tired battery; 1-3 12 V).
- `badSamples` (times of failing samples per spec, after a bench run) for the red flash.

### `dmm()` - the yellow multimeter
```json
{"mode":"dcv","label":"V","red":[14,2],"black":[14,8],"valid":true,"value":8.33331,"unit":"V","display":{"value":8.3333,"unit":"V","text":"8.33 V"},"negative":false,"note":""}
```
`label` is the dial text (`V`, `mA`, `Ω`, `off`). `display` is what the LCD shows (`dca` is in mA). `valid:false` with a `note` ("Put both meter leads on the board.") while a lead is missing;
nothing reads until powered (volts / amps). `ohm` zeroes every source and pushes 1 mA between the leads (so it reads the rest of the circuit in parallel, like a real meter).
`negative` = leads swapped (show the minus sign).

### `coach()` - Wren's notebook steps with the hand-drawn arrow
```json
{"ticket":"1-3","active":"place","text":"Drag a resistor from the shoebox. Each rating is a different part with its own price.",
 "anchor":{"target":"bin","partId":"res-cf","name":"Carbon-film resistor 5 %"},"done":0,"total":7,
 "steps":[{"id":"place","text":"...","done":false,"shown":true,"active":true,"anchor":{"target":"bin","partId":"res-cf","name":"..."}},
          {"id":"wire","text":"Wire IN through the resistor to the heater at OUT.","done":false,"shown":true,"active":false,"anchor":{"target":"connector","connector":"OUT","pad":[14,2]}}, "..."]}
```
Steps advance on engine state (never a timer). `active` is the first step that is `shown` and not `done` (`null` when everything is done). **`anchor`** names what the arrow points at:

| `anchor.target` | extra fields | point the arrow at |
|---|---|---|
| `bin` | `partId, name` | that item in the shoebox |
| `part` | `partId, uid, pin, pad, name` | that placed part's pin (`pad` is the pad) |
| `connector` | `connector, pad` | that brass connector on the edge |
| `power` | | the rocker switch on the battery holder / bench supply |
| `scope` | | the scope's CH1 clip |
| `dmm` | | the DMM and its leads |
| `bench` | | the "run bench" control |
| `chit` | | the ticket chit |
| `notebook` | | the notebook |

A `part` anchor falls back to `bin` while that part is not on the board yet.
N2 additions. **A burnt part** (any ticket, unless the ticket's own burn step is the active one) puts a first row `{id:'burned', text:'The LED burned: undo it (Ctrl+Z) or swap it...', anchor:{target:'part', uid, pad}}` in front of the steps and makes it the active one, so the coach never moves on to "clip the meter" over a smoking part. **Optional steps** (`optional: true` in the level file: the measuring steps of 1-1, 1-2, 1-3, 1-5) never hold the coach back: the next required step is active and its text carries `Optional: ...` for the pending one. 1-4 measuring is required (`measureFirst`). `done: 'probed'` = the meter leads or scope clip have been on the board at least once. 1-1 has 7 steps (place LED, wire it, power on, the smoke branch `undo-smoke`, `see-dots`, run bench, done).

### Part names (N2)
No message the engine writes carries a part id. `placePart` says `Placed the 100 Ω ¼ W resistor.`; moves, rotations, deletes, value / rating changes, replacements, wire landings (`the LED leg A +`), pad clashes, burns, rating and bench failures all name the part: `the LED` (`LED 1` / `LED 2` when there are several), `the 100 Ω ¼ W resistor` (a second one with the same value is `(no. 2)`), `the battery`, `the heater`, `source E1`. Sentence-start forms are capitalised by the engine.

### Burn text follows the live circuit (N2)
An LED burn (instant crack or thermal) is explained from the actual board: a bare LED on the battery says only the battery's own r and the LED's own r limited the current; with a resistor on the board it names it ("the 100 Ω ¼ W resistor ... was too small") and uses the measured mA. Cadence: the **first** failure on a ticket explains the cause and points at Kirchhoff's voltage law (the battery's V minus the LED's ~2 V must fall across something that limits the current to about 15 mA) without a resistor value; a **repeat** (`Burned again`) gives the worked formula `R = (9 V - 2 V) / 15 mA = about 470 Ω`.

### Exam figure and payout text (N2)
`ticketCard().figure` (exam-bridge tickets) = `{node:'A', sources:[{name:'E1', volts:10, r:{name:'R1', ohm:2}}, ...], load:{name:'R3', ohm:6}}`: what the exam slip draws (the one place a schematic is allowed). `ticketCard().payText` and `chapterMap().tickets[].payText` = `fee $3.00 + $1.00 per new star` (also `starsMax`, `perStar`, `best.costText`); a FIXED ticket can be reopened from the notebook to earn more stars or a lower cost; only new stars pay. `scope().target.clipped` is true for a CH1 clip anywhere on the node of the gauge connector (R3's top leg is node A as much as the brass A pad).

### `benchResult()` - after `runBench`
`{pass, stars, metrics:{cost,parts,power,area}, costText, pay, payText, smoked:[uid], specs:[{id,key,name,pass,margin}], failures:[{key,vars,text}], predictions:[{id,name,entered,truth,grade,gradeText,gap}], badSamples}`.
`margin` > 0 = inside the band (spec units). `failures[].text` explains with the player's numbers. Stars: 1 pass, 2 headline metric at par (3 needs the tolerance run: later). 1-5 (exam):
one star each for every prediction within 5 %, every prediction within 1 %, built right on the first bench run. `grade`: `exact` (1 %) | `close` (5 %) | `miss`; `gap` is the signed % error.

### `wallet()`
`{minor:500, text:"$5.00", code:"USD", symbol:"$", decimals:2, lastPay:500, lastPayText:"$5.00"}`. Money is integer minor units. A pass pays the ticket `fee` the first time plus `perStar` for each star earned for the first time
(1-1: 300 + 100/star, 1-2: 400 + 150, 1-3: 500 + 150, 1-4: 600 + 200, 1-5: 700 + 150; game estimates). Never paid twice.

Other queries unchanged from M2-1: `progress`, `tickets`, `board`, `nodes`, `currents`, `thermal`, `ratings`, `meter`, `netlist`, `explain(id)`, `failureLog`, `parts`, `legalActions`, `snapshot`.

## The five tickets (data in `src/data/levels/1-*.ts`)

| id | customer | spec (bench) | board | designed fail (tested) | ref |
|---|---|---|---|---|---|
| 1-1 Torch | Lio | LED current 10-20 mA | 9 V PP3 fixed (EMF 9.0, r 1.7); bin red LED + 100/220/470/1k | LED on the PP3: 0.60 A, die cracks on the first frame; 100 ohm smokes after thermal time; 220 ohm 31 mA fails; 1k 7.2 mA fails | 470 ohm, 14.95 mA, cost 5c |
| 1-2 Tail-light | Ash | 3 LEDs 14-20 mA each, battery <= 25 mA, fresh (9.0 V / 1.7) AND tired (8.4 V / 6) | PP3 fixed; 3 LEDs + E12 | parallel LEDs: battery 57 mA; 3 branches fail the battery spec; 120 / 180 ohm fail fresh / tired | 3 LEDs in series + 150 ohm; margin 0.348 mA (design 0.35, kept 14-20) |
| 1-3 Hot Resistor | Mr. Brook | heater voltage 7.85-8.40 V, ratings | bench supply 12 V, 50 ohm heater fixed, 22/27/47/51/100 in 1/4, 1/2, 1 W | 22 ohm 1/4 W: 0.61 W in 0.25 W, smokes (ambient 50 C, see below); 27 ohm 7.79 V | 22 ohm 1 W (5c); 2 x 47 ohm 1/2 W also passes (6c) |
| 1-4 Tired Battery | Bo | load power >= 4.20 W | tired pack fixed, hidden r (Learner 4.7; Engineer 3.3-4.7), 2.2-10 E12 in 1 W (cf) and 5 W (ww) | 3.3 ohm 4.18 W and 6.8 ohm 4.16 W fail; 1 W part smokes at 4.3 W | 4.7 ohm 5 W, 4.31 W, 40c |
| 1-5 EB Two Batteries | the exam desk | predict V(A), I(E2); bench V(A) and I(E2) +-0.1 % | E1 10 V, E2 5 V fixed (textbook ideal), res-exact 2/3/6 | wrong build fails the 0.1 % check; missing predictions refuse the bench | V(A) = 6.6667 V, I(E2) = +0.5556 A into E2 (charging) |

## Deviations from DESIGN §2.8 (each needs the director's sign-off; reasons are in the level file headers)
1. **1-3 band 7.85-8.40 V** (not 8.0 +-0.3): the text says Ref A (8.33 V) passes and 27 ohm (7.79 V) fails; no centred band does both.
2. **1-3 ambient 50 C**: 0.61 W in a 1/4 W part is 2.44x, which settles at 233 C (< T_fail 250 C) at 25 C ambient; the design's "smokes at about 2.6x" does not reach it. A warm aquarium hood makes it smoke (258 C).
3. **1-3 prices (resolved 11-20)**: a 1 W resistor is now 7c (1/4 W 2c, 1/2 W 3c), so Ref B (2 x 47 ohm 1/2 W, 6c) is cheaper than Ref A (22 ohm 1 W, 7c) as DESIGN §2.8 says; cost par is 6c (Ref B earns the star, Ref A passes with one). The game-estimate price table is only ordered, not real.
4. **1-4 seeded r 3.3-4.7 ohm** (not 3.3-8.2): E^2 / (4r) < 4.20 W for r > 4.82 ohm, so larger r makes the ticket unsolvable. At r near 3.3 a load near r exceeds the 5 W rating, so the player must pick R = 10 ohm-ish.
5. **1-5 bench checks I(E2) not I(R3)** (the player places all three resistors, so no fixed id to probe); the reality-check swap to a NiMH cell is not built (needs a NiMH part).
6. **Fees** and the 1-4 EMF-as-hidden-parameter wiring are game estimates / implementation choices.
