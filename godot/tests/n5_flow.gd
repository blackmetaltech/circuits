extends SceneTree
## N5 (fresh Class-11 tester on a Steam Deck): the fixes of the N5 round, on the real engine through the stall's UI layer.
##   godot --headless --path godot -s res://tests/n5_flow.gd         (exit code 0 = all green; needs godot/sidecar/bridge.mjs)
## 1 every ticket switch through the notebook repaints the board art (no stale rail, the engraved connectors of the NEW ticket)  3 the exam grades the
## predictions and the debrief says so  4 coach numbering, stale hover tag, no spoiler  6 handheld leg reach, shelf rating chips and scroll  7 codex pages.
var sc: StallScene
var bk: EngineBench
var fails := 0
var checks := 0
var trap := ErrorTrap.new()

func _initialize() -> void:
	OS.set_environment("CB_NOSAVE", "1"); OS.set_environment("CB_LAYOUT", "desktop")
	OS.add_logger(trap)
	_run()

func ok(cond: bool, what: String) -> void:
	checks += 1
	if cond: print("  ok   ", what)
	else: fails += 1; print("  FAIL ", what)

func _frames(n: int) -> void:
	for i in n: await process_frame

func _clock(seconds: float, until := Callable()) -> void:
	for i in int(seconds / 0.05):
		bk.step(0.05)
		if until.is_valid() and until.call(): return

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
	sc.props.rating_filter = ""; sc.props.set_items(bk.bin())
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
	return bk.wires.size() == before + 1

func _build(id: String) -> bool:
	var R: Dictionary = EngineBench.REFS[id]
	var good := true
	for p in R.parts: good = _drag_part(str(p[0]), p[1], str(p[2]), int(p[3]), int(p[4]), int(p[5])) and good
	for w in R.wires:
		var path: Array = w
		good = _drag_wire(path[0], path[path.size() - 1]) and good
	return good

func _rocker() -> void:
	var p: Vector2 = sc.supply.position + SupplyView.ROCKER.get_center() * sc.supply.scale.x
	sc._motion(p); sc._press(p)

func _start(id: String) -> void:
	sc.size = Vector2(1920, 1080)
	sc.start_ticket(id)
	await _frames(4)

## The notebook path of a player: open the notebook, "ticket pages", tap the chit.
func _via_notebook(id: String) -> void:
	sc.size = Vector2(1920, 1080)
	sc.pages.show_page("notebook"); await _frames(2)
	sc._on_page("goto:map", ""); await _frames(3)
	var btn := {}
	for b in sc.pages._buttons: if b.id == "ticket" and b.arg == id: btn = b
	ok(not btn.is_empty(), "the %s chit is a button on the notebook's ticket page" % id)
	if btn.is_empty(): return
	var ev := InputEventMouseButton.new(); ev.pressed = true; ev.button_index = MOUSE_BUTTON_LEFT; ev.position = (btn.rect as Rect2).get_center()
	sc.pages._gui_input(ev)
	await _frames(4)

func _conn_ids(model: Dictionary) -> Array:
	var out: Array = []
	for c in model.get("connectors", []): out.append("%s@%d,%d" % [str(c.id), int(c.pad.x), int(c.pad.y)])
	out.sort()
	return out

func _engine_conn_ids() -> Array:
	var out: Array = []
	for c in bk.bench_q.get("connectors", []): out.append("%s@%d,%d" % [str(c.id), int(c.pad[0]), int(c.pad[1])])
	out.sort()
	return out

func _check_art(id: String, redraws0: int, expect_redraw: bool) -> void:   # expect_redraw: the previous ticket's art differed
	var bv: BenchView = sc.bench
	ok(bk.ticket.id == id and sc.phase == "bench", "%s is open on the bench" % id)
	ok(_conn_ids(bv.model) == _engine_conn_ids(), "%s: the board model carries exactly the engine's connectors %s" % [id, str(_engine_conn_ids())])
	ok(bv._art_key == bv.art_signature(bv.model), "%s: the board art (silkscreen, brass connectors) was repainted for this ticket" % id)
	ok((bv.art_repaints > redraws0) == expect_redraw, "%s: the art is repainted exactly when the connectors changed (%s)" % [id, str(expect_redraw)])

