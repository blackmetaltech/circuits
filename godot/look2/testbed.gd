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
]

static func device(id: String) -> Dictionary:
	for d: Dictionary in DEVICES: if str(d.id) == id: return d
	return {}

## Open `id` on the free bench: the ticket's board in the sandbox, its reference fix built, power off, time running.
static func load_device(wb, id: String) -> bool:
	var d := device(id)
	if d.is_empty(): return false
	wb.start_free()
	var b = wb.backend
	b.set_power(false)
	if not b.open_ticket(str(d.ticket)): return false
	var ok: bool = b.build_ref(str(d.ticket))
	b._act("setRunning", [true])
	wb.testbed_device = id; wb.testbed_paused = false
	wb._layout_for_ticket()   # the fan and the microcontroller stand on the bench only for the fan driver
	wb.note = "%s. %s" % [str(d.name), str(d.what)]
	wb.sync_board(); wb.changed.emit()
	return ok

## Apply break `brk` of the loaded device. Returns false if an edit was refused (the note says why).
static func apply_break(wb, brk: String) -> bool:
	var d := device(str(wb.testbed_device))
	var b = wb.backend
	for k: Dictionary in d.get("breaks", []):
		if str(k.id) != brk: continue
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
				"value_at":   # the part whose origin pad is (x, y) takes a new value in place; its wires stay
					var uid2 := ""
					for p in b.parts: if int(p.get("x", -1)) == int(step[1]) and int(p.get("y", -1)) == int(step[2]): uid2 = str(p.uid)
					ok = uid2 != "" and bool(b.set_value(uid2, float(step[3])).get("ok", false)) and ok
		wb.note = "%s. %s" % [str(k.name), str(k.what)]
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
