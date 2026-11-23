class_name Testbed
extends RefCounted
## 0.5 testbed (owner: "a comfortable simulation testbed to learn how various appliances and devices work"): on the free bench, load
## a known device with its working board, probe it live, break it on purpose and watch what happens, pause and step time.
## A device is a campaign ticket's board in the engine's sandbox (no bin, no bill) with its reference fix built. Each break is an
## edit the player could make by hand (a wire across a part, a part removed, a value swapped in place), so the engine decides what
## happens next. Numbers in the notes are the engine's own (5-1's 2000 V kick, 1-1's 604 mA), quoted from its tests.

const DEVICES := [
	{"id": "torch", "ticket": "1-1", "name": "Pocket torch", "what": "A 9 V battery lights a red LED through a 470 ohm resistor.",
		"breaks": [
			{"id": "bridge", "name": "Wire across the resistor", "what": "The LED sits straight on 9 V. Watch its current.",
				"do": [["wire", [2, 5], [6, 5]]]},
			{"id": "small_r", "name": "Swap in 47 ohm", "what": "Ten times the current through the LED.",
				"do": [["value_at", 2, 5, 47]]},
		]},
	{"id": "station", "ticket": "2-1", "name": "Weather station input", "what": "A divider brings 9 V down to 3.3 V for the ADC, with the ADC's 10 kilohm attached.",
		"breaks": [
			{"id": "unloaded", "name": "Fit the builder's divider", "what": "5.6k over 3.3k: right with nothing attached, low with the ADC on it.",
				"do": [["value_at", 4, 2, 5600], ["value_at", 8, 4, 3300]]},
			{"id": "short_top", "name": "Short the top resistor", "what": "The ADC input sees the whole supply.",
				"do": [["wire", [4, 2], [8, 2]]]},
		]},
	{"id": "fan", "ticket": "5-1", "name": "Fan driver", "what": "A 5 V pin switches a 12 V fan through a transistor, with a diode across the fan.",
		"breaks": [
			{"id": "no_diode", "name": "Remove the flyback diode", "what": "When the transistor turns off, the fan's coil kicks back. Watch the scope.",
				"do": [["delete", "1n4007"]]},
			{"id": "no_rb", "name": "Drive the base with no resistor", "what": "The pin pushes straight into the base junction.",
				"do": [["delete", "res-cf"], ["wire", [4, 7], [8, 7]]]},
		]},
	# 0.6 (D-testbed-06): the phone charger stage that 0.5 cut, and two everyday devices loaded on a host ticket's bench
	{"id": "charger", "ticket": "4-1", "safety": true, "name": "Phone charger stage", "what": "Mains through a transformer, a bridge of four diodes and a 1000 uF capacitor: smooth DC for the phone.",
		"breaks": [
			{"id": "no_cap", "name": "Remove the smoothing capacitor", "what": "The bridge alone gives bumps at 100 Hz, not DC. Watch the scope.",
				"do": [["delete", "cap-el"]]},
			{"id": "one_diode", "name": "Lose one diode", "what": "Half the bridge is gone: one bump every 20 ms instead of 10.",
				"do": [["delete", "1n4007"]]},
		]},
	{"id": "dimmer", "ticket": "5-2", "board": "dimmer", "name": "Lamp dimmer", "what": "The knob sets a voltage; a transistor and a 10 ohm resistor turn it into current for the LED strip. Wheel over the knob.",
		"breaks": [
			{"id": "short_re", "name": "Short the emitter resistor", "what": "Nothing holds the current down now. The transistor turns fully on and only the strip limits it: about 0.28 A, more than the 0.22 A the knob gives at its top.",
				"do": [["wire", [18, 12], [22, 12]]]},
			{"id": "wiper_off", "name": "Wiper wire off", "what": "The base floats: the strip goes dark whatever the knob says.",
				"do": [["unwire_at", [10, 8]]]},
		]},
	{"id": "relay_timer", "ticket": "1-3", "board": "relay_timer", "name": "Relay timer", "what": "4.7 k charges 220 uF; a transistor follows it; at 40 mA, about 2 s after power-on, the relay clicks and switches the heater on.",
		"breaks": [
			{"id": "no_cap", "name": "Remove the capacitor", "what": "Nothing to charge: the relay clicks at once.",
				"do": [["delete", "cap-el"]]},
			{"id": "big_c", "name": "Swap 220 uF for 470 uF", "what": "About twice the capacitance, so about twice the wait: the relay clicks at about 4.2 s instead of 2 s.",
				"do": [["value_at", 6, 6, 0.00047]]},
		]},
]

static func device(id: String) -> Dictionary:
	for d: Dictionary in DEVICES: if str(d.id) == id: return d
	return {}

