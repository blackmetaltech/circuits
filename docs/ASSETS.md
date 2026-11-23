# Assets and licences

Every third-party file in the repo, where it came from and its licence. Anything not listed is our own code or procedural geometry.

## LOOK2 workbench (`godot/look2/assets/`)
| File | Source | Author | Licence |
|---|---|---|---|
| `hdri/artist_workshop_1k.hdr` | https://polyhaven.com/a/artist_workshop | Oliksiy Yakovlyev | CC0 |
| `tex/wood_table_001_{diff,nor_gl,arm}_2k.jpg` | https://polyhaven.com/a/wood_table_001 | Poly Haven | CC0 |
| `tex/painted_plaster_wall_{diff,nor_gl,arm}_1k.jpg` | https://polyhaven.com/a/painted_plaster_wall | Poly Haven | CC0 |
| `fonts/Inter-{Regular,Medium,SemiBold}.ttf` | https://github.com/rsms/inter (v4.1) | Rasmus Andersson | SIL OFL 1.1 (`fonts/OFL-Inter.txt`) |
| `fonts/JetBrainsMono-{Regular,Medium}.ttf` | https://github.com/JetBrains/JetBrainsMono (v2.304) | JetBrains | SIL OFL 1.1 (`fonts/OFL-JetBrainsMono.txt`) |

Procedural (code in `godot/look2/`, no external files): every component, the perfboard, the jumper wires, the instruments, the fan, the ESD mat texture, the parts cabinet, the lamp, the pegboard, the smoke and the scorch decal.

## Earlier stall look (`godot/fonts/`)
| File | Source | Licence |
|---|---|---|
| `Kalam-Regular.ttf` | Google Fonts | SIL OFL 1.1 (`OFL-Kalam.txt`) |
| `ShareTechMono-Regular.ttf` | Google Fonts | SIL OFL 1.1 (`OFL-ShareTechMono.txt`) |

## Sound (both looks, `godot/stall/stall_sfx.gd`)
No audio files. Every cue is synthesised at run time from a short recipe of sine, triangle, square and noise sweeps (`StallSfx.RECIPES`),
written for this game; nothing is sampled or downloaded, so there is no third-party licence. The new look (0.4.0) plays the same
recipes on its own events: OUTPUT click, part thunk, wire zip, part removed clack, resistor pop, LED crack, failed-test buzz, pass
chime, pay ring, case clack, hand-back page, VOLTAGE tick. Title keys "Sound on/off"; `CB_MUTE=1` silences it for harness runs.
**No human has listened to the new look's sounds.** Levels and timing were set by reading the recipes, not by ear.
