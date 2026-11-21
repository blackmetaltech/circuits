extends SceneTree
## Chapter 4 "Mains & Rectifiers" end to end on the real engine, through the stall's UI layer (pointer drags for parts, wires and the scope clip, clicks on the rocker, the live switches, the scope's knobs and keys, the BENCH key, typed predictions).
## All five tickets are played to their reference designs and the designed naive builds fail; the mains safety card gates 4-1:
##   godot --headless --path godot -s res://tests/ch4_engine_flow.gd         (exit code 0 = all green; needs godot/sidecar/bridge.mjs)
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
	var mid: Vector2 = (pins[0] + pins[pins.size() - 1]) * 0.5
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

func _ref(id: String) -> Dictionary: return EngineBench.REFS_CH4[id]

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
	print("== chapter map: chapter 4 unlocks after chapter 3")
	bk.new_game()
	sc.map_chapter = 4; sc._refresh_pages()
	ok(sc.pages.tickets.size() == 5 and sc.pages.map_title == "Mains & Rectifiers", "the map shows chapter 4's five chits with the engine's title")
	ok(str(sc.pages.tickets[0].state) == "locked" and not bool(sc.pages.chapter_open[3]), "on a fresh save the whole page is locked")
	ok(bool(sc.pages.tickets[4].eb), "4-5 is marked as the exam")
	bk.unlock_through("4-1")
	sc._refresh_pages()
	ok(str(sc.pages.tickets[0].state) == "open" and bool(sc.pages.chapter_open[3]), "after chapter 3 (the reference designs) 4-1 is open")
	sc.go_map(); await _frames(3)
	ok(sc.pages.mode == "map", "the map page opens")

	print("== 4-1 Wall Wart: the safety card, the keep-out, the isolation transformer")
	await _start("4-1", false)
	ok(sc.pages.mode == "safety" and bk.safety_pending(), "a mains ticket opens with the safety card, before anything else")
	ok(str(sc.pages.safety.get("lines", [])[0]).contains("training, an isolation transformer and a second person") and str(sc.pages.safety.get("lines", [])[1]).contains("Here the bench is simulated"), "the card is in Wren's words (DESIGN 1.2)")
	_key(KEY_ESCAPE); _key(KEY_N); await _frames(2)
	ok(sc.pages.mode == "safety", "Esc and the notebook key do not dismiss it")
	sc.pages._gui_input(_click(Vector2(40, 40))); await _frames(1)
	ok(sc.pages.mode == "safety" and sc.pages.safety_t < 6.0, "a click outside does not dismiss it, and the button is not ready on the first view (%.1f s)" % sc.pages.safety_t)
	sc.pages.show_page(""); await _frames(1)
	_rocker(); await _frames(1)
	ok(not bk.powered, "with the card unread the engine refuses the power: %s" % sc.top.toast.left(60))
	sc.pages.show_page("safety"); await _frames(1)
	sc.pages.safety_t = 7.0; await _frames(2)
	sc._on_page("safety_ok", ""); await _frames(2)
	ok(sc.pages.mode == "" and not bk.safety_pending(), "after the reading time its button closes it and the bench is open")
	ok(sc.supply.kind == "mains" and sc.supply.selectors.size() == 2 and str(sc.supply.isolation_text) == "isolation transformer", "the isolation transformer stands on the bench with the MAINS and LOAD switches")
	var kos: Array = bk.model.get("keepout", [])
	ok(kos.size() == 1 and int(kos[0].w) == 10 and str(sc.bench.keepout_text) == "HIGH VOLTAGE", "the mains section is a red hatched keep-out with the HIGH VOLTAGE silkscreen")
	ok(str(bk.ticket.mains.ribbon).contains("do not try this at home"), "the Bench Card carries the do-not-try-this-at-home ribbon")
	var before := bk.parts.size()
	var okp := _drag_part("1n4007", null, "DO41", 4, 4, 0)
	ok(not okp and bk.parts.size() == before, "a part dropped into the keep-out is refused")
	ok(sc.props.items.size() > 10 and str(bk.parts.filter(func(p): return p.fixed).map(func(p): return p.partId)) == str(["xfmr-12", "load-cc"]), "the transformer and the customer's load are soldered on")
	ok(_no_id(sc.top.toast), "the refusal names no part id")
	# naive: 680 uF
	_drag_part("1n4007", null, "DO41", 14, 2, 0); _drag_part("1n4007", null, "DO41", 14, 6, 0); _drag_part("1n4007", null, "DO41", 18, 10, 2); _drag_part("1n4007", null, "DO41", 18, 13, 2); _drag_part("cap-el", 680e-6, "25V", 20, 6, 1)
	for w in _ref("4-1").wires: _drag_wire((w as Array)[0], (w as Array)[(w as Array).size() - 1])
	_rocker(); _drag_probe("ch1", [22, 2])
	_clock(4.5)
	ok(not _trace().is_empty() and bool(_trace().complete) and (_trace().v2 as Array).size() == 256, "the scope has two channels: OUT and the amber secondary (%d samples)" % (_trace().v2 as Array).size())
	ok(not bk.locked, "680 uF: no LOCK (the ripple is over 1 Vpp)")
	sc.run_bench(); await _frames(2)
	ok(evlog.has("bench_failed") and sc.top.toast.contains("ripples 1.1 V peak to peak") and sc.top.toast.contains("680 µF") and _no_id(sc.top.toast), "NAIVE 680 uF: the bench names the ripple and the capacitor: %s" % sc.top.toast.left(90))
	# the scope's AC coupling and VOLTS knob
	_key(KEY_A); ok(bool(sc.scope.sc.get("ac_on", false)), "the A key AC-couples CH1")
	_knob(0); _knob(0); _knob(0); ok(is_equal_approx(float(sc.scope.sc.vdiv), 0.5), "the VOLTS knob steps the ticket's own list: 5, 2, 1, 0.5 V per division (%s)" % str(sc.scope.sc.vdiv))
	_key(KEY_A)
	# the live switches
	_sel(0, 2); await _frames(2)
	ok(int(bk.selectors[0].index) == 2 and bk.powered, "the MAINS switch goes to 253 V and the live circuit restarts")
	_sel(1, 1); await _frames(2)
	ok(int(bk.selectors[1].index) == 1, "the LOAD switch goes to none")
	await _start("4-1")
	ok(_build("4-1"), "the reference wall-wart (4 x 1N4007 + 1000 uF 25 V) is built by pointer")
	_rocker(); _drag_probe("ch1", [22, 2])
	_clock(6.5, func(): return bk.locked)
	ok(bk.locked and bool(_trace().complete), "LOCK: the ripple and the mean are inside the spec on the settled sweep")
	_key(KEY_T); ok(bk.camera and bk.model.get("camera", false), "the T key switches the thermal camera on"); await _frames(2); _key(KEY_T)
	_clock(4.0, func(): return bk.passed)
	ok(bk.passed and evlog.has("paid") and bk.last_result.stars == 2, "holding LOCK runs the bench (six conditions) and pays two stars")
	await create_timer(0.9).timeout
	ok(sc.props.mood == "joy" and sc.done.get("4-1", false), "Mrs. Dale is happy; 4-1 is fixed")
	# a 16 V capacitor and a 10 V one
	await _start("4-1")
	_drag_part("1n4007", null, "DO41", 14, 2, 0); _drag_part("1n4007", null, "DO41", 14, 6, 0); _drag_part("1n4007", null, "DO41", 18, 10, 2); _drag_part("1n4007", null, "DO41", 18, 13, 2); _drag_part("cap-el", 1000e-6, "16V", 20, 6, 1)
	for w in _ref("4-1").wires: _drag_wire((w as Array)[0], (w as Array)[(w as Array).size() - 1])
	sc.run_bench(); await _frames(2)
	ok(evlog.has("bench_failed") and sc.top.toast.contains("over its rating") and not sc.top.toast.contains("vented") and _no_id(sc.top.toast), "NAIVE 16 V: over its rating at high mains with no load, not vented: %s" % sc.top.toast.left(90))

	print("== 4-2 Zener Shunt")
	await _start("4-2")
	ok(sc.pages.mode == "" and sc.supply.kind == "bench" and sc.supply.selectors.size() == 2, "no safety card on a DC ticket; the INPUT and LOAD switches are on the bench supply")
	ok(bk.ticket.mains.is_empty() and sc.bench.model.get("keepout", []).is_empty(), "no keep-out, no ribbon off the mains ticket")
	_drag_part("res-cf", 220, "1W", 4, 2, 0); _drag_part("1n4733a", null, "DO41", 12, 8, 3)
	for w in _ref("4-2").wires: _drag_wire((w as Array)[0], (w as Array)[(w as Array).size() - 1])
	_rocker(); _drag_probe("ch1", [22, 2]); _clock(1.0)
	ok(not bk.locked, "220 ohm at 13 V and 30 mA: OUT is under the band")
	sc.run_bench(); await _frames(2)
	ok(evlog.has("bench_failed") and sc.top.toast.contains("fell to 4.78 V") and _no_id(sc.top.toast), "NAIVE 220 ohm: %s" % sc.top.toast.left(90))
	await _start("4-2")
	ok(_build("4-2"), "the reference (180 ohm 1 W + 1N4733A) is built by pointer")
	_rocker(); _drag_probe("ch1", [22, 2])
	_clock(3.0, func(): return bk.locked)
	ok(bk.locked, "LOCK at 13 V and 30 mA")
	_sel(0, 1); _clock(1.0); ok(bk.locked, "LOCK at 17 V and 30 mA"); _sel(1, 1); _clock(1.0); ok(bk.locked, "LOCK at 17 V and no load")
	_clock(4.0, func(): return bk.passed)
	ok(bk.passed and evlog.has("paid"), "the bench passes four conditions and pays")

	print("== 4-3 Hot Regulator")
	await _start("4-3")
	ok(bk.camera_ok and sc.top.cam_rect.size != Vector2.ZERO, "the thermal camera chip is above the board")
	var reg_row := _slot("lm7805", null, "TO220")
	ok(reg_row >= 0 and _slot("lm7805", null, "TO220-8") >= 0, "the shoebox has the regulator bare and with the heatsinks")
	_drag_part("lm7805", null, "TO220", 10, 6, 0)
	_drag_wire([2, 2], [10, 6]); _drag_wire([12, 6], [22, 14]); _drag_wire([14, 6], [22, 2])
	_rocker(); _drag_probe("ch1", [22, 2])
	var offs := 0
	for i in 140:
		bk.step(0.05)
		var rp := _frame_part("reg")
		if not rp.is_empty() and bool(rp.reg.off): offs += 1
	ok(offs > 3 and not bk.locked, "a bare chip at 0.5 A shuts itself off over and over (%d frames off): OUT blinks, no LOCK" % offs)
	_key(KEY_T); await _frames(2)
	ok(bk.model.get("camera", false) and not bk.smoked.has(str(_frame_part("reg").get("uid", ""))), "the camera shows it hot and the chip does not smoke"); _key(KEY_T)
	sc.run_bench(); await _frames(2)
	ok(evlog.has("bench_failed") and sc.top.toast.contains("shut itself off") and _no_id(sc.top.toast), "NAIVE bare chip: the bench explains the shutdown: %s" % sc.top.toast.left(90))
	await _start("4-3")
	ok(_build("4-3"), "the reference (10 ohm 5 W + the 15 C/W heatsink) is built by pointer")
	_rocker(); _drag_probe("ch1", [22, 2])
	_clock(6.0, func(): return bk.locked)
	ok(bk.locked, "LOCK: OUT stays at 5 V")
	_clock(5.0, func(): return bk.passed)
	ok(bk.passed and evlog.has("paid"), "the bench passes 0.1 A and 0.5 A at 40 degrees and pays")

	print("== 4-4 Bench Supply")
	await _start("4-4")
	ok(_build("4-4"), "the reference (LM317, 240 and 390 ohm) is built by pointer")
	_rocker(); _drag_probe("ch1", [22, 2])
	_clock(3.0, func(): return bk.locked)
	ok(bk.locked, "LOCK at 3.3 V with 10 mA"); _sel(0, 1); _clock(1.0); ok(bk.locked, "LOCK with no load"); _sel(0, 2); _clock(1.0); ok(bk.locked, "LOCK at 500 mA")
	_clock(4.0, func(): return bk.passed)
	ok(bk.passed and evlog.has("paid"), "the bench passes three loads")
	await _start("4-4")
	_drag_part("lm317", null, "TO220", 10, 8, 0); _drag_part("res-cf", 2400, "0.25W", 12, 12, 0); _drag_part("res-cf", 3900, "0.25W", 4, 12, 0)
	for w in _ref("4-4").wires: _drag_wire((w as Array)[0], (w as Array)[(w as Array).size() - 1])
	sc.run_bench(); await _frames(2)
	ok(evlog.has("bench_failed") and sc.top.toast.contains("3.5 mA") and _no_id(sc.top.toast), "NAIVE 2.4 k / 3.9 k: the minimum load: %s" % sc.top.toast.left(90))

	print("== 4-5 EB: Zener Regulator")
	await _start("4-5")
	ok(sc.pages.mode == "predict" and sc.pages.pred_fields.size() == 3, "the exam slip opens first with three questions")
	ok(str(sc.pages.pred_fields.map(func(f): return f.unit)) == str(["mA", "Ω", "mW"]), "units on the slip: %s" % str(sc.pages.pred_fields.map(func(f): return f.unit)))
	ok(str(sc.props.exam_fig.get("kind", "")) == "zener", "the figure is the Zener card")
	_type("14"); _key(KEY_TAB); _type("333.33"); _key(KEY_TAB); _type("120"); _key(KEY_ENTER); await _frames(2)
	ok(bk.predictions_done() and sc.pages.mode == "", "the three predictions are locked in")
	ok(_build("4-5"), "the reference (300 ohm and the ideal 6 V Zener) is built by pointer")
	sc.run_bench(); await _frames(3)
	ok(bk.passed and bk.last_result.stars == 3, "exact predictions and a right build: three stars")
	await create_timer(0.9).timeout
	ok(sc.pages.mode == "debrief" and str(sc.pages.debrief.get("node", "")) == "zener" and sc.pages.debrief.get("working", []).size() == 5, "the debrief slip works the card out and ends on the real Zener's slope")
	sc.pages.show_page(""); await _frames(2)

	print("== notebook, chapter map, codex")
	sc.map_chapter = 4; sc._refresh_pages(); sc.go_map(); await _frames(3)
	ok(sc.pages.tickets.filter(func(t): return bool(t.done)).size() == 5, "all five chits are FIXED on the page")
	ok(CoachData.CODEX.size() >= 32 and str(CoachData.CODEX[23].title) == "Mains safety and isolation", "the codex has the mains safety page before the first mains ticket (%d pages)" % CoachData.CODEX.size())
	ok(str(CoachData.CODEX[23].body).contains("second person") and str(CoachData.CODEX[23].body).contains("Nothing in this notebook is a recipe to build at home"), "its words are Wren's: training, isolation, a second person, never at home")
	sc.start_ticket("4-2"); await _frames(2); sc.pages.show_page("notebook"); await _frames(3)
	ok(sc.pages.codex_i == 29, "the notebook opens on the page that belongs to the ticket (the Zener)")
	sc.pages.show_page(""); await _frames(2)
	ok(sc.window.rain, "rain on the awnings in chapter 4")

	print("== no script errors")
	ok(trap.count == 0, "the run logged no engine or script errors (%d: %s)" % [trap.count, str(trap.lines)])
	print("\n%d checks, %d failed" % [checks, fails])
	quit(1 if fails > 0 else 0)

func _click(p: Vector2) -> InputEventMouseButton:
	var e := InputEventMouseButton.new(); e.button_index = MOUSE_BUTTON_LEFT; e.pressed = true; e.position = p
	return e
