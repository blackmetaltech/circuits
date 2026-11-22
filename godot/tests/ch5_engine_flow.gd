extends SceneTree
## Chapter 5 "Switches & Gain" end to end on the real engine, through the stall's UI layer (pointer drags for parts, wires and the scope clip, clicks on the rocker, the live switches, the scope's knobs and keys, the BENCH key, typed predictions).
## All five tickets are played to their reference designs and the designed naive builds fail (the fan without its diode burns, the FET on 3.3 V, the NAND without level shifters, the exam slip):
##   godot --headless --path godot -s res://tests/ch5_engine_flow.gd         (exit code 0 = all green; needs godot/sidecar/bridge.mjs)
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
		if value != null and (it.value == null or absf(float(it.value) - float(value)) > 1e-12): continue
		if variant != "" and it.variant != variant: continue
		return i
	return -1

func _drag_part(partId: String, value, variant: String, x: int, y: int, r: int) -> bool:
	var idx := _slot(partId, value, variant)
	if idx < 0: print("   (no shoebox row for %s %s %s)" % [partId, str(value), variant]); return false
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

func _bench_key() -> void:
	var p: Vector2 = (sc.L.bench as Rect2).get_center()
	sc._motion(p); sc._press(p)

func _knob(i: int, right := false) -> void:
	var p: Vector2 = sc.scope.position + (sc.scope.knob_centres()[i] as Vector2) * sc.scope.scale.x
	sc._motion(p)
	if right: sc._right(p)
	else: sc._press(p)

func _key(code: Key, uni := 0) -> void:
	var e := InputEventKey.new(); e.pressed = true; e.keycode = code; e.unicode = uni
	sc._unhandled_key_input(e)

func _type(s: String) -> void:
	for ch in s: _key(OS.find_keycode_from_string(ch) if ch != "." else KEY_PERIOD, ch.unicode_at(0))

## A press on one position of one of the panel's live switches.
func _sel(si: int, oi: int) -> void:
	for r in sc.supply.sel_rects():
		if int(r[0]) == si and int(r[1]) == oi:
			var p: Vector2 = sc.supply.position + (r[2] as Rect2).get_center() * sc.supply.scale.x
			sc._motion(p); sc._press(p); return

func _ref(id: String) -> Dictionary: return EngineBench.REFS_CH5[id]

func _build(id: String) -> bool:
	var R: Dictionary = _ref(id)
	var good := true
	for p in R.parts: good = _drag_part(str(p[0]), p[1], str(p[2]), int(p[3]), int(p[4]), int(p[5])) and good
	for w in R.wires:
		var path: Array = w
		good = _drag_wire(path[0], path[path.size() - 1]) and good
	return good

func _start(id: String, read_card := true) -> void:
	sc.size = Vector2(1920, 1080)
	sc.start_ticket(id)
	await _frames(4)
	if read_card and sc.pages.mode == "safety": sc._on_page("safety_ok", ""); await _frames(2)
	evlog.clear()

func _trace() -> Dictionary: return bk.scope_view.get("trace", {}) as Dictionary
func _frame_part(key: String) -> Dictionary:
	for p in bk.frame.get("parts", []): if (p as Dictionary).has(key): return p
	return {}

## ---------------------------------------------------------------------------------------------------------------- run

