class_name CoachData
extends RefCounted
## Wren's coach steps for chapter 1 (DESIGN §7.1 style): each step is {text, target, done, when?}. `done` / `when` are condition ids the
## backend answers (FixtureBench.cond; the engine's coachStep query later). A step is shown while its `when` holds (default: always) and its
## `done` does not; the first such step is the current one. `target` names the bench object the hand-drawn arrow points at:
## box | board | pad:IN | rocker | scope | dmm | customer | notebook | tin | none.

const STEPS := {
	"1-1": [
		{"when": "smoked", "done": "r_in_loop", "target": "box", "text": "Pop. It drew 0.60 A and a red LED is rated 0.03 A. Something has to limit the current. Pull the burnt LED out (drag it back to the box or right-click it), then put a resistor in the loop."},
		{"done": "led_placed", "target": "box", "text": "Lio's torch is dead. Light the LED without burning it. Drag the LED out of the shoebox onto the board."},
		{"done": "wired", "target": "pad:IN", "text": "The longer leg is +. Draw a wire from the IN tab to the LED's long leg, and another from its short leg back to GND."},
		{"done": "powered", "target": "rocker", "text": "Flip the rocker on the battery holder (or press Space) to power it up."},
		{"when": "lit", "done": "dmm_used", "target": "dmm", "text": "See the dots? Their speed is the current. Drag the DMM's probe tips onto the LED's two legs and set the dial to mA: the ticket wants 10 to 20 mA."},
		{"done": "locked", "target": "scope", "text": "Hold the trace inside the amber band. When it sits there for a moment the band locks."},
		{"done": "never", "target": "customer", "text": "That's the job. The notebook has the next ticket."},
	],
	"1-2": [
		{"when": "smoked", "done": "clean", "target": "box", "text": "Smoke again. Pull the burnt part out and think about how the current splits."},
		{"done": "leds3", "target": "box", "text": "Ash wants three LEDs on one 9 V battery. Drag three LEDs onto the board."},
		{"done": "r_in_loop", "target": "board", "text": "One resistor protects them. Put all three LEDs in series with it: the same current flows through each, 14 to 20 mA."},
		{"done": "powered", "target": "rocker", "text": "Flip the rocker."},
		{"done": "locked", "target": "scope", "text": "Lock the band. E12 neighbours fail on both sides, so choose with the equation: R = (9 - 3 x 2.0) / 0.0165."},
		{"done": "never", "target": "customer", "text": "Now they see her coming."},
	],
	"1-3": [
		{"when": "smoked", "done": "clean", "target": "box", "text": "Burnt. A resistor's watt rating is a promise about heat. Pull it out, and pick one with more watts."},
		{"done": "r_placed", "target": "box", "text": "Mr. Brook's heater (50 ohm, fixed on the board) wants 8 V of the 12 V supply. A series resistor will drop the rest. Pick one from the box."},
		{"done": "powered", "target": "rocker", "text": "Flip the rocker. Watch the part: a hot resistor glows, and Rezzy notices."},
		{"done": "locked", "target": "scope", "text": "8 V across the heater, and no part over its rating. Cheaper is better, but a 1/4 W resistor will not survive this."},
		{"done": "never", "target": "customer", "text": "The fish thank you."},
	],
	"1-4": [
		{"done": "dmm_used", "target": "dmm", "text": "The battery is tired. Put the DMM's red probe on IN, the black one on GND, dial on V, and read its voltage with nothing connected."},
		{"done": "r_placed", "target": "box", "text": "Now load it with a resistor from the box. The voltage will sag: that sag is the internal resistance."},
		{"done": "powered", "target": "rocker", "text": "Flip the rocker."},
		{"done": "locked", "target": "scope", "text": "Most power goes into the load when R matches the battery's own r. The ticket wants 4.2 W; a 1 W part will not survive."},
		{"done": "never", "target": "customer", "text": "Vroom."},
	],
	"1-5": [
		{"done": "built", "target": "box", "text": "Predict first: what is V(A)? Then build it: E1 with R1 (2) and E2 with R2 (3) meeting at A, with R3 (6) to ground."},
		{"done": "powered", "target": "rocker", "text": "Flip the switch and probe node A."},
		{"done": "locked", "target": "scope", "text": "Was your prediction right? The bench checks V(A) to 0.1 %."},
		{"done": "never", "target": "customer", "text": "Predict, then probe."},
	],
}

const CODEX := [
	{"title": "Ohm's law", "eq": "V = I x R", "body": "Volts across a resistor push amps through it. But an LED keeps about 2 V for itself, so the resistor only gets what is left: (9 V - 2 V) over 470 ohm is 14.9 mA, which is what the scope reads. Forget the LED's 2 V and you would say 19 mA (9 over 470): the gap is the LED. Nothing to memorise: it is just division."},
	{"title": "An LED needs a limit", "eq": "R = (V - Vf) / I", "body": "A red LED drops about 2 V whatever the current, and is rated 30 mA. The battery's 9 V minus that 2 V must fall across something that limits the current to 10 to 20 mA. With nothing there, only the battery's own tiny resistance limits it and the die cracks. That is the smoke."},
	{"title": "Every resistor is a promise about heat", "eq": "P = I x I x R", "body": "A quarter-watt resistor that dissipates half a watt glows, then smokes. Choose the watts before you power on."},
	{"title": "Tired batteries", "eq": "V = E - I x r", "body": "A battery is a perfect source with a small resistor inside. The tired ones have a bigger r, so the voltage sags under load. Most power goes into a load equal to r."},
	{"title": "The critters", "eq": "speed ~ log(I)", "body": "The critters' speed shows how much current flows: faster means more amps (each 10x of current is one notch faster), and they are always spaced the same."},
	{"title": "Kirchhoff, two sentences", "eq": "sum of I at a node = 0", "body": "Whatever flows into a node flows out. Around any loop the voltages add to zero. Two batteries meeting at a node: one may be charging the other."},
]

static func steps(id: String) -> Array: return STEPS.get(id, [])

## Index of the current step for a backend that answers cond(id); -1 when none.
static func current(id: String, backend) -> int:
	var st := steps(id)
	for i in st.size():
		var s: Dictionary = st[i]
		if s.has("when") and not backend.cond(str(s.when)): continue
		if backend.cond(str(s.get("done", "never"))): continue
		return i
	return st.size() - 1 if st.size() > 0 else -1
