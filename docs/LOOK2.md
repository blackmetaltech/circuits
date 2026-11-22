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
- Snap views: **1** top-down wiring view, **2** three-quarter view of the whole bench, **3** scope close-up, **4** the device (the fan). Depth of field follows the snap view.
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

## Risks
- **Scope:** 20 device models are the cost driver. We reuse a common chassis family and open each one only as far as its fault needs.
- **Readability at 1280x800:** we keep the 2x board scale, the top-down wiring view and outlines on hover. Every screenshot is checked at both sizes.
- **Performance on the Deck:** the Low tier has to stay at 60 fps. This is unverified until a Deck run.
- **Honesty:** the failure spike on the scope is drawn as an off-scale marker labelled with the engine's computed peak. It is not an invented waveform.
- **Tests:** the old stall stays in the repo and the flows still drive it. The new bench needs its own flow before it becomes the default on master.