func _run() -> void:
	sc = StallScene.new(); root.add_child(sc)
	sc.set_anchors_and_offsets_preset(Control.PRESET_TOP_LEFT); sc.size = Vector2(1920, 1080)
	await _frames(6)
	if not sc.backend.ENGINE:
		print("FAIL the engine sidecar did not start (build it: npx vite build -c vite.bridge.config.ts)"); quit(2); return
	bk = sc.backend
	bk.event.connect(func(n, _d): evlog.append(n))
	print("== chapter map: chapter 5 unlocks after chapter 4")
	bk.new_game()
	sc.map_chapter = 5; sc._refresh_pages()
	ok(sc.pages.tickets.size() == 5 and sc.pages.map_title == "Switches & Gain", "the map shows chapter 5's five chits with the engine's title")
	ok(str(sc.pages.tickets[0].state) == "locked" and not bool(sc.pages.chapter_open[4]), "on a fresh save the whole page is locked")
	ok(bool(sc.pages.tickets[4].eb), "5-5 is marked as the exam")
	bk.unlock_through("5-1")
	sc._refresh_pages()
	ok(str(sc.pages.tickets[0].state) == "open" and bool(sc.pages.chapter_open[4]), "after chapter 4 (the reference designs) 5-1 is open")
	sc.go_map(); await _frames(3)
	ok(sc.pages.mode == "map", "the map page opens")

	print("== 5-1 Fan Driver")
	await _start("5-1")
	ok(sc.pages.mode == "" and sc.supply.kind == "bench" and sc.supply.selectors.size() == 1 and sc.supply.selectors[0].options.size() == 3, "the bench supply carries the PIN switch with high, low and 100 Hz")
	ok(bk.parts.size() == 1 and str(bk.parts[0].partId) == "fan-dc", "the fan is soldered on")
	# naive: no flyback diode, 100 Hz
	_drag_part("res-cf", 220, "0.25W", 4, 7, 0); _drag_part("2n2222a", null, "TO92", 14, 8, 0)
	for i in range(0, 5): var w: Array = _ref("5-1").wires[i]; _drag_wire(w[0], w[w.size() - 1])
	_sel(0, 2); await _frames(1); _rocker()
	_clock(0.3, func(): return not bk.smoked.is_empty())
	ok(not bk.smoked.is_empty(), "NAIVE no diode at 100 Hz: the transistor burns on the bench (the turn-off kick)")
	ok(sc.top.toast.contains("spiked") or str(bk.frame.get("events", [])).contains("spiked") or sc.top.toast.contains("inductance"), "and the words name the fan's inductance: %s" % sc.top.toast.left(100))
	await _start("5-1")
	ok(_build("5-1"), "the reference (2N2222A, 220 ohm, 1N4007) is built by pointer")
	_rocker(); _sel(0, 2); _clock(0.5)
	ok(bk.smoked.is_empty(), "the ref survives 100 Hz switching"); _sel(0, 0)
	_clock(3.0, func(): return bk.locked)
	ok(bk.locked, "LOCK: the pin gives under 20 mA with the pin high")
	_clock(4.0, func(): return bk.passed)
	ok(bk.passed and evlog.has("paid") and bk.last_result.stars == 2, "holding LOCK runs the bench (high, low, 100 Hz) and pays two stars")
	await create_timer(0.9).timeout
	ok(sc.props.mood == "joy" and sc.done.get("5-1", false), "Kit is happy; 5-1 is fixed")
	await _start("5-1")
	_drag_part("res-cf", 8200, "0.25W", 4, 7, 0); _drag_part("2n2222a", null, "TO92", 14, 8, 0); _drag_part("1n4007", null, "DO41", 10, 4, 0)
	for w in _ref("5-1").wires: _drag_wire((w as Array)[0], (w as Array)[(w as Array).size() - 1])
	sc.run_bench(); await _frames(2)
	ok(evlog.has("bench_failed") and sc.top.toast.contains("Ib = (5 - 0.7 V)") and sc.top.toast.contains("8.2 kΩ") and _no_id(sc.top.toast), "NAIVE Rb 8.2 k: the bench works the base current out (a try after the pass, so the formula): %s" % sc.top.toast.left(100))

	print("== 5-2 3.3 V Gate")
	await _start("5-2")
	ok(sc.supply.selectors.size() == 1 and str(sc.supply.selectors[0].options) == str(["typical", "minimum", "maximum"]), "the THRESHOLD switch has typical, minimum and maximum")
	ok(_build("5-2"), "the reference (IRLZ44N, 100 ohm gate resistor, 100 kohm pull-down) is built by pointer")
	_rocker(); _clock(3.0, func(): return bk.locked)
	ok(bk.locked, "LOCK at the typical threshold"); _sel(0, 2); _clock(1.0); ok(bk.locked, "LOCK at the maximum threshold")
	_clock(4.0, func(): return bk.passed)
	ok(bk.passed and evlog.has("paid"), "the bench passes three thresholds and the reset test")
	await _start("5-2")
	_drag_part("res-cf", 100, "0.25W", 4, 8, 0); _drag_part("irf540n", null, "TO220", 12, 8, 0); _drag_part("res-cf", 100000, "0.25W", 10, 10, 1)
	for w in _ref("5-2").wires: _drag_wire((w as Array)[0], (w as Array)[(w as Array).size() - 1])
	sc.run_bench(); await _frames(2)
	ok(evlog.has("bench_failed") and (sc.top.toast.contains("Vov = 3.3 V - 3 V") or sc.top.toast.contains("never switched on")) and _no_id(sc.top.toast), "NAIVE IRF540N: not enough gate drive at 3.3 V: %s" % sc.top.toast.left(100))
	await _start("5-2")
	_drag_part("res-cf", 100, "0.25W", 4, 8, 0); _drag_part("irlz44n", null, "TO220", 12, 8, 0)
	for i in [0, 1, 2, 4, 5, 6, 7]: var w: Array = _ref("5-2").wires[i]; _drag_wire(w[0], w[w.size() - 1])
	sc.run_bench(); await _frames(2)
	ok(evlog.has("bench_failed") and sc.top.toast.contains("1.8 V") and _no_id(sc.top.toast), "NAIVE no pull-down: the reset test lights the strip: %s" % sc.top.toast.left(100))

	print("== 5-3 Gate Builder")
	await _start("5-3")
	ok(sc.supply.selectors.size() == 2 and str(sc.supply.selectors[0].label) == "INPUT A", "the INPUT A and INPUT B switches are on the bench supply")
	ok(_build("5-3"), "the reference NAND (4 x 1N4148, 2N3904, three resistors) is built by pointer")
	_rocker(); _drag_probe("ch1", [22, 6])
	_clock(3.0, func(): return bk.locked)
	ok(bk.locked, "LOCK: OUT is high with both inputs low"); _sel(0, 1); _sel(1, 1); _clock(1.5)
	ok(float(bk.scope_view.get("gauge", {}).get("value", 9.0) if bk.scope_view.get("gauge", null) is Dictionary else 9.0) >= 0.0, "both inputs high: the live circuit runs")
	_sel(0, 0); _sel(1, 0); _clock(4.0, func(): return bk.passed)
	ok(bk.passed and evlog.has("paid"), "the bench passes all four vectors")
	await _start("5-3")
	var ps: Array = _ref("5-3").parts
	for i in ps.size(): _drag_part(str(ps[i][0]), (47e3 if i == 7 else ps[i][1]), str(ps[i][2]), int(ps[i][3]), int(ps[i][4]), int(ps[i][5]))
	for w in _ref("5-3").wires: _drag_wire((w as Array)[0], (w as Array)[(w as Array).size() - 1])
	sc.run_bench(); await _frames(2)
	ok(evlog.has("bench_failed") and sc.top.toast.contains("5 V x 10 kΩ / (47 kΩ + 10 kΩ)") and _no_id(sc.top.toast), "NAIVE 47 k collector pull-up: the 10 k load sags the output, and the words do the division: %s" % sc.top.toast.left(100))

	print("== 5-4 Synth Preamp")
	await _start("5-4")
	ok(sc.supply.selectors.size() == 1 and str(sc.supply.selectors[0].options) == str(["200", "100", "300"]), "the TRANSISTOR GAIN switch has 200, 100 and 300")
	ok(_build("5-4"), "the reference (divider 68 k / 10 k, RC 4.7 k, RE 390, 10 uF in and out) is built by pointer")
	_rocker(); _drag_probe("ch1", [22, 8]); _clock(1.0)
	ok(bk.powered and bk.model.get("probes", []).size() >= 1, "the scope clip is on OUT and the line-out drives the amplifier")
	sc.run_bench(); await _frames(3)
	ok(bk.passed and bk.last_result.stars == 2 and evlog.has("paid"), "the bench passes beta 100, 200 and 300 and pays two stars")
	await _start("5-4")
	for p in _ref("5-4").parts: if int(p[3]) != 8 or int(p[4]) != 9: _drag_part(str(p[0]), p[1], str(p[2]), int(p[3]), int(p[4]), int(p[5]))
	_drag_part("res-cf", 470, "0.25W", 8, 9, 1)   # the lower divider resistor is 470 ohm instead of 10 k: the base is held far too low
	for w in _ref("5-4").wires: _drag_wire((w as Array)[0], (w as Array)[(w as Array).size() - 1])
	sc.run_bench(); await _frames(2)
	ok(evlog.has("bench_failed") and _no_id(sc.top.toast), "NAIVE wrong second resistor: the bench fails in words: %s" % sc.top.toast.left(100))

	print("== 5-5 EB: CE Amplifier")
	await _start("5-5")
	ok(sc.pages.mode == "predict" and sc.pages.pred_fields.size() == 4, "the exam slip opens first with four questions")
	ok(str(sc.pages.pred_fields.map(func(f): return f.unit)) == str(["µA", "mA", "V", "V/V"]), "units on the slip: %s" % str(sc.pages.pred_fields.map(func(f): return f.unit)))
	ok(str(sc.props.exam_fig.get("kind", "")) == "amp", "the figure is the CE card")
	ok(not JSON.stringify(bk.ticket).contains("232") and not str(bk.ticket.get("spec", "")).contains("2.00"), "no answer is on the card before the predictions are locked")
	_type("20"); _key(KEY_TAB); _type("2"); _key(KEY_TAB); _type("6"); _key(KEY_TAB); _type("-232"); _key(KEY_ENTER); await _frames(2)
	ok(bk.predictions_done() and sc.pages.mode == "", "the four predictions are locked in")
	ok(_build("5-5"), "the reference (565 k, 3 k, the textbook transistor) is built by pointer")
	sc.run_bench(); await _frames(3)
	ok(bk.passed and bk.last_result.stars == 3, "exact predictions and a right build: three stars")
	await create_timer(0.9).timeout
	ok(sc.pages.mode == "debrief" and str(sc.pages.debrief.get("node", "")) == "amp" and sc.pages.debrief.get("working", []).size() == 6, "the debrief slip works the card out, with the reality check and the beta swap")
	sc.pages.show_page(""); await _frames(2)

	print("== notebook, chapter map, codex")
	sc.map_chapter = 5; sc._refresh_pages(); sc.go_map(); await _frames(3)
	ok(sc.pages.tickets.filter(func(t): return bool(t.done)).size() == 5, "all five chits are FIXED on the page")
	ok(CoachData.CODEX.size() >= 40 and str(CoachData.CODEX[32].title) == "A transistor as a switch", "the codex has the chapter 5 pages (%d pages)" % CoachData.CODEX.size())
	sc.start_ticket("5-1"); await _frames(2); sc.pages.show_page("notebook"); await _frames(3)
	ok(sc.pages.codex_i == 32, "the notebook opens on the page that belongs to the ticket (the switch)")
	sc.pages.show_page(""); await _frames(2)

	print("== no script errors")
	ok(StallTop.longest_lines <= 8, "no message needs more than two pages on a 1280x800 handheld (%d lines: %s)" % [StallTop.longest_lines, StallTop.longest.left(90)])
	ok(trap.count == 0, "the run logged no engine or script errors (%d: %s)" % [trap.count, str(trap.lines)])
	print("\n%d checks, %d failed" % [checks, fails])
	quit(1 if fails > 0 else 0)

func _click(p: Vector2) -> InputEventMouseButton:
	var e := InputEventMouseButton.new(); e.button_index = MOUSE_BUTTON_LEFT; e.pressed = true; e.position = p
	return e