func _run() -> void:
	sc = StallScene.new(); root.add_child(sc)
	sc.set_anchors_and_offsets_preset(Control.PRESET_TOP_LEFT); sc.size = Vector2(1920, 1080)
	await _frames(6)
	if not sc.backend.ENGINE:
		print("FAIL the engine sidecar did not start"); quit(2); return
	bk = sc.backend
	bk.unlock_through("1-5")   # every ticket before 1-5 is passed: the notebook's chits are all open
	var ids := ["1-1", "1-2", "1-3", "1-4", "1-5"]

	print("== 1: every consecutive ticket switch through the notebook rebuilds the board art")
	await _start("1-1")
	for i in range(1, ids.size()):
		var r0: int = sc.bench.art_repaints; var sig0: String = sc.bench.art_signature(sc.bench.model)
		await _via_notebook(ids[i])
		_check_art(ids[i], r0, sig0 != sc.bench.art_signature(sc.bench.model))
	# the 1-4 -> 1-5 pair of the report: 1-5 has the engraved A and GND, no 1-4 rail
	await _via_notebook("1-4")
	var r4: int = sc.bench.art_repaints
	await _via_notebook("1-5")
	var cn5 := _conn_ids(sc.bench.model)
	ok(cn5 == ["A@8,6", "GND@8,12"], "1-4 -> 1-5: the board shows A and GND (%s) and not 1-4's VP / GND rail at the top" % str(cn5))
	ok(sc.bench.art_repaints > r4, "1-4 -> 1-5: the art was repainted")
	# 1-3 names its three pads (the note talks about IN and OUT)
	await _via_notebook("1-3")
	ok(_conn_ids(sc.bench.model) == ["GND@14,8", "IN@2,2", "OUT@14,2"], "1-3: IN, OUT and GND are on the board (%s)" % str(_conn_ids(sc.bench.model)))
	ok(str(bk.ticket.brief).contains("50 ohm") and str(bk.ticket.brief).contains("across it"), "1-3: the brief names the 50 ohm heater and says the target is measured across it")
	# replay of a fixed ticket, and the other direction (backwards through the notebook)
	for id in ["1-5", "1-4", "1-3", "1-2", "1-1", "1-1"]:
		var rr: int = sc.bench.art_repaints
		var sig1: String = sc.bench.art_signature(sc.bench.model)
		await _via_notebook(id)
		_check_art(id, rr, sig1 != sc.bench.art_signature(sc.bench.model))

	print("== 3: the exam grades the predictions (7.5 V / 0.8 A passes the build, earns 1 star, and the debrief says why)")
	await _start("1-5")
	ok(sc.pages.mode == "predict" and str(sc.pages.star_rule).contains("3 stars"), "the slip states the marking before lock-in: %s" % str(sc.pages.star_rule))
	# the on-screen +/- key
	sc.pages.pred_fields[1].text = "0.5"
	sc._toggle_sign(1)
	ok(str(sc.pages.pred_fields[1].text) == "-0.5", "the on-screen +/- key makes 0.5 into -0.5")
	sc._toggle_sign(1)
	ok(str(sc.pages.pred_fields[1].text) == "0.5", "and back")
	var btn_sign := false
	await _frames(2)
	for b in sc.pages._buttons: if b.id == "pred_sign": btn_sign = true
	ok(btn_sign, "the predict slip has a +/- button")
	sc.pages.pred_fields[0].text = "7.5"; sc.pages.pred_fields[1].text = "0.8"
	sc._submit_predictions()
	ok(bk.predictions_done(), "wrong predictions are recorded (7.5 V and 0.8 A)")
	ok(_build("1-5"), "the exam bridge is built by pointer")
	var clip: Array = EngineBench.REFS["1-5"].clip
	sc.backend.set_probe("ch1", clip)
	_rocker(); sc.run_bench()
	await _frames(2)
	var res: Dictionary = bk.last_result
	ok(bool(res.get("pass", false)) and int(res.get("stars", 0)) == 1, "the build passes, but the stars are 1 (%s)" % str(res.get("stars", "?")))
	var deb: Dictionary = res.get("debrief", {})
	ok(str(deb.get("equation", "")) == "(10 − A)/2 + (5 − A)/3 = A/6" and str(deb.get("answer", "")) == "A = 6.667 V", "the debrief carries the KCL equation and answer: %s, %s" % [str(deb.get("equation", "")), str(deb.get("answer", ""))])
	var rows: Array = deb.get("rows", [])
	ok(rows.size() == 2 and not bool(rows[0].ok) and absf(float(rows[0].gapPct) - 12.5) < 0.2, "predicted 7.5 V vs measured 6.667 V: %s %% off" % str(rows[0].gapPct if rows.size() > 0 else "?"))
	ok(str(deb.currents[1].text).contains("CHARGING") and str(deb.currents[0].text).contains("DISCHARGING"), "E2 charging, E1 discharging is spelled out")
	for i in 8: sc._process(0.2)   # the lock moment (chime, then the coin), then the debrief opens
	await _frames(2)
	ok(sc.pages.mode == "debrief" and not sc.pages.debrief.is_empty(), "after the coin drops the debrief slip is open (%s)" % sc.pages.mode)
	await _frames(2)
	var close_btn := false
	for b in sc.pages._buttons: if b.id == "debrief_close": close_btn = true
	ok(close_btn, "the debrief has a button to close it")
	sc._on_page("debrief_close", ""); await _frames(2)
	ok(sc.pages.mode == "", "the debrief closes")
	# the tap on the exam card on the bench reopens it
	var cc: Vector2 = (sc.L.exam as Rect2).get_center(); sc._motion(cc); sc._press(cc); await _frames(2)
	ok(sc.pages.mode == "debrief", "the problem card reopens the debrief after the bench")
	sc._on_page("debrief_close", "")
	# right predictions: 3 stars on the engine side
	await _start("1-5")
	sc.pages.pred_fields[0].text = "6.7"; sc.pages.pred_fields[1].text = "0.56"; sc._submit_predictions()
	ok(_build("1-5"), "second go: built again")
	sc.backend.set_probe("ch1", clip)
	_rocker(); sc.run_bench()
	ok(int(bk.last_result.get("stars", 0)) == 3, "within 1 %% on both: 3 stars (%s)" % str(bk.last_result.get("stars", "?")))

	print("== 4: coach numbering, hover tag, no spoiler")
	await _start("1-2")
	var step5: String = ""
	for s in bk.coach_view().steps: if str(s.id) == "tired": step5 = str(s.text)
	var eng_text = bk._q("coach")
	var all_txt := ""
	for s in eng_text.steps: all_txt += str(s.text) + " | "
	ok(not all_txt.contains("each side") and not all_txt.contains("find the one that passes both"), "1-2: the coach does not hand over the answer")
	ok(all_txt.contains("fresh battery") and all_txt.contains("tired one"), "1-2: it asks the student to estimate the current for the fresh and the tired voltage")
	await _start("1-4")
	var seq: Array = []
	var cv: Dictionary = bk.coach_view()
	seq.append(int(cv.step_no))
	ok(int(cv.step_total) == 6, "1-4 has six numbered steps (the smoke branch takes no number): %d" % int(cv.step_total))
	# power on, then measure, then load, wire: numbers go 1 2 3 4 5 with no gap
	_rocker(); cv = bk.coach_view(); seq.append(int(cv.step_no))
	bk.set_probe("red", [2, 2]); bk.set_probe("black", [8, 2]); bk.set_dial("V"); await _frames(2); cv = bk.coach_view(); seq.append(int(cv.step_no))
	bk.set_probe("red", null); bk.set_probe("black", null)
	_drag_part("res-ww5", 4.7, "5W", 2, 5, 0); cv = bk.coach_view(); seq.append(int(cv.step_no))
	_drag_wire([2, 2], [2, 5]); _drag_wire([6, 5], [8, 2]); cv = bk.coach_view(); seq.append(int(cv.step_no))
	print("   (seq %s, wires %d parts %d)" % [str(seq), bk.wires.size(), bk.parts.size()])
	ok(seq == [1, 2, 3, 4, 5], "1-4: the step numbers climb one at a time (%s)" % str(seq))
	# the optional meter step of 1-1 does not count against the notebook checklist
	await _start("1-1")
	sc.pages.show_page("notebook"); await _frames(2)
	var opt_idx := -1
	for i in sc.pages.coach_steps.size(): if bool(sc.pages.coach_steps[i].get("optional", false)): opt_idx = i
	ok(opt_idx >= 0 and bool(sc.pages.coach_opt[opt_idx]), "1-1: the meter step is marked optional in the notebook")
	sc.pages.show_page("")
	# the hover tag is cleared by a board edit
	_drag_part("res-cf", 470.0, "0.25W", 2, 5, 0); _drag_part("led-red-5mm", null, "5mm", 8, 5, 0)
	_drag_wire([2, 2], [2, 5]); _drag_wire([6, 5], [8, 5]); _drag_wire([10, 5], [8, 2])
	_rocker(); _clock(0.5); await _frames(3)
	var rp: Vector2 = sc.pad_screen(Vector2(4, 5))
	sc._motion(rp); await _frames(2)
	ok(str(sc.top.tag.get("text", "")).contains("mA"), "hovering the resistor shows a current tag (%s)" % str(sc.top.tag))
	var uid := ""
	for p in bk.parts: if p.kind == "R" and not p.fixed: uid = str(p.uid)
	bk.delete_part(uid)
	await _frames(3)
	ok(sc.top.tag.is_empty() or not str(sc.top.tag.get("text", "")).contains("W"), "removing the part clears the stale tag (%s)" % str(sc.top.tag))
	# the coach step never silently jumps back: undo after a burn says so
	await _start("1-1")
	_drag_part("led-red-5mm", null, "5mm", 4, 5, 0)
	_drag_wire([2, 2], [4, 5]); _drag_wire([6, 5], [8, 2])
	var hi: int = int(bk.coach_view().step_no)
	_rocker(); _clock(1.0, func(): return not bk.smoked.is_empty()); await _frames(2)
	bk.coach_view()
	sc._undo(); await _frames(2); sc._undo(); await _frames(2)
	var back: Dictionary = bk.coach_view()
	ok(bool(back.back) or int(back.step_no) >= hi, "after two undos the slip says it went back a step (step %d, was %d, back=%s)" % [int(back.step_no), hi, str(back.back)])

	print("== 6: handheld hit targets, the shelf")
	OS.set_environment("CB_LAYOUT", "handheld"); sc._lay_key = ""; await _frames(3)
	ok(sc.handheld, "the handheld layout is on")
	await _start("1-1")
	_drag_part("led-red-5mm", null, "5mm", 8, 5, 0)
	ok(sc.drop_reach() >= 1.8, "handheld: a wire end reaches a leg %.1f pads away (desktop 1.35)" % sc.drop_reach())
	var fp := sc.pad_screen(Vector2(2, 2)); var off := sc.pad_screen(Vector2(6.4, 5))   # 1.6 pads to the left of the A leg (nothing else is near)
	sc._motion(fp); sc._press(fp); sc._motion(off); sc._board_overlay()
	var ovw: Dictionary = sc.bench.overlay.get("wire", {})
	ok(ovw.get("target", Vector2(-1, -1)) == Vector2(8, 5) and str(ovw.get("label", "")).contains("A"), "dragging: the leg it will snap to is highlighted and named: %s" % str(ovw.get("label", "")))
	sc._release(off)
	ok(bk.wires.size() == 1 and bk.wires[0].b == [8, 5], "a drop 1.6 pads from the leg still lands on it on the handheld")
	OS.set_environment("CB_LAYOUT", "desktop"); sc._lay_key = ""; await _frames(3)
	await _start("1-3")
	var tags: Array = sc.props.rating_tags()
	ok(tags == ["¼ W", "½ W", "1 W"], "1-3 shelf: rating chips %s" % str(tags))
	var n_all: int = sc.props.items.size()
	var chip = sc.props.chip_at(sc.props.chip_rects()[2].rect.get_center())
	ok(chip != null and str(chip) == "½ W", "the second chip is the half-watt one")
	sc._motion((sc.props.chip_rects()[2].rect as Rect2).get_center()); sc._press((sc.props.chip_rects()[2].rect as Rect2).get_center())
	sc.props.set_items(bk.bin())
	var only_half := true
	for it in sc.props.items: if str(it.tag) != "½ W": only_half = false
	ok(only_half and sc.props.items.size() == 5 and n_all == 15, "tapping the chip shelves only the 1/2 W parts (%d of %d)" % [sc.props.items.size(), n_all])
	sc.props.rating_filter = ""; sc.props.set_items(bk.bin()); sc.props.bin_scroll = 0.0
	var wp: Vector2 = (sc.props.box_inner() as Rect2).get_center()
	sc._wheel(wp, -1)
	ok(sc.props.bin_scroll >= 2.0, "one wheel notch scrolls %.1f rows (faster than before)" % sc.props.bin_scroll)
	await _start("1-4")
	ok(sc.props.rating_tags() == ["1 W", "5 W"], "1-4 shelf: chips %s" % str(sc.props.rating_tags()))
	await _start("1-1")
	ok(sc.props.rating_tags().is_empty(), "1-1 shelf: one rating, no chips")

	print("== 7: codex pages")
	var titles: Array = CoachData.CODEX.map(func(e): return str(e.title))
	ok(titles.any(func(t): return t.begins_with("Power")), "the codex has a power page (P = VI = I2R = V2/R)")
	ok(titles.any(func(t): return t.begins_with("Node voltage")), "the codex has a node-voltage / KCL page")
	await _start("1-5")
	ok(str(CoachData.CODEX[sc.pages.codex_i].title).begins_with("Node voltage"), "1-5 opens the notebook on the node-voltage page")
	await _start("1-3")
	ok(str(CoachData.CODEX[sc.pages.codex_i].title).begins_with("Power"), "1-3 opens the notebook on the power page")

	ok(trap.count == 0, "zero script errors in the whole run (%d: %s)" % [trap.count, str(trap.lines.slice(0, 3))])
	print("\n%d checks, %d failed" % [checks, fails])
	quit(1 if fails > 0 else 0)
