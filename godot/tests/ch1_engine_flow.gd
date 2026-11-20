extends SceneTree
## Chapter 1 end to end on the real engine, through the stall's UI layer (pointer drags for parts, wires and probes, a click on the rocker, the dial and the
## BENCH key, typed predictions). All five tickets are played to their reference designs and to LOCK, and the designed naive builds fail:
##   godot --headless --path godot -s res://tests/ch1_engine_flow.gd         (exit code 0 = all green; needs godot/sidecar/bridge.mjs)
## Time is the only thing not pointer-driven: the test advances the play clock with backend.step(dt) so the run is deterministic.
var sc: StallScene
var bk: EngineBench
var fails := 0
var checks := 0
var evlog: Array = []

func _initialize() -> void:
	OS.set_environment("CB_NOSAVE", "1")
	_run()

func ok(cond: bool, what: String) -> void:
	checks += 1
	if cond: print("  ok   ", what)
	else: fails += 1; print("  FAIL ", what)

func _frames(n: int) -> void:
	for i in n: await process_frame

func _clock(seconds: float, until := Callable()) -> void:   # advance the play clock; stop early when `until` is true
	var n := int(seconds / 0.05)
	for i in n:
		bk.step(0.05)
		if until.is_valid() and until.call(): return

## ---------------------------------------------------------------------------------------------------------------- UI helpers

func _slot(partId: String, value, variant := "") -> int:
	var items: Array = bk.bin()
	for i in items.size():
		var it: Dictionary = items[i]
		if it.partId != partId: continue
		if value != null and (it.value == null or absf(float(it.value) - float(value)) > 1e-9): continue
		if variant != "" and it.variant != variant: continue
		return i
	return -1

func _drag_part(partId: String, value, variant: String, x: int, y: int, r: int) -> bool:   # (x, y) = pin 1's pad, like the engine
	var idx := _slot(partId, value, variant)
	if idx < 0: return false
	var slots := StallProps.slots(sc.props.box_inner(), sc.props.items.size(), sc.props.bin_scroll)
	var rect: Rect2 = slots[idx]
	if rect.size == Vector2.ZERO:   # scrolled out of view: scroll the box until the slot shows
		for k in 8:
			sc.props.bin_scroll = k
			slots = StallProps.slots(sc.props.box_inner(), sc.props.items.size(), sc.props.bin_scroll)
			rect = slots[idx]
			if rect.size != Vector2.ZERO: break
	var c := rect.get_center()
	sc._motion(c); sc._press(c)
	sc.rot = r
	var pins: Array = bk.pins_of(sc.props.items[idx], 0, 0, r)
	var mid: Vector2 = (pins[0] + pins[1]) * 0.5
	var at := sc.pad_screen(Vector2(x, y) + mid)
	sc._motion(at); sc._board_overlay()
	var before := bk.parts.size()
	sc._release(at)
	return bk.parts.size() == before + 1

func _drag_wire(a: Array, b: Array) -> bool:
	var before := bk.wires.size()
	var pa := sc.pad_screen(Vector2(a[0], a[1])); var pb := sc.pad_screen(Vector2(b[0], b[1]))
	sc._motion(pa); sc._press(pa); sc._motion(pb); sc._release(pb)
	return bk.wires.size() == before + 1

func _drag_probe(which: String, pad: Array) -> void:
	var tip: Vector2 = sc._probe_tip(which)
	sc._motion(tip); sc._press(tip)
	var at := sc.pad_screen(Vector2(pad[0], pad[1]))
	sc._motion(at); sc._board_overlay(); sc._release(at)

func _rocker() -> void:
	var p: Vector2 = sc.supply.position + SupplyView.ROCKER.get_center() * sc.supply.scale.x
	sc._motion(p); sc._press(p)

func _bench_key() -> void:
	var p: Vector2 = (sc.L.bench as Rect2).get_center()
	sc._motion(p); sc._press(p)

func _dial_to(mode: String) -> void:   # click the right half of the dial until the knob points at `mode` (a frame between clicks: the dial redraws from the backend)
	for i in 5:
		if bk.dial == mode: return
		var p: Vector2 = sc.dmm.position + (DmmView.DIAL_C + Vector2(40, 0)) * sc.dmm.scale.x
		sc._motion(p); sc._press(p)
		await process_frame

func _drop_probe(which: String) -> void:   # pick a lead up and let go off the board: it comes off its pad
	var tip: Vector2 = sc._probe_tip(which)
	sc._motion(tip); sc._press(tip)
	sc._motion(Vector2(40, 40)); sc._release(Vector2(40, 40))

