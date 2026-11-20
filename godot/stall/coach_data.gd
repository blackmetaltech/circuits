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
	{"title": "Power, three ways", "eq": "P = VI = I\u00b2R = V\u00b2/R", "body": "Watts are volts times amps. With Ohm's law that is also I squared times R (use it when the current is known) or V squared over R (when the volts are). A rating is the most power a part may turn into heat. A source gives a load its most power when the load R equals the source's own r: that is the 1-4 trick."},
	{"title": "Tired batteries", "eq": "V = E - I x r", "body": "A battery is a perfect source with a small resistor inside. The tired ones have a bigger r, so the voltage sags under load. Most power goes into a load equal to r."},
	{"title": "The critters", "eq": "speed ~ log(I)", "body": "The critters' speed shows how much current flows: faster means more amps (each 10x of current is one notch faster), and they are always spaced the same."},
	{"title": "Node voltage: one equation", "eq": "sum (E - A) / R = A / R3", "body": "Call the junction A and write the currents into it: (10 - A)/2 + (5 - A)/3 = A/6. One unknown, so solve it: A = 6.667 V. A battery whose volts are lower than A is being charged (current flows INTO it); a higher one discharges. Check the sign of each current."},
	{"title": "Kirchhoff, two sentences", "eq": "sum of I at a node = 0", "body": "Whatever flows into a node flows out. Around any loop the voltages add to zero. Two batteries meeting at a node: one may be charging the other."},
	{"title": "The voltage divider", "eq": "Vout = Vin x R2 / (R1 + R2)", "body": "Two resistors in series share the voltage in proportion to their sizes: the same current flows through both, so the bigger resistor takes the bigger share. The output is taken from the middle, across R2. This is how a 9 V supply becomes the 3.3 V a sensor wants, as long as nothing else is connected to the middle."},
	{"title": "A load is part of the divider", "eq": "Vout = Vin x (R2 || RL) / (R1 + R2 || RL)", "body": "Whatever you connect to OUT sits in parallel with R2. The ADC's 10 kilohm and your R2 together are smaller than R2 alone, so the output sags below the unloaded formula: 5.6 k over 3.3 k looks like 3.34 V on paper and is 2.76 V with the ADC attached. Count the load in as a resistor, or make R2 much smaller than the load (but then the divider wastes power: that is the second star)."},
	{"title": "Thevenin and Norton", "eq": "Vth = Voc     Rth = Voc / Isc", "body": "Any network seen from two terminals behaves like one source and one resistor. Measure the open-circuit voltage (nothing connected): that is the source. Measure the short-circuit current (the meter on mA straight across): the volts divided by the amps is the resistance. A Norton source is the same thing drawn as a current Isc with Rth across it. The sealed box is 8.00 V behind 1137 ohm, and matching only the voltage is not enough: the series resistance sets how much it sags under load."},
	{"title": "The Wheatstone bridge", "eq": "R / X = l / (100 - l)", "body": "Two resistors in a row form one arm of a bridge, the slide wire is the other. When the galvanometer between the two middle points reads zero, the two ratios are equal: R / X = l / (100 - l), where l is the jockey's distance from R's end. So X = R x (100 - l) / l. The cable's loop resistance is 0.1 ohm per metre, out and back, so d = X / 0.1. No current flows at balance, so the meter's own resistance and the cell's voltage drop out."},
	{"title": "Null methods", "eq": "keep l near 50 cm", "body": "A null reading asks nothing of the meter except 'is it zero?', which is why a bridge is so accurate. Where the null lands matters: reading the jockey to a millimetre is a bigger fraction of l near the ends of the wire than in the middle. Choose R close to X and the balance lands near 50 cm."},
	{"title": "The potentiometer", "eq": "E = k l     r = R (l1 - l2) / l2", "body": "A driver cell sends one current down a long wire, so the voltage along it grows evenly: k volts per cm (4 V through 10 + 10 ohm is 0.2 A, 2 V across 100 cm, k = 0.02 V/cm). A cell balances when the wire's voltage between A and the jockey equals the cell's EMF, with no current drawn from the cell: E = k l1. Shunt the cell with R and it balances at l2, where V = k l2: the missing volts were lost inside, r = R (l1 - l2) / l2. Only the ratio l1 / l2 enters, so a driver cell with some resistance of its own changes k but not the answer."},
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
