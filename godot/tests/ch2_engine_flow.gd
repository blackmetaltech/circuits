extends SceneTree
## Chapter 2 "Divide & Measure" end to end on the real engine, through the stall's UI layer (pointer drags for parts, wires, probes and the jockey, clicks on the rocker, the
## supply keys, the dial and the BENCH key, typed predictions and answers). All four tickets are played to their reference designs and the designed naive builds fail:
##   godot --headless --path godot -s res://tests/ch2_engine_flow.gd         (exit code 0 = all green; needs godot/sidecar/bridge.mjs)
## Every Godot error the run logs is counted by the ErrorTrap (zero SCRIPT ERROR is a check of its own). Time is advanced with backend.step(dt), so the run is deterministic.
var sc: StallScene
var bk: EngineBench
var fails := 0
var checks := 0
var evlog: Array = []
var trap := ErrorTrap.new()
const NO_ID := "\\b[pf]\\d+\\b"   # a part id (p1, f2) must never reach the player's eyes

func _initialize() -> void:
	OS.set_environment("CB_NOSAVE", "1"); OS.set_environment("CB_LAYOUT", "desktop")
	OS.add_logger(trap)
	_run()

func ok(cond: bool, what: String) -> void:
	checks += 1
	if cond: print("  ok   ", what)
	else: fails += 1; print("  FAIL ", what)

func _no_id(s: String) -> bool:
	var re := RegEx.new(); re.compile(NO_ID)
	return re.search(s) == null

func _frames(n: int) -> void:
	for i in n: await process_frame

func _clock(seconds: float, until := Callable()) -> void:
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

func _drag_part(partId: String, value, variant: String, x: int, y: int, r: int) -> bool:
	var idx := _slot(partId, value, variant)
	if idx < 0: return false
	var inner0: Rect2 = sc.props.box_inner()
	sc.props.bin_scroll = clampf(float(idx), 0.0, StallProps.max_scroll(inner0, sc.props.items.size()))
	var slots := StallProps.slots(inner0, sc.props.items.size(), sc.props.bin_scroll)
	var rect: Rect2 = (slots[idx] as Rect2).intersection(inner0)
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
	if bk.wires.size() != before + 1: print("   (wire %s -> %s not added: %s)" % [str(a), str(b), sc.top.toast])
	return bk.wires.size() == before + 1

func _drag_probe(which: String, pad: Array) -> void:
	var tip: Vector2 = sc._probe_tip(which)
	sc._motion(tip); sc._press(tip)
	var at := sc.pad_screen(Vector2(pad[0], pad[1]))
	sc._motion(at); sc._board_overlay(); sc._release(at)

func _rocker() -> void:
	var p: Vector2 = sc.supply.position + SupplyView.ROCKER.get_center() * sc.supply.scale.x
	sc._motion(p); sc._press(p)

func _supply_key(r: Rect2) -> void:
	var p: Vector2 = sc.supply.position + r.get_center() * sc.supply.scale.x
	sc._motion(p); sc._press(p)

func _bench_key() -> void:
	var p: Vector2 = (sc.L.bench as Rect2).get_center()
	sc._motion(p); sc._press(p)

func _dial_to(mode: String) -> void:
	for i in 5:
		if bk.dial == mode: return
		var p: Vector2 = sc.dmm.position + (DmmView.DIAL_C + Vector2(40, 0)) * sc.dmm.scale.x
		sc._motion(p); sc._press(p)
		await process_frame

func _key(code: Key, uni := 0) -> void:
	var e := InputEventKey.new(); e.pressed = true; e.keycode = code; e.unicode = uni
	sc._unhandled_key_input(e)

func _type(s: String) -> void:
	for ch in s: _key(OS.find_keycode_from_string(ch) if ch != "." else KEY_PERIOD, ch.unicode_at(0))

func _build(id: String) -> bool:
	var R: Dictionary = EngineBench.REFS_CH2[id]
	var good := true
	for p in R.parts: good = _drag_part(str(p[0]), p[1], str(p[2]), int(p[3]), int(p[4]), int(p[5])) and good
	for w in R.wires:
		var path: Array = w
		good = _drag_wire(path[0], path[path.size() - 1]) and good
	return good

