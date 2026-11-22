# LOOK2: the tech wizard's workbench

The night-market stall look is retired. The engine, the 23 tickets, the goldens and the tests stay as they are. This page sets the new look and how we get there. Phase A is one ticket, 5-1 Fan Driver, rebuilt on branch `look2`.

## The fantasy
You own a good electronics bench, and people bring you things that stopped working. A desk fan, an LED strip controller, a synth, a radio, a phone charger. You open the device, see the board, probe it, find the fault, and fix it or build the stage that replaces it. When there is no job you use the same bench as a testbed: any part, any instrument, time you can pause, builds you can save, known devices you can open to see how they work. The player should feel like the person friends call when something breaks: competent, calm, well equipped.

## Two modes, one place
- **Jobs:** the existing tickets as repair and build orders for real appliances. Specs, parts budget, the bench test, pay.
- **Free bench:** the engine's existing sandbox mode (`newGame(seed, "sandbox")`: all 76 catalogue parts, 80-part limit, no locks). Phase A ships the entry and free placement. Saving builds and loading reference devices come later.

## References (what we take from each)
| Reference | What we take |
|---|---|
| *PowerWash Simulator* | One real object at the centre, close and tactile. Quiet UI. The satisfaction of a visible before and after. |
| *House Flipper 2* and *Car Mechanic Simulator 2021* | Opening a device up and working on its insides. Parts drawers and a sense of owning your tools. |
| *Townscaper*, *Unpacking* | Calm. Small objects lit with care. No urgency in the interface. |
| Product photography of Rigol, Siglent, Keysight and Fluke instruments | Dark anodised panels, emissive screens, crisp sans type, one restrained accent colour. |
| KiCad and Altium (the EDA tools) | The schematic view and the UI language: thin lines, real units, dark canvas, precise. |