func _key(code: Key, uni := 0) -> void:
	var e := InputEventKey.new(); e.pressed = true; e.keycode = code; e.unicode = uni
	sc._unhandled_key_input(e)

func _type(s: String) -> void:
	for ch in s: _key(OS.find_keycode_from_string(ch) if ch != "." else KEY_PERIOD, ch.unicode_at(0))

func _build(id: String) -> bool:   # the level's reference design, dragged in by pointer
	var R: Dictionary = EngineBench.REFS[id]
	var good := true
	for p in R.parts: good = _drag_part(str(p[0]), p[1], str(p[2]), int(p[3]), int(p[4]), int(p[5])) and good
	for w in R.wires:
		var path: Array = w
		good = _drag_wire(path[0], path[path.size() - 1]) and good
	return good

func _start(id: String) -> void:
	sc.start_ticket(id)
	await _frames(4)
	evlog.clear()

## ---------------------------------------------------------------------------------------------------------------- run

func _run() -> void:
	sc = StallScene.new(); root.add_child(sc)
	await _frames(6)
	if not sc.backend.ENGINE:
		print("FAIL the engine sidecar did not start (build it: npx vite build -c vite.bridge.config.ts)"); quit(2); return
	bk = sc.backend
	bk.event.connect(func(n, _d): evlog.append(n))
	var wallet0: int = bk.wallet_minor
	print("== 1-1 Torch")
	await _start("1-1")
	ok(sc.pages.mode == "", "the bench is open, no modal over it")
	_drag_part("led-red-5mm", null, "5mm", 8, 5, 0)
	_drag_wire([2, 2], [8, 5]); _drag_wire([10, 5], [8, 2])
	var cv: Dictionary = bk.coach_view()
	ok(str(cv.steps[cv.cur].id) == "power-on", "after LED + wires Wren says: power on (engine coach)")
	_rocker()
	ok(bk.powered, "the rocker powers the bench")
	_clock(0.5)
	ok(bk.smoked.size() == 1 and evlog.has("smoked"), "NAIVE: the LED straight on the 9 V battery smokes on the first frame")
	var pf: Dictionary = bk._frame_part("p1")
	ok(str(bk.frame.events[0].kind) == "crack" and pf.led.mood == "cracked", "crack event and a cracked LED face, both from the engine")
	ok(bk.model.led["p1"].mood == "cracked", "the view model hands the face the engine's mood")
	await _frames(3)
	ok(sc.props.mood == "wow", "the customer reacts to the smoke")
	cv = bk.coach_view()
	ok(str(cv.steps[cv.cur].id) == "undo-smoke" and str(cv.steps[cv.cur].target) == "box:res-cf", "the arrow points at the resistor in the shoebox")
	# take the burnt LED off (right-click), then build the reference torch
	sc._right(sc.pad_screen(Vector2(9, 5)))
	ok(bk.part_by("p1").is_empty(), "right-click removes the burnt LED")
	sc.start_ticket("1-1"); await _frames(3); evlog.clear()
	ok(_build("1-1"), "the reference torch (470 ohm + LED) is built by pointer")
	_rocker()
	_clock(0.6)
	var mA: float = bk.scope_value()
	ok(mA > 14.9 and mA < 15.0, "the scope reads the engine's 14.96 mA (%.3f)" % mA)
	ok(bk.locked and sc.scope.sc.lo == 10.0 and sc.scope.sc.hi == 20.0, "LOCK in the engine's 10 - 20 mA band")
	var lm: Dictionary = bk.model.led["p2"]
	ok(lm.mood == "happy" and lm.bloom > 0.5, "the LED face is happy at 15 mA (engine mood, bloom %.2f)" % lm.bloom)
	_clock(4.0, func(): return bk.passed)
	ok(bk.passed and evlog.has("paid"), "holding LOCK runs the bench and the customer pays")
	await create_timer(0.9).timeout
	ok(sc.props.mood == "joy" and sc.done.get("1-1", false), "Lio is happy; 1-1 is fixed")
	ok(bk.wallet_minor == wallet0 + 500 and bk.wallet_text == "$5.00", "the coin tin shows the engine wallet (%s)" % bk.wallet_text)

	print("== 1-2 Tail-light (fresh AND tired battery)")
	await _start("1-2")
	var conds: Array = bk.ticket.conditions
	ok(conds.size() == 2 and str(conds[0].id) == "fresh" and str(conds[1].id) == "tired", "the ticket carries both battery conditions: fresh and tired")
	ok(sc.supply.conditions.size() == 2, "the battery holder shows the bench-test tag")
	# naive: 180 ohm passes the live (fresh) band but the bench's tired battery fails it
	var R2: Dictionary = EngineBench.REFS["1-2"]
	_drag_part("res-cf", 180, "0.25W", 2, 5, 0)
	for k in 3: _drag_part("led-red-5mm", null, "5mm", [8, 14, 18][k], 5, 0)
	for w in R2.wires: _drag_wire((w as Array)[0], (w as Array)[(w as Array).size() - 1])
	_rocker()
	_clock(5.0, func(): return evlog.has("bench_failed"))
	ok(bk.locked and not bk.passed and evlog.has("bench_failed"), "NAIVE: 180 ohm locks live (fresh) but fails the bench on the tired battery")
	ok(bk.last_result.failures.size() > 0, "the engine explains the failure (%s)" % str(bk.last_result.failures[0].text).left(60))
	await _start("1-2")
	ok(_build("1-2"), "the reference tail-light (150 ohm + 3 LEDs in series) is built by pointer")
	_rocker()
	_clock(6.0, func(): return bk.passed)
	var g2: float = bk.scope_value()
	ok(bk.passed and g2 >= 14.0 and g2 <= 20.0, "LOCK and a bench pass at %.2f mA (14 - 20)" % g2)
	ok(bk.wallet_minor == wallet0 + 500 + 700, "paid 7.00 (%s)" % bk.wallet_text)
	await create_timer(0.7).timeout

	print("== 1-3 Hot Resistor")
	await _start("1-3")
	var tg: Dictionary = bk.scope_q.target
	ok(tg.lo == 7.85 and tg.hi == 8.4, "the band is the engine's 7.85 - 8.40 V (no widened fixture band)")
	ok(sc.scope.sc.mode == "probe", "the scope measures a node voltage: it needs the CH1 clip")
	# naive: 22 ohm 1/4 W
	_drag_part("res-cf", 22, "0.25W", 4, 2, 0)
	_drag_wire([2, 2], [4, 2]); _drag_wire([8, 2], [14, 2])
	_rocker()
	_clock(0.5); await _frames(2)
	ok(not sc.scope.attached, "unclipped: the trace sits on the baseline and the VFD asks for the clip")
	_drag_probe("ch1", [14, 2])
	ok(bk.probes.ch1 == [14, 2], "dragging the CH1 clip onto the OUT pad attaches the probe")
	_clock(0.4); await _frames(2)
	ok(sc.scope.attached and absf(bk.scope_value() - 8.3333) < 0.01, "the clipped trace reads the engine's 8.333 V")
	ok(float(bk.model.ambient) == 50.0, "the frame's ambient is the warm hood, 50 C")
	var seen := {"hot": false}
	_clock(30.0, func():
		if bk.hot_k() > 0.3 and bk.smoked.is_empty(): seen.hot = true
		return not bk.smoked.is_empty())
	ok(seen.hot, "the 1/4 W resistor glows (warm / hot state from the engine) before it goes")
	ok(bk.smoked.size() == 1 and evlog.has("smoked"), "NAIVE: 22 ohm 1/4 W smokes after thermal time (0.61 W in 0.25 W) %s %s" % [str(bk.smoked.keys()), str(evlog)])
	ok(str(bk.frame.events[0].kind) == "smoke" and str(bk.frame.events[0].text).contains("rated"), "the smoke explanation names the rating")
	await _frames(3)
	ok(sc.props.hot > 0.5 or sc.props.smoked, "Rezzy is awake")
	# the Omega mode on the DMM: heater in parallel with what the zeroed supply leaves
	await _start("1-3")
	ok(_build("1-3"), "the reference (22 ohm 1 W) is built by pointer")
	_drag_probe("red", [14, 2]); _drag_probe("black", [14, 8])
	ok(bk.dial == "V" and bk.probes.red == [14, 2], "placing the first lead turns the DMM dial to V")
	await _dial_to("Ω")
	_clock(0.3)
	var ohm: Dictionary = bk.dmm()
	ok(bk.dial == "Ω" and ohm.unit == "Ω" and float(ohm.text) > 14.0 and float(ohm.text) < 16.5, "DMM in ohm mode reads the engine's resistance across the heater: %s %s" % [ohm.text, ohm.unit])
	await _dial_to("V")
	_rocker()
	_drag_probe("ch1", [14, 2])
	_clock(0.4)
	ok(bk.dmm().text.begins_with("8.3"), "DMM volts across the heater: %s V" % bk.dmm().text)
	_clock(6.0, func(): return bk.passed)
	ok(bk.passed, "22 ohm 1 W locks 8.33 V and passes the bench")
	ok(bk.last_result.stars == 1 and bk.last_result.metrics.cost == 7, "Ref A earns 1 star at 7 c: the cheaper Ref B has the cost par")
	# the ammeter: the DMM between its leads across the series resistor reads the heater current (0.1 ohm burden)
	_drag_probe("red", [4, 2]); _drag_probe("black", [8, 2])
	await _dial_to("mA")
	_clock(0.3)
	var am: Dictionary = bk.dmm()
	ok(am.unit == "mA" and am.text.is_valid_float() and float(am.text) > 230.0 and float(am.text) < 245.0, "DMM in mA mode across the resistor reads the engine's current: %s mA" % am.text)
	await create_timer(0.7).timeout

	print("== 1-4 Tired Battery")
	await _start("1-4")
	ok(bk.ticket.supply.tired and sc.supply.tired, "the battery holder wears the 'tired' sticker (the engine's tired PP3)")
	_rocker()
	_drag_probe("red", [2, 2]); _drag_probe("black", [8, 2])
	_clock(0.3)
	var oc: Dictionary = bk.dmm()
	ok(oc.unit == "V" and float(oc.text) > 8.9 and float(oc.text) < 9.1, "open-circuit voltage on the DMM: %s V" % oc.text)
	_rocker()
	_drop_probe("red"); _drop_probe("black")
	ok(bk.probes.red == null and bk.probes.black == null, "dropping a lead off the board takes it off its pad")
	ok(_build("1-4"), "the reference load (4.7 ohm 5 W) is built by pointer")
	_rocker()
	_drag_probe("red", [2, 2]); _drag_probe("black", [8, 2])
	_clock(0.3)
	var lv: Dictionary = bk.dmm()
	ok(float(lv.text) > 4.4 and float(lv.text) < 4.6, "loaded terminal voltage sags to %s V" % lv.text)
	_clock(6.0, func(): return bk.passed)
	ok(bk.passed and bk.scope_value() >= 4.2, "LOCK at %.2f W (at least 4.2) and a bench pass" % bk.scope_value())
	await create_timer(0.7).timeout

	print("== 1-5 EB Two Batteries (predict first)")
	await _start("1-5")
	ok(sc.pages.mode == "predict" and sc.pages.pred_fields.size() == 2, "the exam slip asks for V(A) and I(E2) before building")
	_type("6.6667"); _key(KEY_TAB); _type("0.5556")
	ok(sc.pages.pred_fields[0].text == "6.6667" and sc.pages.pred_fields[1].text == "0.5556", "digits typed into the slip fields")
	_key(KEY_ENTER)
	ok(sc.pages.mode == "" and bk.predictions_done(), "Enter locks both predictions into the engine")
	ok(_build("1-5"), "the exam bridge (R1 2, R2 3, R3 6 ohm) is built by pointer")
	_rocker()
	_drag_probe("ch1", [8, 6])
	_clock(0.4); await _frames(2)
	ok(sc.scope.attached and absf(bk.scope_value() - 6.6667) < 0.001, "V(A) on the scope: %.4f V" % bk.scope_value())
	ok(bk.locked, "LOCK on the 0.1 % band")
	_bench_key()
	ok(bk.passed and bk.last_result.stars == 3, "the BENCH key checks the predictions and the build: 3 stars (%s)" % str(bk.last_result.predictions.map(func(p): return p.gradeText)))
	await create_timer(0.7).timeout
	# a missing prediction refuses the bench
	await _start("1-5")
	_key(KEY_ESCAPE)
	ok(_build("1-5"), "second go: build before predicting")
	_rocker(); _drag_probe("ch1", [8, 6]); _clock(0.3)
	_bench_key()
	ok(not bk.passed and sc.pages.mode == "predict", "the bench refuses until the predictions are in, and the slip opens again")
	_key(KEY_ESCAPE)

	print("== the chapter map")
	sc.go_map(); await _frames(3)
	var done_n := 0
	for tk in sc.pages.tickets: if tk.done: done_n += 1
	ok(done_n == 5 and sc.pages.wallet_text == bk.wallet_text, "the map shows five FIXED chits and the engine wallet (%s)" % sc.pages.wallet_text)
	print("\n%d checks, %d failed" % [checks, fails])
	quit(1 if fails > 0 else 0)