## Open `id` on the free bench: the ticket's board in the sandbox, its reference fix built, power off, time running.
static func load_device(wb, id: String) -> bool:
	var d := device(id)
	if d.is_empty(): return false
	wb.start_free()
	wb.backend.auto_bench = false   # Dagny: the charger "passed and paid $15" on its own (the scope's LOCK auto-test)
	wb.testbed_device = id   # before any sync: the cables read it (Sigrid's dimmer shot had 5-1's PIN lead hanging to the mat)
	var b = wb.backend
	b.set_power(false)
	if not b.open_ticket(str(d.ticket)): return false
	wb._after_open()   # Sigrid (0.6): the host ticket's own board and connectors; the 3D bench kept 5-1's (a fan where 5-2's strip is, FAN and COLL labels)
	var ok := true
	if d.has("board"):
		# a board that is not the ticket's own repair (src/data/testbed.ts through the testbedBoard query), on the host ticket's bench
		var tb = b._q("testbedBoard", [str(d.board)])
		b.clear_fault()
		ok = tb is Dictionary and bool(b._act("loadBoard", [{"parts": tb.parts, "wires": tb.wires}]).get("ok", false))
		if ok:
			b._after_edit()
			for pt in tb.get("pots", []):
				for p in b.parts: if str(p.partId) == str(pt.partId): b._act("setPot", [str(p.uid), float(pt.alpha)]); wb.pot_alpha[str(p.uid)] = float(pt.alpha); wb.sync_board(); var pn = wb.parts3d.get(str(p.uid), null); if pn: pn.set_knob(float(pt.alpha))
	else: ok = b.build_ref(str(d.ticket))
	if bool(d.get("safety", false)): b.read_safety()   # mains: the testbed is the isolated bench; the card was read on the job
	b._act("setRunning", [true])
	wb.testbed_device = id; wb.testbed_paused = false
	wb._layout_for_ticket()   # the fan and the microcontroller stand on the bench only for the fan driver
	wb.note = "%s loaded. Space powers it." % str(d.name) if not b.powered else "%s loaded and powered." % str(d.name)   # Sigrid: the card already says what it is; the note repeated it word for word
	wb.set_view(2)   # Sigrid: the testbed opens in the work view like the jobs
	wb.sync_board(); wb._cables(); wb.changed.emit()
	return ok

## Apply break `brk` of the loaded device. Returns false if an edit was refused (the note says why).
static func apply_break(wb, brk: String) -> bool:
	var d := device(str(wb.testbed_device))
	var b = wb.backend
	for k: Dictionary in d.get("breaks", []):
		if str(k.id) != brk: continue
		# 0.6: a break lands with time stopped. The torch's LED burned in the first frame after the edit, before the player could
		# pause, so Step had nothing left to show. Now Step (L) runs the frame in which it happens, with the engine's numbers.
		if not wb.testbed_paused: b._act("setRunning", [false]); wb.testbed_paused = true
		var ok := true
		for step: Array in k.do:
			match str(step[0]):
				"wire": ok = bool(b.add_wire(step[1], step[2]).get("ok", false)) and ok
				"delete":
					var uid := ""
					for p in b.parts: if str(p.partId) == str(step[1]): uid = str(p.uid); break
					if uid == "": ok = false
					else: b.delete_part(uid)
				"place": ok = bool(b.place({"partId": step[1], "value": step[2], "variant": step[3], "kind": "R"}, int(step[4]), int(step[5]), int(step[6])).get("ok", false)) and ok
				"unwire_at":   # the wire with an end on pad (x, y) comes off
					var wid := ""
					for w in b.wires: if (w.a[0] == step[1][0] and w.a[1] == step[1][1]) or (w.b[0] == step[1][0] and w.b[1] == step[1][1]): wid = str(w.wid)
					ok = wid != "" and bool(b.delete_wire(wid).get("ok", false)) and ok
				"value_at":   # the part whose origin pad is (x, y) takes a new value in place; its wires stay
					var uid2 := ""
					for p in b.parts: if int(p.get("x", -1)) == int(step[1]) and int(p.get("y", -1)) == int(step[2]): uid2 = str(p.uid)
					ok = uid2 != "" and bool(b.set_value(uid2, float(step[3])).get("ok", false)) and ok
		wb.note = "%s. %s Paused: Step (L) runs one frame, Run (K) goes on." % [str(k.name), str(k.what)]
		wb.sync_board(); wb.changed.emit()
		return ok
	return false

## Pause or run the simulation. While paused the bench holds every reading where it is.
static func set_running(wb, on: bool) -> void:
	wb.backend._act("setRunning", [on])
	wb.testbed_paused = not on
	wb.note = "Running." if on else "Paused. Step moves the simulation one frame."
	wb.changed.emit()

## One simulation frame forward while paused.
static func step_once(wb) -> void:
	var b = wb.backend
	if not b.powered: return
	b._act("setRunning", [true]); b._act("advance", [1]); b._act("setRunning", [false])
	b._refresh_live(); b._rebuild_model()
	wb.sync_board(); wb.changed.emit()