## Palette and light
- The room is dim and warm at night. Walls are painted plaster, the desk is old oak, and a grey-blue ESD mat sits on top.
- **Key light:** a warm desk lamp (about 3200 K) from the upper left. Soft shadows, and it pools on the mat.
- **Fill light:** the cool blue-white glow of the monitor and instrument screens (about 7000 K) from behind.
- **Rim light:** a weak window light (moonlight blue) from the back right that picks out edges.
- **Emissives carry meaning:** LEDs, the scope trace (yellow CH1), the supply's red digits, ember glow on hot parts. Glow makes them bloom.
- **Post:** AgX tonemapping, SSAO and SSIL, SSR on the screens and the mat, light volumetric fog so the lamp cone reads, depth of field in close-ups.
- **UI accent:** one colour, a signal amber (#E8A33D). Pass is a muted green and fail is a muted red. Everything else is greys on dark anodised panels.

## Camera
- Free orbit (right drag), pan (middle drag or WASD) and zoom (wheel). Movement is smooth, with limits so the view never leaves the room.
- Snap views: **1** wiring (steep three-quarter view over the board), **2** the whole bench, **3** scope close-up, **4** the device (the fan). Depth of field follows the view. The parts drawer shows only in the wiring view or while placing a part, so the bench views stay clear.
- **Tab** toggles a schematic view that mirrors the physical build: the same parts and nets drawn as symbols in place, with node voltages when the bench is powered.

## UI language
- Panels are dark anodised metal (#15171A to #1E2125) with a 1 px lighter top edge and a soft drop shadow. No paper, no handwriting.
- Type: Inter for labels and text, JetBrains Mono for values. Values always carry units (11.96 V, 17.1 mA, 2.00 ms/div).
- **Job card, top left:** the work order, the device, the customer's one line, and the spec rows with live measured values and a pass or fail mark.
- **Parts drawer, left:** grouped by kind, each row showing value, rating and price.
- **Tool strip, bottom:** Select, Place, Wire, Scope probe, Meter leads, Power, Run test. Each shows its key.
- **Message line, bottom centre:** what the engine says, in its own plain words.
- Failures get a short title, the engine's explanation and the fix hint.

## Assets (all CC0 or OFL; sources and licences in `docs/ASSETS.md`)
- Poly Haven: the `artist_workshop` HDRI (1k), the `wood_table_001` desk (2k) and the `painted_plaster_wall` wall (1k).
- Procedural (our code): every component, the perfboard, the jumper wires, the instruments, the fan, the ESD mat, the drawers and the lamp.
- Fonts: Inter and JetBrains Mono (both SIL OFL).
- Still to find: a few CC0 props (a solder spool, tweezers, a mug, cable ties) from Poly Haven or Quaternius, and a real CC0 smoke flipbook.

## Quality tiers (one game)
- **High:** desktop, Forward+, discrete GPU. SSIL, SSR, volumetric fog, DOF, soft shadows at 4k atlas, MSAA 4x and TAA off.
- **Medium:** Forward+ on integrated GPUs. No SSIL, no fog, 2k shadows, FXAA.
- **Low:** Compatibility (OpenGL): Steam Deck fallback, phones, CI under Xvfb. No screen-space effects, baked-looking ambient, emissives still bloom.
- The tier is picked automatically from the renderer and the device name. `CB_QUALITY=high|medium|low` overrides it.

## How the existing tickets map onto the bench
- Every ticket becomes a job for a device. Chapter 1: a torch, a bike tail light, an aquarium heater, a toy car, and the exam board. Chapter 2: a weather station, a buried cable fault, an obsolete module, and the exam. Chapter 3: a camera flash, an arcade button, a relay valve, and the exam. Chapter 4: a wall adapter, a radio, a printer board, your own 3.3 V bench rail, and the exam. Chapter 5: the desk fan, an LED strip, logic gates, a synth, and the exam.
- The engine board (24 x 16 pads) is the perfboard on the bench. Fixed parts and pre-routed wires stay as the device's own board. The instruments a ticket allows sit on the bench, and the ones it does not allow are shelved.
- Exams ("predict first") become a calibration sheet on a clipboard, drawn in the same panel style.
- Each device needs one model: about 20 devices for the 23 tickets (the exam boards share one).

## Round 2 (same slice)
- **Repair flow, presentation only:** the fan comes in with its driver board in a case with a work-order tag. **O** (or a click) lifts the lid off and sets it on the mat, and the board inside is the ticket's board. After the bench test passes, "Close up and hand back" puts the lid back on, and the fan goes home running on the pin. No level data or goldens changed.
- **Part tray:** a slim row of small 3D renders above the tool strip. The name, value and price show on hover or focus, and arrows step resistor values. The text column is gone.
- **Light:** a warmer, brighter lamp, a warm bounce off the desk, wood grain at real scale, a worn mat (edges, wipe marks, old solder burns), and a soft smoke plume. Godot's turbulence had clumped the particles into beads, so it is off.
- **1280x800:** a 16 px text floor everywhere, bottom panels anchored to the real canvas height, and the failure panel moved off the board.

## Measured (phase A slice, ticket 5-1, whole-bench view, powered at 100 Hz)
| GPU | Tier | 1920x1080 | 2560x1440 (3D render scale 1.333) |
|---|---|---|---|
| RTX 4090 (Forward+, PRIME offload) | high | 6.4 ms avg, 7.6 ms p95 | 5.8 ms avg, 6.7 ms p95 |
| Ryzen 9900X iGPU (Radeon, 2 CU, Forward+) | medium | 71 ms | not run |
| Ryzen 9900X iGPU | low (round 1) | 43 ms | not run |
| Ryzen 9900X iGPU, Forward+ | low (round 2) | 1280x800: 17.0 ms avg (59 fps) | not run |
| Ryzen 9900X iGPU, Compatibility (OpenGL) | low (round 2) | 1280x800: 9.3 ms avg, 11.5 ms p95 (107 fps) | not run |

- The 4090 is not GPU-bound here: 1440p is no slower than 1080p. The per-frame engine step through the sidecar probably sets the floor. That is not yet profiled.
- The iGPU is a 2-CU part, well below a Steam Deck (8 CU). The low tier now meets 30 fps with room to spare. It trades away the moon shadow and the soft lamp penumbra (one hard lamp shadow at a 1024 atlas), depth of field, SSAO, SSIL, SSR and fog, and it renders 3D at 75 % then scales up. It keeps the emissive screens, the LEDs, glow, the warm and cool light plan, and every model.

## Cost to bring the whole game to this look
| Work | Estimate (agent hours) |
|---|---|
| About 18 more part models: battery holders, pots and trimmers, slide wire and jockey, galvanometer, resistance box, relay, transformer, bridge, heatsinks, inductors, LED strip, speaker, NTC, fuse, heater, isolation transformer | 14 |
| About 19 opened-up device models, one per ticket family | 28 |
| Ticket systems in the new UI: exam calibration sheet, chapter 4 selectors and safety card, jockey control, thermal camera, coach steps, Codex, a job board for the chapter map, wallet, settings | 16 |
| Five chapters integrated and hand-played on the bench | 20 |
| New 3D flows per chapter, a 1280x800 layout audit, gamepad focus | 15 |
| Quality tiers: low tier at 60 fps, Compatibility checked under Xvfb, a Deck run | 6 |
| Free bench: save and load builds, a library of known devices | 8 |
| Three critique and fix rounds | 12 |
| **Total** | **about 120 hours**: six to seven sessions of a lead with two helpers |

Asset gaps: CC0 props (hand tools, a mug model, cable ties), a smoke flipbook, and all bench sound (CC0 from Freesound or our own recordings).

## Risks
- **Scope:** 20 device models are the cost driver. We reuse a common chassis family and open each one only as far as its fault needs.
- **Readability at 1280x800:** we keep the 2x board scale, the top-down wiring view and outlines on hover. Every screenshot is checked at both sizes.
- **Performance on the Deck:** the Low tier has to stay at 60 fps. This is unverified until a Deck run.
- **Honesty:** the failure spike on the scope is drawn as an off-scale marker labelled with the engine's computed peak. It is not an invented waveform.
- **Tests:** the old stall stays in the repo and the flows still drive it. The new bench needs its own flow before it becomes the default on master.