func _start(id: String) -> void:
	sc.size = Vector2(1920, 1080)
	sc.start_ticket(id)
	await _frames(4)
	evlog.clear()

## A press on a grid point of the board (the slide wire's rule, its jockey keys).
func _press_grid(g: Vector2) -> void:
	var p := sc.pad_screen(g); sc._motion(p); sc._press(p); sc._release(p)

func _key_pos(name: String) -> Vector2:   # the centre of one of the jockey keys, in grid coordinates
	var g: Dictionary = sc._slide_geom(); var xs: Array = StallScene.NUDGE_X[name]
	return Vector2(g.a.x + (float(xs[0]) + float(xs[1])) * 0.5, g.a.y + 2.95)

## ---------------------------------------------------------------------------------------------------------------- run

func _run() -> void:
	sc = StallScene.new(); root.add_child(sc)
	sc.set_anchors_and_offsets_preset(Control.PRESET_TOP_LEFT); sc.size = Vector2(1920, 1080)
	await _frames(6)
	if not sc.backend.ENGINE:
		print("FAIL the engine sidecar did not start (build it: npx vite build -c vite.bridge.config.ts)"); quit(2); return
	bk = sc.backend
	bk.event.connect(func(n, _d): evlog.append(n))
	print("== chapter map: chapter 2 unlocks after 1-4 or the exam")
	bk.new_game()
	sc.map_chapter = 2; sc._refresh_pages()
	ok(sc.pages.tickets.size() == 4 and sc.pages.map_title == "Divide & Measure", "the map shows chapter 2's four chits with the engine's title")
	ok(str(sc.pages.tickets[0].state) == "locked" and not bool(sc.pages.chapter_open[1]), "on a fresh save the whole page is locked (%s)" % str(sc.pages.tickets.map(func(t): return t.state)))
	ok(bool(sc.pages.tickets[3].eb), "2-4 is marked as the exam")
	bk.unlock_through("2-1")
	sc._refresh_pages()
	ok(str(sc.pages.tickets[0].state) == "open" and bool(sc.pages.chapter_open[1]), "after chapter 1 (the reference designs) 2-1 is open")
	sc.go_map(); await _frames(3)
	ok(sc.pages.mode == "map", "the map page opens")

	print("== 2-1 Sensor Reference")
	await _start("2-1")
	ok(bk.ticket.supply.kind == "bench" and sc.supply.kind == "bench" and not sc.supply.adjustable, "a fixed 9 V bench supply (no voltage keys on this ticket)")
	var fixed: Array = bk.parts.filter(func(p): return p.fixed)
	ok(fixed.size() == 1 and str(fixed[0].kind) == "LOAD" and str(fixed[0].partId) == "adc-in", "the ADC is a fixed part on the board")
	ok(sc.props.items.size() == 25 and str(sc.props.items[0].label).begins_with("1"), "the shoebox lists the 25 E12 values from 1 k to 100 k")
	ok(str(bk.ticket.spec_full) == "OUT 3.23-3.37 V, ADC attached" and bk.scope_q.target.lo == 3.234 and bk.scope_q.target.hi == 3.366, "the chit reads the engine's one-line spec and the band is 3.234 - 3.366 V")
	# naive: the unloaded divider answer, 5.6 k over 3.3 k
	_drag_part("res-cf", 5600, "0.25W", 4, 2, 0); _drag_part("res-cf", 3300, "0.25W", 8, 4, 1)
	for w in [[[2, 2], [4, 2]], [[8, 2], [14, 2]], [[8, 4], [8, 2]], [[8, 8], [14, 8]]]: _drag_wire(w[0], w[w.size() - 1])
	_rocker(); _clock(0.5)
	sc.run_bench(); await _frames(2)
	ok(evlog.has("bench_failed") and sc.top.toast.contains("2.76 V") and sc.top.toast.contains("10 kΩ") and sc.top.toast.contains("parallel") and _no_id(sc.top.toast), "NAIVE 5.6 k / 3.3 k: the bench explains the load in plain words: %s" % sc.top.toast.left(80))
	var cv: Dictionary = bk.coach_view()
	ok(cv.steps.size() == 7 and str(cv.steps[cv.cur].id) == "measure", "the coach asks for a meter reading (%s)" % str(cv.steps[cv.cur].id))
	await _start("2-1")
	ok(_build("2-1"), "the reference divider (15 k over 82 k) is built by pointer")
	_rocker(); _drag_probe("ch1", [14, 2])
	_clock(0.5); await _frames(2)
	ok(bk.locked and sc.scope.attached and absf(bk.scope_value() - 3.3545) < 0.01, "LOCK: the clipped trace reads the engine's 3.35 V (%.4f)" % bk.scope_value())
	_drag_probe("red", [14, 2]); _drag_probe("black", [14, 8]); _clock(0.3)
	ok(bk.dmm().text == "3.355" or str(bk.dmm().text).begins_with("3.35"), "the DMM reads the loaded 3.355 V (%s)" % str(bk.dmm().text))
	_clock(4.0, func(): return bk.passed)
	ok(bk.passed and evlog.has("paid"), "holding LOCK runs the bench and pays")
	await create_timer(0.9).timeout
	ok(sc.props.mood == "joy" and str(bk.ticket.thanks).contains("3.3") and sc.done.get("2-1", false), "Kaya is happy; 2-1 is fixed")
	ok(bk.last_result.stars == 2 and bk.last_result.metrics.power < 3400, "two stars: the low-power divider (%d uW)" % int(bk.last_result.metrics.power))

	print("== 2-2 Cable Fault")
	await _start("2-2")
	ok(sc.props.gadget == "cable" and not sc.props.crew.is_empty(), "the foreman's crew slip is on the bench")
	var wire0: Dictionary = bk.slide_part()
	ok(not wire0.is_empty() and wire0.fixed and wire0.pins.size() == 3 and wire0.pins[1] == [12, 9], "the slide wire is a fixed part with the jockey terminal at (12, 9)")
	ok(sc.supply.kind == "sources" and sc.supply.sources_title == "ON THE BENCH", "the supply panel lists the lab cell")
	ok(_drag_part("galvanometer", null, "100ohm", 13, 8, 0) and _drag_part("res-box", 5, "plug", 3, 5, 0), "the galvanometer and the 5 ohm plug are dragged in")
	ok(sc.props.items.filter(func(it): return it.partId == "res-box").size() == 5, "the resistance box offers the plugs 1, 2, 5, 10, 20")
	for w in EngineBench.REFS_CH2["2-2"].wires: _drag_wire((w as Array)[0], (w as Array)[(w as Array).size() - 1])
	cv = bk.coach_view()
	ok(str(cv.steps[cv.cur].id) == "power", "the coach asks for power once the bridge is wired (%s)" % str(cv.steps[cv.cur].id))
	_rocker(); _clock(0.5)
	# the jockey: a drag on the wire puts it under the pointer, the keys and arrows move it finely
	var gp := Vector2(10, 11)
	sc._motion(sc.pad_screen(gp)); sc._press(sc.pad_screen(gp)); sc._release(sc.pad_screen(gp))
	ok(absf(bk.jockey_mm() - 400.0) < 0.5, "pressing the wire at the 40 cm mark puts the jockey there (%.1f mm)" % bk.jockey_mm())
	sc._motion(sc.pad_screen(Vector2(10.5, 11))); sc._press(sc.pad_screen(Vector2(10.5, 11)))
	ok(absf(bk.jockey_mm() - 425.0) < 0.5, "a press on the wire is a coarse jockey move (%.1f mm)" % bk.jockey_mm())
	sc._release(sc.pad_screen(Vector2(10.5, 11)))
	bk.set_jockey(400.0); _clock(0.3)
	ok(bk.locked and absf(bk.frame.parts.filter(func(p): return p.has("galvo"))[0].galvo.uA) < 0.1, "at 40.0 cm the needle is on zero and the scope locks (engine null)")
	_key(KEY_RIGHT)
	ok(absf(bk.jockey_mm() - 401.0) < 0.01, "the right arrow moves the jockey one step (1 mm): %.1f" % bk.jockey_mm())
	_clock(0.2)
	var gv: Dictionary = bk.frame.parts.filter(func(p): return p.has("galvo"))[0].galvo
	ok(gv.uA > 15.0 and gv.needle > 0.3 and not bk.locked, "one millimetre off: the needle is at %.1f uA (needle %.2f) and the lock is gone" % [gv.uA, gv.needle])
	_press_grid(_key_pos("step"))
	ok(is_equal_approx(bk.jockey_step_mm(), 0.1), "the step key switches the jockey to 0.1 mm (%.1f)" % bk.jockey_step_mm())
	_press_grid(_key_pos("minus")); _press_grid(_key_pos("minus"))
	ok(absf(bk.jockey_mm() - 400.8) < 0.01, "two presses of the minus key: %.1f mm" % bk.jockey_mm())
	for i in 8: _key(KEY_LEFT)
	_clock(0.3)
	ok(absf(bk.jockey_mm() - 400.0) < 0.01 and bk.locked, "eight 0.1 mm steps back: 400.0 mm and LOCK")
	ok(str(bk.slide_part().pos_text) == "40.00 cm", "the jockey flag reads the engine's 40.00 cm (%s)" % str(bk.slide_part().pos_text))
	# no answer yet: BENCH says so and opens the slip; nothing is benched by itself
	_clock(2.0)
	ok(not bk.passed and not evlog.has("bench_failed"), "LOCK alone does not bench the ticket: the answer is still missing")
	_bench_key()
	ok(sc.pages.mode == "predict" and sc.top.toast.contains("Write your answer"), "BENCH without an answer opens the crew's slip (%s)" % sc.top.toast.left(40))
	ok(sc.pages.pred_fields.size() == 1 and str(sc.pages.pred_fields[0].unit) == "m" and sc.pages.pred_head.contains("crew"), "the slip has one line, in metres: %s" % sc.pages.pred_head)
	# naive: the formula the wrong way round (33.3 m)
	_type("33.3"); _key(KEY_ENTER); await _frames(2)
	ok(sc.pages.mode == "" and bk.answers_done(), "the answer is written and the slip closes")
	sc.run_bench(); await _frames(2)
	ok(evlog.has("bench_failed") and sc.top.toast.contains("33.3 m") and sc.top.toast.contains("R = 5") and sc.top.toast.contains("l = 40 cm") and not sc.top.toast.contains("75"), "NAIVE 33.3 m: the bench shows R and l and the formula, not the answer: %s" % sc.top.toast.left(70))
	sc.props.hover = ""; sc._press(sc.L.exam.get_center())
	ok(sc.pages.mode == "predict", "the crew's slip card on the bench reopens the slip")
	for i in 4: _key(KEY_BACKSPACE)
	_type("75"); _key(KEY_ENTER); await _frames(2)   # (the LOCK has been held for seconds already: the auto bench may run in these very frames)
	_clock(4.0, func(): return bk.passed)
	ok(bk.passed and evlog.has("paid"), "with the right answer, holding LOCK runs the bench and pays")
	ok(bk.last_result.stars == 2 and int(bk.last_result.metrics.accuracy) == 0, "two stars: the answer is exact (accuracy %d ppm)" % int(bk.last_result.metrics.accuracy))
	await create_timer(0.9).timeout
	ok(sc.props.mood == "joy" and sc.done.get("2-2", false), "the crew digs at your mark: 2-2 is fixed")

	print("== 2-3 Black Box")
	await _start("2-3")
	ok(sc.supply.adjustable and sc.supply.kind == "bench" and absf(sc.supply.volts - 5.0) < 0.01, "the bench supply has voltage keys and starts at 5.00 V")
	var box: Array = bk.parts.filter(func(p): return str(p.partId) == "blackbox")
	ok(box.size() == 1 and str(box[0].kind) == "BOXED" and str(box[0].label) == "sealed box", "the sealed module is a fixed part")
	ok(bool(sc.scope.sc.get("hidden", false)), "there is no band on the scope: the bench test decides")
	_drag_part("res-cf", 1100, "0.25W", 4, 2, 0); _drag_part("res-cf", 33, "0.25W", 9, 2, 0)
	for w in EngineBench.REFS_CH2["2-3"].wires: _drag_wire((w as Array)[0], (w as Array)[(w as Array).size() - 1])
	for i in 3: _supply_key(SupplyView.V_PLUS)
	await _frames(2)
	ok(absf(bk.supply_volts() - 8.0) < 0.001 and absf(sc.supply.volts - 8.0) < 0.001, "three presses of + at 1 V a step: 8.00 V (%s, display %s)" % [str(bk.supply_volts()), str(sc.supply.volts)])
	_supply_key(SupplyView.V_STEP); _supply_key(SupplyView.V_MINUS)
	ok(absf(bk.supply_volts() - 7.9) < 0.001, "the step key switches to 0.1 V and - gives 7.90 V (%s)" % str(bk.supply_volts()))
	_supply_key(SupplyView.V_PLUS)
	_key(KEY_UP); _key(KEY_DOWN)
	ok(absf(bk.supply_volts() - 8.0) < 0.001, "the up / down arrows move it too: 8.00 V (%s)" % str(bk.supply_volts()))
	_rocker(); _clock(0.4)
	# measure first
	sc.run_bench(); await _frames(2)
	ok(evlog.has("bench_failed") and sc.top.toast.contains("Measure the sealed box first"), "the bench refuses until the box has been measured: %s" % sc.top.toast.left(50))
	cv = bk.coach_view()
	ok(str(cv.steps[cv.cur].id) == "voc" and str(cv.steps[cv.cur].target) == "dmm", "the coach points at the meter")
	_drag_probe("red", [2, 12]); _drag_probe("black", [14, 8]); await _frames(2); _clock(0.3)
	ok(absf(float(bk.dmm().value) - 8.0) < 0.001, "the DMM reads the box's open-circuit 8.000 V (%s)" % str(bk.dmm().text))
	await _dial_to("mA"); _clock(0.3)
	ok(str(bk.dmm().text).begins_with("7.03") or str(bk.dmm().text).begins_with("7.04"), "and its short-circuit current, about 7.04 mA (%s)" % str(bk.dmm().text))
	cv = bk.coach_view()
	ok(str(cv.steps[cv.cur].id) in ["place", "run-bench"], "the coach moves on once the box is measured (%s)" % str(cv.steps[cv.cur].id))
	sc.run_bench(); await _frames(2)
	ok(bk.passed and evlog.has("paid") and bk.last_result.stars == 2, "the reference (8.00 V + 1.1 k + 33 ohm) passes all four loads with two stars")
	await create_timer(0.9).timeout
	# naive: voltage only, straight to OUT
	await _start("2-3")
	_drag_part("res-cf", 10, "0.25W", 4, 2, 0); _drag_wire([2, 2], [4, 2]); _drag_wire([8, 2], [14, 2])
	for i in 3: _supply_key(SupplyView.V_PLUS)
	_drag_probe("red", [2, 12]); _drag_probe("black", [14, 8])
	sc.run_bench(); await _frames(2)
	ok(evlog.has("bench_failed") and sc.top.toast.contains("100 ohm load") and sc.top.toast.contains("series resistance is too small") and _no_id(sc.top.toast), "NAIVE (voltage only): the bench names the 100 ohm load and the missing series resistance: %s" % sc.top.toast.left(70))
	ok(sc._target_pos("supplyv") != Vector2.ZERO and sc._target_pos("dmm") != Vector2.ZERO, "the coach arrow has a target for the supply keys")

	print("== 2-4 EB: Slide-wire Potentiometer")
	await _start("2-4")
	ok(sc.pages.mode == "predict" and sc.pages.pred_fields.size() == 3, "the exam slip opens first with three questions")
	ok(str(sc.pages.pred_fields[0].unit) == "V/cm" and str(sc.pages.pred_fields[2].unit) == "ohm", "units on the slip: %s" % str(sc.pages.pred_fields.map(func(f): return f.unit)))
	ok(str(sc.props.exam_fig.get("kind", "")) == "pot" and sc.pages.pred_head.contains("predict first"), "the figure is the potentiometer")
	await _frames(3)
	# naive: wrong gradient predicted as 2 V per cm, then the 5 ohm rheostat
	_type("2"); _key(KEY_TAB); _type("1.5"); _key(KEY_TAB); _type("0.5"); _key(KEY_ENTER); await _frames(2)
	ok(bk.predictions_done() and sc.pages.mode == "", "the three predictions are locked in")
	ok(_drag_part("rheostat", 5, "ideal", 6, 2, 0) and _drag_part("galvanometer", null, "100ohm", 12, 7, 0), "the 5 ohm rheostat and the galvanometer are dragged in")
	for w in EngineBench.REFS_CH2["2-4"].wires: _drag_wire((w as Array)[0], (w as Array)[(w as Array).size() - 1])
	bk.set_jockey(750.0)
	sc.run_bench(); await _frames(2)
	ok(evlog.has("bench_failed") and sc.top.toast.contains("rheostat sets how much voltage the wire carries") and _no_id(sc.top.toast), "NAIVE 5 ohm rheostat: the bench says the gradient is wrong: %s" % sc.top.toast.left(70))
	await _start("2-4")
	_type("0.02"); _key(KEY_TAB); _type("1.5"); _key(KEY_TAB); _type("0.5"); _key(KEY_ENTER); await _frames(2)
	ok(_build("2-4"), "the reference build (10 ohm rheostat) is made by pointer")
	_rocker(); _clock(0.4)
	bk.set_jockey(750.0); _clock(0.4)
	ok(bk.locked and sc.scope.sc.unit == "µA" and sc.scope.sc.hi == 19.5, "sliding to 75.0 cm locks the live null in the +-19.5 uA band")
	sc.run_bench(); await _frames(3)
	ok(bk.passed and bk.last_result.stars == 3 and sc.pages.mode == "", "the build passes both balance marks with three stars (every prediction within 1 %%)")
	await create_timer(0.9).timeout
	ok(sc.pages.mode == "debrief" and str(sc.pages.debrief.get("node", "")) == "wire" and sc.pages.debrief.get("working", []).size() == 5 and str(sc.pages.debrief.get("answer", "")) == "r = 0.5 ohm", "the debrief slip works the potentiometer out (%s)" % str(sc.pages.debrief.get("answer", "")))
	sc.pages.show_page(""); await _frames(2)

	print("== notebook, chapter map, codex")
	sc.map_chapter = 2; sc._refresh_pages(); sc.go_map(); await _frames(3)
	ok(sc.pages.tickets.map(func(t): return t.state) == ["done", "done", "done", "done"] or sc.pages.tickets.filter(func(t): return bool(t.done)).size() == 4, "all four chits are FIXED on the page")
	ok(CoachData.CODEX.size() == 14 and str(CoachData.CODEX[10].title) == "Thevenin and Norton" and str(CoachData.CODEX[13].title) == "The potentiometer", "the codex has the new pages: divider + loading, Thevenin / Norton, bridge and null, potentiometer")
	sc.start_ticket("2-3"); await _frames(2); sc.pages.show_page("notebook"); await _frames(3)
	ok(sc.pages.codex_i == 10, "the notebook opens on the page that belongs to the ticket (Thevenin)")
	sc.pages.show_page(""); await _frames(2)

	print("== no script errors")
	ok(trap.count == 0, "the run logged no engine or script errors (%d: %s)" % [trap.count, str(trap.lines)])
	print("\n%d checks, %d failed" % [checks, fails])
	quit(1 if fails > 0 else 0)
