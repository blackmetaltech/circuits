extends SceneTree
## LOOK2 chapter 1 end to end in the new look, on the real engine, through the Workbench's own controls (the methods its
## keys and buttons call): each repair arrives in its case, the case opens on the customer's faulty board, the bench fails
## it, the board is cleared and built to the reference, the bench passes and pays, the device is handed back, and "Next job"
## opens the next ticket. Then the free bench: place, power, save build 1, clear, load build 1.
##   godot --headless --path godot -s res://tests/look2_ch1_flow.gd         (exit code 0 = green; needs godot/sidecar/bridge.mjs)
var wb: Workbench
const LevelBurnt := {"1-1": ["x1"], "1-4": ["x1"]}
var trap := ErrorTrap.new()
var fails := 0
var checks := 0

func _initialize() -> void:
	OS.set_environment("CB_NOSAVE", "1")
	OS.add_logger(trap)
	_run()

func ok(cond: bool, what: String) -> void:
	checks += 1
	if cond: print("  ok   ", what)
	else: fails += 1; print("  FAIL ", what)

func _frames(n: int) -> void:
	for i in n: await process_frame

func _step(sec: float) -> void:
	for i in int(sec / 0.05): wb.backend.step(0.05); await process_frame

func _run() -> void:
	wb = Workbench.new(); root.add_child(wb)
	await _frames(20)
	ok(wb.mode == "title", "the title is up")
	var names := []
	for b in wb.find_children("*", "Button", true, false): names.append((b as Button).text)
	ok(names.has("Quit") and names.has("High") and names.has("Low"), "the title has Quit and the graphics tiers (%s)" % str(names))
	var wallet0 := -1
	wb.start_job(); await _frames(10)
	for id in ["1-1", "1-2", "1-3", "1-4", "1-5"]:
		print("== ", id)
		ok(wb.ticket_id == id and str(wb.backend.ticket.get("id", "")) == id, "%s is the open job" % id)
		var repair: bool = id != "1-5"
		ok(wb.case_closed(), "the device arrives in its closed case")
		wb.open_case(); await _frames(5)
		ok(not wb.case_closed() and wb.note != "", "the case opens and says what is inside: %s" % wb.note)
		var faulty := 0
		for p in wb.backend._all_parts: if str(p.uid).begins_with("x"): faulty += 1
		var fw := 0
		for w in wb.backend.wires: if str(w.wid).begins_with("xw"): fw += 1
		ok((faulty + fw > 0) == repair, "the faulty board is on the bench (%d parts, %d wires)" % [faulty, fw])
		await _frames(3)
		for i in (LevelBurnt.get(id, []) as Array):
			var n = wb.parts3d.get(i, null)
			ok(n != null and n._smoked, "%s arrived burnt and is drawn charred (bench_q smoked: %s)" % [i, str((wb.backend.bench_q.get("parts", []) as Array).filter(func(q): return bool(q.get("smoked", false))).map(func(q): return q.uid))])
		if repair:
			wb.toggle_power(); await _step(0.4)
			wb.run_test(); await _frames(3)
			ok(not wb.backend.passed, "the bench fails the device as it came in")
			if wb.backend.powered: wb.toggle_power()
		if id == "1-5":
			# the exam: the paper ticket carries one box per prediction; the bench refuses until they are locked in
			wb.changed.emit(); await _frames(3)
			var boxes := wb.find_children("*", "LineEdit", true, false)
			ok(boxes.size() == 2, "the exam ticket has a box per prediction (%d)" % boxes.size())
			wb.run_test(); await _frames(2)
			ok(not wb.backend.passed and wb.note.begins_with("Predict first"), "the bench asks for predictions first: %s" % wb.note)
			wb.lock_predictions([["pva", "abc"], ["pie2", "0.5"]]); await _frames(2)
			ok(not wb.backend.predictions_done() and wb.note.contains("not a number"), "a non-number is refused: %s" % wb.note)
			boxes = wb.find_children("*", "LineEdit", true, false)   # the ticket was rebuilt
			(boxes[0] as LineEdit).text = "6.667"; (boxes[1] as LineEdit).text = "0.5556"
			(boxes[1] as LineEdit).text_submitted.emit("0.5556"); await _frames(3)
			ok(wb.backend.predictions_done(), "Enter in a box locks the predictions in: %s" % wb.note)
		ok(wb.backend.build_ref(id), "the reference build goes on (the old work is cleared first)")
		wb.sync_board(); await _frames(3)
		var left := 0
		for p in wb.backend._all_parts: if str(p.uid).begins_with("x"): left += 1
		ok(left == 0, "no part of the faulty board is left")
		if not wb.backend.powered: wb.toggle_power()
		await _step(0.6)
		# measure first (1-4 refuses the bench until the meter has been on the board): leads on the first two connectors
		var cs: Array = wb.backend.ticket.board.connectors
		wb.backend.set_dial("V"); wb.backend.set_probe("red", cs[0].pad); wb.backend.set_probe("black", cs[1].pad); await _step(0.2)
		wb.run_test(); await _frames(5)
		ok(wb.backend.passed, "the bench passes %s" % id)
		wb.changed.emit(); await _frames(3)
		var hb: Button = null
		for b in wb.find_children("*", "Button", true, false): if (b as Button).text.begins_with("Close up and hand back"): hb = b
		# the hand-back key comes before the spec rows on the paper ticket, so a tall ticket can never push it under the bench panels
		var first_spec := 99999
		if hb != null:
			var par := hb.get_parent()
			for i in par.get_child_count():
				var c := par.get_child(i)
				if c is HBoxContainer and c.get_child_count() >= 3 and str((c.get_child(0) as Label).text if c.get_child(0) is Label else "").begins_with("["): first_spec = mini(first_spec, i)
		ok(hb != null and hb.get_index() < first_spec, "the hand-back key sits above the spec rows on the ticket (key at %d, first spec at %d)" % [hb.get_index() if hb else -1, first_spec])
		if wallet0 >= 0: ok(wb.backend.wallet_minor > wallet0, "the wallet grows (%d -> %d)" % [wallet0, wb.backend.wallet_minor])
		wallet0 = wb.backend.wallet_minor
		wb.hand_back(); await _frames(5)
		ok(wb.handed and wb.case_node.state == "handed", "the device goes back to the customer")
		wb.next_job(); await _frames(10)
	ok(wb.mode == "title", "after the exam the bench goes back to the title")
	print("== free bench")
	wb.start_free(); await _frames(10)
	var item := {}
	for d in wb.drawer(): if str(d.partId) == "led-green-5mm": item = d; break
	ok(not item.is_empty(), "the free bench tray has every part (green LED found)")
	var before: int = wb.backend.parts.size()
	wb.backend.place(item, 4, 11, 0); wb.backend.place({"partId": "res-cf", "value": 1000, "variant": "0.25W", "kind": "R"}, 8, 11, 0)
	wb.backend.add_wire([4, 11], [3, 11])
	ok(wb.backend.parts.size() == before + 2, "two parts placed")
	wb.toggle_power(); await _step(0.3)
	ok(wb.backend.powered, "the free bench powers up")
	wb.backend.set_dial("V"); wb.backend.set_probe("red", [4, 11]); wb.backend.set_probe("black", [8, 11]); await _step(0.2)
	ok(wb.meter_text() != "" and not wb.meter_text().begins_with("off"), "the meter reads: %s" % wb.meter_text())
	wb.save_build(1); await _frames(2)
	ok(wb.has_build(1), "build 1 is saved")
	for p in wb.backend.parts.duplicate(): if not bool(p.get("fixed", false)): wb.backend.delete_part(str(p.uid))
	ok(wb.backend.parts.size() == before, "the board is cleared")
	wb.load_build(1); await _frames(3)
	ok(wb.backend.parts.size() == before + 2, "build 1 loads back: %s" % wb.note)
	# right-click on the middle of the resistor's body (not a leg) removes it
	wb.set_view(5, true); await _frames(3)
	var n_before: int = wb.backend.parts.size()
	var body_uid := ""
	for p in wb.backend.parts: if str(p.partId) == "res-cf": body_uid = str(p.uid)
	var body: Part3D = wb.parts3d.get(body_uid, null)
	var bm := body.body_meshes[0] as MeshInstance3D
	var ab: AABB = bm.global_transform * bm.get_aabb()
	var top: Vector3 = ab.get_center() + Vector3(0, ab.size.y * 0.5, 0)   # the top of the body, as the player sees it
	ok(top.y - wb.board.global_position.y > 0.002, "the resistor body stands above the board (%.4f m)" % (top.y - wb.board.global_position.y))
	wb._right_click(wb.cam.unproject_position(top))
	ok(wb.backend.parts.size() == n_before - 1 and wb.note.begins_with("Removed"), "right-click on a part's body removes it: %s" % wb.note)
	wb.back_to_title(); await _frames(5)
	DirAccess.remove_absolute(ProjectSettings.globalize_path(wb._build_path(1)))
	ok(trap.count == 0, "zero script errors in the whole session (%d: %s)" % [trap.count, str(trap.lines.slice(0, 3))])
	print("\n%d checks, %d failed" % [checks, fails])
	quit(1 if fails > 0 else 0)
