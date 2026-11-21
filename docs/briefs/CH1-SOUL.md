# CIRCUITS chapter 1 "First Light": soul brief (main session, 2026-11-20)

The current build shows the generic COBANANA dashboard: a top bar with TICK/WALLET/TICKET, a right sidebar card, bottom tabs, a flat grid of
pads and a tutorial popup. That is exactly what the owner rejected on 2026-11-10 ("looked horrible, copied GIGAWATT elements"). Delete
that chrome from the main view. CIRCUITS's own soul is already written in docs/DESIGN.md §1.2, §5 and §6. This brief makes chapter 1 meet it.

## The one picture to hit
It is night in Stall 14, Lantern Lane. You look down at Wren's walnut bench from a seat, with a 12° tilt. Above, through a strip window,
are the lane, its rain awnings, tangled cables, a neon sign and a passing tram silhouette. On the bench:
- the black perfboard with gold pads and a brass edge connector engraved IN/OUT/GND;
- the shoebox of parts (the bin) as a real open box, not a list;
- a tea mug, Wren's notebook (the coach and Codex, handwritten Kalam on cream paper) and Rezzy the cat asleep at the edge.

On the right stands the oscilloscope: a CRT bezel with knobs, a green phosphor trace, an amber target band, and a small VFD that lights
LOCK. The yellow DMM lies on the bench with its probe leads. The customer (Lio, age 10, with a dead torch) appears at the counter edge at
the bottom of the screen. Their ticket is a paper chit pinned to the scope bezel.

## Interaction rules
- No top bar, no sidebar cards, no tabs on the main view. Money is a coin tin on the bench. The ticket is the chit. The Codex is the
  notebook: click it to open as a paper overlay with the bench visible behind. Settings is a small gear on the stall wall.
- Placing parts: drag a part from the shoebox to pads. Leads snap to pads, and a ghost shows the leads before release. Wires are drawn
  pad to pad (click-drag), with a solder blob on each end. Delete by dragging back to the box or right-click.
- **Power** is a physical rocker switch on the battery holder or bench supply, with a click and the scope trace starting.
- **Living overlays from §5.2:**
  - node-voltage tint on pads and traces;
  - current dots along wires;
  - LED bloom ∝ log I;
  - heat glow and shimmer, and smoke with a char decal when a part fails.

  The 1-1 failure (LED straight on the PP3) must crack and smoke instantly. That is the hook in §1.3.
- **Probe:** drag the DMM's red and black probe tips onto pads. The LCD reads V, or mA when you switch the dial. The scope CH1 probe clips
  onto a pad.
- **Band lock** is the core reward: the trace sits in the amber band, which turns green with a chime and LOCK on the VFD. Then the
  customer's reaction and a ka-ching into the coin tin.
- **Cute mode** (title and pause toggle, on by default; the program-wide rule is that charm must encode physics):
  - Current dots become tiny electron critters whose speed follows the log of current, as §5.2 says.
  - An LED gets a face whose expression follows its rating ratio: sleepy below 2 mA, happy in spec, sweating above 20 mA, then a cracked
    face when it smokes.
  - Rezzy wakes and watches when something gets hot.
- The coach is Wren's notebook, in her hand. Steps point at objects with a hand-drawn arrow on the bench, never a modal popup.

## Chapter 1 scope (must play end to end)
- Tickets 1-1 Torch, 1-2 Tail-light, 1-3 Hot Resistor, 1-4 Tired Battery and 1-5 EB Two Batteries, from DESIGN §2.8 with their refs, fails
  and coach steps.
- The title screen is the stall at dusk with "CIRCUITS" as a neon sign that flickers on. It shows Continue / New / Settings / Cute mode.
- Chapter map: Wren's notebook page with the chapter's tickets as pinned chits.
- Desktop 1920x1080 and 1280x800 (Deck) first; the phone layout follows DESIGN §6.4 (scope as a drawer with a peek strip).

## Engine
M2-1 wiring (actions, queries, board, live frame, levels data) is an unfinished WIP commit (tests are green now, 675). Finish it:
- board actions: place, move, delete, wire, unwire;
- power on/off, probes, run;
- ticket start and bench check;
- the levels 1-1 to 1-5 data with oracles;
- live frame within budget.

The engine owns every number. The UI computes none.

## Evidence
Screenshots at 1920x1080 and 1280x800 for each of these:
- the title;
- the bench idle;
- 1-1 smoking;
- 1-1 lock;
- 1-3 hot resistor glowing;
- 1-4 DMM probing;
- the notebook open;
- Cute mode.

The main session judges them against this brief before chapter 2 starts.
