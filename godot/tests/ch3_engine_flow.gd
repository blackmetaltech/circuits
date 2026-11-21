extends SceneTree
## Chapter 3 "Charge" end to end on the real engine, through the stall's UI layer (pointer drags for parts, wires and the scope clip, clicks on the rocker, the scope's TIME knob, the BENCH key, typed predictions).
## All four tickets are played to their reference designs and the designed naive builds fail:
##   godot --headless --path godot -s res://tests/ch3_engine_flow.gd         (exit code 0 = all green; needs godot/sidecar/bridge.mjs)
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

func _ref(id: String) -> Dictionary: return EngineBench.REFS_CH3[id]

func _build(id: String) -> bool:
	var R: Dictionary = _ref(id)
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

func _trace() -> Dictionary: return bk.scope_view.get("trace", {}) as Dictionary
func _frame_part(kind_key: String) -> Dictionary:
	for p in bk.frame.get("parts", []): if (p as Dictionary).has(kind_key): return p
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
	print("== chapter map: chapter 3 unlocks after 2-3 or the slide-wire exam")
	bk.new_game()
	sc.map_chapter = 3; sc._refresh_pages()
	ok(sc.pages.tickets.size() == 4 and sc.pages.map_title == "Charge", "the map shows chapter 3's four chits with the engine's title")
	ok(str(sc.pages.tickets[0].state) == "locked" and not bool(sc.pages.chapter_open[2]), "on a fresh save the whole page is locked (%s)" % str(sc.pages.tickets.map(func(t): return t.state)))
	ok(bool(sc.pages.tickets[3].eb), "3-4 is marked as the exam")
	bk.unlock_through("3-1")
	sc._refresh_pages()
	ok(str(sc.pages.tickets[0].state) == "open" and bool(sc.pages.chapter_open[2]), "after chapter 2 (the reference designs) 3-1 is open")
	sc.go_map(); await _frames(3)
	ok(sc.pages.mode == "map", "the map page opens")

	print("== 3-1 Flash Timer")
	await _start("3-1")
	ok(sc.supply.kind == "bench" and absf(sc.supply.volts - 10.0) < 0.01, "a fixed 10 V bench supply (%s %.1f)" % [sc.supply.kind, sc.supply.volts])
	ok(sc.scope.is_trace() and str(sc.scope.sc.label) == "OUT" and float(sc.scope.sc.tpd) == 0.2, "the scope is a time trace on OUT at 0.2 s per division")
	ok(sc.props.items.size() == 67 and str(sc.props.items[37].label).begins_with("1 \u00b5F"), "the shoebox lists 37 resistors and 30 capacitors (%d rows, first capacitor %s)" % [sc.props.items.size(), str(sc.props.items[37].label)])
	ok(str(sc.props.items[37].tag) == "6.3 V" and str(sc.props.items[38].tag) == "16 V" and str(sc.props.items[39].tag) == "25 V", "a capacitor's rating is a tag on its row (%s / %s / %s)" % [str(sc.props.items[37].tag), str(sc.props.items[38].tag), str(sc.props.items[39].tag)])
	ok(str(bk.ticket.spec_full) == "OUT reaches 6.32 V at 1.00 s, give or take 5 %" and bk.ticket.supply.kind == "bench", "the chit reads the engine's one-line spec")
	# naive: 1 Mohm + 1 uF, probe on OUT: the loaded timer
	_drag_part("res-cf", 1e6, "0.25W", 4, 2, 0); _drag_part("cap-el", 1e-6, "16V", 14, 4, 1)
	for w in _ref("3-1").wires: _drag_wire((w as Array)[0], (w as Array)[(w as Array).size() - 1])
	_rocker(); _drag_probe("ch1", [14, 2])
	_clock(1.0)
	ok(not _trace().is_empty() and (_trace().v as Array).size() > 20 and not bool(_trace().complete) and not bk.locked, "the curve is forming (%d samples), no LOCK yet" % (_trace().v as Array).size())
	_clock(5.0)
	ok(bool(_trace().complete) and (_trace().bad as Array).size() > 20 and not bk.locked and str(bk.scope_q.get("sweepText", "")).contains("left the amber tube"), "the loaded timer's sweep completes outside the tube: %d red samples, %s" % [(_trace().bad as Array).size(), str(bk.scope_q.get("sweepText", ""))])
	sc.run_bench(); await _frames(2)
	ok(evlog.has("bench_failed") and sc.top.toast.contains("scope probe is 10 M") and sc.top.toast.contains("1 M") and _no_id(sc.top.toast), "NAIVE 1 M + 1 u: the bench names the probe's load: %s" % sc.top.toast.left(90))
	# the TIME knob: click = longer, right-click = shorter, comma / period keys; the engine restarts the sweep
	var n0 := (_trace().v as Array).size()
	_knob(1); await _frames(2)
	ok(absf(float(sc.scope.sc.tpd) - 0.5) < 1e-9 and (_trace().v as Array).size() < n0 and float(_trace().get("dt", 0.0)) > 0.0, "clicking the TIME knob goes to 0.5 s/div and the sweep starts again (%d samples)" % (_trace().v as Array).size())
	_knob(1, true); _key(KEY_COMMA); await _frames(2)
	ok(absf(float(sc.scope.sc.tpd) - 0.1) < 1e-9, "right-click then the comma key: 0.2 then 0.1 s/div (%s)" % str(sc.scope.sc.tpd))
	_key(KEY_PERIOD); _key(KEY_PERIOD); await _frames(2)
	ok(absf(float(sc.scope.sc.tpd) - 0.5) < 1e-9, "the period key goes up again")
	_knob(0); ok(float(sc.scope.sc.get("vmul", 1.0)) == 2.0, "the VOLTS knob steps the vertical scale (x%s)" % str(sc.scope.sc.get("vmul", 1.0)))
	await _start("3-1")
	ok(_build("3-1"), "the reference timer (10 k + 100 uF 16 V) is built by pointer")
	_rocker(); _drag_probe("ch1", [14, 2])
	_clock(6.5, func(): return bk.locked)
	ok(bk.locked and bool(_trace().complete) and (_trace().bad as Array).is_empty(), "LOCK: the whole sweep sits in the tube (%d samples, none outside)" % (_trace().v as Array).size())
	_clock(4.0, func(): return bk.passed)
	ok(bk.passed and evlog.has("paid"), "holding LOCK runs the bench and pays")
	await create_timer(0.9).timeout
	ok(sc.props.mood == "joy" and sc.done.get("3-1", false), "Ines is happy; 3-1 is fixed")
	ok(str(sc.top.bubble) == str(bk.ticket.thanks) or str(sc.top.bubble) == str(bk.last_result.get("thanks", "")), "the customer's line follows the passed state: %s" % str(sc.top.bubble))
	ok(bk.last_result.stars == 2, "two stars at the cost par (%d)" % int(bk.last_result.stars))
	# a 6.3 V capacitor: the vent top swells, then pops, and the engine explains
	await _start("3-1")
	_drag_part("res-cf", 10000, "0.25W", 4, 2, 0); _drag_part("cap-el", 100e-6, "6.3V", 14, 4, 1)
	for w in _ref("3-1").wires: _drag_wire((w as Array)[0], (w as Array)[(w as Array).size() - 1])
	_rocker(); _drag_probe("ch1", [14, 2])
	var swelled := 0.0
	for i in 160:
		bk.step(0.05)
		for u in bk.model.get("cap_bulge", {}): swelled = maxf(swelled, float(bk.model.cap_bulge[u]))
		if evlog.has("smoked"): break
	ok(swelled > 0.3, "before it pops the vent top swells with the voltage (bulge %.2f)" % swelled)
	await _frames(2)
	ok(evlog.has("smoked") and sc.top.toast.contains("Pick a 16 V part") and _no_id(sc.top.toast), "the 6.3 V capacitor vents in the live view and says what to pick: %s" % sc.top.toast.left(80))
	await _start("3-1")
	_drag_part("res-cf", 10000, "0.25W", 4, 2, 0); _drag_part("cap-el", 100e-6, "16V", 14, 8, 3)
	for w in [[[2, 2], [4, 2]], [[8, 2], [14, 2]], [[14, 2], [14, 6]]]: _drag_wire((w as Array)[0], (w as Array)[(w as Array).size() - 1])
	_rocker(); _drag_probe("ch1", [14, 2])
	_clock(8.0, func(): return evlog.has("smoked"))
	await _frames(2)
	ok(evlog.has("smoked") and sc.top.toast.contains("wrong way round") and sc.top.toast.contains("stripe"), "a reversed electrolytic vents too: %s" % sc.top.toast.left(70))

	print("== 3-2 Debounce")
	await _start("3-2")
	ok(sc.supply.kind == "bench" and absf(sc.supply.volts - 5.0) < 0.01, "a 5 V rail")
	var fx: Array = bk.parts.filter(func(p): return p.fixed)
	ok(fx.size() == 2 and str(fx[0].partId) == "pullup-10k" and str(fx[1].partId) == "logic-in", "the pull-up and the logic input are fixed parts on the board")
	ok(sc.scope.is_trace() and absf(float(sc.scope.sc.tpd) - 0.01) < 1e-9 and str((bk.scope_q.trace.tube as Dictionary).kind) == "windows", "the scope is a time trace at 10 ms/div with gates for a tube")
	# naive: a resistor only (no capacitor) so OUT follows the bounce, then a weak filter
	_drag_part("res-cf", 1000, "0.25W", 4, 8, 0); _drag_part("cap-cer", 10e-9, "50V", 14, 9, 1)
	for w in _ref("3-2").wires: _drag_wire((w as Array)[0], (w as Array)[(w as Array).size() - 1])
	_rocker(); _drag_probe("ch1", [14, 8])
	_clock(1.2)
	var closed_seen := false
	for i in 60:
		bk.step(0.05)
		for c in bk.model.get("contacts", []): if bool(c.closed): closed_seen = true
	ok(closed_seen and not bk.model.get("contacts", []).is_empty(), "the arcade button's contact goes down in the engine's frame (the board draws it)")
	_clock(4.0)
	ok(bool(_trace().complete) and (_trace().bad as Array).size() > 0 and not bk.locked, "1 k + 10 nF: the trace follows the bounce out of the gates (%d red samples), no LOCK" % (_trace().bad as Array).size())
	sc.run_bench(); await _frames(2)
	ok(evlog.has("bench_failed") and sc.top.toast.contains("crossed 2.5 V") and sc.top.toast.contains("2 ms") and _no_id(sc.top.toast), "NAIVE 1 k + 10 n: the bench counts the crossings: %s" % sc.top.toast.left(90))
	await _start("3-2")
	ok(_build("3-2"), "the reference filter (47 k + 330 nF) is built by pointer")
	_rocker(); _drag_probe("ch1", [14, 8])
	_clock(8.0, func(): return bk.locked)
	ok(bk.locked and (_trace().bad as Array).is_empty(), "LOCK: OUT passes through each gate once")
	_clock(4.0, func(): return bk.passed)
	ok(bk.passed and evlog.has("paid") and bk.last_result.stars == 2, "the bench passes four bounce patterns and pays two stars")
	await create_timer(0.9).timeout
	ok(sc.props.mood == "joy" and sc.done.get("3-2", false), "Dex is happy; 3-2 is fixed")

	print("== 3-3 Relay Pull-in")
	await _start("3-3")
	ok(sc.supply.kind == "sources" and sc.supply.sources.size() == 2 and str(sc.supply.sources_title).begins_with("BENCH RAILS"), "the supply panel lists the two rails")
	ok(bk.parts.filter(func(p): return p.fixed and str(p.kind) == "RELAY").size() == 1 and sc.scope.is_trace() and str(sc.scope.sc.label) == "COIL" and bool(bk.scope_q.target.clipped), "the relay is soldered on and the scope shows its coil current with no clip")
	# naive: the 12 V rail straight onto the coil
	_drag_wire([2, 2], [12, 4])
	_rocker(); _clock(3.0)
	ok(not bk.locked, "12 V alone does not lock")
	sc.run_bench(); await _frames(2)
	ok(evlog.has("bench_failed") and sc.top.toast.contains("549") and sc.top.toast.contains("400") and _no_id(sc.top.toast), "NAIVE 12 V alone: the bench says 549 us against 400 us: %s" % sc.top.toast.left(90))
	await _start("3-3")
	_drag_wire([2, 5], [12, 4])
	_rocker(); _clock(30.0, func(): return evlog.has("smoked"))
	await _frames(2)
	ok(evlog.has("smoked") and sc.top.toast.contains("coil carried") and _no_id(sc.top.toast), "NAIVE 24 V alone: the coil overheats: %s" % sc.top.toast.left(80))
	await _start("3-3")
	ok(_build("3-3"), "the reference (24 V + 200 ohm 1 W) is built by pointer")
	_rocker()
	var was_out := true
	for i in 160:
		bk.step(0.05)
		var rp := _frame_part("relay")
		if not rp.is_empty() and not bool(rp.relay.operated): was_out = was_out and true
		if bk.locked: break
	var rl := _frame_part("relay")
	ok(bk.locked and not rl.is_empty() and bool(rl.relay.operated) and bool(bk.model.relay[str(rl.uid)].operated), "LOCK: the armature has pulled in (the engine's relay state) and the current sits in the tube")
	_clock(4.0, func(): return bk.passed)
	ok(bk.passed and evlog.has("paid"), "the bench passes and pays")
	await create_timer(0.9).timeout
	ok(sc.props.mood == "joy" and sc.done.get("3-3", false), "Sami's valves are on time; 3-3 is fixed")

	print("== 3-4 EB: Capacitor Bank")
	await _start("3-4")
	ok(sc.pages.mode == "predict" and sc.pages.pred_fields.size() == 4, "the exam slip opens first with four questions")
	ok(str(sc.pages.pred_fields.map(func(f): return f.unit)) == str(["µC", "mJ", "V", "mJ"]), "units on the slip: %s" % str(sc.pages.pred_fields.map(func(f): return f.unit)))
	ok(str(sc.props.exam_fig.get("kind", "")) == "caps" and not str(sc.pages.pred_head).is_empty(), "the figure is the two capacitor cards")
	ok(str(bk.ticket.spec).begins_with("predict first"), "no numbers on the chit before the predictions (%s)" % str(bk.ticket.spec))
	await _frames(3)
	# fast typing: every press lands, even keys the platform flags as auto-repeat or sends without a unicode ("9.9" once came out as "9.")
	for ch in "9.9":
		var ke := InputEventKey.new(); ke.pressed = true; ke.echo = true; ke.keycode = OS.find_keycode_from_string(ch) if ch != "." else KEY_PERIOD; ke.unicode = 0
		sc._unhandled_key_input(ke)
	ok(str(sc.pages.pred_fields[0].text) == "9.9", "fast typing keeps every key, echo flagged and unicode-less (%s)" % str(sc.pages.pred_fields[0].text))
	_key(KEY_BACKSPACE)
	_type("185"); _key(KEY_TAB); _type("9.9"); _key(KEY_TAB); _type("40"); _key(KEY_TAB); _type("20"); _key(KEY_ENTER); await _frames(2)
	ok(bk.predictions_done() and sc.pages.mode == "", "the four predictions are locked in")
	ok(_build("3-4"), "the reference bank is built by pointer")
	sc.run_bench(); await _frames(3)
	ok(bk.passed and bk.last_result.stars == 1, "the build is right but the loss (20 mJ, not 12) is off: one star (%d)" % int(bk.last_result.get("stars", -1)))
	await create_timer(0.9).timeout
	ok(sc.pages.mode == "debrief" and str(sc.pages.debrief.get("node", "")) == "bank" and sc.pages.debrief.get("working", []).size() == 7, "the debrief slip works both cards out (%d lines)" % sc.pages.debrief.get("working", []).size())
	sc.pages.show_page(""); await _frames(2)
	await _start("3-4")
	_type("180"); _key(KEY_TAB); _type("9.9"); _key(KEY_TAB); _type("40"); _key(KEY_TAB); _type("12"); _key(KEY_ENTER); await _frames(2)
	_build("3-4"); _rocker(); _clock(0.5)
	sc.run_bench(); await _frames(3)
	ok(bk.passed and bk.last_result.stars == 3, "exact predictions: three stars")
	ok(not bk.model.get("contacts", []).is_empty() and bk.model.contacts[0].id == "sw", "the switch of card (b) is a contact the engine reports")

	print("== notebook, chapter map, codex, the customer's line")
	sc.map_chapter = 3; sc._refresh_pages(); sc.go_map(); await _frames(3)
	ok(sc.pages.tickets.map(func(t): return t.state) == ["done", "done", "done", "done"] or sc.pages.tickets.filter(func(t): return bool(t.done)).size() == 4, "all four chits are FIXED on the page")
	ok(CoachData.CODEX.size() == 23 and str(CoachData.CODEX[14].title) == "Capacitance" and str(CoachData.CODEX[16].title) == "The time constant" and str(CoachData.CODEX[22].title) == "Energy in a capacitor", "the codex has the new pages: capacitance, series / parallel, the time constant, the curve, the probe, electrolytics, bounce, the coil, energy")
	sc.start_ticket("3-2"); await _frames(2); sc.pages.show_page("notebook"); await _frames(3)
	ok(sc.pages.codex_i == 20, "the notebook opens on the page that belongs to the ticket (filtering a bounce)")
	sc.pages.show_page(""); await _frames(2)
	await _start("3-1")
	ok(str(sc.top.bubble) == str(bk.ticket.ask), "a ticket that is not passed shows the customer's ask")

	print("== no script errors")
	ok(trap.count == 0, "the run logged no engine or script errors (%d: %s)" % [trap.count, str(trap.lines)])
	print("\n%d checks, %d failed" % [checks, fails])
	quit(1 if fails > 0 else 0)
